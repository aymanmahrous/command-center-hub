-- Keep generated synthetic media on its dedicated, auditable attestation path.
-- Uploaded/external media continue to use the staff person-presence classification.
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

  -- Generated media must use attest_generated_media_synthetic for the no-real-person exemption.
  IF v_asset.source = 'generated' AND p_contains_real_person = false THEN
    RETURN jsonb_build_object('success', false, 'code', 'USE_SYNTHETIC_ATTESTATION');
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
