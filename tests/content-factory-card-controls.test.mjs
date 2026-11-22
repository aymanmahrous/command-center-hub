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
import * as media from "../src/media-types.ts";

function compile(fileName) {
  const source = readFileSync(new URL("../src/" + fileName, import.meta.url), "utf8");
  return ts.transpileModule(source.replaceAll("import.meta.env", "({})"), {
    fileName, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
}
const panelCode = compile("content-batch-review-panel.tsx");
const hubCode = compile("content-growth-hub.tsx");

// Run the actual card and switcher controls with isolated hook state. Network requests can only reach test doubles.
function mount(screen, props, { confirm = () => true, canvaStatus, mediaAssets = [], document } = {}) {
  const state = [], effects = [];
  const frames = new Map();
  let frameId = 0;
  let cursor = 0;
  function queueEffect(effect, dependencies) {
    const index = cursor++;
    const previous = state[index];
    if (previous && dependencies?.every((value, i) => Object.is(value, previous.dependencies[i]))) return;
    effects.push(() => {
      previous?.cleanup?.();
      state[index] = { dependencies, cleanup: effect() };
    });
  }
  const hooks = {
    ...react, useMemo: read => read(), useCallback: callback => callback,
    useRef(current) {
      const index = cursor++;
      return state[index] ??= { current };
    },
    useEffect: queueEffect, useLayoutEffect: queueEffect,
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
    "./media-library-controls": { parseMediaAssetRecords: value => value },
    "./media-types": media,
  };
  const context = {
    require: key => modules[key] ?? {}, window: { location: { search: "" }, confirm }, URLSearchParams, AbortController,
    document, requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame: id => frames.delete(id),
    FormData: Map, fetch: async url => {
      const responses = { get_staff_integrations: { items: [{ provider: "canva", status: "connected" }] },
        get_staff_content_automation_status: {}, get_staff_media_assets: mediaAssets };
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
    render(nextProps = props) { props = nextProps; cursor = 0; effects.length = 0; return renderComponent(props); },
    async loadStatus() { for (const effect of effects) effect(); await new Promise(resolve => setImmediate(resolve)); },
    paint() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); },
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

const filterButton = (tree, label) => one(tree, node => node.type === "button" && node.props.children?.[0] === label);
const cards = tree => nodes(tree, node => node.props.className === "content-batch-item");
const panelIn = (hub, tree) => one(tree, node => node.type === hub.panel.ContentBatchReviewPanel).props;
const savedTime = "2095-01-01T12:30:00.000Z";

test("confirmed scheduling waits for the refreshed post and focuses its card in the scheduled filter", async () => {
  const requested = { ...post, status: "needs_review", scheduledFor: savedTime };
  const other = { ...post, id: "other", status: "scheduled" };
  const tabs = [], requests = [], focus = [];
  let refreshes = 0;
  let finish;
  const props = { ...base, items: [requested, other], activeTab: "review", onTabChange: tab => tabs.push(tab),
    onBatchCreated: () => { refreshes++; },
    onApproveItem: (item, message) => {
      requests.push(item);
      return new Promise(resolve => { finish = () => resolve({ itemId: item.id, ok: true, code: "ACCEPTED", message }); });
    } };
  const hub = mount("hub", props);
  const panel = mount("panel", panelIn(hub, hub.render()), { document: {
    getElementById(id) {
      assert.ok(cards(panel.render()).some(card => card.props.id === id));
      return { focus: () => focus.push(id), scrollIntoView: () => focus.push(id) };
    },
  } });
  filterButton(panel.render(), "للمراجعة").props.onClick();
  const action = button(panel.render(), "اعتماد وجدولة").props.onClick();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].id, requested.id);
  finish();
  await action;
  hub.render();
  await hub.loadStatus();
  assert.deepEqual(tabs, []);
  assert.equal(panelIn(hub, hub.render()).workspaceMode, "review");

  // A successful read can still return the old row. Keep the read-only refresh available.
  hub.render({ ...props, items: [{ ...requested }, other] });
  await hub.loadStatus();
  const pendingTree = panel.render(panelIn(hub, hub.render()));
  const pending = cards(pendingTree).find(card => card.key === requested.id);
  const verify = "قُبل الطلب، جارٍ التحقق من الموعد";
  assert.equal(one(pending, node => node.props.role === "status" && node.props.children === verify).props.children, verify);
  assert.equal(button(pending, "اعتماد وجدولة").props.disabled, true);
  assert.equal(nodes(pendingTree, node => node.props.children === "حُفظ موعد المنشور").length, 0);
  button(pending, "تحديث الحالة").props.onClick();
  assert.equal(refreshes, 1);
  assert.equal(requests.length, 1);
  assert.deepEqual(tabs, []);

  const refreshed = { ...requested, status: "scheduled", scheduledFor: "2095-01-01T16:30:00+04:00" };
  hub.render({ ...props, items: [other, refreshed] });
  await hub.loadStatus();
  const updatedPanel = panelIn(hub, hub.render());
  assert.equal(updatedPanel.workspaceMode, "campaigns");
  assert.deepEqual(tabs, ["campaigns"]);
  panel.render(updatedPanel);
  await panel.loadStatus();
  const tree = panel.render();
  panel.paint();
  assert.equal(filterButton(tree, "مجدول").props.className, "active");
  const notice = node => node.props.role === "status" && node.props.children === "حُفظ موعد المنشور";
  assert.equal(nodes(cards(tree).find(card => card.key === requested.id), notice).length, 1);
  assert.equal(nodes(cards(tree).find(card => card.key === other.id), notice).length, 0);
  assert.equal(nodes(tree, node => node.props.children === "تحديث الحالة").length, 0);
  assert.deepEqual(focus, ["factory-post-p1", "factory-post-p1"]);
  await hub.loadStatus();
  assert.deepEqual(tabs, ["campaigns"]);
});

test("a rejected request, unchanged row, different post or different saved time leaves review open", async () => {
  const requested = { ...post, status: "needs_review", scheduledFor: savedTime };
  for (const outcome of ["rejected", "unchanged", "other post", "different time"]) {
    const tabs = [];
    const props = { ...base, activeTab: "review", items: [requested], onTabChange: tab => tabs.push(tab),
      onApproveItem: async (item, message) => {
        if (outcome === "rejected") throw new Error("rejected");
        return { itemId: item.id, ok: true, code: "ACCEPTED", message };
      } };
    const hub = mount("hub", props);
    await panelIn(hub, hub.render()).onApproveItem(requested);
    const updated = { ...requested, status: "scheduled" };
    if (outcome === "unchanged") updated.status = "needs_review";
    if (outcome === "other post") updated.id = "another";
    if (outcome === "different time") updated.scheduledFor = "2095-01-02T12:30:00Z";
    hub.render({ ...props, items: [updated] });
    await hub.loadStatus();
    const shown = panelIn(hub, hub.render());
    assert.equal(shown.workspaceMode, "review", outcome);
    assert.equal(shown.cardTarget, null, outcome);
    assert.deepEqual(tabs, [], outcome);
  }
});

test("a scheduling refusal is shown next to the approval button on the requested card only", async t => {
  const requested = { ...post, status: "needs_review", scheduledFor: savedTime };
  const other = { ...requested, id: "other" };
  const refusals = [
    ["SCHEDULE_PUBLISH_JOB_NOT_FOUND", "تعذر تنفيذ التغيير.", "تعذّر تجهيز مهمة النشر للموعد المختار. لم يُحفظ الموعد."],
    ["PLATFORM_NOT_SUPPORTED", "تعذر تنفيذ التغيير.", "الجدولة متاحة لمنشورات فيسبوك وإنستغرام فقط."],
    ["INVALID_SCHEDULE_TIME", "وقت الجدولة يجب أن يكون في المستقبل.", "وقت الجدولة يجب أن يكون في المستقبل."],
    ["APPROVE_AND_SCHEDULE_FAILED", "تعذر تنفيذ التغيير بأمان.", "تعذّر اعتماد المنشور وجدولته. لم يحدّد الخادم سبب الرفض."],
    ["INVALID_TRANSITION", "تعذر تنفيذ التغيير.", "حالة المنشور الحالية لا تسمح باعتماده وجدولته. حدّث الصفحة للتحقق من حالته."],
    ["MEDIA_ASSET_REQUIRED_FOR_PUBLISH", "تعذر تنفيذ التغيير.", "اربط بهذا المنشور ملفًا محفوظًا لصورة أو فيديو."],
    ["MEDIA_ASSET_MISSING_OR_UNLINKED", "تعذر تنفيذ التغيير.", "تأكّد من حفظ ملف الصورة أو الفيديو، ثم أعد ربطه بهذا المنشور."],
    ["MEDIA_NOT_APPROVED_FOR_PUBLISH", "تعذر تنفيذ التغيير.", "راجع الصورة أو الفيديو واعتمده، ووثّق موافقة الأشخاص عند الحاجة."],
  ];
  for (const [code, message, expected] of refusals) await t.test(code, async () => {
    const hub = mount("hub", { ...base, items: [requested, other], activeTab: "review",
      onApproveItem: async item => ({ itemId: item.id, ok: false, code, message }) });
    const panel = mount("panel", panelIn(hub, hub.render()));
    const target = tree => one(tree, node => node.key === requested.id);
    await button(target(panel.render()), "اعتماد وجدولة").props.onClick();
    const tree = panel.render(panelIn(hub, hub.render()));
    const footer = one(target(tree), node => node.type === "footer");
    assert.equal(button(footer, "اعتماد وجدولة").props.disabled, false);
    assert.equal(one(footer, node => node.props.role === "alert").props.children, expected);
    assert.equal(nodes(one(tree, node => node.key === other.id), node => node.props.role === "alert").length, 0);
    assert.equal(nodes(tree, node => node.props.children === "تحديث الحالة").length, 0);
    assert.equal(nodes(tree, node => node.props.children === "حُفظ موعد المنشور").length, 0);
  });
});

test("the batch picker and summary precede reconciled totals and the review filter matches the batch count", () => {
  const statuses = ["draft", "generated", "needs_review", "approved", "idea", "cancelled", "published"];
  const items = statuses.map((status, index) => ({ ...post, id: status, status, batchId: index < 4 ? "b1" : "b2" }));
  const hub = mount("hub", { ...base, activeTab: "review", items });
  const tree = hub.render();
  const expectedIds = ["factory-batch-select", "batch-summary-heading", "content-pipeline-heading"];
  assert.deepEqual(nodes(tree, node => expectedIds.includes(node.props.id)).map(node => node.props.id), expectedIds);
  const stats = label => Object.fromEntries(nodes(one(tree, node => node.type === "div" && node.props["aria-labelledby"] === label),
    node => node.type === "article").map(node => node.props.children.map(child => child.props.children)));
  const totals = stats("content-pipeline-heading");
  assert.equal(totals["أفكار وملغاة"], 2);
  assert.equal(totals["مسجّل كمنشور"], 1);
  const totalLabel = ar.contentGrowth.totalItems;
  assert.equal(totals[totalLabel], items.length);
  assert.equal(Object.entries(totals).filter(([label]) => label !== totalLabel).reduce((sum, [, n]) => sum + n, 0), totals[totalLabel]);
  const reviewCount = stats("batch-summary-heading")[ar.contentBatch.needsReview];
  const panel = mount("panel", panelIn(hub, tree));
  const filter = filterButton(panel.render(), "للمراجعة");
  assert.equal(filter.props.children.at(-1).props.children, reviewCount);
  filter.props.onClick();
  assert.deepEqual(cards(panel.render()).map(card => card.key), ["draft", "generated", "needs_review"]);
  assert.equal(cards(panel.render()).length, reviewCount);
});

test("step five opens the eligible post in its own batch without requesting publication", async () => {
  const approved = { ...post, status: "approved", mediaAssetId: "ready" };
  const items = [
    { ...approved, id: "no-media", mediaAssetId: null },
    { ...approved, id: "published", providerExternalId: "already" },
    { ...approved, id: "unclear", receipts: [{ platform: "instagram", status: "ambiguous" }] },
    { ...approved, id: "retry", receipts: [{ platform: "instagram", status: "failed" }] },
    { ...approved, id: "unsupported", platform: "tiktok" },
    { ...approved, id: "target", topic: "المنشور المؤهل", batchId: "another", platform: "facebook" },
  ];
  const mediaAssets = [{ id: "ready", category: "other_business", mediaStatus: "ready", publishabilityStatus: "ready_for_review" }];
  const hub = mount("hub", { ...base, items, activeTab: "overview" }, { mediaAssets });
  const link = node => node.type === "button" && node.props.children?.[0] === "فتح بطاقة المنشور لعرض «نشر الآن»";
  assert.equal(nodes(hub.render(), link).length, 0);
  await hub.loadStatus();
  const overview = hub.render();
  assert.equal(cards(overview).length, 0);
  const open = one(overview, link);
  assert.ok(open.props.children.includes("المنشور المؤهل"));
  open.props.onClick();
  const destination = panelIn(hub, hub.render());
  assert.equal(destination.batch.batchId, "another");
  assert.equal(destination.workspaceMode, "campaigns");
  const panel = mount("panel", destination);
  panel.render();
  await panel.loadStatus();
  const tree = panel.render();
  assert.equal(filterButton(tree, "معتمد").props.className, "active");
  assert.equal(destination.cardTarget.id, "target");
  assert.equal(button(one(tree, node => node.key === "target"), "نشر الآن").props.disabled, false);
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
