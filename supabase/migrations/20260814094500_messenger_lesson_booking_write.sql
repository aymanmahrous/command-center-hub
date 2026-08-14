-- Messenger lesson booking write path (owner-approved test scope).
-- Recheck → capacity-safe occupancy → booking_requests + rf_lesson_bookings → GCal finalize.
-- Idempotent on inbound message id. No Meta webhook/verify/callback changes.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS schedule_draft jsonb;

CREATE TABLE IF NOT EXISTS public.rf_lesson_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  conversation_id uuid,
  lead_id uuid,
  location_id text NOT NULL,
  session_type text NOT NULL CHECK (session_type IN ('private', 'group')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  party_size integer NOT NULL CHECK (party_size >= 1 AND party_size <= 4),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  occupancy_id uuid REFERENCES public.rf_lesson_occupancy(id),
  booking_request_id uuid,
  gcal_event_id text,
  status text NOT NULL DEFAULT 'pending_gcal'
    CHECK (status IN ('pending_gcal', 'confirmed', 'failed', 'cancelled')),
  confirmation_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rf_lesson_bookings_lead_slot_idx
  ON public.rf_lesson_bookings (lead_id, location_id, starts_at);

ALTER TABLE public.rf_lesson_bookings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rf_lesson_bookings FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE public.rf_lesson_bookings TO service_role;

CREATE OR REPLACE FUNCTION public.rf_finalize_lesson_booking_gcal(
  p_booking_id uuid,
  p_gcal_event_id text,
  p_occupancy_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_row public.rf_lesson_bookings%ROWTYPE;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED';
  END IF;
  IF p_booking_id IS NULL OR btrim(coalesce(p_gcal_event_id, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  END IF;

  UPDATE public.rf_lesson_bookings
  SET gcal_event_id = p_gcal_event_id,
      status = 'confirmed',
      updated_at = now()
  WHERE id = p_booking_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'BOOKING_NOT_FOUND');
  END IF;

  UPDATE public.rf_lesson_occupancy
  SET gcal_event_id = p_gcal_event_id,
      write_status = 'synced',
      updated_at = now()
  WHERE id = coalesce(p_occupancy_id, v_row.occupancy_id);

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'CONFIRMED',
    'bookingId', v_row.id,
    'gcalEventId', p_gcal_event_id,
    'status', 'confirmed'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rf_commit_messenger_lesson_booking(
  p_idempotency_key text,
  p_conversation_id uuid,
  p_lead_id uuid,
  p_location_id text,
  p_session_type text,
  p_starts_at timestamptz,
  p_party_size integer,
  p_customer_name text,
  p_customer_phone text,
  p_language text DEFAULT 'en',
  p_confirm boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_type text := lower(trim(p_session_type));
  v_check jsonb;
  v_capacity integer;
  v_end timestamptz;
  v_places integer;
  v_need integer;
  v_occ_id uuid;
  v_booked integer;
  v_booking_id uuid;
  v_br_id uuid;
  v_existing public.rf_lesson_bookings%ROWTYPE;
  v_calendar jsonb;
  v_pool jsonb;
  v_pool_name text;
  v_phone text;
  v_norm text;
  v_confirm text;
  v_idem uuid;
  v_payload jsonb;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED';
  END IF;

  IF p_confirm IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CONFIRM_REQUIRED');
  END IF;

  IF btrim(coalesce(p_idempotency_key, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'IDEMPOTENCY_REQUIRED');
  END IF;

  SELECT * INTO v_existing
  FROM public.rf_lesson_bookings
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'code', 'DUPLICATE_IDEMPOTENT',
      'duplicate', true,
      'bookingId', v_existing.id,
      'occupancyId', v_existing.occupancy_id,
      'bookingRequestId', v_existing.booking_request_id,
      'gcalEventId', v_existing.gcal_event_id,
      'status', v_existing.status,
      'confirmationText', v_existing.confirmation_text,
      'bookingWriteUsed', true,
      'gcalPayload', NULL
    );
  END IF;

  IF v_type NOT IN ('private', 'group') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_SESSION_TYPE');
  END IF;

  v_need := CASE WHEN v_type = 'private' THEN 1 ELSE greatest(coalesce(p_party_size, 0), 0) END;
  IF v_type = 'private' THEN
    v_need := 1;
  ELSIF v_need < 1 OR v_need > 4 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PARTY_SIZE');
  END IF;

  IF char_length(btrim(coalesce(p_customer_name, ''))) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NAME_REQUIRED');
  END IF;

  v_phone := btrim(coalesce(p_customer_phone, ''));
  v_norm := regexp_replace(v_phone, '[^0-9]', '', 'g');
  IF left(v_norm, 5) = '00971' THEN v_norm := substring(v_norm from 6);
  ELSIF left(v_norm, 3) = '971' THEN v_norm := substring(v_norm from 4);
  ELSIF left(v_norm, 1) = '0' THEN v_norm := substring(v_norm from 2);
  END IF;
  v_norm := '971' || v_norm;
  IF v_norm !~ '^9715[0-9]{8}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_PHONE');
  END IF;

  -- Recheck immediately before write.
  v_check := public.rf_check_lesson_availability(p_location_id, v_type, p_starts_at, 45, 'Coach Ayman');
  IF coalesce((v_check->>'canBook')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_AVAILABLE', 'availability', v_check, 'bookingWriteUsed', false);
  END IF;

  v_places := coalesce((v_check->>'availablePlaces')::integer, 0);
  IF v_places < v_need THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_PLACES', 'availability', v_check, 'bookingWriteUsed', false);
  END IF;

  v_capacity := (v_check->>'capacity')::integer;
  v_end := (v_check->>'endsAt')::timestamptz;

  -- Capacity-safe occupancy upsert (private=1, group accumulates up to 4).
  SELECT id, booked_count INTO v_occ_id, v_booked
  FROM public.rf_lesson_occupancy
  WHERE location_id = p_location_id
    AND session_type = v_type
    AND starts_at = p_starts_at
    AND write_status IN ('pending_gcal', 'synced')
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF v_occ_id IS NOT NULL THEN
    IF v_type = 'private' OR (v_booked + v_need) > v_capacity THEN
      RETURN jsonb_build_object('ok', false, 'code', 'SLOT_TAKEN', 'availability', v_check, 'bookingWriteUsed', false);
    END IF;
    UPDATE public.rf_lesson_occupancy
    SET booked_count = booked_count + v_need,
        customer_label = coalesce(customer_label || ', ', '') || btrim(p_customer_name),
        updated_at = now()
    WHERE id = v_occ_id;
  ELSE
    INSERT INTO public.rf_lesson_occupancy (
      location_id, session_type, coach, starts_at, ends_at,
      capacity, booked_count, customer_label, source, write_status
    ) VALUES (
      p_location_id, v_type, 'Coach Ayman', p_starts_at, v_end,
      v_capacity, v_need, btrim(p_customer_name), 'google_calendar', 'pending_gcal'
    ) RETURNING id INTO v_occ_id;
  END IF;

  SELECT p INTO v_pool
  FROM jsonb_array_elements(public.rf_training_pools()) p
  WHERE p->>'id' = p_location_id
  LIMIT 1;
  v_pool_name := CASE
    WHEN p_language = 'ar' THEN coalesce(v_pool->>'nameAr', p_location_id)
    ELSE coalesce(v_pool->>'name', p_location_id)
  END;

  BEGIN
    v_idem := p_idempotency_key::uuid;
  EXCEPTION WHEN others THEN
    v_idem := NULL;
  END;
  IF v_idem IS NULL THEN
    v_idem := gen_random_uuid();
  END IF;

  INSERT INTO public.booking_requests (
    idempotency_key, full_name, phone, normalized_phone, gender, category,
    location, other_location, swam_before, fear_of_water, training_type,
    requested_date, requested_time, terms_accepted, status
  ) VALUES (
    v_idem,
    btrim(p_customer_name),
    v_phone,
    v_norm,
    'Male',
    'Adult',
    v_pool_name,
    NULL,
    false,
    false,
    CASE WHEN v_type = 'private' THEN 'Private' ELSE 'Group' END,
    (p_starts_at AT TIME ZONE 'Asia/Dubai')::date,
    (p_starts_at AT TIME ZONE 'Asia/Dubai')::time,
    true,
    'confirmed'
  ) RETURNING id INTO v_br_id;

  IF p_language = 'ar' THEN
    v_confirm := format(
      'تم تأكيد الحجز:%sالموقع: %s%sالتاريخ: %s%sالوقت: %s–%s%sنوع الحصة: %s%s%s',
      E'\n',
      v_pool_name, E'\n',
      to_char(p_starts_at AT TIME ZONE 'Asia/Dubai', 'YYYY-MM-DD'), E'\n',
      to_char(p_starts_at AT TIME ZONE 'Asia/Dubai', 'HH24:MI'),
      to_char(v_end AT TIME ZONE 'Asia/Dubai', 'HH24:MI'), E'\n',
      CASE WHEN v_type = 'private' THEN 'خاصة' ELSE 'جماعية' END, E'\n',
      CASE WHEN v_type = 'group' THEN format('عدد الأشخاص: %s', v_need) ELSE '' END
    );
  ELSE
    v_confirm := format(
      'Booking confirmed:%sLocation: %s%sDate: %s%sTime: %s–%s%sLesson type: %s%s%s',
      E'\n',
      v_pool_name, E'\n',
      to_char(p_starts_at AT TIME ZONE 'Asia/Dubai', 'YYYY-MM-DD'), E'\n',
      to_char(p_starts_at AT TIME ZONE 'Asia/Dubai', 'HH24:MI'),
      to_char(v_end AT TIME ZONE 'Asia/Dubai', 'HH24:MI'), E'\n',
      v_type, E'\n',
      CASE WHEN v_type = 'group' THEN format('People: %s', v_need) ELSE '' END
    );
  END IF;

  INSERT INTO public.rf_lesson_bookings (
    idempotency_key, conversation_id, lead_id, location_id, session_type,
    starts_at, ends_at, party_size, customer_name, customer_phone,
    occupancy_id, booking_request_id, status, confirmation_text
  ) VALUES (
    p_idempotency_key, p_conversation_id, p_lead_id, p_location_id, v_type,
    p_starts_at, v_end, v_need, btrim(p_customer_name), v_norm,
    v_occ_id, v_br_id, 'pending_gcal', v_confirm
  ) RETURNING id INTO v_booking_id;

  SELECT value INTO v_calendar FROM public.rf_schedule_config WHERE key = 'lessons_calendar';

  v_payload := jsonb_build_object(
    'occupancyId', v_occ_id,
    'bookingId', v_booking_id,
    'calendarId', v_calendar->>'calendarId',
    'summary', format('%s | %s | %s', v_type, p_location_id, 'Coach Ayman'),
    'description', format(
      'locationId=%s
sessionType=%s
coach=Coach Ayman
capacity=%s
booked=%s
customer=%s
phone=%s
bookingId=%s',
      p_location_id, v_type, v_capacity, v_need, btrim(p_customer_name), v_norm, v_booking_id
    ),
    'start', jsonb_build_object(
      'dateTime', to_char(p_starts_at AT TIME ZONE 'Asia/Dubai', 'YYYY-MM-DD"T"HH24:MI:SS'),
      'timeZone', 'Asia/Dubai'
    ),
    'end', jsonb_build_object(
      'dateTime', to_char(v_end AT TIME ZONE 'Asia/Dubai', 'YYYY-MM-DD"T"HH24:MI:SS'),
      'timeZone', 'Asia/Dubai'
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'PENDING_GCAL_WRITE',
    'duplicate', false,
    'bookingId', v_booking_id,
    'occupancyId', v_occ_id,
    'bookingRequestId', v_br_id,
    'confirmationText', v_confirm,
    'availability', v_check,
    'gcalPayload', v_payload,
    'bookingWriteUsed', true
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing
    FROM public.rf_lesson_bookings
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'ok', true,
        'code', 'DUPLICATE_IDEMPOTENT',
        'duplicate', true,
        'bookingId', v_existing.id,
        'confirmationText', v_existing.confirmation_text,
        'bookingWriteUsed', true
      );
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'DUPLICATE_REQUEST', 'bookingWriteUsed', false);
END;
$$;

REVOKE ALL ON FUNCTION public.rf_finalize_lesson_booking_gcal(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rf_commit_messenger_lesson_booking(text, uuid, uuid, text, text, timestamptz, integer, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rf_finalize_lesson_booking_gcal(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rf_commit_messenger_lesson_booking(text, uuid, uuid, text, text, timestamptz, integer, text, text, text, boolean) TO service_role;

-- Dialogue + slot selection + detail collection + executeBooking flag (write happens in process_ai).
CREATE OR REPLACE FUNCTION public.rf_schedule_booking_turn(
  p_language text,
  p_body text,
  p_prior_state text,
  p_preferred_pool_id text DEFAULT NULL,
  p_service text DEFAULT NULL,
  p_schedule_draft jsonb DEFAULT NULL,
  p_lead_name text DEFAULT NULL,
  p_lead_phone text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  schedule_intent boolean;
  booking_ask boolean;
  confirm_ask boolean;
  area jsonb;
  nearest jsonb;
  pool jsonb;
  pool_id text;
  pool_name text;
  service text := p_service;
  draft_j jsonb := coalesce(p_schedule_draft, '{}'::jsonb);
  selected timestamptz;
  party integer;
  cust_name text;
  cust_phone text;
  target_date date;
  hour_hint integer;
  candidates timestamptz[] := ARRAY[]::timestamptz[];
  check_res jsonb;
  available jsonb := '[]'::jsonb;
  partials jsonb := '[]'::jsonb;
  draft text;
  ask_one text;
  dow integer;
  open_h integer;
  close_h integer;
  h integer;
  m integer;
  i integer;
  hm text;
  std_times text[];
  hm_match text;
  starts_iso text;
BEGIN
  selected := NULLIF(draft_j->>'selectedStartsAt', '')::timestamptz;
  party := NULLIF(draft_j->>'partySize', '')::integer;
  cust_name := nullif(btrim(coalesce(draft_j->>'customerName', p_lead_name, '')), '');
  cust_phone := nullif(btrim(coalesce(draft_j->>'customerPhone', p_lead_phone, '')), '');
  IF cust_name IS NOT NULL AND cust_name ~* '^Facebook[[:space:]]+[0-9]+$' THEN
    cust_name := NULL;
  END IF;

  booking_ask := p_body ~* '(احجز|أحجز|book[[:space:]]*(me|it|this|please)|reserve|أريد الحجز|ابي احجز|أبي أحجز)';
  confirm_ask := p_body ~* '(^|[[:space:]])(yes|yeah|yep|confirm|confirmed|ok|okay|sure|go ahead|book it|احجز|أكد|تأكيد|موافق|تمام احجز)([[:space:]]|$)|confirm[[:space:]]*booking|confirm[[:space:]]*it';
  schedule_intent := p_body ~* '(available|availability|slot|schedule|tomorrow|saturday|sunday|monday|tuesday|wednesday|thursday|friday|morning|evening|afternoon|after[[:space:]]*[[:digit:]]|at[[:space:]]*[[:digit:]]|موعد|بكرة|بكرا|غدا|غدًا|السبت|سبت|الأحد|الاحد|أحد|احد|اثنين|ثلاثاء|اربعاء|خميس|جمعة|صباح|مساء|بعد[[:space:]]*[[:digit:]]|الساعة|الساعه|متاح|توفر|فيه[[:space:]]*حصة|مغرب|الأسبوع|الاسبوع|[0-2]?[0-9]:[0-5][0-9])';

  IF p_prior_state LIKE 'schedule%' THEN
    schedule_intent := true;
  END IF;

  -- Collect name
  IF p_prior_state = 'schedule_need_name' THEN
    IF char_length(btrim(p_body)) >= 2 AND p_body !~* '^(yes|ok|hey|hello|hi|احجز|book)$' THEN
      cust_name := btrim(p_body);
      draft_j := draft_j || jsonb_build_object('customerName', cust_name);
      ask_one := CASE WHEN p_language = 'ar'
        THEN 'شكرًا. أرسل رقم جوالك الإماراتي (05xxxxxxxx) لإتمام الحجز.'
        ELSE 'Thanks. Please send your UAE mobile number (05xxxxxxxx) to complete the booking.' END;
      RETURN jsonb_build_object('handled', true, 'state', 'schedule_need_phone', 'draft', ask_one,
        'preferredPoolId', draft_j->>'locationId', 'service', draft_j->>'sessionType',
        'scheduleDraft', draft_j, 'executeBooking', false, 'bookingWriteUsed', false);
    END IF;
    ask_one := CASE WHEN p_language = 'ar' THEN 'ما اسمك الكامل للحجز؟' ELSE 'What full name should I put on the booking?' END;
    RETURN jsonb_build_object('handled', true, 'state', 'schedule_need_name', 'draft', ask_one,
      'preferredPoolId', draft_j->>'locationId', 'service', draft_j->>'sessionType',
      'scheduleDraft', draft_j, 'executeBooking', false, 'bookingWriteUsed', false);
  END IF;

  -- Collect phone
  IF p_prior_state = 'schedule_need_phone' THEN
    IF regexp_replace(p_body, '[^0-9]', '', 'g') ~ '^(00971|971|0)?5[0-9]{8}$' THEN
      cust_phone := btrim(p_body);
      draft_j := draft_j || jsonb_build_object('customerPhone', cust_phone);
      IF coalesce(draft_j->>'sessionType', '') = 'group' AND party IS NULL THEN
        ask_one := CASE WHEN p_language = 'ar'
          THEN 'كم شخص في الحصة الجماعية؟ (1 إلى 4)'
          ELSE 'How many people for the group lesson? (1 to 4)' END;
        RETURN jsonb_build_object('handled', true, 'state', 'schedule_need_party', 'draft', ask_one,
          'preferredPoolId', draft_j->>'locationId', 'service', 'group',
          'scheduleDraft', draft_j, 'executeBooking', false, 'bookingWriteUsed', false);
      END IF;
      IF coalesce(draft_j->>'sessionType', '') = 'private' THEN
        party := 1;
        draft_j := draft_j || jsonb_build_object('partySize', 1);
      END IF;
      draft := CASE WHEN p_language = 'ar'
        THEN format('راجع التفاصيل قبل التأكيد:%sالموقع: %s%sالوقت: %s%sالنوع: %s%sالاسم: %s%sالجوال: %s%sاكتب "أكد الحجز" للتأكيد النهائي.',
          E'\n', draft_j->>'locationName', E'\n',
          to_char(selected AT TIME ZONE 'Asia/Dubai', 'YYYY-MM-DD HH24:MI'), E'\n',
          CASE WHEN draft_j->>'sessionType' = 'private' THEN 'خاصة' ELSE 'جماعية' END, E'\n',
          cust_name, E'\n', cust_phone, E'\n')
        ELSE format('Please review before confirm:%sLocation: %s%sTime: %s%sType: %s%sName: %s%sPhone: %s%sReply "confirm booking" to finalize.',
          E'\n', draft_j->>'locationName', E'\n',
          to_char(selected AT TIME ZONE 'Asia/Dubai', 'YYYY-MM-DD HH24:MI'), E'\n',
          draft_j->>'sessionType', E'\n', cust_name, E'\n', cust_phone, E'\n')
      END;
      RETURN jsonb_build_object('handled', true, 'state', 'schedule_await_confirm', 'draft', draft,
        'preferredPoolId', draft_j->>'locationId', 'service', draft_j->>'sessionType',
        'scheduleDraft', draft_j, 'executeBooking', false, 'bookingWriteUsed', false);
    END IF;
    ask_one := CASE WHEN p_language = 'ar'
      THEN 'رقم الجوال غير واضح. أرسل رقم إماراتي صحيح مثل 0501234567.'
      ELSE 'That phone number is unclear. Send a UAE mobile like 0501234567.' END;
    RETURN jsonb_build_object('handled', true, 'state', 'schedule_need_phone', 'draft', ask_one,
      'preferredPoolId', draft_j->>'locationId', 'service', draft_j->>'sessionType',
      'scheduleDraft', draft_j, 'executeBooking', false, 'bookingWriteUsed', false);
  END IF;

  -- Collect party size (group)
  IF p_prior_state = 'schedule_need_party' THEN
    party := CASE
      WHEN p_body ~* '\m([1-4])\M' THEN (regexp_match(p_body, '([1-4])'))[1]::int
      WHEN p_body ~* '(one|واحد)' THEN 1
      WHEN p_body ~* '(two|اثنين|اتنين)' THEN 2
      WHEN p_body ~* '(three|ثلاثة)' THEN 3
      WHEN p_body ~* '(four|أربعة|اربعة)' THEN 4
      ELSE NULL
    END;
    IF party IS NULL THEN
      ask_one := CASE WHEN p_language = 'ar' THEN 'كم شخص؟ (1-4)' ELSE 'How many people? (1-4)' END;
      RETURN jsonb_build_object('handled', true, 'state', 'schedule_need_party', 'draft', ask_one,
        'preferredPoolId', draft_j->>'locationId', 'service', 'group',
        'scheduleDraft', draft_j, 'executeBooking', false, 'bookingWriteUsed', false);
    END IF;
    draft_j := draft_j || jsonb_build_object('partySize', party);
    draft := CASE WHEN p_language = 'ar'
      THEN format('راجع قبل التأكيد:%sالموقع: %s%sالوقت: %s%sالنوع: جماعية (%s أشخاص)%sالاسم: %s%sالجوال: %s%sاكتب "أكد الحجز".',
        E'\n', draft_j->>'locationName', E'\n',
        to_char(selected AT TIME ZONE 'Asia/Dubai', 'YYYY-MM-DD HH24:MI'), E'\n',
        party, E'\n', cust_name, E'\n', cust_phone, E'\n')
      ELSE format('Review before confirm:%sLocation: %s%sTime: %s%sType: group (%s people)%sName: %s%sPhone: %s%sReply "confirm booking".',
        E'\n', draft_j->>'locationName', E'\n',
        to_char(selected AT TIME ZONE 'Asia/Dubai', 'YYYY-MM-DD HH24:MI'), E'\n',
        party, E'\n', cust_name, E'\n', cust_phone, E'\n')
    END;
    RETURN jsonb_build_object('handled', true, 'state', 'schedule_await_confirm', 'draft', draft,
      'preferredPoolId', draft_j->>'locationId', 'service', 'group',
      'scheduleDraft', draft_j, 'executeBooking', false, 'bookingWriteUsed', false);
  END IF;

  -- Final confirm → execute booking write in process_ai
  IF p_prior_state = 'schedule_await_confirm' AND (confirm_ask OR booking_ask) THEN
    IF selected IS NULL OR draft_j->>'locationId' IS NULL OR draft_j->>'sessionType' IS NULL
       OR cust_name IS NULL OR cust_phone IS NULL THEN
      draft := CASE WHEN p_language = 'ar'
        THEN 'بيانات الحجز ناقصة. سأحوّلك للمتابعة البشرية مع الكوتش أيمن.'
        ELSE 'Booking details are incomplete. I will hand this to Coach Ayman for human follow-up.' END;
      RETURN jsonb_build_object('handled', true, 'state', 'schedule_handoff', 'draft', draft,
        'preferredPoolId', draft_j->>'locationId', 'service', draft_j->>'sessionType',
        'scheduleDraft', draft_j, 'executeBooking', false, 'humanHandoff', true, 'bookingWriteUsed', false);
    END IF;
    IF draft_j->>'sessionType' = 'group' AND coalesce(party, 0) < 1 THEN
      RETURN jsonb_build_object('handled', true, 'state', 'schedule_need_party',
        'draft', CASE WHEN p_language='ar' THEN 'كم شخص؟ (1-4)' ELSE 'How many people? (1-4)' END,
        'preferredPoolId', draft_j->>'locationId', 'service', 'group',
        'scheduleDraft', draft_j, 'executeBooking', false, 'bookingWriteUsed', false);
    END IF;
    RETURN jsonb_build_object(
      'handled', true,
      'state', 'schedule_execute_booking',
      'draft', CASE WHEN p_language='ar' THEN 'جاري تأكيد الحجز بعد إعادة فحص التوفر...' ELSE 'Confirming your booking after rechecking availability...' END,
      'preferredPoolId', draft_j->>'locationId',
      'service', draft_j->>'sessionType',
      'scheduleDraft', draft_j,
      'executeBooking', true,
      'bookingWriteUsed', false,
      'selectedStartsAt', selected,
      'partySize', coalesce(party, 1),
      'customerName', cust_name,
      'customerPhone', cust_phone
    );
  END IF;

  IF p_prior_state = 'schedule_await_confirm' THEN
    draft := CASE WHEN p_language='ar'
      THEN 'للتأكيد النهائي اكتب "أكد الحجز". لأي تعديل، حدّد المطلوب أو اطلب التحويل البشري.'
      ELSE 'To finalize, reply "confirm booking". To change details, say what to update or ask for a human.' END;
    RETURN jsonb_build_object('handled', true, 'state', 'schedule_await_confirm', 'draft', draft,
      'preferredPoolId', draft_j->>'locationId', 'service', draft_j->>'sessionType',
      'scheduleDraft', draft_j, 'executeBooking', false, 'bookingWriteUsed', false);
  END IF;

  -- Slot selection after availability presented
  IF p_prior_state = 'schedule_checked' AND (
       p_body ~* '[0-2]?[0-9]:[0-5][0-9]'
       OR p_body ~* '(first|الأول|اول موعد|هذا|this one|book[[:space:]]*[0-2]?[0-9])'
       OR booking_ask
     ) THEN
    pool_id := coalesce(nullif(p_preferred_pool_id, ''), draft_j->>'locationId');
    service := coalesce(service, draft_j->>'sessionType');
    starts_iso := draft_j->>'selectedStartsAt';
    hm_match := (regexp_match(p_body, '([0-2]?[0-9]:[0-5][0-9])'))[1];
    IF hm_match IS NOT NULL AND draft_j ? 'slots' THEN
      FOR i IN 0..greatest(jsonb_array_length(draft_j->'slots')-1, -1) LOOP
        IF to_char(((draft_j->'slots'->i->>'startsAt')::timestamptz AT TIME ZONE 'Asia/Dubai'), 'HH24:MI') = lpad(split_part(hm_match,':',1),2,'0') || ':' || split_part(hm_match,':',2)
           OR to_char(((draft_j->'slots'->i->>'startsAt')::timestamptz AT TIME ZONE 'Asia/Dubai'), 'HH24:MI') = hm_match THEN
          selected := (draft_j->'slots'->i->>'startsAt')::timestamptz;
          EXIT;
        END IF;
      END LOOP;
    ELSIF draft_j ? 'slots' AND jsonb_array_length(draft_j->'slots') > 0 THEN
      selected := (draft_j->'slots'->0->>'startsAt')::timestamptz;
    END IF;

    IF selected IS NULL THEN
      draft := CASE WHEN p_language='ar'
        THEN 'حدد وقتًا من المواعيد المتاحة (مثل 18:00) أو اطلب التحويل البشري.'
        ELSE 'Please pick a time from the available slots (e.g. 18:00), or ask for a human handoff.' END;
      RETURN jsonb_build_object('handled', true, 'state', 'schedule_checked', 'draft', draft,
        'preferredPoolId', pool_id, 'service', service, 'scheduleDraft', draft_j,
        'executeBooking', false, 'bookingWriteUsed', false);
    END IF;

    -- Recheck selected slot before collecting details
    check_res := public.rf_check_lesson_availability(pool_id, service, selected, 45, 'Coach Ayman');
    IF coalesce((check_res->>'canBook')::boolean, false) IS NOT TRUE THEN
      draft := CASE WHEN p_language='ar'
        THEN 'هذا الموعد لم يعد متاحًا. أراجع أقرب مواعيد حقيقية أخرى...'
        ELSE 'That slot is no longer available. Checking other real open slots...' END;
      -- fall through to availability search below by clearing prior gate
    ELSE
      SELECT p INTO pool FROM jsonb_array_elements(public.rf_training_pools()) p WHERE p->>'id'=pool_id LIMIT 1;
      pool_name := CASE WHEN p_language='ar' THEN pool->>'nameAr' ELSE pool->>'name' END;
      draft_j := jsonb_build_object(
        'locationId', pool_id,
        'locationName', pool_name,
        'sessionType', service,
        'selectedStartsAt', selected,
        'slots', draft_j->'slots'
      );
      IF cust_name IS NULL THEN
        ask_one := CASE WHEN p_language='ar' THEN 'تمام. ما اسمك الكامل للحجز؟' ELSE 'Great. What full name should I put on the booking?' END;
        RETURN jsonb_build_object('handled', true, 'state', 'schedule_need_name', 'draft', ask_one,
          'preferredPoolId', pool_id, 'service', service, 'scheduleDraft', draft_j,
          'executeBooking', false, 'bookingWriteUsed', false);
      END IF;
      IF cust_phone IS NULL THEN
        draft_j := draft_j || jsonb_build_object('customerName', cust_name);
        ask_one := CASE WHEN p_language='ar' THEN 'أرسل رقم جوالك الإماراتي (05xxxxxxxx).' ELSE 'Please send your UAE mobile (05xxxxxxxx).' END;
        RETURN jsonb_build_object('handled', true, 'state', 'schedule_need_phone', 'draft', ask_one,
          'preferredPoolId', pool_id, 'service', service, 'scheduleDraft', draft_j,
          'executeBooking', false, 'bookingWriteUsed', false);
      END IF;
      draft_j := draft_j || jsonb_build_object('customerName', cust_name, 'customerPhone', cust_phone);
      IF service = 'group' THEN
        ask_one := CASE WHEN p_language='ar' THEN 'كم شخص؟ (1-4)' ELSE 'How many people? (1-4)' END;
        RETURN jsonb_build_object('handled', true, 'state', 'schedule_need_party', 'draft', ask_one,
          'preferredPoolId', pool_id, 'service', service, 'scheduleDraft', draft_j,
          'executeBooking', false, 'bookingWriteUsed', false);
      END IF;
      draft_j := draft_j || jsonb_build_object('partySize', 1);
      draft := CASE WHEN p_language='ar'
        THEN format('راجع قبل التأكيد:%sالموقع: %s%sالوقت: %s%sالنوع: خاصة%sالاسم: %s%sالجوال: %s%sاكتب "أكد الحجز".',
          E'\n', pool_name, E'\n', to_char(selected AT TIME ZONE 'Asia/Dubai','YYYY-MM-DD HH24:MI'), E'\n', E'\n', cust_name, E'\n', cust_phone, E'\n')
        ELSE format('Review before confirm:%sLocation: %s%sTime: %s%sType: private%sName: %s%sPhone: %s%sReply "confirm booking".',
          E'\n', pool_name, E'\n', to_char(selected AT TIME ZONE 'Asia/Dubai','YYYY-MM-DD HH24:MI'), E'\n', E'\n', cust_name, E'\n', cust_phone, E'\n')
      END;
      RETURN jsonb_build_object('handled', true, 'state', 'schedule_await_confirm', 'draft', draft,
        'preferredPoolId', pool_id, 'service', service, 'scheduleDraft', draft_j,
        'executeBooking', false, 'bookingWriteUsed', false);
    END IF;
  END IF;

  -- Bare book ask without slot → do not write
  IF booking_ask AND selected IS NULL AND p_prior_state NOT IN ('schedule_await_confirm', 'schedule_execute_booking') THEN
    draft := CASE WHEN p_language='ar'
      THEN 'قبل الحجز لازم نحدد الموقع ونوع الحصة والوقت من التوفر الحقيقي. قلّي اليوم/الوقت المطلوب لأراجع التقويم.'
      ELSE 'Before booking I need location, lesson type, and a real open slot. Tell me the day/time and I will check the calendar.' END;
    RETURN jsonb_build_object('handled', true, 'state', 'schedule_need_service', 'draft', draft,
      'preferredPoolId', nullif(p_preferred_pool_id,''), 'service', service,
      'scheduleDraft', draft_j, 'executeBooking', false, 'bookingWriteUsed', false);
  END IF;

  IF NOT schedule_intent THEN
    RETURN jsonb_build_object('handled', false);
  END IF;

  IF p_body ~* '(private|individual|one[[:space:]-]?on[[:space:]-]?one|خاص|فردي|حصة خاصة|بريفت|برايفت)' THEN service := 'private';
  ELSIF p_body ~* '(group|family|جروب|مجموعة|عائلة|جماعي)' THEN service := 'group'; END IF;

  area := public.rf_match_customer_area(p_body);
  pool_id := nullif(p_preferred_pool_id, '');
  IF area IS NOT NULL THEN
    nearest := public.rf_nearest_pool(area); pool := nearest->'pool';
    IF pool IS NOT NULL THEN pool_id := pool->>'id'; END IF;
  ELSIF pool_id IS NOT NULL THEN
    SELECT p INTO pool FROM jsonb_array_elements(public.rf_training_pools()) p WHERE p->>'id'=pool_id LIMIT 1;
  END IF;

  IF pool_id IS NULL THEN
    IF p_body ~* '(najda|نجدة|النجدة|الدانة)' THEN pool_id := 'najda-street';
    ELSIF p_body ~* '(falah|الفلاح)' THEN pool_id := 'ics-al-falah';
    ELSIF p_body ~* '(khalifa|خليفة|خليفه)' THEN pool_id := 'ics-khalifa';
    ELSIF p_body ~* '(mushrif|مشرف|المشرف)' THEN pool_id := 'ics-mushrif'; END IF;
    IF pool_id IS NOT NULL THEN
      SELECT p INTO pool FROM jsonb_array_elements(public.rf_training_pools()) p WHERE p->>'id'=pool_id LIMIT 1;
    END IF;
  END IF;
  IF pool IS NOT NULL THEN pool_name := CASE WHEN p_language='ar' THEN pool->>'nameAr' ELSE pool->>'name' END; END IF;

  IF pool_id IS NULL THEN
    ask_one := CASE WHEN p_language='ar'
      THEN 'أكيد — عشان أراجع التوفر الحقيقي، أي موقع تقصد: النجدة، الفلاح، خليفة، ولا المشرف؟'
      ELSE 'Sure — which location should I check: Najda, Al Falah, Khalifa, or Mushrif?' END;
    RETURN jsonb_build_object('handled', true, 'state', 'schedule_need_location', 'draft', ask_one,
      'preferredPoolId', null, 'service', service, 'scheduleDraft', draft_j,
      'executeBooking', false, 'bookingWriteUsed', false);
  END IF;

  IF service IS NULL OR service NOT IN ('private', 'group') THEN
    ask_one := CASE WHEN p_language='ar' THEN 'تمام — تبي حصة خاصة ولا جماعية؟' ELSE 'Got it — private or group lesson?' END;
    RETURN jsonb_build_object('handled', true, 'state', 'schedule_need_service', 'draft', ask_one,
      'preferredPoolId', pool_id, 'service', null, 'scheduleDraft', draft_j,
      'executeBooking', false, 'bookingWriteUsed', false);
  END IF;

  IF p_body ~* '(tomorrow|بكرة|بكرا|غدا|غدًا)' THEN
    target_date := (timezone('Asia/Dubai', now()))::date + 1;
  ELSIF p_body ~* '(saturday|السبت|سبت)' THEN
    target_date := (timezone('Asia/Dubai', now()))::date + ((6 - extract(dow from timezone('Asia/Dubai', now()))::int + 7) % 7);
    IF target_date = (timezone('Asia/Dubai', now()))::date THEN target_date := target_date + 7; END IF;
  ELSIF p_body ~* '(sunday|الأحد|الاحد|أحد|احد)' THEN
    target_date := (timezone('Asia/Dubai', now()))::date + ((0 - extract(dow from timezone('Asia/Dubai', now()))::int + 7) % 7);
    IF target_date = (timezone('Asia/Dubai', now()))::date THEN target_date := target_date + 7; END IF;
  ELSIF p_body ~* '(monday|الإثنين|الاثنين)' THEN
    target_date := (timezone('Asia/Dubai', now()))::date + ((1 - extract(dow from timezone('Asia/Dubai', now()))::int + 7) % 7);
    IF target_date = (timezone('Asia/Dubai', now()))::date THEN target_date := target_date + 7; END IF;
  ELSIF p_body ~* '(friday|الجمعة|جمعه)' THEN
    target_date := (timezone('Asia/Dubai', now()))::date + ((5 - extract(dow from timezone('Asia/Dubai', now()))::int + 7) % 7);
    IF target_date = (timezone('Asia/Dubai', now()))::date THEN target_date := target_date + 7; END IF;
  ELSE
    target_date := (timezone('Asia/Dubai', now()))::date + 1;
  END IF;

  hour_hint := NULL;
  IF p_body ~* '(after|بعد)[[:space:]]*[[:digit:]]{1,2}' THEN
    hour_hint := (regexp_match(p_body, '(?:after|بعد)[[:space:]]*([[:digit:]]{1,2})', 'i'))[1]::int;
    IF hour_hint <= 12 AND p_body ~* '(مساء|evening|pm|مغرب)' AND hour_hint < 12 THEN hour_hint := hour_hint + 12;
    ELSIF hour_hint <= 6 AND p_body ~* 'بعد' THEN hour_hint := hour_hint + 12; END IF;
  ELSIF p_body ~* '(evening|مساء|night|ليل)' THEN hour_hint := 18;
  ELSIF p_body ~* '(morning|صباح)' THEN hour_hint := 10;
  ELSIF p_body ~* '(afternoon|ظهر)' THEN hour_hint := 16; END IF;

  dow := extract(dow from target_date)::int;
  IF dow IN (0,6) THEN open_h := 10; close_h := 22; ELSE open_h := 16; close_h := 21; END IF;

  IF hour_hint IS NOT NULL THEN
    h := greatest(hour_hint, open_h);
    WHILE h <= close_h - 1 LOOP
      FOREACH m IN ARRAY ARRAY[0,45] LOOP
        IF (h*60 + m) >= open_h*60 AND (h*60 + m + 45) <= close_h*60 THEN
          candidates := candidates || ((target_date::text || ' ' || lpad(h::text,2,'0') || ':' || lpad(m::text,2,'0') || ':00')::timestamp AT TIME ZONE 'Asia/Dubai');
        END IF;
      END LOOP;
      h := h + 1;
      EXIT WHEN coalesce(array_length(candidates,1),0) >= 6;
    END LOOP;
  ELSE
    std_times := CASE WHEN dow IN (0,6) THEN ARRAY['10:00','12:00','16:00','18:00','19:30'] ELSE ARRAY['16:00','17:00','18:00','19:00','19:30'] END;
    FOREACH hm IN ARRAY std_times LOOP
      candidates := candidates || ((target_date::text || ' ' || hm || ':00')::timestamp AT TIME ZONE 'Asia/Dubai');
    END LOOP;
  END IF;

  IF coalesce(array_length(candidates,1),0) = 0 THEN
    draft := CASE WHEN p_language='ar'
      THEN format('ما قدرت أبني مواعيد للتحقق لموقع %s داخل نافذة الحصص.', coalesce(pool_name, pool_id))
      ELSE format('No checkable times for %s inside class windows.', coalesce(pool_name, pool_id)) END;
    RETURN jsonb_build_object('handled', true, 'state', 'schedule_checked', 'draft', draft,
      'preferredPoolId', pool_id, 'service', service, 'slots', '[]'::jsonb,
      'scheduleDraft', jsonb_build_object('locationId', pool_id, 'sessionType', service, 'slots', '[]'::jsonb),
      'executeBooking', false, 'bookingWriteUsed', false);
  END IF;

  FOR i IN 1..array_length(candidates,1) LOOP
    check_res := public.rf_check_lesson_availability(pool_id, service, candidates[i], 45, 'Coach Ayman');
    IF check_res->>'status' = 'AVAILABLE' THEN
      available := available || jsonb_build_array(jsonb_build_object(
        'startsAt', check_res->>'startsAt', 'endsAt', check_res->>'endsAt', 'status', 'AVAILABLE',
        'availablePlaces', (check_res->>'availablePlaces')::int, 'capacity', (check_res->>'capacity')::int));
    ELSIF check_res->>'status' = 'PARTIALLY_AVAILABLE' THEN
      partials := partials || jsonb_build_array(jsonb_build_object(
        'startsAt', check_res->>'startsAt', 'endsAt', check_res->>'endsAt', 'status', 'PARTIALLY_AVAILABLE',
        'availablePlaces', (check_res->>'availablePlaces')::int, 'capacity', (check_res->>'capacity')::int));
    END IF;
    EXIT WHEN jsonb_array_length(available) >= 3;
  END LOOP;
  IF jsonb_array_length(available)=0 THEN available := partials;
  ELSIF jsonb_array_length(partials)>0 THEN available := available || partials; END IF;

  IF p_language='ar' THEN
    IF jsonb_array_length(available)=0 THEN
      draft := format('راجعت التوفر الحقيقي لموقع %s (%s) ليوم %s. ما في مواعيد مطابقة متاحة حاليًا.', pool_name, CASE WHEN service='private' THEN 'خاصة' ELSE 'جماعية' END, to_char(target_date,'YYYY-MM-DD'));
    ELSE
      draft := format('راجعت التوفر الحقيقي لموقع %s (%s) ليوم %s. المواعيد المتاحة من المصدر:', pool_name, CASE WHEN service='private' THEN 'خاصة' ELSE 'جماعية' END, to_char(target_date,'YYYY-MM-DD'));
      FOR i IN 0..least(jsonb_array_length(available),3)-1 LOOP
        draft := draft || format(E'\n• %s–%s (%s)', to_char((available->i->>'startsAt')::timestamptz AT TIME ZONE 'Asia/Dubai','HH24:MI'), to_char((available->i->>'endsAt')::timestamptz AT TIME ZONE 'Asia/Dubai','HH24:MI'), available->i->>'status');
      END LOOP;
      draft := draft || E'\nإذا حاب تحجز، اكتب وقت الموعد (مثل 18:00).';
    END IF;
  ELSE
    IF jsonb_array_length(available)=0 THEN
      draft := format('I checked real availability for %s (%s) on %s. No matching open slots right now.', pool_name, service, to_char(target_date,'YYYY-MM-DD'));
    ELSE
      draft := format('I checked real availability for %s (%s) on %s. Open slots from the source:', pool_name, service, to_char(target_date,'YYYY-MM-DD'));
      FOR i IN 0..least(jsonb_array_length(available),3)-1 LOOP
        draft := draft || format(E'\n• %s–%s (%s)', to_char((available->i->>'startsAt')::timestamptz AT TIME ZONE 'Asia/Dubai','HH24:MI'), to_char((available->i->>'endsAt')::timestamptz AT TIME ZONE 'Asia/Dubai','HH24:MI'), available->i->>'status');
      END LOOP;
      draft := draft || E'\nTo book, reply with a slot time (e.g. 18:00).';
    END IF;
  END IF;

  draft_j := jsonb_build_object(
    'locationId', pool_id,
    'locationName', pool_name,
    'sessionType', service,
    'slots', available,
    'targetDate', target_date
  );

  RETURN jsonb_build_object(
    'handled', true,
    'state', 'schedule_checked',
    'draft', draft,
    'scoreDelta', 10,
    'preferredPoolId', pool_id,
    'service', service,
    'slots', available,
    'scheduleDraft', draft_j,
    'executeBooking', false,
    'bookingWriteUsed', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rf_schedule_booking_turn(text, text, text, text, text, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rf_schedule_booking_turn(text, text, text, text, text, jsonb, text, text) TO service_role;

-- Wire process_ai_sales_concierge_turn to booking dialogue + commit (idempotent on message id).
DO $$
DECLARE
  f text;
  old_sched text;
  new_sched text;
  old_upd text;
  new_upd text;
  old_ret text;
  new_ret text;
BEGIN
  f := pg_get_functiondef('public.process_ai_sales_concierge_turn(uuid,uuid)'::regprocedure);

  IF position('rf_schedule_booking_turn' in f) > 0 THEN
    RAISE NOTICE 'process_ai already wired to rf_schedule_booking_turn';
    RETURN;
  END IF;

  IF position('v_booking_write jsonb' in f) = 0 THEN
    f := replace(f,
      'v_preferred_pool text;',
      'v_preferred_pool text;
  v_booking_write jsonb;
  v_gcal_payload jsonb;
  v_booking_id uuid;
  v_booking_write_used boolean := false;
  v_schedule_draft jsonb;');
  END IF;

  old_sched := $o$elsif coalesce((public.rf_schedule_turn(v_language, v_body, v_prior_state, v_preferred_pool, v_service)->>'handled')::boolean, false) then
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
    v_processed := true;$o$;

  new_sched := $n$elsif coalesce((public.rf_schedule_booking_turn(v_language, v_body, v_prior_state, v_preferred_pool, v_service, v_lead.schedule_draft, v_lead.full_name, v_lead.phone)->>'handled')::boolean, false) then
    v_sched := public.rf_schedule_booking_turn(v_language, v_body, v_prior_state, v_preferred_pool, v_service, v_lead.schedule_draft, v_lead.full_name, v_lead.phone);
    v_state := v_sched->>'state';
    v_draft := v_sched->>'draft';
    v_score := v_score + coalesce((v_sched->>'scoreDelta')::integer, 0);
    v_schedule_draft := coalesce(v_sched->'scheduleDraft', v_lead.schedule_draft);
    if coalesce(v_sched->>'preferredPoolId','') <> '' then
      v_preferred_pool := v_sched->>'preferredPoolId';
    end if;
    if coalesce(v_sched->>'service','') <> '' then
      v_service := v_sched->>'service';
    end if;
    if coalesce((v_sched->>'humanHandoff')::boolean, false) then
      v_lock_human := true;
      v_human_handoff := true;
    end if;
    if coalesce((v_sched->>'executeBooking')::boolean, false) then
      v_booking_write := public.rf_commit_messenger_lesson_booking(
        p_message_id::text,
        v_conversation.id,
        v_lead.id,
        v_sched->>'preferredPoolId',
        v_sched->>'service',
        (v_sched->>'selectedStartsAt')::timestamptz,
        coalesce((v_sched->>'partySize')::integer, 1),
        v_sched->>'customerName',
        v_sched->>'customerPhone',
        v_language,
        true
      );
      v_booking_write_used := coalesce((v_booking_write->>'bookingWriteUsed')::boolean, false);
      if coalesce((v_booking_write->>'ok')::boolean, false) then
        v_draft := v_booking_write->>'confirmationText';
        v_state := 'schedule_booked';
        v_gcal_payload := v_booking_write->'gcalPayload';
        v_booking_id := nullif(v_booking_write->>'bookingId','')::uuid;
        v_schedule_draft := '{}'::jsonb;
        v_stage := 'booking_intent';
      elsif coalesce(v_booking_write->>'code','') in ('NOT_AVAILABLE', 'INSUFFICIENT_PLACES', 'SLOT_TAKEN') then
        v_sched := public.rf_schedule_booking_turn(
          v_language,
          'available tomorrow evening',
          'schedule_need_service',
          v_sched->>'preferredPoolId',
          v_sched->>'service',
          jsonb_build_object('locationId', v_sched->>'preferredPoolId', 'sessionType', v_sched->>'service'),
          v_sched->>'customerName',
          v_sched->>'customerPhone'
        );
        v_state := coalesce(v_sched->>'state', 'schedule_checked');
        v_draft := case when v_language = 'ar'
          then 'الموعد الذي اخترته لم يعد متاحًا بعد إعادة الفحص. هذا أقرب التوفر الحقيقي الحالي:' || E'\n' || coalesce(v_sched->>'draft','')
          else 'That slot is no longer available after recheck. Here is the latest real availability:' || E'\n' || coalesce(v_sched->>'draft','')
        end;
        v_schedule_draft := coalesce(v_sched->'scheduleDraft', v_schedule_draft);
        v_booking_write_used := false;
        v_gcal_payload := null;
      else
        v_draft := case when v_language = 'ar'
          then 'تعذر إتمام الحجز تلقائيًا. سأحوّل طلبك للمتابعة البشرية مع الكوتش أيمن.'
          else 'I could not complete the booking automatically. I will hand this to Coach Ayman for human follow-up.'
        end;
        v_state := 'schedule_handoff';
        v_lock_human := true;
        v_human_handoff := true;
        v_booking_write_used := false;
        v_gcal_payload := null;
      end if;
    end if;
    if coalesce(v_sched->>'customerName','') <> '' then
      -- keep collected name on lead
      null;
    end if;
    v_stage := case when v_stage = 'new' then 'contacted' when v_stage = 'contacted' then 'qualified' else v_stage end;
    v_processed := true;$n$;

  IF position(old_sched in f) = 0 THEN
    RAISE EXCEPTION 'schedule block not found for patch';
  END IF;
  f := replace(f, old_sched, new_sched);

  old_upd := $o$update public.leads
  set
    language = v_language,
    intent = 'concierge:' || v_state || case when coalesce(v_preferred_pool,'') <> '' then '__' || v_preferred_pool else '' end,
    service = coalesce(v_service, service),
    stage = v_stage::public.lead_stage,
    score = v_score,
    fear_of_water = coalesce(v_fear, fear_of_water),
    human_required = case when v_lock_human then true else human_required end,
    updated_at = now()
  where id = v_lead.id;$o$;

  new_upd := $n$update public.leads
  set
    language = v_language,
    intent = 'concierge:' || v_state || case when coalesce(v_preferred_pool,'') <> '' then '__' || v_preferred_pool else '' end,
    service = coalesce(v_service, service),
    stage = v_stage::public.lead_stage,
    score = v_score,
    fear_of_water = coalesce(v_fear, fear_of_water),
    human_required = case when v_lock_human then true else human_required end,
    schedule_draft = coalesce(v_schedule_draft, schedule_draft),
    full_name = case
      when coalesce(v_sched->>'customerName','') <> '' then v_sched->>'customerName'
      else full_name
    end,
    name = case
      when coalesce(v_sched->>'customerName','') <> '' then v_sched->>'customerName'
      else name
    end,
    phone = case
      when coalesce(v_sched->>'customerPhone','') <> '' then v_sched->>'customerPhone'
      else phone
    end,
    updated_at = now()
  where id = v_lead.id;$n$;

  IF position(old_upd in f) = 0 THEN
    RAISE EXCEPTION 'leads update block not found for patch';
  END IF;
  f := replace(f, old_upd, new_upd);

  old_ret := $o$    'humanHandoff', v_human_handoff,
    'conversationLocked', v_lock_human,
    'draftReply', v_draft,
    'outboundEnabled', false
  );$o$;

  new_ret := $n$    'humanHandoff', v_human_handoff,
    'conversationLocked', v_lock_human,
    'draftReply', v_draft,
    'outboundEnabled', false,
    'bookingWriteUsed', coalesce(v_booking_write_used, false),
    'gcalPayload', v_gcal_payload,
    'bookingId', v_booking_id,
    'occupancyId', nullif(v_booking_write->>'occupancyId','')::uuid
  );$n$;

  IF position(old_ret in f) = 0 THEN
    RAISE EXCEPTION 'return block not found for patch';
  END IF;
  f := replace(f, old_ret, new_ret);

  -- CREATE OR REPLACE already in def
  EXECUTE f;
END;
$$;
