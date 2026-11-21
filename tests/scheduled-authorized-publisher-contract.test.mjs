import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
const source = await readFile(new URL("../supabase/functions/scheduled-authorized-publisher/index.ts", import.meta.url), "utf8");
const config = await readFile(new URL("../supabase/config.toml", import.meta.url), "utf8");

test("Instagram prefers its stored OAuth token and a frozen request performs no lookup", async () => {
  const requests = [];
  let handler;
  let stored = " saved ";
  const env = { CONTENT_PUBLISHER_AUTOMATION_SECRET: "fixture", INSTAGRAM_ACCESS_TOKEN: "fallback" };
  const sandbox = {
    Deno: { env: { get: key => env[key] }, serve: fn => { handler = fn; } },
    Response, TextEncoder,
    exports: {}, require: () => ({}),
    fetch: async url => {
      requests.push(url);
      const rows = url.includes("staff_integrations?")
        ? [{ id: "fixture-row", status: "pending" }]
        : [{ secret_value: stored }];
      return Response.json(rows);
    },
  };
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const { resolveAccessToken, publishInstagram } = runInNewContext(js + "\n({ resolveAccessToken, publishInstagram })", sandbox);
  const frozen = await handler(new Request("https://fixture.invalid", {
    method: "POST", headers: { "x-content-publisher-automation-secret": "fixture" },
  }));
  assert.equal(frozen.status, 423);
  assert.equal((await frozen.json()).code, "OWNER_PUBLISHING_FROZEN");
  assert.deepEqual(requests, []);
  await publishInstagram("fixture", "fixture-image", "image");
  assert.match(requests[0], /staff_integrations\?provider=eq\.instagram&/);
  assert.match(requests[1], /staff_integration_secrets\?integration_id=eq\.fixture-row&/);
  assert.equal(await resolveAccessToken("instagram"), "saved");
  stored = "";
  assert.equal(await resolveAccessToken("instagram"), "fallback");
});

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
  assert.match(config, /\[functions\.canva-design\]\s+verify_jwt = false/);
  assert.match(config, /\[functions\.facebook-oauth\]\s+verify_jwt = false/);
  assert.match(config, /\[functions\.meta-provider-status\]\s+verify_jwt = false/);
});
