-- Mirror scheduled Instagram content to Facebook with matching schedule and media.

DROP POLICY IF EXISTS "Public read scheduled instagram publish media" ON storage.objects;

CREATE POLICY "Public read scheduled social publish media"
ON storage.objects
FOR SELECT
TO anon, authenticated, public
USING (
  bucket_id = 'relax-fix-media'
  AND EXISTS (
    SELECT 1
    FROM public.media_assets ma
    JOIN public.content_items ci ON ci.id = ma.content_item_id
    WHERE ci.status = 'scheduled'
      AND ci.platform IN ('instagram', 'facebook')
      AND ma.storage_path = name
  )
);

WITH ig_posts AS (
  SELECT *
  FROM public.content_items
  WHERE platform = 'instagram'
    AND id IN (
      '249aa725-4e4b-4006-9681-e73de1fd958b',
      'cff7b2fb-fc5a-4f75-aeb3-5d5976b51c91',
      'e557c98c-0759-4dac-a2bf-98aff5e4b6ed',
      '2bfbe1ea-e853-4023-9609-ddcca9792dce',
      '2621acd5-4e7e-44a3-a6f4-78f780022518',
      '5deae751-cea4-4713-9a8d-dc5b6c384909'
    )
),
inserted_fb AS (
  INSERT INTO public.content_items (
    platform,
    content_type,
    status,
    scheduled_for,
    planned_for,
    topic,
    hook,
    caption,
    cta,
    hashtags,
    language,
    media_url,
    content_pillar,
    content_slot
  )
  SELECT
    'facebook',
    'social_post',
    'scheduled',
    CASE
      WHEN ig.id = '249aa725-4e4b-4006-9681-e73de1fd958b' THEN now()
      ELSE ig.scheduled_for
    END,
    NULL::timestamptz,
    'mirror_instagram:' || ig.id::text,
    ig.hook,
    trim(both FROM regexp_replace(
      concat_ws(
        E'\n\n',
        nullif(btrim(coalesce(ig.hook, '')), ''),
        nullif(btrim(coalesce(ig.caption, '')), ''),
        nullif(btrim(coalesce(ig.cta, '')), ''),
        nullif(btrim(array_to_string(ig.hashtags, ' ')), '')
      ),
      E'\n{3,}',
      E'\n\n',
      'g'
    )),
    ig.cta,
    ig.hashtags,
    ig.language,
    ig.media_url,
    ig.content_pillar,
    ig.content_slot
  FROM ig_posts ig
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.content_items existing
    WHERE existing.platform = 'facebook'
      AND existing.topic = 'mirror_instagram:' || ig.id::text
      AND existing.status IN ('scheduled', 'published')
  )
  RETURNING id, topic, scheduled_for, media_url
),
paired AS (
  SELECT
    fb.id AS facebook_content_id,
    fb.scheduled_for,
    split_part(fb.topic, ':', 2)::uuid AS instagram_content_id
  FROM inserted_fb fb
),
media_insert AS (
  INSERT INTO public.media_assets (
    content_item_id,
    asset_type,
    source,
    storage_path,
    provider,
    metadata
  )
  SELECT
    p.facebook_content_id,
    ma.asset_type,
    ma.source,
    ma.storage_path,
    ma.provider,
    coalesce(ma.metadata, '{}'::jsonb) || jsonb_build_object(
      'mirroredFromInstagram', p.instagram_content_id,
      'approval', 'APPROVED_BY_OWNER'
    )
  FROM paired p
  JOIN public.media_assets ma ON ma.content_item_id = p.instagram_content_id
  RETURNING content_item_id
)
INSERT INTO public.background_jobs (
  job_type,
  status,
  payload,
  next_retry_at,
  created_at,
  updated_at
)
SELECT
  'publish_content',
  'queued',
  jsonb_build_object(
    'contentItemId', p.facebook_content_id,
    'platform', 'facebook',
    'pageId', '1164107840123575',
    'source', 'facebook_mirror_instagram_schedule_20260911',
    'mirroredFromInstagram', p.instagram_content_id
  ),
  p.scheduled_for,
  now(),
  now()
FROM paired p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.background_jobs bj
  WHERE bj.job_type = 'publish_content'
    AND bj.payload->>'contentItemId' = p.facebook_content_id::text
    AND bj.status IN ('queued', 'retrying', 'processing')
);

INSERT INTO public.audit_logs (actor_type, action, entity_type, entity_id, detail)
SELECT
  'system',
  'facebook_mirror_instagram_schedule_created',
  'content_item',
  ci.id,
  jsonb_build_object(
    'facebookContentId', ci.id,
    'instagramContentId', split_part(ci.topic, ':', 2),
    'scheduledFor', ci.scheduled_for
  )
FROM public.content_items ci
WHERE ci.platform = 'facebook'
  AND ci.topic LIKE 'mirror_instagram:%'
  AND ci.created_at >= now() - interval '1 minute';
