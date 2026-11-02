import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const source = await readFile(new URL("../supabase/functions/scheduled-authorized-publisher/index.ts", import.meta.url), "utf8");
const config = await readFile(new URL("../supabase/config.toml", import.meta.url), "utf8");

test("scheduled publisher requires the internal automation secret", () => {
  assert.match(source, /x-content-publisher-automation-secret/);
  assert.match(source, /constantTimeEqual\(supplied, AUTOMATION_SECRET\)/);
});

test("scheduled publisher binds authorization, job, content, platform, and account", () => {
  for (const value of ["authorizationId", "jobId", "contentItemId", "platform", "accountId"]) assert.match(source, new RegExp(value));
  assert.match(source, /reserve_authorized_instagram_publication_receipt/);
  assert.match(source, /reserve_authorized_facebook_publication_receipt/);
  assert.match(source, /mark_authorized_instagram_publication_published/);
  assert.match(source, /mark_authorized_publication_published/);
  assert.match(source, /PUBLICATION_SENT_BUT_ATOMIC_COMPLETION_UNCONFIRMED/);
});

test("deployment config keeps the three internal endpoints self-authenticated", () => {
  assert.match(config, /\[functions\.content-automation-pulse\]\s+verify_jwt = false/);
  assert.match(config, /\[functions\.safe-content-publisher\]\s+verify_jwt = false/);
  assert.match(config, /\[functions\.scheduled-authorized-publisher\]\s+verify_jwt = false/);
});
