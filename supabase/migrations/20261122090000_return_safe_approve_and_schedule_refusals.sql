CREATE OR REPLACE FUNCTION public.approve_and_schedule_staff_content_item(
  p_content_item_id uuid,
  p_scheduled_for timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  transition_result jsonb;
  v_platform text;
  v_account_or_page text;
  v_job_id uuid;
  refusal_code text := 'APPROVE_AND_SCHEDULE_FAILED';
BEGIN
  transition_result := public.transition_staff_content_item(p_content_item_id, 'approve', NULL);
  IF COALESCE((transition_result->>'success')::boolean, false) THEN
    transition_result := public.transition_staff_content_item(p_content_item_id, 'schedule', p_scheduled_for);
  END IF;
  IF NOT COALESCE((transition_result->>'success')::boolean, false) THEN
    -- A JSON refusal must roll back earlier writes just like a trigger exception.
    IF transition_result->>'code' IN (
      'NOT_FOUND', 'INVALID_TRANSITION', 'APPROVAL_REQUIRED', 'INVALID_SCHEDULE_TIME', 'SCHEDULE_TOO_FAR'
    ) THEN
      refusal_code := transition_result->>'code';
    END IF;
    RAISE EXCEPTION 'TRANSITION_REFUSED';
  END IF;

  SELECT lower(btrim(platform))
    INTO v_platform
  FROM public.content_items
  WHERE id = p_content_item_id;

  IF v_platform NOT IN ('facebook','instagram') THEN
    RAISE EXCEPTION 'PLATFORM_NOT_SUPPORTED';
  END IF;

  v_account_or_page := CASE
    WHEN v_platform = 'facebook' THEN '1164107840123575'
    ELSE '17841400516801494'
  END;

  SELECT bj.id
    INTO v_job_id
  FROM public.background_jobs bj
  WHERE bj.job_type = 'publish_content'
    AND bj.payload->>'contentItemId' = p_content_item_id::text
    AND bj.status = 'queued'
    AND bj.next_retry_at = p_scheduled_for
  ORDER BY bj.created_at DESC, bj.id DESC
  LIMIT 1;

  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'SCHEDULE_PUBLISH_JOB_NOT_FOUND';
  END IF;

  UPDATE public.background_jobs
  SET payload = payload || jsonb_build_object(
    'platform', v_platform,
    'pageId', CASE WHEN v_platform = 'facebook' THEN v_account_or_page ELSE NULL END,
    'accountId', CASE WHEN v_platform = 'instagram' THEN v_account_or_page ELSE NULL END,
    'source', 'staff_schedule',
    'idempotencyKey', p_content_item_id::text
  ),
  updated_at = now()
  WHERE id = v_job_id;

  RETURN transition_result || jsonb_build_object('publishJobId', v_job_id);
EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE = '23514' AND SQLERRM IN (
    'MEDIA_ASSET_REQUIRED_FOR_PUBLISH', 'MEDIA_ASSET_MISSING_OR_UNLINKED', 'MEDIA_NOT_APPROVED_FOR_PUBLISH'
  ) THEN
    refusal_code := SQLERRM;
  ELSIF SQLSTATE = '42501' AND SQLERRM = 'STAFF_ACCESS_DENIED' THEN
    refusal_code := 'STAFF_ACCESS_DENIED';
  ELSIF SQLSTATE = 'P0001' AND SQLERRM IN ('PLATFORM_NOT_SUPPORTED', 'SCHEDULE_PUBLISH_JOB_NOT_FOUND') THEN
    refusal_code := SQLERRM;
  END IF;
  RETURN jsonb_build_object('success', false, 'code', refusal_code);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_and_schedule_staff_content_item(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_and_schedule_staff_content_item(uuid, timestamptz) TO authenticated;
