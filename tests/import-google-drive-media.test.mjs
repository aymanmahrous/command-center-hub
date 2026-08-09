import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const script = await readFile(new URL("../scripts/import-google-drive-media.mjs", import.meta.url), "utf8");
const registerScript = await readFile(new URL("../scripts/register-coach-ayman-document-imports.mjs", import.meta.url), "utf8");
const sql = await readFile(
  new URL("../supabase/migrations/20260809133000_coach_ayman_document_import_support.sql", import.meta.url),
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

test("google drive import script supports document assets without changing image paths", () => {
  assert.match(script, /assetType === "other"/);
  assert.match(script, /return "document"/);
  assert.match(script, /DOCUMENT_EXTENSIONS/);
  assert.match(script, /"docx"/);
  assert.match(script, /"pdf"/);
  assert.match(script, /storageSegmentForAsset/);
  assert.match(script, /return "image"/);
});

test("register script targets only the three approved Coach Ayman documents", () => {
  assert.match(registerScript, /register_staff_google_drive_document_import_candidate/);
  assert.match(registerScript, /1MXzAHqFGJRINmlCzUeVswirk6cxUlTYF/);
  assert.match(registerScript, /17vDhx9MevwVLTUP7wFh_MxRbcgKZxUPI/);
  assert.match(registerScript, /1pI9Oa8ua-ffxTDShj5gaE4O0_Im9bBRD/);
  assert.match(registerScript, /APPROVED_DOCUMENTS = \[/);
  assert.equal((registerScript.match(/driveFileId: "/g) ?? []).length, 3);
});

test("document import migration is additive and staff-scoped", () => {
  assert.match(sql, /register_staff_google_drive_document_import_candidate/);
  assert.match(sql, /asset_type = 'other'/);
  assert.match(sql, /google_drive_document_import_registered/);
  assert.match(sql, /is_active_staff\(array\['super_admin', 'admin', 'content_manager'\]\)/);
  assert.match(sql, /or m\.asset_type = 'other'/);
});
