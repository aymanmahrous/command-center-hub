import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20260914040000_content_automation_batch_generation.sql", import.meta.url),
  "utf8",
);
const pulse = await readFile(
  new URL("../supabase/functions/content-automation-pulse/index.ts", import.meta.url),
  "utf8",
);

test("automation migration adds idempotent cycle ledger and evaluation RPC", () => {
  assert.match(migration, /content_batch_generation_cycles/);
  assert.match(migration, /evaluate_content_batch_generation_need/);
  assert.match(migration, /create_automated_content_batch/);
  assert.match(migration, /864000/);
  assert.match(migration, /content-automation-pulse/);
});

test("automation migration does not add new pg_cron job", () => {
  assert.doesNotMatch(migration, /cron\.schedule/i);
  assert.doesNotMatch(migration, /cron\.alter_job/i);
});

test("content automation pulse uses lease, run tracking, and template fallback", () => {
  assert.match(pulse, /claim_content_automation_lease/);
  assert.match(pulse, /evaluate_content_batch_generation_need/);
  assert.match(pulse, /create_automated_content_batch/);
  assert.match(pulse, /buildTemplateBatchItems/);
  assert.match(pulse, /complete_content_automation_run/);
});
