-- Official Relax Fix training pools knowledge + nearest-location behavior for AI concierge.
-- Source: https://www.relaxfixuae.com/ location pages + sitemap (retrieved 2026-08-14).
-- Conflict: business_settings.locations are customer neighborhoods, not the four venues.

CREATE OR REPLACE FUNCTION public.rf_training_pools()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_array(
    jsonb_build_object(
      'id', 'najda-street',
      'name', 'Najda Street',
      'nameAr', 'نجدة ستريت (النجدة)',
      'emirate', 'Abu Dhabi',
      'area', 'Al Danah / Al Najda',
      'areaAr', 'الدانة / النجدة',
      'address', 'ICS Al Danah — International Community School, Al Najda St, Al Danah, E11, Abu Dhabi',
      'mapUrl', 'https://maps.app.goo.gl/XL9weMpSJcpVDNCV6',
      'lat', 24.4870375,
      'lng', 54.375390625,
      'coordPrecision', 'exact_plus_code',
      'sourceUrl', 'https://www.relaxfixuae.com/locations/najda-street'
    ),
    jsonb_build_object(
      'id', 'ics-al-falah',
      'name', 'ICS Al Falah',
      'nameAr', 'ICS الفلاح',
      'emirate', 'Abu Dhabi',
      'area', 'Al Falah',
      'areaAr', 'الفلاح',
      'address', 'International Community Schools — ICS Al Falah City, Suhail Bilqaz Al Muhairi St, Al Falah, 1E, Abu Dhabi',
      'mapUrl', 'https://maps.app.goo.gl/b5LULVrArcD8BwhF9',
      'lat', 24.4371131,
      'lng', 54.7118179,
      'coordPrecision', 'area_centroid',
      'sourceUrl', 'https://www.relaxfixuae.com/locations/ics-al-falah'
    ),
    jsonb_build_object(
      'id', 'ics-khalifa',
      'name', 'ICS Khalifa',
      'nameAr', 'ICS مدينة خليفة',
      'emirate', 'Abu Dhabi',
      'area', 'Khalifa City',
      'areaAr', 'مدينة خليفة',
      'address', 'International Community Schools — ICS Khalifa City, Khalifa City, SE38, Abu Dhabi',
      'mapUrl', 'https://maps.app.goo.gl/cbWqzLqDSYXmEFyS9',
      'lat', 24.4201314,
      'lng', 54.5749535,
      'coordPrecision', 'area_centroid',
      'sourceUrl', 'https://www.relaxfixuae.com/locations/ics-khalifa'
    ),
    jsonb_build_object(
      'id', 'ics-mushrif',
      'name', 'ICS Mushrif',
      'nameAr', 'ICS المشرف',
      'emirate', 'Abu Dhabi',
      'area', 'Al Mushrif',
      'areaAr', 'المشرف',
      'address', 'International Community Schools — ICS Mushrif, 24th Street, Al Mushrif Area, Abu Dhabi',
      'mapUrl', 'https://maps.app.goo.gl/Rgu2vKH7JDigAQQx6',
      'lat', 24.4410852,
      'lng', 54.3842182,
      'coordPrecision', 'area_centroid',
      'sourceUrl', 'https://www.relaxfixuae.com/locations/ics-mushrif'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.rf_match_customer_area(p_body text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
declare
  b text := coalesce(p_body, '');
begin
  if b ~* '(البرشاء|برشاء|barsha)' then
    return jsonb_build_object('id','al_barsha','labelAr','البرشاء','labelEn','Al Barsha','lat',25.0994892,'lng',55.2017252);
  elsif b ~* '(ديرة|ديره|deira)' then
    return jsonb_build_object('id','deira','labelAr','ديرة','labelEn','Deira','lat',25.2727936,'lng',55.305334);
  elsif b ~* '(جي[[:space:]]*في[[:space:]]*سي|jvc|jumeirah[[:space:]]*village[[:space:]]*circle)' then
    return jsonb_build_object('id','jvc','labelAr','جي في سي','labelEn','JVC','lat',25.0565882,'lng',55.2079869);
  elsif b ~* '(مارينا|marina|dubai[[:space:]]*marina)' then
    return jsonb_build_object('id','marina','labelAr','مارينا','labelEn','Marina','lat',25.0786415,'lng',55.1352524);
  elsif b ~* '(الفلاح|فلاح|al[[:space:]]*falah)' then
    return jsonb_build_object('id','al_falah','labelAr','الفلاح','labelEn','Al Falah','lat',24.4371131,'lng',54.7118179,'preferPoolId','ics-al-falah');
  elsif b ~* '(مدينة[[:space:]]*خليفة|خليفة[[:space:]]*سيتي|khalifa[[:space:]]*city)' or b ~* '\ykhalifa\y' then
    return jsonb_build_object('id','khalifa_city','labelAr','مدينة خليفة','labelEn','Khalifa City','lat',24.4201314,'lng',54.5749535,'preferPoolId','ics-khalifa');
  elsif b ~* '(المشرف|مشرف|mushrif)' then
    return jsonb_build_object('id','al_mushrif','labelAr','المشرف','labelEn','Al Mushrif','lat',24.4410852,'lng',54.3842182,'preferPoolId','ics-mushrif');
  elsif b ~* '(نجدة|النجدة|najda|al[[:space:]]*danah|الدانة)' then
    return jsonb_build_object('id','najda','labelAr','النجدة','labelEn','Najda','lat',24.4870375,'lng',54.375390625,'preferPoolId','najda-street');
  elsif b ~* '(الخالدية|خالدية|khalidiya|khalidiyah)' then
    return jsonb_build_object('id','al_khalidiya','labelAr','الخالدية','labelEn','Al Khalidiya','lat',24.4693445,'lng',54.3488059);
  elsif b ~* '(الريم|reem)' then
    return jsonb_build_object('id','al_reem','labelAr','الريم','labelEn','Al Reem Island','lat',24.4953701,'lng',54.4052431);
  elsif b ~* '(ياس|yas[[:space:]]*island)' or b ~* '\yyas\y' then
    return jsonb_build_object('id','yas','labelAr','ياس','labelEn','Yas Island','lat',24.486404,'lng',54.6090712);
  elsif b ~* '(المرور|muroor|المعمور)' then
    return jsonb_build_object('id','al_muroor','labelAr','المرور','labelEn','Al Muroor','lat',24.4734475,'lng',54.3758677);
  elsif b ~* '(electra|الكترو)' then
    return jsonb_build_object('id','electra','labelAr','الكترو','labelEn','Electra','lat',24.4588998,'lng',54.3314368);
  end if;
  return null;
end;
$$;

CREATE OR REPLACE FUNCTION public.rf_haversine_km(a_lat double precision, a_lng double precision, b_lat double precision, b_lng double precision)
RETURNS double precision
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 2 * 6371 * asin(sqrt(
    power(sin(radians(b_lat - a_lat) / 2), 2) +
    cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lng - a_lng) / 2), 2)
  ));
$$;

CREATE OR REPLACE FUNCTION public.rf_nearest_pool(p_area jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
declare
  pools jsonb := public.rf_training_pools();
  pool jsonb;
  best jsonb;
  best_km double precision;
  km double precision;
  prefer text;
begin
  if p_area is null then
    return null;
  end if;
  prefer := p_area->>'preferPoolId';
  if prefer is not null then
    select value into pool
    from jsonb_array_elements(pools) value
    where value->>'id' = prefer
    limit 1;
    if pool is not null then
      return jsonb_build_object('pool', pool, 'method', 'prefer_pool', 'distanceKm', 0);
    end if;
  end if;

  for pool in select value from jsonb_array_elements(pools) value
  loop
    if (pool->>'lat') is null or (pool->>'lng') is null then
      continue;
    end if;
    km := public.rf_haversine_km(
      (p_area->>'lat')::double precision,
      (p_area->>'lng')::double precision,
      (pool->>'lat')::double precision,
      (pool->>'lng')::double precision
    );
    if best is null or km < best_km then
      best := pool;
      best_km := km;
    end if;
  end loop;

  if best is null then
    return null;
  end if;
  return jsonb_build_object('pool', best, 'method', 'haversine', 'distanceKm', best_km);
end;
$$;

CREATE OR REPLACE FUNCTION public.rf_location_turn(p_language text, p_body text, p_prior_state text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
declare
  area jsonb;
  nearest jsonb;
  pool jsonb;
  draft text;
  location_intent boolean;
begin
  area := public.rf_match_customer_area(p_body);
  location_intent := p_body ~* '(where|location|address|map|place|are you located|nearest|closest|near me|فين|وين|موقع|عنوان|مكان|الموقع|أقرب|اقرب|قريب|مسبح|pool)';

  if area is not null then
    nearest := public.rf_nearest_pool(area);
    pool := nearest->'pool';
    if pool is null then
      draft := case when p_language = 'ar'
        then 'ما قدرت أحدد أقرب مسبح بثقة من اللي كتبته. قلّي منطقتك أو أقرب معلم معروف؟'
        else 'I couldn''t confidently pick the nearest pool from that. Which area or nearby landmark are you in?'
      end;
    elsif p_language = 'ar' then
      draft := format(
        'أقرب موقع تدريب لك حسب بياناتنا من %s: %s (%s، أبوظبي).' || E'\n' || '%s',
        area->>'labelAr', pool->>'nameAr', pool->>'areaAr', pool->>'mapUrl'
      );
    else
      draft := format(
        'Nearest Relax Fix training location from %s: %s (%s, Abu Dhabi).' || E'\n' || '%s',
        area->>'labelEn', pool->>'name', pool->>'area', pool->>'mapUrl'
      );
    end if;
    return jsonb_build_object(
      'handled', true,
      'state', 'presented_nearest_pool',
      'draft', draft,
      'scoreDelta', 10,
      'nearestPoolId', pool->>'id'
    );
  end if;

  if p_prior_state = 'awaiting_customer_area' or location_intent then
    draft := case when p_language = 'ar'
      then 'أكيد — عشان أحدد أقرب مسبح، أنت في أي منطقة؟'
      else 'Sure — which area are you in so I can pick the nearest pool?'
    end;
    return jsonb_build_object(
      'handled', true,
      'state', 'awaiting_customer_area',
      'draft', draft,
      'scoreDelta', 0,
      'nearestPoolId', null
    );
  end if;

  return jsonb_build_object('handled', false);
end;
$$;

-- Seed structured knowledge entries (queryable catalog).
DELETE FROM public.knowledge_entries
WHERE category = 'training_pool';

INSERT INTO public.knowledge_entries (category, language, question, content, is_active)
SELECT
  'training_pool',
  'en',
  pool->>'id',
  pool::text,
  true
FROM jsonb_array_elements(public.rf_training_pools()) pool;

INSERT INTO public.knowledge_entries (category, language, question, content, is_active)
VALUES (
  'training_pool',
  'en',
  'catalog',
  public.rf_training_pools()::text,
  true
);

REVOKE ALL ON FUNCTION public.rf_training_pools() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rf_match_customer_area(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rf_haversine_km(double precision, double precision, double precision, double precision) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rf_nearest_pool(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rf_location_turn(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rf_training_pools() TO service_role;
GRANT EXECUTE ON FUNCTION public.rf_match_customer_area(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.rf_haversine_km(double precision, double precision, double precision, double precision) TO service_role;
GRANT EXECUTE ON FUNCTION public.rf_nearest_pool(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.rf_location_turn(text, text, text) TO service_role;
