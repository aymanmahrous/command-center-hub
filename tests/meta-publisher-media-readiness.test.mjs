import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20261101092147_enforce_media_review_before_publish.sql", import.meta.url), "utf8");
const receiptMigration = await readFile(new URL("../supabase/migrations/20261101092350_guard_pending_publication_receipts.sql", import.meta.url), "utf8");
const mediaText = await readFile(new URL("../supabase/functions/safe-content-publisher/text.ts", import.meta.url), "utf8");
const manualPublisher = await readFile(new URL("../supabase/functions/safe-content-publisher/index.ts", import.meta.url), "utf8");
const scheduledPublisher = await readFile(new URL("../supabase/functions/scheduled-authorized-publisher/index.ts", import.meta.url), "utf8");

test("scheduling requires an explicitly reviewed, ready media asset", () => {
  assert.match(migration, /assert_content_media_publish_ready/);
  assert.match(migration, /metadata->>'reviewStatus' IS DISTINCT FROM 'approved'/);
  assert.match(migration, /publishability_status IS DISTINCT FROM 'ready_for_review'/);
  assert.match(migration, /consent_confirmed/);
});

test("publication receipt reservation cannot bypass the media readiness gate", () => {
  assert.match(receiptMigration, /publication_receipt_media_ready_before_reserve/);
  assert.match(receiptMigration, /NEW\.status IN \('pending', 'reserved', 'container_created'\)/);
  assert.match(receiptMigration, /assert_content_media_publish_ready/);
});

test("shared media approval helper checks linkage, category, review, and consent", () => {
  for (const contract of ["MEDIA_NOT_LINKED", "MEDIA_NOT_READY", "MEDIA_CATEGORY_BLOCKED", "MEDIA_NOT_APPROVED", "MEDIA_CONSENT_REQUIRED"]) {
    assert.ok(mediaText.includes(contract), `missing media approval guard: ${contract}`);
  }
  assert.match(mediaText, /mediaApprovalError/);
  assert.match(mediaText, /metadata\.reviewStatus !== "approved"/);
});

test("manual Meta publishing validates reviewed media before provider calls", () => {
  assert.match(manualPublisher, /mediaApprovalError\(asset, contentItemId\)/);
  const approvalCheck = manualPublisher.indexOf("if (media.approvalError) return fail(media.approvalError, 422)");
  const facebookCall = manualPublisher.indexOf("await publishToFacebook(");
  const instagramCall = manualPublisher.indexOf("await publishToInstagram(");
  assert.ok(approvalCheck > 0 && facebookCall > approvalCheck && instagramCall > approvalCheck);
});

test("scheduled publisher validates media before reserving a publication receipt", () => {
  assert.match(scheduledPublisher, /mediaApprovalError\(asset, contentItemId\)/);
  const mediaCheck = scheduledPublisher.indexOf("signPrimaryImage(contentItemId, item.media_asset_id)");
  const reserve = scheduledPublisher.indexOf("reserved = await reserveReceipt(ctx)");
  assert.ok(mediaCheck > 0 && reserve > mediaCheck, "media must pass before receipt reservation");
});
