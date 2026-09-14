-- Automatic 10-day content batch generation via existing supabase_cron pulse.
-- Reuses create_staff_generated_content_batch validation; service_role automation path only.

CREATE TABLE IF NOT EXISTS public.content_batch_generation_cycles (
  cycle_key text PRIMARY KEY,
  batch_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.content_batch_generation_cycles IS
  'Idempotency ledger for automated Coach Ayman 10-day batch generation cycles.';

CREATE OR REPLACE FUNCTION public.evaluate_content_batch_generation_need()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_now timestamptz := now();
  v_cycle_key text;
  v_existing_batch_id uuid;
  v_covered_count integer := 0;
  v_active_review_batch uuid;
  v_last_automated_at timestamptz;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING errcode = '42501';
  END IF;

  v_cycle_key := 'coach-ayman-' || floor(extract(epoch FROM v_now) / 864000)::bigint;

  SELECT c.batch_id
  INTO v_existing_batch_id
  FROM public.content_batch_generation_cycles c
  WHERE c.cycle_key = v_cycle_key;

  IF v_existing_batch_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'shouldGenerate', false,
      'code', 'CYCLE_ALREADY_GENERATED',
      'cycleKey', v_cycle_key,
      'batchId', v_existing_batch_id
    );
  END IF;

  SELECT count(*)::integer
  INTO v_covered_count
  FROM public.content_items ci
  WHERE ci.batch_id IS NOT NULL
    AND ci.planned_for >= v_now
    AND ci.planned_for <= v_now + interval '10 days'
    AND ci.status IN ('needs_review', 'approved', 'scheduled');

  IF v_covered_count >= 10 THEN
    RETURN jsonb_build_object(
      'shouldGenerate', false,
      'code', 'UPCOMING_CYCLE_COVERED',
      'cycleKey', v_cycle_key,
      'coveredCount', v_covered_count
    );
  END IF;

  SELECT ci.batch_id
  INTO v_active_review_batch
  FROM public.content_items ci
  WHERE ci.batch_id IS NOT NULL
    AND ci.status = 'needs_review'
    AND ci.created_at >= v_now - interval '10 days'
  GROUP BY ci.batch_id
  ORDER BY max(ci.created_at) DESC
  LIMIT 1;

  IF v_active_review_batch IS NOT NULL THEN
    RETURN jsonb_build_object(
      'shouldGenerate', false,
      'code', 'REVIEW_BATCH_ACTIVE',
      'cycleKey', v_cycle_key,
      'batchId', v_active_review_batch
    );
  END IF;

  SELECT max(a.created_at)
  INTO v_last_automated_at
  FROM public.audit_logs a
  WHERE a.action = 'content_brain_batch_automated'
    AND a.entity_type = 'content_batch';

  IF v_last_automated_at IS NOT NULL AND v_last_automated_at >= v_now - interval '10 days' THEN
    RETURN jsonb_build_object(
      'shouldGenerate', false,
      'code', 'GENERATION_COOLDOWN',
      'cycleKey', v_cycle_key,
      'lastAutomatedAt', v_last_automated_at
    );
  END IF;

  RETURN jsonb_build_object(
    'shouldGenerate', true,
    'code', 'GENERATION_DUE',
    'cycleKey', v_cycle_key,
    'suggestedStartIso', (date_trunc('day', v_now AT TIME ZONE 'Asia/Dubai') AT TIME ZONE 'Asia/Dubai')::timestamptz
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_automated_content_batch(
  p_items jsonb,
  p_provider_external_id text,
  p_cycle_key text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_item jsonb;
  v_content public.content_items%rowtype;
  v_media public.media_assets%rowtype;
  v_ids uuid[] := '{}'::uuid[];
  v_batch_id uuid := gen_random_uuid();
  v_count integer;
  v_platform text;
  v_content_type text;
  v_caption text;
  v_language text;
  v_pillar text;
  v_slot text;
  v_fingerprint text;
  v_planned_for_text text;
  v_planned_for timestamptz;
  v_media_asset_id uuid;
  v_media_source text;
  v_media_plan jsonb;
  v_cycle_key text;
  v_existing_batch_id uuid;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED' USING errcode = '42501';
  END IF;

  v_cycle_key := btrim(coalesce(p_cycle_key, ''));
  IF v_cycle_key = '' THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_CYCLE_KEY');
  END IF;

  SELECT c.batch_id
  INTO v_existing_batch_id
  FROM public.content_batch_generation_cycles c
  WHERE c.cycle_key = v_cycle_key;

  IF v_existing_batch_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'code', 'ALREADY_GENERATED',
      'batchId', v_existing_batch_id,
      'cycleKey', v_cycle_key
    );
  END IF;

  IF jsonb_typeof(p_items) <> 'array' THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_ITEMS');
  END IF;

  v_count := jsonb_array_length(p_items);
  IF v_count < 1 OR v_count > 90 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_BATCH_SIZE');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_cycle_key, 0));

  SELECT c.batch_id
  INTO v_existing_batch_id
  FROM public.content_batch_generation_cycles c
  WHERE c.cycle_key = v_cycle_key;

  IF v_existing_batch_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'code', 'ALREADY_GENERATED',
      'batchId', v_existing_batch_id,
      'cycleKey', v_cycle_key
    );
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_platform := v_item->>'platform';
    v_content_type := btrim(coalesce(v_item->>'contentType', ''));
    v_caption := btrim(coalesce(v_item->>'caption', ''));
    v_language := btrim(coalesce(v_item->>'language', ''));
    v_pillar := btrim(coalesce(v_item->>'contentPillar', ''));
    v_slot := btrim(coalesce(v_item->>'contentSlot', ''));
    v_fingerprint := lower(btrim(coalesce(v_item->>'contentFingerprint', '')));
    v_planned_for_text := btrim(coalesce(v_item->>'plannedFor', ''));
    v_media_asset_id := nullif(btrim(coalesce(v_item->>'mediaAssetId', '')), '')::uuid;
    v_media_source := nullif(btrim(coalesce(v_item->>'mediaSource', '')), '');
    v_media_plan := v_item->'mediaPlan';

    IF v_platform NOT IN ('instagram', 'facebook', 'tiktok') THEN
      RAISE EXCEPTION 'INVALID_PLATFORM' USING errcode = '22023';
    END IF;

    IF char_length(v_content_type) < 2 OR char_length(v_caption) < 2 THEN
      RAISE EXCEPTION 'INVALID_CONTENT' USING errcode = '22023';
    END IF;

    IF v_language NOT IN ('ar', 'en') THEN
      RAISE EXCEPTION 'INVALID_CONTENT_LANGUAGE' USING errcode = '22023';
    END IF;

    IF v_pillar NOT IN (
      'water_fear', 'parent_concerns', 'confidence', 'swimming_education', 'coach_authority',
      'real_progress', 'safety_awareness', 'aqua_training', 'behind_the_scenes', 'offer_booking'
    ) THEN
      RAISE EXCEPTION 'INVALID_CONTENT_PILLAR' USING errcode = '22023';
    END IF;

    IF v_slot NOT IN ('trust_morning', 'education_midday', 'conversion_evening') THEN
      RAISE EXCEPTION 'INVALID_CONTENT_SLOT' USING errcode = '22023';
    END IF;

    IF v_fingerprint !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION 'INVALID_CONTENT_FINGERPRINT' USING errcode = '22023';
    END IF;

    BEGIN
      v_planned_for := v_planned_for_text::timestamptz;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'INVALID_PLANNED_TIME' USING errcode = '22023';
    END;

    IF v_planned_for <= now() OR v_planned_for > now() + interval '31 days' THEN
      RAISE EXCEPTION 'INVALID_PLANNED_TIME' USING errcode = '22023';
    END IF;

    IF EXISTS (SELECT 1 FROM public.content_items existing WHERE existing.planned_for = v_planned_for) THEN
      RAISE EXCEPTION 'CONTENT_SLOT_ALREADY_PLANNED' USING errcode = '23505';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.content_items existing
      WHERE existing.content_fingerprint = v_fingerprint
        AND existing.created_at >= now() - interval '90 days'
    ) THEN
      RAISE EXCEPTION 'CONTENT_FATIGUE_DUPLICATE' USING errcode = '23505';
    END IF;

    INSERT INTO public.content_items (
      batch_id, planned_for, platform, content_type, topic, hook, caption, cta, hashtags,
      visual_prompt, status, provider_external_id, language, content_pillar, content_slot,
      content_fingerprint, media_asset_id, media_source, media_plan
    ) VALUES (
      v_batch_id, v_planned_for, v_platform, v_content_type,
      nullif(btrim(coalesce(v_item->>'topic', '')), ''),
      nullif(btrim(coalesce(v_item->>'hook', '')), ''),
      v_caption,
      nullif(btrim(coalesce(v_item->>'cta', '')), ''),
      coalesce(array(SELECT jsonb_array_elements_text(coalesce(v_item->'hashtags', '[]'::jsonb))), '{}'::text[]),
      nullif(btrim(coalesce(v_item->>'visualPrompt', '')), ''),
      'needs_review',
      nullif(btrim(coalesce(p_provider_external_id, '')), ''),
      v_language, v_pillar, v_slot, v_fingerprint,
      v_media_asset_id,
      coalesce(v_media_source, CASE WHEN v_media_plan IS NOT NULL THEN 'pending' ELSE NULL END),
      CASE WHEN v_media_plan IS NULL OR v_media_plan = 'null'::jsonb THEN NULL ELSE v_media_plan END
    )
    RETURNING * INTO v_content;

    IF v_media_asset_id IS NOT NULL THEN
      UPDATE public.media_assets
      SET content_item_id = v_content.id, updated_at = now()
      WHERE id = v_media_asset_id;
    END IF;

    v_ids := array_append(v_ids, v_content.id);
  END LOOP;

  INSERT INTO public.content_batch_generation_cycles (cycle_key, batch_id)
  VALUES (v_cycle_key, v_batch_id);

  INSERT INTO public.audit_logs (actor_id, actor_type, action, entity_type, entity_id, detail)
  VALUES (
    NULL,
    'system',
    'content_brain_batch_automated',
    'content_batch',
    v_batch_id,
    jsonb_build_object(
      'batchId', v_batch_id,
      'contentItemIds', to_jsonb(v_ids),
      'count', cardinality(v_ids),
      'cycleKey', v_cycle_key,
      'providerExternalId', nullif(btrim(coalesce(p_provider_external_id, '')), '')
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'code', 'GENERATED',
    'batchId', v_batch_id,
    'contentItemIds', to_jsonb(v_ids),
    'count', cardinality(v_ids),
    'cycleKey', v_cycle_key,
    'status', 'needs_review'
  );
END;
$function$;

ALTER TABLE public.content_automation_scheduler_auth
  DROP CONSTRAINT IF EXISTS content_automation_scheduler_auth_endpoint_check;

ALTER TABLE public.content_automation_scheduler_auth
  ADD CONSTRAINT content_automation_scheduler_auth_endpoint_check
  CHECK (
    endpoint_url ~ '^https://[A-Za-z0-9.-]+/api/cron/content-automation$'
    OR endpoint_url ~ '^https://[a-z0-9]+\.supabase\.co/functions/v1/content-automation-pulse$'
  );

UPDATE public.content_automation_scheduler_auth
SET endpoint_url = 'https://nmzxrjdxvmmzzmajrskm.supabase.co/functions/v1/content-automation-pulse',
    updated_at = now()
WHERE id = 'primary';

GRANT EXECUTE ON FUNCTION public.evaluate_content_batch_generation_need() TO service_role;
GRANT EXECUTE ON FUNCTION public.create_automated_content_batch(jsonb, text, text) TO service_role;
