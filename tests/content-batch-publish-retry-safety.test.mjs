import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { latestReceiptForPlatform } from "../src/content-publishing.ts";

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

test("failed items show the retry control only for a confirmed failure on the same platform", () => {
  const source = ts.createSourceFile("panel.tsx", panel, ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "canShowPublishAction");
  assert.ok(declaration);
  const { outputText } = ts.transpileModule(declaration.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } });
  const canShow = runInNewContext(outputText + "\ncanShowPublishAction", { latestReceiptForPlatform });
  const receipt = { platform: "facebook", status: "failed", updatedAt: "2026-01-01" };
  const item = { status: "failed", platform: "facebook", receipts: [receipt] };
  assert.equal(canShow(item), true);
  assert.equal(canShow({ ...item, receipts: [] }), false);
  assert.equal(canShow({ ...item, platform: "instagram" }), false);
  assert.equal(canShow({ ...item, receipts: [{ ...receipt, externalPostId: "post-id" }] }), false);
  for (const status of ["ambiguous", "published", "pending"]) {
    assert.equal(canShow({ ...item, receipts: [receipt, { ...receipt, status, updatedAt: "2026-01-02" }] }), false);
  }
  assert.equal(canShow({ ...item, publishedAt: "2026-01-02" }), false);
  assert.equal(canShow({ ...item, providerExternalId: "post-id" }), false);
  assert.equal(canShow({ ...item, status: "approved" }), true);
  assert.equal(canShow({ ...item, status: "approved", receipts: [] }), true);
  assert.match(panel, /disabled=\{itemLocked[^}]*item\.status === "failed"[^}]*!mediaReadyForPublish/);
  assert.match(panel, /item\.status === "failed" && \(\s*<small[^>]*>\{requestPublishCopy\.retryNeedsApproval\}/);
});

test("missing Meta configuration shows the reason on the affected card and opens the Connections Center", async () => {
  assert.match(panel, /if \(result\.code === "META_NOT_CONFIGURED"\) \{\s*setMetaSetupItemId\(item\.id\);\s*return;/);
  assert.match(panel, /metaSetupItemId === item\.id && \([\s\S]*?role="alert">\{publishEnqueueErrorMessage\("META_NOT_CONFIGURED", language\)\}[\s\S]*?new CustomEvent\("command-center:navigate", \{ detail: \{ section: "connections" \}/);
  const app = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
  assert.match(app, /window\.addEventListener\("command-center:navigate", onCommandCenterNavigate\)/);
  assert.match(app, /active === "connections"[^\n]*<IntegrationsCenter\b/);
});
