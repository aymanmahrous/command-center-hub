import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const storage = await readFile(new URL("../src/staff-media-storage.ts", import.meta.url), "utf8");

test("staff media storage uses authenticated private bucket reads only", () => {
  assert.match(storage, /STAFF_MEDIA_BUCKET = "relax-fix-media"/);
  assert.match(storage, /Authorization: `Bearer \$\{session\.accessToken\}`/);
  assert.match(storage, /\/storage\/v1\/object\/\$\{STAFF_MEDIA_BUCKET\}/);
  assert.match(storage, /cache: "no-store"/);
  assert.doesNotMatch(storage, /createSignedUrl|getPublicUrl|publicUrl/i);
  assert.doesNotMatch(storage, /drive\.google\.com/i);
});

test("staff media storage revokes temporary object URLs after document actions", () => {
  assert.match(storage, /URL\.createObjectURL/);
  assert.match(storage, /URL\.revokeObjectURL/);
});
