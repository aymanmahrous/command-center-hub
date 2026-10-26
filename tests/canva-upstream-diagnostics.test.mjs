import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../supabase/functions/canva-design/index.ts", import.meta.url), "utf8");

test("Canva upstream failures emit sanitized stage/status diagnostics", () => {
  const start = source.indexOf('async function canvaFetch');
  assert.notEqual(start, -1, "canvaFetch must exist");
  const end = source.indexOf('return { ok: response.ok, status: response.status, payload };', start);
  assert.notEqual(end, -1, "canvaFetch response contract must remain explicit");
  const block = source.slice(start, end);

  assert.match(block, /if \(!response\.ok\)/);
  assert.match(block, /console\.warn\("\[canva-design\] upstream request failed"/);
  assert.match(block, /endpoint: safeEndpoint/);
  assert.match(block, /status: response\.status/);
  assert.match(block, /requestId: response\.headers\.get\("x-request-id"\)/);
  assert.match(block, /brand-templates\|designs\|autofills\|exports\|asset-uploads/);
  assert.doesNotMatch(block, /access_token|refresh_token|CANVA_CLIENT_SECRET|Authorization:/i);
  assert.doesNotMatch(block, /payload\s*:/i, "raw provider payload must not be written to logs");
});
