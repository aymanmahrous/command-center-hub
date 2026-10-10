import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20261010100000_fix_content_media_job_asset_metadata.sql", import.meta.url),
  "utf8",
);

test("content media completion reuses the exact generated asset before legacy fallback", () => {
  assert.match(migration, /p_metadata->>'mediaAssetId'/);
  assert.match(migration, /AND content_item_id = v_content\.id/);
  assert.match(migration, /AND asset_type = v_asset_type/);
  assert.match(migration, /AND source = 'ai_generated'/);
  assert.match(migration, /IF v_asset\.id IS NULL THEN[\s\S]*metadata->>'autonomous' = 'true'/);
});

test("fallback media registration sets explicit conservative review states", () => {
  assert.match(migration, /media_status,[\s\S]*ai_analysis_status,[\s\S]*publishability_status,[\s\S]*consent_status,[\s\S]*updated_at/);
  assert.match(migration, /'unclassified',[\s\S]*'unclassified',[\s\S]*'not_started',[\s\S]*'blocked',[\s\S]*'unknown'/);
  assert.match(migration, /'reviewRequired', true/);
});

test("legacy incomplete Canva job assets are backfilled without being approved", () => {
  assert.match(migration, /WHERE provider = 'canva'[\s\S]*AND source = 'ai_generated'[\s\S]*AND provider_job_id IS NOT NULL/);
  assert.match(migration, /'canva_automation_fallback'/);
  assert.match(migration, /publishability_status = coalesce\(publishability_status, 'blocked'\)/);
  assert.doesNotMatch(migration, /\bDROP\b|\bTRUNCATE\b/i);
});
