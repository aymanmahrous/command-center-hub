import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const hub = await readFile(new URL("../src/content-growth-hub.tsx", import.meta.url), "utf8");
const batch = await readFile(new URL("../src/content-batch.ts", import.meta.url), "utf8");

test("factory auto-run is low-cost and guarded by a future-plan horizon", () => {
  assert.match(hub, /autoFactoryRun/);
  assert.match(hub, /futurePlanned/);
  assert.match(hub, /futurePlanned >= 10/);
  assert.match(hub, /generateCoachAymanBatch\(\{ automatic: true \}\)/);
  assert.match(hub, /content-growth-hub/);
});

test("factory generation remains review-first and duplicate-safe", () => {
  assert.match(batch, /REVIEWABLE_FOR_APPROVAL/);
  assert.match(hub, /create_staff_generated_content_batch/);
  assert.match(hub, /CONTENT_SLOT_ALREADY_PLANNED/);
  assert.doesNotMatch(hub, /requestPublishJob\(session/);
});
