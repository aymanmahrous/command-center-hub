import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const studio = await readFile(new URL("../src/branded-poster-studio.tsx", import.meta.url), "utf8");
const panel = await readFile(new URL("../src/content-batch-review-panel.tsx", import.meta.url), "utf8");

test("poster creation saves to the media library and links the resulting asset to its draft", () => {
  assert.match(studio, /onSaveDesign\?: \(file: File\) => Promise<void>/);
  assert.match(studio, /new File\(\[blob\], fileName, \{ type: "image\/png" \}\)/);
  assert.match(studio, /Save, link & download PNG/);
  assert.match(studio, /Design headline/);
  assert.match(studio, /Key points \(one per line\)/);
  assert.match(studio, /value=\{ratio\} onChange=\{\(event\) => setRatio/);
  assert.match(studio, /ratio === "4:5" \? 1350/);
  assert.match(panel, /onSaveDesign=\{session && canWrite \? \(file\) => handleUploadMedia\(item, file\) : undefined\}/);
  assert.match(panel, /register_staff_media_upload/);
  assert.match(panel, /await linkMediaToItem\(item\.id, newAssetId\)/);
});
