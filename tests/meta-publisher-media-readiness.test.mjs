import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL("../supabase/migrations/20261101070000_enforce_media_review_before_publish.sql", import.meta.url),
  "utf8",
);
const publisher = await readFile(
  new URL("../supabase/functions/safe-content-publisher/index.ts", import.meta.url),
  "utf8",
);

test("scheduling requires an explicitly reviewed, ready media asset", () => {
  assert.match(migration, /assert_content_media_publish_ready/);
  assert.match(migration, /media_status IS DISTINCT FROM 'ready'/);
  assert.match(migration, /publishability_status IS DISTINCT FROM 'ready_for_review'/);
  assert.match(migration, /metadata->>'reviewStatus' IS DISTINCT FROM 'approved'/);
  assert.match(migration, /content_media_ready_before_schedule/);
});

test("publication receipt reservation cannot bypass the media readiness gate", () => {
  assert.match(migration, /publication_receipt_media_ready_before_reserve/);
  assert.match(migration, /NEW\.status IN \('reserved', 'container_created'\)/);
});

test("real-person consent and no-real-person attestations remain distinct", () => {
  assert.match(migration, /consent_confirmed/);
  assert.match(migration, /syntheticAttestedAt/);
  assert.match(migration, /syntheticAttestedBy/);
  assert.match(migration, /personPresenceReviewedAt/);
  assert.match(migration, /personPresenceReviewedBy/);
});

test("both manual and automation publisher paths validate the linked media before Meta calls", () => {
  assert.match(publisher, /function isMediaAssetApprovedForPublish/);
  assert.match(publisher, /metadata\.reviewStatus === "approved"/);
  assert.equal((publisher.match(/resolveSignedMediaUrl\(item\.media_asset_id, item\.id/g) ?? []).length, 2);
  assert.match(publisher, /MEDIA_NOT_READY_FOR_PUBLISH/);
});
