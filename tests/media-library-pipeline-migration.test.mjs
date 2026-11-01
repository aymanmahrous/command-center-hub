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
const approvalMigration = await readFile(
  new URL("../supabase/migrations/20261030095125_align_content_approval_audit_actor_and_external_media_defaults.sql", import.meta.url),
  "utf8",
);
const generatedMigration = await readFile(
  new URL("../supabase/migrations/20261030095427_align_generated_media_completion_and_link_guard.sql", import.meta.url),
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

test("content approval uses an allowed audit actor and external media uses schema-safe defaults", () => {
  assert.match(approvalMigration, /auth\.uid\(\),\s*'user',\s*'content_status_transition'/s);
  assert.doesNotMatch(approvalMigration, /auth\.uid\(\),\s*'staff',\s*'content_status_transition'/s);
  assert.match(approvalMigration, /'unclassified', 'pending', 'pending', 'blocked', NULL/);
  assert.doesNotMatch(approvalMigration, /'unclassified', 'unclassified', 'not_started', 'blocked', 'unknown'/);
});

test("generated media completion uses schema-safe states and the link gate requires ready media", () => {
  assert.match(generatedMigration, /source = 'generated'/);
  assert.match(generatedMigration, /'generated', btrim\(p_storage_path\)/);
  assert.match(generatedMigration, /'ready', 'skipped', 'blocked', 'pending'/);
  assert.match(generatedMigration, /v_asset\.media_status is distinct from 'ready'/);
  assert.match(generatedMigration, /v_asset\.consent_status is distinct from 'consent_confirmed'/);
});
