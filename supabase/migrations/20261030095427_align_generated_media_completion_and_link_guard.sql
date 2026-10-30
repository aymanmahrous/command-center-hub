-- Align background-generated media completion with media_assets constraints.
-- Strengthen the media-to-content link gate so only technically ready assets can be linked.
-- No schema, RLS, storage, provider, or publishing changes.

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

  IF v_requested_asset_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT * INTO v_asset
    FROM public.media_assets
    WHERE id = v_requested_asset_id::uuid
      AND content_item_id = v_content.id
      AND asset_type = v_asset_type
      AND source = 'generated'
      AND provider = btrim(p_provider)
    LIMIT 1;
  END IF;

  IF v_asset.id IS NULL THEN
    SELECT * INTO v_asset
    FROM public.media_assets
    WHERE content_item_id = v_content.id
      AND asset_type = v_asset_type
      AND source = 'generated'
      AND provider = btrim(p_provider)
      AND metadata->>'autonomous' = 'true'
    ORDER BY created_at DESC, id DESC
    LIMIT 1;
  END IF;

  IF v_asset.id IS NULL THEN
    INSERT INTO public.media_assets (
      content_item_id, asset_type, source, storage_path, provider, provider_job_id,
      prompt, metadata, created_by, category, media_status, ai_analysis_status,
      publishability_status, consent_status, updated_at
    ) VALUES (
      v_content.id, v_asset_type, 'generated', btrim(p_storage_path), btrim(p_provider),
      nullif(btrim(coalesce(p_provider_job_id, '')), ''), v_content.visual_prompt,
      coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'source', coalesce(
          nullif(btrim(coalesce(p_metadata->>'source', '')), ''),
          CASE WHEN btrim(p_provider) = 'canva' THEN 'canva_autofill' ELSE 'ai_generated' END
        ),
        'autonomous', true, 'backgroundJobId', v_job.id, 'reviewRequired', true
      ),
      v_content.created_by, 'unclassified', 'ready', 'skipped', 'blocked', 'pending', now()
    )
    RETURNING * INTO v_asset;
  END IF;

  IF nullif(btrim(coalesce(p_provider_job_id, '')), '') IS NOT NULL THEN
    UPDATE public.ai_media_jobs
    SET status = 'succeeded',
        storage_path = v_asset.storage_path,
        error = null,
        metadata = metadata || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
          'autonomous', true, 'backgroundJobId', v_job.id, 'mediaAssetId', v_asset.id
        ),
        updated_at = now()
    WHERE provider = btrim(p_provider)
      AND provider_job_id = btrim(p_provider_job_id);
  END IF;

  UPDATE public.background_jobs
  SET status = 'completed',
      result = jsonb_build_object(
        'mediaAssetId', v_asset.id, 'storagePath', v_asset.storage_path,
        'assetType', v_asset.asset_type, 'provider', v_asset.provider
      ),
      next_retry_at = null, last_error = null, updated_at = now()
  WHERE id = v_job.id;

  INSERT INTO public.audit_logs(actor_id, actor_type, action, entity_type, entity_id, detail)
  VALUES (
    v_content.created_by, 'system', 'content_media_generated', 'content_item', v_content.id,
    jsonb_build_object('backgroundJobId', v_job.id, 'mediaAssetId', v_asset.id,
      'assetType', v_asset.asset_type, 'provider', v_asset.provider)
  );

  RETURN jsonb_build_object(
    'success', true, 'jobId', v_job.id, 'status', 'completed',
    'mediaAssetId', v_asset.id, 'storagePath', v_asset.storage_path,
    'assetType', v_asset.asset_type, 'provider', v_asset.provider
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.link_staff_media_to_content_item(
  p_content_item_id uuid,
  p_media_asset_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_item public.content_items%rowtype;
  v_asset public.media_assets%rowtype;
  v_previous_media_id uuid;
  v_previous_status public.content_status;
begin
  if not public.is_active_staff(array['super_admin','admin','content_manager']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  if p_content_item_id is null or p_media_asset_id is null then
    return jsonb_build_object('success', false, 'code', 'INVALID_INPUT');
  end if;

  select * into v_item from public.content_items where id = p_content_item_id for update;
  if not found then return jsonb_build_object('success', false, 'code', 'CONTENT_ITEM_NOT_FOUND'); end if;
  if v_item.status = 'published' then return jsonb_build_object('success', false, 'code', 'PUBLISHED_CONTENT_IMMUTABLE'); end if;

  select * into v_asset from public.media_assets where id = p_media_asset_id for update;
  if not found then return jsonb_build_object('success', false, 'code', 'MEDIA_ASSET_NOT_FOUND'); end if;
  if v_asset.asset_type not in ('image','video') then return jsonb_build_object('success', false, 'code', 'MEDIA_ASSET_TYPE_UNSUPPORTED'); end if;

  if coalesce(v_asset.category, 'unclassified') not in ('swimming_business','other_business')
     or coalesce(v_asset.publishability_status, 'blocked') <> 'ready_for_review'
     or v_asset.media_status is distinct from 'ready'
     or (coalesce(v_asset.category, 'unclassified') = 'swimming_business'
         and v_asset.consent_status is distinct from 'consent_confirmed') then
    return jsonb_build_object('success', false, 'code', 'MEDIA_ASSET_NOT_PUBLISHABLE');
  end if;

  if v_asset.content_item_id is not null and v_asset.content_item_id <> v_item.id then
    return jsonb_build_object('success', false, 'code', 'MEDIA_ASSET_ALREADY_LINKED');
  end if;

  v_previous_media_id := v_item.media_asset_id;
  v_previous_status := v_item.status;

  if v_previous_media_id is not null and v_previous_media_id <> v_asset.id then
    update public.media_assets set content_item_id = null, updated_at = now()
    where id = v_previous_media_id and content_item_id = v_item.id;
  end if;

  update public.content_items
  set media_asset_id = v_asset.id, media_source = 'real', media_plan = null,
      status = 'needs_review', scheduled_for = null, updated_at = now()
  where id = v_item.id;

  update public.media_assets set content_item_id = v_item.id, updated_at = now()
  where id = v_asset.id;

  insert into public.audit_logs(actor_id, actor_type, action, entity_type, entity_id, detail)
  values (
    auth.uid(), 'user', 'content_media_linked', 'content_item', v_item.id,
    jsonb_build_object('mediaAssetId', v_asset.id, 'previousMediaAssetId', v_previous_media_id,
      'previousStatus', v_previous_status::text, 'nextStatus', 'needs_review')
  );

  return jsonb_build_object(
    'success', true, 'contentItemId', v_item.id, 'mediaAssetId', v_asset.id,
    'mediaSource', 'real', 'status', 'needs_review'
  );
end;
$function$;
