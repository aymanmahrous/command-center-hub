import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

const view = fs.readFileSync(new URL("../src/control-tower-v2.tsx", import.meta.url), "utf8");
const style = fs.readFileSync(new URL("../src/v2-command-center.css", import.meta.url), "utf8");
const strategy = fs.readFileSync(new URL("../src/content-strategy.ts", import.meta.url), "utf8");
const poster = fs.readFileSync(new URL("../src/branded-poster-studio.tsx", import.meta.url), "utf8");

test("ControlTowerV2 uses the approved academy identity and current Al Mushrif location", () => {
  assert.match(view, /RELAX FIX SWIMMING ACADEMY · ABU DHABI/);
  assert.match(view, /مركز قيادة أكاديمية ريلاكس فيكس للسباحة/);
  assert.match(view, /Relax Fix Swimming Academy — Command Center/);
  assert.match(view, /058 821 9130/);
  assert.match(view, /055 137 8660/);
  assert.match(view, /Al Mushrif · Abu Dhabi/);
  assert.doesNotMatch(view, /Al Falah, Khalifa City, Al Danah/);
  assert.doesNotMatch(view, /Coach Ayman Cockpit|مقصورة كابتن أيمن/);
});

test("ControlTowerV2 exposes honest channel navigation shortcuts without fake hardcoded states", () => {
  assert.match(view, /v2-cockpit-channels/);
  assert.match(view, /WhatsApp Business/);
  assert.match(view, /Instagram & Facebook/);
  assert.match(view, /Canva Smart Brief/);
  assert.match(view, /Coach Brain/);
  assert.match(view, /Publishing requires your explicit approval/);
  assert.match(view, /AI requests may use provider quota/);
  assert.match(view, /النشر يحتاج موافقتك الصريحة/);
  assert.match(view, /Open shared inbox/);
  assert.match(view, /Check status/);
  assert.match(view, /Prepare a design brief/);
  assert.match(view, /Manual workflow/);
  assert.match(view, /Research & planning assistant/);
  assert.doesNotMatch(view, /Incoming inbox ready|Poster Studio ready|Secured & Privacy-safe/);
});

test("Coach Brain strategy and poster use canonical academy facts", () => {
  assert.match(strategy, /name: "Relax Fix Swimming Academy"/);
  assert.match(strategy, /locations: \["Al Mushrif · Abu Dhabi"\]/);
  assert.match(strategy, /whatsapp: "\\+971 58 821 9130"/);
  assert.match(strategy, /if \(\/relax fix/);
  assert.match(poster, /import \{ BRAND \} from "\.\/content-strategy"/);
  assert.match(poster, /BRAND\.locations\.join/);
  assert.match(poster, /BRAND\.whatsapp/);
  assert.doesNotMatch(poster, /Al Falah|Khalifa City|Al Danah|Coach Ayman|058 821 9130/);
});

test("CSS includes responsive styles for Coach Cockpit banner and badges", () => {
  assert.match(style, /\.v2-coach-cockpit-banner/);
  assert.match(style, /\.v2-cockpit-header/);
  assert.match(style, /\.v2-cockpit-channels/);
  assert.match(style, /\.v2-channel-item/);
});
