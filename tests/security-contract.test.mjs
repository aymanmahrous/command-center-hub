import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const envExample = await readFile(new URL("../.env.example", import.meta.url), "utf8");
const gitignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");

test("environment example never contains a service-role secret", () => {
  assert.doesNotMatch(envExample, /service[_-]?role/i);
  assert.match(envExample, /VITE_SUPABASE_ANON_KEY/);
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

test("password is not persisted", () => {
  assert.doesNotMatch(app, /setItem\([^\n]*password/i);
  assert.match(app, /sessionStorage/);
});
