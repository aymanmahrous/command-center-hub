import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const mediaMigration = await readFile(
  new URL("../supabase/migrations/20260911143000_media_library_pipeline.sql", import.meta.url),
  "utf8",
);
const lifecycleMigration = await readFile(
  new URL("../supabase/migrations/20261030093654_align_media_lifecycle_schema_contract.sql", import.meta.url),
  "utf8",
);
const batchMigration = await readFile(
  new URL("../supabase/migrations/20260911143100_content_batch_media_linkage.sql", import.meta.url),
  "utf8",
);

test("media library migration is additive only", () => {
  assert.match(mediaMigration, /ADD COLUMN IF NOT EXISTS category/);
  assert.match(mediaMigration, /register_staff_media_upload/);
  assert.match(mediaMigration, /save_staff_media_ai_analysis/);
  assert.doesNotMatch(mediaMigration, /\bDROP\b|\bTRUNCATE\b/i);
});

test("content batch media linkage validates publishable swimming media", () => {
  assert.match(batchMigration, /media_asset_id/);
  assert.match(batchMigration, /MEDIA_ASSET_NOT_PUBLISHABLE/);
  assert.match(batchMigration, /swimming_business/);
  assert.doesNotMatch(batchMigration, /\bDROP\b|\bTRUNCATE\b/i);
});

test("media lifecycle migration writes only values accepted by the QA schema", () => {
  assert.match(lifecycleMigration, /v_status not in \('pending','ready','processing','failed'\)/);
  assert.match(lifecycleMigration, /ai_analysis_status = 'analyzed'/);
  assert.match(lifecycleMigration, /'pending','granted','denied','expired','consent_confirmed'/);
  assert.match(lifecycleMigration, /publishability_status = v_publishability/);
  assert.doesNotMatch(lifecycleMigration, /'completed'|'not_started'|'unknown'|'consent_required'/);
});
