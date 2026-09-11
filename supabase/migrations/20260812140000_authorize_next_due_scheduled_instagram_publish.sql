-- Authorize the next due scheduled Instagram item at due time (official Owner Approval gate).
-- Does not publish. Does not change scheduled_for. Creates a short-lived single_publish authorization
-- for an already-queued publish_content job whose next_retry_at matches scheduled_for.
-- Used by the existing Content Scheduler workflow Schedule Trigger path.

CREATE OR REPLACE FUNCTION public.authorize_next_due_scheduled_instagram_publish(
  p_authorized_by text,
  p_approval_reference text,
  p_ttl_minutes integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_content public.content_items%rowtype;
  v_job public.background_jobs%rowtype;
  v_auth public.owner_publish_authorizations%rowtype;
  v_now timestamptz := now();
  v_ttl integer := coalesce(p_ttl_minutes, 30);
  v_live_account_id constant text := '17841400516801494';
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING errcode = '42501';
  END IF;

  IF nullif(btrim(coalesce(p_authorized_by, '')), '') IS NULL THEN
    RAISE EXCEPTION 'INVALID_AUTHORIZED_BY' USING errcode = '22023';
  END IF;
  IF nullif(btrim(coalesce(p_approval_reference, '')), '') IS NULL THEN
    RAISE EXCEPTION 'INVALID_APPROVAL_REFERENCE' USING errcode = '22023';
  END IF;
  IF p_approval_reference ~* 'token|secret|password|bearer|api[_-]?key' THEN
    RAISE EXCEPTION 'INVALID_APPROVAL_REFERENCE' USING errcode = '22023';
  END IF;
  IF v_ttl < 1 OR v_ttl > 30 THEN
    RAISE EXCEPTION 'INVALID_TTL_MINUTES' USING errcode = '22023';
  END IF;

  -- Lock the earliest due candidate (scheduled + due job, no active auth).
  SELECT ci.*
  INTO v_content
  FROM public.content_items ci
  INNER JOIN public.background_jobs bj
    ON bj.job_type = 'publish_content'
   AND bj.payload->>'contentItemId' = ci.id::text
   AND bj.status IN ('queued', 'retrying')
   AND bj.next_retry_at IS NOT NULL
   AND bj.next_retry_at = ci.scheduled_for
   AND bj.next_retry_at <= v_now
  WHERE ci.platform = 'instagram'
    AND ci.status = 'scheduled'
    AND ci.scheduled_for IS NOT NULL
    AND ci.scheduled_for <= v_now
    AND ci.published_at IS NULL
    AND ci.provider_external_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.owner_publish_authorizations opa
      WHERE opa.content_item_id = ci.id
        AND opa.platform = 'instagram'
        AND opa.consumed_at IS NULL
        AND opa.revoked_at IS NULL
        AND opa.expires_at > v_now
    )
  ORDER BY ci.scheduled_for ASC, ci.id ASC
  LIMIT 1
  FOR UPDATE OF ci;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false, 'code', 'NO_DUE_CANDIDATE');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_content.id::text, 0));

  SELECT bj.*
  INTO v_job
  FROM public.background_jobs bj
  WHERE bj.job_type = 'publish_content'
    AND bj.payload->>'contentItemId' = v_content.id::text
    AND bj.status IN ('queued', 'retrying')
    AND bj.next_retry_at = v_content.scheduled_for
  ORDER BY bj.created_at DESC, bj.id DESC
  FOR UPDATE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false, 'code', 'AUTHORIZED_JOB_NOT_FOUND');
  END IF;

  INSERT INTO public.owner_publish_authorizations (
    content_item_id,
    platform,
    page_id,
    publish_job_id,
    scope,
    authorized_by,
    approval_reference,
    authorized_at,
    expires_at
  ) VALUES (
    v_content.id,
    'instagram',
    v_live_account_id,
    v_job.id,
    'single_publish',
    btrim(p_authorized_by),
    btrim(p_approval_reference),
    v_now,
    v_now + make_interval(mins => v_ttl)
  )
  RETURNING * INTO v_auth;

  INSERT INTO public.audit_logs (actor_id, actor_type, action, entity_type, entity_id, detail)
  VALUES (
    NULL,
    'system',
    'owner_instagram_due_scheduled_publish_authorization_created',
    'content_item',
    v_content.id,
    jsonb_build_object(
      'authorizationId', v_auth.id,
      'publishJobId', v_job.id,
      'platform', 'instagram',
      'accountId', v_live_account_id,
      'scheduledFor', v_content.scheduled_for,
      'expiresAt', v_auth.expires_at,
      'approvalReference', btrim(p_approval_reference)
    )
  );

  RETURN jsonb_build_object(
    'found', true,
    'success', true,
    'contentItemId', v_content.id,
    'authorizationId', v_auth.id,
    'jobId', v_job.id,
    'scheduledFor', v_content.scheduled_for,
    'authorizedAt', v_auth.authorized_at,
    'expiresAt', v_auth.expires_at
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.authorize_next_due_scheduled_instagram_publish(text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.authorize_next_due_scheduled_instagram_publish(text, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.authorize_next_due_scheduled_instagram_publish(text, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_next_due_scheduled_instagram_publish(text, text, integer) TO service_role;
