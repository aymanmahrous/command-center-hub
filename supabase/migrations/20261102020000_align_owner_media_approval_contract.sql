-- Align the owner media approval RPC with the publisher's media policy.
-- The UI sends media_status='approved'; the publisher must accept that exact state.
-- Persist reviewStatus only when the owner explicitly changes the media review state.
-- Preserve the live Production safeguards for existing media/content linkage.
-- Additive and non-destructive; does not publish or contact external platforms.

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
  v_metadata jsonb;
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

  if p_content_item_id is not null
     and v_asset.content_item_id is not null
     and v_asset.content_item_id <> p_content_item_id then
    return jsonb_build_object('success', false, 'code', 'MEDIA_ALREADY_LINKED');
  end if;

  v_category := coalesce(nullif(btrim(p_category), ''), v_asset.category, 'unclassified');
  if v_category not in ('swimming_business','family_personal','other_business','other','unclassified') then
    return jsonb_build_object('success', false, 'code', 'INVALID_CATEGORY');
  end if;

  v_consent := coalesce(nullif(btrim(p_consent_status), ''), v_asset.consent_status, 'unknown');
  if v_consent not in ('unknown','consent_required','consent_confirmed','no_consent') then
    return jsonb_build_object('success', false, 'code', 'INVALID_CONSENT');
  end if;

  v_status := coalesce(nullif(btrim(p_media_status), ''), v_asset.media_status, 'unclassified');
  if v_status not in ('unclassified','approved','rejected','unsuitable') then
    return jsonb_build_object('success', false, 'code', 'INVALID_STATUS');
  end if;

  if p_content_item_id is not null
     and not exists (select 1 from public.content_items where id = p_content_item_id) then
    return jsonb_build_object('success', false, 'code', 'CONTENT_ITEM_NOT_FOUND');
  end if;

  v_publishability := case
    when v_category in ('family_personal','other','unclassified') then 'blocked'
    when v_status in ('rejected','unsuitable') then 'unsuitable'
    when v_category = 'swimming_business' and v_consent in ('unknown','consent_required') then 'consent_required'
    when v_category = 'swimming_business' and v_consent = 'no_consent' then 'blocked'
    when v_category = 'swimming_business' and v_consent = 'consent_confirmed'
         and v_status = 'approved'
         and v_asset.ai_analysis_status = 'completed'
      then 'ready_for_review'
    else 'blocked'
  end;

  v_metadata := coalesce(v_asset.metadata, '{}'::jsonb);
  if p_media_status is not null then
    v_metadata := v_metadata || jsonb_build_object(
      'reviewStatus',
      case
        when v_status = 'approved' then 'approved'
        when v_status in ('rejected','unsuitable') then 'rejected'
        else 'pending'
      end
    );
  end if;

  update public.media_assets
  set category = v_category,
      consent_status = v_consent,
      media_status = v_status,
      publishability_status = v_publishability,
      metadata = v_metadata,
      content_item_id = coalesce(p_content_item_id, content_item_id),
      updated_at = now()
  where id = v_asset.id
  returning * into v_asset;

  if p_content_item_id is not null then
    update public.content_items
    set media_asset_id = v_asset.id,
        updated_at = now()
    where id = p_content_item_id;
  end if;

  insert into public.audit_logs(
    actor_id, actor_type, action, entity_type, entity_id, detail
  )
  values(
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
      'reviewStatus', v_asset.metadata->>'reviewStatus',
      'contentItemId', v_asset.content_item_id
    )
  );

  return jsonb_build_object(
    'success', true,
    'mediaAssetId', v_asset.id,
    'publishabilityStatus', v_asset.publishability_status,
    'consentStatus', v_asset.consent_status,
    'mediaStatus', v_asset.media_status,
    'reviewStatus', v_asset.metadata->>'reviewStatus',
    'contentItemId', v_asset.content_item_id
  );
end;
$function$;

REVOKE ALL ON FUNCTION public.update_owner_media_asset(uuid,text,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_owner_media_asset(uuid,text,text,text,uuid) TO authenticated;
