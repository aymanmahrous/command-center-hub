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
  scheduled_for timestamptz, published_at timestamptz, updated_at timestamptz,
  planned_for timestamptz DEFAULT '2020-01-01 UTC', provider_external_id text
);
CREATE TABLE audit_logs (actor_id uuid, actor_type text, action text, entity_type text, entity_id uuid, detail jsonb);
CREATE TABLE media_assets (
  id uuid PRIMARY KEY, content_item_id uuid, storage_path text, asset_type text, metadata jsonb,
  source text, category text, media_status text, publishability_status text, consent_status text
);
CREATE TABLE background_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_type text, status text, next_retry_at timestamptz,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), payload jsonb NOT NULL
);
CREATE TABLE content_publication_receipts (content_item_id uuid, platform text, status text);
GRANT SELECT ON content_items, background_jobs TO authenticated;
GRANT UPDATE (payload, updated_at) ON background_jobs TO authenticated;

INSERT INTO content_items (id, platform, status, media_asset_id)
VALUES ('00000000-0000-4000-8000-000000000001','instagram','needs_review','00000000-0000-4000-8000-000000000002');
INSERT INTO media_assets
SELECT media_asset_id, id, 'fixture/image.png', 'image', '{"reviewStatus":"approved"}', 'uploaded',
       'swimming_business', 'ready', 'ready_for_review', 'consent_confirmed'
FROM content_items;
