-- Geo safety gate for RADAR.
-- The owner approved 500m/2km/5km/8km tiers, but exact-meter classification must not ship from unverified pool coordinates.
-- Until the four pool coordinates are independently verified against approved map locations, keep geo classification area-level only.

create or replace function public.radar_fail_closed_unverified_geo()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  -- Keep only approved four-pool text/area mappings. Never invent meter precision.
  if new.area_hint = 'najda' then
    new.nearest_pool_id := 'najda-street';
    new.nearest_pool_name := 'ICS Al Najda';
    new.proximity_tier := 'AREA_ONLY';
  elsif new.area_hint = 'al_falah' then
    new.nearest_pool_id := 'ics-al-falah';
    new.nearest_pool_name := 'ICS Al Falah';
    new.proximity_tier := 'AREA_ONLY';
  elsif new.area_hint = 'khalifa_city' then
    new.nearest_pool_id := 'ics-khalifa';
    new.nearest_pool_name := 'ICS Khalifa';
    new.proximity_tier := 'AREA_ONLY';
  elsif new.area_hint = 'al_mushrif' then
    new.nearest_pool_id := 'ics-mushrif';
    new.nearest_pool_name := 'ICS Al Mushrif';
    new.proximity_tier := 'AREA_ONLY';
  else
    -- If the text did not establish one of the approved four areas, do not retain a guessed nearest pool.
    new.nearest_pool_id := null;
    new.nearest_pool_name := null;
    new.proximity_tier := null;
  end if;

  new.distance_m := null;
  return new;
end;
$function$;

drop trigger if exists radar_fail_closed_unverified_geo on public.radar_opportunities;
create trigger radar_fail_closed_unverified_geo
before insert or update of area_hint, nearest_pool_id, nearest_pool_name, distance_m, proximity_tier
on public.radar_opportunities
for each row execute function public.radar_fail_closed_unverified_geo();

-- Normalize only synthetic/test evidence in this migration chain; real historical rows are preserved.
update public.radar_opportunities
set distance_m = null,
    proximity_tier = case
      when area_hint in ('najda','al_falah','khalifa_city','al_mushrif') then 'AREA_ONLY'
      else null
    end,
    nearest_pool_id = case area_hint
      when 'najda' then 'najda-street'
      when 'al_falah' then 'ics-al-falah'
      when 'khalifa_city' then 'ics-khalifa'
      when 'al_mushrif' then 'ics-mushrif'
      else null
    end,
    nearest_pool_name = case area_hint
      when 'najda' then 'ICS Al Najda'
      when 'al_falah' then 'ICS Al Falah'
      when 'khalifa_city' then 'ICS Khalifa'
      when 'al_mushrif' then 'ICS Al Mushrif'
      else null
    end,
    updated_at = now()
where is_test = true;
