import assert from "node:assert/strict";
import test from "node:test";
import {
  canUseInMarketingBatch,
  derivePublishability,
  displayMediaWorkflowStatus,
  isMarketingEligibleCategory,
  normalizeMediaCategory,
} from "../src/media-types.ts";

test("family/personal and unclassified remain blocked", () => {
  assert.equal(isMarketingEligibleCategory("family_personal"), false);
  assert.equal(isMarketingEligibleCategory("unclassified"), false);
  assert.equal(isMarketingEligibleCategory("swimming_business"), true);
  assert.equal(derivePublishability("family_personal", "consent_confirmed", "ready"), "blocked");
});

test("swimming business requires confirmed consent and a ready file", () => {
  assert.equal(derivePublishability("swimming_business", "consent_confirmed", "ready"), "ready_for_review");
  assert.equal(derivePublishability("swimming_business", "pending", "ready"), "blocked");
  assert.equal(derivePublishability("swimming_business", "consent_confirmed", "pending"), "blocked");
  assert.equal(derivePublishability("swimming_business", "consent_confirmed", "ready", "unsuitable"), "blocked");
});

test("other business can be reviewable without personal consent when the file is ready", () => {
  assert.equal(derivePublishability("other_business", null, "ready"), "ready_for_review");
  assert.equal(derivePublishability("other_business", null, "processing"), "blocked");
});

test("marketing batch use requires ready status, eligible category, consent, and reviewability", () => {
  const base = {
    category: "swimming_business",
    mediaStatus: "ready",
    publishabilityStatus: "ready_for_review",
  };
  assert.equal(canUseInMarketingBatch({ ...base, consentStatus: "consent_confirmed" }), true);
  assert.equal(canUseInMarketingBatch({ ...base, consentStatus: "pending" }), false);
  assert.equal(canUseInMarketingBatch({ ...base, consentStatus: "consent_confirmed", mediaStatus: "pending" }), false);
});

test("normalizeMediaCategory defaults to unclassified", () => {
  assert.equal(normalizeMediaCategory(null), "unclassified");
  assert.equal(normalizeMediaCategory("swimming_business"), "swimming_business");
});

test("displayMediaWorkflowStatus reflects technical file status, not human approval", () => {
  assert.equal(displayMediaWorkflowStatus({ mediaStatus: "pending" }), "pending");
  assert.equal(displayMediaWorkflowStatus({ mediaStatus: "ready" }), "ready");
  assert.equal(displayMediaWorkflowStatus({ mediaStatus: "processing" }), "processing");
  assert.equal(displayMediaWorkflowStatus({ mediaStatus: "failed" }), "failed");
});
