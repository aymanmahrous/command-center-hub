import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { APPROVED_PRICING, buildSalesConciergeTurn, detectLanguage } from "../src/ai-sales-concierge/logic.mjs";

const migration = await readFile(
  new URL("../supabase/migrations/20260814023000_ai_concierge_sales_assistant.sql", import.meta.url),
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

test("migration defines unified concierge RPC without outbound send", () => {
  assert.match(migration, /process_ai_sales_concierge_turn/);
  assert.match(migration, /author_type,\s*body,\s*safety_classification/);
  assert.match(migration, /outboundEnabled',\s*false/);
  assert.match(migration, /150 AED instead of 200 AED/);
  assert.match(migration, /450 AED/);
  assert.match(migration, /400 AED instead of 450 AED/);
  assert.match(migration, /booking_ask_count/);
  assert.match(migration, /conversationLocked/);
  assert.doesNotMatch(migration, /send.*whatsapp/i);
});

test("language detection supports Arabic and English", () => {
  assert.equal(detectLanguage("Hello, how much is a private lesson?"), "en");
  assert.equal(detectLanguage("مرحبا، كم سعر الحصة الخاصة؟"), "ar");
});

test("pricing guardrails stay within approved commercial facts", () => {
  const en = turn("How much does it cost?");
  assert.match(en.draftReply, /150 AED instead of 200 AED/);
  assert.match(en.draftReply, /450 AED/);
  assert.match(en.draftReply, /400 AED instead of 450 AED/);
  assert.doesNotMatch(en.draftReply, /300 AED|500 AED|guarantee|available tomorrow/i);

  const ar = turn("كم السعر؟");
  assert.match(ar.draftReply, /150 درهم بدل 200 درهم/);
  assert.match(ar.draftReply, /450 درهم/);
  assert.match(ar.draftReply, /400 درهم بدل 450 درهم/);
});

test("scoped private pricing does not invent group-only extras", () => {
  const result = turn("comfortable in water", {
    intent: "concierge:awaiting_fear_of_water",
    service: "private",
    stage: "qualified",
    fearOfWater: null,
  });
  assert.equal(result.nextIntent, "concierge:presented_pricing");
  assert.match(result.draftReply, /150 AED instead of 200 AED/);
  assert.doesNotMatch(result.draftReply, /450 AED/);
});

test("qualification asks short offer-type question before pricing", () => {
  const result = turn("Hi");
  assert.equal(result.nextIntent, "concierge:awaiting_offer_type");
  assert.match(result.draftReply, /private lesson or a group lesson/i);
});

test("human handoff routes to Coach Ayman without enabling outbound", () => {
  const result = turn("I want to speak to Coach Ayman");
  assert.equal(result.nextIntent, "concierge:human_handoff");
  assert.match(result.draftReply, /Coach Ayman/i);
  assert.equal(result.outboundEnabled, false);
  // Prepare nodes gate on humanHandoff; keep false so the draft can be delivered.
  assert.equal(result.humanHandoff, false);
});

test("booking interest collects count one question at a time", () => {
  const fear = turn("private lesson", { intent: "concierge:awaiting_offer_type", stage: "contacted" });
  assert.equal(fear.nextIntent, "concierge:awaiting_fear_of_water");
  assert.equal(fear.nextService, "private");

  const priced = turn("مرتاح", {
    intent: fear.nextIntent,
    service: fear.nextService,
    stage: fear.nextStage,
    score: fear.nextScore,
  });
  assert.equal(priced.nextIntent, "concierge:presented_pricing");
  assert.match(priced.draftReply, /150 درهم بدل 200 درهم/);

  const booking = turn("أريد الحجز", {
    intent: priced.nextIntent,
    service: priced.nextService,
    stage: priced.nextStage,
    score: priced.nextScore,
    fearOfWater: false,
  });
  assert.equal(booking.nextStage, "booking_intent");
  assert.equal(booking.nextIntent, "concierge:booking_ask_count");
  assert.match(booking.draftReply, /كم شخص/);

  const count = turn("2", {
    intent: booking.nextIntent,
    service: booking.nextService,
    stage: booking.nextStage,
    score: booking.nextScore,
    fearOfWater: false,
    language: booking.language,
  });
  assert.equal(count.nextIntent, "concierge:booking_ask_timing");
  assert.match(count.draftReply, /صباح|مساء|نهاية الأسبوع/);
});

test("mid-funnel greeting keeps conversation context", () => {
  const result = turn("السلام عليكم", {
    intent: "concierge:presented_pricing",
    service: "private",
    stage: "qualified",
    fearOfWater: false,
    recentMessages: [{ role: "assistant", direction: "outbound" }],
  });
  assert.equal(result.nextIntent, "concierge:presented_pricing");
  assert.match(result.draftReply, /150 درهم بدل 200 درهم/);
});

test("location ask without area prompts once then resolves nearest pool", () => {
  const ask = turn("وين أقرب مسبح؟");
  assert.equal(ask.nextIntent, "concierge:awaiting_customer_area");
  assert.match(ask.draftReply, /منطقة/);

  const area = turn("البرشاء", { intent: ask.nextIntent, language: "ar" });
  assert.equal(area.nextIntent, "concierge:presented_nearest_pool");
  assert.match(area.draftReply, /ICS|مشرف|الفلاح|نجدة|maps\.app\.goo\.gl/i);
  assert.doesNotMatch(area.draftReply, /dubai marina|jbr|invent/i);
});

test("english area resolves a real pool map link", () => {
  const result = turn("I'm in JVC, what's the nearest location?");
  assert.equal(result.nextIntent, "concierge:presented_nearest_pool");
  assert.match(result.draftReply, /Abu Dhabi/);
  assert.match(result.draftReply, /maps\.app\.goo\.gl/);
});

test("different areas can select different pools", () => {
  const falah = turn("انا في الفلاح");
  const mushrif = turn("أنا في المشرف");
  assert.equal(falah.nearestPoolId, "ics-al-falah");
  assert.equal(mushrif.nearestPoolId, "ics-mushrif");
  assert.notEqual(falah.nearestPoolId, mushrif.nearestPoolId);
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
