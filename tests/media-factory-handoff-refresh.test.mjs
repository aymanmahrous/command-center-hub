import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/content-growth-hub.tsx", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");

test("refreshes a media handoff when navigating into an already-mounted content factory", () => {
  assert.match(source, /if \(activeTab !== "content"\) return;[\s\S]*?const handoff = readMediaFactoryHandoff\(\);[\s\S]*?setMediaFactoryHandoff\(handoff\);/);
  assert.match(source, /\}, \[activeTab\]\);/);
});

test("opens the content list when returning from the media library with a handoff", () => {
  assert.match(mainSource, /useState<ContentFactoryTab>\(\(\) => \{[\s\S]*?sessionStorage\.getItem\("media-factory-handoff"\) \? "content" : "overview"/);
});

test("keeps the existing explicit link action and review-safe confirmation", () => {
  assert.match(source, /link_staff_media_to_content_item/);
  assert.match(source, /result\.success !== true/);
  assert.match(source, /returned to review before any publish/);
});
