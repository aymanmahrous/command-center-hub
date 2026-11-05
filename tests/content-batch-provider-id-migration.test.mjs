import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/20261102110000_separate_batch_provider_from_external_post_id.sql", import.meta.url),
  "utf8",
);

test("batch provider marker is no longer stored as an external publication ID", () => {
  assert.match(migration, /create_staff_generated_content_batch\(jsonb,text\)/);
  assert.match(migration, /v_old text := \$old\$[\s\S]*p_provider_external_id[\s\S]*\$old\$/);
  assert.match(migration, /v_new text := \$new\$\s+NULL,/);
  assert.match(migration, /EXPECTED_BATCH_PROVIDER_ASSIGNMENT_NOT_FOUND/);
});

test("only the known internal batch marker is cleared from historical rows", () => {
  assert.match(migration, /WHERE provider_external_id = 'command-center-coach-ayman-2026'/);
  assert.doesNotMatch(migration, /UPDATE public\.content_items[\s\S]*WHERE provider_external_id IS NOT NULL\s*;/);
});

test("batch provenance remains in the audit record and does not create approval or publishing", () => {
  assert.match(migration, /content_items\.provider_external_id[\s\S]*reserved for a real provider post ID/);
  assert.match(migration, /does not approve, schedule, or publish them/);
  assert.doesNotMatch(migration, /status\s*=\s*'approved'|status\s*=\s*'published'/i);
});
