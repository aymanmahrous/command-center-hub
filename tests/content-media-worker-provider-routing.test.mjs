import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const worker = await readFile(new URL("../supabase/functions/content-automation-pulse/index.ts", import.meta.url), "utf8");
const publisher = await readFile(new URL("../supabase/functions/scheduled-authorized-publisher/index.ts", import.meta.url), "utf8");
const mediaPolicy = await readFile(new URL("../supabase/functions/safe-content-publisher/text.ts", import.meta.url), "utf8");
const ownerMediaApprovalMigration = await readFile(new URL("../supabase/migrations/20261102020000_align_owner_media_approval_contract.sql", import.meta.url), "utf8");

test("Canva media worker blocks Reel jobs before calling the image generator", () => {
  const mediaJob = worker.slice(worker.indexOf("async function processOneMediaJob"), worker.indexOf("async function saveBatchWithShift"));
  const reelGuard = mediaJob.indexOf('String(item.content_type ?? "").toLowerCase() === "reel"');
  const canvaCall = mediaJob.indexOf("/functions/v1/canva-design");
  assert.notEqual(reelGuard, -1); assert.notEqual(canvaCall, -1);
  assert.ok(reelGuard < canvaCall, "Reel guard must run before Canva is called");
  assert.match(mediaJob, /fail_content_media_job/);
  assert.match(mediaJob, /VIDEO_PROVIDER_REQUIRES_EXPLICIT_APPROVAL/);
});

test("content automation defaults to dry-run unless both master and publishing switches are enabled", () => {
  const handler = worker.slice(worker.indexOf("Deno.serve"));
  assert.match(handler, /CONTENT_AUTOMATION_LIVE_ENABLED/);
  assert.match(handler, /CONTENT_PUBLISHING_LIVE_ENABLED/);
  assert.match(handler, /const dryRunRequested = Deno\.env\.get\("CONTENT_AUTOMATION_LIVE_ENABLED"\) !== "true"\s*\|\|\s*Deno\.env\.get\("CONTENT_PUBLISHING_LIVE_ENABLED"\) !== "true"/);
  const dryRunBranch = handler.indexOf("if (dryRunRequested)");
  const livePublishing = handler.indexOf("processOneAuthorizedPublishJob(supabase)");
  assert.notEqual(dryRunBranch, -1); assert.notEqual(livePublishing, -1);
  assert.ok(dryRunBranch < livePublishing, "dry-run must return before the authorized publisher is called");
  assert.doesNotMatch(handler, /evaluate_content_batch_generation_need/);
  assert.doesNotMatch(handler, /processOneMediaJob\(supabase\)/);
});

test("scheduled worker excludes pre-cutover and non-owner-scheduled jobs", () => {
  assert.match(worker, /PUBLISH_QUEUE_CUTOVER_AT = "2026-11-02T00:00:00\.000Z"/);
  assert.match(worker, /\.gte\("created_at", PUBLISH_QUEUE_CUTOVER_AT\)/);
  assert.match(worker, /\.lte\("next_retry_at", now\.toISOString\(\)\)/);
  assert.match(worker, /batch_approve_scheduled/);
  assert.match(worker, /approve_and_schedule/);
  assert.match(worker, /content_item_transitioned/);
  assert.match(worker, /requestedAction === "approve"/);
  assert.match(worker, /requestedAction === "approve_and_schedule" && row\.detail\?\.nextStatus === "scheduled"/);
  assert.match(worker, /role !== "super_admin"/);
  assert.match(worker, /\.length !== 1/);
});

test("scheduled worker uses exact owner authorization and never the legacy queue claimant", () => {
  assert.match(worker, /create_owner_publish_authorization/);
  assert.match(worker, /create_owner_instagram_publish_authorization/);
  assert.match(worker, /claim_authorized_publish_job/);
  assert.match(worker, /claim_authorized_instagram_publish_job/);
  assert.match(worker, /created\.publishJobId !== job\.id/);
  assert.match(worker, /\.is\("consumed_at", null\)\.is\("revoked_at", null\)/);
  assert.match(worker, /\.eq\("content_item_id", contentItemId\)\.eq\("platform", platform\)/);
  assert.match(worker, /scheduled-authorized-publisher/);
  assert.doesNotMatch(worker, /claim_next_publish_job/);
  assert.doesNotMatch(worker, /safe-content-publisher/);
});

test("scheduled publisher validates approved media before any Meta request", () => {
  assert.match(publisher, /mediaApprovalError/);
  assert.match(publisher, /media_asset_id/);
  assert.match(publisher, /const errorCode = mediaApprovalError\(asset, contentItemId\)/);
  assert.match(publisher, /if \(errorCode\) return \{ url: null, hasMedia: false/);
  assert.match(publisher, /publishInstagram\(caption, media.url, media.assetType\)/);
  const mediaGate = publisher.indexOf("if (media.errorCode || !media.url)");
  const metaCall = publisher.indexOf("await publishFacebook(caption, media.url, media.assetType)");
  assert.notEqual(mediaGate, -1); assert.notEqual(metaCall, -1);
  assert.ok(mediaGate < metaCall, "media approval must pass before Meta publish");
  assert.match(publisher, /media_type: "REELS"/);
  assert.match(publisher, /media_publish/);
  assert.match(publisher, /confirmedExternalPostId\(created as Record<string, unknown>\)/);
  assert.match(publisher, /confirmedExternalPostId\(published as Record<string, unknown>\)/);
  assert.match(mediaPolicy, /media_status !== "approved"/);
  assert.match(mediaPolicy, /consent_status === "consent_confirmed"/);
  assert.match(mediaPolicy, /metadata.reviewStatus !== "approved"/);
});

test("owner media approval records the review state required by the publisher", () => {
  assert.match(ownerMediaApprovalMigration, /p_media_status is not null/);
  assert.match(ownerMediaApprovalMigration, /'reviewStatus'/);
  assert.match(ownerMediaApprovalMigration, /when v_status = 'approved' then 'approved'/);
  assert.match(ownerMediaApprovalMigration, /media_status = v_status/);
  assert.match(ownerMediaApprovalMigration, /MEDIA_ALREADY_LINKED/);
  assert.match(ownerMediaApprovalMigration, /public\.command_center_staff_role\(\) <> 'super_admin'/);
});
