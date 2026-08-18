-- Keep scoring consistent with the fail-closed area-only geo policy.

create or replace function public.radar_fail_closed_unverified_geo()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_old_geo_points integer := case new.proximity_tier
    when 'VERY_CLOSE' then 30
    when 'NEAR' then 25
    when 'LOCAL' then 20
    when 'EXTENDED' then 10
    when 'AREA_ONLY' then 20
    else 0
  end;
  v_approved_area boolean := new.area_hint in ('najda','al_falah','khalifa_city','al_mushrif');
begin
  if v_approved_area then
    -- Replace any provisional meter-based geo points with the trusted area-only weight (20).
    new.buyer_intent_score := least(100, greatest(0, new.buyer_intent_score - v_old_geo_points + 20));
    if new.area_hint = 'najda' then
      new.nearest_pool_id := 'najda-street'; new.nearest_pool_name := 'ICS Al Najda';
    elsif new.area_hint = 'al_falah' then
      new.nearest_pool_id := 'ics-al-falah'; new.nearest_pool_name := 'ICS Al Falah';
    elsif new.area_hint = 'khalifa_city' then
      new.nearest_pool_id := 'ics-khalifa'; new.nearest_pool_name := 'ICS Khalifa';
    else
      new.nearest_pool_id := 'ics-mushrif'; new.nearest_pool_name := 'ICS Al Mushrif';
    end if;
    new.proximity_tier := 'AREA_ONLY';
    -- Preserve HOT only when the resulting score still satisfies the existing threshold.
    if new.buyer_intent_score >= 70 then
      new.priority := 'HOT'::public.radar_priority;
    else
      new.priority := 'LOW'::public.radar_priority;
    end if;
  else
    -- Outside the four approved areas, remove provisional geo points and fail closed to LOW.
    new.buyer_intent_score := greatest(0, new.buyer_intent_score - v_old_geo_points);
    new.nearest_pool_id := null;
    new.nearest_pool_name := null;
    new.proximity_tier := null;
    new.priority := 'LOW'::public.radar_priority;
  end if;

  new.distance_m := null;
  if new.is_test then
    new.priority := 'LOW'::public.radar_priority;
  end if;
  return new;
end;
$function$;
