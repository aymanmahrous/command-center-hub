import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/command-center-launcher.ts', import.meta.url), 'utf8');

test('launcher maps all 11 legacy sections without DOM-order slicing', () => {
  const ids = [...source.matchAll(/\b(?:dashboard|inbox|crm|automations|content|planner|media|archive|analytics|integrations|radar)\b/g)];
  assert.ok(ids.length >= 11);
  assert.doesNotMatch(source, /querySelectorAll\('button'\)\)\.slice\(/);
  assert.match(source, /const ICON_CLASSES/);
  assert.match(source, /const TEXT_LABELS/);
});

test('launcher observes the legacy nav with an 80ms debounce and never observes document.body', () => {
  assert.match(source, /legacyObserver\.observe\(nav/);
  assert.match(source, /}, 80\)/);
  assert.match(source, /shellObserver\.observe\(shell/);
  assert.doesNotMatch(source, /bodyObserver/);
  assert.doesNotMatch(source, /observe\(document\.body/);
});

test('launcher has a remount-safe rebinding path', () => {
  assert.match(source, /scheduleRebind/);
  assert.match(source, /nav !== legacyNav/);
  assert.match(source, /legacyNav = null/);
  assert.match(source, /install\(nav\)/);
});

test('Coach Brain source links accept only http and https URLs', () => {
  assert.match(source, /function safeExternalUrl/);
  assert.match(source, /url\.protocol !== 'https:' && url\.protocol !== 'http:'/);
  assert.match(source, /const url = safeExternalUrl\(source\.url\)/);
});
