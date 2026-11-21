import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("connect_staff_integration inserts the catalog display name for every provider", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261121090000_connect_staff_integration_display_name.sql", import.meta.url), "utf8");
  assert.match(sql, /^create or replace function public\.connect_staff_integration\(/i);
  const insert = sql.match(/insert into public\.staff_integrations\(provider, display_name, connection_method,[^)]*\)\s*values \(p_provider, case p_provider\s+([\s\S]+?)\s+end, p_connection_method,/i);
  assert.ok(insert, "display_name must receive the provider CASE expression");
  const branches = insert[1].trim().split(/\s*\r?\n\s*/);
  assert.deepEqual(branches.sort(), [
    "when 'meta_whatsapp' then 'WhatsApp / Meta'",
    "when 'instagram' then 'Instagram'",
    "when 'facebook' then 'Facebook'",
    "when 'telegram' then 'Telegram'",
    "when 'google_calendar' then 'Google Calendar'",
    "when 'canva' then 'Canva'",
    "when 'ai_provider' then 'AI Provider'",
  ].sort());
});
