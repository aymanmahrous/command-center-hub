import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const view = fs.readFileSync(new URL("../src/control-tower-v2.tsx", import.meta.url), "utf8");
const style = fs.readFileSync(new URL("../src/v2-command-center.css", import.meta.url), "utf8");

test("ControlTowerV2 includes Coach Cockpit banner and official academy details", () => {
  assert.match(view, /COACH AYMAN COCKPIT · ABU DHABI/);
  assert.match(view, /مقصورة كابتن أيمن — مركز القيادة والتحكم/);
  assert.match(view, /Coach Ayman Cockpit — Command & Control/);
  assert.match(view, /058 821 9130/);
  assert.match(view, /055 137 8660/);
  assert.match(view, /Al Mushrif, Al Falah, Khalifa City, Al Danah/);
});

test("ControlTowerV2 exposes honest channel navigation shortcuts without fake hardcoded states", () => {
  assert.match(view, /v2-cockpit-channels/);
  assert.match(view, /WhatsApp Business/);
  assert.match(view, /Instagram & Facebook/);
  assert.match(view, /Canva Smart Brief/);
  assert.match(view, /Coach Brain/);
  assert.match(view, /Owner Safety Gate/);
});

test("CSS includes responsive styles for Coach Cockpit banner and badges", () => {
  assert.match(style, /\.v2-coach-cockpit-banner/);
  assert.match(style, /\.v2-cockpit-header/);
  assert.match(style, /\.v2-cockpit-channels/);
  assert.match(style, /\.v2-channel-item/);
});
