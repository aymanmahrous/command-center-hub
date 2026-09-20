import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const script = await readFile(new URL("../scripts/import-google-drive-media.mjs", import.meta.url), "utf8");
const sql = await readFile(
  new URL("../supabase/migrations/20260808223300_get_staff_google_drive_import_candidates.sql", import.meta.url),
  "utf8",
);

test("google drive import script uses staff auth and relax-fix-media bucket only", () => {
  assert.match(script, /relax-fix-media/);
  assert.match(script, /grant_type=password/);
  assert.match(script, /get_staff_google_drive_import_candidates/);
  assert.match(script, /update_staff_media_asset_storage_path/);
  assert.match(script, /x-upsert.*false/);
  assert.doesNotMatch(script, /get_staff_media_assets/);
  assert.doesNotMatch(script, /SUPABASE_SERVICE_ROLE|service_role_key|Bearer \$\{.*service/i);
  assert.doesNotMatch(script, /graph\.facebook\.com/i);
});

test("google drive import script passes MEDIA_ASSET_ID to discovery RPC", () => {
  assert.match(script, /p_media_asset_id:\s*TARGET_MEDIA_ASSET_ID/);
  assert.match(script, /MEDIA_ASSET_ID/);
});

test("google drive import script preserves one-to-one mapping and verifies upload", () => {
  assert.match(script, /storageHead/);
  assert.match(script, /DESTINATION_ALREADY_EXISTS/);
  assert.match(script, /fileExistenceVerified/);
  assert.match(script, /publishingPerformed:\s*false/);
});

test("google drive import discovery RPC is scoped to pending google_drive assets", () => {
  assert.match(sql, /get_staff_google_drive_import_candidates/);
  assert.match(sql, /provider = 'google_drive'/);
  assert.match(sql, /storage_path/);
  assert.match(sql, /content_item_id is not null/);
  assert.match(sql, /drive_file_id/);
  assert.match(sql, /p_media_asset_id is null or m\.id = p_media_asset_id/);
  assert.match(sql, /is_active_staff\(array\['super_admin', 'admin', 'content_manager'\]\)/);
  assert.doesNotMatch(sql, /created_by = auth\.uid\(\)/);
  assert.doesNotMatch(sql, /update public\.media_assets/);
});
