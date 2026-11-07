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
  IF coalesce(auth.role(), '') <> 'service_role'
     AND NOT public.is_active_staff(ARRAY['super_admin','admin','reception','content_manager']) THEN
    RAISE EXCEPTION 'STAFF_ACCESS_DENIED' USING errcode = '42501';
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

  -- Lock the lead row so a concurrent opt-out cannot race the send authorization.
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
