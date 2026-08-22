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
        and m.content_item_id is not null
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

revoke all on function public.get_staff_google_drive_import_candidates(uuid) from public, anon;
grant execute on function public.get_staff_google_drive_import_candidates(uuid) to authenticated, service_role;
