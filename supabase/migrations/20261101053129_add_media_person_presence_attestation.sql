-- Allow staff to classify whether an image/video depicts an identifiable real person.
-- This is a person-presence classification, never a substitute for a person's consent.
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

  v_consent := CASE coalesce(nullif(btrim(p_consent_status), ''), v_asset.consent_status)
    WHEN 'unknown' THEN 'pending'
    WHEN 'consent_required' THEN 'pending'
    WHEN 'no_consent' THEN 'denied'
    ELSE coalesce(nullif(btrim(p_consent_status), ''), v_asset.consent_status)
  END;
  if v_consent is not null
     and v_consent not in ('pending','granted','denied','expired','consent_confirmed') then
    return jsonb_build_object('success', false, 'code', 'INVALID_CONSENT');
  end if;

  v_status := CASE coalesce(nullif(btrim(p_media_status), ''), v_asset.media_status, 'pending')
    WHEN 'unclassified' THEN 'pending'
    WHEN 'approved' THEN 'pending'
    WHEN 'rejected' THEN 'failed'
    WHEN 'unsuitable' THEN 'failed'
    ELSE coalesce(nullif(btrim(p_media_status), ''), v_asset.media_status, 'pending')
  END;
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
     or (v_category = 'swimming_business' and ((v_asset.metadata->>'consentApplicability' IN ('not_applicable_synthetic','not_applicable_no_real_person') AND v_asset.metadata->'containsRealPerson' = 'false'::jsonb) IS NOT TRUE) and v_consent is distinct from 'consent_confirmed')
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

  v_consent := CASE coalesce(nullif(btrim(p_consent_status), ''), v_asset.consent_status)
    WHEN 'unknown' THEN 'pending'
    WHEN 'consent_required' THEN 'pending'
    WHEN 'no_consent' THEN 'denied'
    ELSE coalesce(nullif(btrim(p_consent_status), ''), v_asset.consent_status)
  END;
  if v_consent is not null
     and v_consent not in ('pending','granted','denied','expired','consent_confirmed') then
    return jsonb_build_object('success', false, 'code', 'INVALID_CONSENT');
  end if;

  v_status := CASE coalesce(nullif(btrim(p_media_status), ''), v_asset.media_status, 'pending')
    WHEN 'unclassified' THEN 'pending'
    WHEN 'approved' THEN 'pending'
    WHEN 'rejected' THEN 'failed'
    WHEN 'unsuitable' THEN 'failed'
    ELSE coalesce(nullif(btrim(p_media_status), ''), v_asset.media_status, 'pending')
  END;
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
     or (v_category = 'swimming_business' and ((v_asset.metadata->>'consentApplicability' IN ('not_applicable_synthetic','not_applicable_no_real_person') AND v_asset.metadata->'containsRealPerson' = 'false'::jsonb) IS NOT TRUE) and v_consent is distinct from 'consent_confirmed')
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
         and ((v_asset.metadata->>'consentApplicability' IN ('not_applicable_synthetic','not_applicable_no_real_person') AND v_asset.metadata->'containsRealPerson' = 'false'::jsonb) IS NOT TRUE)
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

CREATE OR REPLACE FUNCTION public.review_staff_media_asset(
  p_media_asset_id uuid,
  p_review_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_asset public.media_assets%rowtype;
  v_status text := nullif(btrim(p_review_status), '');
BEGIN
  IF NOT public.is_active_staff(array['super_admin','admin','content_manager']) THEN
    RAISE EXCEPTION 'STAFF_ACCESS_DENIED' USING errcode = '42501';
  END IF;

  IF v_status IS NULL OR v_status NOT IN ('pending_review','approved','rejected','unsuitable') THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_REVIEW_STATUS');
  END IF;

  SELECT * INTO v_asset
  FROM public.media_assets
  WHERE id = p_media_asset_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  END IF;

  IF v_status = 'approved' AND (
    v_asset.media_status IS DISTINCT FROM 'ready'
    OR v_asset.publishability_status IS DISTINCT FROM 'ready_for_review'
    OR coalesce(v_asset.category, 'unclassified') NOT IN ('swimming_business','other_business')
    OR (coalesce(v_asset.category, 'unclassified') = 'swimming_business'
        AND ((v_asset.metadata->>'consentApplicability' IN ('not_applicable_synthetic','not_applicable_no_real_person') AND v_asset.metadata->'containsRealPerson' = 'false'::jsonb) IS NOT TRUE)
        AND v_asset.consent_status IS DISTINCT FROM 'consent_confirmed')
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'MEDIA_ASSET_NOT_READY_FOR_REVIEW');
  END IF;

  UPDATE public.media_assets
  SET metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'reviewStatus', v_status,
        'reviewedAt', now(),
        'reviewedBy', auth.uid()
      ),
      publishability_status = CASE
        WHEN v_status IN ('rejected','unsuitable') THEN 'blocked'
        WHEN v_status = 'pending_review'
          AND v_asset.media_status = 'ready'
          AND coalesce(v_asset.category, 'unclassified') IN ('swimming_business','other_business')
          AND (coalesce(v_asset.category, 'unclassified') <> 'swimming_business'
            OR (v_asset.metadata->>'consentApplicability' IN ('not_applicable_synthetic','not_applicable_no_real_person')
              AND v_asset.metadata->'containsRealPerson' = 'false'::jsonb)
            OR v_asset.consent_status = 'consent_confirmed')
          AND coalesce(v_asset.metadata->'analysis'->>'suitabilityVerdict', '') <> 'unsuitable'
          THEN 'ready_for_review'
        ELSE publishability_status
      END,
      updated_at = now()
  WHERE id = v_asset.id
  RETURNING * INTO v_asset;

  INSERT INTO public.audit_logs(actor_id, actor_type, action, entity_type, entity_id, detail)
  VALUES (
    auth.uid(), 'user', 'media_asset_review_transition', 'media_asset', v_asset.id,
    jsonb_build_object('reviewStatus', v_status, 'mediaStatus', v_asset.media_status,
      'publishabilityStatus', v_asset.publishability_status)
  );

  RETURN jsonb_build_object(
    'success', true,
    'mediaAssetId', v_asset.id,
    'reviewStatus', v_status,
    'mediaStatus', v_asset.media_status,
    'publishabilityStatus', v_asset.publishability_status
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.attest_media_person_presence(
  p_media_asset_id uuid,
  p_contains_real_person boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_asset public.media_assets%rowtype;
  v_applicability text;
BEGIN
  IF NOT public.is_active_staff(array['super_admin','admin','content_manager']) THEN
    RAISE EXCEPTION 'STAFF_ACCESS_DENIED' USING errcode = '42501';
  END IF;

  IF p_contains_real_person IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'PERSON_PRESENCE_REQUIRED');
  END IF;

  SELECT * INTO v_asset
  FROM public.media_assets
  WHERE id = p_media_asset_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  END IF;

  IF v_asset.asset_type NOT IN ('image','video') THEN
    RETURN jsonb_build_object('success', false, 'code', 'IMAGE_OR_VIDEO_ONLY');
  END IF;

  v_applicability := CASE
    WHEN p_contains_real_person THEN 'consent_required'
    ELSE 'not_applicable_no_real_person'
  END;

  UPDATE public.media_assets
  SET metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'consentApplicability', v_applicability,
        'containsRealPerson', p_contains_real_person,
        'personPresenceReviewedAt', now(),
        'personPresenceReviewedBy', auth.uid(),
        'reviewStatus', 'pending_review'
      ),
      publishability_status = CASE
        WHEN p_contains_real_person THEN 'blocked'
        WHEN v_asset.media_status = 'ready'
          AND coalesce(v_asset.category, 'unclassified') IN ('swimming_business','other_business')
          AND coalesce(v_asset.metadata->'analysis'->>'suitabilityVerdict', '') <> 'unsuitable'
          THEN 'ready_for_review'
        ELSE publishability_status
      END,
      updated_at = now()
  WHERE id = v_asset.id
  RETURNING * INTO v_asset;

  INSERT INTO public.audit_logs(actor_id, actor_type, action, entity_type, entity_id, detail)
  VALUES (
    auth.uid(), 'user', 'media_person_presence_reviewed', 'media_asset', v_asset.id,
    jsonb_build_object('containsRealPerson', p_contains_real_person,
      'consentApplicability', v_applicability, 'consentStatus', v_asset.consent_status)
  );

  RETURN jsonb_build_object('success', true, 'mediaAssetId', v_asset.id,
    'containsRealPerson', p_contains_real_person,
    'consentApplicability', v_applicability,
    'consentStatus', v_asset.consent_status);
END;
$function$;

REVOKE ALL ON FUNCTION public.attest_media_person_presence(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attest_media_person_presence(uuid, boolean) TO authenticated;
