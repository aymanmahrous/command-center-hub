-- Restore live WhatsApp phone number ID and re-enable inbound automation.
-- Outbound remains disabled (outboundEnabled=false). No duplicate-send risk.

DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def
  FROM pg_proc
  WHERE proname = 'process_whatsapp_webhook_ingress'
    AND pronamespace = 'public'::regnamespace;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'process_whatsapp_webhook_ingress not found';
  END IF;

  v_def := replace(v_def, '100566230597045', '1276699008856128');
  EXECUTE v_def;
END $$;

UPDATE public.messaging_channel_control
SET
  automation_enabled = true,
  paused_reason = NULL,
  updated_at = now()
WHERE channel = 'whatsapp';

UPDATE public.conversations
SET mode = 'ai_active', updated_at = now()
WHERE channel = 'whatsapp' AND mode = 'paused';

UPDATE public.business_settings
SET whatsapp_number = '971588219130', updated_at = now()
WHERE whatsapp_number IS DISTINCT FROM '971588219130';
