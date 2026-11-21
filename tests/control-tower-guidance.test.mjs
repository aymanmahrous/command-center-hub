import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("../src/control-tower-v2.tsx", import.meta.url), "utf8");

test("home decision modal labels its fixed review prompt as general guidance", () => {
  assert.match(home, /"إرشاد عام" : "General guidance"/);
  assert.doesNotMatch(home, /"اقتراح AI"|"AI recommendation"/);
});
