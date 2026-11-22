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

const postgres = { skip: engine ? false : "requires the local @electric-sql/pglite test engine" };

async function schedulingFixture(t) {
  const { PGlite } = require(engine);
  const db = new PGlite();
  t.after(() => db.close());
  const row = async (sql, params) => (await db.query(sql, params)).rows[0];
  async function isolated(run) {
    await db.exec("BEGIN");
    try { await run(); } finally { await db.exec("ROLLBACK"); }
  }
  async function invoke(time = due, postId = item) {
    await db.exec("SET LOCAL ROLE authenticated");
    const { result } = await row("SELECT public.approve_and_schedule_staff_content_item($1,$2) AS result", [postId, time]);
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
  return { db, row, isolated, invoke, snapshot, security };
}

test("scheduling success parity and atomic refusals in isolated PostgreSQL", postgres, async t => {
  const { db, isolated, invoke, snapshot, security } = await schedulingFixture(t);
  await db.exec(read("./fixtures/legacy-schedule-jobs.sql"));
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

const prepareJob = migration("20261122160000_prepare_publish_job_on_staff_schedule.sql");

test("staff scheduling changes only the owner RPC and limits execution to authenticated callers", () => {
  assert.match(prepareJob, /SECURITY DEFINER\s+SET search_path = public/i);
  assert.equal(prepareJob.match(/CREATE OR REPLACE FUNCTION/gi).length, 1);
  assert.doesNotMatch(prepareJob, /CREATE POLICY|ALTER TABLE|GRANT .* ON TABLE/i);
});

test("staff scheduling creates or reuses one job behind production-style RLS in isolated PostgreSQL", postgres, async t => {
  const { db, row, isolated, invoke, snapshot, security } = await schedulingFixture(t);
  await db.exec(candidate);
  await db.exec(prepareJob);
  await db.exec(`
    ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;
    CREATE UNIQUE INDEX background_jobs_active_publish_content_uidx
      ON public.background_jobs ((payload->>'contentItemId'))
      WHERE job_type='publish_content' AND status IN ('queued','processing','retrying');
    CREATE TABLE public.staff_profiles (id uuid PRIMARY KEY, active boolean, role text);
    INSERT INTO public.staff_profiles VALUES ('00000000-0000-4000-8000-000000000003',true,'content_manager');
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$
      SELECT current_setting('request.jwt.claim.role',true) $$;
    CREATE OR REPLACE FUNCTION public.is_active_staff(text[]) RETURNS boolean LANGUAGE sql AS $$
      SELECT EXISTS (SELECT 1 FROM public.staff_profiles WHERE id=auth.uid() AND active AND role=ANY($1)) $$;
    SET request.jwt.claim.sub='00000000-0000-4000-8000-000000000003';
    SET request.jwt.claim.role='authenticated';
    INSERT INTO public.background_jobs (job_type,status,payload)
      SELECT 'generate_content_media','queued',jsonb_build_object('contentItemId', id) FROM content_items;
  `);
  assert.equal((await security()).prosecdef, true);
  assert.deepEqual((await security()).proconfig, ["search_path=public"]);
  assert.deepEqual(await row("SELECT has_function_privilege('anon',$1,'execute') AS anon, has_function_privilege('authenticated',$1,'execute') AS staff", [signature]),
    { anon: false, staff: true });
  const seedJob = `INSERT INTO public.background_jobs(job_type,status,next_retry_at,payload)
    SELECT 'publish_content','queued',planned_for,jsonb_build_object('contentItemId',id,'preserve','old field') FROM content_items`;
  const browserIsBlind = async () => {
    await db.exec("SET LOCAL ROLE authenticated");
    assert.deepEqual(await row("SELECT current_user AS role, (SELECT count(*)::int FROM content_items) AS items, (SELECT count(*)::int FROM background_jobs) AS jobs"),
      { role: "authenticated", items: 0, jobs: 0 });
    await db.exec("RESET ROLE");
  };

  await t.test("retimes the existing queued Facebook job, preserving its ID and other payload fields", () => isolated(async () => {
    await db.exec("UPDATE content_items SET platform='facebook'");
    const { id } = await row(seedJob + " RETURNING id");
    await browserIsBlind();
    const scheduled = await invoke();
    assert.equal(scheduled.success, true);
    assert.equal(scheduled.publishJobId, id);
    const { jobs, audits } = await snapshot();
    const publishJobs = jobs.filter(j => j.job_type === "publish_content");
    assert.equal(publishJobs.length, 1);
    const [job] = publishJobs;
    assert.equal(Date.parse(job.next_retry_at), Date.parse(due));
    assert.equal(job.payload.preserve, "old field");
    assert.equal(job.payload.platform, "facebook");
    assert.ok(job.payload.pageId);
    assert.equal(job.payload.accountId, null);
    assert.equal(audits.length, 2);
  }));

  async function rejected(label, setup, code, time = due, postId = item) {
    await t.test(label, () => isolated(async () => {
      if (setup) await db.exec(setup);
      const before = await snapshot();
      assert.deepEqual(await invoke(time, postId), { success: false, code });
      assert.deepEqual(await snapshot(), before);
    }));
  }
  await rejected("anonymous identity", "SET LOCAL request.jwt.claim.sub=''", "STAFF_ACCESS_DENIED");
  await rejected("service claim cannot skip staff authorization", "SET LOCAL request.jwt.claim.role='service_role'", "STAFF_ACCESS_DENIED");
  await rejected("inactive staff", "UPDATE staff_profiles SET active=false", "STAFF_ACCESS_DENIED");
  await rejected("unprivileged staff role", "UPDATE staff_profiles SET role='viewer'", "STAFF_ACCESS_DENIED");
  await rejected("missing post", "", "NOT_FOUND", due, "00000000-0000-4000-8000-000000000099");
  await rejected("stale review", "UPDATE content_items SET status='cancelled'", "INVALID_TRANSITION");
  await rejected("unsupported platform", "UPDATE content_items SET platform='tiktok'", "PLATFORM_NOT_SUPPORTED");
  await rejected("whitespace cannot bypass the media trigger", "UPDATE content_items SET platform=' instagram ', media_asset_id=NULL", "PLATFORM_NOT_SUPPORTED");
  for (const invalid of [null, "2000-01-01T00:00:00Z", "infinity", "-infinity"]) {
    await rejected("invalid time " + invalid, "", "INVALID_SCHEDULE_TIME", invalid);
  }
  await rejected("no media", "UPDATE content_items SET media_asset_id=NULL", "MEDIA_ASSET_REQUIRED_FOR_PUBLISH");
  await rejected("missing media record", "DELETE FROM media_assets", "MEDIA_ASSET_MISSING_OR_UNLINKED");
  await rejected("unlinked media", "UPDATE media_assets SET content_item_id=NULL", "MEDIA_ASSET_MISSING_OR_UNLINKED");
  await rejected("unapproved media with pre-existing job", seedJob + "; UPDATE media_assets SET metadata='{}'", "MEDIA_NOT_APPROVED_FOR_PUBLISH");
  await rejected("pending consent", "UPDATE media_assets SET consent_status='pending'", "MEDIA_NOT_APPROVED_FOR_PUBLISH");
  await rejected("missing consent without documented exemption", "UPDATE media_assets SET consent_status=NULL", "MEDIA_NOT_APPROVED_FOR_PUBLISH");
  await t.test("documented absence of real people still permits scheduling", () => isolated(async () => {
    await db.exec(`UPDATE media_assets SET consent_status=NULL, metadata=metadata || '{"containsRealPerson":false,
      "consentApplicability":"not_applicable_no_real_person","personPresenceReviewedAt":"2026-11-22","personPresenceReviewedBy":"fixture"}'`);
    assert.equal((await invoke()).success, true);
  }));
  for (const state of ["processing", "retrying"]) {
    await rejected("existing " + state + " publish job", seedJob + `; UPDATE background_jobs SET status='${state}' WHERE job_type='publish_content'`, "INVALID_TRANSITION");
  }
  await rejected("published item", "UPDATE content_items SET published_at=now()", "INVALID_TRANSITION");
  await rejected("uncertain publication receipt", `INSERT INTO content_publication_receipts SELECT id,platform,'ambiguous' FROM content_items`, "INVALID_TRANSITION");
  await rejected("failure after the new job was written", `
    CREATE FUNCTION fixture_late_failure() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'private fixture detail'; END $$;
    CREATE TRIGGER fixture_after_job AFTER INSERT ON background_jobs FOR EACH ROW EXECUTE FUNCTION fixture_late_failure()
  `, "APPROVE_AND_SCHEDULE_FAILED");
  await rejected("job creation suppressed", `
    CREATE FUNCTION fixture_skip_job() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;
    CREATE TRIGGER fixture_before_job BEFORE INSERT ON background_jobs FOR EACH ROW EXECUTE FUNCTION fixture_skip_job()
  `, "SCHEDULE_PUBLISH_JOB_NOT_FOUND");

  await t.test("a second committed request returns the same job without touching any persisted row", async () => {
    const before = await snapshot();
    assert.deepEqual(before.jobs.map(j => j.job_type), ["generate_content_media"]);
    assert.ok(Date.parse(before.items[0].planned_for) < Date.now());
    await db.exec("BEGIN");
    await browserIsBlind();
    const first = await invoke();
    await db.exec("COMMIT");
    assert.equal(first.success, true);
    const saved = await snapshot();
    const job = saved.jobs.find(j => j.job_type === "publish_content");
    assert.ok(job && job.id === first.publishJobId);
    assert.deepEqual(saved.jobs.filter(j => j.id !== job.id), before.jobs);
    assert.equal(job.status, "queued");
    assert.equal(job.payload.platform, "instagram");
    assert.ok(job.payload.accountId);
    assert.equal(job.payload.pageId, null);
    assert.equal(job.payload.contentItemId, item);
    assert.equal(job.payload.idempotencyKey, item);
    assert.equal(job.payload.source, "staff_schedule");
    assert.equal(Date.parse(job.next_retry_at), Date.parse(due));
    assert.equal(saved.items[0].status, "scheduled");
    assert.equal(Date.parse(saved.items[0].scheduled_for), Date.parse(due));
    assert.equal(saved.audits.length, 2);
    await db.exec("BEGIN");
    const repeat = await invoke();
    await db.exec("COMMIT");
    assert.equal(repeat.success, true);
    assert.equal(repeat.publishJobId, first.publishJobId);
    assert.deepEqual(await snapshot(), saved);
  });
  await rejected("media approval was withdrawn between identical requests", "UPDATE media_assets SET metadata='{}'", "MEDIA_NOT_APPROVED_FOR_PUBLISH");
});
