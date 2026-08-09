import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sql = await readFile(
  new URL(
    "../supabase/migrations/20260809020000_owner_publish_authorizations_instagram_platform_check.sql",
    import.meta.url,
  ),
  "utf8",
);

test("owner publish authorization migration replaces only legacy facebook-only constraints", () => {
  assert.match(sql, /drop constraint if exists owner_publish_authorizations_page_id_check/);
  assert.match(sql, /drop constraint if exists owner_publish_authorizations_platform_check/);
  assert.match(sql, /add constraint owner_publish_authorizations_platform_account_check/);
  assert.doesNotMatch(sql, /create or replace function/i);
  assert.doesNotMatch(sql, /grant execute/i);
  assert.doesNotMatch(sql, /revoke all/i);
});

test("owner publish authorization migration allows facebook and instagram account pairs only", () => {
  assert.match(
    sql,
    /platform = 'facebook' and page_id = '1164107840123575'/,
  );
  assert.match(
    sql,
    /platform = 'instagram' and page_id = '17841439747493221'/,
  );
  assert.doesNotMatch(sql, /platform = 'twitter'/i);
  assert.doesNotMatch(sql, /17841400516801494/);
});

test("owner publish authorization migration binds platform and account in paired checks only", () => {
  assert.match(sql, /\(\s*platform = 'facebook' and page_id = '1164107840123575'\s*\)/);
  assert.match(sql, /\(\s*platform = 'instagram' and page_id = '17841439747493221'\s*\)/);
  assert.match(sql, /\)\s*or\s*\(/);
  assert.doesNotMatch(sql, /platform = 'facebook' and page_id = '17841439747493221'/);
  assert.doesNotMatch(sql, /platform = 'instagram' and page_id = '1164107840123575'/);
});
