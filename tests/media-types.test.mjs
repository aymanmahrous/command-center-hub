import assert from "node:assert/strict";
import test from "node:test";
import {
  canUseInMarketingBatch,
  derivePublishability,
  displayMediaWorkflowStatus,
  isMarketingEligibleCategory,
  normalizeMediaCategory,
  isSyntheticConsentExempt,
  isConsentNotApplicable,
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
    source: "upload",
    metadata: {},
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

test("marketing eligibility honors only an explicit generated synthetic attestation", () => {
  const synthetic = {
    category: "swimming_business",
    consentStatus: null,
    mediaStatus: "ready",
    publishabilityStatus: "ready_for_review",
    source: "generated",
    metadata: { consentApplicability: "not_applicable_synthetic", containsRealPerson: false },
  };
  assert.equal(canUseInMarketingBatch(synthetic), true);
  assert.equal(canUseInMarketingBatch({ ...synthetic, metadata: {} }), false);
  assert.equal(canUseInMarketingBatch({ ...synthetic, source: "upload" }), false);
  const uploadedNoPerson = { ...synthetic, source: "upload", metadata: { consentApplicability: "not_applicable_no_real_person", containsRealPerson: false } };
  assert.equal(canUseInMarketingBatch(uploadedNoPerson), true);
  assert.equal(canUseInMarketingBatch({ ...uploadedNoPerson, metadata: { consentApplicability: "not_applicable_no_real_person", containsRealPerson: true } }), false);
});

test("synthetic consent exemption requires explicit generated-source attestation", () => {
  assert.equal(isSyntheticConsentExempt("generated", {
    consentApplicability: "not_applicable_synthetic",
    containsRealPerson: false,
  }), true);
  assert.equal(isSyntheticConsentExempt("upload", {
    consentApplicability: "not_applicable_synthetic",
    containsRealPerson: false,
  }), false);
  assert.equal(isSyntheticConsentExempt("generated", {
    consentApplicability: "not_applicable_synthetic",
    containsRealPerson: true,
  }), false);
  assert.equal(isSyntheticConsentExempt("generated", {}), false);
  assert.equal(derivePublishability("swimming_business", null, "ready", undefined, true), "ready_for_review");
  assert.equal(derivePublishability("swimming_business", null, "ready", undefined, false), "blocked");
});

test("no-person classification is not consent and is distinct from synthetic-source exemption", () => {
  assert.equal(isConsentNotApplicable("upload", {
    consentApplicability: "not_applicable_no_real_person",
    containsRealPerson: false,
  }), true);
  assert.equal(isConsentNotApplicable("external", {
    consentApplicability: "not_applicable_no_real_person",
    containsRealPerson: false,
  }), true);
  assert.equal(isConsentNotApplicable("upload", {
    consentApplicability: "not_applicable_synthetic",
    containsRealPerson: false,
  }), false);
  assert.equal(isConsentNotApplicable("generated", {
    consentApplicability: "not_applicable_synthetic",
    containsRealPerson: false,
  }), true);
  assert.equal(isConsentNotApplicable("upload", {
    consentApplicability: "not_applicable_no_real_person",
    containsRealPerson: true,
  }), false);
});
