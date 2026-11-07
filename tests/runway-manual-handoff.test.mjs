import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../src/content-batch-review-panel.tsx", import.meta.url), "utf8");

test("Runway manual handoff retains the complete duration-specific prompt when clipboard access fails", () => {
  assert.match(source, /const itemDesignPrompt = itemBaseDesignPrompt/);
  assert.match(source, /FINAL OUTPUT REQUIREMENT: Create one vertical 9:16 video with an exact target duration of \$\{manualVideoDuration\} seconds/);
  assert.match(source, /Complete Runway video prompt/);
  assert.match(source, /value=\{itemDesignPrompt\}/);
  assert.match(source, /FINAL OUTPUT REQUIREMENT: Create one vertical 9:16 video with an exact target duration of \$\{manualVideoDuration\} seconds/);
  assert.match(source, /onFocus=\{\(event\) => event\.currentTarget\.select\(\)\}/);
  assert.match(source, /Automatic copy is unavailable\. Focus the prompt box, select all, and copy manually\./);
});

test("Runway manual handoff opens the existing account without requiring an API connection", () => {
  assert.match(source, /runway: "https:\/\/app\.runwayml\.com\//);
  assert.match(source, /Runway — فتح يدوي/);
  assert.match(source, /Opens your account and copies the prompt; no API connection required/);
});
