-- Enforce the reviewed media lifecycle at both scheduling and publication boundaries.
-- This migration is intentionally applied to QA first; it does not enable live publishing.

CREATE OR REPLACE FUNCTION public.assert_content_media_publish_ready(
  p_content_item_id uuid,
  p_media_asset_id uuid,
  p_platform text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_asset public.media_assets%rowtype;
  v_metadata jsonb;
  v_no_real_person boolean;
  v_synthetic_attested boolean;
  v_person_presence_reviewed boolean;
  v_consent_valid boolean;
BEGIN
  IF lower(coalesce(p_platform, '')) NOT IN ('facebook', 'instagram') THEN
    RETURN;
  END IF;

  IF p_content_item_id IS NULL OR p_media_asset_id IS NULL THEN
    RAISE EXCEPTION 'MEDIA_ASSET_REQUIRED_FOR_PUBLISH' USING errcode = '23514';
  END IF;

  SELECT * INTO v_asset
  FROM public.media_assets
  WHERE id = p_media_asset_id
  FOR KEY SHARE;

  IF NOT FOUND
     OR v_asset.content_item_id IS DISTINCT FROM p_content_item_id
     OR nullif(btrim(coalesce(v_asset.storage_path, '')), '') IS NULL
     OR v_asset.asset_type IS NULL OR v_asset.asset_type NOT IN ('image', 'video') THEN
    RAISE EXCEPTION 'MEDIA_ASSET_MISSING_OR_UNLINKED' USING errcode = '23514';
  END IF;

  v_metadata := coalesce(v_asset.metadata, '{}'::jsonb);
  v_no_real_person := coalesce(v_metadata->'containsRealPerson' = 'false'::jsonb, false);
  v_synthetic_attested := coalesce(
    v_asset.source = 'generated'
    AND v_metadata->>'consentApplicability' = 'not_applicable_synthetic'
    AND nullif(v_metadata->>'syntheticAttestedAt', '') IS NOT NULL
    AND nullif(v_metadata->>'syntheticAttestedBy', '') IS NOT NULL, false);
  v_person_presence_reviewed := coalesce(
    v_asset.source <> 'generated'
    AND v_metadata->>'consentApplicability' = 'not_applicable_no_real_person'
    AND nullif(v_metadata->>'personPresenceReviewedAt', '') IS NOT NULL
    AND nullif(v_metadata->>'personPresenceReviewedBy', '') IS NOT NULL, false);

  v_consent_valid :=
    coalesce(v_asset.category, 'unclassified') <> 'swimming_business'
    OR v_asset.consent_status = 'consent_confirmed'
    OR (v_no_real_person AND (coalesce(v_synthetic_attested, false) OR coalesce(v_person_presence_reviewed, false)));

  IF v_asset.media_status IS DISTINCT FROM 'ready'
     OR v_asset.publishability_status IS DISTINCT FROM 'ready_for_review'
     OR coalesce(v_asset.category, 'unclassified') NOT IN ('swimming_business', 'other_business')
     OR v_metadata->>'reviewStatus' IS DISTINCT FROM 'approved'
     OR NOT v_consent_valid THEN
    RAISE EXCEPTION 'MEDIA_NOT_APPROVED_FOR_PUBLISH' USING errcode = '23514';
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.assert_content_media_publish_ready(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_content_media_publish_ready(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.guard_content_media_before_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.status = 'scheduled'
     AND lower(coalesce(NEW.platform, '')) IN ('facebook', 'instagram')
     AND (
       TG_OP = 'INSERT'
       OR OLD.status IS DISTINCT FROM NEW.status
       OR OLD.media_asset_id IS DISTINCT FROM NEW.media_asset_id
     ) THEN
    PERFORM public.assert_content_media_publish_ready(NEW.id, NEW.media_asset_id, NEW.platform);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS content_media_ready_before_schedule ON public.content_items;
CREATE TRIGGER content_media_ready_before_schedule
BEFORE INSERT OR UPDATE OF status, media_asset_id ON public.content_items
FOR EACH ROW EXECUTE FUNCTION public.guard_content_media_before_schedule();

CREATE OR REPLACE FUNCTION public.guard_publication_receipt_media_readiness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_media_asset_id uuid;
  v_platform text;
BEGIN
  IF NEW.status IN ('reserved', 'container_created')
     AND (
       TG_OP = 'INSERT'
       OR OLD.status IS DISTINCT FROM NEW.status
       OR OLD.content_item_id IS DISTINCT FROM NEW.content_item_id
     ) THEN
    SELECT media_asset_id, platform
    INTO v_media_asset_id, v_platform
    FROM public.content_items
    WHERE id = NEW.content_item_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'CONTENT_ITEM_NOT_FOUND' USING errcode = '23503';
    END IF;

    PERFORM public.assert_content_media_publish_ready(
      NEW.content_item_id,
      v_media_asset_id,
      v_platform
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS publication_receipt_media_ready_before_reserve ON public.content_publication_receipts;
CREATE TRIGGER publication_receipt_media_ready_before_reserve
BEFORE INSERT OR UPDATE OF status, content_item_id ON public.content_publication_receipts
FOR EACH ROW EXECUTE FUNCTION public.guard_publication_receipt_media_readiness();

REVOKE ALL ON FUNCTION public.guard_content_media_before_schedule() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.guard_publication_receipt_media_readiness() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guard_content_media_before_schedule() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_publication_receipt_media_readiness() TO authenticated, service_role;
