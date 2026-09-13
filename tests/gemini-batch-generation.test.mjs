import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adapter = await readFile(new URL("../src/gemini-batch-adapter.ts", import.meta.url), "utf8");
const edge = await readFile(new URL("../supabase/functions/generate-content-batch/index.ts", import.meta.url), "utf8");
const slotSpec = await readFile(new URL("../supabase/functions/generate-content-batch/coach-ayman-slot-spec.ts", import.meta.url), "utf8");
const generator = await readFile(new URL("../src/content-batch-generator.ts", import.meta.url), "utf8");
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
  assert.match(edge, /coach-ayman-slot-spec\.ts/);
  assert.match(edge, /captionBody/);
  assert.match(edge, /ensureMediaBrief/);
});

test("gemini slot spec aligns with local batch strategy mix", () => {
  assert.match(slotSpec, /COACH_AYMAN_SLOT_SPEC/);
  assert.match(slotSpec, /contentType: "story"/);
  assert.match(slotSpec, /contentType: "short_video"/);
  assert.match(slotSpec, /contentType: "reel"/);
  assert.match(slotSpec, /contentType: "carousel"/);
  assert.match(slotSpec, /funnel: "engagement"/);
  assert.match(slotSpec, /primaryCtaKey: "book"/);
  assert.match(slotSpec, /FORMAT:/);
  assert.match(slotSpec, /CANVA:/);
  assert.match(slotSpec, /CAPCUT:/);
  assert.match(slotSpec, /RUNWAY \(optional\)/);
  assert.match(generator, /contentType: "story"/);
  assert.match(generator, /contentType: "short_video"/);
  assert.match(generator, /primaryCta: PRIMARY_CTAS\.book/);
});

test("content growth hub prefers Gemini batch generation with template fallback", () => {
  assert.match(hub, /generateCoachAymanBatchWithGemini/);
  assert.match(hub, /buildCoachAyman2026BatchWithMedia/);
});
