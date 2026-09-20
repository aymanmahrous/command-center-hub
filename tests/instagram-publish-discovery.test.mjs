import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sql = await readFile(
  new URL(
    "../supabase/migrations/20260809010000_discover_due_authorized_instagram_publish_candidate.sql",
    import.meta.url,
  ),
  "utf8",
);

const rpcName = "discover_due_authorized_instagram_publish_candidate";

test("instagram publish discovery RPC is read-only and returns only contentItemId", () => {
  assert.match(sql, new RegExp(`function public\\.${rpcName}\\(\\)`));
  assert.match(sql, /stable[\s\S]*security definer/);
  assert.match(sql, /'contentItemId', v_content_item_id/);
  assert.match(sql, /'found', false, 'code', 'NO_CANDIDATE'/);
  assert.doesNotMatch(sql, /for update/i);
  assert.doesNotMatch(sql, /\binsert\b/i);
  assert.doesNotMatch(sql, /\bupdate\b/i);
  assert.doesNotMatch(sql, /\bdelete\b/i);
});

test("instagram publish discovery RPC enforces due authorized instagram candidate criteria", () => {
  assert.match(sql, /ci\.platform = 'instagram'/);
  assert.match(sql, /ci\.status = 'scheduled'/);
  assert.match(sql, /ci\.scheduled_for <= now\(\)/);
  assert.match(sql, /bj\.job_type = 'publish_content'/);
  assert.match(sql, /bj\.status in \('queued', 'retrying'\)/);
  assert.match(sql, /coalesce\(bj\.next_retry_at, bj\.created_at\) <= now\(\)/);
  assert.match(sql, /opa\.platform = 'instagram'/);
  assert.match(sql, /opa\.page_id = '17841439747493221'/);
  assert.match(sql, /opa\.consumed_at is null/);
  assert.match(sql, /opa\.revoked_at is null/);
  assert.match(sql, /opa\.expires_at > now\(\)/);
  assert.match(sql, /opa\.publish_job_id = bj\.id/);
});

test("instagram publish discovery RPC requires service_role and is not granted to browser roles", () => {
  assert.match(sql, /SERVICE_ROLE_REQUIRED/);
  assert.match(sql, new RegExp(`revoke all on function public\\.${rpcName}\\(\\)`));
  assert.match(sql, new RegExp(`grant execute on function public\\.${rpcName}\\(\\) to service_role`));
  assert.match(sql, /from public, anon, authenticated/);
  assert.doesNotMatch(sql, /grant execute[\s\S]*to authenticated/);
  assert.doesNotMatch(sql, /grant execute[\s\S]*to anon/);
});
