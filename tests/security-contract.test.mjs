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

test("booking status is constrained to the server-supported allowlist", () => {
  for (const status of ["pending", "contacted", "confirmed", "declined", "cancelled"]) assert.match(app, new RegExp(`"${status}"`));
  assert.doesNotMatch(app, /service_role/i);
});
