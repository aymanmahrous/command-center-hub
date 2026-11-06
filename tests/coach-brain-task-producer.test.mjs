import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const coachBrain = await readFile(new URL("../src/coach-brain.tsx", import.meta.url), "utf8");
const handoff = await readFile(new URL("../src/coach-brain-factory-handoff.ts", import.meta.url), "utf8");

test("Coach Brain emits the complete canonical task contract at the existing Factory handoff", () => {
  assert.match(coachBrain, /const userIntent = question\.trim\(\)/);
  assert.match(coachBrain, /const researchSummary = result\?\.answer/);
  assert.match(coachBrain, /const researchSources = result\?\.sources/);
  assert.match(coachBrain, /const requestedDuration = selectedPlanDays\(\)/);
  assert.match(coachBrain, /const contentGoal = sample\?\.topic/);
  assert.match(coachBrain, /userIntent,/);
  assert.match(coachBrain, /planStrategy: `\$\{planMix\}:\$\{planExecution\}`/);
  assert.match(coachBrain, /researchContext: \{ summary: researchSummary, sources: researchSources \}/);
  assert.match(coachBrain, /requestedDuration,/);
  assert.match(coachBrain, /contentGoal,/);
  assert.match(coachBrain, /writeCoachBrainFactoryHandoff\(handoff\)/);
  assert.match(coachBrain, /factoryContext.*coach-brain/);

  // Legacy fields are deliberately kept for the existing Factory consumer.
  assert.match(coachBrain, /question: userIntent/);
  assert.match(coachBrain, /answer: researchSummary/);
  assert.match(coachBrain, /sources: researchSources/);
  assert.match(coachBrain, /planWindowDays: requestedDuration/);
  assert.match(handoff, /COACH_BRAIN_FACTORY_HANDOFF_KEY = "coach-brain-factory-handoff"/);
});

test("Coach Brain only offers execution choices that have real provider routing", () => {
  assert.match(coachBrain, /useState<"best" \| "value">\("best"\)/);
  assert.match(coachBrain, /<option value="best">/);
  assert.match(coachBrain, /<option value="value">Gemini<\/option>/);
  assert.doesNotMatch(coachBrain, /<option value="(library|design|manual)">/);
  assert.match(coachBrain, /planExecution === "value" \? "gemini" : "auto"/);
});

test("Coach Brain verifies the stored handoff before navigating to Factory", () => {
  assert.match(coachBrain, /const saved = writeCoachBrainFactoryHandoff\(handoff\)/);
  assert.match(coachBrain, /const restored = readCoachBrainFactoryHandoff\(\)/);
  assert.match(coachBrain, /restored\.createdAt !== createdAt/);
  assert.match(coachBrain, /setError\(t\.handoffSaveError\)/);
  assert.ok(coachBrain.indexOf("restored.createdAt !== createdAt") < coachBrain.indexOf('url.searchParams.set("section", "content")'));
});

test("Coach Brain describes the automatic provider route instead of claiming it is best", () => {
  assert.match(coachBrain, /Automatic — Gemini if configured, otherwise OpenAI/);
  assert.match(coachBrain, /تلقائي — Gemini إذا كان مضبوطًا، وإلا OpenAI/);
});
