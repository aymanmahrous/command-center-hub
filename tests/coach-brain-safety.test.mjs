import { test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const view = readFileSync(new URL("../src/coach-brain.tsx", import.meta.url), "utf8");
const style = readFileSync(new URL("../src/coach-brain.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");

test("Coach Brain exposes non-diagnostic safety boundaries", () => {
  assert.match(view, /does not diagnose|لا يشخّص/);
  assert.match(view, /medical treatment|علاجًا طبيًا/);
  assert.match(view, /clinical rehabilitation|التأهيل السريري/);
  assert.match(app, /const CoachBrain = lazy\(\(\) => import\("\.\/coach-brain"\)\)/);
  assert.match(app, /\["brain", Bot, "x"\]/);
  assert.match(app, /<CoachBrain language=\{language\} \/>/);
});

test("Coach Brain includes a no-forced-submersion boundary", () => {
  assert.match(view, /forced submersion|الغمر القسري/);
});

test("Coach Brain protects the no-record workflow", () => {
  assert.match(view, /No swimmer or child profile is created or stored|لا يتم إنشاء ملف للسباح أو حفظ بيانات الأطفال/);
});

test("Coach Brain starts with ready operational actions", () => {
  assert.match(view, /actionsTitle/);
  assert.match(view, /Prepare a 10-day content plan|جهز لي خطة محتوى 10 أيام/);
  assert.match(view, /Review and improve this copy|راجع هذا النص وحسّنه/);
  assert.match(view, /coach-brain__action-grid/);
});

test("Coach Brain is responsive for mobile staff use", () => {
  assert.match(style, /@media\(max-width:800px\)/);
});
