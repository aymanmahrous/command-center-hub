-- Surface overdue scheduled content separately from genuinely upcoming content.
-- This is an additive read-contract change only: no content rows or job states are mutated.

CREATE OR REPLACE FUNCTION public.get_staff_control_tower_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_alerts jsonb := '[]'::jsonb;
  v_human_required integer;
  v_customer_at_risk integer;
  v_new_customers integer;
  v_overdue_scheduled integer;
  v_future_scheduled integer;
  v_attention integer;
BEGIN
  IF NOT public.is_active_staff(ARRAY['super_admin','admin','reception','coach','content_manager']) THEN
    RAISE EXCEPTION 'STAFF_ACCESS_DENIED' USING errcode = '42501';
  END IF;

  SELECT count(*)::integer INTO v_human_required
  FROM public.conversations c
  JOIN public.leads l ON l.id = c.lead_id
  WHERE c.mode::text = 'human_required' OR coalesce(l.human_required, false);

  SELECT count(*)::integer INTO v_customer_at_risk
  FROM public.staff_alerts
  WHERE alert_code = 'customer_at_risk' AND resolved_at IS NULL;

  SELECT count(*)::integer INTO v_new_customers
  FROM public.staff_alerts
  WHERE alert_code = 'new_customer' AND resolved_at IS NULL;

  SELECT count(*)::integer INTO v_overdue_scheduled
  FROM public.content_items
  WHERE status = 'scheduled'
    AND scheduled_for IS NOT NULL
    AND scheduled_for <= now();

  SELECT count(*)::integer INTO v_future_scheduled
  FROM public.content_items
  WHERE status = 'scheduled'
    AND scheduled_for > now();

  IF v_new_customers > 0 THEN
    v_alerts := v_alerts || jsonb_build_array(jsonb_build_object(
      'code', 'new_customer',
      'priority', 'medium',
      'count', v_new_customers,
      'message', 'New WhatsApp customers need a first human check-in'
    ));
  END IF;

  IF v_human_required > 0 THEN
    v_alerts := v_alerts || jsonb_build_array(jsonb_build_object(
      'code', 'human_required',
      'priority', 'high',
      'count', v_human_required,
      'message', 'Conversations waiting for staff takeover or reply'
    ));
  END IF;

  IF v_customer_at_risk > 0 THEN
    v_alerts := v_alerts || jsonb_build_array(jsonb_build_object(
      'code', 'customer_at_risk',
      'priority', 'critical',
      'count', v_customer_at_risk,
      'message', 'Customers showing confusion or repeated-question risk'
    ));
  END IF;

  IF v_overdue_scheduled > 0 THEN
    v_alerts := v_alerts || jsonb_build_array(jsonb_build_object(
      'code', 'scheduled_content_overdue',
      'priority', 'high',
      'count', v_overdue_scheduled,
      'message', 'Scheduled content has passed its planned time and needs reconciliation'
    ));
  END IF;

  v_attention := v_human_required + v_customer_at_risk + v_new_customers + v_overdue_scheduled;

  RETURN jsonb_build_object(
    'generatedAt', now(),
    'leads', jsonb_build_object(
      'total', (SELECT count(*) FROM public.leads),
      'customers', (SELECT count(*) FROM public.leads WHERE stage = 'customer'),
      'new', (SELECT count(*) FROM public.leads WHERE stage = 'new'),
      'hot', (SELECT count(*) FROM public.leads WHERE score >= 70)
    ),
    'conversations', jsonb_build_object('humanRequired', v_human_required),
    'bookings', jsonb_build_object(
      'total', (SELECT count(*) FROM public.booking_requests),
      'pending', (SELECT count(*) FROM public.booking_requests WHERE status = 'pending'),
      'confirmed', (SELECT count(*) FROM public.booking_requests WHERE status = 'confirmed')
    ),
    'content', jsonb_build_object(
      'total', (SELECT count(*) FROM public.content_items),
      'review', (SELECT count(*) FROM public.content_items WHERE status IN ('needs_review', 'generated', 'draft')),
      'scheduled', (SELECT count(*) FROM public.content_items WHERE status = 'scheduled'),
      'futureScheduled', v_future_scheduled,
      'overdueScheduled', v_overdue_scheduled,
      'published', (SELECT count(*) FROM public.content_items WHERE status = 'published'),
      'failed', (SELECT count(*) FROM public.content_items WHERE status = 'failed')
    ),
    'radar', jsonb_build_object('hot', (SELECT count(*) FROM public.radar_opportunities WHERE priority = 'HOT' AND status = 'NEW')),
    'automation', jsonb_build_object(
      'failed', (SELECT count(*) FROM public.background_jobs WHERE status IN ('failed', 'dead')),
      'active', (SELECT count(*) FROM public.background_jobs WHERE status IN ('queued', 'processing', 'retrying'))
    ),
    'revenue', jsonb_build_object(
      'invoiceCount', coalesce((SELECT count(*) FROM public.invoices), 0),
      'invoiceTotal', coalesce((SELECT sum(amount) FROM public.invoices), 0),
      'paidInvoiceTotal', coalesce((
        SELECT sum(amount) FROM public.invoices
        WHERE lower(coalesce(status::text, '')) IN ('paid', 'succeeded', 'completed')
      ), 0),
      'orderCount', coalesce((SELECT count(*) FROM public.orders), 0),
      'orderTotal', 0
    ),
    'alerts', v_alerts,
    'attentionScore', v_attention
  );
END;
$function$;
