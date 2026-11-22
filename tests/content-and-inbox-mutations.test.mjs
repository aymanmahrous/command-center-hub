import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import * as React from "react";
import ts from "typescript";
import { z } from "zod";
import * as contentGrowth from "../src/content-growth.ts";
import { formatLocalDateTimeInput } from "../src/date-utils.ts";
import { ar } from "../src/i18n/ar.ts";

// Run the actual UI handlers with local state and controlled RPC promises.
function loadHandlers(file, names, context) {
  const source = ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = [];
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) declarations.push(node.getText(source));
    else if (ts.isVariableStatement(node) && names.includes(node.declarationList.declarations[0].name.getText(source))) declarations.push(node.getText(source));
    else ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(declarations.length, names.length);
  const { outputText } = ts.transpileModule(declarations.join("\n"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  });
  return runInNewContext(outputText + "\n({" + names.join(",") + "})", { Error, ...context });
}

const main = "../src/main.tsx";
const panel = "../src/content-batch-review-panel.tsx";
const item = { id: "post", topic: "Swimming", status: "draft", scheduledFor: null };

function contentFixture(confirm, response) {
  const state = { undo: "previous", changes: 0, calls: [] };
  const handlers = loadHandlers(main, ["ContentMutationSchema", "mutateContent", "contentErrorMessage", "runMutation",
    "approveBatchItem", "requestBatchChanges", "editBatchItem", "updateBatchPrompt", "updateContentItem", "transitionContentItem"], {
    z, session: {}, language: "en", canApprove: true, canWrite: true, canApproveContentItem: () => true,
    busyId: null, batchBusy: false, window: { confirm: () => confirm }, setBusyId() {},
    require: () => contentGrowth,
    setNotice: (value) => { state.notice = value; }, setUndoAction: (value) => { state.undo = value; },
    onChanged: () => { state.changes++; },
    callRpc: async (_session, rpc, body) => { state.calls.push({ rpc, body }); return response(rpc); },
  });
  return { state, handlers };
}

test("atomic approval shows success and undo only for a confirmed success response", async () => {
  for (const success of [false, true]) {
    const { state, handlers } = contentFixture(true, () => ({ success, code: "INVALID_SCHEDULE_TIME" }));
    const time = new Date(Date.now() + 86400000).toISOString();
    const approval = (confirm, selectedTime = time) => loadHandlers(panel, ["confirmApproval", "scheduleForItem", "formatWhen"], {
      scheduleTimes: { post: { original: null, value: selectedTime } }, formatLocalDateTimeInput,
      window: { confirm: () => confirm }, language: "en", onApproveItem: handlers.approveBatchItem,
    }).confirmApproval(item);
    await approval(true, "");
    await approval(true, "2000-01-01");
    await approval(false);
    assert.equal(state.calls.length, 0);
    await approval(true);
    assert.equal(state.calls[0].rpc, "approve_and_schedule_staff_content_item");
    assert.equal(state.calls[0].body.p_scheduled_for, time);
    assert.equal(state.changes, Number(success));
    assert.equal(state.notice, success ? "Item approved and scheduled." : "Scheduled time must be in the future.");
    if (success) assert.equal(state.undo.action, "unschedule");
    else assert.equal(state.undo, null);
  }
});

test("Factory confirms the actual file and person consent before preparing and linking it", async () => {
  const file = { name: "swim.png", type: "image/png" };
  const run = async (presence, { confirm = true, failure, scheduled = false } = {}) => {
    const calls = [], prompts = [], refresh = [];
    let errors = {};
    const handlers = loadHandlers(panel, ["handleUploadMedia", "mediaRpc", "linkMediaToItem", "mediaLinkErrorMessage",
      "confirmScheduledMediaChange", "scheduledMediaChangeWarning"], {
      session: { role: "super_admin", accessToken: "local" }, language: "ar", canWrite: true, busy: false,
      mediaActionBusyId: null, presenceByItem: { post: presence }, SUPABASE_URL: "", SUPABASE_PUBLIC_KEY: "",
      window: { confirm: message => { prompts.push(message); return scheduled ? prompts.length === 1 : confirm; } },
      setMediaErrors: update => { errors = update(errors); }, setMediaActionBusyId() {}, setDesignNotice() {},
      setScheduleTimes() {}, setPresenceByItem() {}, designMethods: { post: "upload" }, selectDesignMethod() {}, setItemFilter() {},
      onMediaLinked: showCard => refresh.push(showCard),
      uploadStaffMediaFile: async () => { calls.push(["upload"]); return { assetType: "image", storagePath: "local/swim.png", fileName: file.name }; },
      fetch: async (url, options) => {
        const name = url.split("/").at(-1);
        calls.push([name, JSON.parse(options.body)]);
        return { ok: true, status: 200, json: async () => name === failure
          ? { success: false, code: "MEDIA_ASSET_NOT_PUBLISHABLE" } : { success: true, mediaAssetId: "asset" } };
      },
    });
    await handlers.handleUploadMedia({ ...item, status: scheduled ? "scheduled" : "draft" }, file);
    return { calls, prompts, refresh, errors };
  };
  const order = ["upload", "register_staff_media_upload", "attest_media_person_presence", "update_owner_media_asset", "review_staff_media_asset", "link_staff_media_to_content_item"];
  for (const presence of ["none", "consented"]) {
    const { calls, prompts, refresh } = await run(presence);
    assert.match(prompts[0], /swim\.png/);
    assert.match(prompts[0], presence === "none" ? /لا يظهر أي شخص/ : /موافقة نشر من كل شخص/);
    assert.deepEqual(calls.map(([name]) => name), order);
    assert.equal(calls[2][1].p_contains_real_person, presence === "consented");
    assert.equal(calls[3][1].p_consent_status, presence === "consented" ? "consent_confirmed" : undefined);
    assert.equal(calls[3][1].p_category, "swimming_business");
    assert.equal(calls[3][1].p_media_status, "ready");
    assert.equal(calls[4][1].p_review_status, "approved");
    assert.deepEqual(calls.at(-1)[1], { p_content_item_id: "post", p_media_asset_id: "asset" });
    assert.deepEqual(refresh, [true]);
  }
  assert.deepEqual((await run("")).calls, []);
  assert.deepEqual((await run("none", { confirm: false })).calls, []);
  assert.deepEqual((await run("none", { scheduled: true })).calls, []);
  for (const failure of order.slice(2)) {
    const result = await run("none", { failure });
    assert.deepEqual(result.calls.map(([name]) => name), order.slice(0, order.indexOf(failure) + 1));
    assert.match(result.errors.post, /الأصل غير جاهز.*حُفظ الملف في المكتبة/);
    assert.deepEqual(result.refresh, [undefined]);
  }
});

test("Factory uses a Dubai date and time for the same batch in all three visible labels", () => {
  const hub = "../src/content-growth-hub.tsx";
  const source = readFileSync(new URL(hub, import.meta.url), "utf8");
  const { batchName } = loadHandlers(hub, ["batchName"], {});
  const label = batchName("ar", "2026-11-22T06:30:00Z");
  assert.match(label, /دفعة.*٢٢.*نوفمبر.*١٠:٣٠/);
  assert.match(source, /batchName\(language, selectedBatch.createdAt\)/);
  assert.match(source, /batchName\(language, batch.createdAt\)/);
  assert.match(source, /generateNotice.template.replace[\s\S]*?batchName\(language,[\s\S]*?generateNotice.createdAt/);
  assert.match(source, /إجمالي كل الدفعات/);
});

for (const form of ["edit", "change request"]) {
  test(form + " retains its inputs on cancel or failed save and closes after success", async () => {
    for (const outcome of ["cancel", "failed write", "failed transition", "saved"]) {
      const { state, handlers } = contentFixture(outcome !== "cancel", (rpc) => ({
        success: outcome !== "failed write" && !(outcome === "failed transition" && rpc === "transition_staff_content_item"),
      }));
      const draft = { target: item.id, note: "Change the design", kind: "design" };
      const values = new Map([["visualPrompt", draft.note]]);
      const forms = loadHandlers(panel, ["submitEdit", "submitChangeRequest", "scheduleForItem"], {
        scheduleTimes: { post: { original: null, value: "2030-01-02T12:00" } }, formatLocalDateTimeInput,
        language: "en", window: { confirm: () => outcome !== "cancel" },
        FormData: Map, onEditItem: handlers.editBatchItem, onRequestChanges: handlers.requestBatchChanges,
        changeNote: draft.note, changeKind: draft.kind,
        setEditTargetId: (id) => { draft.target = id; }, setChangeTargetId: (id) => { draft.target = id; },
        setChangeNote: (note) => { draft.note = note; }, setChangeKind: (kind) => { draft.kind = kind; },
      });
      if (form === "edit") await forms.submitEdit(item, values);
      else await forms.submitChangeRequest(item);
      assert.equal(state.calls.length, { cancel: 0, "failed write": 1, "failed transition": 2, saved: 2 }[outcome]);
      assert.equal(state.changes, Number(outcome === "saved"));
      if (outcome === "saved") {
        assert.equal(draft.target, null);
        if (form === "change request") assert.equal(draft.note, "");
      } else {
        assert.deepEqual(draft, { target: item.id, note: "Change the design", kind: "design" });
        assert.equal(values.get("visualPrompt"), draft.note);
      }
    }
  });
}

test("All opens on the latest update and keeps the owner's selection after a refresh", () => {
  const state = [], effects = [];
  let cursor = 0;
  const { AIInboxView } = loadHandlers(main, ["ConversationSchema", "conversationModeLabels", "AIInboxView"], {
    React, z, AbortController, require: () => ({}), getConversationMessages: async () => [],
    useLanguage: () => ({ language: "ar", t: key => ar[key] }),
    useMemo: read => read(), useRef: current => ({ current }), useEffect: effect => effects.push(effect),
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], next => { state[index] = next; }];
    },
  });
  const older = {
    id: "10000000-0000-4000-8000-000000000001", leadId: "20000000-0000-4000-8000-000000000001",
    leadName: "Older", channel: "whatsapp", mode: "human_takeover", unread: 5, humanRequired: true,
    lastMessage: "", leadScore: 0, intent: "", updatedAt: "2026-11-22T09:00:00+04:00",
  };
  const newer = { ...older, id: "10000000-0000-4000-8000-000000000002", leadName: "Newer",
    mode: "ai_active", unread: 1, humanRequired: false, updatedAt: "2026-11-22T06:00:00Z" };
  let value = [older, newer];
  function buttons(node) {
    if (Array.isArray(node)) return node.flatMap(buttons);
    if (!node?.props) return [];
    return node.type === "button" ? [node] : buttons(node.props.children);
  }
  function render() {
    cursor = 0;
    const controls = buttons(AIInboxView({ value, session: { role: "coach" } }));
    effects.splice(0).forEach(effect => effect());
    return { controls, rows: controls.filter(button => button.key !== null) };
  }
  assert.deepEqual(render().rows.map(row => row.key), [newer.id, older.id]);
  const { rows } = render();
  assert.equal(rows[0].props.className, "selected");
  rows[1].props.onClick();
  value = [{ ...newer, id: "10000000-0000-4000-8000-000000000003", updatedAt: "2026-11-23T06:00:00Z" }, older, newer];
  render();
  const refreshed = render();
  assert.equal(refreshed.rows.find(row => row.props.className === "selected").key, older.id);
  refreshed.controls.find(button => button.props.children[0] === "يحتاج قرارك").props.onClick();
  assert.deepEqual(render().rows.map(row => row.key), [older.id]);
});

function inboxFixture() {
  const state = { reply: "Reply A", messages: ["old A"], status: "ready", patches: {}, errors: [] };
  const send = Promise.withResolvers();
  const refresh = Promise.withResolvers();
  const refreshing = Promise.withResolvers();
  const handlers = loadHandlers(main, ["handleSendReply", "selectConversation"], {
    session: {}, activeId: { current: "A" }, busyId: null, canSendReply: true, replyBody: state.reply,
    copy: { sendSuccess: "sent", sendDryRunSuccess: "dry run" },
    setSelectedId() {}, setBusyId() {}, setReplyBody: (reply) => { state.reply = reply; },
    setMessages: (messages) => { state.messages = messages; }, setMessageStatus: (status) => { state.status = status; },
    setNotice: (notice) => { state.notice = notice; }, handleInboxError: (error) => state.errors.push(error),
    setConversationPatches: (apply) => { state.patches = apply(state.patches); },
    sendStaffWhatsappMessage: (_session, id) => { assert.equal(id, "A"); return send.promise; },
    getConversationMessages: (_session, id) => { assert.equal(id, "A"); refreshing.resolve(); return refresh.promise; },
  });
  const pending = handlers.handleSendReply({ id: "A" });
  function switchClient() {
    handlers.selectConversation("B");
    Object.assign(state, { reply: "Draft B", messages: ["message B"], notice: "" });
  }
  return { state, pending, send, refresh, refreshing, switchClient };
}

test("switching clients during send or refresh protects the active client's draft and messages", async () => {
  for (const during of ["send", "refresh"]) {
    const { state, pending, send, refresh, refreshing, switchClient } = inboxFixture();
    if (during === "send") switchClient();
    send.resolve({ dryRun: false });
    if (during === "refresh") { await refreshing.promise; switchClient(); }
    refresh.resolve(["new A"]);
    await pending;
    assert.equal(state.patches.A.lastMessage, "Reply A");
    assert.equal(state.reply, "Draft B");
    assert.deepEqual(state.messages, ["message B"]);
    assert.equal(state.notice, "");
  }
});

test("refresh failure preserves the send or dry-run confirmation and flags the message list separately", async () => {
  for (const dryRun of [false, true]) {
    const { state, pending, send, refresh, refreshing } = inboxFixture();
    send.resolve({ dryRun });
    await refreshing.promise;
    refresh.reject(new Error("offline"));
    await pending;
    assert.equal(state.notice, dryRun ? "dry run" : "sent");
    assert.equal(state.status, "error");
    assert.deepEqual(state.errors, []);
    assert.equal(state.reply, "");
    assert.deepEqual(state.messages, ["old A"]);
  }
});
