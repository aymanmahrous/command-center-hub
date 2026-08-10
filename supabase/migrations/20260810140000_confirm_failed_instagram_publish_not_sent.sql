-- Owner-approved minimal Instagram receipt recovery RPC.
-- Marks a failed/ambiguous Instagram receipt as MANUAL_CONFIRMED_NOT_PUBLISHED
-- so existing reserve_authorized_instagram_publication_receipt can reset it.
-- Does not publish, authorize, enqueue, or alter reserve eligibility rules.

CREATE OR REPLACE FUNCTION public.confirm_failed_instagram_publish_not_sent(
  p_authorization_id uuid,
  p_job_id uuid,
  p_content_item_id uuid,
  p_evidence_reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_auth public.owner_publish_authorizations%rowtype;
  v_job public.background_jobs%rowtype;
  v_content public.content_items%rowtype;
  v_receipt public.content_publication_receipts%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_content_item_id::text, 0));

  if nullif(btrim(coalesce(p_evidence_reference, '')), '') is null
     or p_evidence_reference ~* 'token|secret|password|bearer|api[_-]?key' then
    raise exception 'INVALID_EVIDENCE_REFERENCE' using errcode = '22023';
  end if;

  select *
  into v_auth
  from public.owner_publish_authorizations
  where id = p_authorization_id
  for update;

  if not found
     or v_auth.content_item_id <> p_content_item_id
     or v_auth.publish_job_id <> p_job_id
     or v_auth.platform <> 'instagram'
     or v_auth.page_id <> '17841439747493221' then
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

  if v_job.status <> 'dead' then
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

  if v_content.status = 'published'
     or v_content.provider_external_id is not null
     or v_content.published_at is not null then
    return jsonb_build_object('success', false, 'code', 'CONTENT_ALREADY_HAS_PUBLICATION_EVIDENCE');
  end if;

  select *
  into v_receipt
  from public.content_publication_receipts
  where content_item_id = p_content_item_id
    and platform = 'instagram'
  for update;

  if v_receipt.id is null then
    return jsonb_build_object('success', false, 'code', 'RECEIPT_NOT_FOUND');
  end if;

  if v_receipt.authorization_id is distinct from p_authorization_id
     or v_receipt.publish_job_id is distinct from p_job_id then
    return jsonb_build_object('success', false, 'code', 'RECEIPT_BELONGS_TO_DIFFERENT_ATTEMPT');
  end if;

  if v_receipt.status not in ('failed', 'ambiguous') then
    return jsonb_build_object('success', false, 'code', 'RECEIPT_STATE_NOT_RECOVERABLE', 'status', v_receipt.status);
  end if;

  if v_receipt.external_post_id is not null or v_receipt.external_container_id is not null then
    return jsonb_build_object('success', false, 'code', 'RECEIPT_HAS_PROVIDER_EVIDENCE');
  end if;

  update public.content_publication_receipts
  set status = 'failed',
      updated_at = now(),
      last_error = left('MANUAL_CONFIRMED_NOT_PUBLISHED: ' || p_evidence_reference, 1000)
  where id = v_receipt.id;

  insert into public.audit_logs (actor_id, actor_type, action, entity_type, entity_id, detail)
  values (
    null,
    'system',
    'failed_instagram_publish_confirmed_not_sent',
    'content_item',
    p_content_item_id,
    jsonb_build_object(
      'jobId', p_job_id,
      'authorizationId', p_authorization_id,
      'receiptId', v_receipt.id,
      'evidenceReference', p_evidence_reference
    )
  );

  return jsonb_build_object(
    'success', true,
    'code', 'CONFIRMED_NOT_PUBLISHED',
    'receiptId', v_receipt.id,
    'status', 'failed'
  );
end;
$function$;

REVOKE ALL ON FUNCTION public.confirm_failed_instagram_publish_not_sent(uuid, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_failed_instagram_publish_not_sent(uuid, uuid, uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.confirm_failed_instagram_publish_not_sent(uuid, uuid, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_failed_instagram_publish_not_sent(uuid, uuid, uuid, text) TO service_role;
