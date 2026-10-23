import assert from "node:assert/strict";
import test from "node:test";
import { CORS_HEADERS, preflightResponse } from "../supabase/functions/meta-provider-status/cors.ts";

test("Meta provider status preflight allows only the production hub origin and required POST headers", () => {
  const response = preflightResponse();
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://hub.relaxfixuae.com");
  assert.equal(response.headers.get("access-control-allow-methods"), "POST, OPTIONS");
  assert.equal(response.headers.get("access-control-allow-headers"), "authorization, apikey, content-type");
  assert.deepEqual(CORS_HEADERS, {
    "access-control-allow-origin": "https://hub.relaxfixuae.com",
    "access-control-allow-headers": "authorization, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
  });
});
