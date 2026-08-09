-- DRAFT ONLY — NOT APPLIED.
-- Required before scripts/import-google-drive-media.mjs can set storage_path on
-- existing google_drive media_assets rows. Existing table grants revoke direct
-- authenticated writes on public.media_assets; only RPCs may mutate.

create or replace function public.update_staff_media_asset_storage_path(
  p_media_asset_id uuid,
  p_storage_path text
)
returns jsonb
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
declare
  v_asset public.media_assets%rowtype;
  v_prefix text := auth.uid()::text || '/';
begin
  if not public.is_active_staff(array['super_admin', 'admin', 'content_manager']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_storage_path, '')), '') is null
     or left(p_storage_path, char_length(v_prefix)) <> v_prefix then
    return jsonb_build_object('success', false, 'code', 'INVALID_STORAGE_PATH');
  end if;

  select * into v_asset
  from public.media_assets
  where id = p_media_asset_id
  for update;

  if v_asset.id is null then
    return jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  end if;

  if v_asset.storage_path is not null and btrim(v_asset.storage_path) <> '' then
    return jsonb_build_object('success', false, 'code', 'STORAGE_PATH_ALREADY_SET');
  end if;

  if coalesce(v_asset.provider, '') <> 'google_drive' then
    return jsonb_build_object('success', false, 'code', 'UNSUPPORTED_PROVIDER');
  end if;

  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'relax-fix-media'
      and o.name = p_storage_path
  ) then
    return jsonb_build_object('success', false, 'code', 'STORAGE_OBJECT_NOT_FOUND');
  end if;

  update public.media_assets
  set storage_path = btrim(p_storage_path)
  where id = v_asset.id
  returning * into v_asset;

  insert into public.audit_logs (
    actor_id, actor_type, action, entity_type, entity_id, detail
  ) values (
    auth.uid(),
    'user',
    'media_asset_storage_path_linked',
    'media_asset',
    v_asset.id,
    jsonb_build_object(
      'contentItemId', v_asset.content_item_id,
      'storagePath', v_asset.storage_path,
      'provider', v_asset.provider
    )
  );

  return jsonb_build_object(
    'success', true,
    'mediaAssetId', v_asset.id,
    'contentItemId', v_asset.content_item_id,
    'storagePath', v_asset.storage_path
  );
end;
$$;

revoke all on function public.update_staff_media_asset_storage_path(uuid, text) from public, anon;
grant execute on function public.update_staff_media_asset_storage_path(uuid, text) to authenticated, service_role;
