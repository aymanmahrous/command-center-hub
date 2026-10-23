-- Defense in depth: align EXECUTE grants with the authorization checks already
-- enforced inside these SECURITY DEFINER functions.
-- This migration changes RPC privileges only: no function bodies, RLS policies,
-- secrets, publishing behavior, or messaging logic are modified.
--
-- The exact signatures below were checked against the live production catalog.
-- Service-only routines explicitly reject any auth.role() other than service_role.

-- Internal content-generation / scheduling operations.
REVOKE EXECUTE ON FUNCTION public.claim_ai_concierge_generation(uuid, uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ai_concierge_generation(uuid, uuid, integer, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.create_automated_content_batch(jsonb, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_automated_content_batch(jsonb, text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.evaluate_content_batch_generation_need() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_content_batch_generation_need() TO service_role;
REVOKE EXECUTE ON FUNCTION public.prepare_approved_publish_schedule(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_approved_publish_schedule(uuid) TO service_role;

-- Internal AI concierge processing / usage accounting.
REVOKE EXECUTE ON FUNCTION public.log_ai_concierge_usage(uuid, uuid, text, text, text, integer, integer, integer, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.log_ai_concierge_usage(uuid, uuid, text, text, text, integer, integer, integer, boolean, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.process_ai_sales_concierge_turn(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_ai_sales_concierge_turn(uuid, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.process_ai_sales_concierge_turn_v1(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_ai_sales_concierge_turn_v1(uuid, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.process_ai_sales_concierge_turn_v1_core(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_ai_sales_concierge_turn_v1_core(uuid, uuid) TO service_role;

-- Internal push notification credentials, recipient lookup, and delivery bookkeeping.
REVOKE EXECUTE ON FUNCTION public.deactivate_push_subscription(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_push_subscription(text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_push_subscriptions_for_dispatch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_push_subscriptions_for_dispatch() TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_push_worthy_events() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_push_worthy_events() TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_vapid_credentials() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vapid_credentials() TO service_role;
REVOKE EXECUTE ON FUNCTION public.mark_push_event_delivered(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_push_event_delivered(text) TO service_role;

-- Internal website / Meta / WhatsApp ingress and website conversation history.
REVOKE EXECUTE ON FUNCTION public.get_web_widget_history(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_web_widget_history(text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.ingest_radar_candidate(text, text, text, text, text, timestamptz, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_radar_candidate(text, text, text, text, text, timestamptz, jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.process_meta_messaging_webhook_ingress(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_meta_messaging_webhook_ingress(jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.process_whatsapp_webhook_ingress(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_whatsapp_webhook_ingress(jsonb) TO service_role;
REVOKE EXECUTE ON FUNCTION public.process_web_widget_ingress(text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_web_widget_ingress(text, uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.process_web_widget_ingress(text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_web_widget_ingress(text, uuid, text, jsonb) TO service_role;

-- Internal WhatsApp message persistence and lesson-booking writes.
REVOKE EXECUTE ON FUNCTION public.record_staff_whatsapp_outbound(uuid, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_staff_whatsapp_outbound(uuid, text, text, uuid, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.rf_check_lesson_availability(text, text, timestamptz, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rf_check_lesson_availability(text, text, timestamptz, integer, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.rf_commit_messenger_lesson_booking(text, uuid, uuid, text, text, timestamptz, integer, text, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rf_commit_messenger_lesson_booking(text, uuid, uuid, text, text, timestamptz, integer, text, text, text, boolean) TO service_role;
REVOKE EXECUTE ON FUNCTION public.rf_finalize_lesson_booking_gcal(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rf_finalize_lesson_booking_gcal(uuid, text, uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.rf_prepare_lesson_booking_write(text, text, timestamptz, integer, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rf_prepare_lesson_booking_write(text, text, timestamptz, integer, text, text, boolean) TO service_role;
REVOKE EXECUTE ON FUNCTION public.rf_sync_lesson_occupancy_from_gcal(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rf_sync_lesson_occupancy_from_gcal(jsonb) TO service_role;

-- Staff-facing operations retain authenticated access; their function bodies
-- enforce active-staff role checks. Anonymous/public invocation is removed.
REVOKE EXECUTE ON FUNCTION public.approve_staff_content_batch(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_staff_content_batch(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.assert_staff_whatsapp_send_allowed(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_staff_whatsapp_send_allowed(uuid, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.cancel_staff_background_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_staff_background_job(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_staff_attention_center() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_attention_center() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_staff_control_tower_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_control_tower_summary() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_staff_radar_opportunities(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_radar_opportunities(text, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_staff_radar_pool_performance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_radar_pool_performance() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_staff_radar_source_performance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_radar_source_performance() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_staff_radar_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_radar_stats() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.record_staff_content_publish_result(uuid, boolean, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_staff_content_publish_result(uuid, boolean, text, text, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.register_staff_media_upload(text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_staff_media_upload(text, text, jsonb) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.register_staff_push_subscription(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_staff_push_subscription(text, text, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.retry_staff_publish_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retry_staff_publish_job(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.return_staff_conversation_to_ai(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.return_staff_conversation_to_ai(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.save_staff_media_ai_analysis(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_staff_media_ai_analysis(uuid, jsonb, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.set_staff_ai_provider(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_staff_ai_provider(text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.set_staff_radar_opportunity_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_staff_radar_opportunity_status(uuid, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.take_over_staff_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.take_over_staff_conversation(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.unregister_staff_push_subscription(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unregister_staff_push_subscription(text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.update_staff_content_batch_planned_for(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_staff_content_batch_planned_for(uuid, jsonb) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.update_staff_media_asset(uuid, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_staff_media_asset(uuid, text, text, text, uuid) TO authenticated, service_role;
