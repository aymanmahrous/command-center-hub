import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeLegacyMediaAssetRows } from "../src/media-legacy-compat.ts";

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
  const parsed = normalizeLegacyMediaAssetRows(legacyRows);
  assert.ok(Array.isArray(parsed));
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

test("legacy approved and unknown consent values never become workflow approval", () => {
  const parsed = normalizeLegacyMediaAssetRows(legacyRows);
  assert.equal(parsed[1].assetType, "other");
  assert.equal(parsed[1].mediaStatus, "pending");
  assert.equal(parsed[1].consentStatus, "pending");
  assert.equal(parsed[1].publishabilityStatus, "ready_for_review");
  assert.equal(parsed[1].metadata.legacy_media_status, "approved");
  assert.equal(parsed[1].metadata.legacy_consent_status, "unknown");
});

test("both Media Library parsing paths normalize legacy rows before strict validation", async () => {
  const [controls, view] = await Promise.all([
    readFile(new URL("../src/media-library-controls.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/media-library-view.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(controls, /normalizeLegacyMediaAssetRows\(value\)/);
  assert.match(view, /normalizeLegacyMediaAssetRows\(value\)/);
  assert.match(view, /safeParse\(normalizedValue\)/);
});

test("legacy media updates normalize old persisted states before validation", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20261030093654_align_media_lifecycle_schema_contract.sql", import.meta.url), "utf8");
  assert.equal((migration.match(/WHEN 'unknown' THEN 'pending'/g) ?? []).length, 2);
  assert.equal((migration.match(/WHEN 'consent_required' THEN 'pending'/g) ?? []).length, 2);
  assert.equal((migration.match(/WHEN 'no_consent' THEN 'denied'/g) ?? []).length, 2);
  assert.equal((migration.match(/WHEN 'unclassified' THEN 'pending'/g) ?? []).length, 2);
  assert.equal((migration.match(/WHEN 'approved' THEN 'pending'/g) ?? []).length, 2);
  assert.equal((migration.match(/WHEN 'rejected' THEN 'failed'/g) ?? []).length, 2);
  assert.equal((migration.match(/WHEN 'unsuitable' THEN 'failed'/g) ?? []).length, 2);
});

test("legacy and current media source values remain accepted by the compatibility constraint", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20261101104925_align_legacy_media_source_check.sql", import.meta.url), "utf8");
  for (const source of ["upload", "ai_generated", "generated", "external", "stock"]) {
    assert.match(migration, new RegExp(`'${source}'\\s*::text`));
  }
  assert.match(migration, /DROP CONSTRAINT IF EXISTS media_assets_source_check/);
  assert.match(migration, /ADD CONSTRAINT media_assets_source_check/);
  assert.doesNotMatch(migration, /UPDATE public\.media_assets|DELETE FROM public\.media_assets/i);
});


test("final person-presence migration preserves legacy production status vocabulary", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20261101053129_add_media_person_presence_attestation.sql", import.meta.url), "utf8");
  for (const [legacy, normalized] of [["unknown", "pending"], ["consent_required", "pending"], ["no_consent", "denied"], ["unclassified", "pending"], ["approved", "pending"], ["rejected", "failed"], ["unsuitable", "failed"]]) {
    const fragment = `WHEN '${legacy}' THEN '${normalized}'`;
    assert.equal(migration.split(fragment).length - 1, 2, `both staff and owner RPCs must normalize ${legacy}`);
  }
});

test("both media library parsing paths accept the existing logo asset type", async () => {
  const [controls, view] = await Promise.all([
    readFile(new URL("../src/media-library-controls.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/media-library-view.tsx", import.meta.url), "utf8"),
  ]);
  const enumValues = '["image", "video", "document", "audio", "other", "logo"]';
  assert.ok(controls.includes(`assetType: z.enum(${enumValues})`));
  assert.ok(view.includes(`assetType: z.enum(${enumValues})`));
});
