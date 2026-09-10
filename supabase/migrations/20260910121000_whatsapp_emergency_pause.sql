-- Emergency pause for WhatsApp automation after verification rate limits on business numbers.
-- Safe: inbound webhooks still ACK; no outbound send path exists. No messages are sent.

CREATE TABLE IF NOT EXISTS public.messaging_channel_control (
  channel text PRIMARY KEY,
  automation_enabled boolean NOT NULL DEFAULT false,
  paused_reason text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.messaging_channel_control (channel, automation_enabled, paused_reason)
VALUES (
  'whatsapp',
  false,
  'Verification rate limit on +971551378660 and +971588219130. Automation paused until numbers are restored.'
)
ON CONFLICT (channel) DO UPDATE
SET
  automation_enabled = false,
  paused_reason = EXCLUDED.paused_reason,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.rf_whatsapp_automation_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT coalesce(
    (SELECT automation_enabled FROM public.messaging_channel_control WHERE channel = 'whatsapp'),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.rf_whatsapp_automation_enabled() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rf_whatsapp_automation_enabled() TO service_role;

CREATE OR REPLACE FUNCTION public.process_whatsapp_webhook_ingress(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_expected_phone_number_id constant text := '100566230597045';
  v_provider constant text := 'whatsapp';
  v_event_field text;
  v_provider_event_id text;
  v_wa_id text;
  v_from_phone text;
  v_normalized_phone text;
  v_contact_name text;
  v_message_body text;
  v_message_type text;
  v_phone_number_id text;
  v_language text;
  v_lead_id uuid;
  v_conversation_id uuid;
  v_message_id uuid;
  v_existing_webhook uuid;
  v_display_name text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  if public.rf_whatsapp_automation_enabled() is not true then
    return jsonb_build_object(
      'success', true,
      'code', 'WHATSAPP_AUTOMATION_PAUSED',
      'processed', false,
      'duplicate', false
    );
  end if;

  if coalesce(p_payload->>'object', '') <> 'whatsapp_business_account' then
    return jsonb_build_object('success', false, 'code', 'UNSUPPORTED_OBJECT');
  end if;

  select
    change.value->>'field',
    change.value->'value'->'metadata'->>'phone_number_id',
    msg.value->>'id',
    msg.value->>'from',
    msg.value->'text'->>'body',
    msg.value->>'type',
    contact.value->'profile'->>'name',
    contact.value->>'wa_id'
  into
    v_event_field,
    v_phone_number_id,
    v_provider_event_id,
    v_from_phone,
    v_message_body,
    v_message_type,
    v_contact_name,
    v_wa_id
  from jsonb_array_elements(coalesce(p_payload->'entry', '[]'::jsonb)) entry(value)
  cross join lateral jsonb_array_elements(coalesce(entry.value->'changes', '[]'::jsonb)) change(value)
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(change.value->'value'->'messages') = 'array'
        then change.value->'value'->'messages'
      else '[]'::jsonb
    end
  ) msg(value)
  left join lateral jsonb_array_elements(
    case
      when jsonb_typeof(change.value->'value'->'contacts') = 'array'
        then change.value->'value'->'contacts'
      else '[]'::jsonb
    end
  ) contact(value)
    on contact.value->>'wa_id' = msg.value->>'from'
  limit 1;

  if v_provider_event_id is null then
    return jsonb_build_object('success', true, 'code', 'NO_MESSAGE_EVENT', 'processed', false);
  end if;

  if v_phone_number_id is distinct from v_expected_phone_number_id then
    return jsonb_build_object('success', false, 'code', 'PHONE_NUMBER_ID_MISMATCH');
  end if;

  if coalesce(v_message_type, 'text') <> 'text' then
    return jsonb_build_object('success', true, 'code', 'UNSUPPORTED_MESSAGE_TYPE', 'processed', false);
  end if;

  v_message_body := coalesce(v_message_body, '');
  if btrim(v_message_body) = '' then
    return jsonb_build_object('success', false, 'code', 'EMPTY_MESSAGE_BODY');
  end if;

  select id
  into v_existing_webhook
  from public.webhook_events
  where provider = v_provider
    and provider_event_id = v_provider_event_id
  limit 1;

  if found then
    return jsonb_build_object(
      'success', true,
      'code', 'DUPLICATE_EVENT',
      'duplicate', true,
      'processed', false
    );
  end if;

  insert into public.webhook_events (
    provider,
    provider_event_id,
    event_type,
    payload,
    processed_at
  ) values (
    v_provider,
    v_provider_event_id,
    coalesce(v_event_field, 'messages'),
    p_payload,
    now()
  );

  v_normalized_phone := regexp_replace(coalesce(v_from_phone, ''), '[^0-9]', '', 'g');
  if left(v_normalized_phone, 5) = '00971' then
    v_normalized_phone := substring(v_normalized_phone from 6);
  elsif left(v_normalized_phone, 3) = '971' then
    v_normalized_phone := substring(v_normalized_phone from 4);
  elsif left(v_normalized_phone, 1) = '0' then
    v_normalized_phone := substring(v_normalized_phone from 2);
  end if;
  v_normalized_phone := '971' || v_normalized_phone;

  if v_normalized_phone !~ '^9715[0-9]{8}$' then
    return jsonb_build_object('success', false, 'code', 'INVALID_PHONE');
  end if;

  v_wa_id := coalesce(nullif(btrim(coalesce(v_wa_id, '')), ''), v_from_phone);
  v_contact_name := nullif(btrim(coalesce(v_contact_name, '')), '');
  v_language := case when v_message_body ~ '[ء-ي]' then 'ar' else 'en' end;
  v_display_name := coalesce(v_contact_name, v_normalized_phone);

  select id
  into v_lead_id
  from public.leads
  where normalized_phone = v_normalized_phone
  limit 1;

  if not found then
    insert into public.leads (
      name,
      full_name,
      phone,
      normalized_phone,
      language,
      source_channel,
      stage,
      score
    ) values (
      v_display_name,
      v_display_name,
      v_from_phone,
      v_normalized_phone,
      v_language,
      'whatsapp',
      'new',
      0
    )
    returning id into v_lead_id;
  else
    update public.leads
    set
      language = v_language,
      full_name = case
        when v_contact_name is not null then v_contact_name
        else full_name
      end,
      name = case
        when v_contact_name is not null then v_contact_name
        else name
      end,
      updated_at = now()
    where id = v_lead_id;
  end if;

  select id
  into v_conversation_id
  from public.conversations
  where channel = 'whatsapp'
    and external_thread_id = v_wa_id
  limit 1;

  if not found then
    insert into public.conversations (
      lead_id,
      channel,
      external_thread_id,
      mode,
      unread_count
    ) values (
      v_lead_id,
      'whatsapp',
      v_wa_id,
      'paused',
      0
    )
    returning id into v_conversation_id;
  end if;

  insert into public.messages (
    conversation_id,
    external_message_id,
    direction,
    author_type,
    body
  ) values (
    v_conversation_id,
    v_provider_event_id,
    'inbound',
    'customer',
    v_message_body
  )
  on conflict (conversation_id, external_message_id) do nothing
  returning id into v_message_id;

  if v_message_id is null then
    return jsonb_build_object(
      'success', true,
      'code', 'DUPLICATE_MESSAGE',
      'duplicate', true,
      'processed', false,
      'conversationId', v_conversation_id,
      'leadId', v_lead_id,
      'language', v_language
    );
  end if;

  update public.conversations
  set
    unread_count = unread_count + 1,
    updated_at = now()
  where id = v_conversation_id;

  return jsonb_build_object(
    'success', true,
    'code', 'MESSAGE_INGESTED',
    'processed', true,
    'duplicate', false,
    'conversationId', v_conversation_id,
    'leadId', v_lead_id,
    'messageId', v_message_id,
    'language', v_language
  );
end;
$function$;

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

  IF v_conversation.channel::text = 'whatsapp' AND public.rf_whatsapp_automation_enabled() IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'success', true,
      'code', 'WHATSAPP_AUTOMATION_PAUSED',
      'processed', false,
      'skipped', true,
      'skipReason', 'WHATSAPP_AUTOMATION_PAUSED',
      'conversationId', v_conversation.id,
      'channel', v_conversation.channel::text,
      'outboundEnabled', false
    );
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

UPDATE public.conversations
SET mode = 'paused', updated_at = now()
WHERE channel = 'whatsapp'
  AND mode <> 'paused';

UPDATE public.background_jobs
SET
  status = 'dead',
  last_error = 'WHATSAPP_AUTOMATION_PAUSED',
  updated_at = now()
WHERE job_type = 'whatsapp_human_handoff'
  AND status = 'queued';

REVOKE ALL ON FUNCTION public.process_whatsapp_webhook_ingress(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_whatsapp_webhook_ingress(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.process_ai_sales_concierge_turn(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_ai_sales_concierge_turn(uuid, uuid) TO service_role;
