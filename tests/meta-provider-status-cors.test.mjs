import assert from "node:assert/strict";
import test from "node:test";
import { CORS_HEADERS, allowedOrigin, corsHeaders, preflightResponse } from "../supabase/functions/meta-provider-status/cors.ts";

test("Meta provider status preflight allows only the production hub origin and required POST headers", () => {
  const response = preflightResponse();
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://hub.relaxfixuae.com");
  assert.equal(response.headers.get("access-control-allow-methods"), "POST, OPTIONS");
  assert.equal(response.headers.get("access-control-allow-headers"), "authorization, apikey, content-type, x-client-info, x-supabase-api-version");
  assert.deepEqual(CORS_HEADERS, {
    "access-control-allow-origin": "https://hub.relaxfixuae.com",
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
    "access-control-allow-methods": "POST, OPTIONS",
  });
});

test("Meta provider status allows the current Vercel Preview origin without reflecting arbitrary origins", () => {
  const preview = "https://command-center-dwwqyphkk-swimmingayman-8492s-projects.vercel.app";
  assert.equal(allowedOrigin(preview), preview);
  assert.equal(preflightResponse(preview).headers.get("access-control-allow-origin"), preview);
  assert.equal(corsHeaders("https://evil.example")["access-control-allow-origin"], "https://hub.relaxfixuae.com");
});
