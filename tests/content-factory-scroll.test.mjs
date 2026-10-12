import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/content-growth-hub.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/content-growth-hub.css", import.meta.url), "utf8");

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


test("factory sticky tabs stay below the sticky app navigation", () => {
  assert.match(styles, /\.content-section-nav\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?top:\s*84px;/);
  assert.match(styles, /@media\s*\(max-width:\s*1100px\)[\s\S]*?\.content-section-nav\s*\{\s*top:\s*132px;/);
});
