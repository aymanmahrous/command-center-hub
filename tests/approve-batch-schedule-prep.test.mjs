import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20260914030000_approve_batch_schedule_publish_prep.sql", import.meta.url),
  "utf8",
);

test("approve batch migration schedules facebook and instagram from planned_for", () => {
  assert.match(migration, /scheduled_for = v_planned/);
  assert.match(migration, /'facebook', 'instagram'/);
  assert.match(migration, /'publish_content'/);
  assert.match(migration, /'batch_approve_scheduled'/);
  assert.match(migration, /next_retry_at, created_at, updated_at/);
  assert.match(migration, /'SCHEDULED_FOR_PUBLISH'/);
});

test("approve batch migration keeps tiktok approved-only without publish jobs", () => {
  assert.match(migration, /if v_platform not in \('facebook', 'instagram'\)/);
  assert.match(migration, /status = 'approved',\s*\n\s*scheduled_for = null/);
  assert.match(migration, /v_result_code := 'APPROVED'/);
});

test("approve batch migration never publishes or creates owner authorizations", () => {
  assert.doesNotMatch(migration, /insert into public\.owner_publish_authorizations/i);
  assert.doesNotMatch(migration, /set status = 'published'/i);
  assert.doesNotMatch(migration, /insert into public\.content_publication_receipts/i);
});

test("approve batch migration is idempotent for prepared items", () => {
  assert.match(migration, /'ALREADY_PREPARED'/);
  assert.match(migration, /alreadyPreparedCount/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /'idempotencyKey'/);
});

test("approve batch migration skips publish prep when instagram media is not ready", () => {
  assert.match(migration, /'APPROVED_NOT_PUBLISH_READY'/);
  assert.match(migration, /media_asset_id is null/);
  assert.match(migration, /consent_confirmed/);
});
