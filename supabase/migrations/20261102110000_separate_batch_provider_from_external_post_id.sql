-- Keep the internal content-batch provider marker out of the external post ID field.
-- The marker remains in the batch audit record; content_items.provider_external_id
-- is reserved for a real provider post ID returned after successful publication.

DO $migration$
DECLARE
  v_definition text;
  v_old text := $old$      nullif(btrim(coalesce(p_provider_external_id, '')), ''),$old$;
  v_new text := $new$      NULL,$new$;
BEGIN
  SELECT pg_get_functiondef(
    'public.create_staff_generated_content_batch(jsonb,text)'::regprocedure
  ) INTO v_definition;

  IF position(v_old IN v_definition) = 0 THEN
    RAISE EXCEPTION 'EXPECTED_BATCH_PROVIDER_ASSIGNMENT_NOT_FOUND';
  END IF;

  v_definition := replace(v_definition, v_old, v_new);
  EXECUTE v_definition;
END;
$migration$;

-- This exact value is the application's stable batch-source marker, not a
-- Facebook/Instagram post ID. Clearing it makes historical generated items
-- eligible for proper review, but does not approve, schedule, or publish them.
UPDATE public.content_items
SET provider_external_id = NULL,
    updated_at = now()
WHERE provider_external_id = 'command-center-coach-ayman-2026';
