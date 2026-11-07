import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const preview = await readFile(new URL("../src/content-batch-media-preview.tsx", import.meta.url), "utf8");
const panel = await readFile(new URL("../src/content-batch-review-panel.tsx", import.meta.url), "utf8");
const hub = await readFile(new URL("../src/content-growth-hub.tsx", import.meta.url), "utf8");
const coachBrain = await readFile(new URL("../src/coach-brain.tsx", import.meta.url), "utf8");

test("batch review panel renders design preview block", () => {
  assert.match(panel, /ContentBatchMediaPreview/);
  assert.match(panel, /mediaAssets/);
  assert.match(preview, /parseCanvaBrief/);
  assert.match(preview, /content-batch-design-image/);
});

test("content growth hub loads media assets for batch preview", () => {
  assert.match(hub, /get_staff_media_assets/);
  assert.match(hub, /mediaAssets=\{mediaAssets\}/);
});

test("content factory opens the owner review workspace when reviewable items exist", () => {
  assert.match(hub, /reviewAutoOpened/);
  assert.match(hub, /activeFactoryTab === "overview"/);
  assert.match(hub, /setActiveFactoryTab\("review"\)/);
});

test("content factory consumes the existing Coach Brain handoff as supporting context", () => {
  assert.match(hub, /COACH_BRAIN_FACTORY_HANDOFF_KEY/);
  assert.match(hub, /coach-brain-factory-handoff/);
  assert.match(hub, /factoryContext.*coach-brain/);
  assert.match(hub, /researchContext: coachBrainContext/);
  assert.match(hub, /canonical Academy Knowledge remains the existing source/);
});

test("Coach Brain keeps the existing session handoff and adds durable browser recovery", () => {
  assert.match(coachBrain, /writeCoachBrainFactoryHandoff\(handoff\)/);
  assert.match(hub, /readCoachBrainFactoryHandoff/);
  assert.match(hub, /storedCoachBrainHandoff\?\.planWindowDays/);
  assert.match(hub, /storedCoachBrainHandoff\?\.planMix/);
  assert.match(hub, /storedCoachBrainHandoff\?\.planExecution/);
  assert.match(hub, /clearCoachBrainFactoryHandoff\(\);/);
  assert.doesNotMatch(hub, /setCoachBrainContext\(readCoachBrainFactoryContext\(\)\);\s*clearCoachBrainFactoryHandoff\(\);/);
});

test("batch review panel integrates direct library picker and safe upload registration", () => {
  assert.match(panel, /content-media-source-selector/);
  assert.match(panel, /link_staff_media_to_content_item/);
  assert.match(panel, /uploadStaffMediaFile/);
  assert.match(panel, /register_staff_media_upload/);
  assert.match(panel, /linkMediaToItem/);
  assert.match(panel, /canUseInMarketingBatch\(asset\)/);
  assert.match(panel, /الرفع لا يثبت الموافقة/);
});

test("coach brain edge function prompt enforces evidence-based pedagogy and 5-part concise response", async () => {
  const coachBrain = await readFile(new URL("../supabase/functions/coach-brain-research/index.ts", import.meta.url), "utf8");
  assert.match(coachBrain, /## 1\. الخلاصة والتوصية/);
  assert.match(coachBrain, /## 2\. خطوات التدريب أو التعليم/);
  assert.match(coachBrain, /## 3\. التمرين التالي المناسب/);
  assert.match(coachBrain, /## 4\. طريقة قياس التقدم/);
  assert.match(coachBrain, /## 5\. المصادر الموثوقة/);
  assert.match(coachBrain, /water fear\/anxiety/);
  assert.match(coachBrain, /attention difficulties \(ADHD\)/);
  assert.match(coachBrain, /autism spectrum \(ASD\)/);
  assert.match(coachBrain, /Aquatic fitness/);
});

test("batch review panel retains all batch items including scheduled and published, and supports media replacement", () => {
  assert.match(panel, /content-media-replace-toggle/);
  assert.match(panel, /استبدال الصورة \/ تغيير التصميم/);
  assert.match(panel, /"published"/);
  assert.match(panel, /"منشور"/);
  assert.match(hub, /activeFactoryTab === "factory" \|\| activeFactoryTab === "strategy"/);
});


test("every scheduled Factory item exposes its own complete design prompt and manual provider handoff", () => {
  const blockStart = panel.indexOf('className="content-daily-design-prompt"');
  const guardStart = panel.lastIndexOf("{session && (", blockStart);
  const blockEnd = panel.indexOf("</section>", blockStart);
  assert.ok(blockStart >= 0 && guardStart >= 0 && blockEnd > blockStart, "daily prompt block must exist inside the authenticated item card");
  const guard = panel.slice(guardStart, blockStart);
  const block = panel.slice(blockStart, blockEnd);
  assert.doesNotMatch(guard, /!item\.mediaAssetId|replacingMediaItemId|canRegenerateDesign/, "prompt visibility must not depend on whether media is already linked");
  assert.match(block, /itemDesignPrompt/);
  assert.match(block, /value=\{itemDesignPrompt\}/);
  assert.match(block, /copyDesignPrompt\(item\)/);
  assert.match(block, /openExternalBrief\("canva", item\)/);
  assert.match(block, /openExternalBrief\("gemini", item\)/);
  assert.match(block, /openExternalBrief\("runway", item\)/);
  assert.match(block, /formatWhen\(language, item\.scheduledFor\)/);
  assert.match(block, /manualVideoDuration/);
  assert.match(block, /manualRunwayPrompt\.text/);
  assert.match(panel, /const basePrompt = String\(item\.visualPrompt \?\? ""\)\.trim\(\)/);
  assert.match(panel, /if \(!basePrompt\)/);
  assert.match(panel, /FINAL OUTPUT REQUIREMENT: Create one vertical 9:16 video/);
});
