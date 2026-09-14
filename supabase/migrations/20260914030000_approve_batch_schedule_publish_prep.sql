-- Approve All: schedule Facebook/Instagram batch items from planned_for and queue publish jobs for n8n.
-- TikTok stays approved-only. No direct publish and no owner_publish_authorizations here.

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
  if not public.is_active_staff(array['super_admin','admin','content_manager']) then
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
$function$;

GRANT EXECUTE ON FUNCTION public.approve_staff_content_batch(uuid) TO authenticated, service_role;
