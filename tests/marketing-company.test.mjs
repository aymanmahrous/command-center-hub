import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const view = await readFile(new URL("../src/marketing-company-view.tsx", import.meta.url), "utf8");
const main = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");

test("Home is the owner-facing entry and marketing remains an approval workflow", () => {
  assert.match(view, /proposalCopy/);
  assert.match(view, /slice\(0, 10\)/);
  assert.match(view, /Mوافق|موافق على الخطة/);
  assert.match(view, /غير موافق/);
  assert.match(view, /حذف المقترح/);
  assert.match(main, /active === "dashboard" \? .*ControlTowerV2/s);
  assert.match(main, /active === "command" \? .*ControlTowerV2/s);
});

test("Marketing Company stays review-first and blocks duplicate planned slots", () => {
  assert.match(view, /create_staff_generated_content_batch/);
  assert.match(view, /CONTENT_SLOT_ALREADY_PLANNED/);
  assert.match(view, /لم يتم النشر تلقائيًا/);
  assert.doesNotMatch(view, /enqueue_publish_job/);
  assert.doesNotMatch(view, /scheduledFor.*=.*new Date/);
});

test("Approval Center is a review-only owner surface over existing sections", async () => {
  const tower = await readFile(new URL("../src/control-tower-v2.tsx", import.meta.url), "utf8");
  assert.match(tower, /approvalOnly\?: boolean/);
  assert.match(tower, /What needs your approval\?/);
  assert.match(tower, /No external action runs from this screen/);
  assert.match(main, /approvalOnly \/\>/);
});
