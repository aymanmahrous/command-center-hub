-- Internal inbox helpers must never be callable directly by browser/public roles.
-- They are invoked by trusted SECURITY DEFINER workflow functions and server-side
-- service-role workers. Keep the internal call path; remove direct RPC exposure.

REVOKE ALL ON FUNCTION public.route_conversation_to_human(uuid, uuid, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.route_conversation_to_human(uuid, uuid, text, text, text, jsonb)
  TO service_role;

REVOKE ALL ON FUNCTION public.upsert_staff_alert(text, text, text, uuid, uuid, uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_staff_alert(text, text, text, uuid, uuid, uuid, text, jsonb)
  TO service_role;

REVOKE ALL ON FUNCTION public.resolve_staff_alerts_for_conversation(uuid, text[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_staff_alerts_for_conversation(uuid, text[])
  TO service_role;
