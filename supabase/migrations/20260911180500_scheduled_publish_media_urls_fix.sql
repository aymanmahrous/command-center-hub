-- Fix scheduled Instagram posts: Meta Graph cannot fetch Google Drive URLs.
-- Point media_url at Supabase Storage and allow Meta to read scheduled publish assets.

UPDATE storage.buckets
SET public = true
WHERE id = 'relax-fix-media';

DROP POLICY IF EXISTS "Public read scheduled instagram publish media" ON storage.objects;

CREATE POLICY "Public read scheduled instagram publish media"
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
      AND ci.platform = 'instagram'
      AND ma.storage_path = name
  )
);

UPDATE public.content_items AS ci
SET
  media_url = 'https://nmzxrjdxvmmzzmajrskm.supabase.co/storage/v1/object/public/relax-fix-media/' || ma.storage_path,
  updated_at = now()
FROM public.media_assets ma
WHERE ma.content_item_id = ci.id
  AND ci.status = 'scheduled'
  AND ci.platform = 'instagram'
  AND ma.storage_path IS NOT NULL;

DELETE FROM public.content_publication_receipts
WHERE content_item_id IN (
  SELECT id FROM public.content_items
  WHERE status = 'scheduled' AND platform = 'instagram'
)
AND status = 'failed'
AND external_post_id IS NULL;
