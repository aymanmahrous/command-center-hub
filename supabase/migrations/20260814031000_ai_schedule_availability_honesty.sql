-- Schedule honesty: published hours only — never invent bookable slots.
-- Discovery: no live slot inventory / Calendar workflow / Sheets schedule source.
-- Read-only published-window check + human handoff for real confirmation.

CREATE OR REPLACE FUNCTION public.rf_schedule_turn(
  p_language text,
  p_body text,
  p_prior_state text,
  p_preferred_pool_id text DEFAULT NULL,
  p_service text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
declare
  schedule_intent boolean;
  area jsonb;
  nearest jsonb;
  pool jsonb;
  pool_id text;
  pool_name text;
  service text := p_service;
  day_kind text;
  hour_hint integer;
  published_check text := 'unknown';
  window_note text;
  loc_note text := '';
  svc_note text := '';
  hours_line text;
  draft text;
  location_also boolean;
  nearest_draft text;
begin
  -- Timing/availability signals only (bare book/حجز stays in booking funnel).
  schedule_intent := p_body ~* '(available|availability|slot|schedule|tomorrow|saturday|sunday|monday|tuesday|wednesday|thursday|friday|morning|evening|afternoon|after[[:space:]]*[[:digit:]]|at[[:space:]]*[[:digit:]]|موعد|بكرة|بكرا|غدا|غدًا|السبت|سبت|الأحد|الاحد|أحد|احد|اثنين|ثلاثاء|اربعاء|خميس|جمعة|صباح|مساء|بعد[[:space:]]*[[:digit:]]|الساعة|الساعه|متاح|توفر|فيه[[:space:]]*حصة|after[[:space:]]*sunset|مغرب)';

  if not schedule_intent then
    return jsonb_build_object('handled', false);
  end if;

  if p_body ~* '(private|individual|one[[:space:]-]?on[[:space:]-]?one|خاص|فردي|حصة خاصة|بريفت|برايفت)' then
    service := 'private';
  elsif p_body ~* '(group|family|up to 5|مجموعة|عائلة|جماعي)' then
    service := 'group';
  elsif p_body ~* '(sibling|brother|sister|إخوة|أخوات|أشقاء|أخ|أخت)' then
    service := 'siblings';
  end if;

  area := public.rf_match_customer_area(p_body);
  pool_id := nullif(p_preferred_pool_id, '');
  if area is not null then
    nearest := public.rf_nearest_pool(area);
    pool := nearest->'pool';
    if pool is not null then
      pool_id := pool->>'id';
    end if;
  elsif pool_id is not null then
    select p into pool
    from jsonb_array_elements(public.rf_training_pools()) p
    where p->>'id' = pool_id
    limit 1;
  end if;

  if pool is not null then
    pool_name := case when p_language = 'ar' then pool->>'nameAr' else pool->>'name' end;
  end if;

  -- Day kind (published hours are shared across locations; not inventory).
  if p_body ~* '(saturday|sunday|weekend|السبت|سبت|الأحد|الاحد|أحد|احد|نهاية الأسبوع|ويكند)' then
    day_kind := 'weekend';
  elsif p_body ~* '(monday|tuesday|wednesday|thursday|friday|weekday|الإثنين|الاثنين|اثنين|ثلاثاء|اربعاء|خميس|جمعة|أيام الأسبوع)' then
    day_kind := 'weekday';
  elsif p_body ~* '(tomorrow|بكرة|بكرا|غدا|غدًا)' then
    -- Asia/Dubai business day for "tomorrow"
    day_kind := case
      when extract(dow from (timezone('Asia/Dubai', now())::date + 1)) in (0, 6) then 'weekend'
      else 'weekday'
    end;
  else
    day_kind := null;
  end if;

  hour_hint := null;
  if p_body ~* '(after|بعد)[[:space:]]*[[:digit:]]{1,2}' then
    hour_hint := (regexp_match(p_body, '(?:after|بعد)[[:space:]]*([[:digit:]]{1,2})', 'i'))[1]::integer;
    if hour_hint <= 12 and p_body ~* '(مساء|evening|pm|مغرب)' then
      if hour_hint < 12 then hour_hint := hour_hint + 12; end if;
    elsif hour_hint <= 6 and p_body ~* 'بعد' then
      hour_hint := hour_hint + 12;
    end if;
  elsif p_body ~* '(مغرب|after[[:space:]]*sunset)' then
    hour_hint := 19;
  elsif p_body ~* '(evening|مساء|night|ليل)' then
    hour_hint := 18;
  elsif p_body ~* '(afternoon|ظهر)' then
    hour_hint := 16;
  elsif p_body ~* '(morning|صباح)' then
    hour_hint := 10;
  end if;

  if day_kind is null then
    published_check := 'unknown';
  elsif hour_hint is null then
    published_check := 'unknown';
  elsif day_kind = 'weekend' then
    published_check := case when hour_hint >= 10 and hour_hint < 22 then 'inside_published_window' else 'outside_published_window' end;
  else
    published_check := case when hour_hint >= 16 and hour_hint < 21 then 'inside_published_window' else 'outside_published_window' end;
  end if;

  if p_language = 'ar' then
    hours_line := 'ساعات النشر العامة: السبت والأحد 10:00–22:00، ومن الإثنين للجمعة 16:00–21:00 (ليست ضمان توفر).';
    window_note := case published_check
      when 'inside_published_window' then 'الوقت اللي ذكرته يقع داخل ساعات النشر العامة، لكن هذا لا يعني أن الموعد متاح.'
      when 'outside_published_window' then 'الوقت اللي ذكرته خارج ساعات النشر العامة على الموقع.'
      else 'ما عندي جدول لحظي للتحقق من المواعيد المتاحة فعليًا.'
    end;
    if pool_name is not null then
      loc_note := format('الموقع المقترح من سياقنا: %s.', pool_name);
    end if;
    if service = 'private' then svc_note := 'نوع الحصة المذكور: خاصة.';
    elsif service = 'group' then svc_note := 'نوع الحصة المذكور: جماعية.';
    elsif service = 'siblings' then svc_note := 'نوع الحصة المذكور: إخوة.';
    end if;
    draft := concat_ws(
      ' ',
      'ما أقدر أأكد توفر موعد محدد من النظام الحالي.',
      window_note,
      hours_line,
      nullif(loc_note, ''),
      nullif(svc_note, ''),
      'أحوّل طلبك للكوتش أيمن لتأكيد أقرب موعد متاح فعليًا — بدون تخمين.'
    );
  else
    hours_line := 'Published general hours: Sat–Sun 10:00–22:00, Mon–Fri 16:00–21:00 (not a guarantee of open slots).';
    window_note := case published_check
      when 'inside_published_window' then 'That time falls inside published general hours, but that does NOT mean a slot is available.'
      when 'outside_published_window' then 'That time is outside the website''s published general hours.'
      else 'I don''t have a live slot inventory to verify real availability.'
    end;
    if pool_name is not null then
      loc_note := format('Suggested location from our context: %s.', pool_name);
    end if;
    if service is not null then
      svc_note := format('Mentioned lesson type: %s.', service);
    end if;
    draft := concat_ws(
      ' ',
      'I can''t confirm a specific open slot from the current system.',
      window_note,
      hours_line,
      nullif(loc_note, ''),
      nullif(svc_note, ''),
      'I''ll pass this to Coach Ayman to confirm a real available time — no guessing.'
    );
  end if;

  location_also := area is not null and p_body ~* '(أقرب|اقرب|nearest|closest|أين|وين|فين|location|map)';
  if location_also and area is not null and pool is not null then
    if p_language = 'ar' then
      nearest_draft := format(
        'أقرب موقع تدريب لك حسب بياناتنا من %s: %s (%s، أبوظبي).' || E'\n' || '%s',
        area->>'labelAr', pool->>'nameAr', pool->>'areaAr', pool->>'mapUrl'
      );
    else
      nearest_draft := format(
        'Nearest Relax Fix training location from %s: %s (%s, Abu Dhabi).' || E'\n' || '%s',
        area->>'labelEn', pool->>'name', pool->>'area', pool->>'mapUrl'
      );
    end if;
    draft := nearest_draft || E'\n\n' || draft;
  end if;

  return jsonb_build_object(
    'handled', true,
    'state', 'schedule_handoff',
    'draft', draft,
    'scoreDelta', 10,
    'preferredPoolId', pool_id,
    'service', service,
    'publishedCheck', published_check,
    'canConfirmSlot', false
  );
end;
$$;

REVOKE ALL ON FUNCTION public.rf_schedule_turn(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rf_schedule_turn(text, text, text, text, text) TO service_role;
