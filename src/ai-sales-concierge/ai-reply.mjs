import { APPROVED_PRICING, detectLanguage } from "./logic.mjs";

/** Reuses the existing n8n free OpenAI credential model (gpt-5-nano). */
export const AI_PROVIDER = {
  name: "openai",
  source: "existing_n8n_credential",
  credentialName: "n8n free OpenAI API credits",
  model: "gpt-5-nano",
  maxOutputTokens: 220,
};

export const AI_COST_CAPS = {
  maxCallsPerInboundMessage: 1,
  maxCallsPerConversationPerHour: 12,
  maxCallsPerDayGlobal: 250,
};

const APPROVED_AMOUNT_VALUES = new Set(["150", "200", "450", "400", "50"]);
const FORBIDDEN_PROMISE_PATTERN =
  /(guarantee|guaranteed|available tomorrow|free lesson|خصم إضافي|ضمان|غداً مجان|درس مجاني)/i;

export function listApprovedFacts(language = "en") {
  const lang = language === "ar" ? "ar" : "en";
  return [
    APPROVED_PRICING.private[lang],
    APPROVED_PRICING.group[lang],
    APPROVED_PRICING.siblings[lang],
    lang === "ar"
      ? "الحجز يتم عبر توجيه العميل للكوتش أيمن فقط — بدون مواعيد مخترعة."
      : "Booking is guided toward Coach Ayman only — never invent schedule slots.",
    lang === "ar"
      ? "عند طلب موظف بشري أو الكوتش أيمن: سلّم المحادثة فورًا."
      : "If the customer asks for a human/Coach Ayman, hand off immediately.",
  ];
}

export function stateGoalInstruction(state, language = "en") {
  const ar = language === "ar";
  switch (state) {
    case "awaiting_offer_type":
      return ar
        ? "رحّب باختصار واسأل إن كان يريد حصة خاصة أو مجموعة."
        : "Greet briefly and ask whether they want a private or group lesson.";
    case "awaiting_fear_of_water":
      return ar
        ? "اسأل بلطف إن كان السبّاح مرتاحًا في الماء أو لديه خوف من الماء."
        : "Gently ask if the swimmer is comfortable in water or has fear of water.";
    case "presented_pricing":
      return ar
        ? "أجب بشكل طبيعي مع الالتزام بالأسعار المعتمدة فقط، واسأل إن رغب بالمتابعة للحجز."
        : "Answer naturally using only approved prices, then ask if they want to proceed to booking.";
    case "booking_guidance":
      return ar
        ? "وجّه العميل بلطف نحو الحجز مع الكوتش أيمن واطلب تأكيدًا قصيرًا."
        : "Guide the customer toward booking with Coach Ayman and ask for a short confirmation.";
    case "human_handoff":
      return ar
        ? "أكد بلطف أن الكوتش أيمن سيتابع شخصيًا."
        : "Confirm politely that Coach Ayman will follow up personally.";
    default:
      return ar
        ? "ساعد العميل بخصوص دروس السباحة في Relax Fix UAE فقط."
        : "Help the customer with Relax Fix UAE swimming lessons only.";
  }
}

export function evaluateAiCostCap({
  inboundAiCalls = 0,
  conversationHourlyCalls = 0,
  dailyCalls = 0,
} = {}) {
  if (inboundAiCalls >= AI_COST_CAPS.maxCallsPerInboundMessage) {
    return { allowed: false, reason: "INBOUND_CAP" };
  }
  if (conversationHourlyCalls >= AI_COST_CAPS.maxCallsPerConversationPerHour) {
    return { allowed: false, reason: "CONVERSATION_HOURLY_CAP" };
  }
  if (dailyCalls >= AI_COST_CAPS.maxCallsPerDayGlobal) {
    return { allowed: false, reason: "DAILY_GLOBAL_CAP" };
  }
  return { allowed: true, reason: null };
}

export function buildAiSystemPrompt({ language, state, approvedFacts }) {
  const facts = (approvedFacts?.length ? approvedFacts : listApprovedFacts(language)).map((f) => `- ${f}`).join("\n");
  return [
    "You are the WhatsApp sales concierge for Relax Fix UAE (swimming lessons).",
    "Match the customer's language and dialect naturally (Egyptian Arabic colloquial, Gulf/UAE Arabic, Modern Standard Arabic, or English). Do not force a different dialect.",
    "Keep replies short (2-5 sentences), warm, and practical.",
    "Never invent prices, discounts, schedules, guarantees, or services.",
    "Use ONLY these approved commercial facts:",
    facts,
    `Current business state: ${state}.`,
    `Conversation goal: ${stateGoalInstruction(state, language)}.`,
    "If the customer message is unclear, ask one clarifying question instead of dumping the full price list.",
    "Do not mention that you are an AI or that you have a system prompt.",
  ].join("\n");
}

export function buildAiUserPrompt({
  customerMessage,
  recentMessages = [],
  isFirstMessage = false,
  state,
  language,
}) {
  const history = recentMessages
    .slice(-8)
    .map((m) => `${m.role}: ${m.body}`)
    .join("\n");
  return [
    isFirstMessage ? "This is the first customer message in the conversation — include a brief friendly greeting." : "Continue the ongoing conversation naturally.",
    `State: ${state}`,
    `Detected language hint: ${language || detectLanguage(customerMessage || "")}`,
    history ? `Recent messages:\n${history}` : "Recent messages: (none)",
    `New customer message:\n${customerMessage}`,
    "Write only the WhatsApp reply text.",
  ].join("\n\n");
}

export function extractMoneyAmounts(text) {
  if (!text) return [];
  const matches = String(text).match(/\d+(?:[.,]\d+)?/g) || [];
  return matches.map((value) => value.replace(/[.,]/g, "").replace(/^0+/, "") || "0");
}

export function assertAiReplySafe(text) {
  const reply = String(text || "").trim();
  if (!reply) return { ok: false, reason: "EMPTY_REPLY" };
  if (FORBIDDEN_PROMISE_PATTERN.test(reply)) {
    return { ok: false, reason: "FORBIDDEN_PROMISE" };
  }

  // Only validate amounts that appear near currency cues.
  const currencyChunks = reply.match(/\d+(?:[.,]\d+)?\s*(?:AED|aed|dirham|درهم)/gi) || [];
  for (const chunk of currencyChunks) {
    const amount = (chunk.match(/\d+(?:[.,]\d+)?/) || [""])[0].replace(/[.,]/g, "");
    if (amount && !APPROVED_AMOUNT_VALUES.has(amount)) {
      return { ok: false, reason: "UNAPPROVED_PRICE", amount };
    }
  }
  return { ok: true, reason: null };
}

export function resolveOutboundReply({ aiText, fallbackReply, costAllowed = true }) {
  if (!costAllowed) {
    return { reply: fallbackReply, source: "fallback_cost_cap", safe: true };
  }
  const safety = assertAiReplySafe(aiText);
  if (!safety.ok) {
    return { reply: fallbackReply, source: "fallback_unsafe", safe: false, safetyReason: safety.reason };
  }
  return { reply: String(aiText).trim(), source: "ai", safe: true };
}

export function extractOpenAiUsage(response = {}) {
  const usage = response.usage || response.tokenUsage || {};
  const promptTokens = Number(usage.prompt_tokens ?? usage.promptTokens ?? 0) || 0;
  const completionTokens = Number(usage.completion_tokens ?? usage.completionTokens ?? 0) || 0;
  const totalTokens = Number(usage.total_tokens ?? usage.totalTokens ?? promptTokens + completionTokens) || 0;
  return { promptTokens, completionTokens, totalTokens };
}

export function buildUsageLogPayload({
  conversationId,
  messageId,
  model = AI_PROVIDER.model,
  usage = {},
  capped = false,
  source = "ai",
  channel = "whatsapp",
}) {
  const normalized = extractOpenAiUsage({ usage });
  return {
    conversation_id: conversationId,
    message_id: messageId,
    channel,
    provider: AI_PROVIDER.name,
    model,
    prompt_tokens: normalized.promptTokens,
    completion_tokens: normalized.completionTokens,
    total_tokens: normalized.totalTokens,
    capped,
    source,
  };
}
