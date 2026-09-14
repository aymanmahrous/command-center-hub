import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildSalesConciergeTurn } from "../src/ai-sales-concierge/logic.mjs";
import {
  applyMemoryToConciergeInput,
  extractFactsFromMessage,
  mergeKnownFacts,
  shouldAskQuestion,
  updateQuestionLedger,
} from "../src/ai-sales-concierge/memory.mjs";

const migration = await readFile(new URL("../supabase/migrations/20260913230000_whatsapp_human_reply_concierge_memory.sql", import.meta.url), "utf8");
const edgeFunction = await readFile(new URL("../supabase/functions/send-whatsapp-message/index.ts", import.meta.url), "utf8");
const app = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");

function turn(messageBody, overrides = {}) {
  return buildSalesConciergeTurn({
    channel: "whatsapp",
    mode: "ai_active",
    language: "en",
    messageBody,
    intent: null,
    service: null,
    stage: "new",
    score: 0,
    fearOfWater: null,
    humanRequired: false,
    recentMessages: [],
    questionLedger: { questions_asked: [], questions_answered: [], known_facts: {} },
    knownFacts: {},
    ...overrides,
  });
}

test("migration adds additive memory columns and staff alert dedup", () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS customer_memory jsonb/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS question_ledger jsonb/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.staff_alerts/);
  assert.match(migration, /staff_alerts_open_dedup_idx/);
  assert.doesNotMatch(migration, /DROP TABLE/i);
  assert.doesNotMatch(migration, /DROP COLUMN/i);
});

test("edge function defaults to dry run and never exposes secrets in repo", () => {
  assert.match(edgeFunction, /WHATSAPP_SEND_DRY_RUN/);
  assert.match(edgeFunction, /dry_run_/);
  assert.match(edgeFunction, /ALLOWED_ROLES/);
  assert.doesNotMatch(edgeFunction, /sb_secret_|access_token\s*=\s*['"]/i);
});

test("customer says age once and AI does not ask age again", () => {
  const extracted = extractFactsFromMessage("My son is 7 years old");
  assert.equal(extracted.child_age, "7");

  const first = turn("My son is 7 years old", {
    intent: "concierge:awaiting_fear_of_water",
    service: "private",
    stage: "qualified",
    questionLedger: updateQuestionLedger(null, { answered: ["child_age"] }),
    knownFacts: { child_age: "7" },
  });

  assert.doesNotMatch(first.draftReply ?? "", /how old|what age|كم عمر|سنة/i);
});

test("customer answers location and AI does not ask location again", () => {
  const extracted = extractFactsFromMessage("We are in Dubai Marina");
  assert.ok(extracted.location);

  const decision = shouldAskQuestion(
    "location",
    { location: extracted.location },
    updateQuestionLedger(null, { answered: ["location"] }),
  );
  assert.equal(decision, "skip");
});

test("customer says I already told you routes to human_required", () => {
  const result = turn("I already told you that", {
    recentCustomerMessages: ["My son is 7"],
    questionLedger: updateQuestionLedger(null, { answered: ["child_age"] }),
    knownFacts: { child_age: "7" },
  });

  assert.equal(result.humanHandoff, true);
  assert.equal(result.handoffReason, "customer_already_told");
  assert.equal(result.draftReply, null);
});

test("customer requests human routes to human_required", () => {
  const result = turn("I want to speak to a real person");
  assert.equal(result.humanHandoff, true);
  assert.equal(result.handoffReason, "customer_requested_human");
  assert.equal(result.draftReply, null);
});

test("contradictory age asks for clarification instead of overwrite", () => {
  const merged = mergeKnownFacts({ child_age: "7" }, { child_age: "9" });
  assert.equal(merged.conflicts.length, 1);
  assert.equal(merged.knownFacts.child_age, "7");

  const result = turn("He is 9 years old", {
    knownFacts: { child_age: "7" },
    questionLedger: updateQuestionLedger(null, { answered: ["child_age"] }),
  });
  assert.equal(result.needsClarification, true);
  assert.match(result.draftReply ?? "", /clarify|توضيح/i);
});

test("human takeover prevents AI draft", () => {
  const result = turn("Hello", { mode: "human_takeover" });
  assert.equal(result.skipped, true);
  assert.equal(result.draftReply, null);
});

test("human reply UI uses edge function and dedicated takeover RPCs", () => {
  assert.match(app, /send-whatsapp-message/);
  assert.match(app, /take_over_staff_conversation/);
  assert.match(app, /return_staff_conversation_to_ai/);
  assert.match(app, /\["super_admin", "admin", "reception", "content_manager"\]\.includes\(session\.role\)/);
});

test("unauthorized coach role cannot send whatsapp replies in UI gate", () => {
  assert.match(app, /canSendReply = \["super_admin", "admin", "reception", "content_manager"\]/);
  assert.match(app, /canWriteMode = \["super_admin", "admin", "reception", "coach"\]/);
});

test("return to AI action is wired in inbox UI", () => {
  assert.match(app, /returnConversationToAi/);
  assert.match(app, /returnToAiButton/);
});

test("existing concierge behavior still works for pricing guardrails", () => {
  const result = turn("How much does it cost?");
  assert.match(result.draftReply, /150 AED instead of 200 AED/);
  assert.equal(result.outboundEnabled, false);
});

test("memory merge stays additive and does not guess unknown facts", () => {
  const memory = applyMemoryToConciergeInput({
    messageBody: "Hello",
    questionLedger: { questions_asked: [], questions_answered: [], known_facts: {} },
    knownFacts: {},
    recentCustomerMessages: [],
  });
  assert.deepEqual(memory.extracted, { preferred_language: "en" });
});

test("question ledger tracks answered child_age from Arabic message", () => {
  const extracted = extractFactsFromMessage("ابني عنده 7 سنين", "ar");
  assert.equal(extracted.child_age, "7");
  const ledger = updateQuestionLedger(null, { answered: inferAnswered(extracted) });
  assert.ok(ledger.questions_answered.includes("child_age"));
});

function inferAnswered(extracted) {
  return Object.keys(extracted);
}
