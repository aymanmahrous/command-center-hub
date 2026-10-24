-- Restore the original live WhatsApp phone-number gate after a later function replacement
-- reintroduced the retired registration ID. No webhook, sender, token, or schedule changes.
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(oid)
  INTO v_def
  FROM pg_proc
  WHERE proname = 'process_whatsapp_webhook_ingress'
    AND pronamespace = 'public'::regnamespace;

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'process_whatsapp_webhook_ingress not found';
  END IF;

  IF position('1276699008856128' IN v_def) = 0 THEN
    v_def := replace(v_def, '100566230597045', '1276699008856128');
    EXECUTE v_def;
  END IF;
END $$;
