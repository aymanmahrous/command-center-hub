-- Wire location helper into AI sales concierge turn (replace old location→handoff).

DO $$
DECLARE
  f text;
  old text := $old$elsif v_body ~* '(where|location|address|map|place|are you located|فين|وين|موقع|عنوان|مكان|الموقع)' then
    v_lock_human := true;
    v_state := 'human_handoff';
    v_draft := case when v_language = 'ar'
      then 'ما عندي الموقع الدقيق محفوظ هنا. سأوصلك بالكوتش أيمن لتفاصيل موقع التدريب الدقيقة.'
      else 'I don''t have the exact training location saved here. I''ll connect you with Coach Ayman for the precise details.'
    end;
    v_stage := case when v_stage = 'new' then 'contacted' else v_stage end;
    v_score := v_score + 10;
    v_processed := true;$old$;
  new text := $new$elsif coalesce((public.rf_location_turn(v_language, v_body, v_prior_state)->>'handled')::boolean, false) then
    v_state := public.rf_location_turn(v_language, v_body, v_prior_state)->>'state';
    v_draft := public.rf_location_turn(v_language, v_body, v_prior_state)->>'draft';
    v_score := v_score + coalesce((public.rf_location_turn(v_language, v_body, v_prior_state)->>'scoreDelta')::integer, 0);
    v_stage := case when v_stage = 'new' then 'contacted' else v_stage end;
    v_processed := true;$new$;
BEGIN
  f := pg_get_functiondef('public.process_ai_sales_concierge_turn(uuid,uuid)'::regprocedure);
  IF position(old in f) = 0 THEN
    -- Already patched or different wording — no-op if helper already referenced.
    IF position('rf_location_turn' in f) > 0 THEN
      RAISE NOTICE 'process_ai_sales_concierge_turn already uses rf_location_turn';
      RETURN;
    END IF;
    RAISE EXCEPTION 'location handoff block not found for pool-locations patch';
  END IF;
  EXECUTE replace(f, old, new);
END $$;
