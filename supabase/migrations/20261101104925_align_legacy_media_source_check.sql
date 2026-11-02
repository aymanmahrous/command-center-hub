-- Production historically constrained source to ai_generated while current generators
-- write generated. Keep both vocabularies valid during read-boundary compatibility;
-- do not rewrite historical rows or widen any lifecycle status constraints.
ALTER TABLE public.media_assets
  DROP CONSTRAINT IF EXISTS media_assets_source_check;

ALTER TABLE public.media_assets
  ADD CONSTRAINT media_assets_source_check
  CHECK (source = ANY (ARRAY[
    'upload'::text,
    'ai_generated'::text,
    'generated'::text,
    'external'::text,
    'stock'::text
  ]));
