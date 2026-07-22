import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");
const gitignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");

test("environment example contains the browser-safe configuration contract", () => {
  assert.match(envExample, /^VITE_SUPABASE_URL=/m);
  assert.match(envExample, /^VITE_SUPABASE_ANON_KEY=/m);
  assert.match(envExample, /^VITE_STAFF_PROFILE_TABLE=/m);
});

test("local environment files and generated output are ignored", () => {
  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^\.env\.\*$/m);
  assert.match(gitignore, /^dist\/$/m);
});

test("application is excluded from search indexing", () => {
  assert.match(html, /noindex,nofollow,noarchive/);
});

test("staff authorization requires an active profile", () => {
  assert.match(app, /active: z\.literal\(true\)/);
  assert.match(app, /STAFF_ACCESS_DENIED/);
});

test("staff profile lookup matches the production primary-key contract", () => {
  assert.match(app, /\?id=eq\.\$\{encodeURIComponent\(auth\.user\.id\)\}/);
  assert.doesNotMatch(app, /\?user_id=eq\./);
  assert.match(envExample, /primary key `id`/);
});

test("password is not persisted", () => {
  assert.doesNotMatch(app, /setItem\([^\n]*password/i);
  assert.match(app, /sessionStorage/);
});

test("booking writes use the approved RPC and never direct table mutation", () => {
  assert.match(app, /update_booking_request_status/);
  assert.match(app, /p_booking_request_id/);
  assert.match(app, /p_status/);
  assert.doesNotMatch(app, /\/rest\/v1\/booking_requests[^\n]*(PATCH|PUT|DELETE)/i);
});

test("booking writes are role-gated and require explicit confirmation", () => {
  assert.match(app, /\["super_admin", "admin", "reception"\]\.includes\(session\.role\)/);
  assert.match(app, /window\.confirm/);
  assert.match(app, /Audit Log/);
});

test("booking operations prevent duplicate writes and handle expired sessions", () => {
  assert.match(app, /if \(!canWrite \|\| busyId \|\| booking\.status === next\) return/);
  assert.match(app, /disabled=\{!canWrite \|\| busyId !== null\}/);
  assert.match(app, /code === "SESSION_EXPIRED"/);
  assert.match(app, /onSessionExpired/);
});

test("booking operations expose full read-only context and client-side filters", () => {
  for (const field of ["other_location", "swam_before", "fear_of_water", "updated_at"]) assert.match(app, new RegExp(field));
  assert.match(app, /booking-search/);
  assert.match(app, /statusFilter/);
  assert.match(app, /filteredBookings/);
});

test("booking status is constrained to the server-supported allowlist", () => {
  for (const status of ["pending", "contacted", "confirmed", "declined", "cancelled"]) assert.match(app, new RegExp(`"${status}"`));
  assert.doesNotMatch(app, /service_role/i);
});

test("AI Inbox reads messages and changes mode only through approved RPCs", () => {
  assert.match(app, /get_staff_conversation_messages/);
  assert.match(app, /set_staff_conversation_mode/);
  assert.match(app, /p_conversation_id/);
  assert.match(app, /p_mode/);
  assert.doesNotMatch(app, /\/rest\/v1\/(conversations|messages)[^\n]*(PATCH|PUT|DELETE)/i);
});

test("AI Inbox mode writes are role-gated, confirmed, and duplicate-safe", () => {
  assert.match(app, /\["super_admin", "admin", "reception", "coach"\]\.includes\(session\.role\)/);
  assert.match(app, /if \(!canWrite \|\| busyId \|\| conversation\.mode === next\) return/);
  assert.match(app, /تأكيد تغيير وضع محادثة/);
  assert.match(app, /Audit Log/);
});

test("AI Inbox supports the complete server mode allowlist", () => {
  for (const mode of ["ai_active", "human_required", "human_takeover", "paused"]) assert.match(app, new RegExp(`"${mode}"`));
});

test("Content Studio reads and writes only through approved RPCs", () => {
  for (const rpc of ["get_staff_content_items", "update_staff_content_item", "transition_staff_content_item"]) assert.match(app, new RegExp(rpc));
  for (const parameter of ["p_content_item_id", "p_topic", "p_hook", "p_caption", "p_cta", "p_hashtags", "p_visual_prompt", "p_action", "p_scheduled_for"]) assert.match(app, new RegExp(parameter));
  assert.doesNotMatch(app, /\/rest\/v1\/(content_items|background_jobs|audit_logs)[^\n]*(PATCH|PUT|DELETE|POST)/i);
});

test("Content Studio mutations are role-gated, confirmed, audited, and duplicate-safe", () => {
  assert.match(app, /\["super_admin", "admin", "content_manager"\]\.includes\(session\.role\)/);
  assert.match(app, /if \(!canWrite \|\| busyId\) return/);
  assert.match(app, /disabled=\{!canWrite \|\| busyId !== null/);
  assert.match(app, /تأكيد حفظ تعديلات/);
  assert.match(app, /تأكيد «\$\{contentActionLabels\[action\]\}»/);
  assert.match(app, /Audit Log/);
  assert.match(app, /SESSION_EXPIRED/);
});

test("Content Studio honors server status and action allowlists", () => {
  for (const status of ["idea", "draft", "generated", "needs_review", "approved", "scheduled", "published", "failed"]) assert.match(app, new RegExp(`"${status}"`));
  for (const action of ["approve", "return_to_review", "schedule", "unschedule"]) assert.match(app, new RegExp(`"${action}"`));
  assert.match(app, /PUBLISHED_CONTENT_IMMUTABLE/);
  assert.match(app, /APPROVAL_REQUIRED/);
});

test("Media Library uses the staff RPC and exposes no storage or table mutation", () => {
  assert.match(app, /get_staff_media_assets/);
  assert.match(app, /active === "media" \? <MediaLibraryView/);
  assert.doesNotMatch(app, /\/storage\/v1\//i);
  assert.doesNotMatch(app, /create_staff_media_asset_record|create_staff_video_generation_job|update_staff_video_generation_job/);
  assert.doesNotMatch(app, /\/rest\/v1\/media_assets[^\n]*(PATCH|PUT|DELETE|POST)/i);
});

test("Media Library validates ownership-shaped records and remains private read-only", () => {
  for (const field of ["createdBy", "contentItemId", "assetType", "source", "storagePath", "providerJobId", "metadata", "createdAt"]) assert.match(app, new RegExp(field));
  for (const type of ["image", "video", "logo", "other"]) assert.match(app, new RegExp(`"${type}"`));
  for (const source of ["upload", "ai_generated", "external"]) assert.match(app, new RegExp(`"${source}"`));
  assert.match(app, /مكتبة وسائط خاصة للقراءة فقط/);
  assert.match(app, /معاينة خاصة غير مكشوفة/);
  assert.match(app, /typeFilter/);
  assert.match(app, /sourceFilter/);
});

test("deployment configuration fails closed and never embeds a live Supabase project", () => {
  assert.match(app, /VITE_SUPABASE_URL \?\? ""/);
  assert.match(app, /VITE_SUPABASE_ANON_KEY \?\? ""/);
  assert.match(app, /CONFIGURATION_REQUIRED/);
  assert.doesNotMatch(app, /nmzxrjdxvmmzzmajrskm/);
  assert.doesNotMatch(app, /sb_publishable_/);
});
