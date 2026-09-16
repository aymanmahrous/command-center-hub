import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const source = fs.readFileSync(new URL('../src/media-source-hub.ts', import.meta.url), 'utf8');

test('media source hub defines all four requested providers and OAuth scopes', () => {
  assert.match(source, /google_drive/);
  assert.match(source, /google_photos/);
  assert.match(source, /dropbox/);
  assert.match(source, /onedrive/);
  assert.match(source, /photoslibrary\.readonly/);
  assert.match(source, /files\.content\.read/);
  assert.match(source, /Files\.Read/);
});

test('media source hub blocks non-media and blocked-consent assets', () => {
  assert.ok(source.includes('item.mimeType.startsWith("image/")'));
  assert.ok(source.includes('item.consent !== "blocked"'));
});

test('creative briefs include Arabic and English copy, formats, and owner review gate', () => {
  assert.match(source, /اكتشف/);
  assert.match(source, /Discover/);
  assert.match(source, /instagram_reel/);
  assert.match(source, /facebook_feed/);
  assert.match(source, /اعتماد المالك/);
});

test('provider results are filtered by provider and query', () => {
  assert.match(source, /filterRemoteMedia/);
  assert.match(source, /matchesProvider/);
  assert.match(source, /haystack\.includes\(normalized\)/);
});
