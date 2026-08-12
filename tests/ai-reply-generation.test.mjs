import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  AI_COST_CAPS,
  AI_PROVIDER,
  assertAiReplySafe,
  buildAiSystemPrompt,
  buildAiUserPrompt,
  buildOpenAiMultimodalRequest,
  buildUsageLogPayload,
  evaluateAiCostCap,
  extractInboundImageFromWhatsAppMessage,
  resolveOutboundReply,
} from "../src/ai-sales-concierge/ai-reply.mjs";
import { buildSalesConciergeTurn } from "../src/ai-sales-concierge/logic.mjs";

const migration = await readFile(
  new URL("../supabase/migrations/20260812001000_ai_sales_concierge_openai_generation.sql", import.meta.url),
  "utf8",
);
const imageIngressMigration = await readFile(
  new URL("../supabase/migrations/20260812010000_whatsapp_image_ingress_for_vision.sql", import.meta.url),
  "utf8",
);
const phoneNumberIdMigration = await readFile(
  new URL("../supabase/migrations/20260812040500_whatsapp_phone_number_id_1276699008856128.sql", import.meta.url),
  "utf8",
);

test("reuses existing n8n free OpenAI provider settings", () => {
  assert.equal(AI_PROVIDER.source, "existing_n8n_credential");
  assert.equal(AI_PROVIDER.model, "gpt-5-nano");
  assert.match(AI_PROVIDER.credentialName, /free OpenAI/i);
});

test("cost caps block extra inbound retries and hourly/daily overuse", () => {
  assert.deepEqual(evaluateAiCostCap({ inboundAiCalls: 0 }), { allowed: true, reason: null });
  assert.equal(evaluateAiCostCap({ inboundAiCalls: 1 }).allowed, false);
  assert.equal(evaluateAiCostCap({ inboundAiCalls: 1 }).reason, "INBOUND_CAP");
  assert.equal(
    evaluateAiCostCap({ conversationHourlyCalls: AI_COST_CAPS.maxCallsPerConversationPerHour }).reason,
    "CONVERSATION_HOURLY_CAP",
  );
  assert.equal(
    evaluateAiCostCap({ dailyCalls: AI_COST_CAPS.maxCallsPerDayGlobal }).reason,
    "DAILY_GLOBAL_CAP",
  );
});

test("prompt builder supports English, Egyptian dialect, and Gulf dialect customer messages", () => {
  const en = buildSalesConciergeTurn({
    mode: "ai_active",
    stage: "new",
    score: 0,
    messageBody: "How much for a private lesson?",
    intent: null,
    service: null,
    fearOfWater: null,
    recentMessages: [],
  });
  assert.equal(en.language, "en");
  assert.equal(en.aiGenerationAllowed, true);
  assert.ok(en.aiContext.approvedFacts.some((f) => /150 AED/.test(f)));

  const enPrompt = buildAiUserPrompt({
    customerMessage: "How much for a private lesson?",
    recentMessages: [],
    isFirstMessage: true,
    state: en.detectedIntent,
    language: en.language,
  });
  assert.match(enPrompt, /friendly greeting/i);
  assert.match(enPrompt, /How much for a private lesson/);

  const arSystem = buildAiSystemPrompt({
    language: "ar",
    state: "presented_pricing",
    approvedFacts: en.aiContext.approvedFacts,
  });
  assert.match(arSystem, /Egyptian Arabic colloquial/i);
  assert.match(arSystem, /Gulf\/UAE Arabic/i);
  assert.match(arSystem, /English/i);
  assert.match(arSystem, /150 AED/);
  assert.doesNotMatch(arSystem, /custom dialect-detection|detect dialect/i);

  const egyptian = buildAiUserPrompt({
    customerMessage: "عامل ايه؟ عايز أعرف سعر الحصة الخاصة كام؟",
    recentMessages: [],
    isFirstMessage: true,
    state: "presented_pricing",
    language: "ar",
  });
  assert.match(egyptian, /عامل ايه\؟ عايز أعرف سعر الحصة الخاصة كام\؟/);
  assert.match(egyptian, /friendly greeting/i);

  const gulf = buildAiUserPrompt({
    customerMessage: "السلام عليكم، بكم الحصة الخاصة ياخوي؟",
    recentMessages: [{ role: "customer", body: "مرحبا" }],
    isFirstMessage: false,
    state: "presented_pricing",
    language: "ar",
  });
  assert.match(gulf, /بكم الحصة الخاصة ياخوي/);
  assert.doesNotMatch(gulf, /friendly greeting/i);

  // Guardrails remain deterministic for dialect pricing asks.
  const egyptianTurn = buildSalesConciergeTurn({
    mode: "ai_active",
    stage: "new",
    score: 0,
    messageBody: "كام سعر الخاص؟",
    intent: null,
    service: null,
    fearOfWater: null,
  });
  assert.match(egyptianTurn.fallbackReply, /150 درهم بدل 200 درهم/);
});

test("unsafe AI prices fall back to deterministic guardrail reply", () => {
  const turn = buildSalesConciergeTurn({
    mode: "ai_active",
    stage: "contacted",
    score: 0,
    messageBody: "price please",
    intent: null,
    service: null,
    fearOfWater: null,
  });
  assert.match(turn.fallbackReply, /150 AED instead of 200 AED/);

  assert.equal(assertAiReplySafe("Private lesson only 99 AED today").ok, false);
  assert.equal(assertAiReplySafe("Private lesson: 150 AED instead of 200 AED").ok, true);

  const rejected = resolveOutboundReply({
    aiText: "Special deal 99 AED guaranteed available tomorrow",
    fallbackReply: turn.fallbackReply,
    costAllowed: true,
  });
  assert.equal(rejected.source, "fallback_unsafe");
  assert.match(rejected.reply, /150 AED instead of 200 AED/);
  assert.doesNotMatch(rejected.reply, /99 AED/);

  const accepted = resolveOutboundReply({
    aiText: "Private lesson is 150 AED instead of 200 AED. Want to book?",
    fallbackReply: turn.fallbackReply,
    costAllowed: true,
  });
  assert.equal(accepted.source, "ai");
  assert.match(accepted.reply, /150 AED instead of 200 AED/);

  const capped = resolveOutboundReply({
    aiText: accepted.reply,
    fallbackReply: turn.fallbackReply,
    costAllowed: false,
  });
  assert.equal(capped.source, "fallback_cost_cap");
  assert.equal(capped.reply, turn.fallbackReply);
});

test("usage log payload tracks tokens for cost monitoring", () => {
  const payload = buildUsageLogPayload({
    conversationId: "11111111-1111-1111-1111-111111111111",
    messageId: "22222222-2222-2222-2222-222222222222",
    usage: { prompt_tokens: 120, completion_tokens: 40, total_tokens: 160 },
    capped: false,
    source: "ai",
  });
  assert.equal(payload.provider, "openai");
  assert.equal(payload.model, "gpt-5-nano");
  assert.equal(payload.total_tokens, 160);
  assert.equal(payload.capped, false);
});

test("openai generation migration adds usage table and budget RPCs", () => {
  assert.match(migration, /ai_concierge_usage_logs/);
  assert.match(migration, /claim_ai_concierge_generation/);
  assert.match(migration, /log_ai_concierge_usage/);
  assert.match(migration, /INBOUND_CAP/);
  assert.match(migration, /gpt-5-nano/);
});

test("image input uses same OpenAI provider with vision prompt and price guardrails", () => {
  const inbound = extractInboundImageFromWhatsAppMessage({
    type: "image",
    image: {
      id: "media-123",
      mime_type: "image/jpeg",
      caption: "is this pool okay for lessons?",
    },
  });
  assert.equal(inbound.hasImage, true);
  assert.equal(inbound.mediaId, "media-123");
  assert.equal(inbound.customerMessage, "is this pool okay for lessons?");

  const turn = buildSalesConciergeTurn({
    mode: "ai_active",
    stage: "new",
    score: 0,
    messageBody: inbound.customerMessage,
    intent: null,
    service: null,
    fearOfWater: null,
  });

  const systemPrompt = buildAiSystemPrompt({
    language: turn.language,
    state: turn.detectedIntent,
    approvedFacts: turn.aiContext.approvedFacts,
    hasImage: true,
  });
  assert.match(systemPrompt, /attached an image/i);
  assert.match(systemPrompt, /150 AED/);

  const userPrompt = buildAiUserPrompt({
    customerMessage: inbound.customerMessage,
    recentMessages: [],
    isFirstMessage: true,
    state: turn.detectedIntent,
    language: turn.language,
    hasImage: true,
    imageCaption: inbound.caption,
  });
  assert.match(userPrompt, /is this pool okay for lessons/i);
  assert.match(userPrompt, /includes an image/i);

  const request = buildOpenAiMultimodalRequest({
    systemPrompt,
    userPrompt,
    imageDataUrl: "data:image/jpeg;base64,aaa",
  });
  assert.equal(request.credentialName, "n8n free OpenAI API credits");
  assert.equal(request.model, "gpt-5-nano");
  assert.equal(request.mode, "image_analyze");
  assert.equal(request.hasImage, true);

  // Same 1-call cap and unsafe-price fallback still apply for image replies.
  assert.equal(evaluateAiCostCap({ inboundAiCalls: 1 }).allowed, false);
  const rejected = resolveOutboundReply({
    aiText: "This pool is perfect and only 99 AED guaranteed.",
    fallbackReply: turn.fallbackReply,
    costAllowed: true,
  });
  assert.equal(rejected.source, "fallback_unsafe");
  assert.doesNotMatch(rejected.reply, /99 AED/);
});

test("image ingress migration accepts images only and skips audio/voice", () => {
  assert.match(imageIngressMigration, /1276699008856128/);
  assert.match(imageIngressMigration, /'text', 'image'/);
  assert.match(imageIngressMigration, /whatsapp_image/);
  assert.match(imageIngressMigration, /mediaId/);
  assert.match(imageIngressMigration, /STT not approved|Audio\/voice remain unsupported/i);
  assert.doesNotMatch(imageIngressMigration, /'audio'|'voice'/);
});
