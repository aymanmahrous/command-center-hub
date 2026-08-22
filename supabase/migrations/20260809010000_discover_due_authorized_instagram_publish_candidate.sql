-- Read-only discovery for one due, owner-authorized Instagram publish candidate.
-- Does NOT claim, consume authorization, or mutate content/jobs.
-- Approved Instagram Business Account ID: 17841439747493221

create or replace function public.discover_due_authorized_instagram_publish_candidate()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_content_item_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  select ci.id
  into v_content_item_id
  from public.content_items ci
  inner join public.background_jobs bj
    on bj.job_type = 'publish_content'
    and bj.payload->>'contentItemId' = ci.id::text
    and bj.status in ('queued', 'retrying')
    and coalesce(bj.next_retry_at, bj.created_at) <= now()
  inner join public.owner_publish_authorizations opa
    on opa.content_item_id = ci.id
    and opa.platform = 'instagram'
    and opa.page_id = '17841439747493221'
    and opa.publish_job_id = bj.id
    and opa.consumed_at is null
    and opa.revoked_at is null
    and opa.expires_at > now()
  where ci.platform = 'instagram'
    and ci.status = 'scheduled'
    and ci.scheduled_for is not null
    and ci.scheduled_for <= now()
  order by ci.scheduled_for asc, ci.id asc
  limit 1;

  if not found then
    return jsonb_build_object('found', false, 'code', 'NO_CANDIDATE');
  end if;

  return jsonb_build_object(
    'found', true,
    'contentItemId', v_content_item_id
  );
end;
$function$;

revoke all on function public.discover_due_authorized_instagram_publish_candidate() from public, anon, authenticated;
grant execute on function public.discover_due_authorized_instagram_publish_candidate() to service_role;
