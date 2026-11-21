import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import * as contentGrowth from "../src/content-growth.ts";

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
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
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
    const approval = (confirm) => loadHandlers(panel, ["confirmApproval"], {
      window: { confirm: () => confirm }, language: "en", onApproveItem: handlers.approveBatchItem,
    }).confirmApproval(item);
    await approval(false);
    assert.equal(state.calls.length, 0);
    await approval(true);
    assert.equal(state.calls[0].rpc, "approve_and_schedule_staff_content_item");
    assert.equal(state.changes, Number(success));
    assert.equal(state.notice, success ? "Item approved and scheduled." : "Scheduled time must be in the future.");
    if (success) assert.equal(state.undo.action, "unschedule");
    else assert.equal(state.undo, null);
  }
});

for (const form of ["edit", "change request"]) {
  test(form + " retains its inputs on cancel or failed save and closes after success", async () => {
    for (const outcome of ["cancel", "failed write", "failed transition", "saved"]) {
      const { state, handlers } = contentFixture(outcome !== "cancel", (rpc) => ({
        success: outcome !== "failed write" && !(outcome === "failed transition" && rpc === "transition_staff_content_item"),
      }));
      const draft = { target: item.id, note: "Change the design", kind: "design" };
      const values = new Map([["visualPrompt", draft.note], ["scheduledFor", "2030-01-02T12:00"]]);
      const forms = loadHandlers(panel, ["submitEdit", "submitChangeRequest"], {
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
