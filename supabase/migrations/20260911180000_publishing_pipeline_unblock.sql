-- Unblock Instagram scheduled publishing after scheduler outage and stale reserved receipts.
-- Safe: only clears reserved receipts with no provider evidence; does not publish or retry automatically.

UPDATE public.content_publication_receipts
SET
  status = 'failed',
  last_error = 'MANUAL_CONFIRMED_NOT_PUBLISHED: STALE_RESERVED_RECEIPT_CLEARED_20260911',
  updated_at = now()
WHERE status = 'reserved'
  AND external_post_id IS NULL
  AND external_container_id IS NULL;

INSERT INTO public.audit_logs (actor_id, actor_type, action, entity_type, entity_id, detail)
SELECT
  NULL,
  'system',
  'publishing_pipeline_unblock_receipt_cleared',
  'content_item',
  r.content_item_id,
  jsonb_build_object(
    'receiptId', r.id,
    'previousStatus', 'reserved',
    'platform', r.platform,
    'reason', 'STALE_RESERVED_RECEIPT_CLEARED_20260911'
  )
FROM public.content_publication_receipts r
WHERE r.last_error = 'MANUAL_CONFIRMED_NOT_PUBLISHED: STALE_RESERVED_RECEIPT_CLEARED_20260911'
  AND r.status = 'failed'
  AND r.updated_at >= now() - interval '1 minute';

-- Ensure scheduler remains active (idempotent).
UPDATE public.content_automation_scheduler_auth
SET active = true, updated_at = now()
WHERE id = 'primary';
