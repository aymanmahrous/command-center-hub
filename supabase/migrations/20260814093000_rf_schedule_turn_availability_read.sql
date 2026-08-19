-- Wire Messenger schedule turns to rf_check_lesson_availability (READ ONLY).
-- No booking writes. No calendar event mutations.

CREATE OR REPLACE FUNCTION public.rf_sync_lesson_occupancy_from_gcal(p_events jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  ev jsonb;
  n integer := 0;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED';
  END IF;

  -- Replace mirrored Google Calendar occupancy with the latest snapshot (read-only sync).
  DELETE FROM public.rf_lesson_occupancy
  WHERE source = 'google_calendar' AND write_status = 'synced';

  FOR ev IN SELECT * FROM jsonb_array_elements(coalesce(p_events, '[]'::jsonb))
  LOOP
    INSERT INTO public.rf_lesson_occupancy (
      gcal_event_id, location_id, session_type, coach, starts_at, ends_at,
      capacity, booked_count, source, write_status
    ) VALUES (
      nullif(ev->>'id', ''),
      coalesce(nullif(ev->>'locationId', ''), 'najda-street'),
      CASE WHEN lower(coalesce(ev->>'sessionType', 'private')) = 'group' THEN 'group' ELSE 'private' END,
      coalesce(nullif(ev->>'coach', ''), 'Coach Ayman'),
      (ev->>'startsAt')::timestamptz,
      (ev->>'endsAt')::timestamptz,
      coalesce((ev->>'capacity')::integer, CASE WHEN lower(coalesce(ev->>'sessionType','')) = 'group' THEN 4 ELSE 1 END),
      coalesce((ev->>'bookedCount')::integer, 1),
      'google_calendar',
      'synced'
    )
    ON CONFLICT (gcal_event_id) DO UPDATE SET
      location_id = EXCLUDED.location_id,
      session_type = EXCLUDED.session_type,
      coach = EXCLUDED.coach,
      starts_at = EXCLUDED.starts_at,
      ends_at = EXCLUDED.ends_at,
      capacity = EXCLUDED.capacity,
      booked_count = EXCLUDED.booked_count,
      write_status = 'synced',
      updated_at = now();
    n := n + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'syncedCount', n, 'calendar', 'Relax Fix UAE Lessons');
END;
$$;

REVOKE ALL ON FUNCTION public.rf_sync_lesson_occupancy_from_gcal(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rf_sync_lesson_occupancy_from_gcal(jsonb) TO service_role;


CREATE OR REPLACE FUNCTION public.rf_schedule_turn(
  p_language text,
  p_body text,
  p_prior_state text,
  p_preferred_pool_id text DEFAULT NULL,
  p_service text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  schedule_intent boolean;
  booking_ask boolean;
  area jsonb;
  nearest jsonb;
  pool jsonb;
  pool_id text;
  pool_name text;
  service text := p_service;
  target_date date;
  hour_hint integer;
  candidate timestamptz;
  candidates timestamptz[] := ARRAY[]::timestamptz[];
  check_res jsonb;
  available jsonb := '[]'::jsonb;
  partials jsonb := '[]'::jsonb;
  outside_count integer := 0;
  booked_count_n integer := 0;
  draft text;
  location_also boolean;
  nearest_draft text;
  i integer;
  hm text;
  slot_line text;
  ask_one text;
  dow integer;
  open_h integer;
  close_h integer;
  h integer;
  m integer;
BEGIN
  booking_ask := p_body ~* '(^|\\s)(احجز|احجزي|أحجز|book\\s+(it|me|this|please)|reserve\\s+(it|me)|confirm\\s+(the\\s+)?booking)(\\s|$)|أريد الحجز|ابي احجز|أبي أحجز';

  schedule_intent := p_body ~* '(available|availability|slot|schedule|tomorrow|saturday|sunday|monday|tuesday|wednesday|thursday|friday|morning|evening|afternoon|after[[:space:]]*[[:digit:]]|at[[:space:]]*[[:digit:]]|موعد|بكرة|بكرا|غدا|غدًا|السبت|سبت|الأحد|الاحد|أحد|احد|اثنين|ثلاثاء|اربعاء|خميس|جمعة|صباح|مساء|بعد[[:space:]]*[[:digit:]]|الساعة|الساعه|متاح|توفر|فيه[[:space:]]*حصة|after[[:space:]]*sunset|مغرب|next[[:space:]]*week|الأسبوع|الاسبوع)';

  -- Booking confirmation request: READ ONLY — never write.
  IF booking_ask AND (p_prior_state LIKE 'schedule%' OR schedule_intent OR p_prior_state IN ('presented_nearest_pool', 'booking_ask_timing', 'booking_handoff')) THEN
    draft := CASE WHEN p_language = 'ar'
      THEN 'تمام — استلمت رغبتك بالحجز. في هذه المرحلة أقدر أعرض لك التوفر الحقيقي فقط، وتأكيد الحجز النهائي يحتاج خطوة تأكيد منفصلة مع الكوتش أيمن (ما راح أنفّذ الحجز تلقائيًا الآن).'
      ELSE 'Got it — I understand you want to book. At this stage I can only show real availability; final booking confirmation still needs a separate confirmation with Coach Ayman (I will not create a booking automatically now).'
    END;
    RETURN jsonb_build_object(
      'handled', true,
      'state', 'schedule_confirm_needed',
      'draft', draft,
      'scoreDelta', 5,
      'preferredPoolId', nullif(p_preferred_pool_id, ''),
      'service', service,
      'canConfirmSlot', false,
      'bookingWriteUsed', false
    );
  END IF;

  IF NOT schedule_intent THEN
    RETURN jsonb_build_object('handled', false);
  END IF;

  IF p_body ~* '(private|individual|one[[:space:]-]?on[[:space:]-]?one|خاص|فردي|حصة خاصة|بريفت|برايفت)' THEN
    service := 'private';
  ELSIF p_body ~* '(group|family|جروب|مجموعة|عائلة|جماعي)' THEN
    service := 'group';
  END IF;

  area := public.rf_match_customer_area(p_body);
  pool_id := nullif(p_preferred_pool_id, '');
  IF area IS NOT NULL THEN
    nearest := public.rf_nearest_pool(area);
    pool := nearest->'pool';
    IF pool IS NOT NULL THEN
      pool_id := pool->>'id';
    END IF;
  ELSIF pool_id IS NOT NULL THEN
    SELECT p INTO pool
    FROM jsonb_array_elements(public.rf_training_pools()) p
    WHERE p->>'id' = pool_id
    LIMIT 1;
  END IF;

  -- Explicit location names in schedule phrasing
  IF pool_id IS NULL THEN
    IF p_body ~* '(najda|نجدة|النجدة|الدانة)' THEN pool_id := 'najda-street';
    ELSIF p_body ~* '(falah|الفلاح)' THEN pool_id := 'ics-al-falah';
    ELSIF p_body ~* '(khalifa|خليفة|خليفه)' THEN pool_id := 'ics-khalifa';
    ELSIF p_body ~* '(mushrif|مشرف|المشرف)' THEN pool_id := 'ics-mushrif';
    END IF;
    IF pool_id IS NOT NULL THEN
      SELECT p INTO pool
      FROM jsonb_array_elements(public.rf_training_pools()) p
      WHERE p->>'id' = pool_id
      LIMIT 1;
    END IF;
  END IF;

  IF pool IS NOT NULL THEN
    pool_name := CASE WHEN p_language = 'ar' THEN pool->>'nameAr' ELSE pool->>'name' END;
  END IF;

  -- Ask one missing question when required (no guessing).
  IF pool_id IS NULL THEN
    ask_one := CASE WHEN p_language = 'ar'
      THEN 'أكيد — عشان أراجع التوفر الحقيقي، أنت تقصد أي موقع: النجدة، الفلاح، خليفة، ولا المشرف؟'
      ELSE 'Sure — which location should I check for real availability: Najda, Al Falah, Khalifa, or Mushrif?'
    END;
    RETURN jsonb_build_object(
      'handled', true,
      'state', 'schedule_need_location',
      'draft', ask_one,
      'scoreDelta', 0,
      'preferredPoolId', null,
      'service', service,
      'canConfirmSlot', false,
      'bookingWriteUsed', false
    );
  END IF;

  IF service IS NULL OR service NOT IN ('private', 'group') THEN
    ask_one := CASE WHEN p_language = 'ar'
      THEN 'تمام — التوفر يختلف حسب نوع الحصة. تبي حصة خاصة ولا جماعية؟'
      ELSE 'Got it — availability depends on the lesson type. Private or group?'
    END;
    RETURN jsonb_build_object(
      'handled', true,
      'state', 'schedule_need_service',
      'draft', ask_one,
      'scoreDelta', 0,
      'preferredPoolId', pool_id,
      'service', null,
      'canConfirmSlot', false,
      'bookingWriteUsed', false
    );
  END IF;

  -- Resolve target date in Asia/Dubai
  IF p_body ~* '(tomorrow|بكرة|بكرا|غدا|غدًا)' THEN
    target_date := (timezone('Asia/Dubai', now()))::date + 1;
  ELSIF p_body ~* '(next[[:space:]]*week|الأسبوع[[:space:]]*الجاي|الاسبوع[[:space:]]*القادم|الأسبوع[[:space:]]*القادم)' THEN
    target_date := (timezone('Asia/Dubai', now()))::date + 7;
  ELSIF p_body ~* '(saturday|السبت|سبت)' THEN
    target_date := (timezone('Asia/Dubai', now()))::date
      + ((6 - extract(dow from timezone('Asia/Dubai', now()))::integer + 7) % 7);
    IF target_date = (timezone('Asia/Dubai', now()))::date AND p_body !~* '(today|اليوم)' THEN
      target_date := target_date + 7;
    END IF;
  ELSIF p_body ~* '(sunday|الأحد|الاحد|أحد|احد)' THEN
    target_date := (timezone('Asia/Dubai', now()))::date
      + ((0 - extract(dow from timezone('Asia/Dubai', now()))::integer + 7) % 7);
    IF target_date = (timezone('Asia/Dubai', now()))::date THEN target_date := target_date + 7; END IF;
  ELSIF p_body ~* '(monday|الإثنين|الاثنين)' THEN
    target_date := (timezone('Asia/Dubai', now()))::date
      + ((1 - extract(dow from timezone('Asia/Dubai', now()))::integer + 7) % 7);
    IF target_date = (timezone('Asia/Dubai', now()))::date THEN target_date := target_date + 7; END IF;
  ELSIF p_body ~* '(friday|الجمعة|جمعه)' THEN
    target_date := (timezone('Asia/Dubai', now()))::date
      + ((5 - extract(dow from timezone('Asia/Dubai', now()))::integer + 7) % 7);
    IF target_date = (timezone('Asia/Dubai', now()))::date THEN target_date := target_date + 7; END IF;
  ELSE
    -- Default: tomorrow when schedule intent has no day (still one concrete day to check)
    target_date := (timezone('Asia/Dubai', now()))::date + 1;
  END IF;

  hour_hint := NULL;
  IF p_body ~* '(after|بعد)[[:space:]]*[[:digit:]]{1,2}' THEN
    hour_hint := (regexp_match(p_body, '(?:after|بعد)[[:space:]]*([[:digit:]]{1,2})', 'i'))[1]::integer;
    IF hour_hint <= 12 AND p_body ~* '(مساء|evening|pm|مغرب)' THEN
      IF hour_hint < 12 THEN hour_hint := hour_hint + 12; END IF;
    ELSIF hour_hint <= 6 AND p_body ~* 'بعد' THEN
      hour_hint := hour_hint + 12;
    END IF;
  ELSIF p_body ~* '(مغرب|after[[:space:]]*sunset)' THEN
    hour_hint := 19;
  ELSIF p_body ~* '(evening|مساء|night|ليل)' THEN
    hour_hint := 18;
  ELSIF p_body ~* '(afternoon|ظهر)' THEN
    hour_hint := 16;
  ELSIF p_body ~* '(morning|صباح)' THEN
    hour_hint := 10;
  END IF;

  dow := extract(dow from target_date)::integer;
  IF dow IN (0, 6) THEN open_h := 10; close_h := 22; ELSE open_h := 16; close_h := 21; END IF;

  -- Build candidate starts (45-min lessons). Only check real times; never invent booked ones.
  IF hour_hint IS NOT NULL THEN
    h := hour_hint;
    WHILE h <= close_h - 1 LOOP
      FOREACH m IN ARRAY ARRAY[0, 45] LOOP
        IF (h * 60 + m) >= open_h * 60 AND (h * 60 + m + 45) <= close_h * 60 THEN
          candidate := ((target_date::text || ' ' || lpad(h::text, 2, '0') || ':' || lpad(m::text, 2, '0') || ':00')::timestamp AT TIME ZONE 'Asia/Dubai');
          candidates := candidates || candidate;
        END IF;
      END LOOP;
      h := h + 1;
      IF array_length(candidates, 1) >= 6 THEN EXIT; END IF;
    END LOOP;
  ELSE
    -- Day-level ask: check a small set of standard starts inside the window
    FOREACH hm IN ARRAY CASE
      WHEN dow IN (0, 6) THEN ARRAY['10:00', '12:00', '16:00', '18:00', '19:30']
      ELSE ARRAY['16:00', '17:00', '18:00', '19:00', '19:30']
    END
    LOOP
      candidate := ((target_date::text || ' ' || hm || ':00')::timestamp AT TIME ZONE 'Asia/Dubai');
      candidates := candidates || candidate;
    END LOOP;
  END IF;

  IF coalesce(array_length(candidates, 1), 0) = 0 THEN
    draft := CASE WHEN p_language = 'ar'
      THEN format('حسب نافذة الحصص المعتمدة، ما قدرت أبني مواعيد للتحقق في %s. حدّد يوم/وقت داخل ساعات الحصص وسأراجع التوفر الحقيقي.', coalesce(pool_name, pool_id))
      ELSE format('I could not build checkable lesson times for %s inside the approved class windows. Share a day/time within class hours and I will check real availability.', coalesce(pool_name, pool_id))
    END;
    RETURN jsonb_build_object(
      'handled', true,
      'state', 'schedule_checked',
      'draft', draft,
      'scoreDelta', 5,
      'preferredPoolId', pool_id,
      'service', service,
      'slots', '[]'::jsonb,
      'canConfirmSlot', false,
      'bookingWriteUsed', false
    );
  END IF;

  FOR i IN 1 .. array_length(candidates, 1) LOOP
    check_res := public.rf_check_lesson_availability(pool_id, service, candidates[i], 45, 'Coach Ayman');
    IF check_res->>'status' = 'AVAILABLE' THEN
      available := available || jsonb_build_array(jsonb_build_object(
        'startsAt', check_res->>'startsAt',
        'endsAt', check_res->>'endsAt',
        'status', 'AVAILABLE',
        'availablePlaces', (check_res->>'availablePlaces')::integer,
        'capacity', (check_res->>'capacity')::integer
      ));
    ELSIF check_res->>'status' = 'PARTIALLY_AVAILABLE' THEN
      partials := partials || jsonb_build_array(jsonb_build_object(
        'startsAt', check_res->>'startsAt',
        'endsAt', check_res->>'endsAt',
        'status', 'PARTIALLY_AVAILABLE',
        'availablePlaces', (check_res->>'availablePlaces')::integer,
        'capacity', (check_res->>'capacity')::integer
      ));
    ELSIF check_res->>'status' = 'OUTSIDE_WINDOW' THEN
      outside_count := outside_count + 1;
    ELSIF check_res->>'status' = 'BOOKED' THEN
      booked_count_n := booked_count_n + 1;
    END IF;
    IF jsonb_array_length(available) >= 3 THEN
      EXIT;
    END IF;
  END LOOP;

  -- Prefer fully available, then partials (still real).
  IF jsonb_array_length(available) = 0 AND jsonb_array_length(partials) > 0 THEN
    available := partials;
  ELSIF jsonb_array_length(available) > 0 AND jsonb_array_length(partials) > 0 THEN
    available := available || partials;
  END IF;

  IF p_language = 'ar' THEN
    IF jsonb_array_length(available) = 0 THEN
      draft := format(
        'راجعت التوفر الحقيقي لموقع %s (%s) ليوم %s عبر نظام المواعيد. ما في مواعيد مطابقة متاحة حاليًا من المصدر.',
        pool_name,
        CASE WHEN service = 'private' THEN 'خاصة' ELSE 'جماعية' END,
        to_char(target_date, 'YYYY-MM-DD')
      );
    ELSE
      draft := format(
        'راجعت التوفر الحقيقي لموقع %s (%s) ليوم %s. المواعيد المتاحة من المصدر:',
        pool_name,
        CASE WHEN service = 'private' THEN 'خاصة' ELSE 'جماعية' END,
        to_char(target_date, 'YYYY-MM-DD')
      );
      FOR i IN 0 .. least(jsonb_array_length(available), 3) - 1 LOOP
        slot_line := format(
          E'\n• %s–%s (%s%s)',
          to_char((available->i->>'startsAt')::timestamptz AT TIME ZONE 'Asia/Dubai', 'HH24:MI'),
          to_char((available->i->>'endsAt')::timestamptz AT TIME ZONE 'Asia/Dubai', 'HH24:MI'),
          available->i->>'status',
          CASE WHEN available->i->>'status' = 'PARTIALLY_AVAILABLE'
            THEN format(' — متبقي %s من %s', available->i->>'availablePlaces', available->i->>'capacity')
            ELSE '' END
        );
        draft := draft || slot_line;
      END LOOP;
      draft := draft || E'\nإذا حاب تحجز أحد هذه المواعيد، قلّي وأحوّل للتأكيد البشري بدون تنفيذ حجز تلقائي.';
    END IF;
  ELSE
    IF jsonb_array_length(available) = 0 THEN
      draft := format(
        'I checked real availability for %s (%s) on %s from the lessons calendar. No matching open slots are available right now.',
        pool_name, service, to_char(target_date, 'YYYY-MM-DD')
      );
    ELSE
      draft := format(
        'I checked real availability for %s (%s) on %s. Open slots from the source:',
        pool_name, service, to_char(target_date, 'YYYY-MM-DD')
      );
      FOR i IN 0 .. least(jsonb_array_length(available), 3) - 1 LOOP
        slot_line := format(
          E'\n• %s–%s (%s%s)',
          to_char((available->i->>'startsAt')::timestamptz AT TIME ZONE 'Asia/Dubai', 'HH24:MI'),
          to_char((available->i->>'endsAt')::timestamptz AT TIME ZONE 'Asia/Dubai', 'HH24:MI'),
          available->i->>'status',
          CASE WHEN available->i->>'status' = 'PARTIALLY_AVAILABLE'
            THEN format(' — %s of %s places left', available->i->>'availablePlaces', available->i->>'capacity')
            ELSE '' END
        );
        draft := draft || slot_line;
      END LOOP;
      draft := draft || E'\nIf you want one of these times, tell me and I will route booking confirmation to Coach Ayman — I will not auto-book.';
    END IF;
  END IF;

  location_also := area IS NOT NULL AND p_body ~* '(أقرب|اقرب|nearest|closest|أين|وين|فين|location|map)';
  IF location_also AND area IS NOT NULL AND pool IS NOT NULL THEN
    IF p_language = 'ar' THEN
      nearest_draft := format(
        'أقرب موقع تدريب لك حسب بياناتنا من %s: %s (%s، أبوظبي).' || E'\n' || '%s',
        area->>'labelAr', pool->>'nameAr', pool->>'areaAr', pool->>'mapUrl'
      );
    ELSE
      nearest_draft := format(
        'Nearest Relax Fix training location from %s: %s (%s, Abu Dhabi).' || E'\n' || '%s',
        area->>'labelEn', pool->>'name', pool->>'area', pool->>'mapUrl'
      );
    END IF;
    draft := nearest_draft || E'\n\n' || draft;
  END IF;

  RETURN jsonb_build_object(
    'handled', true,
    'state', 'schedule_checked',
    'draft', draft,
    'scoreDelta', 10,
    'preferredPoolId', pool_id,
    'service', service,
    'slots', available,
    'targetDate', target_date,
    'canConfirmSlot', false,
    'bookingWriteUsed', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rf_schedule_turn(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rf_schedule_turn(text, text, text, text, text) TO service_role;
