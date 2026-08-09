import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../src/media-library.css", import.meta.url), "utf8");
const migration = await readFile(
  new URL("../supabase/migrations/20260809133000_coach_ayman_document_import_support.sql", import.meta.url),
  "utf8",
);

test("Media Library keeps private read-only boundary for documents", () => {
  assert.match(app, /get_staff_media_assets/);
  assert.doesNotMatch(app, /\/storage\/v1\//i);
  assert.doesNotMatch(app, /create_staff_media_asset_record/);
  assert.doesNotMatch(app, /\/rest\/v1\/media_assets[^\n]*(PATCH|PUT|DELETE|POST)/i);
});

test("Media Library exposes document asset type without public preview URLs", () => {
  assert.match(app, /"other"/);
  assert.match(app, /Document/);
  assert.match(app, /مستند/);
  assert.match(app, /documentPreviewPrivate/);
  assert.doesNotMatch(app, /drive\.google\.com/i);
});

test("document storage path contract uses staff-owned private prefix", () => {
  assert.match(migration, /asset_type = 'other'/);
  assert.match(css, /media-other/);
});
