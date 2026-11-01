import test from "node:test";
import assert from "node:assert/strict";
import { parseMediaAssetRecords } from "../src/media-library-controls.tsx";

const legacyRows = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    assetType: "image",
    source: "ai_generated",
    storagePath: "media/generated-1.jpg",
    category: "swimming_business",
    mediaStatus: "unclassified",
    aiAnalysisStatus: "completed",
    publishabilityStatus: "consent_required",
    consentStatus: "consent_required",
    metadata: {},
    createdAt: "2026-10-01T00:00:00Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    assetType: "other",
    source: "upload",
    storagePath: "media/legacy-other.bin",
    category: null,
    mediaStatus: "approved",
    aiAnalysisStatus: "not_started",
    publishabilityStatus: "ready_for_review",
    consentStatus: "unknown",
    metadata: {},
    createdAt: "2026-10-02T00:00:00Z",
  },
];

test("legacy media vocabulary is normalized without dropping library records", () => {
  const parsed = parseMediaAssetRecords(legacyRows);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].source, "generated");
  assert.equal(parsed[0].mediaStatus, "pending");
  assert.equal(parsed[0].aiAnalysisStatus, "analyzed");
  assert.equal(parsed[0].publishabilityStatus, "blocked");
  assert.equal(parsed[0].consentStatus, "pending");
  assert.equal(parsed[0].metadata.legacy_source, "ai_generated");
  assert.equal(parsed[0].metadata.legacy_media_status, "unclassified");
  assert.equal(parsed[0].metadata.legacy_publishability_status, "consent_required");
});

test("legacy approved and unknown consent values never become publish approval", () => {
  const parsed = parseMediaAssetRecords(legacyRows);
  assert.equal(parsed[1].assetType, "other");
  assert.equal(parsed[1].mediaStatus, "pending");
  assert.equal(parsed[1].consentStatus, "pending");
  assert.equal(parsed[1].publishabilityStatus, "ready_for_review");
  assert.equal(parsed[1].metadata.legacy_media_status, "approved");
  assert.equal(parsed[1].metadata.legacy_consent_status, "unknown");
});
