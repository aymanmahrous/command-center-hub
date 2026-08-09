import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const script = await readFile(new URL("../scripts/import-google-drive-media.mjs", import.meta.url), "utf8");
const sql = await readFile(new URL("../supabase/sql/draft_update_staff_media_asset_storage_path.sql", import.meta.url), "utf8");

test("google drive import script uses staff auth and relax-fix-media bucket only", () => {
  assert.match(script, /relax-fix-media/);
  assert.match(script, /grant_type=password/);
  assert.match(script, /get_staff_media_assets/);
  assert.match(script, /update_staff_media_asset_storage_path/);
  assert.match(script, /x-upsert.*false/);
  assert.doesNotMatch(script, /SUPABASE_SERVICE_ROLE|service_role_key|Bearer \$\{.*service/i);
  assert.doesNotMatch(script, /graph\.facebook\.com/i);
});

test("google drive import script preserves one-to-one mapping and verifies upload", () => {
  assert.match(script, /storageHead/);
  assert.match(script, /DESTINATION_ALREADY_EXISTS/);
  assert.match(script, /fileExistenceVerified/);
  assert.match(script, /publishingPerformed:\s*false/);
  assert.match(script, /MEDIA_ASSET_ID/);
});

test("draft storage-path RPC updates only null google_drive assets after object exists", () => {
  assert.match(sql, /update public\.media_assets/);
  assert.match(sql, /STORAGE_PATH_ALREADY_SET/);
  assert.match(sql, /provider.*google_drive/);
  assert.match(sql, /STORAGE_OBJECT_NOT_FOUND/);
  assert.match(sql, /is_active_staff\(array\['super_admin', 'admin', 'content_manager'\]\)/);
});
