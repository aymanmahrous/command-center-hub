-- Align internal content approval audit actor and external media registration defaults.
-- This preserves the existing audit_logs CHECK constraint and media_assets CHECK constraints.
-- No schema, RLS, storage, provider, or production changes.

CREATE OR REPLACE FUNCTION public.transition_staff_content_item(
  p_content_item_id uuid,
  p_action text,
  p_scheduled_for timestamp with time zone DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_item public.content_items%rowtype;
  v_old_status public.content_status;
  v_new_status public.content_status;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and not public.is_active_staff(array['super_admin','admin','content_manager']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  select * into v_item
  from public.content_items
  where id = p_content_item_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  end if;

  v_old_status := v_item.status;

  case p_action
    when 'approve' then
      if v_item.status not in ('needs_review','generated','draft') then
        return jsonb_build_object('success', false, 'code', 'INVALID_TRANSITION', 'from', v_item.status::text, 'action', p_action);
      end if;
      v_new_status := 'approved';
    when 'schedule' then
      if v_item.status <> 'approved' then
        return jsonb_build_object('success', false, 'code', 'INVALID_TRANSITION', 'from', v_item.status::text, 'action', p_action);
      end if;
      v_new_status := 'scheduled';
      v_item.scheduled_for := p_scheduled_for;
    when 'publish' then
      if v_item.status not in ('scheduled','approved') then
        return jsonb_build_object('success', false, 'code', 'INVALID_TRANSITION', 'from', v_item.status::text, 'action', p_action);
      end if;
      v_new_status := 'published';
      v_item.published_at := now();
    when 'reject' then
      v_new_status := 'cancelled';
    when 'fail' then
      v_new_status := 'failed';
    when 'cancel' then
      v_new_status := 'cancelled';
    else
      return jsonb_build_object('success', false, 'code', 'UNKNOWN_ACTION', 'action', p_action);
  end case;

  update public.content_items
  set status = v_new_status,
      scheduled_for = v_item.scheduled_for,
      published_at = v_item.published_at,
      updated_at = now()
  where id = p_content_item_id;

  insert into public.audit_logs (actor_id, actor_type, action, entity_type, entity_id, detail)
  values (
    auth.uid(),
    'user',
    'content_status_transition',
    'content_item',
    p_content_item_id,
    jsonb_build_object('from', v_old_status::text, 'to', v_new_status::text, 'action', p_action)
  );

  return jsonb_build_object('success', true, 'code', 'TRANSITIONED', 'from', v_old_status::text, 'to', v_new_status::text);
end;
$function$;

CREATE OR REPLACE FUNCTION public.register_staff_external_media_asset(
  p_asset_type text,
  p_provider text,
  p_external_id text,
  p_name text,
  p_mime_type text,
  p_web_url text,
  p_preview_url text DEFAULT NULL,
  p_size_bytes bigint DEFAULT NULL,
  p_created_at text DEFAULT NULL,
  p_folder text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_asset public.media_assets%rowtype;
  v_metadata jsonb;
begin
  if not public.is_active_staff(array['super_admin','admin','content_manager']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  if p_asset_type not in ('image', 'video') then
    return jsonb_build_object('success', false, 'code', 'INVALID_ASSET_TYPE');
  end if;
  if p_provider not in ('google_drive', 'google_photos', 'dropbox', 'onedrive') then
    return jsonb_build_object('success', false, 'code', 'INVALID_PROVIDER');
  end if;
  if nullif(btrim(p_external_id), '') is null or length(p_external_id) > 500 then
    return jsonb_build_object('success', false, 'code', 'INVALID_EXTERNAL_ID');
  end if;
  if p_web_url !~* '^https://' then
    return jsonb_build_object('success', false, 'code', 'INVALID_EXTERNAL_URL');
  end if;

  select * into v_asset
  from public.media_assets
  where created_by = auth.uid()
    and source = 'external'
    and metadata->>'provider' = p_provider
    and metadata->>'external_id' = p_external_id
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object('success', true, 'mediaAssetId', v_asset.id, 'duplicate', true);
  end if;

  v_metadata := jsonb_build_object(
    'provider', p_provider,
    'external_id', p_external_id,
    'file_name', left(coalesce(nullif(btrim(p_name), ''), p_external_id), 500),
    'mime_type', left(coalesce(nullif(btrim(p_mime_type), ''), 'application/octet-stream'), 120),
    'external_web_url', p_web_url,
    'external_preview_url', case when p_preview_url ~* '^https://' then p_preview_url else null end,
    'size_bytes', p_size_bytes,
    'created_at', p_created_at,
    'folder', p_folder,
    'review_status', 'needs_review'
  );

  insert into public.media_assets (
    created_by, asset_type, source, storage_path, provider, provider_job_id, metadata,
    category, media_status, ai_analysis_status, publishability_status, consent_status, updated_at
  ) values (
    auth.uid(), p_asset_type, 'external', null, p_provider, p_external_id, v_metadata,
    'unclassified', 'pending', 'pending', 'blocked', NULL, now()
  ) returning * into v_asset;

  insert into public.audit_logs (actor_id, actor_type, action, entity_type, entity_id, detail)
  values (auth.uid(), 'user', 'external_media_asset_linked', 'media_asset', v_asset.id,
    jsonb_build_object('provider', p_provider, 'externalId', p_external_id, 'reviewStatus', 'needs_review'));

  return jsonb_build_object('success', true, 'mediaAssetId', v_asset.id, 'duplicate', false, 'reviewStatus', 'needs_review');
end;
$function$;
