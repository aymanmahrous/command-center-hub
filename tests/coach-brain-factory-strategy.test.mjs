import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const coachBrain = await readFile(new URL("../src/coach-brain.tsx", import.meta.url), "utf8");
const handoff = await readFile(new URL("../src/coach-brain-factory-handoff.ts", import.meta.url), "utf8");
const factory = await readFile(new URL("../src/content-growth-hub.tsx", import.meta.url), "utf8");
const review = await readFile(new URL("../src/content-batch-review-panel.tsx", import.meta.url), "utf8");
const research = await readFile(new URL("../supabase/functions/coach-brain-research/index.ts", import.meta.url), "utf8");
const slotSpec = await readFile(new URL("../supabase/functions/generate-content-batch/coach-ayman-slot-spec.ts", import.meta.url), "utf8");
const batchGenerator = await readFile(new URL("../supabase/functions/generate-content-batch/index.ts", import.meta.url), "utf8");

test("Coach Brain and Factory accept only the supported 1–10 day planning window", () => {
  assert.match(coachBrain, /Math\.min\(30/);
  assert.match(coachBrain, /min=\{1\} max=\{10\}/);
  assert.doesNotMatch(coachBrain, /value="60"/);
  assert.match(factory, /PLAN_WINDOW_OPTIONS = \[1, 2, 3, 4, 7, 14, 30\]/);
  assert.match(factory, /Math\.min\(30/);
  assert.match(factory, /max=\{30\}/);
  assert.doesNotMatch(factory, /Math\.min\(365/);
  assert.match(factory, /45 - planWindowDays/);
});

test("Factory preserves the existing ten-item batch and spaces it across the selected window", () => {
  assert.match(factory, /DEFAULT_BATCH_MIX\.length/);
  assert.match(factory, /safeDays - 1/);
  assert.match(factory, /covers every day in this 1–10 day window/);
});

test("handoff normalization preserves canonical fields and clamps duration to 10 days", () => {
  assert.match(handoff, /userIntent: string/);
  assert.match(handoff, /planStrategy: string/);
  assert.match(handoff, /researchContext:/);
  assert.match(handoff, /requestedDuration: number \| null/);
  assert.match(handoff, /contentGoal: string/);
  assert.match(handoff, /Math\.max\(1, Math\.min\(30/);
});

test("Runway is an honest manual handoff, not a claimed API integration", () => {
  assert.match(review, /openExternalBrief\("runway", item\)/);
  assert.match(review, /navigator\.clipboard\?\.writeText/);
  assert.match(review, /no API connection required/);
  assert.match(review, /Open Runway \+ copy video prompt/);
});

test("Coach Brain research prompt keeps business strategy guidance syntactically separated", () => {
  assert.match(research, /buildCoachBrainBusinessContext/);
  assert.match(research, /not one post per day\.",\s*"Business and marketing planning:/);
  assert.match(research, /return parts\.join\("\\n\\n"\)/);
});


test("every Factory daily item receives an Arabic-first bilingual design prompt, including template fallback", () => {
  assert.match(slotSpec, /fallbackHeadlineByPillar/);
  assert.match(slotSpec, /HEADLINE: \$\{fallbackHeadline\}/);
  assert.match(slotSpec, /SUPPORTING TEXT: نص عربي واضح[\s\S]*?Clear, reassuring guidance/);
  assert.match(batchGenerator, /const visualPrompt = ensureMediaBrief\(rawVisualPrompt, slot, primaryCta\)/);
  assert.match(batchGenerator, /const line = visualPrompt\.split/);
  assert.doesNotMatch(batchGenerator, /const line = rawVisualPrompt\.split/);
});


test("each populated plan day opens the review workspace where its daily design prompts are shown", () => {
  assert.match(factory, /selectFactoryTab\(dayItems\.length > 0 \? "review" : "strategy"\)/);
  assert.match(review, /content-daily-design-prompt/);
  assert.match(review, /item\.visualPrompt/);
});
