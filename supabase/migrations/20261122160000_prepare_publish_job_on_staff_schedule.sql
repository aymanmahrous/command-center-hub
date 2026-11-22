-- Owner review and queue preparation share the content row lock and transaction.
CREATE OR REPLACE FUNCTION public.approve_and_schedule_staff_content_item(
  p_content_item_id uuid,
  p_scheduled_for timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.content_items%ROWTYPE;
  v_job public.background_jobs%ROWTYPE;
  v_platform pg_catalog.text;
  v_payload pg_catalog.jsonb;
  transition_result pg_catalog.jsonb;
  refusal_code pg_catalog.text := 'APPROVE_AND_SCHEDULE_FAILED';
BEGIN
  IF auth.uid() IS NULL OR auth.role() IS DISTINCT FROM 'authenticated'
     OR public.is_active_staff(ARRAY['super_admin','admin','content_manager']) IS NOT TRUE THEN
    RETURN jsonb_build_object('success', false, 'code', 'STAFF_ACCESS_DENIED');
  END IF;

  SELECT * INTO v_item FROM public.content_items WHERE id = p_content_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  END IF;
  IF p_scheduled_for IS NULL OR NOT isfinite(p_scheduled_for) OR p_scheduled_for <= clock_timestamp() THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_SCHEDULE_TIME');
  END IF;
  -- Use the same platform spelling as the media trigger.
  v_platform := lower(coalesce(v_item.platform, ''));
  IF v_platform NOT IN ('facebook','instagram') THEN
    RETURN jsonb_build_object('success', false, 'code', 'PLATFORM_NOT_SUPPORTED');
  END IF;
  IF v_item.published_at IS NOT NULL OR nullif(btrim(v_item.provider_external_id), '') IS NOT NULL
     OR EXISTS (SELECT 1 FROM public.content_publication_receipts r
                WHERE r.content_item_id = p_content_item_id AND lower(r.platform) = v_platform
                  AND r.status IN ('pending','reserved','container_created','ambiguous','published')) THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_TRANSITION');
  END IF;

  -- Keep the reviewed asset stable until the job and schedule commit together.
  PERFORM 1 FROM public.media_assets WHERE id = v_item.media_asset_id FOR SHARE;
  IF v_item.status = 'scheduled' AND v_item.scheduled_for = p_scheduled_for THEN
    -- Replays do not update the item or fire its schedule trigger. Recheck the same guard.
    PERFORM public.assert_content_media_publish_ready(v_item.id, v_item.media_asset_id, v_platform);
    transition_result := jsonb_build_object('success', true, 'code', 'ALREADY_PREPARED', 'to', 'scheduled');
  ELSE
    transition_result := public.transition_staff_content_item(p_content_item_id, 'approve', NULL);
    IF COALESCE((transition_result->>'success')::pg_catalog.bool, false) THEN
      transition_result := public.transition_staff_content_item(p_content_item_id, 'schedule', p_scheduled_for);
    END IF;
    IF NOT COALESCE((transition_result->>'success')::pg_catalog.bool, false) THEN
      IF transition_result->>'code' IN (
        'NOT_FOUND', 'INVALID_TRANSITION', 'APPROVAL_REQUIRED', 'INVALID_SCHEDULE_TIME', 'SCHEDULE_TOO_FAR'
      ) THEN
        refusal_code := transition_result->>'code';
      END IF;
      RAISE EXCEPTION 'TRANSITION_REFUSED';
    END IF;
  END IF;

  -- The existing guard's consent expression can be NULL for swimming media.
  -- A missing consent status is valid only with documented absence of real people.
  IF EXISTS (
    SELECT 1 FROM public.media_assets m
    WHERE m.id = v_item.media_asset_id AND m.category = 'swimming_business' AND m.consent_status IS NULL
      AND (m.metadata->'containsRealPerson' = 'false'::pg_catalog.jsonb AND (
        (m.source = 'generated' AND m.metadata->>'consentApplicability' = 'not_applicable_synthetic'
         AND nullif(btrim(m.metadata->>'syntheticAttestedAt'), '') IS NOT NULL
         AND nullif(btrim(m.metadata->>'syntheticAttestedBy'), '') IS NOT NULL)
        OR (m.source <> 'generated' AND m.metadata->>'consentApplicability' = 'not_applicable_no_real_person'
            AND nullif(btrim(m.metadata->>'personPresenceReviewedAt'), '') IS NOT NULL
            AND nullif(btrim(m.metadata->>'personPresenceReviewedBy'), '') IS NOT NULL)
      )) IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'MEDIA_NOT_APPROVED_FOR_PUBLISH' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_job FROM public.background_jobs
  WHERE job_type = 'publish_content' AND payload->>'contentItemId' = p_content_item_id::pg_catalog.text
    AND status IN ('queued','processing','retrying')
  FOR UPDATE NOWAIT;
  IF FOUND AND v_job.status <> 'queued' THEN
    refusal_code := 'INVALID_TRANSITION';
    RAISE EXCEPTION 'TRANSITION_REFUSED';
  END IF;

  v_payload := jsonb_build_object(
    'contentItemId', p_content_item_id, 'platform', v_platform,
    'pageId', CASE WHEN v_platform = 'facebook' THEN '1164107840123575' END,
    'accountId', CASE WHEN v_platform = 'instagram' THEN '17841400516801494' END,
    'source', 'staff_schedule', 'idempotencyKey', p_content_item_id::pg_catalog.text
  );
  IF v_job.id IS NULL THEN
    INSERT INTO public.background_jobs (job_type, status, payload, next_retry_at)
    VALUES ('publish_content', 'queued', v_payload, p_scheduled_for)
    RETURNING id INTO v_job.id;
  ELSIF v_job.next_retry_at IS DISTINCT FROM p_scheduled_for OR NOT (v_job.payload @> v_payload) THEN
    UPDATE public.background_jobs
    SET payload = payload || v_payload, next_retry_at = p_scheduled_for, updated_at = now()
    WHERE id = v_job.id
    RETURNING id INTO v_job.id;
  END IF;

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'SCHEDULE_PUBLISH_JOB_NOT_FOUND';
  END IF;
  RETURN transition_result || jsonb_build_object('publishJobId', v_job.id);
EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE = '23514' AND SQLERRM IN (
    'MEDIA_ASSET_REQUIRED_FOR_PUBLISH', 'MEDIA_ASSET_MISSING_OR_UNLINKED', 'MEDIA_NOT_APPROVED_FOR_PUBLISH'
  ) THEN
    refusal_code := SQLERRM;
  ELSIF SQLSTATE = '42501' AND SQLERRM = 'STAFF_ACCESS_DENIED' THEN
    refusal_code := 'STAFF_ACCESS_DENIED';
  ELSIF SQLSTATE = 'P0001' AND SQLERRM = 'SCHEDULE_PUBLISH_JOB_NOT_FOUND' THEN
    refusal_code := 'SCHEDULE_PUBLISH_JOB_NOT_FOUND';
  END IF;
  RETURN jsonb_build_object('success', false, 'code', refusal_code);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_and_schedule_staff_content_item(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_and_schedule_staff_content_item(uuid, timestamptz) TO authenticated;
