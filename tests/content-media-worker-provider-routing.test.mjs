import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const worker = await readFile(
  new URL("../supabase/functions/content-automation-pulse/index.ts", import.meta.url),
  "utf8",
);

test("Canva media worker blocks Reel jobs before calling the image generator", () => {
  const mediaJob = worker.slice(worker.indexOf("async function processOneMediaJob"), worker.indexOf("async function saveBatchWithShift"));
  const reelGuard = mediaJob.indexOf('String(item.content_type ?? "").toLowerCase() === "reel"');
  const canvaCall = mediaJob.indexOf("/functions/v1/canva-design");
  assert.notEqual(reelGuard, -1);
  assert.notEqual(canvaCall, -1);
  assert.ok(reelGuard < canvaCall, "Reel guard must run before Canva is called");
  assert.match(mediaJob, /fail_content_media_job/);
  assert.match(mediaJob, /VIDEO_PROVIDER_REQUIRES_EXPLICIT_APPROVAL/);
});

test("content automation pulse dry-run exits before generation, media claims, or publishing", () => {
  const handler = worker.slice(worker.indexOf("Deno.serve"));
  const dryRunLock = handler.indexOf("const dryRunRequested = true");
  const dryRunBranch = handler.indexOf("if (dryRunRequested)");
  const generation = handler.indexOf('rpc("evaluate_content_batch_generation_need")');
  const mediaClaim = handler.indexOf("processOneMediaJob(supabase)");
  const publishClaim = handler.indexOf("processOnePublishJob(supabase)");
  assert.notEqual(dryRunLock, -1, "live execution must remain globally locked off until separately approved");
  assert.notEqual(dryRunBranch, -1, "dry-run must have a dedicated early-return branch");
  assert.ok(dryRunBranch < generation, "dry-run must return before content generation evaluation");
  assert.ok(dryRunBranch < mediaClaim, "dry-run must return before media queue processing");
  assert.ok(dryRunBranch < publishClaim, "dry-run must return before publishing queue processing");
  const dryRunSection = handler.slice(dryRunBranch, generation);
  assert.match(dryRunSection, /p_media_attempts: 0/);
  assert.match(dryRunSection, /p_media_processed: 0/);
  assert.match(dryRunSection, /p_publish_attempts: 0/);
  assert.match(dryRunSection, /p_publish_processed: 0/);
  assert.match(dryRunSection, /sideEffectsSkipped: true/);
});


test("content automation worker uses a supported Gemini Flash model", () => {
  assert.match(worker, /const GEMINI_MODEL = "gemini-3\.8-flash"/);
  assert.doesNotMatch(worker, /gemini-2\.0-flash/);
});
