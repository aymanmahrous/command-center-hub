-- Defense in depth: align EXECUTE grants with the authorization checks already
-- enforced inside these SECURITY DEFINER functions.
-- This migration is intentionally limited to RPC privileges; it does not change
-- function bodies, RLS policies, secrets, publishing, or messaging behavior.

-- Internal service-role-only operations. Their function bodies explicitly
-- require auth.role() = 'service_role'.
REVOKE EXECUTE ON FUNCTION public.get_push_subscriptions_for_dispatch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_push_subscriptions_for_dispatch() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_vapid_credentials() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vapid_credentials() TO service_role;

REVOKE EXECUTE ON FUNCTION public.prepare_approved_publish_schedule(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_approved_publish_schedule(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.process_ai_sales_concierge_turn(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_ai_sales_concierge_turn(uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.process_meta_messaging_webhook_ingress(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_meta_messaging_webhook_ingress(jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.process_whatsapp_webhook_ingress(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_whatsapp_webhook_ingress(jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.process_web_widget_ingress(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_web_widget_ingress(text, uuid, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.process_web_widget_ingress(text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_web_widget_ingress(text, uuid, text, jsonb) TO service_role;

REVOKE EXECUTE ON FUNCTION public.record_staff_whatsapp_outbound(uuid, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_staff_whatsapp_outbound(uuid, text, text, uuid, text) TO service_role;

-- Staff-facing operations retain authenticated access because the function
-- bodies enforce active-staff role checks. Anonymous/public invocation is removed.
REVOKE EXECUTE ON FUNCTION public.approve_staff_content_batch(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_staff_content_batch(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.assert_staff_whatsapp_send_allowed(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_staff_whatsapp_send_allowed(uuid, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_staff_attention_center() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_attention_center() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_staff_control_tower_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_control_tower_summary() TO authenticated, service_role;
