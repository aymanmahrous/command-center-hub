import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildSalesConciergeTurn, detectLanguage, resolveMediaKind } from "../src/ai-sales-concierge/logic.mjs";

const ingressMigration = await readFile(new URL("../supabase/migrations/20260811120000_whatsapp_multimodal_ingress_phase6c.sql", import.meta.url), "utf8");
const conciergeMigration = await readFile(new URL("../supabase/migrations/20260811120100_ai_concierge_multimodal_phase6c.sql", import.meta.url), "utf8");

function turn(messageBody, overrides = {}) {
  return buildSalesConciergeTurn({
    channel: "whatsapp",
    mode: "ai_active",
    language: "en",
    messageBody,
    safetyClassification: null,
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

test("ingress migration accepts image and audio metadata without media download", () => {
  assert.match(ingressMigration, /v_message_type = 'image'/);
  assert.match(ingressMigration, /whatsapp_image/);
  assert.match(ingressMigration, /whatsapp_audio/);
  assert.match(ingressMigration, /messageType/);
  assert.doesNotMatch(ingressMigration, /graph\.facebook\.com/);
});

test("concierge migration stays draft-only and exposes mediaKind", () => {
  assert.match(conciergeMigration, /mediaKind/);
  assert.match(conciergeMigration, /awaiting_image_context/);
  assert.match(conciergeMigration, /awaiting_audio_followup/);
  assert.match(conciergeMigration, /author_type, body, safety_classification/);
  assert.match(conciergeMigration, /'ai'/);
  assert.match(conciergeMigration, /outboundEnabled', false/);
});

test("text behavior remains unchanged", () => {
  const result = turn("How much does it cost?");
  assert.equal(resolveMediaKind(null), "text");
  assert.match(result.draftReply, /150 AED instead of 200 AED/);
  assert.equal(result.outboundEnabled, false);
});

test("image without caption asks contextual follow-up", () => {
  const result = turn("[Customer sent an image]", { safetyClassification: "whatsapp_image" });
  assert.equal(result.mediaKind, "image");
  assert.equal(result.detectedIntent, "awaiting_image_context");
  assert.match(result.draftReply, /private lessons|حصص خاصة/i);
});

test("image caption with pricing uses approved offers", () => {
  const result = turn("كم سعر الحصة الخاصة؟", { safetyClassification: "whatsapp_image" });
  assert.equal(detectLanguage("كم سعر الحصة الخاصة؟"), "ar");
  assert.match(result.draftReply, /150 درهم بدل 200 درهم/);
});

test("audio requests text follow-up without claiming transcription", () => {
  const result = turn("[Customer sent a voice note]", { safetyClassification: "whatsapp_audio" });
  assert.equal(result.mediaKind, "audio");
  assert.match(result.draftReply, /voice note|رسالتك الصوتية/i);
  assert.match(result.draftReply, /text message|رسالة نصية/i);
  assert.doesNotMatch(result.draftReply, /transcri/i);
});

test("audio follow-up can escalate to Coach Ayman", () => {
  const first = turn("[Customer sent a voice note]", { safetyClassification: "whatsapp_audio" });
  const second = turn("Coach Ayman", {
    safetyClassification: null,
    intent: first.nextIntent,
    stage: first.nextStage,
    score: first.nextScore,
  });
  assert.equal(second.humanHandoff, true);
  assert.match(second.draftReply, /Coach Ayman/i);
});
