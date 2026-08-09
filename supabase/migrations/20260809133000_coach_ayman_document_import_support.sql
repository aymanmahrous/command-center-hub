-- Coach Ayman document library support (draft — not applied to Production).
-- Additive only: does not change create_staff_media_asset_record image/video behavior.

create or replace function public.register_staff_google_drive_document_import_candidate(
  p_drive_file_id text,
  p_file_name text,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.media_assets%rowtype;
  v_asset public.media_assets%rowtype;
  v_drive_file_id text := nullif(btrim(coalesce(p_drive_file_id, '')), '');
  v_file_name text := nullif(btrim(coalesce(p_file_name, '')), '');
begin
  if not public.is_active_staff(array['super_admin', 'admin', 'content_manager']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  if v_drive_file_id is null then
    return jsonb_build_object('success', false, 'code', 'INVALID_DRIVE_FILE_ID');
  end if;

  select *
  into v_existing
  from public.media_assets m
  where m.provider = 'google_drive'
    and (
      m.provider_job_id = v_drive_file_id
      or m.metadata->>'drive_file_id' = v_drive_file_id
      or m.metadata->>'driveFileId' = v_drive_file_id
    )
  order by m.created_at asc
  limit 1;

  if v_existing.id is not null then
    return jsonb_build_object(
      'success', true,
      'duplicate', true,
      'mediaAssetId', v_existing.id,
      'assetType', v_existing.asset_type,
      'storagePath', v_existing.storage_path,
      'createdAt', v_existing.created_at
    );
  end if;

  insert into public.media_assets (
    created_by,
    content_item_id,
    asset_type,
    source,
    storage_path,
    provider,
    provider_job_id,
    prompt,
    metadata
  ) values (
    auth.uid(),
    null,
    'other',
    'external',
    null,
    'google_drive',
    v_drive_file_id,
    null,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
      'drive_file_id', v_drive_file_id,
      'file_name', coalesce(v_file_name, p_metadata->>'file_name', v_drive_file_id),
      'library_pack', 'coach_ayman_profile',
      'approval', coalesce(p_metadata->>'approval', 'READY_TO_USE')
    )
  )
  returning * into v_asset;

  insert into public.audit_logs (
    actor_id, actor_type, action, entity_type, entity_id, detail
  ) values (
    auth.uid(),
    'user',
    'google_drive_document_import_registered',
    'media_asset',
    v_asset.id,
    jsonb_build_object(
      'assetType', v_asset.asset_type,
      'provider', v_asset.provider,
      'driveFileId', v_drive_file_id,
      'fileName', v_file_name
    )
  );

  return jsonb_build_object(
    'success', true,
    'duplicate', false,
    'mediaAssetId', v_asset.id,
    'assetType', v_asset.asset_type,
    'storagePath', v_asset.storage_path,
    'createdAt', v_asset.created_at
  );
end;
$$;

create or replace function public.get_staff_google_drive_import_candidates(
  p_media_asset_id uuid default null
)
returns jsonb
language plpgsql
stable security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_active_staff(array['super_admin', 'admin', 'content_manager']) then
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
          'createdAt', m.created_at
        )
        order by m.id asc
      )
      from public.media_assets m
      where m.provider = 'google_drive'
        and nullif(btrim(coalesce(m.storage_path, '')), '') is null
        and (
          m.content_item_id is not null
          or m.asset_type = 'other'
        )
        and (
          nullif(btrim(coalesce(m.provider_job_id, '')), '') is not null
          or nullif(btrim(coalesce(m.metadata->>'drive_file_id', '')), '') is not null
          or nullif(btrim(coalesce(m.metadata->>'driveFileId', '')), '') is not null
          or nullif(btrim(coalesce(m.metadata->>'googleDriveFileId', '')), '') is not null
          or nullif(btrim(coalesce(m.metadata->>'fileId', '')), '') is not null
        )
        and (p_media_asset_id is null or m.id = p_media_asset_id)
    ),
    '[]'::jsonb
  );
end;
$$;

revoke all on function public.register_staff_google_drive_document_import_candidate(text, text, jsonb) from public, anon;
grant execute on function public.register_staff_google_drive_document_import_candidate(text, text, jsonb) to authenticated, service_role;
