import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const main = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
const view = await readFile(new URL("../src/ai-workforce-view.tsx", import.meta.url), "utf8");

test("AI Workforce is reachable from More and is excluded from non-owner roles", () => {
  assert.match(main, /\["agents", Bot, "x"\]/);
  assert.match(main, /session\.role === "super_admin" && <button key="agents"/);
  assert.match(main, /session\.role === "super_admin"/);
  assert.match(main, /active === "agents"/);
  assert.ok(main.includes("nav.agents"));
});

test("AI Workforce is a truthful directory, not a fake autonomous agent ledger", () => {
  assert.match(view, /There is no general registry or execution ledger/);
  assert.match(view, /لا يوجد حتى الآن سجل عام موحد/);
  assert.match(view, /Providers are not agents/);
  assert.match(view, /Gemini and OpenAI are model providers/);
  assert.match(view, /Runway has no verified generation or handoff path/);
  assert.match(view, /No verified video-generation path is currently available/);
  assert.match(view, /لا يوجد مسار توليد فيديو مثبت حاليًا/);
  assert.match(view, /Owner authorization required/);
  assert.match(view, /يتطلب تفويض المالك/);
  assert.match(view, /owner_authorization_required: t\.owner_authorization_required/);
  assert.doesNotMatch(view, /frozen: t\.frozen/);
  assert.doesNotMatch(view, /Protected \/ frozen|محمي \/ مجمّد|Uses the existing Google Veo path when available/);
  assert.doesNotMatch(view, /Runway is currently a manual handoff|Runway تسليم يدوي حاليًا/);
  assert.match(view, /Runway is status-only with no verified generation or handoff path/);
  assert.match(view, /External publishing remains behind the owner-authorization gate/);
  assert.match(view, /الإرسال الخارجي محمي ببوابة تفويض المالك/);
  assert.match(view, /AI Sales Concierge/);
  assert.match(view, /process_ai_sales_concierge_turn/);
  assert.match(view, /Draft only — human review/);
  assert.match(view, /categoryLabels/);
  const publisherStart = view.indexOf('id: "publisher",');
  assert.ok(publisherStart >= 0);
  const publisherEnd = view.indexOf("icon: LockKeyhole", publisherStart);
  assert.ok(publisherEnd > publisherStart);
  const publisher = view.slice(publisherStart, publisherEnd);
  assert.doesNotMatch(publisher, /destination:/);
});

test("existing workflows are linked rather than duplicated", () => {
  assert.match(view, /onNavigate\(entry\.destination!/);
  assert.match(view, /Content Factory/);
  assert.match(view, /Media Library/);
  assert.match(view, /Human Review/);
  assert.match(view, /Publisher/);
  assert.doesNotMatch(view, /create_staff_generated_content_batch|insert\(|\.from\(/);
});
