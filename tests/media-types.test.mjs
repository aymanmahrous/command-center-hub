import assert from "node:assert/strict";
import test from "node:test";
import {
  canUseInMarketingBatch,
  derivePublishability,
  isMarketingEligibleCategory,
  normalizeMediaCategory,
} from "../src/media-types.ts";

test("family/personal and unclassified are blocked from marketing batches", () => {
  assert.equal(isMarketingEligibleCategory("family_personal"), false);
  assert.equal(isMarketingEligibleCategory("unclassified"), false);
  assert.equal(isMarketingEligibleCategory("swimming_business"), true);
  assert.equal(derivePublishability("family_personal", "consent_confirmed", "approved"), "blocked");
});

test("swimming business requires consent_confirmed for batch use", () => {
  const base = {
    category: "swimming_business",
    mediaStatus: "approved",
    publishabilityStatus: "ready_for_review",
  };
  assert.equal(canUseInMarketingBatch({ ...base, consentStatus: "consent_confirmed" }), true);
  assert.equal(canUseInMarketingBatch({ ...base, consentStatus: "consent_required" }), false);
  assert.equal(canUseInMarketingBatch({ ...base, consentStatus: "unknown" }), false);
});

test("normalizeMediaCategory defaults to unclassified", () => {
  assert.equal(normalizeMediaCategory(null), "unclassified");
  assert.equal(normalizeMediaCategory("swimming_business"), "swimming_business");
});
