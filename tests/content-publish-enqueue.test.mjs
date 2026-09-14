import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20260913140000_enqueue_publish_job.sql", import.meta.url),
  "utf8",
);
const adapter = await readFile(new URL("../src/content-publish-enqueue.ts", import.meta.url), "utf8");
const growthHub = await readFile(new URL("../src/content-growth-hub.tsx", import.meta.url), "utf8");
const reviewPanel = await readFile(new URL("../src/content-batch-review-panel.tsx", import.meta.url), "utf8");

test("enqueue_publish_job migration enforces staff auth and approved content", () => {
  assert.match(migration, /is_active_staff\(array\['super_admin', 'admin', 'content_manager'\]\)/);
  assert.match(migration, /v_content\.status <> 'approved'/);
  assert.match(migration, /CONTENT_NOT_APPROVED/);
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.enqueue_publish_job\(uuid\) TO authenticated, service_role/);
});

test("enqueue_publish_job migration blocks duplicate jobs and published receipts", () => {
  assert.match(migration, /job_type = 'publish_content'/);
  assert.match(migration, /bj\.status in \('queued', 'retrying', 'processing'\)/);
  assert.match(migration, /pr\.status = 'published'/);
  assert.match(migration, /PUBLISH_RECEIPT_EXISTS/);
  assert.match(migration, /'code', 'ALREADY_ENQUEUED'/);
  assert.match(migration, /'idempotencyKey', p_content_item_id::text/);
  assert.match(migration, /pg_advisory_xact_lock/);
});

test("enqueue_publish_job migration creates authorization and job atomically without external calls", () => {
  assert.match(migration, /insert into public\.background_jobs/);
  assert.match(migration, /insert into public\.owner_publish_authorizations/);
  assert.match(migration, /'source', 'command_center_request_publish'/);
  assert.match(migration, /status = 'scheduled'/);
  assert.doesNotMatch(migration, /buffer\.com/i);
  assert.doesNotMatch(migration, /http_request|webhook\.n8n|N8N_WEBHOOK/i);
  assert.doesNotMatch(migration, /graph\.facebook|instagram\.com\/v/i);
});

test("requestPublishJob adapter calls only the approved RPC with staff JWT", () => {
  assert.match(adapter, /\/rest\/v1\/rpc\/enqueue_publish_job/);
  assert.match(adapter, /p_content_item_id: contentItemId/);
  assert.match(adapter, /Authorization: `Bearer \$\{session\.accessToken\}`/);
  assert.match(adapter, /cache: "no-store"/);
  assert.doesNotMatch(adapter, /N8N_WEBHOOK|webhook\.n8n|buffer\.com/i);
  assert.doesNotMatch(adapter, /service_role|sb_secret_/i);
});

test("Command Center Request Publish UI confirms before enqueue and does not call n8n directly", () => {
  assert.match(growthHub, /requestPublishJob/);
  assert.match(growthHub, /window\.confirm\(confirmMessage\)/);
  assert.match(growthHub, /canRequestPublish/);
  assert.match(reviewPanel, /requestPublishJob/);
  assert.match(reviewPanel, /window\.confirm\(publishingCopy\.requestPublishConfirm\)/);
  assert.doesNotMatch(growthHub, /N8N_WEBHOOK|webhook\.n8n|get_staff_operations_queue/i);
  assert.doesNotMatch(reviewPanel, /N8N_WEBHOOK|webhook\.n8n|get_staff_operations_queue/i);
});
