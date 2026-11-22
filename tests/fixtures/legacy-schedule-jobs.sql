-- Job 2 wins the timestamp tie with 1. All subsequent rows must stay untouched.
INSERT INTO background_jobs
SELECT lpad(n::text,32,'0')::uuid,
       CASE WHEN n=4 THEN 'other' ELSE 'publish_content' END,
       CASE WHEN n=5 THEN 'completed' ELSE 'queued' END,
       timestamptz '2095-08-10 12:30 UTC' + CASE WHEN n=6 THEN interval '1 hour' ELSE interval '0' END,
       timestamptz '2020-01-01 UTC' + CASE WHEN n=3 THEN interval '-1 hour' ELSE interval '0' END,
       NULL, jsonb_build_object('contentItemId', CASE WHEN n=7 THEN NULL ELSE id END, 'original', n)
FROM content_items CROSS JOIN generate_series(1,7) AS n;
