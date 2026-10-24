import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assessCanvaReadiness,
  formatCanvaDiagnosticDetails,
  resolveDesignProvider,
} from "../src/canva-readiness.ts";

const panel = await readFile(new URL("../src/content-batch-review-panel.tsx", import.meta.url), "utf8");

const connectedNotReady = {
  ready: false,
  integrationStatus: "NOT READY",
  credentialsConfigured: true,
  canvaConnected: true,
  brandTemplateConfigured: true,
  brandTemplateCount: 1,
  missingScopes: [],
  templateImageFieldCount: 0,
  templateTextFieldCount: 3,
  templateImageAutofillReady: false,
  detail: "The selected Canva template has text fields but no image field.",
  nextAction: "Create/publish a Brand Template with an image autofill field.",
};

test("Canva can be connected while design readiness is limited, with its real safe detail preserved", () => {
  const result = assessCanvaReadiness("connected", connectedNotReady);
  assert.equal(result.integrationConnected, true);
  assert.equal(result.providerConnected, true);
  assert.equal(result.ready, false);
  assert.equal(result.capabilityState, "LIMITED");
  assert.equal(result.readinessState, "CONNECTED_NOT_READY");
  assert.equal(result.connectionLabel, "Connected");
  assert.match(result.detail, /no image field/);
});

test("Canva becomes available only when the status endpoint explicitly reports READY", () => {
  const result = assessCanvaReadiness("connected", {
    ready: true,
    integrationStatus: "READY",
    canvaConnected: true,
    detail: "Canva is connected and the selected template supports image autofill.",
  });
  assert.equal(result.capabilityState, "AVAILABLE");
  assert.equal(result.readinessState, "READY");
  assert.equal(result.ready, true);
});

test("failed readiness checks remain distinct from an unconfigured integration", () => {
  const failed = assessCanvaReadiness("connected", {
    ready: false,
    statusCheckFailed: true,
    canvaConnected: true,
    detail: "Canva status could not be verified.",
  });
  assert.equal(failed.capabilityState, "BLOCKED");
  assert.equal(failed.readinessState, "CHECK_FAILED");
  assert.equal(failed.connectionLabel, "Connection check failed");

  const disconnected = assessCanvaReadiness("disconnected", null);
  assert.equal(disconnected.capabilityState, "NOT_CONFIGURED");
  assert.equal(disconnected.readinessState, "NOT_CONNECTED");
});

test("safe Canva diagnostics retain credential, scope, and Brand Template readiness facts", () => {
  const details = formatCanvaDiagnosticDetails(connectedNotReady).join(" | ");
  assert.match(details, /Server credentials: configured/);
  assert.match(details, /Canva API connection: connected/);
  assert.match(details, /Brand Template configured: yes/);
  assert.match(details, /Configured Brand Templates: 1/);
  assert.match(details, /Required Canva permissions: present/);
  assert.match(details, /Brand Template image autofill fields: 0/);
  assert.match(details, /Brand Template text autofill fields: 3/);
  assert.match(details, /Brand Template image autofill: not ready/);
  assert.match(details, /Server next action: Create\/publish a Brand Template/);
  assert.doesNotMatch(details, /token|secret|password/i);
});

test("automatic image routing never falls back to billable Gemini when Canva is not ready", () => {
  assert.equal(resolveDesignProvider("auto", false, false, false), "manual");
  assert.equal(resolveDesignProvider("auto", false, false, true), "manual");
  assert.equal(resolveDesignProvider("auto", false, true, false), "canva");
  assert.equal(resolveDesignProvider("auto", true, false, false), "capcut");
});

test("Gemini remains available only as an explicit provider choice in the routing policy", () => {
  assert.equal(resolveDesignProvider("gemini", false, false, false), "gemini");
  assert.match(panel, /resolveDesignProvider\(requestedProvider/);
  assert.match(panel, /if \(provider === "gemini"\)/);
  assert.match(panel, /window\.confirm\(language === "ar"/);
  assert.match(panel, /estimateGeminiImageGeneration\(session\)/);
  assert.match(panel, /generateGeminiImageForContentItem\(session, item\)/);
});
