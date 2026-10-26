import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createMediaFactoryHandoff, parseMediaFactoryHandoff } from "../src/media-factory-handoff.ts";
import { resolveMediaAssetName } from "../src/media-types.ts";

const controls = await readFile(new URL("../src/media-library-controls.tsx", import.meta.url), "utf8");
const factory = await readFile(new URL("../src/content-growth-hub.tsx", import.meta.url), "utf8");

test("Media Library resolves a stable display name from metadata or private storage path", () => {
  assert.equal(resolveMediaAssetName({ metadata: { file_name: "pool-side.jpg" }, storagePath: "staff/1/other.jpg" }), "pool-side.jpg");
  assert.equal(resolveMediaAssetName({ metadata: {}, storagePath: "staff/1/final-poster.png" }), "final-poster.png");
  assert.equal(resolveMediaAssetName({ metadata: {}, storagePath: null }), "Media asset");
});

test("Media Factory handoff survives assets without a public web URL", () => {
  const handoff = createMediaFactoryHandoff({
    id: "f3ca53ad-5817-4cef-8ca3-3bde56af6d17",
    assetType: "image",
    source: "upload",
    storagePath: "staff/1/pool-side.jpg",
    category: "swimming_business",
    mediaStatus: "approved",
    aiAnalysisStatus: "completed",
    publishabilityStatus: "ready_for_review",
    consentStatus: "consent_confirmed",
    suggestedPlatforms: [],
    suggestedFormats: [],
    aiNotes: "",
    metadata: { file_name: "pool-side.jpg", mime_type: "image/jpeg" },
    contentItemId: null,
    createdAt: "2026-10-26T00:00:00.000Z",
    updatedAt: null,
  }, "2026-10-26T00:00:01.000Z");

  const restored = parseMediaFactoryHandoff(JSON.stringify(handoff));
  assert.equal(restored?.asset.id, "f3ca53ad-5817-4cef-8ca3-3bde56af6d17");
  assert.equal(restored?.asset.name, "pool-side.jpg");
  assert.equal(restored?.asset.webUrl, null);
  assert.equal(restored?.asset.mimeType, "image/jpeg");
});

test("Media Library wires the resolved handoff into session storage and renders external links only when available", () => {
  assert.match(controls, /name:\s*resolveMediaAssetName\(row\)/);
  assert.match(controls, /sessionStorage\.setItem\(MEDIA_FACTORY_HANDOFF_KEY,\s*JSON\.stringify\(createMediaFactoryHandoff\(asset\)\)\)/);
  assert.match(factory, /parseMediaFactoryHandoff\(sessionStorage\.getItem\(MEDIA_FACTORY_HANDOFF_KEY\)\)/);
  assert.match(factory, /mediaFactoryHandoff\.asset\.webUrl\s*&&\s*<a/);
  assert.match(factory, /<\/div>}\s*\{mediaLinkNotice\s*&&\s*<div className="notice-box" role="status" aria-live="polite">/);
});
