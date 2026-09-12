import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adapter = await readFile(new URL("../src/gemini-batch-adapter.ts", import.meta.url), "utf8");
const edge = await readFile(new URL("../supabase/functions/generate-content-batch/index.ts", import.meta.url), "utf8");
const hub = await readFile(new URL("../src/content-growth-hub.tsx", import.meta.url), "utf8");

test("gemini batch adapter calls server edge function only", () => {
  assert.match(adapter, /functions\/v1\/generate-content-batch/);
  assert.match(adapter, /generateCoachAymanBatchWithGemini/);
  assert.doesNotMatch(adapter, /GEMINI_API_KEY|VITE_GEMINI/i);
});

test("generate-content-batch edge function keeps Gemini key server-side", () => {
  assert.match(edge, /Deno\.env\.get\("GEMINI_API_KEY"\)/);
  assert.match(edge, /mode !== "generate"/);
  assert.match(edge, /Relax Fix UAE Swimming Academy/);
});

test("content growth hub prefers Gemini batch generation with template fallback", () => {
  assert.match(hub, /generateCoachAymanBatchWithGemini/);
  assert.match(hub, /buildCoachAyman2026BatchWithMedia/);
});
