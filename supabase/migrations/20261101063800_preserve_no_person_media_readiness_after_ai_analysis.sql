-- Keep the AI-analysis save path consistent with the audited person-presence consent policy.
-- No-real-person uploaded media may remain eligible only after the explicit staff attestation RPC.
-- Synthetic exemption remains limited to generated assets with the separate synthetic attestation.
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
DECLARE
  v_asset public.media_assets%rowtype;
  v_publishability text;
  v_consent_not_applicable boolean;
BEGIN
  IF NOT public.is_active_staff(array['super_admin','admin','content_manager']) THEN
    RAISE EXCEPTION 'STAFF_ACCESS_DENIED' USING errcode = '42501';
  END IF;

  IF jsonb_typeof(p_analysis) <> 'object' THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_ANALYSIS');
  END IF;

  SELECT * INTO v_asset
  FROM public.media_assets
  WHERE id = p_media_asset_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  END IF;

  IF coalesce(v_asset.category, 'unclassified') <> 'swimming_business' THEN
    RETURN jsonb_build_object('success', false, 'code', 'ANALYSIS_CATEGORY_BLOCKED');
  END IF;

  v_consent_not_applicable :=
    (
      v_asset.source <> 'generated'
      AND v_asset.metadata->>'consentApplicability' = 'not_applicable_no_real_person'
      AND v_asset.metadata->'containsRealPerson' = 'false'::jsonb
      AND nullif(v_asset.metadata->>'personPresenceReviewedAt', '') IS NOT NULL
      AND nullif(v_asset.metadata->>'personPresenceReviewedBy', '') IS NOT NULL
    )
    OR
    (
      v_asset.source = 'generated'
      AND v_asset.metadata->>'consentApplicability' = 'not_applicable_synthetic'
      AND v_asset.metadata->'containsRealPerson' = 'false'::jsonb
      AND nullif(v_asset.metadata->>'syntheticAttestedAt', '') IS NOT NULL
      AND nullif(v_asset.metadata->>'syntheticAttestedBy', '') IS NOT NULL
    );

  IF v_asset.media_status = 'ready'
     AND (v_asset.consent_status = 'consent_confirmed' OR v_consent_not_applicable)
     AND coalesce(p_analysis->>'suitabilityVerdict', '') <> 'unsuitable' THEN
    v_publishability := 'ready_for_review';
  ELSE
    v_publishability := 'blocked';
  END IF;

  UPDATE public.media_assets
  SET metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'analysis', p_analysis,
        'analysisProvider', coalesce(nullif(btrim(p_provider), ''), 'local_heuristic'),
        'geminiConnected', false
      ),
      ai_analysis_status = 'analyzed',
      publishability_status = v_publishability,
      updated_at = now()
  WHERE id = v_asset.id
  RETURNING * INTO v_asset;

  RETURN jsonb_build_object(
    'success', true,
    'mediaAssetId', v_asset.id,
    'aiAnalysisStatus', v_asset.ai_analysis_status,
    'publishabilityStatus', v_asset.publishability_status,
    'consentStatus', v_asset.consent_status,
    'mediaStatus', v_asset.media_status
  );
END;
$function$;
