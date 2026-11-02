-- Align the Meta publishing worker with the existing Production receipt contract.
-- Review/apply separately; this migration is intentionally not executed by this task.
-- It preserves the existing receipt statuses and authorization/job linkage.
-- It does not rewrite authorization_id or publish_job_id values.

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
  v_content_platform text;
  v_platform text := lower(btrim(coalesce(p_platform, '')));
  v_provider text := btrim(coalesce(p_provider, ''));
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if p_content_item_id is null
     or v_platform not in ('facebook', 'instagram', 'tiktok')
     or char_length(v_provider) < 2 then
    raise exception 'INVALID_PUBLICATION_RECEIPT_INPUT' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_content_item_id::text || ':' || v_platform, 0));

  select lower(platform) into v_content_platform
  from public.content_items
  where id = p_content_item_id;

  if v_content_platform is null then
    raise exception 'CONTENT_ITEM_NOT_FOUND' using errcode = '22023';
  end if;
  if v_content_platform <> v_platform then
    raise exception 'CONTENT_PLATFORM_MISMATCH' using errcode = '22023';
  end if;

  insert into public.content_publication_receipts (
    content_item_id, platform, provider
  ) values (
    p_content_item_id, v_platform, v_provider
  )
  on conflict (content_item_id, platform) do nothing;

  select * into v_receipt
  from public.content_publication_receipts
  where content_item_id = p_content_item_id
    and lower(platform) = v_platform
  for update;

  if v_receipt.status = 'published' then
    return jsonb_build_object(
      'status', 'published',
      'externalPostId', v_receipt.external_post_id
    );
  end if;

  if v_receipt.provider <> v_provider then
    raise exception 'PUBLICATION_PROVIDER_MISMATCH' using errcode = '22023';
  end if;

  if v_receipt.status in ('ambiguous', 'container_created') then
    return jsonb_build_object(
      'status', 'ambiguous',
      'externalPostId', v_receipt.external_post_id
    );
  end if;

  if v_receipt.status = 'failed' then
    return jsonb_build_object(
      'status', 'failed',
      'externalPostId', v_receipt.external_post_id
    );
  end if;

  return jsonb_build_object(
    'id', v_receipt.id,
    'contentItemId', v_receipt.content_item_id,
    'platform', v_receipt.platform,
    'provider', v_receipt.provider,
    'status', v_receipt.status,
    'externalContainerId', v_receipt.external_container_id,
    'externalPostId', v_receipt.external_post_id,
    'lastError', v_receipt.last_error,
    'createdAt', v_receipt.created_at,
    'updatedAt', v_receipt.updated_at
  );
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
  v_provider text := btrim(coalesce(p_provider, ''));
  v_external_id text := btrim(coalesce(p_external_post_id, ''));
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if p_content_item_id is null
     or v_platform not in ('facebook', 'instagram', 'tiktok')
     or char_length(v_provider) < 2
     or v_external_id = '' then
    raise exception 'INVALID_RECEIPT_COMPLETION' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_content_item_id::text || ':' || v_platform, 0));

  select * into v_receipt
  from public.content_publication_receipts
  where content_item_id = p_content_item_id
    and lower(platform) = v_platform
  for update;

  if not found then
    raise exception 'PUBLICATION_RECEIPT_NOT_FOUND' using errcode = '22023';
  end if;
  if v_receipt.provider <> v_provider then
    raise exception 'PUBLICATION_PROVIDER_MISMATCH' using errcode = '22023';
  end if;
  if v_receipt.status = 'published' then
    if v_receipt.external_post_id is distinct from v_external_id then
      raise exception 'PUBLICATION_POST_MISMATCH' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'success', true,
      'code', 'ALREADY_CONFIRMED',
      'externalPostId', v_receipt.external_post_id
    );
  end if;
  if v_receipt.status in ('failed', 'ambiguous') then
    return jsonb_build_object(
      'success', false,
      'code', 'RECEIPT_NOT_WRITABLE',
      'status', v_receipt.status
    );
  end if;

  update public.content_publication_receipts
  set status = 'published',
      external_post_id = coalesce(external_post_id, v_external_id),
      last_error = null,
      updated_at = now()
  where id = v_receipt.id
  returning * into v_receipt;

  if v_receipt.external_post_id <> v_external_id then
    raise exception 'PUBLICATION_POST_MISMATCH' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'success', true,
    'code', 'PUBLISHED_RECORDED',
    'externalPostId', v_receipt.external_post_id
  );
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
  v_provider text := btrim(coalesce(p_provider, ''));
  v_error text := left(coalesce(nullif(btrim(p_error), ''), 'AMBIGUOUS_RESULT'), 1000);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if p_content_item_id is null
     or v_platform not in ('facebook', 'instagram', 'tiktok')
     or char_length(v_provider) < 2 then
    raise exception 'INVALID_PUBLICATION_RECEIPT_INPUT' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_content_item_id::text || ':' || v_platform, 0));

  update public.content_publication_receipts
  set status = case when status = 'published' then status else 'ambiguous' end,
      last_error = case when status = 'published' then last_error else v_error end,
      updated_at = now()
  where content_item_id = p_content_item_id
    and lower(platform) = v_platform
    and provider = v_provider
  returning * into v_receipt;

  if not found then
    raise exception 'PUBLICATION_RECEIPT_NOT_FOUND' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'success', true,
    'status', v_receipt.status,
    'externalPostId', v_receipt.external_post_id,
    'lastError', v_receipt.last_error
  );
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
  v_provider text := btrim(coalesce(p_provider, ''));
  v_error text := left(coalesce(nullif(btrim(p_error), ''), 'META_API_ERROR'), 500);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if p_content_item_id is null
     or v_platform not in ('facebook', 'instagram', 'tiktok')
     or char_length(v_provider) < 2 then
    raise exception 'INVALID_PUBLICATION_RECEIPT_INPUT' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_content_item_id::text || ':' || v_platform, 0));

  update public.content_publication_receipts
  set status = case when status in ('published', 'ambiguous') then status else 'failed' end,
      last_error = case when status in ('published', 'ambiguous') then last_error else v_error end,
      updated_at = now()
  where content_item_id = p_content_item_id
    and lower(platform) = v_platform
    and provider = v_provider
  returning * into v_receipt;

  if not found then
    raise exception 'PUBLICATION_RECEIPT_NOT_FOUND' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'success', true,
    'status', v_receipt.status,
    'externalPostId', v_receipt.external_post_id
  );
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
