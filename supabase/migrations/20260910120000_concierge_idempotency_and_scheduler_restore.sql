-- Concierge idempotency: one AI turn per inbound message (race-safe).
-- Scheduler restore: re-enable content automation pulse target (no publish here).

CREATE OR REPLACE FUNCTION public.process_ai_sales_concierge_turn(
  p_conversation_id uuid,
  p_message_id uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_conversation public.conversations%rowtype;
  v_lead public.leads%rowtype;
  v_message public.messages%rowtype;
  v_body text;
  v_language text;
  v_prior_raw text;
  v_prior_state text;
  v_pre jsonb;
  v_draft text;
  v_state text;
  v_intent text;
  v_draft_message_id uuid;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING errcode = '42501';
  END IF;

  SELECT * INTO v_conversation
  FROM public.conversations
  WHERE id = p_conversation_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'CONVERSATION_NOT_FOUND');
  END IF;

  SELECT * INTO v_lead
  FROM public.leads
  WHERE id = v_conversation.lead_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'LEAD_NOT_FOUND');
  END IF;

  IF p_message_id IS NOT NULL THEN
    SELECT * INTO v_message
    FROM public.messages
    WHERE id = p_message_id
      AND conversation_id = p_conversation_id
      AND direction = 'inbound'
      AND author_type = 'customer';
  ELSE
    SELECT * INTO v_message
    FROM public.messages
    WHERE conversation_id = p_conversation_id
      AND direction = 'inbound'
      AND author_type = 'customer'
    ORDER BY created_at DESC, id DESC
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'INBOUND_MESSAGE_NOT_FOUND');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_message.id::text, 0));

  IF EXISTS (
    SELECT 1
    FROM public.audit_logs
    WHERE action IN ('ai_sales_concierge_turn', 'ai_sales_concierge_v2_prerouter')
      AND detail->>'messageId' = v_message.id::text
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'code', 'DUPLICATE_TURN',
      'processed', false,
      'skipped', true,
      'skipReason', 'INBOUND_ALREADY_PROCESSED',
      'conversationId', v_conversation.id,
      'leadId', v_lead.id,
      'messageId', v_message.id,
      'channel', v_conversation.channel::text,
      'outboundEnabled', false
    );
  END IF;

  v_body := btrim(coalesce(v_message.body, ''));
  v_language := CASE
    WHEN v_body ~ '[ء-ي]' THEN 'ar'
    WHEN v_body ~ '[A-Za-z]' THEN 'en'
    ELSE CASE WHEN coalesce(v_lead.language, '') IN ('ar','en') THEN v_lead.language ELSE 'en' END
  END;

  v_prior_raw := CASE
    WHEN coalesce(v_lead.intent, '') LIKE 'concierge:%' THEN substring(v_lead.intent from 11)
    ELSE 'greeting'
  END;
  v_prior_state := split_part(v_prior_raw, '__', 1);

  v_pre := public.rf_concierge_v2_prerouter(v_language, v_body, v_prior_state);

  IF coalesce((v_pre->>'handled')::boolean, false) IS NOT TRUE THEN
    RETURN public.process_ai_sales_concierge_turn_v1(p_conversation_id, p_message_id);
  END IF;

  IF v_conversation.mode::text <> 'ai_active' THEN
    RETURN public.process_ai_sales_concierge_turn_v1(p_conversation_id, p_message_id);
  END IF;

  v_draft := v_pre->>'draft';
  v_state := coalesce(v_pre->>'state', 'general_help');
  v_intent := coalesce(v_pre->>'intent', v_state);

  UPDATE public.leads
  SET language = v_language,
      intent = 'concierge:' || v_state,
      updated_at = now()
  WHERE id = v_lead.id;

  INSERT INTO public.messages (
    conversation_id,
    direction,
    author_type,
    body,
    safety_classification
  ) VALUES (
    v_conversation.id,
    'outbound',
    'ai',
    v_draft,
    'approved_offer_only'
  ) RETURNING id INTO v_draft_message_id;

  INSERT INTO public.audit_logs (
    actor_id, actor_type, action, entity_type, entity_id, detail
  ) VALUES (
    null,
    'system',
    'ai_sales_concierge_v2_prerouter',
    'conversation',
    v_conversation.id,
    jsonb_build_object(
      'leadId', v_lead.id,
      'messageId', v_message.id,
      'draftMessageId', v_draft_message_id,
      'language', v_language,
      'state', v_state,
      'intent', v_intent,
      'priorState', v_prior_state,
      'outboundEnabled', false
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'code', 'DRAFT_READY',
    'processed', true,
    'skipped', false,
    'conversationId', v_conversation.id,
    'leadId', v_lead.id,
    'messageId', v_message.id,
    'draftMessageId', v_draft_message_id,
    'channel', v_conversation.channel::text,
    'language', v_language,
    'intent', 'concierge:' || v_state,
    'stage', v_lead.stage::text,
    'score', coalesce(v_lead.score, 0),
    'humanHandoff', false,
    'conversationLocked', false,
    'draftReply', v_draft,
    'outboundEnabled', false,
    'bookingWriteUsed', false,
    'gcalPayload', null,
    'bookingId', null,
    'occupancyId', null,
    'resumed', false
  );
END;
$function$;

DO $do$
BEGIN
  IF to_regprocedure('public.process_ai_sales_concierge_turn_v1_core(uuid,uuid)') IS NULL
     AND to_regprocedure('public.process_ai_sales_concierge_turn_v1(uuid,uuid)') IS NOT NULL THEN
    ALTER FUNCTION public.process_ai_sales_concierge_turn_v1(uuid, uuid)
      RENAME TO process_ai_sales_concierge_turn_v1_core;
  END IF;
END;
$do$;

CREATE OR REPLACE FUNCTION public.process_ai_sales_concierge_turn_v1(
  p_conversation_id uuid,
  p_message_id uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_message_id uuid;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING errcode = '42501';
  END IF;

  IF p_message_id IS NOT NULL THEN
    v_message_id := p_message_id;
  ELSE
    SELECT id INTO v_message_id
    FROM public.messages
    WHERE conversation_id = p_conversation_id
      AND direction = 'inbound'
      AND author_type = 'customer'
    ORDER BY created_at DESC, id DESC
    LIMIT 1;
  END IF;

  IF v_message_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INBOUND_MESSAGE_NOT_FOUND');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_message_id::text, 0));

  IF EXISTS (
    SELECT 1
    FROM public.audit_logs
    WHERE action IN ('ai_sales_concierge_turn', 'ai_sales_concierge_v2_prerouter')
      AND detail->>'messageId' = v_message_id::text
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'code', 'DUPLICATE_TURN',
      'processed', false,
      'skipped', true,
      'skipReason', 'INBOUND_ALREADY_PROCESSED',
      'conversationId', p_conversation_id,
      'messageId', v_message_id,
      'outboundEnabled', false
    );
  END IF;

  RETURN public.process_ai_sales_concierge_turn_v1_core(p_conversation_id, p_message_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.process_ai_sales_concierge_turn(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_ai_sales_concierge_turn(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.process_ai_sales_concierge_turn_v1(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_ai_sales_concierge_turn_v1(uuid, uuid) TO service_role;

UPDATE public.content_automation_scheduler_auth
SET active = true
WHERE id = 'primary';

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE command = 'select public.dispatch_content_automation_pulse();';

SELECT cron.schedule(
  'relax_fix_content_automation_pulse',
  '0 8 * * *',
  $$select public.dispatch_content_automation_pulse();$$
);

UPDATE public.content_items AS ci
SET
  scheduled_for = v.new_scheduled_for,
  updated_at = now()
FROM (
  VALUES
    ('249aa725-4e4b-4006-9681-e73de1fd958b'::uuid, timestamptz '2026-09-11 08:00:00+00'),
    ('cff7b2fb-fc5a-4f75-aeb3-5d5976b51c91'::uuid, timestamptz '2026-09-12 08:00:00+00'),
    ('e557c98c-0759-4dac-a2bf-98aff5e4b6ed'::uuid, timestamptz '2026-09-13 08:00:00+00'),
    ('2bfbe1ea-e853-4023-9609-ddcca9792dce'::uuid, timestamptz '2026-09-14 08:00:00+00'),
    ('2621acd5-4e7e-44a3-a6f4-78f780022518'::uuid, timestamptz '2026-09-15 08:00:00+00'),
    ('5deae751-cea4-4713-9a8d-dc5b6c384909'::uuid, timestamptz '2026-09-16 08:00:00+00')
) AS v(content_id, new_scheduled_for)
WHERE ci.id = v.content_id
  AND ci.status = 'scheduled';

UPDATE public.background_jobs AS bj
SET
  next_retry_at = v.new_scheduled_for,
  updated_at = now()
FROM (
  VALUES
    ('249aa725-4e4b-4006-9681-e73de1fd958b', timestamptz '2026-09-11 08:00:00+00'),
    ('cff7b2fb-fc5a-4f75-aeb3-5d5976b51c91', timestamptz '2026-09-12 08:00:00+00'),
    ('e557c98c-0759-4dac-a2bf-98aff5e4b6ed', timestamptz '2026-09-13 08:00:00+00'),
    ('2bfbe1ea-e853-4023-9609-ddcca9792dce', timestamptz '2026-09-14 08:00:00+00'),
    ('2621acd5-4e7e-44a3-a6f4-78f780022518', timestamptz '2026-09-15 08:00:00+00'),
    ('5deae751-cea4-4713-9a8d-dc5b6c384909', timestamptz '2026-09-16 08:00:00+00')
) AS v(content_item_id, new_scheduled_for)
WHERE bj.job_type = 'publish_content'
  AND bj.status = 'queued'
  AND bj.payload->>'contentItemId' = v.content_item_id;
