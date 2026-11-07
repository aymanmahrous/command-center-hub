import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(new URL("../supabase/migrations/20260920120000_safe_staff_job_commands.sql", import.meta.url), "utf8");
const app = await readFile(new URL("../src/operations-queue-view.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../src/integrations.css", import.meta.url), "utf8");
const reviewPanel = await readFile(new URL("../src/content-batch-review-panel.tsx", import.meta.url), "utf8");

 test("safe job commands are audited and never delete rows", () => {
  assert.match(migration, /retry_staff_publish_job/);
  assert.match(migration, /cancel_staff_background_job/);
  assert.match(migration, /background_job_retried/);
  assert.match(migration, /background_job_cancelled/);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.background_jobs/i);
});

test("retry refuses ambiguous or active publish states", () => {
  assert.match(migration, /PUBLISH_RECEIPT_REQUIRES_MANUAL_CHECK/);
  assert.match(migration, /ACTIVE_JOB_ALREADY_EXISTS/);
  assert.match(migration, /PLANNED_FOR_NOT_FUTURE/);
});

test("operations UI keeps publish jobs view-only while publishing is frozen", () => {
  assert.doesNotMatch(app, /Safe retry|retry_staff_publish_job/);
  assert.match(app, /Cancel job/);
  assert.match(app, /cancel_staff_background_job/);
  assert.match(app, /job\.jobType === "publish_content"/);
  assert.match(app, /job\.jobType !== "publish_content"/);
  assert.match(app, /publishing is frozen/i);
  assert.doesNotMatch(app, /\["failed", "dead"\]\.includes\(job\.status\)/);
});


test("overdue follow-up filter includes both queued and retrying overdue items and excludes background jobs", () => {
  assert.match(app, /const \[overdueOnly, setOverdueOnly\] = useState\(false\)/);
  assert.match(app, /\(!overdueOnly \|\| \(\["queued", "retrying"\]\.includes\(job\.status\) && isPast\(job\.scheduledFor, now\)\)\)/);
  assert.match(app, /const backgroundJobs = overdueOnly\s*\? \[\]/);
  assert.match(app, /setOverdueOnly\(\(current\) => !current\)/);
  assert.match(app, /operations-columns is-filtered/);
  assert.match(css, /\.operations-columns\.is-filtered\s*\{\s*grid-template-columns: 1fr;/);
});


test("owner publishing freeze blocks direct send from Content Factory while preserving review", () => {
  assert.match(reviewPanel, /const PUBLISHING_FROZEN = true/);
  assert.match(reviewPanel, /if \(PUBLISHING_FROZEN\)/);
  assert.match(reviewPanel, /Publishing is frozen by owner authorization/);
  assert.match(reviewPanel, /النشر مجمّد بتفويض المالك/);
  assert.match(reviewPanel, /Review and preparation remain available; sending is disabled/);
});
