import { test } from "node:test";
import { readFileSync } from "node:fs";

const view = readFileSync(new URL("../src/coach-brain.tsx", import.meta.url), "utf8");
const style = readFileSync(new URL("../src/coach-brain.css", import.meta.url), "utf8");

test("Coach Brain exposes the four safety bands", () => {
  for (const band of ["TRAIN", "ADAPT", "REFER", "STOP"]) assert.match(view, new RegExp(`\\\"${band}\\\"|\\b${band}\\b`));
});

test("Coach Brain does not present itself as a diagnostic or medical prescribing tool", () => {
  assert.match(view, /does not diagnose conditions|ليست أداة تشخيص/);
  assert.match(view, /Do not infer a diagnosis|لا نستنتج تشخيصًا/);
  assert.match(view, /clinical rehabilitation program|برنامج تأهيلي سريري/);
});

test("Coach Brain includes forced-submersion safety boundary", () => {
  assert.match(view, /No forced submersion|لا يوجد إجبار على الغمر/);
});

test("Coach Brain is responsive for mobile staff use", () => {
  assert.match(style, /@media\(max-width:800px\)/);
});
