import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

const itemId = "00000000-0000-4000-8000-000000000001";
const mediaId = "00000000-0000-4000-8000-000000000002";
const staffId = "00000000-0000-4000-8000-000000000003";
const receiptId = "00000000-0000-4000-8000-000000000004";
const settings = {
  SUPABASE_URL: "https://database.invalid", SUPABASE_ANON_KEY: "fixture-public",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-service", META_APP_SECRET: "fixture-secret",
  FACEBOOK_PAGE_ID: "page", FACEBOOK_PAGE_ACCESS_TOKEN: "fixture-fb",
  INSTAGRAM_ACCOUNT_ID: "account", INSTAGRAM_ACCESS_TOKEN: "fixture-ig",
  OWNER_PUBLISHING_LIVE_AUTHORIZED: "true",
};
let handler, frozenHandler;
globalThis.Deno = { env: { get: key => settings[key] }, serve: fn => { handler = fn; } };
settings.OWNER_PUBLISHING_LIVE_AUTHORIZED = "false";
await import("../supabase/functions/safe-content-publisher/index.ts?frozen");
frozenHandler = handler;
settings.OWNER_PUBLISHING_LIVE_AUTHORIZED = "true";
await import("../supabase/functions/safe-content-publisher/index.ts");

const send = async (endpoint = handler) => {
  const response = await endpoint(new Request("https://publisher.invalid", {
    method: "POST", headers: { Authorization: "Bearer fixture-staff" }, body: JSON.stringify({ contentItemId: itemId }),
  }));
  return response.json();
};

function fixture(t, options = {}) {
  const state = { receipt: options.receipt, calls: [], reservations: 0, completions: 0 };
  const platform = options.platform ?? "facebook";
  t.mock.method(globalThis, "fetch", async (url, init) => {
    const { hostname, pathname } = new URL(url);
    if (hostname === "graph.facebook.com") {
      state.calls.push(pathname.split("/").at(-1));
      assert.ok(state.reservations > 0);
      if (options.graph) return options.graph(state.calls.at(-1));
      return Response.json({ id: "external-123" });
    }
    assert.equal(hostname, "database.invalid");
    switch (pathname) {
      case "/auth/v1/user": return Response.json({ id: staffId });
      case "/rest/v1/staff_profiles": return Response.json([{ active: options.active ?? true, role: "super_admin" }]);
      case "/rest/v1/content_items": return Response.json([{ id: itemId, status: options.status ?? "approved",
        platform, caption: "fixture", media_asset_id: mediaId }]);
      case "/rest/v1/staff_integrations": return Response.json([]);
      case "/rest/v1/media_assets": return Response.json([{ storage_path: "photo.jpg", asset_type: "image",
        content_item_id: itemId, category: "swimming_business", media_status: "ready", consent_status: "consent_confirmed",
        publishability_status: "ready_for_review", metadata: { reviewStatus: options.review ?? "approved" } }]);
      case "/storage/v1/object/sign/relax-fix-media/photo.jpg": return Response.json({ signedURL: "/fixture" });
    }
    assert.equal(init.headers.Authorization, "Bearer fixture-service");
    const args = JSON.parse(init.body);
    assert.equal(args.p_content_item_id, itemId);
    assert.equal(args.p_platform, platform);
    switch (pathname) {
      case "/rest/v1/rpc/reserve_manual_meta_publication":
        state.reservations++;
        assert.equal(args.p_media_asset_id, mediaId);
        if (options.reserve) return Response.json(await options.reserve(args));
        if (state.receipt) return Response.json({ created: false, code: "RECEIPT_EXISTS" });
        state.receipt = "reserved";
        return Response.json({ created: true, receiptId });
      case "/rest/v1/rpc/finish_manual_meta_publication":
        state.completions++;
        assert.equal(args.p_staff_id, staffId);
        if (options.finish) return Response.json(await options.finish(args));
        assert.equal(args.p_receipt_id, receiptId);
        assert.equal(state.receipt, "reserved");
        state.receipt = args.p_external_post_id ? "published" : "failed";
        return Response.json(true);
      case "/rest/v1/rpc/mark_publication_receipt_ambiguous":
        if (options.mark) return Response.json(await options.mark(args));
        assert.equal(state.receipt, "reserved");
        state.receipt = "ambiguous";
        return Response.json({ success: true });
      default: throw new Error("Unexpected request: " + pathname);
    }
  });
  return state;
}

async function concurrentClicks(t, options = {}) {
  const release = Promise.withResolvers();
  let entered = 0;
  const state = fixture(t, { ...options, graph: async path => {
    // Unblock even on a regression where both invocations reach the provider.
    if (++entered > 1) release.resolve();
    await release.promise;
    return Response.json({ id: path === "media" ? "container" : "external-123" });
  } });
  const clicks = [send(), send()];
  try {
    const blocked = await Promise.race(clicks);
    assert.equal(blocked.success, false);
    assert.equal(blocked.manualReviewRequired, true);
  } finally {
    release.resolve();
  }
  const results = await Promise.all(clicks);
  assert.equal(results.filter(result => result.success && result.providerExternalId === "external-123").length, 1);
  assert.deepEqual(state.calls, options.platform === "instagram" ? ["media", "media_publish"] : ["photos"]);
  assert.equal(state.completions, 1);
}

test("overlapping Facebook clicks make exactly one external request", concurrentClicks);
test("overlapping Instagram clicks create one container and publish it once", t => concurrentClicks(t, { platform: "instagram" }));

for (const [name, options, expected] of [
  ["Meta accepted the request but the response was lost", { graph() { throw new TypeError("response lost"); } }, "ambiguous"],
  ["unconfirmed response from Meta", { graph: () => Response.json({}) }, "ambiguous"],
  ["result transaction failed", { finish() { throw new Error("database unavailable"); } }, "ambiguous"],
  ["result transaction returned a refusal", { finish: () => false }, "ambiguous"],
  ["both result and ambiguity writes failed", { finish: () => false, mark() { throw new Error("unavailable"); } }, "reserved"],
]) {
  test(name + " blocks any second send", async t => {
    const state = fixture(t, options);
    const first = await send();
    assert.equal(first.manualReviewRequired, true);
    assert.equal(first.nextAction, "RECONCILE_WITH_META_PAGE");
    assert.equal(state.receipt, expected);
    assert.equal((await send()).success, false);
    assert.deepEqual(state.calls, ["photos"]);
  });
}

test("a confirmed provider rejection is recorded once", async t => {
  const state = fixture(t, { graph: () => Response.json({ error: { code: 190 } }, { status: 401 }) });
  assert.equal((await send()).code, "META_API_ERROR");
  assert.equal(state.receipt, "failed");
  assert.equal((await send()).success, false);
  assert.deepEqual(state.calls, ["photos"]);
});

for (const [name, options, endpoint] of [
  ["owner freeze", {}, frozenHandler], ["inactive staff", { active: false }, handler],
  ["scheduled content", { status: "scheduled" }, handler], ["unreviewed media", { review: "pending" }, handler],
]) {
  test(name + " stops before reservation", async t => {
    const state = fixture(t, options);
    assert.equal((await send(endpoint)).success, false);
    assert.equal(state.reservations, 0);
    assert.deepEqual(state.calls, []);
  });
}

// Same local PostgreSQL engine used by the scheduling migration tests.
const require = createRequire(import.meta.url);
let engine;
try { engine = require.resolve("@electric-sql/pglite"); }
catch (error) { if (error.code !== "MODULE_NOT_FOUND") throw error; }
const read = path => readFile(new URL(path, import.meta.url), "utf8");
const migration = "../supabase/migrations/20261122170000_reserve_manual_meta_publication.sql";
test("manual endpoint and reservation SQL against isolated PostgreSQL", {
  skip: engine ? false : "requires local @electric-sql/pglite",
}, async t => {
  const { PGlite } = require(engine);
  const db = new PGlite();
  await db.waitReady;
  t.after(() => db.close());
  const one = async (query, args = []) => (await db.query(query, args)).rows[0];
  await db.exec(await read("./fixtures/approve-and-schedule.sql"));
  await db.exec(`ALTER TABLE content_publication_receipts ADD id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ADD provider text, ADD external_post_id text, ADD last_error text, ADD updated_at timestamptz,
    ADD authorization_id uuid, ADD publish_job_id uuid, ADD UNIQUE(content_item_id, platform);
    CREATE TABLE staff_profiles (id uuid PRIMARY KEY, active boolean, role text);
    GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO service_role;`);
  await db.exec((await read("../supabase/migrations/20261101092147_enforce_media_review_before_publish.sql"))
    .split("CREATE OR REPLACE FUNCTION public.guard_content_media_before_schedule")[0]);
  await db.exec(await read("../supabase/migrations/20261101092350_guard_pending_publication_receipts.sql"));
  await db.exec(await read("../supabase/migrations/20261102090000_align_meta_publication_receipt_contract.sql"));
  await db.exec("CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT 'service_role'::text $$");
  await db.exec(await read(migration));
  await db.query("INSERT INTO staff_profiles VALUES ($1,true,'super_admin')", [staffId]);
  await db.exec("UPDATE content_items SET status='approved', platform='facebook'");
  await db.exec("SET ROLE service_role");
  const reserve = async a => (await one("SELECT reserve_manual_meta_publication($1,$2,$3) AS result",
    [a.p_content_item_id, a.p_platform, a.p_media_asset_id])).result;
  const finish = async a => (await one("SELECT finish_manual_meta_publication($1,$2,$3,$4,$5,$6) AS result",
    [a.p_content_item_id, a.p_platform, a.p_receipt_id, a.p_staff_id, a.p_external_post_id, a.p_error_code])).result;
  await t.test("one committed receipt and one provider call", t => concurrentClicks(t, { reserve, finish }));
  assert.deepEqual(await one(`SELECT c.status, c.provider_external_id, r.external_post_id, a.actor_id, a.action
    FROM content_items c JOIN content_publication_receipts r ON r.content_item_id=c.id
    JOIN audit_logs a ON a.entity_id=c.id`), {
    status: "published", provider_external_id: "external-123", external_post_id: "external-123",
    actor_id: staffId, action: "content_published",
  });
  assert.equal((await one("SELECT count(*)::int AS n FROM content_publication_receipts")).n, 1);
  for (const role of ["anon", "authenticated"]) {
    for (const fn of ["reserve_manual_meta_publication(uuid,text,uuid)", "finish_manual_meta_publication(uuid,text,uuid,uuid,text,text)"]) {
      assert.equal((await one("SELECT has_function_privilege($1,$2,'execute') AS allowed", [role, fn])).allowed, false);
    }
  }
  await t.test("existing receipts from any publisher never grant another send or change", async () => {
    await db.exec("RESET ROLE; TRUNCATE content_publication_receipts; UPDATE content_items SET status='approved', published_at=NULL, provider_external_id=NULL");
    for (const status of ["pending", "reserved", "container_created", "ambiguous", "failed", "published"]) {
      await db.query("INSERT INTO content_publication_receipts(content_item_id,platform,provider,status) VALUES ($1,'Facebook','legacy',$2)", [itemId, status]);
      const before = await one("SELECT * FROM content_publication_receipts");
      assert.equal((await reserve({ p_content_item_id: itemId, p_platform: "facebook", p_media_asset_id: mediaId })).created, false);
      const { rows } = await db.query("SELECT * FROM content_publication_receipts");
      assert.deepEqual(rows, [before]);
      await db.exec("TRUNCATE content_publication_receipts");
    }
    await db.exec("SET ROLE service_role");
  });
  const mark = async a => (await one("SELECT mark_publication_receipt_ambiguous($1,$2,$3,$4) AS result",
    [a.p_content_item_id, a.p_platform, a.p_provider, a.p_error])).result;
  for (const mode of ["meta_response_lost", "audit_write_failed", "commit_response_lost"]) {
    await t.test(mode + " blocks a second external request", async t => {
      await db.exec(`RESET ROLE; TRUNCATE audit_logs, content_publication_receipts;
        UPDATE content_items SET status='approved', published_at=NULL, provider_external_id=NULL;
        SET ROLE service_role;`);
      if (mode === "audit_write_failed") {
        await db.exec("RESET ROLE; REVOKE INSERT ON audit_logs FROM service_role; SET ROLE service_role");
      }
      const state = fixture(t, { reserve, mark, graph() {
        if (mode === "meta_response_lost") throw new TypeError("response lost");
        return Response.json({ id: "external-123" });
      }, async finish(a) {
        const result = await finish(a);
        if (mode === "commit_response_lost") throw new TypeError("commit response lost");
        return result;
      } });
      assert.equal((await send()).manualReviewRequired, true);
      assert.equal((await send()).success, false);
      assert.deepEqual(state.calls, ["photos"]);
      const committed = mode === "commit_response_lost";
      assert.deepEqual(await one(`SELECT r.status AS receipt, c.status AS item,
        (SELECT count(*)::int FROM audit_logs) AS audits FROM content_publication_receipts r
        JOIN content_items c ON c.id=r.content_item_id`), {
        receipt: committed ? "published" : "ambiguous", item: committed ? "published" : "approved", audits: committed ? 1 : 0,
      });
      await db.exec("RESET ROLE; GRANT INSERT ON audit_logs TO service_role; SET ROLE service_role");
    });
  }
});
