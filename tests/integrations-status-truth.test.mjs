import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/integrations-center.tsx", import.meta.url), "utf8");

test("integration status requires explicit external verification evidence", () => {
  assert.match(source, /function externallyVerified\(item:/);
  assert.match(source, /verifiedExternally === true/);
  assert.match(source, /status === "connected" && lastTestedAt && verifiedExternally/);
  assert.match(source, /const verified = Boolean\(item\.lastTestedAt && externallyVerified\(item\)\)/);
  assert.match(source, /Externally verified/);
  assert.match(source, /a live external check passed/);
});

test("local configuration checks never imply that an external provider is working", () => {
  assert.match(source, /connected: "Local config test passed"/);
  assert.match(source, /configuration exists, but external operation is not verified/);
  assert.doesNotMatch(source, /const status = item\.lastTestedAt \?/);
});
