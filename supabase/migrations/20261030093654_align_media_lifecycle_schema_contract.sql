-- Align Media Library lifecycle RPCs with the existing QA media_assets CHECK constraints.
-- No schema, RLS, storage, provider, or publishing changes.
-- The existing function signatures, SECURITY DEFINER boundaries, search_path, owners, and grants are preserved.

CREATE OR REPLACE FUNCTION public.get_staff_media_assets()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.is_active_staff(array['super_admin','admin','reception','coach','content_manager']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'createdBy', m.created_by,
          'contentItemId', m.content_item_id,
          'assetType', m.asset_type,
          'source', m.source,
          'storagePath', m.storage_path,
          'provider', m.provider,
          'providerJobId', m.provider_job_id,
          'prompt', m.prompt,
          'metadata', m.metadata,
          'category', coalesce(m.category, 'unclassified'),
          'mediaStatus', coalesce(m.media_status, 'pending'),
          'aiAnalysisStatus', coalesce(m.ai_analysis_status, 'pending'),
          'publishabilityStatus', coalesce(m.publishability_status, 'blocked'),
          'consentStatus', m.consent_status,
          'suggestedPlatforms', coalesce(m.metadata->'analysis'->'suggestedPlatforms', '[]'::jsonb),
          'suggestedFormats', coalesce(m.metadata->'analysis'->'suggestedFormats', '[]'::jsonb),
          'aiNotes', coalesce(m.metadata->'analysis'->>'notes', ''),
          'createdAt', m.created_at,
          'updatedAt', m.updated_at
        )
        order by m.created_at desc, m.id desc
      )
      from (
        select *
        from public.media_assets
        where created_by = auth.uid()
           or (
             created_by is null
             and nullif(btrim(coalesce(storage_path, '')), '') is not null
             and position('://' in storage_path) = 0
             and split_part(storage_path, '/', 1) = auth.uid()::text
             and public.can_manage_relax_fix_media()
           )
        order by created_at desc, id desc
        limit 500
      ) m
    ),
    '[]'::jsonb
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_staff_media_asset(
  p_media_asset_id uuid,
  p_category text DEFAULT NULL,
  p_consent_status text DEFAULT NULL,
  p_media_status text DEFAULT NULL,
  p_content_item_id uuid DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_asset public.media_assets%rowtype;
  v_category text;
  v_consent text;
  v_status text;
  v_publishability text;
  v_suitability text;
begin
  if not public.is_active_staff(array['super_admin','admin','content_manager']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  select * into v_asset
  from public.media_assets
  where id = p_media_asset_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  end if;

  v_category := coalesce(nullif(btrim(p_category), ''), v_asset.category, 'unclassified');
  if v_category not in ('swimming_business','family_personal','other_business','other','unclassified') then
    return jsonb_build_object('success', false, 'code', 'INVALID_CATEGORY');
  end if;

  v_consent := coalesce(nullif(btrim(p_consent_status), ''), v_asset.consent_status);
  if v_consent is not null
     and v_consent not in ('pending','granted','denied','expired','consent_confirmed') then
    return jsonb_build_object('success', false, 'code', 'INVALID_CONSENT');
  end if;

  v_status := coalesce(nullif(btrim(p_media_status), ''), v_asset.media_status, 'pending');
  if v_status not in ('pending','ready','processing','failed') then
    return jsonb_build_object('success', false, 'code', 'INVALID_STATUS');
  end if;

  if p_content_item_id is not null
     and not exists (select 1 from public.content_items where id = p_content_item_id) then
    return jsonb_build_object('success', false, 'code', 'CONTENT_ITEM_NOT_FOUND');
  end if;

  v_suitability := coalesce(v_asset.metadata->'analysis'->>'suitabilityVerdict', '');
  if v_category in ('family_personal','other','unclassified')
     or v_status <> 'ready'
     or (v_category = 'swimming_business' and v_consent is distinct from 'consent_confirmed')
     or v_suitability = 'unsuitable' then
    v_publishability := 'blocked';
  else
    v_publishability := 'ready_for_review';
  end if;

  update public.media_assets
  set category = v_category,
      consent_status = v_consent,
      media_status = v_status,
      publishability_status = v_publishability,
      content_item_id = coalesce(p_content_item_id, content_item_id),
      updated_at = now()
  where id = v_asset.id
  returning * into v_asset;

  return jsonb_build_object(
    'success', true,
    'mediaAssetId', v_asset.id,
    'category', v_asset.category,
    'consentStatus', v_asset.consent_status,
    'mediaStatus', v_asset.media_status,
    'publishabilityStatus', v_asset.publishability_status
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_owner_media_asset(
  p_media_asset_id uuid,
  p_category text DEFAULT NULL,
  p_consent_status text DEFAULT NULL,
  p_media_status text DEFAULT NULL,
  p_content_item_id uuid DEFAULT NULL
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_asset public.media_assets%rowtype;
  v_category text;
  v_consent text;
  v_status text;
  v_publishability text;
  v_suitability text;
begin
  if public.command_center_staff_role() <> 'super_admin' then
    raise exception 'OWNER_ACCESS_DENIED' using errcode = '42501';
  end if;

  select * into v_asset
  from public.media_assets
  where id = p_media_asset_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  end if;

  v_category := coalesce(nullif(btrim(p_category), ''), v_asset.category, 'unclassified');
  if v_category not in ('swimming_business','family_personal','other_business','other','unclassified') then
    return jsonb_build_object('success', false, 'code', 'INVALID_CATEGORY');
  end if;

  v_consent := coalesce(nullif(btrim(p_consent_status), ''), v_asset.consent_status);
  if v_consent is not null
     and v_consent not in ('pending','granted','denied','expired','consent_confirmed') then
    return jsonb_build_object('success', false, 'code', 'INVALID_CONSENT');
  end if;

  v_status := coalesce(nullif(btrim(p_media_status), ''), v_asset.media_status, 'pending');
  if v_status not in ('pending','ready','processing','failed') then
    return jsonb_build_object('success', false, 'code', 'INVALID_STATUS');
  end if;

  if p_content_item_id is not null
     and not exists (select 1 from public.content_items where id = p_content_item_id) then
    return jsonb_build_object('success', false, 'code', 'CONTENT_ITEM_NOT_FOUND');
  end if;

  v_suitability := coalesce(v_asset.metadata->'analysis'->>'suitabilityVerdict', '');
  if v_category in ('family_personal','other','unclassified')
     or v_status <> 'ready'
     or (v_category = 'swimming_business' and v_consent is distinct from 'consent_confirmed')
     or v_suitability = 'unsuitable' then
    v_publishability := 'blocked';
  else
    v_publishability := 'ready_for_review';
  end if;

  update public.media_assets
  set category = v_category,
      consent_status = v_consent,
      media_status = v_status,
      publishability_status = v_publishability,
      content_item_id = coalesce(p_content_item_id, content_item_id),
      updated_at = now()
  where id = v_asset.id
  returning * into v_asset;

  insert into public.audit_logs(actor_id, actor_type, action, entity_type, entity_id, detail)
  values (
    auth.uid(),
    'user',
    'owner_media_asset_updated',
    'media_asset',
    v_asset.id,
    jsonb_build_object(
      'category', v_asset.category,
      'consentStatus', v_asset.consent_status,
      'mediaStatus', v_asset.media_status,
      'publishabilityStatus', v_asset.publishability_status,
      'contentItemId', v_asset.content_item_id
    )
  );

  return jsonb_build_object(
    'success', true,
    'mediaAssetId', v_asset.id,
    'publishabilityStatus', v_asset.publishability_status,
    'consentStatus', v_asset.consent_status,
    'mediaStatus', v_asset.media_status
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.save_staff_media_ai_analysis(
  p_media_asset_id uuid,
  p_analysis jsonb,
  p_provider text DEFAULT 'local_heuristic'
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_asset public.media_assets%rowtype;
  v_publishability text;
begin
  if not public.is_active_staff(array['super_admin','admin','content_manager']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  if jsonb_typeof(p_analysis) <> 'object' then
    return jsonb_build_object('success', false, 'code', 'INVALID_ANALYSIS');
  end if;

  select * into v_asset
  from public.media_assets
  where id = p_media_asset_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  end if;

  if coalesce(v_asset.category, 'unclassified') <> 'swimming_business' then
    return jsonb_build_object('success', false, 'code', 'ANALYSIS_CATEGORY_BLOCKED');
  end if;

  if v_asset.media_status = 'ready'
     and v_asset.consent_status = 'consent_confirmed'
     and coalesce(p_analysis->>'suitabilityVerdict', '') <> 'unsuitable' then
    v_publishability := 'ready_for_review';
  else
    v_publishability := 'blocked';
  end if;

  update public.media_assets
  set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'analysis', p_analysis,
        'analysisProvider', coalesce(nullif(btrim(p_provider), ''), 'local_heuristic'),
        'geminiConnected', false
      ),
      ai_analysis_status = 'analyzed',
      publishability_status = v_publishability,
      updated_at = now()
  where id = v_asset.id
  returning * into v_asset;

  return jsonb_build_object(
    'success', true,
    'mediaAssetId', v_asset.id,
    'aiAnalysisStatus', v_asset.ai_analysis_status,
    'publishabilityStatus', v_asset.publishability_status,
    'consentStatus', v_asset.consent_status,
    'mediaStatus', v_asset.media_status
  );
end;
$function$;
