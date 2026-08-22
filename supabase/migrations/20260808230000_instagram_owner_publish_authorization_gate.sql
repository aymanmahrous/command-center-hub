-- Instagram owner-approval gate — parity with existing Facebook RPCs.
-- Does NOT modify any Facebook function. New Instagram-only entry points only.
-- Approved Instagram Business Account ID: 17841439747493221

create or replace function public.create_owner_instagram_publish_authorization(
  p_content_item_id uuid,
  p_platform text,
  p_account_id text,
  p_authorized_by text,
  p_approval_reference text,
  p_ttl_minutes integer default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_content public.content_items%rowtype;
  v_job public.background_jobs%rowtype;
  v_auth public.owner_publish_authorizations%rowtype;
  v_now timestamptz := now();
  v_ttl integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_content_item_id::text, 0));

  if p_platform <> 'instagram' then
    raise exception 'PLATFORM_NOT_SUPPORTED_IN_THIS_VERSION' using errcode = '22023';
  end if;
  if p_account_id <> '17841439747493221' then
    raise exception 'ACCOUNT_ID_NOT_SUPPORTED_IN_THIS_VERSION' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_authorized_by, '')), '') is null then
    raise exception 'INVALID_AUTHORIZED_BY' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_approval_reference, '')), '') is null then
    raise exception 'INVALID_APPROVAL_REFERENCE' using errcode = '22023';
  end if;
  if p_approval_reference ~* 'token|secret|password|bearer|api[_-]?key' then
    raise exception 'INVALID_APPROVAL_REFERENCE' using errcode = '22023';
  end if;

  v_ttl := coalesce(p_ttl_minutes, 15);
  if v_ttl < 1 or v_ttl > 60 then
    raise exception 'INVALID_TTL_MINUTES' using errcode = '22023';
  end if;

  select *
  into v_job
  from public.background_jobs
  where job_type = 'publish_content'
    and payload->>'contentItemId' = p_content_item_id::text
    and status in ('queued', 'retrying')
  order by created_at desc, id desc
  for update
  limit 1;

  if not found then
    raise exception 'AUTHORIZED_JOB_NOT_FOUND' using errcode = '22023';
  end if;

  select *
  into v_content
  from public.content_items
  where id = p_content_item_id
  for update;

  if not found then
    raise exception 'CONTENT_ITEM_NOT_FOUND' using errcode = '22023';
  end if;
  if v_content.platform <> 'instagram' then
    raise exception 'CONTENT_PLATFORM_MISMATCH' using errcode = '22023';
  end if;
  if v_content.status <> 'scheduled' then
    raise exception 'CONTENT_NOT_SCHEDULED' using errcode = '22023';
  end if;
  if v_content.published_at is not null then
    raise exception 'CONTENT_ALREADY_PUBLISHED' using errcode = '22023';
  end if;
  if v_content.scheduled_for is null then
    raise exception 'CONTENT_SCHEDULE_TIME_MISSING' using errcode = '22023';
  end if;
  if coalesce(v_job.next_retry_at, v_job.created_at) <> v_content.scheduled_for then
    raise exception 'JOB_SCHEDULE_MISMATCH' using errcode = '22023';
  end if;

  perform 1
  from public.owner_publish_authorizations
  where content_item_id = p_content_item_id
    and platform = 'instagram'
    and consumed_at is null
    and revoked_at is null
  for update;

  if found then
    raise exception 'ACTIVE_AUTHORIZATION_EXISTS' using errcode = '22023';
  end if;

  insert into public.owner_publish_authorizations (
    content_item_id,
    platform,
    page_id,
    publish_job_id,
    authorized_by,
    approval_reference,
    authorized_at,
    expires_at
  ) values (
    p_content_item_id,
    'instagram',
    '17841439747493221',
    v_job.id,
    btrim(p_authorized_by),
    btrim(p_approval_reference),
    v_now,
    v_now + make_interval(mins => v_ttl)
  )
  returning * into v_auth;

  insert into public.audit_logs (actor_id, actor_type, action, entity_type, entity_id, detail)
  values (
    null,
    'system',
    'owner_instagram_publish_authorization_created',
    'content_item',
    p_content_item_id,
    jsonb_build_object(
      'authorizationId', v_auth.id,
      'publishJobId', v_job.id,
      'platform', 'instagram',
      'accountId', '17841439747493221',
      'expiresAt', v_auth.expires_at,
      'approvalReference', p_approval_reference
    )
  );

  return jsonb_build_object(
    'authorizationId', v_auth.id,
    'contentItemId', v_auth.content_item_id,
    'publishJobId', v_auth.publish_job_id,
    'authorizedAt', v_auth.authorized_at,
    'expiresAt', v_auth.expires_at
  );
end;
$function$;

create or replace function public.authorize_and_enqueue_instagram_publish(
  p_content_item_id uuid,
  p_platform text,
  p_account_id text,
  p_authorized_by text,
  p_approval_reference text,
  p_ttl_minutes integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_content public.content_items%rowtype;
  v_job public.background_jobs%rowtype;
  v_auth public.owner_publish_authorizations%rowtype;
  v_now timestamptz := now();
  v_ttl integer := coalesce(p_ttl_minutes, 30);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_content_item_id::text, 0));

  if p_platform <> 'instagram' then
    raise exception 'PLATFORM_NOT_SUPPORTED_IN_THIS_VERSION' using errcode = '22023';
  end if;
  if p_account_id <> '17841439747493221' then
    raise exception 'ACCOUNT_ID_NOT_SUPPORTED_IN_THIS_VERSION' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_authorized_by, '')), '') is null then
    raise exception 'INVALID_AUTHORIZED_BY' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_approval_reference, '')), '') is null then
    raise exception 'INVALID_APPROVAL_REFERENCE' using errcode = '22023';
  end if;
  if p_approval_reference ~* 'token|secret|password|bearer|api[_-]?key' then
    raise exception 'INVALID_APPROVAL_REFERENCE' using errcode = '22023';
  end if;
  if v_ttl < 1 or v_ttl > 30 then
    raise exception 'INVALID_TTL_MINUTES' using errcode = '22023';
  end if;

  select *
  into v_content
  from public.content_items
  where id = p_content_item_id
  for update;

  if not found then
    raise exception 'CONTENT_ITEM_NOT_FOUND' using errcode = '22023';
  end if;
  if v_content.platform <> 'instagram' then
    raise exception 'CONTENT_PLATFORM_MISMATCH' using errcode = '22023';
  end if;
  if v_content.status <> 'approved' then
    raise exception 'CONTENT_NOT_APPROVED' using errcode = '22023';
  end if;
  if v_content.published_at is not null or v_content.provider_external_id is not null then
    raise exception 'CONTENT_ALREADY_PUBLISHED' using errcode = '22023';
  end if;

  perform 1
  from public.owner_publish_authorizations
  where content_item_id = p_content_item_id
    and platform = 'instagram'
    and consumed_at is null
    and revoked_at is null
    and expires_at > v_now
  for update;

  if found then
    raise exception 'ACTIVE_AUTHORIZATION_EXISTS' using errcode = '22023';
  end if;

  perform 1
  from public.background_jobs
  where job_type = 'publish_content'
    and payload->>'contentItemId' = p_content_item_id::text
    and status in ('queued', 'retrying', 'processing')
  for update;

  if found then
    raise exception 'ACTIVE_PUBLISH_JOB_EXISTS' using errcode = '22023';
  end if;

  update public.content_items
  set status = 'scheduled',
      scheduled_for = v_now,
      updated_at = v_now
  where id = p_content_item_id
  returning * into v_content;

  insert into public.background_jobs (
    job_type, status, payload, next_retry_at, created_at, updated_at
  ) values (
    'publish_content',
    'queued',
    jsonb_build_object(
      'contentItemId', p_content_item_id,
      'platform', 'instagram',
      'accountId', '17841439747493221',
      'source', 'manual_owner_approved'
    ),
    v_now,
    v_now,
    v_now
  )
  returning * into v_job;

  insert into public.owner_publish_authorizations (
    content_item_id,
    platform,
    page_id,
    publish_job_id,
    scope,
    authorized_by,
    approval_reference,
    authorized_at,
    expires_at
  ) values (
    p_content_item_id,
    'instagram',
    '17841439747493221',
    v_job.id,
    'single_publish',
    btrim(p_authorized_by),
    btrim(p_approval_reference),
    v_now,
    v_now + make_interval(mins => v_ttl)
  )
  returning * into v_auth;

  insert into public.audit_logs (actor_id, actor_type, action, entity_type, entity_id, detail)
  values (
    null,
    'manager',
    'owner_instagram_publish_authorization_and_job_created_atomic',
    'content_item',
    p_content_item_id,
    jsonb_build_object(
      'authorizationId', v_auth.id,
      'publishJobId', v_job.id,
      'platform', 'instagram',
      'accountId', '17841439747493221',
      'expiresAt', v_auth.expires_at,
      'approvalReference', btrim(p_approval_reference)
    )
  );

  return jsonb_build_object(
    'success', true,
    'authorizationId', v_auth.id,
    'jobId', v_job.id,
    'contentItemId', p_content_item_id,
    'jobStatus', v_job.status,
    'authorizedAt', v_auth.authorized_at,
    'expiresAt', v_auth.expires_at
  );
end;
$function$;

create or replace function public.claim_authorized_instagram_publish_job(
  p_content_item_id uuid,
  p_platform text,
  p_account_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_auth public.owner_publish_authorizations%rowtype;
  v_content public.content_items%rowtype;
  v_job public.background_jobs%rowtype;
  v_media jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_content_item_id::text, 0));

  if p_platform <> 'instagram' or p_account_id <> '17841439747493221' then
    return jsonb_build_object('claimed', false, 'code', 'PLATFORM_NOT_SUPPORTED_IN_THIS_VERSION');
  end if;

  select *
  into v_auth
  from public.owner_publish_authorizations
  where content_item_id = p_content_item_id
    and platform = 'instagram'
    and consumed_at is null
    and revoked_at is null
  for update;

  if not found then
    return jsonb_build_object('claimed', false, 'code', 'NO_AUTHORIZATION');
  end if;

  if v_auth.page_id <> p_account_id then
    return jsonb_build_object('claimed', false, 'code', 'ACCOUNT_ID_MISMATCH');
  end if;

  if v_auth.expires_at <= now() then
    update public.owner_publish_authorizations
    set revoked_at = now(),
        revoked_reason = 'AUTHORIZATION_EXPIRED'
    where id = v_auth.id;

    update public.background_jobs
    set status = 'dead',
        next_retry_at = null,
        last_error = 'AUTHORIZATION_EXPIRED',
        updated_at = now()
    where id = v_auth.publish_job_id
      and status in ('queued', 'retrying');

    insert into public.audit_logs (actor_id, actor_type, action, entity_type, entity_id, detail)
    values (
      null,
      'system',
      'owner_instagram_publish_authorization_expired',
      'content_item',
      p_content_item_id,
      jsonb_build_object('authorizationId', v_auth.id, 'publishJobId', v_auth.publish_job_id)
    );

    return jsonb_build_object('claimed', false, 'code', 'AUTHORIZATION_EXPIRED');
  end if;

  select *
  into v_job
  from public.background_jobs
  where id = v_auth.publish_job_id
    and job_type = 'publish_content'
  for update;

  if not found then
    return jsonb_build_object('claimed', false, 'code', 'AUTHORIZED_JOB_NOT_FOUND');
  end if;

  if v_job.payload->>'contentItemId' <> p_content_item_id::text then
    return jsonb_build_object('claimed', false, 'code', 'JOB_CONTENT_MISMATCH');
  end if;

  select *
  into v_content
  from public.content_items
  where id = p_content_item_id
  for update;

  if not found then
    return jsonb_build_object('claimed', false, 'code', 'CONTENT_NOT_FOUND');
  end if;

  if v_content.platform <> 'instagram' then
    return jsonb_build_object('claimed', false, 'code', 'CONTENT_PLATFORM_MISMATCH');
  end if;

  if v_content.status = 'published' then
    if v_content.provider_external_id is null or v_content.published_at is null then
      return jsonb_build_object('claimed', false, 'code', 'INCONSISTENT_PUBLISHED_STATE');
    end if;

    if v_job.status = 'completed' then
      if v_job.result->>'contentItemId' is distinct from v_content.id::text
         or v_job.result->>'providerExternalId' is distinct from v_content.provider_external_id
         or (v_job.result->>'publishedAt')::timestamptz is distinct from v_content.published_at then
        return jsonb_build_object('claimed', false, 'code', 'JOB_RESULT_MISMATCH');
      end if;

      update public.owner_publish_authorizations
      set consumed_at = coalesce(consumed_at, now())
      where id = v_auth.id;

      return jsonb_build_object('claimed', false, 'code', 'ALREADY_PUBLISHED');
    elsif v_job.status in ('queued', 'retrying') then
      update public.background_jobs
      set status = 'completed',
          next_retry_at = null,
          last_error = null,
          result = jsonb_build_object(
            'contentItemId', v_content.id,
            'providerExternalId', v_content.provider_external_id,
            'publishedAt', v_content.published_at,
            'resolution', 'ALREADY_PUBLISHED_BEFORE_CLAIM'
          ),
          updated_at = now()
      where id = v_job.id
        and status in ('queued', 'retrying')
      returning * into v_job;

      if found then
        update public.owner_publish_authorizations
        set consumed_at = now()
        where id = v_auth.id;

        insert into public.audit_logs (actor_id, actor_type, action, entity_type, entity_id, detail)
        values (
          null,
          'system',
          'authorized_instagram_publish_already_published',
          'content_item',
          p_content_item_id,
          jsonb_build_object('authorizationId', v_auth.id, 'publishJobId', v_auth.publish_job_id)
        );

        return jsonb_build_object('claimed', false, 'code', 'ALREADY_PUBLISHED');
      end if;
    end if;

    return jsonb_build_object('claimed', false, 'code', 'JOB_STATE_CHANGED', 'status', v_job.status::text);
  end if;

  if v_content.status <> 'scheduled' or v_content.scheduled_for is null then
    return jsonb_build_object('claimed', false, 'code', 'CONTENT_NOT_SCHEDULED');
  end if;

  if v_content.scheduled_for > now() then
    return jsonb_build_object('claimed', false, 'code', 'NOT_DUE');
  end if;

  if v_job.status = 'processing' then
    return jsonb_build_object('claimed', false, 'code', 'ALREADY_IN_PROGRESS');
  end if;

  if v_job.status not in ('queued', 'retrying') then
    return jsonb_build_object('claimed', false, 'code', 'JOB_NOT_CLAIMABLE', 'status', v_job.status::text);
  end if;

  if coalesce(v_job.next_retry_at, v_job.created_at) > now() then
    return jsonb_build_object('claimed', false, 'code', 'JOB_NOT_DUE');
  end if;

  update public.background_jobs
  set status = 'processing',
      attempt_count = attempt_count + 1,
      last_error = null,
      updated_at = now()
  where id = v_job.id
  returning * into v_job;

  update public.owner_publish_authorizations
  set consumed_at = now()
  where id = v_auth.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'assetType', m.asset_type,
        'storagePath', m.storage_path,
        'provider', m.provider
      )
      order by m.created_at, m.id
    ),
    '[]'::jsonb
  )
  into v_media
  from public.media_assets m
  where m.content_item_id = v_content.id;

  insert into public.audit_logs (actor_id, actor_type, action, entity_type, entity_id, detail)
  values (
    null,
    'system',
    'authorized_instagram_publish_claimed',
    'content_item',
    v_content.id,
    jsonb_build_object(
      'jobId', v_job.id,
      'authorizationId', v_auth.id,
      'platform', 'instagram'
    )
  );

  return jsonb_build_object(
    'claimed', true,
    'jobId', v_job.id,
    'authorizationId', v_auth.id,
    'attemptCount', v_job.attempt_count,
    'content', jsonb_build_object(
      'contentItemId', v_content.id,
      'platform', v_content.platform,
      'contentType', v_content.content_type,
      'caption', coalesce(v_content.caption, ''),
      'hashtags', to_jsonb(v_content.hashtags),
      'scheduledFor', v_content.scheduled_for,
      'media', v_media
    )
  );
end;
$function$;

create or replace function public.reserve_authorized_instagram_publication_receipt(
  p_authorization_id uuid,
  p_job_id uuid,
  p_content_item_id uuid,
  p_platform text,
  p_account_id text,
  p_provider text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_auth public.owner_publish_authorizations%rowtype;
  v_job public.background_jobs%rowtype;
  v_content public.content_items%rowtype;
  v_receipt public.content_publication_receipts%rowtype;
  v_provider text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_content_item_id::text, 0));

  if p_platform <> 'instagram' or p_account_id <> '17841439747493221' then
    return jsonb_build_object('success', false, 'code', 'PLATFORM_NOT_SUPPORTED_IN_THIS_VERSION');
  end if;

  v_provider := nullif(btrim(coalesce(p_provider, '')), '');
  if v_provider is null then
    return jsonb_build_object('success', false, 'code', 'INVALID_PROVIDER');
  end if;

  select *
  into v_auth
  from public.owner_publish_authorizations
  where id = p_authorization_id
  for update;

  if not found
     or v_auth.content_item_id <> p_content_item_id
     or v_auth.platform <> p_platform
     or v_auth.page_id <> p_account_id
     or v_auth.publish_job_id <> p_job_id then
    return jsonb_build_object('success', false, 'code', 'AUTHORIZATION_MISMATCH');
  end if;

  if v_auth.consumed_at is null then
    return jsonb_build_object('success', false, 'code', 'AUTHORIZATION_NOT_CONSUMED');
  end if;

  select *
  into v_job
  from public.background_jobs
  where id = p_job_id
    and job_type = 'publish_content'
  for update;

  if not found or v_job.payload->>'contentItemId' <> p_content_item_id::text then
    return jsonb_build_object('success', false, 'code', 'JOB_CONTENT_MISMATCH');
  end if;

  if v_job.status <> 'processing' then
    return jsonb_build_object('success', false, 'code', 'INVALID_JOB_STATE', 'status', v_job.status::text);
  end if;

  select *
  into v_content
  from public.content_items
  where id = p_content_item_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'code', 'CONTENT_NOT_FOUND');
  end if;

  if v_content.platform <> 'instagram' then
    return jsonb_build_object('success', false, 'code', 'CONTENT_PLATFORM_MISMATCH');
  end if;

  if v_content.status <> 'scheduled' then
    return jsonb_build_object('success', false, 'code', 'CONTENT_NOT_SCHEDULED', 'status', v_content.status::text);
  end if;

  if v_content.provider_external_id is not null or v_content.published_at is not null then
    return jsonb_build_object('success', false, 'code', 'CONTENT_ALREADY_HAS_PUBLICATION_EVIDENCE');
  end if;

  select *
  into v_receipt
  from public.content_publication_receipts
  where content_item_id = p_content_item_id
    and platform = 'instagram'
  for update;

  if v_receipt.id is null then
    insert into public.content_publication_receipts (
      content_item_id, platform, provider, status, authorization_id, publish_job_id
    ) values (
      p_content_item_id, 'instagram', v_provider, 'reserved', p_authorization_id, p_job_id
    )
    returning * into v_receipt;

    insert into public.audit_logs (actor_id, actor_type, action, entity_type, entity_id, detail)
    values (
      null,
      'system',
      'instagram_publication_receipt_reserved',
      'content_item',
      p_content_item_id,
      jsonb_build_object(
        'receiptId', v_receipt.id,
        'jobId', p_job_id,
        'authorizationId', p_authorization_id,
        'mode', 'created'
      )
    );

    return jsonb_build_object(
      'success', true,
      'code', 'RESERVED',
      'id', v_receipt.id,
      'receiptId', v_receipt.id,
      'status', v_receipt.status
    );
  end if;

  if v_receipt.status in ('reserved', 'container_created') then
    if v_receipt.authorization_id = p_authorization_id and v_receipt.publish_job_id = p_job_id then
      return jsonb_build_object(
        'success', true,
        'code', 'ALREADY_RESERVED',
        'id', v_receipt.id,
        'receiptId', v_receipt.id,
        'status', v_receipt.status
      );
    end if;

    return jsonb_build_object('success', false, 'code', 'RECEIPT_BELONGS_TO_DIFFERENT_ATTEMPT');
  end if;

  if v_receipt.status = 'published' then
    return jsonb_build_object('success', false, 'code', 'ALREADY_PUBLISHED');
  end if;

  if v_receipt.status = 'ambiguous' then
    return jsonb_build_object('success', false, 'code', 'AMBIGUOUS_RECEIPT_REQUIRES_MANUAL_RESOLUTION');
  end if;

  if v_receipt.last_error is null
     or v_receipt.last_error not like 'MANUAL_CONFIRMED_NOT_PUBLISHED:%'
     or (v_receipt.authorization_id = p_authorization_id and v_receipt.publish_job_id = p_job_id) then
    return jsonb_build_object('success', false, 'code', 'RECEIPT_FAILED_NOT_ELIGIBLE_FOR_RESET');
  end if;

  update public.content_publication_receipts
  set status = 'reserved',
      provider = v_provider,
      authorization_id = p_authorization_id,
      publish_job_id = p_job_id,
      external_container_id = null,
      external_post_id = null,
      last_error = null,
      updated_at = now()
  where id = v_receipt.id
  returning * into v_receipt;

  insert into public.audit_logs (actor_id, actor_type, action, entity_type, entity_id, detail)
  values (
    null,
    'system',
    'instagram_publication_receipt_reserved',
    'content_item',
    p_content_item_id,
    jsonb_build_object(
      'receiptId', v_receipt.id,
      'jobId', p_job_id,
      'authorizationId', p_authorization_id,
      'mode', 'reset_from_failed'
    )
  );

  return jsonb_build_object(
    'success', true,
    'code', 'RESERVED_AFTER_RESET',
    'id', v_receipt.id,
    'receiptId', v_receipt.id,
    'status', v_receipt.status
  );
end;
$function$;

create or replace function public.mark_authorized_instagram_publication_published(
  p_authorization_id uuid,
  p_job_id uuid,
  p_content_item_id uuid,
  p_platform text,
  p_account_id text,
  p_external_post_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_auth public.owner_publish_authorizations%rowtype;
  v_job public.background_jobs%rowtype;
  v_content public.content_items%rowtype;
  v_receipt public.content_publication_receipts%rowtype;
  v_post_id text;
  v_published_at timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_content_item_id::text, 0));

  if p_platform <> 'instagram' or p_account_id <> '17841439747493221' then
    return jsonb_build_object('success', false, 'code', 'PLATFORM_NOT_SUPPORTED_IN_THIS_VERSION');
  end if;

  v_post_id := nullif(btrim(coalesce(p_external_post_id, '')), '');
  if v_post_id is null then
    return jsonb_build_object('success', false, 'code', 'INVALID_POST_ID');
  end if;

  select *
  into v_auth
  from public.owner_publish_authorizations
  where id = p_authorization_id
  for update;

  if not found
     or v_auth.content_item_id <> p_content_item_id
     or v_auth.platform <> p_platform
     or v_auth.page_id <> p_account_id
     or v_auth.publish_job_id <> p_job_id
     or v_auth.consumed_at is null
     or v_auth.revoked_at is not null then
    return jsonb_build_object('success', false, 'code', 'AUTHORIZATION_MISMATCH');
  end if;

  select *
  into v_job
  from public.background_jobs
  where id = p_job_id
    and job_type = 'publish_content'
  for update;

  if not found
     or v_job.payload->>'contentItemId' <> p_content_item_id::text
     or v_job.status <> 'processing' then
    return jsonb_build_object('success', false, 'code', 'INVALID_JOB_STATE');
  end if;

  select *
  into v_content
  from public.content_items
  where id = p_content_item_id
  for update;

  if not found or v_content.platform <> 'instagram' then
    return jsonb_build_object('success', false, 'code', 'CONTENT_MISMATCH');
  end if;

  if v_content.status <> 'scheduled'
     or v_content.provider_external_id is not null
     or v_content.published_at is not null then
    return jsonb_build_object('success', false, 'code', 'INVALID_CONTENT_STATE');
  end if;

  select *
  into v_receipt
  from public.content_publication_receipts
  where content_item_id = p_content_item_id
    and platform = 'instagram'
  for update;

  if v_receipt.id is null
     or v_receipt.authorization_id <> p_authorization_id
     or v_receipt.publish_job_id <> p_job_id then
    return jsonb_build_object('success', false, 'code', 'RECEIPT_BELONGS_TO_DIFFERENT_ATTEMPT');
  end if;

  if v_receipt.status not in ('reserved', 'container_created') then
    return jsonb_build_object('success', false, 'code', 'RECEIPT_STATE_NOT_ELIGIBLE', 'status', v_receipt.status);
  end if;

  v_published_at := now();

  update public.content_publication_receipts
  set status = 'published',
      external_post_id = v_post_id,
      last_error = null,
      updated_at = v_published_at
  where id = v_receipt.id;

  update public.background_jobs
  set status = 'completed',
      next_retry_at = null,
      last_error = null,
      result = jsonb_build_object(
        'contentItemId', p_content_item_id,
        'providerExternalId', v_post_id,
        'publishedAt', v_published_at,
        'authorizationId', p_authorization_id,
        'receiptId', v_receipt.id
      ),
      updated_at = v_published_at
  where id = p_job_id;

  update public.content_items
  set status = 'published',
      provider_external_id = v_post_id,
      published_at = v_published_at,
      updated_at = v_published_at
  where id = p_content_item_id;

  update public.owner_publish_authorizations
  set consumed_at = coalesce(consumed_at, v_published_at)
  where id = p_authorization_id;

  insert into public.audit_logs (actor_id, actor_type, action, entity_type, entity_id, detail)
  values (
    null,
    'system',
    'authorized_instagram_publication_published_atomic',
    'content_item',
    p_content_item_id,
    jsonb_build_object(
      'receiptId', v_receipt.id,
      'jobId', p_job_id,
      'authorizationId', p_authorization_id,
      'externalPostId', v_post_id,
      'publishedAt', v_published_at
    )
  );

  return jsonb_build_object(
    'success', true,
    'code', 'PUBLISHED_ATOMIC',
    'receiptId', v_receipt.id,
    'external_post_id', v_post_id,
    'job_status', 'completed',
    'content_status', 'published',
    'published_at', v_published_at
  );
end;
$function$;

create or replace function public.fail_authorized_instagram_publish_job(
  p_job_id uuid,
  p_authorization_id uuid,
  p_content_item_id uuid,
  p_platform text,
  p_account_id text,
  p_outcome text,
  p_error text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_auth public.owner_publish_authorizations%rowtype;
  v_job public.background_jobs%rowtype;
  v_receipt public.content_publication_receipts%rowtype;
  v_receipt_status text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_content_item_id::text, 0));

  if p_platform <> 'instagram' or p_account_id <> '17841439747493221' then
    return jsonb_build_object('success', false, 'code', 'PLATFORM_NOT_SUPPORTED_IN_THIS_VERSION');
  end if;

  if p_outcome not in ('validation_failed', 'meta_auth_failed', 'ambiguous_result') then
    return jsonb_build_object('success', false, 'code', 'INVALID_OUTCOME');
  end if;

  v_receipt_status := case when p_outcome = 'ambiguous_result' then 'ambiguous' else 'failed' end;

  select *
  into v_auth
  from public.owner_publish_authorizations
  where id = p_authorization_id
  for update;

  if not found
     or v_auth.content_item_id <> p_content_item_id
     or v_auth.platform <> p_platform
     or v_auth.page_id <> p_account_id
     or v_auth.publish_job_id <> p_job_id then
    return jsonb_build_object('success', false, 'code', 'AUTHORIZATION_MISMATCH');
  end if;

  if v_auth.consumed_at is null then
    return jsonb_build_object('success', false, 'code', 'AUTHORIZATION_NOT_CONSUMED');
  end if;

  select *
  into v_job
  from public.background_jobs
  where id = p_job_id
    and job_type = 'publish_content'
  for update;

  if not found or v_job.payload->>'contentItemId' <> p_content_item_id::text then
    return jsonb_build_object('success', false, 'code', 'JOB_CONTENT_MISMATCH');
  end if;

  if v_job.status <> 'processing' then
    return jsonb_build_object('success', false, 'code', 'INVALID_JOB_STATE', 'status', v_job.status::text);
  end if;

  select *
  into v_receipt
  from public.content_publication_receipts
  where content_item_id = p_content_item_id
    and platform = 'instagram'
  for update;

  if v_receipt.id is not null
     and (v_receipt.authorization_id is distinct from p_authorization_id
          or v_receipt.publish_job_id is distinct from p_job_id) then
    return jsonb_build_object('success', false, 'code', 'RECEIPT_BELONGS_TO_DIFFERENT_ATTEMPT');
  end if;

  update public.background_jobs
  set status = 'dead',
      next_retry_at = null,
      last_error = left(p_outcome || ': ' || coalesce(p_error, 'PUBLISH_FAILED'), 1000),
      updated_at = now()
  where id = v_job.id;

  if v_receipt.id is not null and v_receipt.status in ('reserved', 'container_created') then
    update public.content_publication_receipts
    set status = v_receipt_status,
        updated_at = now(),
        last_error = left(p_outcome || ': ' || coalesce(p_error, 'PUBLISH_FAILED'), 1000)
    where id = v_receipt.id;
  end if;

  insert into public.audit_logs (actor_id, actor_type, action, entity_type, entity_id, detail)
  values (
    null,
    'system',
    'authorized_instagram_publish_failed',
    'content_item',
    p_content_item_id,
    jsonb_build_object(
      'jobId', v_job.id,
      'authorizationId', v_auth.id,
      'outcome', p_outcome,
      'error', p_error
    )
  );

  return jsonb_build_object('success', true, 'jobId', v_job.id, 'status', 'dead', 'outcome', p_outcome);
end;
$function$;

create or replace function public.reject_authorized_instagram_publish_job(
  p_job_id uuid,
  p_authorization_id uuid,
  p_content_item_id uuid,
  p_platform text,
  p_account_id text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_auth public.owner_publish_authorizations%rowtype;
  v_job public.background_jobs%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_content_item_id::text, 0));

  if p_platform <> 'instagram' or p_account_id <> '17841439747493221' then
    return jsonb_build_object('success', false, 'code', 'PLATFORM_NOT_SUPPORTED_IN_THIS_VERSION');
  end if;

  select *
  into v_auth
  from public.owner_publish_authorizations
  where id = p_authorization_id
  for update;

  if not found
     or v_auth.content_item_id <> p_content_item_id
     or v_auth.platform <> p_platform
     or v_auth.page_id <> p_account_id
     or v_auth.publish_job_id <> p_job_id then
    return jsonb_build_object('success', false, 'code', 'AUTHORIZATION_MISMATCH');
  end if;

  if v_auth.consumed_at is null then
    return jsonb_build_object('success', false, 'code', 'AUTHORIZATION_NOT_CONSUMED');
  end if;

  select *
  into v_job
  from public.background_jobs
  where id = p_job_id
    and job_type = 'publish_content'
  for update;

  if not found or v_job.payload->>'contentItemId' <> p_content_item_id::text then
    return jsonb_build_object('success', false, 'code', 'JOB_CONTENT_MISMATCH');
  end if;

  if v_job.status <> 'processing' then
    return jsonb_build_object('success', false, 'code', 'INVALID_JOB_STATE', 'status', v_job.status::text);
  end if;

  update public.background_jobs
  set status = 'dead',
      next_retry_at = null,
      last_error = left('OWNER_REJECTED: ' || coalesce(p_reason, ''), 1000),
      updated_at = now()
  where id = v_job.id;

  insert into public.audit_logs (actor_id, actor_type, action, entity_type, entity_id, detail)
  values (
    null,
    'system',
    'authorized_instagram_publish_rejected',
    'content_item',
    p_content_item_id,
    jsonb_build_object('jobId', v_job.id, 'authorizationId', v_auth.id, 'reason', p_reason)
  );

  return jsonb_build_object('success', true, 'jobId', v_job.id, 'status', 'dead');
end;
$function$;

revoke all on function public.create_owner_instagram_publish_authorization(uuid, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.authorize_and_enqueue_instagram_publish(uuid, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.claim_authorized_instagram_publish_job(uuid, text, text) from public, anon, authenticated;
revoke all on function public.reserve_authorized_instagram_publication_receipt(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.mark_authorized_instagram_publication_published(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.fail_authorized_instagram_publish_job(uuid, uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.reject_authorized_instagram_publish_job(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;

grant execute on function public.create_owner_instagram_publish_authorization(uuid, text, text, text, text, integer) to service_role;
grant execute on function public.authorize_and_enqueue_instagram_publish(uuid, text, text, text, text, integer) to service_role;
grant execute on function public.claim_authorized_instagram_publish_job(uuid, text, text) to service_role;
grant execute on function public.reserve_authorized_instagram_publication_receipt(uuid, uuid, uuid, text, text, text) to service_role;
grant execute on function public.mark_authorized_instagram_publication_published(uuid, uuid, uuid, text, text, text) to service_role;
grant execute on function public.fail_authorized_instagram_publish_job(uuid, uuid, uuid, text, text, text, text) to service_role;
grant execute on function public.reject_authorized_instagram_publish_job(uuid, uuid, uuid, text, text, text) to service_role;
