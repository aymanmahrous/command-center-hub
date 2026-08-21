import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { APPROVED_PRICING, buildSalesConciergeTurn, detectLanguage } from "../src/ai-sales-concierge/logic.mjs";

const migration = await readFile(
  new URL("../supabase/migrations/20260813003000_ai_concierge_current_message_intent.sql", import.meta.url),
  "utf8",
);

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
    ...overrides,
  });
}

test("migration defines current-message concierge RPC without outbound send", () => {
  assert.match(migration, /process_ai_sales_concierge_turn/);
  assert.match(migration, /priorState/);
  assert.match(migration, /outboundEnabled', false/);
  assert.match(migration, /150 AED instead of 200 AED/);
  assert.match(migration, /450 AED/);
  assert.match(migration, /400 AED instead of 450 AED/);
  assert.match(migration, /لن أقدّم نصيحة طبية/);
  assert.match(migration, /exact training location/);
  assert.doesNotMatch(migration, /graph\.facebook\.com/);
  assert.doesNotMatch(migration, /messaging_product/);
});

test("language detection supports Arabic and English", () => {
  assert.equal(detectLanguage("Hello, how much is a private lesson?"), "en");
  assert.equal(detectLanguage("مرحبا، كم سعر الحصة الخاصة؟"), "ar");
});

test("Arabic greeting resets stale presented_pricing", () => {
  const result = turn("صباح الخير", { intent: "concierge:presented_pricing", stage: "contacted" });
  assert.equal(result.language, "ar");
  assert.equal(result.nextIntent, "concierge:awaiting_offer_type");
  assert.match(result.draftReply, /حصة خاصة أم مجموعة/);
  assert.doesNotMatch(result.draftReply, /150 درهم/);
});

test("English greeting does not reuse pricing", () => {
  const result = turn("Good morning", { intent: "concierge:presented_pricing", stage: "contacted" });
  assert.equal(result.language, "en");
  assert.equal(result.nextIntent, "concierge:awaiting_offer_type");
  assert.match(result.draftReply, /private lesson or a group lesson/i);
  assert.doesNotMatch(result.draftReply, /150 AED/);
});

test("pricing guardrails stay within approved commercial facts", () => {
  const en = turn("How much does it cost?", { intent: "concierge:awaiting_offer_type" });
  assert.equal(en.nextIntent, "concierge:presented_pricing");
  assert.match(en.draftReply, /150 AED instead of 200 AED/);
  assert.match(en.draftReply, /450 AED/);
  assert.match(en.draftReply, /400 AED instead of 450 AED/);
  assert.doesNotMatch(en.draftReply, /300 AED|500 AED|guarantee|available tomorrow/i);

  const ar = turn("كم الاسعار", { intent: "concierge:presented_pricing", stage: "contacted" });
  assert.equal(ar.language, "ar");
  assert.equal(ar.nextIntent, "concierge:presented_pricing");
  assert.match(ar.draftReply, /150 درهم بدل 200 درهم/);
  assert.match(ar.draftReply, /450 درهم/);
  assert.match(ar.draftReply, /400 درهم بدل 450 درهم/);
});

test("location question hands off without inventing an address", () => {
  const result = turn("فين = الموقع", { intent: "concierge:presented_pricing", stage: "contacted" });
  assert.equal(result.humanHandoff, true);
  assert.match(result.draftReply, /موقع التدريب|Coach Ayman/i);
  assert.doesNotMatch(result.draftReply, /Dubai Marina|Jumeirah|Abu Dhabi|شارع/);
  assert.equal(result.outboundEnabled, false);
});

test("medical concern hands off without medical advice", () => {
  const result = turn("بس انا مريض", { intent: "concierge:presented_pricing", stage: "contacted" });
  assert.equal(result.humanHandoff, true);
  assert.match(result.draftReply, /لن أقدّم نصيحة طبية|won't give medical advice/i);
  assert.doesNotMatch(result.draftReply, /150 درهم|450 درهم/);
});

test("نعم after offer advances to booking guidance", () => {
  const result = turn("نعم", { intent: "concierge:presented_pricing", stage: "contacted", service: "private" });
  assert.equal(result.nextIntent, "concierge:booking_guidance");
  assert.equal(result.nextStage, "booking_intent");
  assert.match(result.draftReply, /كوتش أيمن|Coach Ayman/i);
  assert.doesNotMatch(result.draftReply, /150 درهم|150 AED/);
});

test("qualification asks short offer-type question before pricing", () => {
  const result = turn("Hi");
  assert.equal(result.nextIntent, "concierge:awaiting_offer_type");
  assert.match(result.draftReply, /private lesson or a group lesson/i);
});

test("human handoff routes to Coach Ayman without enabling outbound", () => {
  const result = turn("I want to speak to Coach Ayman");
  assert.equal(result.humanHandoff, true);
  assert.match(result.draftReply, /Coach Ayman/i);
  assert.equal(result.outboundEnabled, false);
});

test("booking guidance advances lead stage intent", () => {
  const booking = turn("I want to book", {
    intent: "concierge:presented_pricing",
    service: "private",
    stage: "qualified",
  });
  assert.equal(booking.nextStage, "booking_intent");
  assert.match(booking.draftReply, /Coach Ayman/i);
});

test("approved pricing constants are frozen", () => {
  assert.equal(APPROVED_PRICING.private.en.includes("150 AED"), true);
  assert.equal(APPROVED_PRICING.group.en.includes("450 AED"), true);
  assert.equal(APPROVED_PRICING.siblings.en.includes("400 AED"), true);
});

test("non-ai-active conversations are skipped safely", () => {
  const result = turn("Hello", { mode: "human_takeover" });
  assert.equal(result.skipped, true);
  assert.equal(result.draftReply, null);
});

test("unknown question after pricing becomes safe handoff", () => {
  const result = turn("What about Saturday night party package?", {
    intent: "concierge:presented_pricing",
    stage: "contacted",
  });
  assert.equal(result.humanHandoff, true);
  assert.match(result.draftReply, /Coach Ayman/i);
  assert.doesNotMatch(result.draftReply, /150 AED/);
});
