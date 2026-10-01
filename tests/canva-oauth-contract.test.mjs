import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseCanvaAction, requireCanvaBearer } from "../supabase/functions/canva-oauth/contract.ts";

function postRequest({ authorization, body = "{}" } = {}) {
  const headers = { "content-type": "application/json" };
  if (authorization !== undefined) headers.authorization = authorization;
  return new Request("https://example.test/functions/v1/canva-oauth", {
    method: "POST",
    headers,
    body,
  });
}

async function assertError(response, { status, code }) {
  assert.equal(response.status, status);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/i);
  assert.deepEqual(await response.json(), { success: false, code });
}

test("missing, malformed, or unsupported Authorization returns 401 AUTH_REQUIRED", async (t) => {
  const cases = [
    ["missing header", undefined],
    ["Basic scheme", "Basic abc"],
    ["lowercase bearer scheme", "bearer abc"],
    ["empty bearer value", "Bearer "],
  ];

  for (const [label, authorization] of cases) {
    await t.test(label, async () => {
      const result = requireCanvaBearer(postRequest({ authorization }));
      assert.equal(result.ok, false);
      if (result.ok) return;
      await assertError(result.response, { status: 401, code: "AUTH_REQUIRED" });
    });
  }
});

test("a syntactically valid Bearer token passes the header gate", () => {
  const result = requireCanvaBearer(postRequest({ authorization: "Bearer test-session-token" }));
  assert.deepEqual(result, { ok: true, value: "test-session-token" });
});

test("invalid JSON after authentication maps to 400 INVALID_INPUT", async () => {
  const action = await parseCanvaAction(postRequest({
    authorization: "Bearer test-session-token",
    body: "{broken-json",
  }));
  assert.equal(action.ok, false);
  if (action.ok) return;
  await assertError(action.response, { status: 400, code: "INVALID_INPUT" });
});

test("missing or unsupported mode maps to 400 INVALID_INPUT", async (t) => {
  for (const body of ["{}", '{"mode":"callback"}', "null"]) {
    await t.test(body, async () => {
      const action = await parseCanvaAction(postRequest({
        authorization: "Bearer test-session-token",
        body,
      }));
      assert.equal(action.ok, false);
      if (action.ok) return;
      await assertError(action.response, { status: 400, code: "INVALID_INPUT" });
    });
  }
});

test("only status and authorize are valid Canva POST actions", async () => {
  for (const mode of ["status", "authorize"]) {
    const action = await parseCanvaAction(postRequest({
      authorization: "Bearer test-session-token",
      body: JSON.stringify({ mode }),
    }));
    assert.deepEqual(action, { ok: true, value: mode });
  }
});

test("the Edge Function uses the tested guards in authentication-first order", async () => {
  const edge = await readFile(new URL("../supabase/functions/canva-oauth/index.ts", import.meta.url), "utf8");
  assert.match(edge, /import \{[^}]*parseCanvaAction[^}]*requireCanvaBearer[^}]*\} from "\.\/contract\.ts"/);
  const authIndex = edge.indexOf("const auth = requireCanvaBearer(request)");
  const staffIndex = edge.indexOf("requireStaff(supabase, auth.value)");
  const actionIndex = edge.indexOf("parseCanvaAction(request)");
  assert.ok(authIndex >= 0 && staffIndex > authIndex && actionIndex > staffIndex);
});
