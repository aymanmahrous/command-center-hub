import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const contract = await readFile(new URL("../supabase/functions/canva-oauth/contract.ts", import.meta.url), "utf8");
const edge = await readFile(new URL("../supabase/functions/canva-oauth/index.ts", import.meta.url), "utf8");

test("Canva OAuth contract enforces the expected bearer header gate", () => {
  assert.match(contract, /authorization\.startsWith\("Bearer "\)/);
  assert.match(contract, /AUTH_REQUIRED/);
  assert.match(contract, /jsonError\("AUTH_REQUIRED", 400\)/);
  assert.match(contract, /value: token/);
});

test("Canva OAuth contract accepts only status, authorize, and read-test actions", () => {
  assert.match(contract, /mode === "status" \|\| mode === "authorize" \|\| mode === "test"/);
  assert.match(contract, /INVALID_INPUT/);
});

test("Canva OAuth contract maps malformed JSON to INVALID_INPUT", () => {
  assert.match(contract, /request\.json\(\)\.catch\(\(\) => \(\{\}\)\)/);
  assert.match(contract, /return \{ ok: false, response: jsonError\("INVALID_INPUT", 400\) \}/);
});

test("Canva OAuth Edge Function uses authentication-first guards", () => {
  assert.match(edge, /import \{[^}]*parseCanvaAction[^}]*requireCanvaBearer[^}]*\} from "\.\/contract\.ts"/);
  const authIndex = edge.indexOf("const auth = requireCanvaBearer(request)");
  const staffIndex = edge.indexOf("requireStaff(supabase, auth.value)");
  const actionIndex = edge.indexOf("parseCanvaAction(request)");
  assert.ok(authIndex >= 0 && staffIndex > authIndex && actionIndex > staffIndex);
});

test("Canva external test reads users/me and never creates or exports a design", () => {
  const handler = edge.slice(edge.indexOf("async function handleConnectionTest"), edge.indexOf("async function handleAuthorize"));
  assert.match(handler, /CANVA_USER_ME_URL/);
  assert.match(handler, /method: "GET"/);
  assert.match(handler, /CANVA_API_TIMEOUT/);
  assert.match(handler, /CANVA_API_REQUEST_FAILED/);
  assert.match(handler, /if \(!response\.ok\)/);
  assert.doesNotMatch(handler, /createAutofillDesign|exportDesignPng/);
  assert.match(edge, /action\.value === "test"\) return handleConnectionTest/);
});
