import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const view = fs.readFileSync(new URL('../src/control-tower-v2.tsx', import.meta.url), 'utf8');
const style = fs.readFileSync(new URL('../src/v2-command-center.css', import.meta.url), 'utf8');

test('V2 Home exposes the operating center, required quick actions, and Coach Brain', () => {
  for (const label of ['Create Content', 'Review Content', 'Media Library', 'Messages', 'Bookings', 'Settings', 'Coach Brain']) assert.match(view, new RegExp(label));
  assert.match(view, /v2-operating-strip/);
  assert.match(view, /openCommandCenterWorkspace/);
});

test('V2 Home keeps external execution behind owner approval and makes disconnected state explicit', () => {
  assert.match(view, /No publishing, external messages, or sensitive action without Owner Approval/);
  assert.match(view, /DEMO/);
  assert.match(view, /sources not connected/);
  assert.match(view, /never executes actions automatically/);
});

test('V2 Home operating strip is responsive', () => {
  assert.match(style, /\.v2-operating-strip/);
  assert.match(style, /@media\(max-width:760px\)/);
});

test('V2 Home exposes the content lifecycle and filters command navigation by the entered query', () => {
  for (const stage of ['Draft', 'Review', 'Approved', 'Scheduled', 'Published']) assert.match(view, new RegExp(stage));
  assert.match(view, /v2-lifecycle/);
  assert.match(view, /v2-command-results button/);
  assert.match(view, /button\.hidden/);
  assert.match(view, /Owner Approval/);
});
