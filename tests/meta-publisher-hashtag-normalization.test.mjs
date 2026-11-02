import assert from "node:assert/strict";
import test from "node:test";
import { confirmedExternalPostId, formatHashtags, mediaApprovalError, normalizeHashtag } from "../supabase/functions/safe-content-publisher/text.ts";

test("normalizes one hashtag to exactly one leading hash", () => {
  assert.equal(normalizeHashtag("##RelaxFixUAE"), "#RelaxFixUAE");
  assert.equal(normalizeHashtag(" RelaxFixUAE "), "#RelaxFixUAE");
});

test("formats stored hashtags without producing double hashes", () => {
  assert.equal(formatHashtags(["#RelaxFixUAE", "##KidsSwimming", "WaterConfidence"]), "#RelaxFixUAE #KidsSwimming #WaterConfidence");
});

test("ignores empty hashtag values", () => {
  assert.equal(formatHashtags(["", "###", null, "#Ready"]), "#Ready");
  assert.equal(formatHashtags(undefined), "");
});

test("publishing requires linked owner-approved media, readiness, and valid consent", () => {
  const approved = {
    content_item_id: "content-1",
    storage_path: "content-1/asset.png",
    asset_type: "image",
    source: "generated",
    category: "swimming_business",
    media_status: "approved",
    consent_status: "pending",
    publishability_status: "ready_for_review",
    metadata: {
      reviewStatus: "approved",
      containsRealPerson: false,
      consentApplicability: "not_applicable_synthetic",
      syntheticAttestedAt: "2026-11-01T00:00:00Z",
      syntheticAttestedBy: "staff-1",
    },
  };
  assert.equal(mediaApprovalError(approved, "content-1"), null);
  assert.equal(mediaApprovalError({ ...approved, content_item_id: "other-item" }, "content-1"), "MEDIA_NOT_LINKED");
  assert.equal(mediaApprovalError({ ...approved, media_status: "unclassified" }, "content-1"), "MEDIA_NOT_READY");
  assert.equal(mediaApprovalError({ ...approved, media_status: "ready" }, "content-1"), "MEDIA_NOT_READY");
  assert.equal(mediaApprovalError({ ...approved, metadata: { ...approved.metadata, reviewStatus: "pending" } }, "content-1"), "MEDIA_NOT_APPROVED");
  assert.equal(mediaApprovalError({ ...approved, category: "family_personal" }, "content-1"), "MEDIA_CATEGORY_BLOCKED");
  assert.equal(mediaApprovalError({ ...approved, metadata: { ...approved.metadata, syntheticAttestedBy: "" } }, "content-1"), "MEDIA_CONSENT_REQUIRED");
  assert.equal(mediaApprovalError(null, "content-1"), "MEDIA_MISSING");
});

test("publication confirmation requires a real provider post identifier", () => {
  assert.equal(confirmedExternalPostId({ post_id: "page_post_123", id: "photo_123" }), "page_post_123");
  assert.equal(confirmedExternalPostId({ id: 987 }), "987");
  assert.equal(confirmedExternalPostId({}), null);
  assert.equal(confirmedExternalPostId(null), null);
  assert.equal(confirmedExternalPostId({ id: "undefined" }), null);
});
