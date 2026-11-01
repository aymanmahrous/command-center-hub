-- A receipt starts as pending in the current schema; gate it before any publisher call.
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
  IF NEW.status IN ('pending', 'reserved', 'container_created')
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
