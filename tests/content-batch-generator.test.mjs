import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildCoachAyman2026BatchItems,
  COACH_AYMAN_BATCH_SIZE,
  COACH_AYMAN_PROVIDER_ID,
  CONFIRMED_CTA,
  summarizeCoachAymanBatch,
  validateCoachAymanBatch,
} from "../src/content-batch-generator.ts";

const migration = await readFile(
  new URL("../supabase/migrations/20260911113000_content_batch_generation_batch_id.sql", import.meta.url),
  "utf8",
);

test("batch generation migration assigns one shared batch_id", () => {
  assert.match(migration, /v_batch_id uuid := gen_random_uuid\(\)/);
  assert.match(migration, /batch_id,/);
  assert.match(migration, /'batchId', v_batch_id/);
  assert.doesNotMatch(migration, /\bDROP\b/i);
});

test("coach ayman 2026 batch has 10 platform-specific items", async () => {
  const items = await buildCoachAyman2026BatchItems(new Date("2026-09-11T00:00:00.000Z"), "test-nonce");
  assert.equal(items.length, COACH_AYMAN_BATCH_SIZE);
  const summary = summarizeCoachAymanBatch(items);
  assert.equal(summary.total, 10);
  assert.equal(summary.conversion, 2);
  assert.equal(summary.educational, 8);
  assert.deepEqual(summary.platforms.sort(), ["facebook", "instagram", "tiktok"]);
});

test("coach ayman batch passes safety validation", async () => {
  const items = await buildCoachAyman2026BatchItems(new Date("2026-09-11T00:00:00.000Z"), "validation-nonce");
  const result = validateCoachAymanBatch(items);
  assert.equal(result.valid, true, result.errors.join("; "));
  assert.match(items[0]?.caption ?? "", /058 821 9130/);
  assert.match(items[0]?.caption ?? "", /055 137 8660/);
  assert.match(items[0]?.caption ?? "", /Free initial assessment/);
  assert.doesNotMatch(items.map((item) => item.caption).join("\n"), /guarantee|testimonial|award-winning/i);
});

test("coach ayman batch uses unique fingerprints and planned times", async () => {
  const items = await buildCoachAyman2026BatchItems(new Date("2026-09-11T00:00:00.000Z"), "unique-nonce");
  const fingerprints = new Set(items.map((item) => item.contentFingerprint));
  const planned = new Set(items.map((item) => item.plannedFor));
  assert.equal(fingerprints.size, items.length);
  assert.equal(planned.size, items.length);
  for (const item of items) {
    assert.match(item.contentFingerprint, /^[0-9a-f]{64}$/);
    assert.match(item.visualPrompt, /CANVA:/);
    assert.match(item.visualPrompt, /CAPCUT:/);
  }
});

test("provider id is stable for automation handoff", () => {
  assert.equal(COACH_AYMAN_PROVIDER_ID, "command-center-coach-ayman-2026");
  assert.match(CONFIRMED_CTA, /058 821 9130/);
});
