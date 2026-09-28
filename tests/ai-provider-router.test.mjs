import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const edge = await readFile(new URL("../supabase/functions/ai-provider-router/index.ts", import.meta.url), "utf8");
const adapter = await readFile(new URL("../src/ai-provider-adapter.ts", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260929010000_staff_ai_provider_selection.sql", import.meta.url), "utf8");
const panel = await readFile(new URL("../src/integrations-center.tsx", import.meta.url), "utf8");

 test("provider router is server-side, staff-gated, and allowlisted", () => {
  assert.match(edge, /Deno\.env\.get\("GEMINI_API_KEY"\)/);
  assert.match(edge, /Deno\.env\.get\("OPENAI_API_KEY"\)/);
  assert.match(edge, /requireStaff/);
  assert.match(edge, /body\.provider !== "gemini" && body\.provider !== "openai"/);
  assert.doesNotMatch(edge, /VITE_|localStorage|sessionStorage/);
});

test("provider selection persists only a provider name through the existing integration row", () => {
  assert.match(migration, /set_staff_ai_provider/);
  assert.match(migration, /selectedProvider/);
  assert.match(migration, /ai_provider_selected/);
  assert.doesNotMatch(migration, /secret_value|OPENAI_API_KEY|GEMINI_API_KEY/);
});

test("browser adapter sends only the selected provider and never a secret", () => {
  assert.match(adapter, /functions\/v1\/ai-provider-router/);
  assert.match(adapter, /mode: "select"/);
  assert.doesNotMatch(adapter, /OPENAI_API_KEY|GEMINI_API_KEY|secret|token\s*=/i);
});

test("switch remains inside the existing AI provider integration card", () => {
  assert.match(panel, /ai-provider-switch/);
  assert.match(panel, /selectAiProvider/);
  assert.match(panel, /set_staff_ai_provider/);
});
