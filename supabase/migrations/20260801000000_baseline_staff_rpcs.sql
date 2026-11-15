CREATE OR REPLACE FUNCTION public.approve_and_schedule_staff_content_item(p_content_item_id uuid, p_scheduled_for timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  approval_result jsonb;
  schedule_result jsonb;
  v_platform text;
  v_account_or_page text;
  v_job_id uuid;
BEGIN
  BEGIN
    approval_result := public.transition_staff_content_item(p_content_item_id,'approve',NULL);
    IF COALESCE((approval_result->>'success')::boolean,false) IS NOT TRUE THEN RETURN approval_result; END IF;
    schedule_result := public.transition_staff_content_item(p_content_item_id,'schedule',p_scheduled_for);
    IF COALESCE((schedule_result->>'success')::boolean,false) IS NOT TRUE THEN RAISE EXCEPTION 'SCHEDULE_AFTER_APPROVAL_FAILED'; END IF;
    SELECT lower(btrim(platform)) INTO v_platform FROM public.content_items WHERE id=p_content_item_id;
    IF v_platform NOT IN ('facebook','instagram') THEN RAISE EXCEPTION 'PLATFORM_NOT_SUPPORTED'; END IF;
    v_account_or_page := CASE WHEN v_platform='facebook' THEN '1164107840123575' ELSE '17841400516801494' END;
    SELECT bj.id INTO v_job_id
    FROM public.background_jobs bj
    WHERE bj.job_type='publish_content'
      AND bj.payload->>'contentItemId'=p_content_item_id::text
      AND bj.status='queued'
      AND bj.next_retry_at=p_scheduled_for
    ORDER BY bj.created_at DESC,bj.id DESC LIMIT 1;
    IF v_job_id IS NULL THEN RAISE EXCEPTION 'SCHEDULE_PUBLISH_JOB_NOT_FOUND'; END IF;
    UPDATE public.background_jobs
    SET payload=payload || jsonb_build_object(
      'platform',v_platform,
      'pageId',CASE WHEN v_platform='facebook' THEN v_account_or_page ELSE NULL END,
      'accountId',CASE WHEN v_platform='instagram' THEN v_account_or_page ELSE NULL END,
      'source','staff_schedule',
      'idempotencyKey',p_content_item_id::text
    ),updated_at=now()
    WHERE id=v_job_id;
    RETURN schedule_result || jsonb_build_object('publishJobId',v_job_id);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success',false,'code','APPROVE_AND_SCHEDULE_FAILED');
  END;
END;
$function$
;

-- ============================================================================
-- Function: approve_staff_content_batch(p_batch_id uuid)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.approve_staff_content_batch(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_item public.content_items%rowtype;
  v_media public.media_assets%rowtype;
  v_job public.background_jobs%rowtype;
  v_job_id uuid;
  v_previous_status public.content_status;
  v_previous_scheduled_for timestamptz;
  v_platform text;
  v_planned timestamptz;
  v_page_or_account text;
  v_publish_ready boolean;
  v_approved integer := 0;
  v_scheduled integer := 0;
  v_already_approved integer := 0;
  v_already_prepared integer := 0;
  v_skipped integer := 0;
  v_total integer := 0;
  v_results jsonb := '[]'::jsonb;
  v_result_code text;
  v_now timestamptz := now();
begin
  v_job_id := null;
  if not public.is_active_staff(array['super_admin']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  if p_batch_id is null then
    return jsonb_build_object('success', false, 'code', 'INVALID_BATCH_ID');
  end if;

  select count(*)::integer
  into v_total
  from public.content_items
  where batch_id = p_batch_id;

  if v_total = 0 then
    return jsonb_build_object('success', false, 'code', 'BATCH_NOT_FOUND', 'batchId', p_batch_id);
  end if;

  perform 1
  from public.background_jobs bj
  join public.content_items ci on ci.id = (bj.payload->>'contentItemId')::uuid
  where ci.batch_id = p_batch_id
    and bj.job_type = 'publish_content'
    and bj.status in ('queued', 'processing', 'retrying')
  order by bj.id
  for update;

  for v_item in
    select *
    from public.content_items
    where batch_id = p_batch_id
    order by created_at asc, id asc
    for update
  loop
    v_platform := lower(btrim(coalesce(v_item.platform, '')));
    v_planned := v_item.planned_for;
    v_publish_ready := false;
    v_result_code := null;
    v_job_id := null;

    if v_item.status = 'scheduled'
       and v_platform in ('facebook', 'instagram')
       and v_item.scheduled_for is not distinct from v_planned
       and v_planned is not null
       and v_planned > v_now then
      select bj.*
      into v_job
      from public.background_jobs bj
      where bj.job_type = 'publish_content'
        and bj.payload->>'contentItemId' = v_item.id::text
        and bj.status in ('queued', 'retrying', 'processing')
        and lower(coalesce(bj.payload->>'platform', '')) = v_platform
        and coalesce(bj.next_retry_at, bj.created_at) = v_planned
      order by bj.created_at desc, bj.id desc
      limit 1;

      if found then
        v_already_prepared := v_already_prepared + 1;
        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'contentItemId', v_item.id,
          'code', 'ALREADY_PREPARED',
          'status', v_item.status::text,
          'scheduledFor', v_item.scheduled_for,
          'jobId', v_job.id
        ));
        continue;
      end if;
    end if;

    if v_item.status = 'approved' and v_platform not in ('facebook', 'instagram') then
      v_already_approved := v_already_approved + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'contentItemId', v_item.id,
        'code', 'ALREADY_APPROVED',
        'status', v_item.status::text
      ));
      continue;
    elsif v_item.status not in ('draft', 'generated', 'needs_review', 'approved', 'scheduled') then
      v_skipped := v_skipped + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'contentItemId', v_item.id,
        'code', 'INVALID_TRANSITION',
        'status', v_item.status::text
      ));
      continue;
    end if;

    v_previous_status := v_item.status;
    v_previous_scheduled_for := v_item.scheduled_for;

    update public.background_jobs
    set status = 'dead',
        last_error = case
          when v_item.status = 'approved' then 'CONTENT_REPUBLISH_PREP'
          else 'CONTENT_NOT_SCHEDULED'
        end,
        updated_at = v_now
    where job_type = 'publish_content'
      and payload->>'contentItemId' = v_item.id::text
      and status in ('queued', 'processing', 'retrying');

    if v_platform not in ('facebook', 'instagram') then
      update public.content_items
      set status = 'approved',
          scheduled_for = null,
          updated_at = v_now
      where id = v_item.id
      returning * into v_item;

      v_result_code := 'APPROVED';
      v_approved := v_approved + 1;
    else
      v_publish_ready := char_length(btrim(coalesce(v_item.caption, ''))) >= 2
        and v_item.published_at is null
        and not exists (
          select 1
          from public.content_publication_receipts pr
          where pr.content_item_id = v_item.id
            and lower(pr.platform) = v_platform
            and pr.status = 'published'
        );

      if v_publish_ready and v_platform = 'instagram' then
        if v_item.media_asset_id is null then
          v_publish_ready := false;
        else
          select * into v_media
          from public.media_assets
          where id = v_item.media_asset_id;

          if not found
             or coalesce(v_media.category, 'unclassified') <> 'swimming_business'
             or coalesce(v_media.publishability_status, 'blocked') <> 'ready_for_review'
             or coalesce(v_media.consent_status, 'unknown') <> 'consent_confirmed' then
            v_publish_ready := false;
          end if;
        end if;
      end if;

      if not v_publish_ready
         or v_planned is null
         or v_planned <= v_now
         or v_planned > v_now + interval '366 days' then
        update public.content_items
        set status = 'approved',
            scheduled_for = null,
            updated_at = v_now
        where id = v_item.id
        returning * into v_item;

        v_result_code := case
          when v_planned is null or v_planned <= v_now or v_planned > v_now + interval '366 days'
            then 'APPROVED_SCHEDULE_SKIPPED'
          else 'APPROVED_NOT_PUBLISH_READY'
        end;
        v_approved := v_approved + 1;
      else
        perform pg_advisory_xact_lock(hashtextextended(v_item.id::text, 0));

        if v_platform = 'facebook' then
          v_page_or_account := '1164107840123575';
        else
          v_page_or_account := '17841400516801494';
        end if;

        select bj.*
        into v_job
        from public.background_jobs bj
        where bj.job_type = 'publish_content'
          and bj.payload->>'contentItemId' = v_item.id::text
          and bj.status in ('queued', 'retrying', 'processing')
        order by bj.created_at desc, bj.id desc
        limit 1
        for update;

        if found
           and v_item.status = 'scheduled'
           and v_item.scheduled_for is not distinct from v_planned
           and lower(coalesce(v_job.payload->>'platform', '')) = v_platform
           and coalesce(v_job.next_retry_at, v_job.created_at) = v_planned then
          v_result_code := 'ALREADY_PREPARED';
          v_already_prepared := v_already_prepared + 1;
          v_job_id := v_job.id;
        else
          if found then
            update public.background_jobs
            set status = 'dead',
                last_error = 'BATCH_APPROVE_RESCHEDULED',
                updated_at = v_now
            where id = v_job.id;
          end if;

          update public.content_items
          set status = 'scheduled',
              scheduled_for = v_planned,
              updated_at = v_now
          where id = v_item.id
          returning * into v_item;

          insert into public.background_jobs (
            job_type, status, payload, next_retry_at, created_at, updated_at
          ) values (
            'publish_content',
            'queued',
            jsonb_build_object(
              'contentItemId', v_item.id,
              'platform', v_platform,
              'pageId', case when v_platform = 'facebook' then v_page_or_account else null end,
              'accountId', case when v_platform = 'instagram' then v_page_or_account else null end,
              'source', 'batch_approve_scheduled',
              'idempotencyKey', v_item.id::text
            ),
            v_planned,
            v_now,
            v_now
          )
          returning * into v_job;

          v_job_id := v_job.id;
          v_result_code := 'SCHEDULED_FOR_PUBLISH';
          v_scheduled := v_scheduled + 1;
        end if;
      end if;
    end if;

    insert into public.audit_logs (
      actor_id, actor_type, action, entity_type, entity_id, detail
    ) values (
      auth.uid(),
      'user',
      'content_item_transitioned',
      'content_item',
      v_item.id,
      jsonb_build_object(
        'requestedAction', case
          when v_result_code = 'SCHEDULED_FOR_PUBLISH' then 'approve_and_schedule'
          when v_result_code = 'ALREADY_PREPARED' then 'approve_schedule_idempotent'
          else 'approve'
        end,
        'batchId', p_batch_id,
        'previousStatus', v_previous_status::text,
        'nextStatus', v_item.status::text,
        'previousScheduledFor', v_previous_scheduled_for,
        'nextScheduledFor', v_item.scheduled_for,
        'plannedFor', v_planned,
        'platform', v_platform,
        'resultCode', v_result_code,
        'publishJobId', v_job_id,
        'publishPrepOnly', true
      )
    );

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'contentItemId', v_item.id,
      'code', v_result_code,
      'status', v_item.status::text,
      'scheduledFor', v_item.scheduled_for,
      'plannedFor', v_planned,
      'jobId', v_job_id
    ));
  end loop;

  return jsonb_build_object(
    'success', true,
    'batchId', p_batch_id,
    'approvedCount', v_approved,
    'scheduledCount', v_scheduled,
    'alreadyApprovedCount', v_already_approved,
    'alreadyPreparedCount', v_already_prepared,
    'skippedCount', v_skipped,
    'results', v_results
  );
end;
$function$
;

-- ============================================================================
-- Function: get_staff_bookings()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_staff_bookings()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.is_active_staff(array['super_admin','admin','reception','coach']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  return coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at desc) from (select id, full_name, phone, normalized_phone, gender, category, location, other_location, swam_before, fear_of_water, training_type, requested_date, requested_time, status, created_at, updated_at from public.booking_requests order by created_at desc limit 500) b), '[]'::jsonb);
end;
$function$
;

-- ============================================================================
-- Function: get_staff_content_automation_status()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_staff_content_automation_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.is_active_staff(array['super_admin','admin','content_manager']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'queue', jsonb_build_object(
      'mediaQueued', (select count(*) from public.background_jobs where job_type = 'generate_content_media' and status = 'queued'),
      'mediaProcessing', (select count(*) from public.background_jobs where job_type = 'generate_content_media' and status = 'processing'),
      'mediaRetrying', (select count(*) from public.background_jobs where job_type = 'generate_content_media' and status = 'retrying'),
      'mediaDead', (select count(*) from public.background_jobs where job_type = 'generate_content_media' and status = 'dead'),
      'publishQueued', (select count(*) from public.background_jobs where job_type = 'publish_content' and status = 'queued'),
      'publishProcessing', (select count(*) from public.background_jobs where job_type = 'publish_content' and status = 'processing'),
      'publishRetrying', (select count(*) from public.background_jobs where job_type = 'publish_content' and status = 'retrying'),
      'publishDead', (select count(*) from public.background_jobs where job_type = 'publish_content' and status = 'dead'),
      'ambiguousPublications', (select count(*) from public.content_publication_receipts where status = 'ambiguous')
    ),
    'latestRuns', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'source', r.source,
            'status', r.status,
            'mediaAttempts', r.media_attempts,
            'mediaProcessed', r.media_processed,
            'publishAttempts', r.publish_attempts,
            'publishProcessed', r.publish_processed,
            'summary', r.summary,
            'error', r.error,
            'startedAt', r.started_at,
            'finishedAt', r.finished_at
          )
          order by r.started_at desc, r.id desc
        )
        from (
          select *
          from public.content_automation_runs
          order by started_at desc, id desc
          limit 20
        ) r
      ),
      '[]'::jsonb
    )
  );
end;
$function$
;

-- ============================================================================
-- Function: get_staff_conversation_messages(p_conversation_id uuid)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_staff_conversation_messages(p_conversation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.is_active_staff(array['super_admin','admin','reception','coach']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  if not exists (select 1 from public.conversations where id = p_conversation_id) then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'conversationId', m.conversation_id,
          'direction', m.direction,
          'authorType', m.author_type,
          'body', m.body,
          'safetyClassification', m.safety_classification,
          'createdAt', m.created_at
        )
        order by m.created_at asc, m.id asc
      )
      from (
        select *
        from public.messages
        where conversation_id = p_conversation_id
        order by created_at desc, id desc
        limit 200
      ) m
    ),
    '[]'::jsonb
  );
end;
$function$
;

-- ============================================================================
-- Function: get_staff_crm_leads()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_staff_crm_leads()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.is_active_staff(array['super_admin','admin','reception','coach']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', l.id,
          'name', coalesce(nullif(btrim(l.full_name), ''), nullif(btrim(l.name), ''), 'Unknown'),
          'phone', coalesce(l.normalized_phone, l.phone),
          'channel', l.source_channel::text,
          'stage', l.stage::text,
          'score', l.score,
          'language', l.language,
          'intent', coalesce(l.intent, l.service, 'Unclassified'),
          'fearOfWater', l.fear_of_water,
          'lastActivityAt', coalesce(l.updated_at, l.created_at),
          'nextFollowUpAt', l.next_follow_up_at,
          'humanRequired', l.human_required,
          'doNotContact', l.do_not_contact
        )
        order by coalesce(l.updated_at, l.created_at) desc
      )
      from (
        select *
        from public.leads
        order by coalesce(updated_at, created_at) desc
        limit 500
      ) l
    ),
    '[]'::jsonb
  );
end;
$function$
;

-- ============================================================================
-- Function: get_staff_growth_analytics()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_staff_growth_analytics()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_views bigint;
  v_dms bigint;
  v_qualified bigint;
  v_booking_requests bigint;
  v_published bigint;
  v_content_items bigint;
begin
  if not public.is_active_staff(array['super_admin','admin','reception','coach','content_manager']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  select
    coalesce(sum(latest.views), 0),
    coalesce(sum(latest.dm_count), 0)
  into v_views, v_dms
  from (
    select distinct on (content_item_id)
      content_item_id,
      views,
      dm_count
    from public.content_metrics
    order by content_item_id, recorded_at desc, id desc
  ) latest;

  select count(*) into v_qualified
  from public.leads
  where stage in ('qualified','booking_intent','booked','customer');

  select count(*) into v_booking_requests
  from public.booking_requests;

  select count(*) into v_published
  from public.content_items
  where status = 'published';

  select count(*) into v_content_items
  from public.content_items;

  return jsonb_build_object(
    'views', v_views,
    'dms', v_dms,
    'qualifiedLeads', v_qualified,
    'bookingRequests', v_booking_requests,
    'publishedItems', v_published,
    'contentItems', v_content_items,
    'attributionReady', false,
    'note', 'Views and DMs use the latest recorded metric snapshot per content item. CRM stages and booking requests are real totals. Cross-entity attribution is not claimed until provider and campaign attribution links are populated.'
  );
end;
$function$
;

-- ============================================================================
-- Function: get_staff_operations_queue()
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_staff_operations_queue()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_follow_ups jsonb;
  v_background_jobs jsonb;
  v_lesson_booking_alerts jsonb;
  v_staff_role text;
begin
  if not public.is_active_staff(array['super_admin','admin','reception','coach']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  select sp.role::text
  into v_staff_role
  from public.staff_profiles sp
  where sp.id = auth.uid()
    and sp.active = true;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', f.id,
        'leadId', f.lead_id,
        'leadName', coalesce(nullif(btrim(l.full_name), ''), nullif(btrim(l.name), ''), 'Unknown'),
        'conversationId', f.conversation_id,
        'attemptNumber', f.attempt_number,
        'scheduledFor', f.scheduled_for,
        'status', f.status::text,
        'stoppedReason', f.stopped_reason,
        'createdAt', f.created_at
      )
      order by f.scheduled_for asc, f.id asc
    ),
    '[]'::jsonb
  ) into v_follow_ups
  from (
    select *
    from public.follow_up_jobs
    order by scheduled_for desc, id desc
    limit 250
  ) f
  join public.leads l on l.id = f.lead_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', j.id,
        'jobType', j.job_type,
        'status', j.status::text,
        'attemptCount', j.attempt_count,
        'nextRetryAt', j.next_retry_at,
        'lastError', case
          when v_staff_role = 'coach' and j.last_error is not null then 'JOB_FAILED'
          else j.last_error
        end,
        'createdAt', j.created_at,
        'updatedAt', j.updated_at
      )
      order by j.created_at desc, j.id desc
    ),
    '[]'::jsonb
  ) into v_background_jobs
  from (
    select *
    from public.background_jobs
    order by created_at desc, id desc
    limit 250
  ) j;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'bookingRequestId', b.booking_request_id,
        'conversationId', b.conversation_id,
        'status', b.status,
        'startsAt', b.starts_at,
        'updatedAt', b.updated_at
      )
      order by b.updated_at desc, b.id desc
    ),
    '[]'::jsonb
  ) into v_lesson_booking_alerts
  from (
    select id, booking_request_id, conversation_id, status, starts_at, updated_at
    from public.rf_lesson_bookings
    where status in ('pending_gcal', 'failed')
    order by updated_at desc, id desc
    limit 250
  ) b;

  return jsonb_build_object(
    'followUps', v_follow_ups,
    'backgroundJobs', v_background_jobs,
    'lessonBookingAlerts', v_lesson_booking_alerts,
    'generatedAt', now()
  );
end;
$function$
;

-- ============================================================================
-- Function: set_staff_conversation_mode(p_conversation_id uuid, p_mode text)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_staff_conversation_mode(p_conversation_id uuid, p_mode text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_conversation public.conversations%rowtype;
  v_previous_mode text;
begin
  if not public.is_active_staff(array['super_admin','admin','reception']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  if p_mode not in ('ai_active','human_takeover','human_required','paused') then
    return jsonb_build_object('success', false, 'code', 'INVALID_MODE');
  end if;

  select * into v_conversation
  from public.conversations
  where id = p_conversation_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  end if;

  v_previous_mode := v_conversation.mode::text;
  if v_previous_mode = p_mode then
    return jsonb_build_object(
      'success', true,
      'conversationId', v_conversation.id,
      'mode', v_conversation.mode::text,
      'changed', false
    );
  end if;

  update public.conversations
  set mode = p_mode::public.conversation_mode,
      updated_at = now()
  where id = p_conversation_id
  returning * into v_conversation;

  update public.leads
  set human_required = case
        when p_mode in ('human_takeover','human_required') then true
        when p_mode = 'ai_active' then false
        else human_required
      end,
      updated_at = now()
  where id = v_conversation.lead_id;

  insert into public.audit_logs (
    actor_id, actor_type, action, entity_type, entity_id, detail
  ) values (
    auth.uid(), 'user', 'conversation_mode_updated', 'conversation', v_conversation.id,
    jsonb_build_object('previousMode', v_previous_mode, 'nextMode', v_conversation.mode::text)
  );

  return jsonb_build_object(
    'success', true,
    'conversationId', v_conversation.id,
    'mode', v_conversation.mode::text,
    'changed', true
  );
end;
$function$
;

-- ============================================================================
-- Function: transition_staff_content_item(p_content_item_id uuid, p_action text, p_scheduled_for timestamp with time zone DEFAULT NULL::timestamp with time zone)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.transition_staff_content_item(p_content_item_id uuid, p_action text, p_scheduled_for timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_item public.content_items%rowtype;
  v_previous_status public.content_status;
  v_previous_scheduled_for timestamptz;
  v_effective_scheduled_for timestamptz;
  v_platform text;
  v_page_or_account text;
begin
  if not public.is_active_staff(array['super_admin','admin','content_manager']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  perform 1
  from public.background_jobs
  where job_type = 'publish_content'
    and payload->>'contentItemId' = p_content_item_id::text
    and status in ('queued','processing','retrying')
  order by id
  for update;

  select * into v_item
  from public.content_items
  where id = p_content_item_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  end if;

  v_previous_status := v_item.status;
  v_previous_scheduled_for := v_item.scheduled_for;

  case p_action
    when 'approve' then
      if not public.is_active_staff(array['super_admin']) then
        raise exception 'OWNER_APPROVAL_REQUIRED' using errcode = '42501';
      end if;
      if v_item.status not in ('draft','generated','needs_review','approved') then
        return jsonb_build_object('success', false, 'code', 'INVALID_TRANSITION', 'status', v_item.status::text);
      end if;
      update public.background_jobs
      set status = 'dead', last_error = 'CONTENT_NOT_SCHEDULED', updated_at = now()
      where job_type = 'publish_content'
        and payload->>'contentItemId' = v_item.id::text
        and status in ('queued','processing','retrying');
      update public.content_items
      set status = 'approved', scheduled_for = null, updated_at = now()
      where id = v_item.id
      returning * into v_item;

    when 'return_to_review' then
      if v_item.status not in ('draft','generated','needs_review','approved','scheduled','failed') then
        return jsonb_build_object('success', false, 'code', 'INVALID_TRANSITION', 'status', v_item.status::text);
      end if;
      update public.background_jobs
      set status = 'dead', last_error = 'CONTENT_RETURNED_TO_REVIEW', updated_at = now()
      where job_type = 'publish_content'
        and payload->>'contentItemId' = v_item.id::text
        and status in ('queued','processing','retrying');
      update public.content_items
      set status = 'needs_review', scheduled_for = null, updated_at = now()
      where id = v_item.id
      returning * into v_item;

    when 'schedule' then
      if v_item.status not in ('approved','scheduled') then
        return jsonb_build_object('success', false, 'code', 'APPROVAL_REQUIRED', 'status', v_item.status::text);
      end if;
      if p_scheduled_for is null or p_scheduled_for <= now() then
        return jsonb_build_object('success', false, 'code', 'INVALID_SCHEDULE_TIME');
      end if;
      if p_scheduled_for > now() + interval '366 days' then
        return jsonb_build_object('success', false, 'code', 'SCHEDULE_TOO_FAR');
      end if;

      v_platform := lower(btrim(v_item.platform));
      if v_platform not in ('facebook','instagram') then
        return jsonb_build_object('success', false, 'code', 'PLATFORM_NOT_SUPPORTED');
      end if;
      if v_platform = 'facebook' then
        v_page_or_account := '1164107840123575';
      else
        v_page_or_account := '17841400516801494';
      end if;

      update public.background_jobs
      set status = 'dead', last_error = 'CONTENT_RESCHEDULED', updated_at = now()
      where job_type = 'publish_content'
        and payload->>'contentItemId' = v_item.id::text
        and status in ('queued','processing','retrying');

      update public.content_items
      set status = 'scheduled', scheduled_for = p_scheduled_for, updated_at = now()
      where id = v_item.id
      returning * into v_item;

      insert into public.background_jobs (job_type, status, payload, next_retry_at)
      values (
        'publish_content',
        'queued',
        jsonb_build_object(
          'contentItemId', v_item.id,
          'platform', v_platform,
          'pageId', case when v_platform = 'facebook' then v_page_or_account else null end,
          'accountId', case when v_platform = 'instagram' then v_page_or_account else null end,
          'source', 'staff_schedule',
          'idempotencyKey', v_item.id::text
        ),
        p_scheduled_for
      );

    when 'retry' then
      if v_item.status <> 'failed' then
        return jsonb_build_object('success', false, 'code', 'INVALID_TRANSITION', 'status', v_item.status::text);
      end if;
      v_effective_scheduled_for := now() + interval '2 minutes';
      v_platform := lower(btrim(v_item.platform));
      if v_platform not in ('facebook','instagram') then
        return jsonb_build_object('success', false, 'code', 'PLATFORM_NOT_SUPPORTED');
      end if;
      if v_platform = 'facebook' then
        v_page_or_account := '1164107840123575';
      else
        v_page_or_account := '17841400516801494';
      end if;

      update public.background_jobs
      set status = 'dead', last_error = 'CONTENT_RETRIED', updated_at = now()
      where job_type = 'publish_content'
        and payload->>'contentItemId' = v_item.id::text
        and status in ('queued','processing','retrying');

      update public.content_items
      set status = 'scheduled', scheduled_for = v_effective_scheduled_for, updated_at = now()
      where id = v_item.id
      returning * into v_item;

      insert into public.background_jobs (job_type, status, payload, next_retry_at)
      values (
        'publish_content',
        'queued',
        jsonb_build_object(
          'contentItemId', v_item.id,
          'platform', v_platform,
          'pageId', case when v_platform = 'facebook' then v_page_or_account else null end,
          'accountId', case when v_platform = 'instagram' then v_page_or_account else null end,
          'source', 'staff_retry',
          'retriedByStaff', true,
          'idempotencyKey', v_item.id::text
        ),
        v_effective_scheduled_for
      );

    when 'cancel' then
      if v_item.status in ('published','cancelled') then
        return jsonb_build_object('success', false, 'code', 'INVALID_TRANSITION', 'status', v_item.status::text);
      end if;
      update public.background_jobs
      set status = 'dead', last_error = 'CONTENT_CANCELLED', updated_at = now()
      where job_type = 'publish_content'
        and payload->>'contentItemId' = v_item.id::text
        and status in ('queued','processing','retrying');
      update public.content_items
      set status = 'cancelled', scheduled_for = null, updated_at = now()
      where id = v_item.id
      returning * into v_item;

    when 'unschedule' then
      if not public.is_active_staff(array['super_admin']) then
        raise exception 'OWNER_APPROVAL_REQUIRED' using errcode = '42501';
      end if;
      if v_item.status <> 'scheduled' then
        return jsonb_build_object('success', false, 'code', 'INVALID_TRANSITION', 'status', v_item.status::text);
      end if;
      update public.background_jobs
      set status = 'dead', last_error = 'CONTENT_UNSCHEDULED', updated_at = now()
      where job_type = 'publish_content'
        and payload->>'contentItemId' = v_item.id::text
        and status in ('queued','processing','retrying');
      update public.content_items
      set status = 'approved', scheduled_for = null, updated_at = now()
      where id = v_item.id
      returning * into v_item;

    else
      return jsonb_build_object('success', false, 'code', 'INVALID_ACTION');
  end case;

  insert into public.audit_logs (
    actor_id, actor_type, action, entity_type, entity_id, detail
  ) values (
    auth.uid(), 'user', 'content_item_transitioned', 'content_item', v_item.id,
    jsonb_build_object(
      'requestedAction', p_action,
      'previousStatus', v_previous_status::text,
      'nextStatus', v_item.status::text,
      'previousScheduledFor', v_previous_scheduled_for,
      'nextScheduledFor', v_item.scheduled_for
    )
  );

  return jsonb_build_object(
    'success', true,
    'contentItemId', v_item.id,
    'status', v_item.status::text,
    'scheduledFor', v_item.scheduled_for,
    'updatedAt', v_item.updated_at
  );
end;
$function$
;

-- ============================================================================
-- Function: update_booking_request_status(p_booking_request_id uuid, p_status text)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_booking_request_status(p_booking_request_id uuid, p_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_row public.booking_requests%rowtype;
  v_previous_status text;
begin
  if not public.is_active_staff(array['super_admin','admin','reception']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  if p_status not in ('pending','contacted','confirmed','declined','cancelled') then
    return jsonb_build_object('success', false, 'code', 'INVALID_STATUS');
  end if;

  select * into v_row
  from public.booking_requests
  where id = p_booking_request_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  end if;

  v_previous_status := v_row.status;
  if v_previous_status = p_status then
    return jsonb_build_object(
      'success', true,
      'bookingRequestId', v_row.id,
      'status', v_row.status,
      'changed', false
    );
  end if;

  update public.booking_requests
  set status = p_status,
      updated_at = now()
  where id = p_booking_request_id
  returning * into v_row;

  insert into public.audit_logs (
    actor_id, actor_type, action, entity_type, entity_id, detail
  ) values (
    auth.uid(), 'user', 'booking_request_status_updated', 'booking_request', v_row.id,
    jsonb_build_object('previousStatus', v_previous_status, 'nextStatus', v_row.status)
  );

  return jsonb_build_object(
    'success', true,
    'bookingRequestId', v_row.id,
    'status', v_row.status,
    'changed', true
  );
end;
$function$
;

-- ============================================================================
-- Function: update_staff_content_item(p_content_item_id uuid, p_topic text, p_hook text, p_caption text, p_cta text, p_hashtags text[], p_visual_prompt text)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_staff_content_item(p_content_item_id uuid, p_topic text, p_hook text, p_caption text, p_cta text, p_hashtags text[], p_visual_prompt text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_item public.content_items%rowtype;
  v_previous_status public.content_status;
  v_hashtag text;
begin
  if not public.is_active_staff(array['super_admin','admin','content_manager']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  perform 1
  from public.background_jobs
  where job_type = 'publish_content'
    and payload->>'contentItemId' = p_content_item_id::text
    and status in ('queued','processing','retrying')
  order by id
  for update;

  select *
  into v_item
  from public.content_items
  where id = p_content_item_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  end if;

  if v_item.status = 'published' then
    return jsonb_build_object('success', false, 'code', 'PUBLISHED_CONTENT_IMMUTABLE');
  end if;

  if coalesce(char_length(btrim(p_caption)), 0) < 2
     or char_length(btrim(p_caption)) > 5000 then
    return jsonb_build_object('success', false, 'code', 'INVALID_CAPTION');
  end if;

  if char_length(btrim(coalesce(p_topic, ''))) > 300
     or char_length(btrim(coalesce(p_hook, ''))) > 500
     or char_length(btrim(coalesce(p_cta, ''))) > 500
     or char_length(btrim(coalesce(p_visual_prompt, ''))) > 2000 then
    return jsonb_build_object('success', false, 'code', 'CONTENT_FIELD_TOO_LONG');
  end if;

  if coalesce(cardinality(p_hashtags), 0) > 30 then
    return jsonb_build_object('success', false, 'code', 'TOO_MANY_HASHTAGS');
  end if;

  foreach v_hashtag in array coalesce(p_hashtags, '{}'::text[])
  loop
    if coalesce(char_length(btrim(v_hashtag)), 0) < 1 or char_length(btrim(v_hashtag)) > 100 then
      return jsonb_build_object('success', false, 'code', 'INVALID_HASHTAG');
    end if;
  end loop;

  v_previous_status := v_item.status;

  update public.background_jobs
  set status = 'dead',
      last_error = 'CONTENT_EDITED_REVIEW_REQUIRED',
      updated_at = now()
  where job_type = 'publish_content'
    and payload->>'contentItemId' = v_item.id::text
    and status in ('queued','processing','retrying');

  update public.content_items
  set topic = nullif(btrim(coalesce(p_topic, '')), ''),
      hook = nullif(btrim(coalesce(p_hook, '')), ''),
      caption = btrim(p_caption),
      cta = nullif(btrim(coalesce(p_cta, '')), ''),
      hashtags = coalesce(
        array(
          select distinct btrim(value)
          from unnest(coalesce(p_hashtags, '{}'::text[])) value
          where btrim(value) <> ''
        ),
        '{}'::text[]
      ),
      visual_prompt = nullif(btrim(coalesce(p_visual_prompt, '')), ''),
      status = 'needs_review',
      scheduled_for = null,
      updated_at = now()
  where id = v_item.id
  returning * into v_item;

  insert into public.audit_logs (
    actor_id, actor_type, action, entity_type, entity_id, detail
  ) values (
    auth.uid(),
    'user',
    'content_item_edited',
    'content_item',
    v_item.id,
    jsonb_build_object(
      'previousStatus', v_previous_status::text,
      'nextStatus', v_item.status::text,
      'scheduleCleared', v_previous_status = 'scheduled'
    )
  );

  return jsonb_build_object(
    'success', true,
    'contentItemId', v_item.id,
    'status', v_item.status::text,
    'scheduledFor', v_item.scheduled_for,
    'updatedAt', v_item.updated_at
  );
end;
$function$
;

-- ============================================================================
-- Function: update_staff_lead_workflow(p_lead_id uuid, p_stage text, p_human_required boolean, p_do_not_contact boolean, p_next_follow_up_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_staff_lead_workflow(p_lead_id uuid, p_stage text, p_human_required boolean, p_do_not_contact boolean, p_next_follow_up_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_lead public.leads%rowtype;
  v_previous_stage public.lead_stage;
  v_previous_human_required boolean;
  v_previous_do_not_contact boolean;
  v_previous_next_follow_up_at timestamptz;
  v_active_job public.follow_up_jobs%rowtype;
  v_next_attempt integer;
  v_effective_follow_up_at timestamptz;
  v_stop_reason text;
  v_changed boolean;
begin
  if not public.is_active_staff(array['super_admin','admin','reception','coach']) then
    raise exception 'STAFF_ACCESS_DENIED' using errcode = '42501';
  end if;

  if p_stage not in ('new','contacted','qualified','booking_intent','booked','follow_up','lost','customer') then
    return jsonb_build_object('success', false, 'code', 'INVALID_STAGE');
  end if;

  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then
    return jsonb_build_object('success', false, 'code', 'NOT_FOUND');
  end if;

  select * into v_active_job
  from public.follow_up_jobs
  where lead_id = p_lead_id and status in ('queued','processing','retrying')
  order by attempt_number, id
  limit 1
  for update;

  v_previous_stage := v_lead.stage;
  v_previous_human_required := v_lead.human_required;
  v_previous_do_not_contact := v_lead.do_not_contact;
  v_previous_next_follow_up_at := v_lead.next_follow_up_at;

  if p_do_not_contact then
    v_effective_follow_up_at := null;
    v_stop_reason := 'DO_NOT_CONTACT';
  elsif p_stage in ('booked','customer','lost') then
    v_effective_follow_up_at := null;
    v_stop_reason := 'TERMINAL_LEAD_STAGE';
  else
    v_effective_follow_up_at := p_next_follow_up_at;
    v_stop_reason := case when p_next_follow_up_at is null then 'FOLLOW_UP_CLEARED' else 'FOLLOW_UP_RESCHEDULED' end;
  end if;

  if v_effective_follow_up_at is not null and v_effective_follow_up_at <= now() then
    return jsonb_build_object('success', false, 'code', 'INVALID_FOLLOW_UP_TIME');
  end if;
  if v_effective_follow_up_at is not null and v_effective_follow_up_at > now() + interval '366 days' then
    return jsonb_build_object('success', false, 'code', 'FOLLOW_UP_TOO_FAR');
  end if;

  v_changed := v_lead.stage::text is distinct from p_stage
    or v_lead.human_required is distinct from coalesce(p_human_required, false)
    or v_lead.do_not_contact is distinct from coalesce(p_do_not_contact, false)
    or v_lead.next_follow_up_at is distinct from v_effective_follow_up_at
    or (v_effective_follow_up_at is not null and (v_active_job.id is null or v_active_job.scheduled_for is distinct from v_effective_follow_up_at))
    or (v_effective_follow_up_at is null and v_active_job.id is not null);

  if not v_changed then
    return jsonb_build_object(
      'success', true, 'leadId', v_lead.id, 'stage', v_lead.stage::text,
      'humanRequired', v_lead.human_required, 'doNotContact', v_lead.do_not_contact,
      'nextFollowUpAt', v_lead.next_follow_up_at,
      'followUpAttempt', v_active_job.attempt_number,
      'updatedAt', v_lead.updated_at, 'changed', false
    );
  end if;

  if v_effective_follow_up_at is null then
    update public.follow_up_jobs
    set status = 'dead', stopped_reason = v_stop_reason
    where lead_id = p_lead_id and status in ('queued','processing','retrying');
  elsif v_active_job.id is not null then
    update public.follow_up_jobs
    set scheduled_for = v_effective_follow_up_at,
        status = 'queued',
        stopped_reason = null
    where id = v_active_job.id;
    v_next_attempt := v_active_job.attempt_number;
  else
    select coalesce(max(attempt_number), 0) + 1 into v_next_attempt
    from public.follow_up_jobs where lead_id = p_lead_id and status = 'completed';
    if v_next_attempt > 3 then
      return jsonb_build_object('success', false, 'code', 'FOLLOW_UP_LIMIT_REACHED');
    end if;
    insert into public.follow_up_jobs (
      lead_id, conversation_id, attempt_number, scheduled_for, status
    ) values (
      p_lead_id,
      (select c.id from public.conversations c where c.lead_id = p_lead_id order by c.updated_at desc, c.id desc limit 1),
      v_next_attempt, v_effective_follow_up_at, 'queued'
    );
  end if;

  update public.leads
  set stage = p_stage::public.lead_stage,
      human_required = coalesce(p_human_required, false),
      do_not_contact = coalesce(p_do_not_contact, false),
      next_follow_up_at = v_effective_follow_up_at,
      updated_at = now()
  where id = p_lead_id
  returning * into v_lead;

  if v_lead.do_not_contact then
    update public.conversations set mode = 'paused', updated_at = now()
    where lead_id = v_lead.id and mode in ('ai_active','human_required');
  elsif v_lead.human_required then
    update public.conversations set mode = 'human_required', updated_at = now()
    where lead_id = v_lead.id and mode = 'ai_active';
  else
    update public.conversations set mode = 'ai_active', updated_at = now()
    where lead_id = v_lead.id and mode = 'human_required';
  end if;

  insert into public.audit_logs (
    actor_id, actor_type, action, entity_type, entity_id, detail
  ) values (
    auth.uid(), 'user', 'lead_workflow_updated', 'lead', v_lead.id,
    jsonb_build_object(
      'previousStage', v_previous_stage::text, 'nextStage', v_lead.stage::text,
      'previousHumanRequired', v_previous_human_required, 'nextHumanRequired', v_lead.human_required,
      'previousDoNotContact', v_previous_do_not_contact, 'nextDoNotContact', v_lead.do_not_contact,
      'previousNextFollowUpAt', v_previous_next_follow_up_at, 'nextFollowUpAt', v_lead.next_follow_up_at,
      'followUpAttempt', v_next_attempt
    )
  );

  return jsonb_build_object(
    'success', true, 'leadId', v_lead.id, 'stage', v_lead.stage::text,
    'humanRequired', v_lead.human_required, 'doNotContact', v_lead.do_not_contact,
    'nextFollowUpAt', v_lead.next_follow_up_at, 'followUpAttempt', v_next_attempt,
    'updatedAt', v_lead.updated_at, 'changed', true
  );
end;
$function$
;
