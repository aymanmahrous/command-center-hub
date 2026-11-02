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
    assert.match(migration, /revoke all on function public\\./);
  });
}

test("migration admits the statuses used by the worker without deleting rows", () => {
  for (const status of ["container_created", "published", "ambiguous", "failed"]) {
    assert.match(migration, new RegExp(`'${status}'`));
  }
  assert.doesNotMatch(migration, /drop constraint if exists content_publication_receipts_status_check/i);
  assert.doesNotMatch(migration, /drop constraint if exists background_jobs_status_check/i);
  assert.doesNotMatch(migration, /delete from public\\./i);
  assert.doesNotMatch(migration, /truncate\\s/i);
});

test("migration preserves the existing receipt linkage and provider contract", () => {
  assert.match(migration, /content_item_id, platform, provider/);
  assert.match(migration, /content_publication_receipts_content_item_id_platform_key|on conflict \\(content_item_id, platform\\)/i);
  assert.match(migration, /PUBLICATION_PROVIDER_MISMATCH/);
  assert.match(migration, /authorization_id|publish_job_id/);
  assert.match(migration, /PUBLICATION_RECEIPT_NOT_FOUND/);
});

test("confirmed-failure RPC cannot downgrade an ambiguous publication result", () => {
  const failedRpc = migration.split("create or replace function public.mark_publication_receipt_failed")[1]?.split("$function$;")[0] ?? "";
  assert.ok(failedRpc.includes("status in ('published', 'ambiguous')"));
});

test("safe publisher records definite provider failures and preserves ambiguity handling", () => {
  assert.match(publisher, /mark_publication_receipt_failed/);
  assert.match(publisher, /confirmed: true/);
  assert.match(publisher, /markPublicationReceiptAmbiguous/);
  assert.match(publisher, /receiptStatus === "confirmed"/);
});

test("Facebook OAuth allows the exact www production origin and binds it to the one-time state", () => {
  assert.match(facebookOAuth, /WWW_HUB_ORIGIN = "https:\\/\\/www\\.hub\\.relaxfixuae\\.com"/);
  assert.match(facebookOAuth, /value === WWW_HUB_ORIGIN/);
  assert.match(facebookOAuth, /PREVIEW_ORIGIN_PATTERN/);
  assert.match(facebookOAuth, /encodeOrigin\\(origin\\)/);
  assert.match(facebookOAuth, /decodeOrigin\\(state\\)/);
  assert.match(facebookOAuth, /safeOrigin\\(origin/);
});
