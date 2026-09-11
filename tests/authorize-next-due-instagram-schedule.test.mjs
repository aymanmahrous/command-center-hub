import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20260812140000_authorize_next_due_scheduled_instagram_publish.sql", import.meta.url),
  "utf8",
);

test("authorize_next_due_scheduled_instagram_publish migration is service-role gated", () => {
  assert.match(migration, /SERVICE_ROLE_REQUIRED/);
  assert.match(migration, /GRANT EXECUTE[\s\S]*TO service_role/);
  assert.match(migration, /REVOKE ALL[\s\S]*FROM anon/);
  assert.match(migration, /REVOKE ALL[\s\S]*FROM authenticated/);
});

test("authorize_next_due only selects due scheduled Instagram jobs", () => {
  assert.match(migration, /ci\.platform = 'instagram'/);
  assert.match(migration, /ci\.status = 'scheduled'/);
  assert.match(migration, /ci\.scheduled_for <= v_now/);
  assert.match(migration, /bj\.next_retry_at = ci\.scheduled_for/);
  assert.match(migration, /bj\.next_retry_at <= v_now/);
  assert.match(migration, /NO_DUE_CANDIDATE/);
});

test("authorize_next_due uses live Instagram account and single_publish scope", () => {
  assert.match(migration, /17841400516801494/);
  assert.doesNotMatch(migration, /17841439747493221/);
  assert.match(migration, /single_publish/);
  assert.match(migration, /INVALID_TTL_MINUTES/);
  assert.match(migration, /v_ttl > 30/);
});

test("authorize_next_due does not publish or mutate scheduled_for", () => {
  assert.doesNotMatch(migration, /status\s*=\s*'published'/i);
  assert.doesNotMatch(migration, /UPDATE\s+public\.content_items/i);
  assert.doesNotMatch(migration, /media_publish/);
});
