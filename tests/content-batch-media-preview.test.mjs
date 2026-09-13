import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const preview = await readFile(new URL("../src/content-batch-media-preview.tsx", import.meta.url), "utf8");
const panel = await readFile(new URL("../src/content-batch-review-panel.tsx", import.meta.url), "utf8");
const hub = await readFile(new URL("../src/content-growth-hub.tsx", import.meta.url), "utf8");

test("batch review panel renders design preview block", () => {
  assert.match(panel, /ContentBatchMediaPreview/);
  assert.match(panel, /mediaAssets/);
  assert.match(preview, /parseCanvaBrief/);
  assert.match(preview, /content-batch-design-image/);
});

test("content growth hub loads media assets for batch preview", () => {
  assert.match(hub, /get_staff_media_assets/);
  assert.match(hub, /mediaAssets=\{mediaAssets\}/);
});
