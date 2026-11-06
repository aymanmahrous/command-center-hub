import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const hub = await readFile(new URL("../src/content-growth-hub.tsx", import.meta.url), "utf8");
const batch = await readFile(new URL("../src/content-batch.ts", import.meta.url), "utf8");

test("factory generation stays manual and requires owner confirmation", () => {
  assert.doesNotMatch(hub, /autoFactoryRun/);
  assert.doesNotMatch(hub, /futurePlanned/);
  assert.doesNotMatch(hub, /generateCoachAymanBatch\(\{ automatic: true \}\)/);
  assert.match(hub, /window\.confirm\(copy\.generateConfirm\)/);
  assert.match(hub, /No batch is generated automatically/);
  assert.match(hub, /content-growth-hub/);
});

test("factory generation remains review-first and duplicate-safe", () => {
  assert.match(batch, /REVIEWABLE_FOR_APPROVAL/);
  assert.match(hub, /create_staff_generated_content_batch/);
  assert.match(hub, /CONTENT_SLOT_ALREADY_PLANNED/);
  assert.doesNotMatch(hub, /requestPublishJob\(session/);
});


test("factory reports AI generation only when validated AI content was saved", async () => {
  const englishCopy = await readFile(new URL("../src/i18n/en.ts", import.meta.url), "utf8");
  const arabicCopy = await readFile(new URL("../src/i18n/ar.ts", import.meta.url), "utf8");

  assert.match(hub, /const validatedAiItems = await mergeValidatedGeminiCreativeFields/);
  assert.match(hub, /usedAiGeneration = validatedAiItems !== null/);
  assert.match(hub, /usedAiGeneration \? copy\.generateSuccess : copy\.generateFallback/);
  assert.match(englishCopy, /The batch was saved using the academy's standard content/);
  assert.match(arabicCopy, /تم حفظ الدفعة باستخدام المحتوى الأساسي للأكاديمية/);
});
