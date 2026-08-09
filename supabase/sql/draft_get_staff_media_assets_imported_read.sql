-- Narrow read expansion for Media Library: include imported rows with null created_by
-- when the storage object lives in the signed-in staff member's own media folder.
-- Does not change media_assets ownership or storage objects.

create or replace function public.get_staff_media_assets()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
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
          'createdAt', m.created_at
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
$$;

revoke all on function public.get_staff_media_assets() from public, anon;
grant execute on function public.get_staff_media_assets() to authenticated, service_role;
