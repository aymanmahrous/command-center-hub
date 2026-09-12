-- Wire schedule honesty + preferred-pool persistence into process_ai_sales_concierge_turn.

DO $$
DECLARE
  f text;
  prior_old text := $p$v_prior_state := case
    when coalesce(v_lead.intent, '') like 'concierge:%' then substring(v_lead.intent from 11)
    else 'greeting'
  end;
  v_state := v_prior_state;$p$;
  prior_new text := $p$v_prior_raw := case
    when coalesce(v_lead.intent, '') like 'concierge:%' then substring(v_lead.intent from 11)
    else 'greeting'
  end;
  v_prior_state := split_part(v_prior_raw, '__', 1);
  v_preferred_pool := nullif(split_part(v_prior_raw, '__', 2), '');
  v_state := v_prior_state;$p$;
  loc_old text := $l$elsif coalesce((public.rf_location_turn(v_language, v_body, v_prior_state)->>'handled')::boolean, false) then
    v_state := public.rf_location_turn(v_language, v_body, v_prior_state)->>'state';
    v_draft := public.rf_location_turn(v_language, v_body, v_prior_state)->>'draft';
    v_score := v_score + coalesce((public.rf_location_turn(v_language, v_body, v_prior_state)->>'scoreDelta')::integer, 0);
    v_stage := case when v_stage = 'new' then 'contacted' else v_stage end;
    v_processed := true;$l$;
  loc_new text := $l$elsif coalesce((public.rf_schedule_turn(v_language, v_body, v_prior_state, v_preferred_pool, v_service)->>'handled')::boolean, false) then
    v_sched := public.rf_schedule_turn(v_language, v_body, v_prior_state, v_preferred_pool, v_service);
    v_state := v_sched->>'state';
    v_draft := v_sched->>'draft';
    v_score := v_score + coalesce((v_sched->>'scoreDelta')::integer, 0);
    if coalesce(v_sched->>'preferredPoolId','') <> '' then
      v_preferred_pool := v_sched->>'preferredPoolId';
    end if;
    if coalesce(v_sched->>'service','') <> '' then
      v_service := v_sched->>'service';
    end if;
    v_stage := case when v_stage = 'new' then 'contacted' when v_stage = 'contacted' then 'qualified' else v_stage end;
    v_processed := true;

  elsif coalesce((public.rf_location_turn(v_language, v_body, v_prior_state)->>'handled')::boolean, false) then
    v_loc := public.rf_location_turn(v_language, v_body, v_prior_state);
    v_state := v_loc->>'state';
    v_draft := v_loc->>'draft';
    v_score := v_score + coalesce((v_loc->>'scoreDelta')::integer, 0);
    if coalesce(v_loc->>'nearestPoolId','') <> '' then
      v_preferred_pool := v_loc->>'nearestPoolId';
    end if;
    v_stage := case when v_stage = 'new' then 'contacted' else v_stage end;
    v_processed := true;$l$;
  intent_old text := $i$intent = 'concierge:' || v_state,$i$;
  intent_new text := $i$intent = 'concierge:' || v_state || case when coalesce(v_preferred_pool,'') <> '' then '__' || v_preferred_pool else '' end,$i$;
  ret_old text := $r$'intent', 'concierge:' || v_state,$r$;
  ret_new text := $r$'intent', 'concierge:' || v_state || case when coalesce(v_preferred_pool,'') <> '' then '__' || v_preferred_pool else '' end,$r$;
  decl_old text := $d$v_count text;
  v_pricing text;
begin$d$;
  decl_new text := $d$v_count text;
  v_pricing text;
  v_preferred_pool text;
  v_prior_raw text;
  v_sched jsonb;
  v_loc jsonb;
begin$d$;
BEGIN
  f := pg_get_functiondef('public.process_ai_sales_concierge_turn(uuid,uuid)'::regprocedure);

  IF position('rf_schedule_turn' in f) > 0 THEN
    RAISE NOTICE 'schedule turn already wired';
    RETURN;
  END IF;

  IF position(decl_old in f) = 0 THEN
    RAISE EXCEPTION 'declare block not found for schedule patch';
  END IF;
  f := replace(f, decl_old, decl_new);

  IF position(prior_old in f) = 0 THEN
    RAISE EXCEPTION 'prior_state parse block not found';
  END IF;
  f := replace(f, prior_old, prior_new);

  IF position(loc_old in f) = 0 THEN
    RAISE EXCEPTION 'location turn block not found';
  END IF;
  f := replace(f, loc_old, loc_new);

  IF position(intent_old in f) = 0 THEN
    RAISE EXCEPTION 'lead intent assign not found';
  END IF;
  f := replace(f, intent_old, intent_new);

  IF position(ret_old in f) = 0 THEN
    RAISE EXCEPTION 'return intent field not found';
  END IF;
  f := replace(f, ret_old, ret_new);

  EXECUTE f;
END $$;
