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
  assert.match(main, /nav\.aiWorkforce/);
});

test("AI Workforce is a truthful directory, not a fake autonomous agent ledger", () => {
  assert.match(view, /There is no general registry or execution ledger/);
  assert.match(view, /لا يوجد حتى الآن سجل عام موحد/);
  assert.match(view, /Providers are not agents/);
  assert.match(view, /Gemini and OpenAI are model providers/);
  assert.match(view, /Runway is not API-connected/);
  assert.match(view, /Publishing, scheduling, and retry are protected and frozen/);
});

test("existing workflows are linked rather than duplicated", () => {
  assert.match(view, /onNavigate\(entry\.destination!/);
  assert.match(view, /Content Factory/);
  assert.match(view, /Media Library/);
  assert.match(view, /Human Review/);
  assert.match(view, /Publisher/);
  assert.doesNotMatch(view, /create_staff_generated_content_batch|insert\(|\.from\(/);
});
