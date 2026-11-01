-- Align the existing Meta publishing worker with the Preview database contract.
-- Review/apply separately; this migration is intentionally not executed by this task.
-- It is additive and does not delete historical rows.

alter table public.content_publication_receipts
  drop constraint if exists content_publication_receipts_status_check;

alter table public.content_publication_receipts
  add constraint content_publication_receipts_status_check
  check (status in ('pending', 'sent', 'confirmed', 'published', 'failed', 'ambiguous'));

alter table public.background_jobs
  drop constraint if exists background_jobs_status_check;

alter table public.background_jobs
  add constraint background_jobs_status_check
  check (status in ('queued', 'running', 'processing', 'retrying', 'completed', 'dead', 'cancelled', 'failed'));

create or replace function public.claim_publication_receipt(
  p_content_item_id uuid,
  p_platform text,
  p_provider text default 'meta-graph-publishing'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_receipt public.content_publication_receipts%rowtype;
  v_platform text := lower(btrim(coalesce(p_platform, '')));
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if p_content_item_id is null or v_platform not in ('facebook', 'instagram') then
    return jsonb_build_object('status', 'invalid');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_content_item_id::text || ':' || v_platform, 0));

  select * into v_receipt
  from public.content_publication_receipts
  where content_item_id = p_content_item_id
    and lower(platform) = v_platform
  order by created_at desc, id desc
  limit 1
  for update;

  if found then
    if v_receipt.status in ('published', 'confirmed') then
      return jsonb_build_object('status', v_receipt.status, 'externalPostId', v_receipt.external_post_id);
    end if;
    if v_receipt.status in ('ambiguous', 'pending', 'sent') then
      return jsonb_build_object('status', 'ambiguous', 'externalPostId', v_receipt.external_post_id);
    end if;
    if v_receipt.status = 'failed' then
      return jsonb_build_object('status', 'failed', 'externalPostId', v_receipt.external_post_id);
    end if;
  end if;

  insert into public.content_publication_receipts (
    content_item_id, platform, provider, status, external_post_id, last_error, created_at, updated_at
  ) values (
    p_content_item_id, v_platform, coalesce(nullif(btrim(p_provider), ''), 'meta-graph-publishing'), 'pending', null, null, now(), now()
  ) returning * into v_receipt;

  return jsonb_build_object('status', 'pending', 'receiptId', v_receipt.id);
end;
$function$;

create or replace function public.complete_publication_receipt(
  p_content_item_id uuid,
  p_platform text,
  p_provider text,
  p_external_post_id text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_receipt public.content_publication_receipts%rowtype;
  v_platform text := lower(btrim(coalesce(p_platform, '')));
  v_external_id text := btrim(coalesce(p_external_post_id, ''));
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if p_content_item_id is null or v_platform not in ('facebook', 'instagram') or v_external_id = '' then
    return jsonb_build_object('success', false, 'code', 'INVALID_RECEIPT_COMPLETION');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_content_item_id::text || ':' || v_platform, 0));
  select * into v_receipt
  from public.content_publication_receipts
  where content_item_id = p_content_item_id and lower(platform) = v_platform
  order by created_at desc, id desc
  limit 1
  for update;

  if found and v_receipt.status in ('published', 'confirmed') then
    return jsonb_build_object('success', true, 'code', 'ALREADY_CONFIRMED', 'externalPostId', v_receipt.external_post_id);
  end if;

  if found then
    update public.content_publication_receipts
    set status = 'published', external_post_id = v_external_id, last_error = null, updated_at = now()
    where id = v_receipt.id;
  else
    insert into public.content_publication_receipts (
      content_item_id, platform, provider, status, external_post_id, last_error, created_at, updated_at
    ) values (
      p_content_item_id, v_platform, coalesce(nullif(btrim(p_provider), ''), 'meta-graph-publishing'), 'published', v_external_id, null, now(), now()
    );
  end if;

  return jsonb_build_object('success', true, 'code', 'PUBLISHED_RECORDED', 'externalPostId', v_external_id);
end;
$function$;

create or replace function public.mark_publication_receipt_ambiguous(
  p_content_item_id uuid,
  p_platform text,
  p_provider text,
  p_error text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_receipt public.content_publication_receipts%rowtype;
  v_platform text := lower(btrim(coalesce(p_platform, '')));
  v_error text := left(coalesce(nullif(btrim(p_error), ''), 'AMBIGUOUS_RESULT'), 500);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_content_item_id::text || ':' || v_platform, 0));
  select * into v_receipt
  from public.content_publication_receipts
  where content_item_id = p_content_item_id and lower(platform) = v_platform
  order by created_at desc, id desc
  limit 1
  for update;

  if found and v_receipt.status in ('published', 'confirmed') then
    return jsonb_build_object('success', true, 'code', 'ALREADY_CONFIRMED', 'externalPostId', v_receipt.external_post_id);
  end if;
  if found then
    update public.content_publication_receipts set status = 'ambiguous', last_error = v_error, updated_at = now() where id = v_receipt.id;
  else
    insert into public.content_publication_receipts (content_item_id, platform, provider, status, last_error, created_at, updated_at)
    values (p_content_item_id, v_platform, coalesce(nullif(btrim(p_provider), ''), 'meta-graph-publishing'), 'ambiguous', v_error, now(), now());
  end if;
  return jsonb_build_object('success', true, 'code', 'AMBIGUOUS_RECORDED');
end;
$function$;

create or replace function public.mark_publication_receipt_failed(
  p_content_item_id uuid,
  p_platform text,
  p_provider text,
  p_error text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_receipt public.content_publication_receipts%rowtype;
  v_platform text := lower(btrim(coalesce(p_platform, '')));
  v_error text := left(coalesce(nullif(btrim(p_error), ''), 'META_API_ERROR'), 500);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_content_item_id::text || ':' || v_platform, 0));
  select * into v_receipt
  from public.content_publication_receipts
  where content_item_id = p_content_item_id and lower(platform) = v_platform
  order by created_at desc, id desc
  limit 1
  for update;

  if found and v_receipt.status in ('published', 'confirmed') then
    return jsonb_build_object('success', true, 'code', 'ALREADY_CONFIRMED', 'externalPostId', v_receipt.external_post_id);
  end if;
  if found then
    update public.content_publication_receipts set status = 'failed', last_error = v_error, updated_at = now() where id = v_receipt.id;
  else
    insert into public.content_publication_receipts (content_item_id, platform, provider, status, last_error, created_at, updated_at)
    values (p_content_item_id, v_platform, coalesce(nullif(btrim(p_provider), ''), 'meta-graph-publishing'), 'failed', v_error, now(), now());
  end if;
  return jsonb_build_object('success', true, 'code', 'FAILURE_RECORDED');
end;
$function$;

revoke all on function public.claim_publication_receipt(uuid, text, text) from public;
revoke all on function public.complete_publication_receipt(uuid, text, text, text) from public;
revoke all on function public.mark_publication_receipt_ambiguous(uuid, text, text, text) from public;
revoke all on function public.mark_publication_receipt_failed(uuid, text, text, text) from public;
grant execute on function public.claim_publication_receipt(uuid, text, text) to service_role;
grant execute on function public.complete_publication_receipt(uuid, text, text, text) to service_role;
grant execute on function public.mark_publication_receipt_ambiguous(uuid, text, text, text) to service_role;
grant execute on function public.mark_publication_receipt_failed(uuid, text, text, text) to service_role;

select pg_notify('pgrst', 'reload schema');
