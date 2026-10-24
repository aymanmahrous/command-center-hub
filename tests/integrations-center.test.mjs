import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20260920130000_staff_integrations_center.sql", import.meta.url), "utf8");
const view = await readFile(new URL("../src/integrations-center.tsx", import.meta.url), "utf8");
const app = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
const canvaOAuth = await readFile(new URL("../supabase/functions/canva-oauth/index.ts", import.meta.url), "utf8");

test("generic connected status remains explicitly local, not external operation", () => {
  assert.match(view, /connected: "اجتاز اختبار الإعداد المحلي"/);
  assert.match(view, /connected: "Local config test passed"/);
  assert.match(migration, /result', 'configured'/);
  assert.match(view, /اختبارات الإعداد المحلية لا تستدعي المزود؛ اختبار Canva يقرأ بيانات الحساب فقط ولا ينشر أو يرسل/);
});

test("first-batch integrations are in-app, masked, audited, and fail closed", () => {
  assert.match(migration, /staff_integration_secrets/);
  assert.match(migration, /revoke all on public\.staff_integration_secrets from public, anon, authenticated/i);
  assert.match(migration, /integration_connected/);
  assert.match(migration, /integration_disconnected/);
  assert.match(migration, /integration_tested/);
  assert.doesNotMatch(migration, /secret_value.*audit_logs/i);
  assert.match(view, /connect_staff_integration/);
  assert.match(view, /test_staff_integration/);
  assert.match(view, /disconnect_staff_integration/);
  assert.match(view, /type="password"/);
  assert.match(app, /get_staff_integrations/);
  assert.match(app, /active === "connections"/);
});

test("Canva connected states expose a separate real-read test without removing reconnect", () => {
  assert.match(view, /const canvaNeedsOauth = item\.provider === "canva" && \["connected", "needs_test", "error"\]\.includes\(item\.status\)/);
  assert.match(view, /item\.provider === "canva" && canvaNeedsOauth && <button/);
  assert.match(view, /mode: "test"/);
  assert.match(view, /item\.provider === "canva" \? void testCanvaConnection\(\)/);
  assert.match(view, /اختبار قراءة Canva/);
});

test("Canva card displays the recorded test time and last error code", () => {
  assert.match(view, /formatTestedAt\(item\.lastTestedAt, language\)/);
  assert.match(view, /item\.lastErrorCode/);
  assert.match(view, /Last recorded test:/);
});

test("Canva test performs a read-only user-profile request and records both outcomes", () => {
  assert.match(canvaOAuth, /CANVA_USER_ME_URL = "https:\/\/api\.canva\.com\/rest\/v1\/users\/me"/);
  const recorder = canvaOAuth.slice(canvaOAuth.indexOf("async function recordCanvaConnectionTest"), canvaOAuth.indexOf("async function handleConnectionTest"));
  const handler = canvaOAuth.slice(canvaOAuth.indexOf("async function handleConnectionTest"), canvaOAuth.indexOf("async function handleAuthorize"));
  assert.match(handler, /method: "GET"/);
  assert.match(handler, /Authorization: `Bearer \$\{tokenResult\.accessToken\}`/);
  assert.match(handler, /if \(!response\.ok\)/);
  assert.match(recorder, /last_tested_at: testedAt/);
  assert.match(recorder, /last_error_code: errorCode \?\? null/);
  assert.match(recorder, /external_read_failed/);
  assert.match(recorder, /external_read_verified/);
  assert.doesNotMatch(handler, /createAutofillDesign|exportDesignPng/);
});

test("external identity checks do not falsely mark design generation as available", () => {
  assert.match(view, /function capabilityState\(status: z\.infer<typeof Item>\["status"\]\): CapabilityState/);
  assert.match(view, /identity\/credential check does not prove that publishing or messaging works/);
  assert.doesNotMatch(view, /status === "connected" && lastTestedAt && verifiedExternally\) return "AVAILABLE"/);
  assert.match(view, /const state = capabilityState\(item\.status\)/);
});

test("external verification label refers to the connection, not design capability readiness", () => {
  assert.match(view, /تم التحقق من الاتصال الخارجي/);
  assert.match(view, /External connection verified/);
  assert.match(view, /configuration exists, but external operation is not verified/);
});
