-- Reduce dispatch_content_automation_pulse from every 5 minutes to once daily
-- at 07:55 UTC (5 minutes before n8n Content Scheduler at 08:00 UTC).
-- Applied live via cron.alter_job(1, schedule := '55 7 * * *').

SELECT cron.alter_job(
  1,
  schedule := '55 7 * * *'
);
