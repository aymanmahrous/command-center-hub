import { test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const view = readFileSync(new URL("../src/coach-brain.tsx", import.meta.url), "utf8");
const style = readFileSync(new URL("../src/coach-brain.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
const hub = readFileSync(new URL("../src/content-growth-hub.tsx", import.meta.url), "utf8");
const edge = readFileSync(new URL("../supabase/functions/coach-brain-research/index.ts", import.meta.url), "utf8");

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

test("Factory consumes Coach Brain handoff only on explicit factory entry", () => {
  assert.match(hub, /factoryContext.*coach-brain/);
  assert.match(hub, /sessionStorage\\.removeItem\(COACH_BRAIN_FACTORY_HANDOFF_KEY\)/);
  assert.match(hub, /get\("factoryContext"\).*coach-brain/);
});

test("Coach Brain hands research to the existing Factory without direct execution", () => {
  assert.match(view, /COACH_BRAIN_FACTORY_HANDOFF_KEY = "coach-brain-factory-handoff"/);
  assert.match(view, /sessionStorage\.setItem\(COACH_BRAIN_FACTORY_HANDOFF_KEY/);
  assert.match(view, /factoryContext.*coach-brain/);
  assert.match(view, /إرسال إلى مصنع المحتوى|Send to Content Factory/);
  assert.doesNotMatch(view, /executeCoachBrainContentGeneration/);
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

test("Coach Brain shows bilingual, explicitly estimated usage and handles missing metadata truthfully", () => {
  assert.match(view, /Gemini usage & estimated cost/);
  assert.match(view, /استخدام Gemini والتكلفة التقديرية/);
  assert.match(view, /Google Search fees are excluded/);
  assert.match(view, /لا يشمل رسوم Google Search/);
  assert.match(view, /payload\.usage \?\? null/);
  assert.match(view, /usageUnavailable/);
  assert.match(view, /pricingSource/);
});

test("Gemini usage is forwarded without logging or returning provider secrets", () => {
  assert.match(edge, /payload\.usageMetadata/);
  assert.match(edge, /buildGeminiUsageSummary/);
  assert.doesNotMatch(edge, /console\.(?:log|error)\([^)]*GEMINI_API_KEY/i);
  const response = edge.match(/return json\(\{ success: true, query: question,[\s\S]*?\}\);/);
  assert.ok(response);
  assert.doesNotMatch(response[0], /GEMINI_API_KEY|GEMINI_SECRET|ACCESS_TOKEN/i);
});
