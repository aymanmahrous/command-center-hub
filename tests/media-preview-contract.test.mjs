import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
const sql = await readFile(new URL("../supabase/sql/draft_get_staff_media_assets_imported_read.sql", import.meta.url), "utf8");

test("media preview uses authenticated private object read only", () => {
  assert.match(app, /fetchStaffMediaPreviewObjectUrl/);
  assert.match(app, /storage\/v1\/object\/\$\{MEDIA_BUCKET\}/);
  assert.match(app, /Authorization: `Bearer \$\{session\.accessToken\}`/);
  assert.match(app, /URL\.createObjectURL\(blob\)/);
  assert.match(app, /URL\.revokeObjectURL/);
  assert.doesNotMatch(app, /object\/sign\//);
  assert.doesNotMatch(app, /createObjectURL\((?!blob)/);
});

test("media preview is limited to image assets with bucket storage paths", () => {
  assert.match(app, /assetType === "image"/);
  assert.match(app, /isPreviewableImageStoragePath/);
  assert.match(app, /!storagePath\.includes\(":\/\/"\)/);
});

test("imported media read expansion keeps ownership unchanged", () => {
  assert.match(sql, /created_by is null/);
  assert.match(sql, /split_part\(storage_path, '\/', 1\) = auth\.uid\(\)::text/);
  assert.match(sql, /can_manage_relax_fix_media\(\)/);
  assert.doesNotMatch(sql, /update public\.media_assets/i);
});
