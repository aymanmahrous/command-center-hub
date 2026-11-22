-- Synthetic schema and rows for an empty in-memory PostgreSQL instance.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT 'authenticated'::text $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
CREATE FUNCTION public.is_active_staff(text[]) RETURNS boolean LANGUAGE sql AS $$
  SELECT current_setting('fixture.staff', true) IS DISTINCT FROM 'denied'
$$;
CREATE TYPE content_status AS ENUM ('idea','draft','generated','needs_review','approved','scheduled','published','failed','cancelled');
CREATE TABLE content_items (
  id uuid PRIMARY KEY, platform text, status content_status, media_asset_id uuid,
  scheduled_for timestamptz, published_at timestamptz, updated_at timestamptz
);
CREATE TABLE audit_logs (actor_id uuid, actor_type text, action text, entity_type text, entity_id uuid, detail jsonb);
CREATE TABLE media_assets (
  id uuid PRIMARY KEY, content_item_id uuid, storage_path text, asset_type text, metadata jsonb,
  source text, category text, media_status text, publishability_status text, consent_status text
);
CREATE TABLE background_jobs (
  id uuid PRIMARY KEY, job_type text, status text, next_retry_at timestamptz, created_at timestamptz,
  updated_at timestamptz, payload jsonb
);
GRANT SELECT ON content_items, background_jobs TO authenticated;
GRANT UPDATE (payload, updated_at) ON background_jobs TO authenticated;

INSERT INTO content_items (id, platform, status, media_asset_id)
VALUES ('00000000-0000-4000-8000-000000000001','instagram','needs_review','00000000-0000-4000-8000-000000000002');
INSERT INTO media_assets
SELECT media_asset_id, id, 'fixture/image.png', 'image', '{"reviewStatus":"approved"}', 'uploaded',
       'swimming_business', 'ready', 'ready_for_review', 'consent_confirmed'
FROM content_items;

-- Job 2 wins the timestamp tie with 1. All subsequent rows must stay untouched.
INSERT INTO background_jobs
SELECT lpad(n::text,32,'0')::uuid,
       CASE WHEN n=4 THEN 'other' ELSE 'publish_content' END,
       CASE WHEN n=5 THEN 'completed' ELSE 'queued' END,
       timestamptz '2095-08-10 12:30 UTC' + CASE WHEN n=6 THEN interval '1 hour' ELSE interval '0' END,
       timestamptz '2020-01-01 UTC' + CASE WHEN n=3 THEN interval '-1 hour' ELSE interval '0' END,
       NULL, jsonb_build_object('contentItemId', CASE WHEN n=7 THEN NULL ELSE id END, 'original', n)
FROM content_items CROSS JOIN generate_series(1,7) AS n;
