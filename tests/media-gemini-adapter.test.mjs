import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adapter = await readFile(new URL("../src/media-gemini-adapter.ts", import.meta.url), "utf8");
const edge = await readFile(new URL("../supabase/functions/analyze-staff-media/index.ts", import.meta.url), "utf8");
const batch = await readFile(new URL("../supabase/functions/generate-content-batch/index.ts", import.meta.url), "utf8");

test("gemini adapter stays server-side and never embeds client secrets", () => {
  assert.match(adapter, /analyze-staff-media/);
  assert.match(adapter, /GEMINI_CREDENTIAL_ENV_VAR = "GEMINI_API_KEY"/);
  assert.match(adapter, /NEEDS CREDENTIAL/);
  assert.match(adapter, /server-side/);
  assert.match(adapter, /analyzeMediaWithProvider/);
  assert.doesNotMatch(adapter, /VITE_GEMINI|apiKey\s*=|API_KEY\s*=\s*["']/i);
});

test("analyze-staff-media edge function keeps Gemini key server-side only", () => {
  assert.match(edge, /Deno\.env\.get\("GEMINI_API_KEY"\)/);
  assert.match(edge, /NEEDS_CREDENTIAL/);
  assert.match(edge, /x-goog-api-key/);
  assert.match(edge, /verifyGeminiCredential/);
  assert.match(edge, /EXTERNAL CHECK VERIFIED/);
  assert.match(edge, /functionVerified: false/);
  assert.match(edge, /functionVerified: true/);
  assert.doesNotMatch(edge, /credentialsConfigured\)\s*\{[\s\S]{0,80}connected: true/);
  assert.match(edge, /Consent required/);
  assert.doesNotMatch(edge, /VITE_|console\.log\(.*GEMINI/i);
});

test("Gemini status separates configured credentials, safe external verification, and executed function success", () => {
  assert.match(adapter, /CREDENTIALS CONFIGURED/);
  assert.match(adapter, /EXTERNAL CHECK VERIFIED/);
  assert.match(adapter, /function has not run|media analysis has not run/i);
  assert.match(batch, /verifyGeminiCredential/);
  assert.match(batch, /functionVerified: false/);
  assert.match(batch, /Batch generation has not been run/);
  assert.match(batch, /integrationStatus: "CREDENTIALS CONFIGURED"/);
});

test("Gemini text endpoints use the currently supported stable Flash model", () => {
  assert.match(edge, /const GEMINI_MODEL = "gemini-3\.8-flash"/);
  assert.match(batch, /const GEMINI_MODEL = "gemini-3\.8-flash"/);
  assert.doesNotMatch(edge, /temperature\s*:/);
  assert.doesNotMatch(batch, /temperature\s*:/);
});
