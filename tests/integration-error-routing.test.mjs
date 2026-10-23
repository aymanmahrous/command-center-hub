import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/integrations-center.tsx", import.meta.url), "utf8");

test("Facebook and Instagram OAuth failures never use Canva error messaging", () => {
  assert.match(source, /provider === "facebook" \|\| provider === "instagram"/);
  assert.match(source, /Facebook.*OAuth could not start/);
  assert.match(source, /تعذر بدء ربط/);
  assert.match(source, /else \{\s*setNotice\(canvaConnectErrorMessage\(code, language\)\);/);
  assert.match(source, /provider === "google_calendar"[\s\S]*?googleCalendarConnectErrorMessage\(code\)/);
});
