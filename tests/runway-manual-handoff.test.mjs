import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/content-batch-review-panel.tsx", import.meta.url), "utf8");

test("Runway manual handoff retains the complete duration-specific prompt when clipboard access fails", () => {
  assert.match(source, /manualRunwayPrompt, setManualRunwayPrompt/);
  assert.match(source, /FINAL OUTPUT REQUIREMENT: Create one vertical 9:16 video with an exact target duration of \$\{manualVideoDuration\} seconds/);
  assert.match(source, /if \(target === "runway"\) setManualRunwayPrompt\(\{ itemId: item\.id, text: prompt \}\)/);
  assert.match(source, /value=\{manualRunwayPrompt\.text\}/);
  assert.match(source, /readOnly rows=\{6\}/);
  assert.match(source, /onFocus=\{\(event\) => event\.currentTarget\.select\(\)\}/);
  assert.match(source, /copyManualRunwayPrompt/);
});

test("Runway manual handoff opens the existing account without requiring an API connection", () => {
  assert.match(source, /runway: "https:\/\/app\.runwayml\.com\//);
  assert.match(source, /Runway — فتح يدوي/);
  assert.match(source, /Opens your account and copies the prompt; no API connection required/);
});
