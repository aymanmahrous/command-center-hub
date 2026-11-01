import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20261102090000_align_meta_publication_receipt_contract.sql", import.meta.url), "utf8");
const publisher = await readFile(new URL("../supabase/functions/safe-content-publisher/index.ts", import.meta.url), "utf8");
const facebookOAuth = await readFile(new URL("../supabase/functions/facebook-oauth/index.ts", import.meta.url), "utf8");

for (const name of ["claim_publication_receipt", "complete_publication_receipt", "mark_publication_receipt_ambiguous", "mark_publication_receipt_failed"]) {
  test(`migration defines the idempotent ${name} RPC`, () => {
    assert.match(migration, new RegExp(`create or replace function public\\.${name}`));
    assert.match(migration, /pg_advisory_xact_lock/);
    assert.match(migration, /revoke all on function public\./);
  });
}

test("migration admits the statuses used by the worker without deleting rows", () => {
  assert.match(migration, /'published', 'failed', 'ambiguous'/);
  assert.match(migration, /'processing', 'retrying'/);
  assert.doesNotMatch(migration, /delete from public\./i);
  assert.doesNotMatch(migration, /truncate\s/i);
});

test("safe publisher records definite provider failures and preserves ambiguity handling", () => {
  assert.match(publisher, /mark_publication_receipt_failed/);
  assert.match(publisher, /confirmed: true/);
  assert.match(publisher, /markPublicationReceiptAmbiguous/);
  assert.match(publisher, /receiptStatus === "confirmed"/);
});

test("Facebook OAuth binds an authorized Preview origin to the one-time state", () => {
  assert.match(facebookOAuth, /PREVIEW_ORIGIN_PATTERN/);
  assert.match(facebookOAuth, /encodeOrigin\(origin\)/);
  assert.match(facebookOAuth, /decodeOrigin\(state\)/);
  assert.match(facebookOAuth, /safeOrigin\(origin/);
});
