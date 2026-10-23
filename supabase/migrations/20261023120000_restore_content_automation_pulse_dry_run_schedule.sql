-- Restore the Supabase cron dispatch in a locked dry-run configuration.
-- The Edge Function currently hard-locks every invocation to dry-run before
-- generation, media processing, or Meta publishing can execute.
do $$
begin
  if exists (
    select 1 from cron.job
    where jobname = 'content-automation-pulse-dry-run'
  ) then
    perform cron.unschedule('content-automation-pulse-dry-run');
  end if;

  perform cron.schedule(
    'content-automation-pulse-dry-run',
    '*/30 * * * *',
    'select public.dispatch_content_automation_pulse();'
  );
end;
$$;
