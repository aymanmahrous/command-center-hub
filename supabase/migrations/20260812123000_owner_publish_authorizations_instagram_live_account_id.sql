-- Align owner_publish_authorizations Instagram page_id CHECK to the live
-- Instagram Business Account ID verified via Meta Graph API (username: relaxfixuae).
-- Canonical live ID: 17841400516801494
-- Previous CHECK / historical authorizations used 17841439747493221.
-- Instagram publishing RPCs already hardcode the live ID; do not modify them here.
-- Facebook Page ID remains 1164107840123575.
--
-- Order matters: the old CHECK rejects the live ID, so DROP first, then UPDATE, then ADD.

BEGIN;

ALTER TABLE public.owner_publish_authorizations
  DROP CONSTRAINT IF EXISTS owner_publish_authorizations_platform_account_check;

UPDATE public.owner_publish_authorizations
SET page_id = '17841400516801494'
WHERE platform = 'instagram'
  AND page_id = '17841439747493221';

ALTER TABLE public.owner_publish_authorizations
  ADD CONSTRAINT owner_publish_authorizations_platform_account_check
  CHECK (
    (platform = 'facebook' AND page_id = '1164107840123575')
    OR (platform = 'instagram' AND page_id = '17841400516801494')
  );

COMMIT;
