import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/integrations-center.tsx", import.meta.url), "utf8");

test("integration cards expose the last verification time in Abu Dhabi local time", () => {
  assert.match(source, /formatLastTestedAt\(item\.lastTestedAt, language\)/);
  assert.match(source, /Asia\/Dubai/);
  assert.match(source, /Last checked/);
  assert.match(source, /آخر تحقق/);
  assert.match(source, /Not tested yet/);
  assert.match(source, /لم يُختبر بعد/);
});

test("WhatsApp status does not falsely claim n8n is connected or hide the separate dry-run reply route", () => {
  assert.match(source, /n8n status unverified/);
  assert.match(source, /حالة n8n غير متحققة/);
  assert.match(source, /defaults to dry-run/);
  assert.match(source, /Dry-run افتراضيًا/);
  assert.doesNotMatch(source, /WhatsApp uses the existing n8n path outside this screen/);
  assert.match(source, /Account access verified/);
  assert.match(source, /publishing permissions and the actual publish path were not tested/);
  assert.match(source, /صلاحيات النشر ومسار النشر الفعلي لم تُختبر/);
  assert.match(source, /actual design generation and template output are not yet verified/);
  assert.match(source, /manual prompt copy and Open Runway handoff remain available in Content Factory/);
  assert.match(source, /Verify account access/);
});
