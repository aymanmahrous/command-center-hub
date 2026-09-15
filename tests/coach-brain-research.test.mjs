import test from "node:test";
import assert from "node:assert/strict";
import { buildCoachResearchBrief } from "../src/coach-brain-research.ts";

test("builds generic research terms for autism, distress and bubble blowing", () => {
  const brief = buildCoachResearchBrief({
    age: "8",
    issue: "cries when water reaches face",
    observation: "refuses face immersion",
    goal: "learn blowing bubbles in water",
    diagnosis: "autism",
  });

  assert.equal(brief.privacy.identifiersRequired, false);
  assert.equal(brief.privacy.excludeNames, true);
  assert.ok(brief.searchTerms.some((term) => term.includes("autism swimming")));
  assert.ok(brief.searchTerms.some((term) => term.includes("bubble blowing")));
  assert.ok(brief.searchTerms.some((term) => term.includes("distress")));
});

test("does not include a child name in the generated brief", () => {
  const brief = buildCoachResearchBrief({
    issue: "freestyle breathing difficulty",
    goal: "improve bilateral breathing",
  });

  assert.equal("Ayman", brief.searchTerms.find((term) => term.includes("Ayman")), undefined);
  assert.equal(brief.privacy.excludeNames, true);
});
