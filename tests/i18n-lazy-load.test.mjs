import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const i18n = await readFile(new URL("../src/i18n/index.ts", import.meta.url), "utf8");

test("Arabic remains the synchronous default and English is loaded only on demand", () => {
  assert.match(i18n, /useState<Language>\("ar"\)/);
  assert.match(i18n, /useState<Dictionary>\(ar\)/);
  assert.match(i18n, /import\("\.\/en"\)/);
  assert.doesNotMatch(i18n, /import\s+\{\s*en\s*\}\s+from\s+["']\.\/en["']/);
});

test("language switching ignores stale imports and falls back to Arabic", () => {
  assert.match(i18n, /languageRequestRef/);
  assert.match(i18n, /if \(languageRequestRef\.current !== request\) return/);
  assert.match(i18n, /setDictionary\(ar\)/);
  assert.match(i18n, /setLanguageState\("en"\)/);
});
