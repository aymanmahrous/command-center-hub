import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20260914020000_fix_control_tower_summary_revenue.sql", import.meta.url),
  "utf8",
);

test("control tower RPC fix uses invoices.amount and zero orderTotal", () => {
  assert.match(migration, /sum\(amount\) FROM public\.invoices/);
  assert.match(migration, /'orderTotal', 0/);
  assert.doesNotMatch(migration, /sum\(total_amount\)/);
  assert.match(migration, /FROM public\.staff_alerts/);
});
