import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const view = await readFile(new URL("../src/google-drive-manager-view.tsx", import.meta.url), "utf8");
const archive = await readFile(new URL("../src/massive-archive-view.tsx", import.meta.url), "utf8");
const env = await readFile(new URL("../.env.example", import.meta.url), "utf8");

test("Drive manager uses browser-safe OAuth client configuration", () => {
  assert.match(view, /VITE_GOOGLE_DRIVE_CLIENT_ID/);
  assert.match(env, /VITE_GOOGLE_DRIVE_CLIENT_ID=/);
  assert.doesNotMatch(view, /client_secret|GOOGLE_CLIENT_SECRET|service_role/i);
});

test("Drive manager never persists the Google access token", () => {
  assert.doesNotMatch(view, /localStorage|sessionStorage/);
});

test("Drive manager exposes folder browsing and management operations", () => {
  assert.match(view, /in parents and trashed = false/);
  assert.match(view, /mimeType: FOLDER_MIME/);
  assert.match(view, /method: \"PATCH\"/);
  assert.match(view, /trashed: true/);
  assert.match(view, /uploadType=multipart/);
});

test("Archive route remains isolated through the existing lazy module", () => {
  assert.match(archive, /google-drive-manager-view/);
});

test("Drive links open with noopener protection", () => {
  assert.match(view, /target=\"_blank\" rel=\"noopener noreferrer\"/);
});
