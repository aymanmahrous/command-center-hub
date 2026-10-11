import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panel = await readFile(new URL("../src/content-batch-review-panel.tsx", import.meta.url), "utf8");

test("publication history displays platform, result status, result time, and reason", () => {
  assert.match(panel, /receipt\.platform\.toUpperCase\(\)\s*\} · \{receipt\.status/);
  assert.match(panel, /receipt\.updatedAt && <time[^>]+dateTime=\{receipt\.updatedAt\}/);
  assert.match(panel, /Result time/);
  assert.match(panel, /receipt\.plainLanguageReason/);
});

test("confirmed failures can be retried while ambiguous external outcomes are blocked", () => {
  assert.match(panel, /receipt\?\.status\.toLowerCase\(\) === "published" \|\| receipt\?\.status\.toLowerCase\(\) === "ambiguous"/);
  assert.match(panel, /retryButton: "Retry confirmed failure"/);
  assert.match(panel, /retryConfirm: "The last result is a confirmed failure/);
  assert.match(panel, /confirmedFailure \? requestPublishCopy\.retryConfirm : requestPublishCopy\.confirm/);
});
