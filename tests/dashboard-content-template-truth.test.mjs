import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboard = await readFile(new URL("../src/control-tower-v2.tsx", import.meta.url), "utf8");

test("dashboard labels the fixed 10-slot mix as a template, not a Coach Brain generated plan", () => {
  assert.match(dashboard, /CONTENT MIX TEMPLATE · 10 DAYS/);
  assert.match(dashboard, /قالب توزيع المحتوى لـ10 أيام/);
  assert.match(dashboard, /10-day content mix template/);
  assert.match(dashboard, /actual plan and each day’s design prompt appear in Content Factory/);
  assert.match(dashboard, /الخطة الفعلية وبرومبت كل يوم يظهران/);
  assert.match(dashboard, /Template slot; Coach Brain has not generated a personalized plan yet/);
  assert.match(dashboard, /قالب توزيع؛ لم ينشئ Coach Brain خطة شخصية بعد/);
  assert.doesNotMatch(dashboard, /Smart 10-day marketing plan|خطة التسويق الذكية/);
});
