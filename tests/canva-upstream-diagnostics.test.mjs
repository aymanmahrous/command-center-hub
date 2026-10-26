import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../supabase/functions/canva-design/index.ts", import.meta.url), "utf8");

test("Canva upstream failures emit sanitized stage/status diagnostics", () => {
  const start = source.indexOf("async function canvaFetch");
  assert.notEqual(start, -1, "canvaFetch must exist");
  const end = source.indexOf("return { ok: response.ok, status: response.status, payload };", start);
  assert.notEqual(end, -1, "canvaFetch response contract must remain explicit");
  const block = source.slice(start, end);
  const diagnosticStart = block.indexOf("if (!response.ok) {");
  const diagnosticEnd = block.indexOf("\n  }", diagnosticStart);
  assert.notEqual(diagnosticStart, -1, "non-success response diagnostics must exist");
  assert.notEqual(diagnosticEnd, -1, "diagnostic block must close");
  const diagnostic = block.slice(diagnosticStart, diagnosticEnd);

  assert.match(diagnostic, /console\.warn\("\[canva-design\] upstream request failed"/);
  assert.match(diagnostic, /endpoint: safeEndpoint/);
  assert.match(diagnostic, /status: response\.status/);
  assert.match(diagnostic, /requestId: response\.headers\.get\("x-request-id"\)/);
  assert.match(diagnostic, /brand-templates\|designs\|autofills\|exports\|asset-uploads/);
  assert.doesNotMatch(diagnostic, /access_token|refresh_token|CANVA_CLIENT_SECRET|Authorization:|payload\s*:/i);
});
