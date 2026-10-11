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
