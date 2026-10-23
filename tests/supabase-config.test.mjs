import assert from "node:assert/strict";
import test from "node:test";
import { browserSafeApiKey, isSupabaseBrowserConfigurationReady } from "../src/supabase-config.ts";

const validUrl = "https://project-ref.supabase.co";
const validPublishableKey = "sb_publishable_12345678901234567890";
const validStaffTable = "staff_profiles";

function legacyToken(role) {
  const payload = Buffer.from(JSON.stringify({ role })).toString("base64url");
  return `header.${payload}.signature`;
}

test("a complete HTTPS Supabase configuration with a publishable key is accepted", () => {
  assert.equal(isSupabaseBrowserConfigurationReady(validUrl, validPublishableKey, validStaffTable), true);
});

test("missing or malformed URL, key, or staff table fails closed", () => {
  for (const url of ["", "not a URL", "http://project-ref.supabase.co", "https://example.com", "https://project-ref.supabase.co.example.com"]) {
    assert.equal(isSupabaseBrowserConfigurationReady(url, validPublishableKey, validStaffTable), false, `accepted URL: ${url}`);
  }

  for (const key of ["", "not-a-key", "sb_secret_sensitive-looking-placeholder"]) {
    assert.equal(isSupabaseBrowserConfigurationReady(validUrl, key, validStaffTable), false, `accepted key: ${key}`);
  }

  assert.equal(isSupabaseBrowserConfigurationReady(validUrl, validPublishableKey, "  "), false);
});

test("only browser-safe publishable and legacy anon keys are accepted", () => {
  assert.equal(browserSafeApiKey(validPublishableKey), true);
  assert.equal(browserSafeApiKey(legacyToken("anon")), true);
  assert.equal(browserSafeApiKey(legacyToken("service_role")), false);
  assert.equal(browserSafeApiKey("sb_secret_sensitive-looking-placeholder"), false);
  assert.equal(browserSafeApiKey("malformed"), false);
});
