import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20261106120000_control_tower_overdue_schedule_visibility.sql", import.meta.url),
  "utf8",
);
const view = await readFile(new URL("../src/control-tower-v2.tsx", import.meta.url), "utf8");
const workflow = await readFile(new URL("../src/workflow-intelligence.ts", import.meta.url), "utf8");

test("control tower RPC keeps total scheduled count and adds separate future and overdue counts", () => {
  assert.match(migration, /'scheduled', \(SELECT count\(\*\) FROM public\.content_items WHERE status = 'scheduled'\)/);
  assert.match(migration, /'futureScheduled', v_future_scheduled/);
  assert.match(migration, /'overdueScheduled', v_overdue_scheduled/);
  assert.match(migration, /scheduled_for <= now\(\)/);
  assert.match(migration, /scheduled_for > now\(\)/);
  assert.match(migration, /'scheduled_content_overdue'/);
  assert.match(migration, /v_attention :=[\s\S]*v_overdue_scheduled/);
});

test("owner UI routes overdue schedule warnings to Content without mutating items", () => {
  assert.match(view, /scheduled_content_overdue/);
  assert.match(view, /futureScheduled \?\? summary\.content\.scheduled/);
  assert.match(view, /summary\.content\.overdueScheduled/);
  assert.match(workflow, /content-overdue-schedule/);
  assert.match(workflow, /Review timing and receipts before any reschedule/);
  assert.doesNotMatch(view, /update_staff_content_planned_for/);
});

test("control tower summary retains staff authorization and remains read-only", () => {
  assert.match(migration, /SECURITY DEFINER/);
  assert.match(migration, /public\.is_active_staff\(ARRAY\['super_admin','admin','reception','coach','content_manager'\]\)/);
  assert.doesNotMatch(migration, /\b(?:INSERT INTO|UPDATE public\.|DELETE FROM)\b/i);
});
