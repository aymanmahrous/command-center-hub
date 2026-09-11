-- Safeguard automation: cancel stale duplicate publish queue, reduce cron pulse waste,
-- record publishing checkpoint. No workflow deletion.

-- 1) Disable website content-automation pulse auth (pg_cron job remains; dispatch exits early when inactive).
UPDATE public.content_automation_scheduler_auth
SET active = false,
    updated_at = now()
WHERE id = 'primary';

-- 2) Cancel obsolete duplicate scheduled Instagram items that would republish already-covered slots.
-- These items have background_jobs but were superseded by the live published line (Aug 18–26).
UPDATE public.content_items ci
SET status = 'cancelled',
    updated_at = now()
WHERE ci.platform = 'instagram'
  AND ci.status = 'scheduled'
  AND ci.published_at IS NULL
  AND ci.scheduled_for < '2026-08-27 00:00:00+00'
  AND EXISTS (
    SELECT 1
    FROM public.background_jobs bj
    WHERE bj.job_type = 'publish_content'
      AND bj.payload->>'contentItemId' = ci.id::text
      AND bj.status IN ('queued', 'processing', 'retrying')
  );

-- 3) Dead-end matching publish jobs so authorize_next_due cannot pick stale candidates.
UPDATE public.background_jobs bj
SET status = 'dead',
    updated_at = now(),
    last_error = coalesce(last_error, 'CANCELLED_STALE_DUPLICATE_QUEUE_20260901')
WHERE bj.job_type = 'publish_content'
  AND bj.status IN ('queued', 'processing', 'retrying')
  AND EXISTS (
    SELECT 1
    FROM public.content_items ci
    WHERE ci.id::text = bj.payload->>'contentItemId'
      AND ci.platform = 'instagram'
      AND ci.status = 'cancelled'
  );

-- 4) Publishing checkpoint (audit trail; source of truth remains content_items).
INSERT INTO public.audit_logs (
  actor_type,
  action,
  entity_type,
  entity_id,
  detail
) VALUES (
  'system',
  'automation_publish_checkpoint',
  'content_item',
  'f892e9a7-ebea-4354-b1ee-f4816a058408',
  jsonb_build_object(
    'lastPublishedContentId', 'f892e9a7-ebea-4354-b1ee-f4816a058408',
    'lastPublishedPlatform', 'instagram',
    'lastPublishedAt', '2026-08-26T08:02:21.997+00',
    'lastPublishedExternalId', '6a82cb74f17c799e9a48bcd4',
    'lastPublishedFacebookContentId', '3e2289b7-b1fd-4730-942d-58cae5296bbe',
    'lastPublishedFacebookAt', '2026-08-26T08:01:36.617+00',
    'nextScheduledContentId', '249aa725-4e4b-4006-9681-e73de1fd958b',
    'nextScheduledFor', '2026-08-27T08:00:00+00',
    'nextScheduledPlatform', 'instagram',
    'duplicateProtection', 'stale_jobs_cancelled_before_2026_08_27',
    'note', 'Resume from 249aa725; do not republish f892e9a7'
  )
);
