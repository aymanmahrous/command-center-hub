import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sql = await readFile(
  new URL("../supabase/migrations/20260808230000_instagram_owner_publish_authorization_gate.sql", import.meta.url),
  "utf8",
);

const instagramRpcs = [
  "create_owner_instagram_publish_authorization",
  "authorize_and_enqueue_instagram_publish",
  "claim_authorized_instagram_publish_job",
  "reserve_authorized_instagram_publication_receipt",
  "mark_authorized_instagram_publication_published",
  "fail_authorized_instagram_publish_job",
  "reject_authorized_instagram_publish_job",
];

const facebookRpcs = [
  "create_owner_publish_authorization",
  "authorize_and_enqueue_facebook_publish",
  "claim_authorized_publish_job",
  "reserve_authorized_facebook_publication_receipt",
  "mark_authorized_publication_published",
  "fail_authorized_publish_job",
  "reject_authorized_publish_job",
];

test("instagram owner-approval migration defines the minimal gated RPC set", () => {
  for (const rpc of instagramRpcs) {
    assert.match(sql, new RegExp(`function public\\.${rpc}\\(`));
  }
});

test("instagram owner-approval migration does not modify existing facebook RPCs", () => {
  for (const rpc of facebookRpcs) {
    assert.doesNotMatch(sql, new RegExp(`create or replace function public\\.${rpc}\\(`));
  }
});

test("instagram owner-approval gate pins the approved account id", () => {
  assert.match(sql, /17841439747493221/);
  assert.doesNotMatch(sql, /17841400516801494/);
});

test("instagram owner-approval gate is instagram-only", () => {
  assert.match(sql, /p_platform <> 'instagram'/);
  assert.match(sql, /platform = 'instagram'/);
  assert.match(sql, /v_content\.platform <> 'instagram'/);
  assert.doesNotMatch(sql, /p_platform <> 'facebook'/);
});

test("instagram claim RPC requires owner authorization before returning media", () => {
  assert.match(sql, /claim_authorized_instagram_publish_job[\s\S]*NO_AUTHORIZATION/);
  assert.match(sql, /claim_authorized_instagram_publish_job[\s\S]*'storagePath', m\.storage_path/);
  assert.match(sql, /claim_authorized_instagram_publish_job[\s\S]*consumed_at = now\(\)/);
});

test("instagram reserve receipt enforces duplicate protection by content item and platform", () => {
  assert.match(sql, /reserve_authorized_instagram_publication_receipt[\s\S]*where content_item_id = p_content_item_id[\s\S]*and platform = 'instagram'/);
  assert.match(sql, /reserve_authorized_instagram_publication_receipt[\s\S]*ALREADY_PUBLISHED/);
  assert.match(sql, /reserve_authorized_instagram_publication_receipt[\s\S]*RECEIPT_BELONGS_TO_DIFFERENT_ATTEMPT/);
});

test("instagram publish completion requires consumed authorization and bound receipt", () => {
  assert.match(sql, /mark_authorized_instagram_publication_published[\s\S]*AUTHORIZATION_MISMATCH/);
  assert.match(sql, /mark_authorized_instagram_publication_published[\s\S]*RECEIPT_BELONGS_TO_DIFFERENT_ATTEMPT/);
  assert.match(sql, /mark_authorized_instagram_publication_published[\s\S]*RECEIPT_STATE_NOT_ELIGIBLE/);
});

test("instagram owner-approval RPCs require service_role and are not granted to browser roles", () => {
  for (const rpc of instagramRpcs) {
    assert.match(sql, new RegExp(`${rpc}[\\s\\S]*SERVICE_ROLE_REQUIRED`));
    assert.match(sql, new RegExp(`revoke all on function public\\.${rpc}`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${rpc}`));
  }

  assert.match(sql, /from public, anon, authenticated/);
  assert.match(sql, /to service_role/);
  assert.doesNotMatch(sql, /grant execute[\s\S]*to authenticated/);
  assert.doesNotMatch(sql, /grant execute[\s\S]*to anon/);
});

test("instagram owner-approval migration does not call Meta APIs directly", () => {
  assert.doesNotMatch(sql, /graph\.facebook\.com/i);
  assert.doesNotMatch(sql, /media_publish/i);
  assert.doesNotMatch(sql, /access_token/i);
});

test("instagram authorization creation blocks active duplicate authorizations", () => {
  assert.match(sql, /create_owner_instagram_publish_authorization[\s\S]*ACTIVE_AUTHORIZATION_EXISTS/);
  assert.match(sql, /authorize_and_enqueue_instagram_publish[\s\S]*ACTIVE_AUTHORIZATION_EXISTS/);
  assert.match(sql, /authorize_and_enqueue_instagram_publish[\s\S]*ACTIVE_PUBLISH_JOB_EXISTS/);
});

test("instagram approval references reject secret-like values", () => {
  assert.match(sql, /token\|secret\|password\|bearer\|api\[_-\]\?key/);
});
