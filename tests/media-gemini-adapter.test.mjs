import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const adapter = await readFile(new URL("../src/media-gemini-adapter.ts", import.meta.url), "utf8");

test("gemini adapter stays server-side and NOT CONNECTED by default", () => {
  assert.match(adapter, /NOT CONNECTED/);
  assert.match(adapter, /server-side credentials/);
  assert.match(adapter, /analyzeMediaWithProvider/);
  assert.doesNotMatch(adapter, /VITE_GEMINI|apiKey|API_KEY/i);
});
