-- Follow-up hardening for Opportunity RADAR.
-- Keeps synthetic acceptance evidence out of live operational reporting.

create or replace function public.radar_force_test_low_priority()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if new.is_test then
    new.priority := 'LOW'::public.radar_priority;
  end if;
  return new;
end;
$function$;

drop trigger if exists radar_force_test_low_priority on public.radar_opportunities;
create trigger radar_force_test_low_priority
before insert or update of is_test, priority on public.radar_opportunities
for each row execute function public.radar_force_test_low_priority();

update public.radar_opportunities
set priority = 'LOW'::public.radar_priority,
    updated_at = now()
where is_test = true
  and priority <> 'LOW'::public.radar_priority;

create or replace function public.get_staff_radar_source_performance()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
begin
  if not public.is_active_staff(array['super_admin','admin','reception','coach']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  return coalesce(
    (
      select jsonb_agg(row_to_json(s))
      from (
        select
          o.source,
          count(*) as total,
          count(*) filter (where o.priority in ('HOT','WARM')) as qualified_leads,
          count(*) filter (where o.status in ('CONTACTED','CUSTOMER_REPLIED','BOOKING_REQUEST','BOOKED','PAID_CUSTOMER','ACTIONED')) as contacted,
          count(*) filter (where o.status in ('CUSTOMER_REPLIED','BOOKING_REQUEST','BOOKED','PAID_CUSTOMER')) as replied,
          count(*) filter (where o.status in ('BOOKING_REQUEST','BOOKED','PAID_CUSTOMER')) as booking_requests,
          count(*) filter (where o.status in ('BOOKED','PAID_CUSTOMER')) as booked,
          count(*) filter (where o.status = 'PAID_CUSTOMER') as paid_customers,
          case when count(*) filter (where o.priority in ('HOT','WARM')) > 0
            then round(100.0 * count(*) filter (where o.status = 'PAID_CUSTOMER') / count(*) filter (where o.priority in ('HOT','WARM')), 1)
            else 0
          end as conversion_rate_pct
        from public.radar_opportunities o
        where o.is_test = false
        group by o.source
        order by qualified_leads desc, total desc
      ) s
    ),
    '[]'::jsonb
  );
end;
$function$;

create or replace function public.get_staff_radar_pool_performance()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
begin
  if not public.is_active_staff(array['super_admin','admin','reception','coach']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  return coalesce(
    (
      select jsonb_agg(row_to_json(s) order by s.qualified_leads desc, s.total desc)
      from (
        select
          o.nearest_pool_id,
          o.nearest_pool_name,
          count(*) as total,
          count(*) filter (where o.priority = 'HOT') as hot,
          count(*) filter (where o.priority in ('HOT','WARM')) as qualified_leads,
          count(*) filter (where o.status in ('BOOKING_REQUEST','BOOKED','PAID_CUSTOMER')) as booking_requests,
          count(*) filter (where o.status in ('BOOKED','PAID_CUSTOMER')) as booked,
          count(*) filter (where o.status = 'PAID_CUSTOMER') as paid_customers,
          case when count(*) filter (where o.priority in ('HOT','WARM')) > 0
            then round(100.0 * count(*) filter (where o.status = 'PAID_CUSTOMER') / count(*) filter (where o.priority in ('HOT','WARM')), 1)
            else 0
          end as conversion_rate_pct
        from public.radar_opportunities o
        where o.is_test = false
          and o.nearest_pool_id is not null
        group by o.nearest_pool_id, o.nearest_pool_name
      ) s
    ),
    '[]'::jsonb
  );
end;
$function$;

create or replace function public.get_staff_radar_opportunities(p_status text default null, p_priority text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
begin
  if not public.is_active_staff(array['super_admin','admin','reception','coach']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'source', o.source,
          'sourceType', o.source_type,
          'sourceUrl', o.source_url,
          'discoveredAt', o.discovered_at,
          'textExcerpt', o.text_excerpt,
          'language', o.language,
          'locationHint', o.location_hint,
          'areaHint', o.area_hint,
          'serviceIntent', o.service_intent,
          'buyerIntentScore', o.buyer_intent_score,
          'priority', o.priority::text,
          'reason', o.reason,
          'status', o.status::text,
          'duplicateCount', o.duplicate_count,
          'nearestPoolId', o.nearest_pool_id,
          'nearestPoolName', o.nearest_pool_name,
          'distanceM', o.distance_m,
          'proximityTier', o.proximity_tier,
          'recommendedAction', case
            when o.status in ('ACTIONED','DISMISSED','NOT_RELEVANT','UNREACHABLE','LOST','PAID_CUSTOMER') then
              case when o.language = 'ar' then 'لا يوجد إجراء إضافي مطلوب حاليًا.' else 'No further action is needed right now.' end
            when o.status = 'BOOKED' then
              case when o.language = 'ar' then 'تم الحجز — تابع حتى إتمام الدفع.' else 'Booked — follow up through to payment.' end
            when o.status = 'BOOKING_REQUEST' then
              case when o.language = 'ar' then 'طلب حجز وارد — أكد الموعد والموقع مع العميل.' else 'Booking request in — confirm slot and location with the customer.' end
            when o.status = 'CUSTOMER_REPLIED' then
              case when o.language = 'ar' then 'رد العميل — استكمل المحادثة نحو تثبيت الحجز.' else 'Customer replied — continue the conversation toward booking.' end
            when o.status = 'CONTACTED' then
              case when o.language = 'ar' then 'تم التواصل — تابع إذا لم يرد العميل خلال يوم أو يومين.' else 'Contacted — follow up if there is no reply within a day or two.' end
            when o.priority = 'HOT' then
              case when o.language = 'ar' then 'نية قوية وقرب مناسب — راجع المصدر وتواصل يدويًا في أقرب وقت.' else 'Strong intent and useful proximity — review the source and reach out manually as soon as possible.' end
            when o.priority = 'WARM' then
              case when o.language = 'ar' then 'نية محتملة وقرب ممتد — راجع قبل التواصل.' else 'Possible intent in the extended local range — review before contacting.' end
            else
              case when o.language = 'ar' then 'صلة ضعيفة أو خارج النطاق المحلي — لا حاجة لإجراء.' else 'Weak relevance or outside the local range — no action needed.' end
          end,
          'lastSeenAt', o.last_seen_at
        )
        order by case o.priority when 'HOT' then 0 when 'WARM' then 1 else 2 end, o.discovered_at desc
      )
      from public.radar_opportunities o
      where o.is_test = false
        and (p_status is null or o.status::text = p_status)
        and (p_priority is null or o.priority::text = p_priority)
      limit 300
    ),
    '[]'::jsonb
  );
end;
$function$;
