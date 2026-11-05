import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { clearCoachBrainFactoryHandoff, readCoachBrainFactoryHandoff, writeCoachBrainFactoryHandoff } from "../src/coach-brain-factory-handoff.ts";

const contentGrowthHub = await readFile(new URL("../src/content-growth-hub.tsx", import.meta.url), "utf8");

const payload = JSON.stringify({
  question: "خطة سباحة للأطفال",
  answer: "نص عربي مع مكافئ إنجليزي متاح",
  sources: [{ title: "Evidence", url: "https://example.test/evidence" }],
  planWindowDays: 7,
  planMix: "education",
  planExecution: "manual",
});

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
}

function failingStorage() {
  return {
    getItem() { throw new Error("STORAGE_READ_FAILED"); },
    setItem() { throw new Error("STORAGE_WRITE_FAILED"); },
    removeItem() { throw new Error("STORAGE_REMOVE_FAILED"); },
  };
}

test("restores the plan after reopening with sessionStorage unavailable", () => {
  const local = memoryStorage();
  assert.equal(writeCoachBrainFactoryHandoff(payload, { sessionStorage: memoryStorage(), localStorage: local }), true);
  const restored = readCoachBrainFactoryHandoff({ sessionStorage: null, localStorage: local });
  assert.equal(restored?.question, "خطة سباحة للأطفال");
  assert.equal(restored?.planWindowDays, 7);
  assert.equal(restored?.planMix, "education");
  assert.equal(restored?.planExecution, "manual");
});

test("continues through sessionStorage when localStorage access fails", () => {
  const session = memoryStorage();
  const access = {
    sessionStorage: session,
    get localStorage() { throw new Error("LOCAL_STORAGE_BLOCKED"); },
  };
  assert.equal(writeCoachBrainFactoryHandoff(payload, access), true);
  assert.equal(readCoachBrainFactoryHandoff(access)?.planMix, "education");
});

test("continues through localStorage when sessionStorage fails", () => {
  const local = memoryStorage();
  const access = { sessionStorage: failingStorage(), localStorage: local };
  assert.equal(writeCoachBrainFactoryHandoff(payload, access), true);
  assert.equal(readCoachBrainFactoryHandoff(access)?.planExecution, "manual");
});

test("cleanup failure is safe and does not change a successful batch result", () => {
  const saved = { success: true, batchId: "batch-1" };
  const failedCleanup = () => clearCoachBrainFactoryHandoff({ sessionStorage: failingStorage(), localStorage: failingStorage() });
  assert.doesNotThrow(failedCleanup);
  assert.equal(failedCleanup(), false);
  assert.deepEqual(saved, { success: true, batchId: "batch-1" });

  const saveGuard = contentGrowthHub.indexOf('if (!saved?.success || !saved.batchId) throw new Error(saved?.code ?? "GENERATE_FAILED");');
  const cleanupCall = contentGrowthHub.indexOf("clearCoachBrainFactoryHandoff();", saveGuard);
  const outerCatch = contentGrowthHub.lastIndexOf("    } catch (cause) {");
  assert.ok(saveGuard >= 0, "the production save guard must exist");
  assert.ok(cleanupCall > saveGuard, "cleanup must follow a successful save guard");
  assert.ok(cleanupCall < outerCatch, "cleanup must happen before the generation failure catch");
});

test("handoff remains available when batch creation fails", () => {
  const local = memoryStorage();
  const access = { sessionStorage: null, localStorage: local };
  assert.equal(writeCoachBrainFactoryHandoff(payload, access), true);
  const saveGuard = contentGrowthHub.indexOf('if (!saved?.success || !saved.batchId) throw new Error(saved?.code ?? "GENERATE_FAILED");');
  const cleanupCall = contentGrowthHub.indexOf("clearCoachBrainFactoryHandoff();", saveGuard);
  const outerCatch = contentGrowthHub.lastIndexOf("    } catch (cause) {");
  const failurePath = contentGrowthHub.slice(outerCatch);
  assert.ok(cleanupCall > saveGuard, "cleanup must remain after the save guard");
  assert.doesNotMatch(failurePath, /clearCoachBrainFactoryHandoff\(\)/, "the generation failure catch must not clear the handoff");
  assert.equal(readCoachBrainFactoryHandoff(access)?.question, "خطة سباحة للأطفال");
});
