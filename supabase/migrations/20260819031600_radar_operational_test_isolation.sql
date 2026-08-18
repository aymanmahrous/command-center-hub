-- Keep synthetic RADAR evidence for audit, but remove it from live operations.

create or replace function public.get_staff_radar_opportunities(p_status text default null, p_priority text default null)
returns jsonb
language plpgsql
stable security definer
set search_path = public, pg_temp
as $function$
begin
  if not public.is_active_staff(array['super_admin','admin','reception','coach']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id',o.id,'source',o.source,'sourceType',o.source_type,'sourceUrl',o.source_url,
        'discoveredAt',o.discovered_at,'textExcerpt',o.text_excerpt,'language',o.language,
        'locationHint',o.location_hint,'areaHint',o.area_hint,'serviceIntent',o.service_intent,
        'buyerIntentScore',o.buyer_intent_score,'priority',o.priority::text,'reason',o.reason,
        'status',o.status::text,'duplicateCount',o.duplicate_count,
        'nearestPoolId',o.nearest_pool_id,'nearestPoolName',o.nearest_pool_name,
        'distanceM',o.distance_m,'proximityTier',o.proximity_tier,
        'recommendedAction',case
          when o.status in ('ACTIONED','DISMISSED','NOT_RELEVANT','UNREACHABLE','LOST','PAID_CUSTOMER') then
            case when o.language='ar' then 'لا يوجد إجراء جديد مطلوب لهذه الحالة.' else 'No new action required for this status.' end
          when o.status='BOOKED' then case when o.language='ar' then 'تم الحجز — تابع حتى إتمام الدفع.' else 'Booked — follow through to payment.' end
          when o.status='BOOKING_REQUEST' then case when o.language='ar' then format('أكد الموعد في %s.',coalesce(o.nearest_pool_name,'الموقع الأنسب')) else format('Confirm a slot at %s.',coalesce(o.nearest_pool_name,'the best-fit location')) end
          when o.status='CUSTOMER_REPLIED' then case when o.language='ar' then 'رد العميل — استكمل المحادثة نحو الحجز.' else 'Customer replied — continue toward booking.' end
          when o.status='CONTACTED' then case when o.language='ar' then 'تم التواصل — تابع إذا لم يرد خلال يوم أو يومين.' else 'Contacted — follow up if no reply within a day or two.' end
          when o.priority='HOT' then case when o.language='ar' then format('فرصة قوية قرب %s — افتح المصدر وتواصل يدويًا سريعًا.',coalesce(o.nearest_pool_name,'أحد مواقعنا')) else format('Strong opportunity near %s — open the source and respond manually soon.',coalesce(o.nearest_pool_name,'one of our locations')) end
          when o.priority='WARM' then case when o.language='ar' then 'راجع الفرصة وحدد إن كانت تستحق تواصلًا شخصيًا.' else 'Review and decide whether a personal response is worthwhile.' end
          else case when o.language='ar' then 'صلة ضعيفة — لا حاجة لإجراء.' else 'Weak relevance — no action needed.' end
        end,
        'lastSeenAt',o.last_seen_at
      )
      order by case o.priority when 'HOT' then 0 when 'WARM' then 1 else 2 end, o.discovered_at desc
    )
    from public.radar_opportunities o
    where not o.is_test
      and (p_status is null or o.status::text = p_status)
      and (p_priority is null or o.priority::text = p_priority)
    limit 300
  ), '[]'::jsonb);
end;
$function$;

create or replace function public.get_push_worthy_events()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED' using errcode = '42501';
  end if;

  return coalesce((select jsonb_agg(item) from (
    select jsonb_build_object(
      'eventId','radar_hot_'||o.id,'category','radar_hot','section','radar',
      'titleAr','فرصة عميل جديدة 🔥','bodyAr',case when o.nearest_pool_name is not null then 'فرصة قوية قرب '||o.nearest_pool_name else 'تم رصد فرصة قوية قرب أحد مواقع Relax Fix.' end,
      'titleEn','New hot lead','bodyEn',case when o.nearest_pool_name is not null then 'Strong opportunity near '||o.nearest_pool_name else 'A strong opportunity near a Relax Fix location was spotted.' end
    ) item
    from public.radar_opportunities o
    where not o.is_test and o.priority='HOT' and o.status in('NEW','REVIEWED')
      and not exists(select 1 from public.push_delivery_log d where d.event_id='radar_hot_'||o.id)

    union all
    select jsonb_build_object('eventId','booking_new_'||b.id,'category','booking_new','section','planner','titleAr','طلب حجز جديد','bodyAr','هناك عميل جديد يحتاج مراجعة طلب الحجز.','titleEn','New booking request','bodyEn','A new booking request needs your review.')
    from public.booking_requests b where b.status='pending'
      and not exists(select 1 from public.push_delivery_log d where d.event_id='booking_new_'||b.id)

    union all
    select jsonb_build_object('eventId','handoff_'||c.id,'category','handoff','section','inbox','titleAr','عميل يحتاج ردك','bodyAr','هناك محادثة تحتاج تدخلك.','titleEn','Customer needs your reply','bodyEn','A conversation needs your attention.')
    from public.conversations c where c.mode in('human_required','human_takeover')
      and not exists(select 1 from public.push_delivery_log d where d.event_id='handoff_'||c.id)

    union all
    select jsonb_build_object('eventId','publish_failed_'||ci.id,'category','publish_failed','section','content','titleAr','مشكلة في نشر منشور','bodyAr','تعذر نشر أحد المنشورات ويحتاج مراجعتك.','titleEn','Publishing problem','bodyEn','A post failed to publish and needs your review.')
    from public.content_items ci where ci.status='failed'
      and not exists(select 1 from public.push_delivery_log d where d.event_id='publish_failed_'||ci.id)
  ) events limit 50), '[]'::jsonb);
end;
$function$;

create or replace function public.get_staff_attention_center()
returns jsonb
language plpgsql
stable security definer
set search_path = public, pg_temp
as $function$
begin
  if not public.is_active_staff(array['super_admin','admin','reception','coach','content_manager']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  return coalesce((select jsonb_agg(item order by case item->>'severity' when 'urgent' then 0 when 'warning' then 1 else 2 end,(item->>'occurredAt')::timestamptz desc) from (
    select jsonb_build_object('id','radar_hot_'||o.id,'category','radar_hot','severity','urgent','title',case when o.language='ar' then 'فرصة ساخنة في الرادار' else 'HOT Radar opportunity' end,'detail',left(o.text_excerpt,160),'occurredAt',o.discovered_at,'targetSection','radar','targetId',o.id::text) item
    from public.radar_opportunities o where not o.is_test and o.priority='HOT' and o.status in('NEW','REVIEWED')
    union all select jsonb_build_object('id','booking_new_'||b.id,'category','booking_new','severity','warning','title','New booking request','detail',b.full_name||coalesce(' · '||b.category,''),'occurredAt',b.created_at,'targetSection','planner','targetId',b.id::text) from public.booking_requests b where b.status='pending'
    union all select jsonb_build_object('id','handoff_'||c.id,'category','handoff','severity','urgent','title','Customer waiting for a human reply','detail',coalesce(nullif(btrim(l.full_name),''),nullif(btrim(l.name),''),'Customer')||coalesce(' · '||c.human_handoff_reason,''),'occurredAt',c.updated_at,'targetSection','inbox','targetId',c.id::text) from public.conversations c join public.leads l on l.id=c.lead_id where c.mode in('human_required','human_takeover')
    union all select jsonb_build_object('id','publish_failed_'||ci.id,'category','publish_failed','severity','urgent','title','A scheduled post failed to publish','detail',coalesce(nullif(ci.topic,''),ci.platform),'occurredAt',ci.updated_at,'targetSection','content','targetId',ci.id::text) from public.content_items ci where ci.status='failed'
    union all select jsonb_build_object('id','publish_awaiting_approval_'||(bj.payload->>'contentItemId'),'category','publish_awaiting_approval','severity','warning','title','A post is waiting for your approval','detail','Publishing is paused until this is approved or rejected in the publishing tool.','occurredAt',bj.updated_at,'targetSection','content','targetId',bj.payload->>'contentItemId') from public.background_jobs bj where bj.job_type='publish_content' and bj.status='processing' and bj.updated_at<now()-interval '10 minutes'
    union all select jsonb_build_object('id','job_failed_'||bj.id,'category','job_failed','severity','warning','title','A background task needs attention','detail',coalesce(bj.job_type,'unknown')||': '||left(coalesce(bj.last_error,''),140),'occurredAt',bj.updated_at,'targetSection','integrations','targetId',bj.id::text) from public.background_jobs bj where bj.job_type not in('publish_content','radar_hot_opportunity') and bj.status='dead' and bj.updated_at>now()-interval '24 hours'
  ) events limit 50), '[]'::jsonb);
end;
$function$;

create or replace function public.get_staff_radar_pool_performance()
returns jsonb
language plpgsql
stable security definer
set search_path = public, pg_temp
as $function$
begin
  if not public.is_active_staff(array['super_admin','admin','reception','coach']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(row_to_json(s)) from (
    select nearest_pool_id as pool_id, nearest_pool_name as pool_name,
      count(*) as total,
      count(*) filter(where priority='HOT') as hot,
      count(*) filter(where priority='WARM') as warm,
      count(*) filter(where status in('BOOKING_REQUEST','BOOKED','PAID_CUSTOMER')) as booking_requests,
      count(*) filter(where status in('BOOKED','PAID_CUSTOMER')) as booked,
      count(*) filter(where status='PAID_CUSTOMER') as paid_customers
    from public.radar_opportunities
    where not is_test and nearest_pool_id is not null
    group by nearest_pool_id, nearest_pool_name
    order by paid_customers desc, booking_requests desc, hot desc, total desc
  ) s), '[]'::jsonb);
end;
$function$;
