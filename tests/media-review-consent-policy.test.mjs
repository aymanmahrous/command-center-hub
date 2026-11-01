import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20261101090000_restore_media_internal_review_and_generated_consent_policy.sql", import.meta.url),
  "utf8",
);
const controls = await readFile(new URL("../src/media-library-controls.tsx", import.meta.url), "utf8");

test("uploaded and external real-person media still require explicit consent", () => {
  assert.match(migration, /v_asset\.source <> 'generated'/);
  assert.match(migration, /v_asset\.consent_status IS DISTINCT FROM 'consent_confirmed'/i);
  assert.match(migration, /consentApplicability' <> 'not_applicable_synthetic'/);
  assert.match(migration, /containsRealPerson'\)::boolean, true\)/);
});

test("generated media consent exemption requires a separate auditable synthetic attestation", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.attest_generated_media_synthetic/);
  assert.match(migration, /v_asset\.source <> 'generated' OR v_asset\.asset_type NOT IN \('image','video'\)/);
  assert.match(migration, /'consentApplicability', 'not_applicable_synthetic'/);
  assert.match(migration, /'containsRealPerson', false/);
  assert.match(migration, /'generated_media_synthetic_attested'/);
});

test("internal review outcomes are stored separately from CHECK-constrained media_status", () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.review_staff_media_asset/);
  assert.match(migration, /'pending_review','approved','rejected','unsuitable'/);
  assert.match(migration, /'reviewStatus', v_status/);
  assert.match(migration, /WHEN v_status IN \('rejected','unsuitable'\) THEN 'blocked'/);
  assert.match(migration, /'mediaStatus', v_asset\.media_status/);
  assert.match(controls, /review\("approved"\)/);
  assert.match(controls, /review\("rejected"\)/);
  assert.match(controls, /review\("pending_review"\)/);
  assert.match(controls, /asset\.mediaStatus === "ready"/);
});

test("synthetic attestation UI is only offered for generated media and is explicit", () => {
  assert.match(controls, /asset\.source === "generated"/);
  assert.match(controls, /attest_generated_media_synthetic/);
  assert.match(controls, /no real-person photo or likeness|بلا شخص حقيقي/);
});

test("media link gate remains review-only and never publishes content", () => {
  assert.match(migration, /publishability_status, 'blocked'\) <> 'ready_for_review'/);
  assert.match(migration, /status = 'needs_review'/);
  assert.doesNotMatch(migration, /status = 'published'/);
});
