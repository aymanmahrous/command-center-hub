-- Repair idempotent content-media completion and ensure all generated assets have explicit review state.
-- The current Canva function creates and links a media_assets row, then the worker calls
-- complete_content_media_job with that row's mediaAssetId. Reuse that exact row before
-- falling back to the legacy autonomous-asset lookup; never create a second row needlessly.

CREATE OR REPLACE FUNCTION public.complete_content_media_job(
  p_job_id uuid,
  p_storage_path text,
  p_provider text,
  p_provider_job_id text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_job public.background_jobs%rowtype;
  v_content public.content_items%rowtype;
  v_asset_type text;
  v_asset public.media_assets%rowtype;
  v_requested_asset_id text := nullif(btrim(coalesce(p_metadata->>'mediaAssetId', '')), '');
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING errcode = '42501';
  END IF;

  IF char_length(btrim(coalesce(p_storage_path, ''))) < 3
    OR char_length(btrim(coalesce(p_provider, ''))) < 2 THEN
    RAISE EXCEPTION 'INVALID_CONTENT_MEDIA_COMPLETION' USING errcode = '22023';
  END IF;

  SELECT * INTO v_job
  FROM public.background_jobs
  WHERE id = p_job_id
    AND job_type = 'generate_content_media'
  FOR UPDATE;

  IF v_job.id IS NULL OR v_job.status <> 'processing' THEN
    RAISE EXCEPTION 'CONTENT_MEDIA_JOB_NOT_PROCESSING' USING errcode = '22023';
  END IF;

  SELECT * INTO v_content
  FROM public.content_items
  WHERE id = (v_job.payload->>'contentItemId')::uuid;

  IF v_content.id IS NULL OR v_content.created_by IS NULL THEN
    RAISE EXCEPTION 'CONTENT_MEDIA_CONTEXT_INVALID' USING errcode = '22023';
  END IF;

  v_asset_type := CASE
    WHEN v_content.content_type = 'image_post' THEN 'image'
    WHEN v_content.content_type = 'reel' THEN 'video'
    ELSE NULL
  END;

  IF v_asset_type IS NULL THEN
    RAISE EXCEPTION 'CONTENT_MEDIA_TYPE_UNSUPPORTED' USING errcode = '22023';
  END IF;

  -- Prefer the exact asset ID returned by the generator. Validate its ownership/context
  -- before reuse so caller metadata cannot link an unrelated asset.
  IF v_requested_asset_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT * INTO v_asset
    FROM public.media_assets
    WHERE id = v_requested_asset_id::uuid
      AND content_item_id = v_content.id
      AND asset_type = v_asset_type
      AND source = 'ai_generated'
      AND provider = btrim(p_provider)
    LIMIT 1;
  END IF;

  -- Compatibility fallback for legacy workers that do not return mediaAssetId.
  IF v_asset.id IS NULL THEN
    SELECT * INTO v_asset
    FROM public.media_assets
    WHERE content_item_id = v_content.id
      AND asset_type = v_asset_type
      AND source = 'ai_generated'
      AND metadata->>'autonomous' = 'true'
    ORDER BY created_at DESC, id DESC
    LIMIT 1;
  END IF;

  -- If no generator-created asset can be safely reused, register a conservative,
  -- review-blocked fallback record with every workflow field explicit.
  IF v_asset.id IS NULL THEN
    INSERT INTO public.media_assets (
      content_item_id,
      asset_type,
      source,
      storage_path,
      provider,
      provider_job_id,
      prompt,
      metadata,
      created_by,
      category,
      media_status,
      ai_analysis_status,
      publishability_status,
      consent_status,
      updated_at
    ) VALUES (
      v_content.id,
      v_asset_type,
      'ai_generated',
      btrim(p_storage_path),
      btrim(p_provider),
      nullif(btrim(coalesce(p_provider_job_id, '')), ''),
      v_content.visual_prompt,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'source', coalesce(
          nullif(btrim(coalesce(p_metadata->>'source', '')), ''),
          CASE WHEN btrim(p_provider) = 'canva' THEN 'canva_autofill' ELSE 'ai_generated' END
        ),
        'autonomous', true,
        'backgroundJobId', v_job.id,
        'reviewRequired', true
      ),
      v_content.created_by,
      'unclassified',
      'unclassified',
      'not_started',
      'blocked',
      'unknown',
      now()
    )
    RETURNING * INTO v_asset;
  END IF;

  IF nullif(btrim(coalesce(p_provider_job_id, '')), '') IS NOT NULL THEN
    UPDATE public.ai_media_jobs
    SET status = 'succeeded',
        storage_path = v_asset.storage_path,
        error = null,
        metadata = metadata || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
          'autonomous', true,
          'backgroundJobId', v_job.id,
          'mediaAssetId', v_asset.id
        ),
        updated_at = now()
    WHERE provider = btrim(p_provider)
      AND provider_job_id = btrim(p_provider_job_id);
  END IF;

  UPDATE public.background_jobs
  SET status = 'completed',
      result = jsonb_build_object(
        'mediaAssetId', v_asset.id,
        'storagePath', v_asset.storage_path,
        'assetType', v_asset.asset_type,
        'provider', v_asset.provider
      ),
      next_retry_at = null,
      last_error = null,
      updated_at = now()
  WHERE id = v_job.id;

  INSERT INTO public.audit_logs (
    actor_id,
    actor_type,
    action,
    entity_type,
    entity_id,
    detail
  ) VALUES (
    v_content.created_by,
    'system',
    'content_media_generated',
    'content_item',
    v_content.id,
    jsonb_build_object(
      'backgroundJobId', v_job.id,
      'mediaAssetId', v_asset.id,
      'assetType', v_asset.asset_type,
      'provider', v_asset.provider
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'jobId', v_job.id,
    'status', 'completed',
    'mediaAssetId', v_asset.id,
    'storagePath', v_asset.storage_path,
    'assetType', v_asset.asset_type,
    'provider', v_asset.provider
  );
END;
$function$;

-- Existing legacy fallback rows were created without the Media Library workflow columns.
-- Normalize only AI-generated Canva rows that are explicitly job-linked and still incomplete.
-- Keep them blocked until reviewed; this does not approve or publish any asset.
UPDATE public.media_assets
SET category = coalesce(category, 'unclassified'),
    media_status = coalesce(media_status, 'unclassified'),
    ai_analysis_status = coalesce(ai_analysis_status, 'not_started'),
    publishability_status = coalesce(publishability_status, 'blocked'),
    consent_status = coalesce(consent_status, 'unknown'),
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'source', coalesce(nullif(btrim(coalesce(metadata->>'source', '')), ''), 'canva_automation_fallback'),
      'reviewRequired', true
    ),
    updated_at = now()
WHERE provider = 'canva'
  AND source = 'ai_generated'
  AND provider_job_id IS NOT NULL
  AND (
    media_status IS NULL
    OR ai_analysis_status IS NULL
    OR publishability_status IS NULL
    OR consent_status IS NULL
  );
