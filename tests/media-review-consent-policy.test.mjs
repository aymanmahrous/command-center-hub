import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20261101051009_restore_media_internal_review_and_generated_consent_policy.sql", import.meta.url),
  "utf8",
);
const controls = await readFile(new URL("../src/media-library-controls.tsx", import.meta.url), "utf8");
const personPresenceMigration = await readFile(
  new URL("../supabase/migrations/20261101053129_add_media_person_presence_attestation.sql", import.meta.url),
  "utf8",
);

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

test("person-presence UI is explicit and does not claim to record consent", () => {
  assert.match(controls, /asset\.assetType === "image" \|\| asset\.assetType === "video"/);
  assert.match(controls, /attest_media_person_presence/);
  assert.match(controls, /This is not a person's consent|هذا ليس موافقة شخص/);
});

test("media link gate remains review-only and never publishes content", () => {
  assert.match(migration, /publishability_status, 'blocked'\) <> 'ready_for_review'/);
  assert.match(migration, /status = 'needs_review'/);
  const linkFunction = migration.split("CREATE OR REPLACE FUNCTION public.link_staff_media_to_content_item")[1] ?? "";
  assert.match(linkFunction, /status = 'needs_review'/);
  assert.doesNotMatch(linkFunction, /SET status = 'published'/i);
});

test("person-presence review is distinct from consent and applies to uploaded media too", () => {
  assert.match(personPresenceMigration, /CREATE OR REPLACE FUNCTION public\.attest_media_person_presence/);
  assert.match(personPresenceMigration, /'not_applicable_no_real_person'/);
  assert.match(personPresenceMigration, /'consent_required'/);
  assert.match(personPresenceMigration, /IS NOT TRUE/);
  assert.match(personPresenceMigration, /WHEN v_asset\.media_status = 'ready'/);
  assert.match(personPresenceMigration, /v_publishability := 'ready_for_review'/);
  assert.match(personPresenceMigration, /'containsRealPerson', p_contains_real_person/);
  assert.match(personPresenceMigration, /'media_person_presence_reviewed'/);
  assert.match(personPresenceMigration, /REVOKE ALL ON FUNCTION public\.attest_media_person_presence\(uuid, boolean\) FROM PUBLIC, anon/);
  assert.match(personPresenceMigration, /GRANT EXECUTE ON FUNCTION public\.attest_media_person_presence\(uuid, boolean\) TO authenticated/);
  assert.match(controls, /attest_media_person_presence/);
  assert.match(controls, /No identifiable person/);
  assert.match(controls, /Person present/);
});

const analysisPolicyMigration = await readFile(
  new URL("../supabase/migrations/20261101063800_preserve_no_person_media_readiness_after_ai_analysis.sql", import.meta.url),
  "utf8",
);

test("AI analysis preserves the audited no-real-person consent exemption", () => {
  assert.match(analysisPolicyMigration, /CREATE OR REPLACE FUNCTION public\.save_staff_media_ai_analysis/);
  assert.match(analysisPolicyMigration, /consentApplicability' = 'not_applicable_no_real_person'/);
  assert.match(analysisPolicyMigration, /personPresenceReviewedAt/);
  assert.match(analysisPolicyMigration, /personPresenceReviewedBy/);
  assert.match(analysisPolicyMigration, /consentApplicability' = 'not_applicable_synthetic'/);
  assert.match(analysisPolicyMigration, /syntheticAttestedAt/);
  assert.match(analysisPolicyMigration, /syntheticAttestedBy/);
  assert.match(analysisPolicyMigration, /consent_confirmed/);
  assert.match(analysisPolicyMigration, /suitabilityVerdict/);
  assert.match(analysisPolicyMigration, /v_publishability := 'ready_for_review'/);
  assert.match(analysisPolicyMigration, /v_publishability := 'blocked'/);
});
