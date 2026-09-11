-- Documentation-only companion for live fixes applied 2026-09-01:
-- 1) n8n Mark Receipt Failed2 -> Reserve Authorized Instagram Receipt2
-- 2) n8n Schedule Trigger2 timezone UTC at 08:00
-- 3) background_jobs de01b6bd processing -> queued (249aa725 not published)

-- Job reset (idempotent if already queued):
UPDATE public.background_jobs
SET status = 'queued',
    updated_at = now()
WHERE id = 'de01b6bd-23ae-4fce-9b12-ee087afc3c09'
  AND status = 'processing'
  AND NOT EXISTS (
    SELECT 1 FROM public.content_items ci
    WHERE ci.id = '249aa725-4e4b-4006-9681-e73de1fd958b'
      AND ci.published_at IS NOT NULL
      AND coalesce(ci.provider_external_id, '') <> ''
  );
