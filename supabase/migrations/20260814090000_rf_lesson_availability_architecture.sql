-- Relax Fix lesson availability architecture
-- Google Calendar "Relax Fix UAE Lessons" = source of truth for occupied times.
-- This mirror table + RPCs support AI read/write without inventing availability.
-- No seed bookings are inserted.

CREATE TABLE IF NOT EXISTS public.rf_lesson_occupancy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gcal_event_id text UNIQUE,
  location_id text NOT NULL,
  session_type text NOT NULL CHECK (session_type IN ('private', 'group')),
  coach text NOT NULL DEFAULT 'Coach Ayman',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  capacity integer NOT NULL,
  booked_count integer NOT NULL DEFAULT 1 CHECK (booked_count >= 0),
  customer_label text,
  source text NOT NULL DEFAULT 'google_calendar',
  write_status text NOT NULL DEFAULT 'synced'
    CHECK (write_status IN ('pending_gcal', 'synced', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (booked_count <= capacity)
);

CREATE INDEX IF NOT EXISTS rf_lesson_occupancy_range_idx
  ON public.rf_lesson_occupancy (starts_at, ends_at);
CREATE INDEX IF NOT EXISTS rf_lesson_occupancy_location_idx
  ON public.rf_lesson_occupancy (location_id, starts_at);

ALTER TABLE public.rf_lesson_occupancy ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.rf_schedule_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rf_schedule_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.rf_schedule_config (key, value)
VALUES
  (
    'lessons_calendar',
    jsonb_build_object(
      'summary', 'Relax Fix UAE Lessons',
      'calendarId', 'f3174382847e3a2d3a546ecb2c16d605d589bfd4f1e29c39ec950c1c5377dbf8@group.calendar.google.com',
      'timeZone', 'Asia/Dubai',
      'n8nCredentialId', 'uVP3oHdTvCq0b0fR'
    )
  ),
  (
    'class_rules',
    jsonb_build_object(
      'timezone', 'Asia/Dubai',
      'durationMinutes', 45,
      'coach', 'Coach Ayman',
      'capacity', jsonb_build_object('private', 1, 'group', 4),
      'windows', jsonb_build_object(
        'saturday', jsonb_build_object('open', '10:00', 'close', '22:00'),
        'sunday', jsonb_build_object('open', '10:00', 'close', '22:00'),
        'monday', jsonb_build_object('open', '16:00', 'close', '21:00'),
        'tuesday', jsonb_build_object('open', '16:00', 'close', '21:00'),
        'wednesday', jsonb_build_object('open', '16:00', 'close', '21:00'),
        'thursday', jsonb_build_object('open', '16:00', 'close', '21:00'),
        'friday', jsonb_build_object('open', '16:00', 'close', '21:00')
      ),
      'locations', jsonb_build_array(
        jsonb_build_object('id', 'najda-street', 'name', 'ICS Al Najda', 'mapUrl', 'https://maps.app.goo.gl/XL9weMpSJcpVDNCV6'),
        jsonb_build_object('id', 'ics-al-falah', 'name', 'ICS Al Falah', 'mapUrl', 'https://maps.app.goo.gl/b5LULVrArcD8BwhF9'),
        jsonb_build_object('id', 'ics-khalifa', 'name', 'ICS Al Khalifa', 'mapUrl', 'https://maps.app.goo.gl/cbWqzLqDSYXmEFyS9'),
        jsonb_build_object('id', 'ics-mushrif', 'name', 'ICS Al Mushrif', 'mapUrl', 'https://maps.app.goo.gl/Rgu2vKH7JDigAQQx6')
      )
    )
  )
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = now();

CREATE OR REPLACE FUNCTION public.rf_check_lesson_availability(
  p_location_id text,
  p_session_type text,
  p_starts_at timestamptz,
  p_duration_minutes integer DEFAULT 45,
  p_coach text DEFAULT 'Coach Ayman'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_type text := lower(trim(p_session_type));
  v_end timestamptz := p_starts_at + make_interval(mins => coalesce(p_duration_minutes, 45));
  v_dow integer;
  v_open time;
  v_close time;
  v_local_start time;
  v_local_end time;
  v_capacity integer;
  v_booked integer := 0;
  v_conflict_other integer := 0;
  v_status text;
  v_available integer;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED';
  END IF;

  IF p_location_id IS NULL OR v_type IS NULL OR p_starts_at IS NULL THEN
    RETURN jsonb_build_object('status', 'MISSING_INPUT', 'canBook', false);
  END IF;

  IF v_type NOT IN ('private', 'group') THEN
    RETURN jsonb_build_object('status', 'MISSING_INPUT', 'canBook', false, 'reason', 'invalid_session_type');
  END IF;

  IF p_location_id NOT IN ('najda-street', 'ics-al-falah', 'ics-khalifa', 'ics-mushrif') THEN
    RETURN jsonb_build_object('status', 'MISSING_INPUT', 'canBook', false, 'reason', 'invalid_location');
  END IF;

  v_capacity := CASE WHEN v_type = 'private' THEN 1 ELSE 4 END;

  -- Asia/Dubai wall-clock window check (dow: 0=Sun .. 6=Sat)
  v_dow := extract(dow from (p_starts_at AT TIME ZONE 'Asia/Dubai'))::integer;
  v_local_start := (p_starts_at AT TIME ZONE 'Asia/Dubai')::time;
  v_local_end := (v_end AT TIME ZONE 'Asia/Dubai')::time;

  IF v_dow IN (0, 6) THEN
    v_open := time '10:00'; v_close := time '22:00';
  ELSE
    v_open := time '16:00'; v_close := time '21:00';
  END IF;

  IF v_local_start < v_open OR v_local_end > v_close OR (p_starts_at AT TIME ZONE 'Asia/Dubai')::date
      <> (v_end AT TIME ZONE 'Asia/Dubai')::date THEN
    RETURN jsonb_build_object(
      'status', 'OUTSIDE_WINDOW',
      'canBook', false,
      'locationId', p_location_id,
      'sessionType', v_type,
      'availablePlaces', 0,
      'capacity', v_capacity
    );
  END IF;

  -- Coach conflicts that are NOT same location+group
  SELECT count(*)::integer INTO v_conflict_other
  FROM public.rf_lesson_occupancy o
  WHERE o.write_status <> 'cancelled'
    AND o.coach = coalesce(p_coach, 'Coach Ayman')
    AND o.starts_at < v_end
    AND o.ends_at > p_starts_at
    AND NOT (v_type = 'group' AND o.session_type = 'group' AND o.location_id = p_location_id);

  IF v_type = 'private' THEN
    IF EXISTS (
      SELECT 1 FROM public.rf_lesson_occupancy o
      WHERE o.write_status <> 'cancelled'
        AND o.coach = coalesce(p_coach, 'Coach Ayman')
        AND o.starts_at < v_end
        AND o.ends_at > p_starts_at
    ) THEN
      RETURN jsonb_build_object(
        'status', 'BOOKED',
        'canBook', false,
        'locationId', p_location_id,
        'sessionType', v_type,
        'availablePlaces', 0,
        'capacity', 1
      );
    END IF;
    RETURN jsonb_build_object(
      'status', 'AVAILABLE',
      'canBook', true,
      'locationId', p_location_id,
      'sessionType', v_type,
      'availablePlaces', 1,
      'capacity', 1,
      'coach', coalesce(p_coach, 'Coach Ayman'),
      'startsAt', p_starts_at,
      'endsAt', v_end
    );
  END IF;

  -- group
  IF v_conflict_other > 0 THEN
    RETURN jsonb_build_object(
      'status', 'BOOKED',
      'canBook', false,
      'locationId', p_location_id,
      'sessionType', v_type,
      'availablePlaces', 0,
      'capacity', v_capacity
    );
  END IF;

  SELECT coalesce(sum(o.booked_count), 0)::integer INTO v_booked
  FROM public.rf_lesson_occupancy o
  WHERE o.write_status <> 'cancelled'
    AND o.coach = coalesce(p_coach, 'Coach Ayman')
    AND o.location_id = p_location_id
    AND o.session_type = 'group'
    AND o.starts_at < v_end
    AND o.ends_at > p_starts_at;

  v_available := greatest(v_capacity - v_booked, 0);
  IF v_available <= 0 THEN
    v_status := 'BOOKED';
  ELSIF v_booked > 0 THEN
    v_status := 'PARTIALLY_AVAILABLE';
  ELSE
    v_status := 'AVAILABLE';
  END IF;

  RETURN jsonb_build_object(
    'status', v_status,
    'canBook', v_available > 0,
    'locationId', p_location_id,
    'sessionType', v_type,
    'availablePlaces', v_available,
    'capacity', v_capacity,
    'bookedCount', v_booked,
    'coach', coalesce(p_coach, 'Coach Ayman'),
    'startsAt', p_starts_at,
    'endsAt', v_end
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rf_prepare_lesson_booking_write(
  p_location_id text,
  p_session_type text,
  p_starts_at timestamptz,
  p_booked_count integer DEFAULT 1,
  p_customer_label text DEFAULT NULL,
  p_coach text DEFAULT 'Coach Ayman',
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
  v_id uuid;
  v_calendar jsonb;
  v_payload jsonb;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'SERVICE_ROLE_REQUIRED';
  END IF;

  -- Hard safety: refuse to create bookings unless caller explicitly confirms.
  IF p_confirm IS DISTINCT FROM true THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'CONFIRM_REQUIRED',
      'message', 'Set p_confirm=true only for real customer bookings. No fake bookings.'
    );
  END IF;

  v_check := public.rf_check_lesson_availability(p_location_id, v_type, p_starts_at, 45, p_coach);
  IF coalesce((v_check->>'canBook')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'code', 'NOT_AVAILABLE', 'availability', v_check);
  END IF;

  IF coalesce(p_booked_count, 0) < 1 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_BOOKED_COUNT');
  END IF;

  IF (v_check->>'availablePlaces')::integer < p_booked_count THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INSUFFICIENT_PLACES', 'availability', v_check);
  END IF;

  v_capacity := (v_check->>'capacity')::integer;
  v_end := (v_check->>'endsAt')::timestamptz;
  SELECT value INTO v_calendar FROM public.rf_schedule_config WHERE key = 'lessons_calendar';

  INSERT INTO public.rf_lesson_occupancy (
    location_id, session_type, coach, starts_at, ends_at,
    capacity, booked_count, customer_label, source, write_status
  ) VALUES (
    p_location_id, v_type, coalesce(p_coach, 'Coach Ayman'), p_starts_at, v_end,
    v_capacity,
    CASE WHEN v_type = 'private' THEN 1 ELSE p_booked_count END,
    p_customer_label,
    'google_calendar',
    'pending_gcal'
  ) RETURNING id INTO v_id;

  v_payload := jsonb_build_object(
    'occupancyId', v_id,
    'calendarId', v_calendar->>'calendarId',
    'summary', format('%s | %s | %s', v_type, p_location_id, coalesce(p_coach, 'Coach Ayman')),
    'description', format(
      'locationId=%s
sessionType=%s
coach=%s
capacity=%s
booked=%s
customer=%s',
      p_location_id, v_type, coalesce(p_coach, 'Coach Ayman'), v_capacity,
      CASE WHEN v_type = 'private' THEN 1 ELSE p_booked_count END,
      coalesce(p_customer_label, '')
    ),
    'start', jsonb_build_object('dateTime', p_starts_at, 'timeZone', 'Asia/Dubai'),
    'end', jsonb_build_object('dateTime', v_end, 'timeZone', 'Asia/Dubai'),
    'extendedProperties', jsonb_build_object(
      'private', jsonb_build_object(
        'locationId', p_location_id,
        'sessionType', v_type,
        'coach', coalesce(p_coach, 'Coach Ayman'),
        'capacity', v_capacity::text,
        'booked', (CASE WHEN v_type = 'private' THEN 1 ELSE p_booked_count END)::text,
        'occupancyId', v_id::text
      )
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'PENDING_GCAL_WRITE',
    'availability', v_check,
    'gcalPayload', v_payload,
    'note', 'Caller must create the Google Calendar event, then set gcal_event_id + write_status=synced.'
  );
END;
$$;

REVOKE ALL ON TABLE public.rf_lesson_occupancy FROM PUBLIC;
REVOKE ALL ON TABLE public.rf_schedule_config FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rf_check_lesson_availability(text, text, timestamptz, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rf_prepare_lesson_booking_write(text, text, timestamptz, integer, text, text, boolean) FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON public.rf_lesson_occupancy TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.rf_schedule_config TO service_role;
GRANT EXECUTE ON FUNCTION public.rf_check_lesson_availability(text, text, timestamptz, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.rf_prepare_lesson_booking_write(text, text, timestamptz, integer, text, text, boolean) TO service_role;
