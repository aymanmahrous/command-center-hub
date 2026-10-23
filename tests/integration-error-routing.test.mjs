import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { metaOAuthErrorMessage } from "../src/meta-oauth-error-message.ts";

const source = await readFile(new URL("../src/integrations-center.tsx", import.meta.url), "utf8");

test("Facebook OAuth failures produce provider-specific notices in both languages", () => {
  assert.equal(metaOAuthErrorMessage("facebook", "AUTHORIZE_FAILED", "en"), "Facebook OAuth could not start (AUTHORIZE_FAILED). Check the Meta OAuth setup or try again later.");
  assert.equal(metaOAuthErrorMessage("facebook", "AUTHORIZE_FAILED", "ar"), "تعذر بدء ربط Facebook عبر Meta (AUTHORIZE_FAILED). تحقق من إعداد OAuth الخاص بـMeta أو أعد المحاولة لاحقًا.");
});

test("Instagram OAuth failures produce provider-specific notices in both languages", () => {
  assert.equal(metaOAuthErrorMessage("instagram", "EXTERNAL_TEST_FAILED", "en"), "Instagram OAuth could not start (EXTERNAL_TEST_FAILED). Check the Meta OAuth setup or try again later.");
  assert.equal(metaOAuthErrorMessage("instagram", "EXTERNAL_TEST_FAILED", "ar"), "تعذر بدء ربط Instagram عبر Meta (EXTERNAL_TEST_FAILED). تحقق من إعداد OAuth الخاص بـMeta أو أعد المحاولة لاحقًا.");
});

test("OAuth errors route to the matching provider and preserve Canva and Google Calendar handlers", () => {
  assert.match(source, /provider === "facebook" \|\| provider === "instagram"/);
  assert.match(source, /setNotice\(metaOAuthErrorMessage\(provider, code, language\)\)/);
  assert.match(source, /setNotice\(canvaConnectErrorMessage\(code, language\)\)/);
  assert.match(source, /provider === "google_calendar"[\s\S]*?googleCalendarConnectErrorMessage\(code\)/);
});
