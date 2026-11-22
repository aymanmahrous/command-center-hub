-- The Edge Function has already authenticated the staff session. Only its
-- service role may take a reservation or report a provider response.
CREATE FUNCTION public.reserve_manual_meta_publication(
  p_content_item_id uuid, p_platform text, p_media_asset_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_receipt_id uuid;
BEGIN
  PERFORM 1 FROM public.content_items
  WHERE id = p_content_item_id AND status = 'approved'
    AND lower(platform) = p_platform AND p_platform IN ('facebook', 'instagram')
    AND media_asset_id = p_media_asset_id AND published_at IS NULL
    AND nullif(btrim(provider_external_id), '') IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('created', false, 'code', 'CONTENT_NOT_READY');
  END IF;
  IF EXISTS (SELECT 1 FROM public.background_jobs WHERE job_type = 'publish_content'
             AND payload->>'contentItemId' = p_content_item_id::text
             AND status IN ('queued','processing','retrying')) THEN
    RETURN jsonb_build_object('created', false, 'code', 'ACTIVE_AUTHORIZATION_EXISTS');
  END IF;

  -- The trigger checks the linked media. Honor historical platform casing and
  -- use the shared unique key as the arbiter for concurrent new reservations.
  INSERT INTO public.content_publication_receipts (content_item_id, platform, provider, status)
  SELECT p_content_item_id, p_platform, 'meta-graph-publishing', 'reserved'
  WHERE NOT EXISTS (SELECT 1 FROM public.content_publication_receipts
                    WHERE content_item_id = p_content_item_id AND lower(platform) = p_platform)
  ON CONFLICT (content_item_id, platform) DO NOTHING
  RETURNING id INTO v_receipt_id;
  IF v_receipt_id IS NULL THEN
    RETURN jsonb_build_object('created', false, 'code', 'RECEIPT_EXISTS');
  END IF;
  RETURN jsonb_build_object('created', true, 'receiptId', v_receipt_id);
END;
$$;

CREATE FUNCTION public.finish_manual_meta_publication(
  p_content_item_id uuid, p_platform text, p_receipt_id uuid, p_staff_id uuid,
  p_external_post_id text, p_error_code text
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  v_published boolean := nullif(btrim(p_external_post_id), '') IS NOT NULL;
  v_status public.content_publication_receipts.status%TYPE;
BEGIN
  IF v_published = (nullif(btrim(p_error_code), '') IS NOT NULL)
     OR NOT EXISTS (SELECT 1 FROM public.staff_profiles WHERE id = p_staff_id AND active
                    AND role IN ('super_admin','admin','content_manager')) THEN
    RETURN false;
  END IF;
  PERFORM 1 FROM public.content_items WHERE id = p_content_item_id AND status = 'approved'
    AND lower(platform) = p_platform AND published_at IS NULL
    AND nullif(btrim(provider_external_id), '') IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  v_status := CASE WHEN v_published THEN 'published' ELSE 'failed' END;
  UPDATE public.content_publication_receipts
  SET status = v_status,
      external_post_id = p_external_post_id, last_error = p_error_code, updated_at = now()
  WHERE id = p_receipt_id AND content_item_id = p_content_item_id AND platform = p_platform
    AND provider = 'meta-graph-publishing' AND status = 'reserved'
    AND authorization_id IS NULL AND publish_job_id IS NULL AND external_post_id IS NULL;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_published THEN
    UPDATE public.content_items SET status = 'published', provider_external_id = p_external_post_id,
      published_at = now(), updated_at = now() WHERE id = p_content_item_id;
  ELSE
    UPDATE public.content_items SET status = 'failed', updated_at = now() WHERE id = p_content_item_id;
  END IF;
  INSERT INTO public.audit_logs (actor_id, actor_type, action, entity_type, entity_id, detail)
  VALUES (p_staff_id, 'user', CASE WHEN v_published THEN 'content_published' ELSE 'content_publish_failed' END,
    'content_item', p_content_item_id, jsonb_strip_nulls(jsonb_build_object(
      'platform', p_platform, 'provider', 'meta-graph-publishing', 'source', 'safe-content-publisher',
      'receiptId', p_receipt_id, 'providerExternalId', p_external_post_id, 'errorCode', p_error_code)));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_manual_meta_publication(uuid,text,uuid),
  public.finish_manual_meta_publication(uuid,text,uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_manual_meta_publication(uuid,text,uuid),
  public.finish_manual_meta_publication(uuid,text,uuid,uuid,text,text) TO service_role;
NOTIFY pgrst, 'reload schema';
