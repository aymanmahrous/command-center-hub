import assert from "node:assert/strict";
import test from "node:test";
import { formatHashtags, normalizeHashtag } from "../supabase/functions/safe-content-publisher/text.ts";

test("normalizes one hashtag to exactly one leading hash", () => {
  assert.equal(normalizeHashtag("##RelaxFixUAE"), "#RelaxFixUAE");
  assert.equal(normalizeHashtag(" RelaxFixUAE "), "#RelaxFixUAE");
});

test("formats stored hashtags without producing double hashes", () => {
  assert.equal(formatHashtags(["#RelaxFixUAE", "##KidsSwimming", "WaterConfidence"]), "#RelaxFixUAE #KidsSwimming #WaterConfidence");
});

test("ignores empty hashtag values", () => {
  assert.equal(formatHashtags(["", "###", null, "#Ready"]), "#Ready");
  assert.equal(formatHashtags(undefined), "");
});
