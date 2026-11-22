import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8").replaceAll("\r\n", "\n");
const migration = name => read("../supabase/migrations/" + name);
const candidate = migration("20261122090000_return_safe_approve_and_schedule_refusals.sql");
// The function in this historical file matches the production definition. Exclude its separate data correction.
const production = migration("20261007205500_fix_atomic_schedule_publish_payload.sql").split("$function$;")[0] + "$function$;";
const item = "00000000-0000-4000-8000-000000000001";
const due = "2095-08-10T12:30:00Z";
const signature = "public.approve_and_schedule_staff_content_item(uuid,timestamptz)";

test("the scheduling migration keeps the production job lookup, payload merge and returned job ID", () => {
  function successPath(sql) {
    const match = sql.match(/SELECT lower\(btrim\(platform\)\)[\s\S]*?RETURN \w+ \|\| jsonb_build_object\('publishJobId', v_job_id\);/);
    assert.ok(match, "missing production job path");
    return match[0].replace(/^[ \t]+/gm, "").replace(/RETURN \w+ \|\|/, "RETURN result ||");
  }
  assert.equal(successPath(candidate), successPath(production));
});

// Optional engine for the database cases: @electric-sql/pglite on the Node resolution path.
// Its in-memory constructor never opens a project connection.
const require = createRequire(import.meta.url);
let engine;
try {
  engine = require.resolve("@electric-sql/pglite");
} catch (error) {
  if (error.code !== "MODULE_NOT_FOUND") throw error;
}

test("scheduling success parity and atomic refusals in isolated PostgreSQL", {
  skip: engine ? false : "requires the local @electric-sql/pglite test engine",
}, async t => {
  const { PGlite } = require(engine);
  const db = new PGlite();
  t.after(() => db.close());
  const row = async (sql, params) => (await db.query(sql, params)).rows[0];
  async function isolated(run) {
    await db.exec("BEGIN");
    try { await run(); } finally { await db.exec("ROLLBACK"); }
  }
  async function invoke() {
    await db.exec("SET LOCAL ROLE authenticated");
    const { result } = await row("SELECT public.approve_and_schedule_staff_content_item($1,$2) AS result", [item, due]);
    await db.exec("RESET ROLE");
    return result;
  }
  const snapshot = () => row(`
    SELECT (SELECT jsonb_agg(i ORDER BY id) FROM content_items i) AS items,
           (SELECT jsonb_agg(a ORDER BY detail->>'action') FROM audit_logs a) AS audits,
           (SELECT jsonb_agg(j ORDER BY id) FROM background_jobs j) AS jobs,
           (SELECT jsonb_agg(m ORDER BY id) FROM media_assets m) AS media`);
  const security = () => row("SELECT proacl::text, prosecdef, proconfig FROM pg_proc WHERE oid=$1::regprocedure", [signature]);

  await db.exec(read("./fixtures/approve-and-schedule.sql"));
  await db.exec(migration("20261030095125_align_content_approval_audit_actor_and_external_media_defaults.sql")
    .split("CREATE OR REPLACE FUNCTION public.register_staff_external_media_asset")[0]);
  await db.exec(migration("20261101092147_enforce_media_review_before_publish.sql")
    .split("CREATE OR REPLACE FUNCTION public.guard_publication_receipt_media_readiness")[0]);
  await db.exec(production);
  await db.exec(`REVOKE EXECUTE ON FUNCTION ${signature} FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION ${signature} TO authenticated, service_role`);
  const originalSecurity = await security();

  for (const platform of ["facebook", "instagram"]) {
    await t.test(platform + " matches the production response and all persisted rows", () => isolated(async () => {
      await db.query("UPDATE content_items SET platform=$1", [platform]);
      const before = await snapshot();
      await db.exec("SAVEPOINT before_call");
      const expected = await invoke();
      const expectedRows = await snapshot();
      await db.exec("ROLLBACK TO SAVEPOINT before_call");
      await db.exec(candidate);
      const actual = await invoke();
      const after = await snapshot();

      assert.equal(actual.success, true);
      assert.equal(actual.to, "scheduled");
      assert.equal(actual.publishJobId, "00000000-0000-0000-0000-000000000002");
      assert.deepEqual(actual, expected);
      assert.deepEqual(after, expectedRows);
      assert.equal(after.items[0].status, "scheduled");
      assert.equal(Date.parse(after.items[0].scheduled_for), Date.parse(due));
      assert.equal(after.audits.length, 2);
      assert.equal(after.jobs.length, before.jobs.length);
      for (const [i, job] of after.jobs.entries()) {
        if (job.id !== actual.publishJobId) {
          assert.deepEqual(job, before.jobs[i]);
          continue;
        }
        assert.equal(job.status, "queued");
        assert.equal(job.payload.original, 2);
        assert.equal(job.payload.platform, platform);
        assert.equal(job.payload.idempotencyKey, item);
        assert.equal(job.payload.source, "staff_schedule");
        assert.ok(platform === "facebook" ? job.payload.pageId : job.payload.accountId);
        assert.equal(platform === "facebook" ? job.payload.accountId : job.payload.pageId, null);
      }
    }));
  }

  await db.exec(candidate);
  assert.deepEqual(await security(), originalSecurity);
  async function refusal(label, setup, code) {
    await t.test(label, () => isolated(async () => {
      await db.exec(setup);
      const before = await snapshot();
      assert.deepEqual(await invoke(), { success: false, code });
      assert.deepEqual(await snapshot(), before);
    }));
  }
  const failures = [
    ["missing post", "DELETE FROM content_items", "NOT_FOUND"],
    ["stale state", "UPDATE content_items SET status='cancelled'", "INVALID_TRANSITION"],
    ["staff gate", "SET LOCAL fixture.staff='denied'", "STAFF_ACCESS_DENIED"],
    ["no linked asset", "UPDATE content_items SET media_asset_id=NULL", "MEDIA_ASSET_REQUIRED_FOR_PUBLISH"],
    ["missing asset", "DELETE FROM media_assets", "MEDIA_ASSET_MISSING_OR_UNLINKED"],
    ["wrong asset owner", "UPDATE media_assets SET content_item_id=NULL", "MEDIA_ASSET_MISSING_OR_UNLINKED"],
    ["unreviewed media", "UPDATE media_assets SET metadata='{}'", "MEDIA_NOT_APPROVED_FOR_PUBLISH"],
    ["unconfirmed consent", "UPDATE media_assets SET consent_status='pending'", "MEDIA_NOT_APPROVED_FOR_PUBLISH"],
    ["unsupported platform", "UPDATE content_items SET platform='tiktok'", "PLATFORM_NOT_SUPPORTED"],
    ["no matching queued job", "DELETE FROM background_jobs WHERE payload->>'original' IN ('1','2','3')", "SCHEDULE_PUBLISH_JOB_NOT_FOUND"],
    ["caller cannot update the job", "REVOKE UPDATE (payload,updated_at) ON background_jobs FROM authenticated", "APPROVE_AND_SCHEDULE_FAILED"],
  ];
  for (const [label, setup, code] of failures) await refusal(label, setup, code);

  // Fail after the payload write. Both recognised-looking and arbitrary database errors must stay private.
  for (const [message, state] of [["private fixture detail", "23514"], ["MEDIA_NOT_APPROVED_FOR_PUBLISH", "XX000"]]) {
    await refusal("late error " + state, `
      CREATE FUNCTION fixture_job_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION '${message}' USING ERRCODE='${state}'; END $$;
      CREATE TRIGGER fixture_after_job AFTER UPDATE ON background_jobs FOR EACH ROW EXECUTE FUNCTION fixture_job_failure()
    `, "APPROVE_AND_SCHEDULE_FAILED");
  }
  // Inject a returned refusal after the real transition has written its item and audit rows.
  await db.exec(`
    ALTER FUNCTION public.transition_staff_content_item(uuid,text,timestamptz) RENAME TO fixture_real_transition;
    CREATE FUNCTION public.transition_staff_content_item(uuid,text,timestamptz) RETURNS jsonb LANGUAGE plpgsql AS $$
    DECLARE result jsonb;
    BEGIN
      result := public.fixture_real_transition($1,$2,$3);
      IF $2=current_setting('fixture.action') THEN
        RETURN jsonb_build_object('success',false,'code',current_setting('fixture.refusal'),'detail','private fixture detail');
      END IF;
      RETURN result;
    END $$`);
  for (const action of ["approve", "schedule"]) {
    for (const code of ["NOT_FOUND", "INVALID_TRANSITION", "APPROVAL_REQUIRED", "INVALID_SCHEDULE_TIME", "SCHEDULE_TOO_FAR", "UNRECOGNISED"]) {
      await refusal(action + " returned " + code, `SET LOCAL fixture.action='${action}'; SET LOCAL fixture.refusal='${code}'`,
        code === "UNRECOGNISED" ? "APPROVE_AND_SCHEDULE_FAILED" : code);
    }
  }
});
