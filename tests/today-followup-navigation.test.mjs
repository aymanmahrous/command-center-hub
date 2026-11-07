import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const today = await readFile(new URL("../src/today-view.tsx", import.meta.url), "utf8");

test("Today CRM follow-up card counts only the records it opens", () => {
  assert.match(today, /followUpsLabel: "متابعات CRM"/);
  assert.match(today, /followUpsLabel: "CRM follow-ups"/);
  assert.match(today, /followUpsHint: "سجلات المتابعة داخل CRM"/);
  assert.match(today, /followUpsHint: "CRM follow-up records"/);
  assert.match(today, /<strong>\{metrics\.crmFollowUps\.length\}<\/strong>/);
  assert.doesNotMatch(today, /<strong>\{metrics\.followUpJobs\.length \+ metrics\.crmFollowUps\.length\}<\/strong>/);
  assert.match(today, /metrics\.followUpJobs/);
});
