import assert from "node:assert/strict";
import test from "node:test";
import {
  readCoachBrainFactoryHandoff,
  writeCoachBrainFactoryHandoff,
} from "../src/coach-brain-factory-handoff.ts";

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
}

test("legacy Coach Brain payload is normalized into the canonical task contract", () => {
  const session = memoryStorage();
  const payload = {
    question: "خطة محتوى تعليمية للسباحة",
    answer: "ملخص البحث والمصادر",
    sources: [{ title: "Evidence", url: "https://example.test/evidence" }],
    planWindowDays: 7,
    planMix: "education",
    planExecution: "manual",
    sample: { topic: "أخطاء التنفس في السباحة" },
  };

  assert.equal(writeCoachBrainFactoryHandoff(JSON.stringify(payload), {
    sessionStorage: session,
    localStorage: null,
  }), true);

  const normalized = readCoachBrainFactoryHandoff({
    sessionStorage: session,
    localStorage: null,
  });

  assert.equal(normalized?.userIntent, payload.question);
  assert.equal(normalized?.planStrategy, "education:manual");
  assert.equal(normalized?.researchContext.summary, payload.answer);
  assert.deepEqual(normalized?.researchContext.sources, payload.sources);
  assert.equal(normalized?.requestedDuration, 7);
  assert.equal(normalized?.contentGoal, payload.sample.topic);

  // Existing Factory contract remains intact during the migration.
  assert.equal(normalized?.question, payload.question);
  assert.equal(normalized?.answer, payload.answer);
  assert.equal(normalized?.planWindowDays, 7);
  assert.equal(normalized?.planMix, "education");
  assert.equal(normalized?.planExecution, "manual");
});

test("canonical task fields are bounded and malformed handoffs remain rejected", () => {
  const session = memoryStorage();
  const payload = {
    question: "  Intent  ",
    answer: "  Research  ",
    sources: [],
    userIntent: "I".repeat(1500),
    planStrategy: "S".repeat(300),
    requestedDuration: 99,
    contentGoal: "G".repeat(900),
    researchContext: { summary: "R".repeat(5000), sources: [] },
  };

  assert.equal(writeCoachBrainFactoryHandoff(JSON.stringify(payload), {
    sessionStorage: session,
    localStorage: null,
  }), true);

  const normalized = readCoachBrainFactoryHandoff({
    sessionStorage: session,
    localStorage: null,
  });
  assert.equal(normalized?.userIntent.length, 1000);
  assert.equal(normalized?.planStrategy.length, 160);
  assert.equal(normalized?.requestedDuration, 30);
  assert.equal(normalized?.contentGoal.length, 500);
  assert.equal(normalized?.researchContext.summary.length, 4000);

  assert.equal(writeCoachBrainFactoryHandoff(JSON.stringify({ question: "missing answer" }), {
    sessionStorage: session,
    localStorage: null,
  }), true);
  assert.equal(readCoachBrainFactoryHandoff({
    sessionStorage: session,
    localStorage: null,
  }), null);
});


test("canonical-only task contract is adapted into the existing Factory context", () => {
  const session = memoryStorage();
  const payload = {
    userIntent: "جهز حملة تعليمية للسباحة",
    planStrategy: "education:best",
    researchContext: {
      summary: "أدلة حديثة حول تعليم السباحة",
      sources: [{ title: "Research", url: "https://example.test/research" }],
    },
    requestedDuration: 10,
    contentGoal: "تصحيح أخطاء التنفس في السباحة",
  };

  assert.equal(writeCoachBrainFactoryHandoff(JSON.stringify(payload), {
    sessionStorage: session,
    localStorage: null,
  }), true);

  const normalized = readCoachBrainFactoryHandoff({
    sessionStorage: session,
    localStorage: null,
  });

  assert.equal(normalized?.userIntent, payload.userIntent);
  assert.equal(normalized?.planStrategy, payload.planStrategy);
  assert.equal(normalized?.researchContext.summary, payload.researchContext.summary);
  assert.deepEqual(normalized?.researchContext.sources, payload.researchContext.sources);
  assert.equal(normalized?.requestedDuration, 10);
  assert.equal(normalized?.contentGoal, payload.contentGoal);

  // Existing Factory reads these legacy fields; the adapter carries all canonical inputs across.
  assert.equal(normalized?.question, `${payload.userIntent}\nContent goal: ${payload.contentGoal}`);
  assert.equal(normalized?.answer, payload.researchContext.summary);
  assert.deepEqual(normalized?.sources, payload.researchContext.sources);
  assert.equal(normalized?.planWindowDays, 10);
  assert.equal(normalized?.planMix, "education");
  assert.equal(normalized?.planExecution, "best");
});
