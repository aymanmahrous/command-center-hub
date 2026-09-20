import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/control-tower-v2.tsx", import.meta.url), "utf8");

test("Operating System renders workflow intelligence from the live summary", () => {
  assert.match(source, /deriveWorkflowActions/);
  assert.match(source, /workflowActions/);
  assert.match(source, /Data-derived operating actions/);
  assert.match(source, /summary\.automation\.failed/);
});

test("Operating System actions are review-only and route through existing sections", () => {
  assert.match(source, /Review only; any external action requires owner approval/);
  assert.match(source, /action\.area === "bookings" \? "planner"/);
  assert.match(source, /onClick=\{\(\) => go\(target\)\}/);
  assert.doesNotMatch(source, /fetch\([^)]*publish|service_role|executeExternal/i);
});
