import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import * as react from "react";
import * as jsx from "react/jsx-runtime";
import ts from "typescript";
import { ar } from "../src/i18n/ar.ts";
import * as batch from "../src/content-batch.ts";
import * as strategy from "../src/content-strategy.ts";
import * as growth from "../src/content-growth.ts";
import * as publishing from "../src/content-publishing.ts";
import * as publishingCopy from "../src/content-publishing-copy.ts";
import * as canva from "../src/canva-readiness.ts";
import * as dates from "../src/date-utils.ts";

function compile(fileName) {
  const source = readFileSync(new URL("../src/" + fileName, import.meta.url), "utf8");
  return ts.transpileModule(source.replaceAll("import.meta.env", "({})"), {
    fileName, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
}
const panelCode = compile("content-batch-review-panel.tsx");
const hubCode = compile("content-growth-hub.tsx");

// Run the actual card and switcher controls with isolated hook state. Network requests can only reach test doubles.
function mount(screen, props, { confirm = () => true, canvaStatus } = {}) {
  const state = [], effects = [];
  let cursor = 0;
  const hooks = {
    ...react, useMemo: read => read(), useRef: current => ({ current }), useEffect: effect => effects.push(effect),
    useState(initial) {
      const index = cursor++;
      if (index >= state.length) state[index] = typeof initial === "function" ? initial() : initial;
      return [state[index], next => { state[index] = typeof next === "function" ? next(state[index]) : next; }];
    },
  };
  const modules = {
    react: hooks, "react/jsx-runtime": jsx, "./i18n": { useLanguage: () => ({ language: "ar", t: key => ar[key] }) },
    "./content-batch": batch, "./content-strategy": strategy, "./content-growth": growth,
    "./content-publishing": publishing, "./content-publishing-copy": publishingCopy, "./date-utils": dates,
    "./canva-readiness": canva, "./coach-brain-factory-handoff": { readCoachBrainFactoryHandoff: () => null },
    "./canva-design-adapter": { fetchCanvaDesignStatus: async () => canvaStatus },
    "./media-library-controls": { parseMediaAssetRecords: () => [] },
  };
  const context = {
    require: key => modules[key] ?? {}, window: { location: { search: "" }, confirm }, URLSearchParams, AbortController,
    FormData: Map, fetch: async url => {
      const responses = { get_staff_integrations: { items: [{ provider: "canva", status: "connected" }] },
        get_staff_content_automation_status: {}, get_staff_media_assets: [] };
      const name = url.split("/").at(-1);
      assert.ok(Object.hasOwn(responses, name), "unexpected request: " + name);
      return { ok: true, json: async () => responses[name] };
    },
  };
  const panel = {};
  runInNewContext(panelCode, { ...context, exports: panel });
  modules["./content-batch-review-panel"] = panel;
  let renderComponent = panel.ContentBatchReviewPanel;
  if (screen === "hub") {
    const hub = {};
    runInNewContext(hubCode, { ...context, exports: hub });
    renderComponent = hub.default;
  }
  return {
    render() { cursor = 0; effects.length = 0; return renderComponent(props); },
    async loadStatus() { for (const effect of effects) effect(); await new Promise(resolve => setImmediate(resolve)); },
    panel,
  };
}

function nodes(root, predicate) {
  if (Array.isArray(root)) return root.flatMap(child => nodes(child, predicate));
  if (!root?.props) return [];
  return [...(predicate(root) ? [root] : []), ...nodes(root.props.children, predicate)];
}
function one(root, predicate) {
  const found = nodes(root, predicate);
  assert.equal(found.length, 1);
  return found[0];
}
const change = (node, value) => node.props.onChange({ target: { value } });
const select = (root, label) => one(one(root, node => node.type === "label" && node.props.children[0] === label), node => node.type === "select");
const button = (root, text) => one(root, node => node.type === "button" && node.props.children === text);
const post = { id: "p1", batchId: "b1", topic: "سباحة", status: "draft", caption: "", platform: "instagram",
  contentType: "post", createdAt: "2026-01-01T12:00:00Z", scheduledFor: null };
const base = { session: { role: "super_admin", accessToken: "fixture" }, canWrite: true, busy: false };
function panelProps(items, extra = {}) {
  return { ...base, items, batch: { batchId: "b1", items, isExplicitBatch: true }, ...extra };
}

test("each post opens only its chosen method and requires consent for uploads and poster saves", () => {
  const view = mount("panel", panelProps([post, { ...post, id: "p2", status: "published" }]));
  const card = id => one(view.render(), node => node.type === "article" && node.key === id);
  const hasFile = node => node.props.type === "file";
  const hasStudio = node => "onSaveDesign" in node.props;
  const hasProvider = node => node.props["data-testid"] === "generateDesignButton";
  const hasPersonal = node => node.type === "textarea" && node.props.readOnly;
  const markers = [hasPersonal, hasFile, hasStudio, hasProvider];
  for (const [i, method] of ["personal", "upload", "poster", "automatic"].entries()) {
    change(select(card("p1"), "طريقة التصميم"), method);
    const current = card("p1");
    assert.deepEqual(markers.map(marker => nodes(current, marker).length), markers.map((_, index) => Number(index === i)));
    if (method === "upload" || method === "poster") {
      const enabled = root => method === "poster" ? Boolean(one(root, hasStudio).props.onSaveDesign) : !one(root, hasFile).props.disabled;
      assert.equal(enabled(current), false);
      change(select(current, "من يظهر في التصميم؟"), "consented");
      assert.equal(enabled(card("p1")), true);
    }
    if (method === "automatic") {
      assert.equal(select(current, "مزود التصميم").props.value, "auto");
      assert.equal(one(current, node => node.type === "bdi").props.children, "يدوي");
    }
    assert.equal(select(card("p2"), "طريقة التصميم").props.value, "");
  }
  const publishedMethods = select(card("p2"), "طريقة التصميم");
  assert.deepEqual(nodes(publishedMethods, node => node.type === "option").map(node => node.props.value), ["", "personal", "poster"]);
  change(publishedMethods, "poster");
  assert.equal(one(card("p2"), hasStudio).props.onSaveDesign, undefined);
});

test("editing and approving share one clock, preserve saved precision, and respect cancel, clear and refreshed dates", async () => {
  const item = { ...post, scheduledFor: "2095-01-01T18:30:49+04:00" };
  const saves = [], approvals = [];
  let confirmed = false;
  const view = mount("panel", panelProps([item], {
    onEditItem: async (_item, _prompt, time) => saves.push(time),
    onApproveItem: async approved => approvals.push(approved.scheduledFor),
  }), { confirm: () => confirmed });
  button(view.render(), "تعديل").props.onClick();
  const clock = () => one(view.render(), node => node.props.type === "datetime-local");
  const save = () => one(view.render(), node => node.type === "form").props.onSubmit({ preventDefault() {}, currentTarget: new Map() });
  const approve = () => button(view.render(), "اعتماد وجدولة");
  assert.equal(clock().props.value, dates.formatLocalDateTimeInput(item.scheduledFor));
  save();
  assert.deepEqual(saves, [item.scheduledFor]);
  change(clock(), "2096-02-03T12:45");
  save();
  approve().props.onClick();
  assert.deepEqual(approvals, []);
  confirmed = true;
  approve().props.onClick();
  assert.equal(approvals[0], new Date("2096-02-03T12:45").toISOString());
  assert.equal(saves.at(-1), approvals[0]);
  for (const invalid of ["2000-01-01T10:00", ""]) {
    change(clock(), invalid);
    assert.equal(approve().props.disabled, true);
    approve().props.onClick();
  }
  assert.equal(approvals.length, 1);
  save();
  assert.equal(saves.at(-1), null);
  item.scheduledFor = "2097-03-24T18:22:01Z";
  assert.equal(clock().props.value, dates.formatLocalDateTimeInput(item.scheduledFor));
});

test("batch switcher pins the selection, prioritizes latest pending work and preserves older selections on collapse", () => {
  const statuses = ["needs_review", "failed", "scheduled", "approved", "published", "published"];
  const items = statuses.map((status, i) => ({ ...post, id: "p" + i, batchId: "b" + i, status, createdAt: `2026-02-0${i + 1}T10:00Z` }));
  const view = mount("hub", { ...base, items, activeTab: "review" });
  const picker = () => one(view.render(), node => node.props.id === "factory-batch-select");
  const choices = () => nodes(picker(), node => node.type === "option").map(node => node.props.value);
  assert.deepEqual(choices(), ["b0", "b3", "b2"]);
  button(view.render(), "عرض كل الدفعات (6)").props.onClick();
  assert.deepEqual(choices(), ["b0", "b3", "b2", "b1", "b5", "b4"]);
  change(picker(), "b4");
  button(view.render(), "عرض القائمة المختصرة").props.onClick();
  assert.equal(picker().props.value, "b4");
  assert.deepEqual(choices(), ["b4", "b3", "b2"]);
});

test("hub and automatic design show the Arabic readiness summary with English diagnostics closed", async () => {
  const detail = "The configured Brand Template is unavailable; using the verified editable source design.";
  for (const ready of [true, false]) {
    const hub = mount("hub", { ...base, items: [post], activeTab: "review" }, {
      canvaStatus: { ready, integrationStatus: ready ? "READY" : "NOT READY", canvaConnected: true, detail },
    });
    hub.render();
    await hub.loadStatus();
    const tree = hub.render();
    const panel = one(tree, node => node.type === hub.panel.ContentBatchReviewPanel);
    const review = mount("panel", panel.props);
    change(select(review.render(), "طريقة التصميم"), "automatic");
    for (const [root, noticeComponent] of [[tree, hub.panel.CanvaStatusNotice], [review.render(), review.panel.CanvaStatusNotice]]) {
      const notice = one(root, node => node.type === noticeComponent);
      const rendered = noticeComponent(notice.props);
      assert.equal(one(rendered, node => node.props.role === "status").props.children,
        ready ? "Canva جاهز للتصميم" : "Canva متصل ويحتاج إلى إعداد للتصميم");
      const disclosure = one(rendered, node => node.type === "details");
      assert.ok(!disclosure.props.open);
      assert.equal(one(disclosure, node => node.type === "summary").props.children, "تفاصيل Canva");
      assert.ok(nodes(disclosure, node => node.type === "li").some(node => node.props.children === detail));
    }
  }
});
