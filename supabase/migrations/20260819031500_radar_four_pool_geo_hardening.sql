-- Relax Fix Opportunity RADAR hardening
-- Scope: focus opportunity priority on four approved Abu Dhabi pool locations only.
-- Exact meter distance is used only when public source metadata supplies coordinates.

alter table public.radar_opportunities
  add column if not exists is_test boolean not null default false,
  add column if not exists nearest_pool_id text,
  add column if not exists nearest_pool_name text,
  add column if not exists distance_m integer,
  add column if not exists proximity_tier text;

alter table public.radar_opportunities
  drop constraint if exists radar_opportunities_proximity_tier_check;
alter table public.radar_opportunities
  add constraint radar_opportunities_proximity_tier_check
  check (proximity_tier is null or proximity_tier in ('VERY_CLOSE','NEAR','LOCAL','EXTENDED','AREA_ONLY','OUTSIDE'));

update public.radar_opportunities
set is_test = true,
    updated_at = now()
where coalesce(raw_metadata->>'test','false') = 'true'
   or source_url like 'https://example.invalid/%'
   or text_excerpt ilike '%SYNTHETIC%'
   or text_excerpt ilike '%TEST_RADAR_%'
   or text_excerpt ilike '%RADAR ACCEPTANCE TEST%'
   or text_excerpt ilike '%RADAR A1A2 VERIFICATION%';

create or replace function public.ingest_radar_candidate(
  p_source text,
  p_source_type text,
  p_text_excerpt text,
  p_source_url text default null,
  p_external_id text default null,
  p_published_at timestamptz default null,
  p_raw_metadata jsonb default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_text text := btrim(coalesce(p_text_excerpt, ''));
  v_norm text;
  v_fingerprint text;
  v_language text;
  v_area jsonb;
  v_area_hint text;
  v_location_hint text;
  v_high_intent boolean;
  v_noise boolean;
  v_service_intent text;
  v_score integer := 0;
  v_priority public.radar_priority := 'LOW';
  v_reason text[] := array[]::text[];
  v_existing_id uuid;
  v_opportunity_id uuid;
  v_pool_id text;
  v_pool_name text;
  v_source_lat double precision;
  v_source_lng double precision;
  v_distance_m integer;
  v_proximity_tier text;
  v_is_test boolean := false;
  v_area_is_approved boolean := false;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  if v_text = '' or coalesce(btrim(p_source), '') = '' then
    return jsonb_build_object('success', false, 'code', 'INVALID_CANDIDATE');
  end if;

  v_norm := lower(regexp_replace(v_text, '[^[:alnum:]]+', ' ', 'g'));
  v_norm := btrim(regexp_replace(v_norm, '\s+', ' ', 'g'));
  v_fingerprint := case
    when coalesce(p_external_id, '') <> '' then 'ext:' || p_source || ':' || p_external_id
    when coalesce(p_source_url, '') <> '' then 'url:' || lower(btrim(p_source_url))
    else 'text:' || md5(v_norm)
  end;

  -- Permanent unique fingerprint means a fingerprint must always be treated as the same opportunity.
  select id into v_existing_id
  from public.radar_opportunities
  where dedupe_fingerprint = v_fingerprint
  limit 1;
  if found then
    update public.radar_opportunities
    set duplicate_count = duplicate_count + 1,
        last_seen_at = now(),
        updated_at = now()
    where id = v_existing_id;
    return jsonb_build_object('success', true, 'code', 'DUPLICATE', 'opportunityId', v_existing_id);
  end if;

  v_language := case when v_text ~ '[ء-ي]' then 'ar' else 'en' end;
  v_is_test := coalesce(p_raw_metadata->>'test','false') = 'true'
               or coalesce(p_source_url,'') like 'https://example.invalid/%'
               or v_text ilike '%SYNTHETIC%'
               or v_text ilike '%TEST_RADAR_%'
               or v_text ilike '%RADAR ACCEPTANCE TEST%'
               or v_text ilike '%RADAR A1A2 VERIFICATION%';

  v_area := public.rf_match_customer_area(v_text);
  if v_area is not null then
    v_area_hint := v_area->>'id';
    v_location_hint := coalesce(v_area->>'labelAr', v_area->>'labelEn');
  end if;

  -- Text-only area matching maps only to the four approved Relax Fix locations.
  if v_text ~* '(ICS[[:space:]]*Al[[:space:]]*Najda|Al[[:space:]]*Najda|Najda|النجدة|نجدة|Al[[:space:]]*Danah|الدانة)' or v_area_hint = 'najda' then
    v_pool_id := 'najda-street'; v_pool_name := 'ICS Al Najda'; v_area_is_approved := true;
  elsif v_text ~* '(ICS[[:space:]]*Al[[:space:]]*Falah|Al[[:space:]]*Falah|الفلاح|فلاح)' or v_area_hint = 'al_falah' then
    v_pool_id := 'ics-al-falah'; v_pool_name := 'ICS Al Falah'; v_area_is_approved := true;
  elsif v_text ~* '(ICS[[:space:]]*Khalifa|Khalifa[[:space:]]*City|مدينة[[:space:]]*خليفة|خليفة[[:space:]]*سيتي)' or v_area_hint = 'khalifa_city' then
    v_pool_id := 'ics-khalifa'; v_pool_name := 'ICS Khalifa'; v_area_is_approved := true;
  elsif v_text ~* '(ICS[[:space:]]*(Al[[:space:]]*)?Mushrif|Al[[:space:]]*Mushrif|المشرف|مشرف)' or v_area_hint = 'al_mushrif' then
    v_pool_id := 'ics-mushrif'; v_pool_name := 'ICS Al Mushrif'; v_area_is_approved := true;
  end if;

  -- Coordinates are optional and must originate in public source metadata. Never infer a home/private GPS point.
  begin
    if p_raw_metadata ? 'lat' and p_raw_metadata ? 'lng' then
      v_source_lat := (p_raw_metadata->>'lat')::double precision;
      v_source_lng := (p_raw_metadata->>'lng')::double precision;
    elsif p_raw_metadata ? 'latitude' and p_raw_metadata ? 'longitude' then
      v_source_lat := (p_raw_metadata->>'latitude')::double precision;
      v_source_lng := (p_raw_metadata->>'longitude')::double precision;
    end if;
  exception when others then
    v_source_lat := null;
    v_source_lng := null;
  end;

  if v_source_lat between -90 and 90 and v_source_lng between -180 and 180 then
    select x.pool_id, x.pool_name,
           round(6371000 * 2 * asin(sqrt(
             power(sin(radians(v_source_lat - x.lat)/2),2) +
             cos(radians(x.lat))*cos(radians(v_source_lat))*power(sin(radians(v_source_lng - x.lng)/2),2)
           )))::integer
      into v_pool_id, v_pool_name, v_distance_m
    from (values
      ('najda-street','ICS Al Najda',24.4870375::double precision,54.375390625::double precision),
      ('ics-al-falah','ICS Al Falah',24.4371131::double precision,54.7118179::double precision),
      ('ics-khalifa','ICS Khalifa',24.4201314::double precision,54.5749535::double precision),
      ('ics-mushrif','ICS Al Mushrif',24.4410852::double precision,54.3842182::double precision)
    ) as x(pool_id,pool_name,lat,lng)
    order by 6371000 * 2 * asin(sqrt(
      power(sin(radians(v_source_lat - x.lat)/2),2) +
      cos(radians(x.lat))*cos(radians(v_source_lat))*power(sin(radians(v_source_lng - x.lng)/2),2)
    ))
    limit 1;
  end if;

  v_proximity_tier := case
    when v_distance_m is not null and v_distance_m <= 500 then 'VERY_CLOSE'
    when v_distance_m is not null and v_distance_m <= 2000 then 'NEAR'
    when v_distance_m is not null and v_distance_m <= 5000 then 'LOCAL'
    when v_distance_m is not null and v_distance_m <= 8000 then 'EXTENDED'
    when v_distance_m is not null then 'OUTSIDE'
    when v_area_is_approved then 'AREA_ONLY'
    else null
  end;

  v_noise := v_text ~* '(championship|tournament|olympic|olympics|world record|swim meet|gala|final results|league|بطولة|منتخب|أولمبياد|رقم قياسي|نتائج نهائية|دوري)'
             and not (v_text ~* '(coach|lesson|class|private|book|price|cost|أسعار|سعر|حصة|حصص|درس|دروس|مدرب|احجز|حجز)');

  v_high_intent := v_text ~* '(looking for|need a|want a|any recommendation|recommend a|anyone know|private (swim|swimming)|swim(ming)? (lesson|lessons|class|classes|coach|coaching|instructor)|kids? swim|my (son|daughter|kid|child).*(swim|water|scared|afraid)|swim.*(price|cost|near me)|beginner.*(swim|lesson)|(available|availability|slots?|when can|do you have).*(swim|lesson|coach|class)|أبي مدرب|أبغى مدرب|حد يعرف مدرب|مين يعرف مدرب|مدرب سباحة|مدرس سباحة|دروس سباحة|حصص سباحة|كورس سباحة|تعليم سباحة|يخاف من الماء|خايف من المويه|ولدي يخاف|بنتي تخاف|أبحث عن مدرب|محتاج مدرب|ابغى حصص|عايز مدرب|عايزة مدرب|فيه أماكن|متاح|مواعيد متاحة|mudarrib|mudarrisa|kabtin mo?htaref|mo?htaref|coach sباحة|3andi tifl|3indi tifl|indi tifl|tifli|ibni|binti|waladi|5ayef|khayef|khayfa|5ayfa|min el moya|mnel moya|mn el mai|sibaha|se3a khasa|dorop|darsse sباحة)'
                  or (v_text ~* '(swim|سباح|عوم|sباح)' and v_text ~* '(price|cost|how much|بكام|سعر|أسعار|near|قريب|أقرب|b?kam)');

  v_service_intent := case
    when v_text ~* '(private|خاص|فردي)' then 'private'
    when v_text ~* '(group|مجموعة|جماعي)' then 'group'
    when v_text ~* '(afraid|scared|fear|يخاف|خايف|خوف|5ayef|khayef)' then 'fear_of_water'
    else null
  end;

  if v_noise and not v_high_intent then
    v_score := 5;
    v_reason := array_append(v_reason, case when v_language='ar' then 'محتوى عام بدون نية شراء واضحة' else 'General content with no clear buyer intent' end);
  else
    if v_high_intent then v_score := v_score + 60; end if;
    if v_service_intent is not null then v_score := v_score + 10; end if;
    if v_proximity_tier = 'VERY_CLOSE' then v_score := v_score + 30;
    elsif v_proximity_tier = 'NEAR' then v_score := v_score + 25;
    elsif v_proximity_tier = 'LOCAL' then v_score := v_score + 20;
    elsif v_proximity_tier = 'EXTENDED' then v_score := v_score + 10;
    elsif v_proximity_tier = 'AREA_ONLY' then v_score := v_score + 20;
    end if;
    if v_pool_name is not null then
      v_reason := array_append(v_reason, case when v_language='ar' then format('أقرب موقع معتمد: %s',v_pool_name) else format('Nearest approved location: %s',v_pool_name) end);
    end if;
    if v_distance_m is not null then
      v_reason := array_append(v_reason, case when v_language='ar' then format('مسافة مصدر عامة قابلة للإثبات: %s م',v_distance_m) else format('Verifiable public-source distance: %s m',v_distance_m) end);
    elsif v_area_is_approved then
      v_reason := array_append(v_reason, case when v_language='ar' then 'مطابقة منطقة فقط؛ لا توجد مسافة مترية مؤكدة' else 'Area-level match only; no verified meter distance' end);
    end if;
  end if;

  v_score := least(v_score,100);
  -- Strict owner-approved geo rule: HOT through 5 km (or trusted area match), WARM only 5-8 km, otherwise LOW.
  v_priority := case
    when v_high_intent and v_proximity_tier in ('VERY_CLOSE','NEAR','LOCAL','AREA_ONLY') and v_score >= 70 then 'HOT'
    when v_high_intent and v_proximity_tier = 'EXTENDED' then 'WARM'
    else 'LOW'
  end;

  insert into public.radar_opportunities (
    source,source_type,source_url,external_id,published_at,text_excerpt,language,
    location_hint,area_hint,service_intent,buyer_intent_score,priority,reason,dedupe_fingerprint,raw_metadata,
    is_test,nearest_pool_id,nearest_pool_name,distance_m,proximity_tier
  ) values (
    p_source,p_source_type,p_source_url,p_external_id,p_published_at,left(v_text,2000),v_language,
    v_location_hint,v_area_hint,v_service_intent,v_score,v_priority,array_to_string(v_reason,' · '),v_fingerprint,p_raw_metadata,
    v_is_test,v_pool_id,v_pool_name,v_distance_m,v_proximity_tier
  ) returning id into v_opportunity_id;

  -- No redundant radar_hot_opportunity job is created. Attention Center and Push read HOT rows directly.
  return jsonb_build_object(
    'success',true,'code','INGESTED','opportunityId',v_opportunity_id,'priority',v_priority,'score',v_score,
    'nearestPoolId',v_pool_id,'nearestPoolName',v_pool_name,'distanceM',v_distance_m,'proximityTier',v_proximity_tier,'isTest',v_is_test
  );
end;
$function$;

create or replace function public.set_staff_radar_opportunity_status(p_opportunity_id uuid,p_status text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_old_status text;
begin
  if not public.is_active_staff(array['super_admin','admin','reception','coach']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode='42501';
  end if;
  if p_status not in('NEW','REVIEWED','ACTIONED','DISMISSED','CONTACTED','CUSTOMER_REPLIED','BOOKING_REQUEST','BOOKED','PAID_CUSTOMER','NOT_RELEVANT','UNREACHABLE','LOST') then
    return jsonb_build_object('success',false,'code','INVALID_STATUS');
  end if;
  select status::text into v_old_status
  from public.radar_opportunities
  where id=p_opportunity_id
  for update;
  if not found then return jsonb_build_object('success',false,'code','NOT_FOUND'); end if;
  if v_old_status=p_status then return jsonb_build_object('success',true,'code','UNCHANGED','opportunityId',p_opportunity_id,'status',p_status); end if;
  update public.radar_opportunities set status=p_status::public.radar_status,updated_at=now() where id=p_opportunity_id;
  insert into public.audit_logs(actor_id,actor_type,action,entity_type,entity_id,detail)
  values(auth.uid(),'user','radar_opportunity_status_updated','radar_opportunity',p_opportunity_id,jsonb_build_object('oldStatus',v_old_status,'newStatus',p_status));
  return jsonb_build_object('success',true,'code','UPDATED','opportunityId',p_opportunity_id,'status',p_status);
end;
$function$;
