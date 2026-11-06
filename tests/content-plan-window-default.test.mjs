import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const coachBrain = await readFile(new URL("../src/coach-brain.tsx", import.meta.url), "utf8");
const factory = await readFile(new URL("../src/content-growth-hub.tsx", import.meta.url), "utf8");

test("Coach Brain and direct Factory entry default to a one-week planning window", () => {
  assert.match(coachBrain, /const \[planDays, setPlanDays\] = useState\("7"\)/);
  assert.match(factory, /\? value : 7/);
  assert.match(factory, /PLAN_WINDOW_OPTIONS = \[2, 3, 4, 7, 14, 30\]/);
});
