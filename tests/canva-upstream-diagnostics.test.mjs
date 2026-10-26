import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canvaFailureDiagnostic, sanitizeCanvaEndpoint } from "../supabase/functions/canva-design/diagnostics.ts";

const source = readFileSync(new URL("../supabase/functions/canva-design/index.ts", import.meta.url), "utf8");

test("Canva endpoint sanitization removes dynamic resource IDs", () => {
  assert.equal(sanitizeCanvaEndpoint("/brand-templates/template-secret-123/dataset"), "/brand-templates/:id/dataset");
  assert.equal(sanitizeCanvaEndpoint("/asset-uploads/job-secret-456"), "/asset-uploads/:id");
  assert.equal(sanitizeCanvaEndpoint("/autofills"), "/autofills");
  assert.equal(sanitizeCanvaEndpoint("/unknown/resource-secret"), "unclassified");
  assert.equal(sanitizeCanvaEndpoint("/exports/export-secret-789?access_token=query-secret"), "/exports/:id");
});

test("Canva diagnostics contain only the approved endpoint, status, and request ID", () => {
  const response = new Response(JSON.stringify({ access_token: "secret-payload" }), {
    status: 502,
    headers: { "x-canva-request-id": "request-123" },
  });
  assert.deepEqual(canvaFailureDiagnostic("/exports/export-secret-789", response), {
    endpoint: "/exports/:id",
    status: 502,
    requestId: "request-123",
  });
});

test("direct Canva asset upload failures use the sanitized diagnostic helper", () => {
  assert.match(source, /canvaFailureDiagnostic\("\/asset-uploads", uploadResponse\)/);
  assert.doesNotMatch(source, /console\.warn\([^\n]+uploadPayload/i);
});

test("Canva job failures log only fixed stage and error codes", () => {
  assert.match(source, /logCanvaStageFailure\("dataset", ok \? "DATASET_MISSING" : "UPSTREAM_REQUEST_FAILED"\)/);
  assert.match(source, /logCanvaStageFailure\("autofill", "JOB_FAILED"\)/);
  assert.match(source, /logCanvaStageFailure\("export", "JOB_FAILED"\)/);
  assert.match(source, /logCanvaStageFailure\("asset_upload", "JOB_FAILED"\)/);
  assert.match(source, /\[canva-design\] stage failed/);
  assert.doesNotMatch(source, /console\.warn\([^\n]*(?:payload|topic|caption|accessToken|refresh_token)/i);
});
