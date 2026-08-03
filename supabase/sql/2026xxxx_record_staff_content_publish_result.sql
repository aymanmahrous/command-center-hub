-- ============================================================================
-- PROPOSED SCHEMA CHANGE — DO NOT APPLY WITHOUT SIGN-OFF
-- ============================================================================
-- This file is NOT wired into any migration runner and is NOT applied by
-- the Edge Function or any CI step. It is a draft for manual review. Rename
-- it with a real migration timestamp and apply it yourself (SQL editor or
-- `supabase db push`) only after you've verified the assumptions below
-- against the actual schema.
--
-- New RPC: record_staff_content_publish_result
--
-- Purpose: called by the `safe-content-publisher` Edge Function, using the
-- CALLING STAFF MEMBER'S OWN JWT (never service-role), to persist the
-- outcome of a Meta Graph API publish attempt and write the matching
-- Audit Log entry — mirroring how every other mutation in this app writes
-- its own audit row inside the same RPC (see transition_staff_content_item,
-- update_staff_content_item, update_booking_request_status, etc.).
--
-- ASSUMPTIONS THAT NEED VERIFICATION AGAINST THE REAL SCHEMA:
--   1. `content_items` columns referenced here (status, provider_external_id,
--      published_at, platform, updated_at) are inferred only from the RPC
--      parameter names and the JSON response shape already used in
--      src/main.tsx (ContentItemSchema / ContentMutationSchema). Exact
--      types, nullability, and defaults may differ from the real table.
--   2. `audit_logs` as the table name is inferred from the negative-assertion
--      regex in tests/security-contract.test.mjs:
--        assert.doesNotMatch(app, /\/rest\/v1\/(content_items|background_jobs|audit_logs)[^\n]*(PATCH|PUT|DELETE|POST)/i)
--      Its columns below (actor_id, actor_role, action, entity_type,
--      entity_id, metadata, created_at) are a best-guess convention, NOT
--      confirmed against the real table.
--   3. That content_items writes are RPC-only — i.e. authenticated staff
--      roles have no direct table UPDATE grant/RLS policy, and the only way
--      to mutate a row is through a SECURITY DEFINER function that enforces
--      RBAC in its own body. This mirrors what the existing mutation RPCs
--      appear to do (docs describe "server-aligned RBAC" enforced per-RPC,
--      not per-row policy). If content_items actually has row-level UPDATE
--      policies instead, this function's `security definer` + manual role
--      check is redundant but still correct; if it's the other way around
--      (RLS-only, no RPC pattern), this needs rework.
--
-- Please diff this against the real definitions of
-- `transition_staff_content_item` / `update_staff_content_item` and the
-- real `audit_logs` schema, and correct anything that doesn't match before
-- running it in any environment.
-- ============================================================================

create or replace function public.record_staff_content_publish_result(
  p_content_item_id uuid,
  p_success boolean,
  p_provider_external_id text default null,
  p_platform text default null,
  p_error_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_active boolean;
  v_current_status text;
  v_now timestamptz := now();
begin
  -- Server-side RBAC check, same allowlist as every other content mutation
  -- (super_admin, admin, content_manager) — never trust the caller's claim.
  select role, active into v_role, v_active
  from public.staff_profiles
  where id = auth.uid();

  if v_role is null or v_active is not true or v_role not in ('super_admin', 'admin', 'content_manager') then
    return jsonb_build_object('success', false, 'code', 'STAFF_ACCESS_DENIED');
  end if;

  select status into v_current_status
  from public.content_items
  where id = p_content_item_id
  for update;

  if v_current_status is null then
    return jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  end if;

  -- Defense in depth: the Edge Function already checked status = 'approved'
  -- before calling Meta, but re-check here in case it changed concurrently
  -- (e.g. another tab returned it to review while the Graph API call was
  -- in flight). Note: if p_success = true here, the Meta post has ALREADY
  -- happened externally and cannot be undone by rejecting this write — that
  -- race window is a known limitation of v1, not something this RPC can fix.
  if v_current_status <> 'approved' then
    return jsonb_build_object('success', false, 'code', 'INVALID_TRANSITION');
  end if;

  if p_success then
    update public.content_items
    set status = 'published',
        provider_external_id = p_provider_external_id,
        platform = coalesce(p_platform, platform),
        published_at = v_now,
        updated_at = v_now
    where id = p_content_item_id;
  else
    update public.content_items
    set status = 'failed',
        updated_at = v_now
    where id = p_content_item_id;
  end if;

  -- Audit Log: never write p_error_code's underlying cause if it could ever
  -- contain a token; the Edge Function only ever passes short fixed codes
  -- (e.g. 'META_API_ERROR'), never raw Meta response bodies or the token.
  insert into public.audit_logs (actor_id, actor_role, action, entity_type, entity_id, metadata, created_at)
  values (
    auth.uid(),
    v_role,
    case when p_success then 'content_publish_succeeded' else 'content_publish_failed' end,
    'content_item',
    p_content_item_id,
    jsonb_strip_nulls(jsonb_build_object(
      'platform', p_platform,
      'providerExternalId', p_provider_external_id,
      'errorCode', p_error_code
    )),
    v_now
  );

  return jsonb_build_object(
    'success', p_success,
    'code', case when p_success then null else coalesce(p_error_code, 'META_API_ERROR') end,
    'contentItemId', p_content_item_id,
    'status', case when p_success then 'published' else 'failed' end,
    'updatedAt', v_now
  );
end;
$$;

revoke all on function public.record_staff_content_publish_result(uuid, boolean, text, text, text) from public;
grant execute on function public.record_staff_content_publish_result(uuid, boolean, text, text, text) to authenticated;
