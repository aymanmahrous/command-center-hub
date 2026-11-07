-- Prevent staff WhatsApp replies to leads that have opted out of contact.
-- This is a server-side guard; UI checks are not sufficient for external messaging.

CREATE OR REPLACE FUNCTION public.assert_staff_whatsapp_send_allowed(p_conversation_id uuid, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_conversation public.conversations%rowtype;
  v_lead public.leads%rowtype;
  v_body text;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING errcode = '42501';
  END IF;

  v_body := btrim(coalesce(p_body, ''));
  IF v_body = '' OR char_length(v_body) > 4096 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_BODY');
  END IF;

  SELECT * INTO v_conversation
  FROM public.conversations
  WHERE id = p_conversation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  END IF;

  IF v_conversation.channel::text <> 'whatsapp' THEN
    RETURN jsonb_build_object('success', false, 'code', 'CHANNEL_NOT_WHATSAPP');
  END IF;

  IF v_conversation.mode::text NOT IN ('human_takeover', 'human_required') THEN
    RETURN jsonb_build_object('success', false, 'code', 'HUMAN_MODE_REQUIRED');
  END IF;

  -- Read the current contact preference before authorizing an external reply.
  SELECT * INTO v_lead
  FROM public.leads
  WHERE id = v_conversation.lead_id
  FOR UPDATE;

  IF NOT FOUND OR coalesce(v_lead.normalized_phone, '') = '' THEN
    RETURN jsonb_build_object('success', false, 'code', 'LEAD_PHONE_MISSING');
  END IF;

  IF coalesce(v_lead.do_not_contact, false) THEN
    RETURN jsonb_build_object('success', false, 'code', 'DO_NOT_CONTACT');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'conversationId', v_conversation.id,
    'leadId', v_lead.id,
    'recipientPhone', v_lead.normalized_phone,
    'externalThreadId', v_conversation.external_thread_id,
    'mode', v_conversation.mode::text
  );
END;
$function$;


-- Expose the opt-out flag to the owner inbox so the composer can be disabled
-- before a staff member attempts a reply. The send-time RPC above remains authoritative.
CREATE OR REPLACE FUNCTION public.get_staff_inbox()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.is_active_staff(ARRAY['super_admin','admin','reception','coach','content_manager']) THEN
    RAISE EXCEPTION 'STAFF_ACCESS_DENIED' USING errcode = '42501';
  END IF;

  RETURN coalesce(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'leadId', c.lead_id,
          'leadName', coalesce(l.name, l.full_name, 'Unknown'),
          'channel', c.channel::text,
          'mode', c.mode::text,
          'unread', coalesce(c.unread_count, 0),
          'lastMessage', coalesce(last_msg.body, ''),
          'updatedAt', c.updated_at,
          'leadScore', coalesce(l.score, 0),
          'intent', coalesce(l.intent, ''),
          'humanRequired', coalesce(l.human_required, false),
          'doNotContact', coalesce(l.do_not_contact, false),
          'needsAttention', coalesce(c.needs_attention, false) OR c.mode::text IN ('human_required', 'human_takeover') OR coalesce(l.human_required, false),
          'handoffReason', c.handoff_reason
        )
        ORDER BY coalesce(c.needs_attention, false) DESC, coalesce(c.unread_count, 0) DESC, c.updated_at DESC
      )
      FROM public.conversations c
      JOIN public.leads l ON l.id = c.lead_id
      LEFT JOIN LATERAL (
        SELECT m.body
        FROM public.messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT 1
      ) last_msg ON true
    ),
    '[]'::jsonb
  );
END;
$function$;


-- Prevent direct RPC calls from reactivating AI for an opted-out lead.
CREATE OR REPLACE FUNCTION public.set_staff_conversation_mode(p_conversation_id uuid, p_mode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_conversation public.conversations%rowtype;
  v_lead public.leads%rowtype;
  v_previous_mode text;
begin
  if not public.is_active_staff(array['super_admin','admin','reception']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  if p_mode not in ('ai_active','human_takeover','human_required','paused') then
    return jsonb_build_object('success', false, 'code', 'INVALID_MODE');
  end if;

  select * into v_conversation
  from public.conversations
  where id = p_conversation_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  end if;

  SELECT * INTO v_lead FROM public.leads WHERE id = v_conversation.lead_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'LEAD_NOT_FOUND');
  END IF;

  IF p_mode = 'ai_active' AND coalesce(v_lead.do_not_contact, false) THEN
    RETURN jsonb_build_object('success', false, 'code', 'DO_NOT_CONTACT');
  END IF;

  v_previous_mode := v_conversation.mode::text;
  if v_previous_mode = p_mode then
    return jsonb_build_object(
      'success', true,
      'conversationId', v_conversation.id,
      'mode', v_conversation.mode::text,
      'changed', false
    );
  end if;

  update public.conversations
  set mode = p_mode::public.conversation_mode,
      updated_at = now()
  where id = p_conversation_id
  returning * into v_conversation;

  update public.leads
  set human_required = case
        when p_mode in ('human_takeover','human_required') then true
        when p_mode = 'ai_active' then false
        else human_required
      end,
      updated_at = now()
  where id = v_conversation.lead_id;

  insert into public.audit_logs (
    actor_id, actor_type, action, entity_type, entity_id, detail
  ) values (
    auth.uid(), 'user', 'conversation_mode_updated', 'conversation', v_conversation.id,
    jsonb_build_object('previousMode', v_previous_mode, 'nextMode', v_conversation.mode::text)
  );

  return jsonb_build_object(
    'success', true,
    'conversationId', v_conversation.id,
    'mode', v_conversation.mode::text,
    'changed', true
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.return_staff_conversation_to_ai(p_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_conversation public.conversations%rowtype;
  v_lead public.leads%rowtype;
BEGIN
  IF NOT public.is_active_staff(ARRAY['super_admin','admin','reception','coach','content_manager']) THEN
    RAISE EXCEPTION 'STAFF_ACCESS_DENIED' USING errcode = '42501';
  END IF;

  SELECT * INTO v_conversation
  FROM public.conversations
  WHERE id = p_conversation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  END IF;

  SELECT * INTO v_lead FROM public.leads WHERE id = v_conversation.lead_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'LEAD_NOT_FOUND');
  END IF;

  IF coalesce(v_lead.do_not_contact, false) THEN
    RETURN jsonb_build_object('success', false, 'code', 'DO_NOT_CONTACT');
  END IF;

  UPDATE public.conversations
  SET mode = 'ai_active', handoff_reason = NULL, needs_attention = false, updated_at = now()
  WHERE id = p_conversation_id;

  UPDATE public.leads
  SET human_required = false, updated_at = now()
  WHERE id = v_conversation.lead_id;

  PERFORM public.resolve_staff_alerts_for_conversation(p_conversation_id, ARRAY['human_required', 'customer_at_risk']);

  INSERT INTO public.audit_logs(actor_id, actor_type, action, entity_type, entity_id, detail)
  VALUES (
    auth.uid(), 'user', 'conversation_returned_to_ai', 'conversation', p_conversation_id,
    jsonb_build_object('previousMode', v_conversation.mode::text, 'nextMode', 'ai_active')
  );

  RETURN jsonb_build_object('success', true, 'conversationId', p_conversation_id, 'mode', 'ai_active');
END;
$function$



-- This preflight RPC is an internal Edge Function boundary, never a browser API.
REVOKE ALL ON FUNCTION public.assert_staff_whatsapp_send_allowed(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_staff_whatsapp_send_allowed(uuid, text) TO service_role;
