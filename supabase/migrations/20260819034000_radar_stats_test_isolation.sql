-- Final reporting isolation for Opportunity RADAR.
-- Synthetic/test evidence remains preserved in the table but must never affect live business metrics.

create or replace function public.get_staff_radar_stats()
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

  return jsonb_build_object(
    'candidatesIngested', (select count(*) from public.radar_opportunities where is_test = false),
    'duplicatesRemoved', (select coalesce(sum(duplicate_count), 0) from public.radar_opportunities where is_test = false),
    'hot', (select count(*) from public.radar_opportunities where is_test = false and priority = 'HOT'),
    'warm', (select count(*) from public.radar_opportunities where is_test = false and priority = 'WARM'),
    'low', (select count(*) from public.radar_opportunities where is_test = false and priority = 'LOW'),
    'actioned', (select count(*) from public.radar_opportunities where is_test = false and status = 'ACTIONED'),
    'dismissed', (select count(*) from public.radar_opportunities where is_test = false and status = 'DISMISSED'),
    'bySource', coalesce(
      (
        select jsonb_object_agg(source, cnt)
        from (
          select source, count(*) as cnt
          from public.radar_opportunities
          where is_test = false
          group by source
          order by count(*) desc
          limit 20
        ) s
      ),
      '{}'::jsonb
    )
  );
end;
$function$;

create or replace function public.get_staff_command_center()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_new_leads bigint;
  v_hot_leads bigint;
  v_human_replies bigint;
  v_follow_ups_due bigint;
  v_posts_scheduled bigint;
  v_hot_radar bigint;
  v_posts_awaiting_approval bigint;
  v_posts_failed bigint;
  v_priority jsonb;
begin
  if not public.is_active_staff(array['super_admin','admin','reception','coach']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  select count(*) into v_new_leads from public.leads where stage in ('new','contacted');
  select count(*) into v_hot_leads from public.leads where score >= 80;
  select count(*) into v_human_replies from public.conversations where mode in ('human_takeover','human_required');
  select count(*) into v_follow_ups_due from public.leads where next_follow_up_at is not null and next_follow_up_at <= now() and do_not_contact = false;
  select count(*) into v_posts_scheduled from public.content_items where status = 'scheduled';

  select count(*) into v_hot_radar
  from public.radar_opportunities
  where is_test = false
    and priority = 'HOT'
    and status in ('NEW','REVIEWED');

  select count(*) into v_posts_awaiting_approval
  from public.background_jobs
  where job_type = 'publish_content' and status = 'processing' and updated_at < now() - interval '10 minutes';

  select count(*) into v_posts_failed from public.content_items where status = 'failed';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'name', p.full_name,
        'intent', coalesce(p.intent, p.service, 'Unclassified'),
        'channel', p.source_channel::text,
        'score', p.score,
        'humanRequired', p.human_required,
        'nextFollowUpAt', p.next_follow_up_at
      )
      order by p.human_required desc, p.score desc, p.updated_at desc
    ),
    '[]'::jsonb
  ) into v_priority
  from (
    select *
    from public.leads
    where score >= 80 or human_required = true
    order by human_required desc, score desc, updated_at desc
    limit 20
  ) p;

  return jsonb_build_object(
    'metrics', jsonb_build_object(
      'newLeads', v_new_leads,
      'hotLeads', v_hot_leads,
      'humanReplies', v_human_replies,
      'followUpsDue', v_follow_ups_due,
      'postsScheduled', v_posts_scheduled,
      'hotRadarOpportunities', v_hot_radar,
      'postsAwaitingApproval', v_posts_awaiting_approval,
      'postsFailed', v_posts_failed
    ),
    'priorityQueue', v_priority,
    'generatedAt', now()
  );
end;
$function$;
