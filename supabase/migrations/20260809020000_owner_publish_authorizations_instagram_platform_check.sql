-- Allow Instagram owner authorizations alongside existing Facebook-only rows.
-- Replaces legacy single-platform CHECK constraints with one paired platform/account rule.

alter table public.owner_publish_authorizations
  drop constraint if exists owner_publish_authorizations_page_id_check;

alter table public.owner_publish_authorizations
  drop constraint if exists owner_publish_authorizations_platform_check;

alter table public.owner_publish_authorizations
  add constraint owner_publish_authorizations_platform_account_check
  check (
    (platform = 'facebook' and page_id = '1164107840123575')
    or (platform = 'instagram' and page_id = '17841439747493221')
  );
