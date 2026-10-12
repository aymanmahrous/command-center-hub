import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/content-growth-hub.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/content-growth-hub.css", import.meta.url), "utf8");
const shellStyles = readFileSync(new URL("../src/v2-command-center.css", import.meta.url), "utf8");

test("factory does not auto-scroll when its active tab changes during mount or data loading", () => {
  assert.doesNotMatch(
    source,
    /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)\);\s*\}, \[activeFactoryTab\]\);/,
  );
  assert.match(source, /function selectFactoryTab\(tab: typeof activeFactoryTab\)/);
});

test("factory scrolling is explicitly tied to a user tab selection", () => {
  assert.match(source, /function selectFactoryTab\(tab: typeof activeFactoryTab\)[\s\S]*?scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
  assert.match(source, /onClick=\{\(\) => selectFactoryTab\(id\)\}/);
});

test("factory navigation scrolls to real control-room and content targets", () => {
  assert.match(source, /id="content-control-room" className="factory-control-room"/);
  assert.match(source, /const targetId = tab === "content" \? "content-control-room"/);
  assert.match(styles, /\.factory-control-room\[id\][\s\S]*?scroll-margin-top:\s*104px;/);
  assert.match(styles, /@media \(max-width: 1100px\)[\s\S]*?\.factory-control-room\[id\][\s\S]*?scroll-margin-top:\s*148px;/);
  assert.doesNotMatch(styles, /\.content-section-nav/);
});

test("desktop owner navigation stays content-sized", () => {
  assert.match(shellStyles, /\.app-shell>aside\{position:sticky;top:14px;height:auto;max-height:none\}/);
  assert.match(shellStyles, /\.app-shell > aside \{[\s\S]*?height: auto;[\s\S]*?overflow-y: visible;/);
  assert.doesNotMatch(shellStyles, /height:\s*calc\(100vh\s*-\s*28px\)/);
});
