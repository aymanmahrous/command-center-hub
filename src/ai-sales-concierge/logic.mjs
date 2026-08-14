const APPROVED_PRICING = {
  private: {
    en: "Private lesson: 150 AED instead of 200 AED — limited-time offer.",
    ar: "حصة خاصة: 150 درهم بدل 200 درهم — عرض لفترة محدودة.",
  },
  group: {
    en: "Group lesson: up to 5 people — 450 AED.",
    ar: "حصة جماعية: حتى 5 أشخاص — 450 درهم.",
  },
  siblings: {
    en: "Siblings discount: 50 AED off per sibling. Example: eligible sibling group = 400 AED instead of 450 AED.",
    ar: "خصم الإخوة: 50 درهم لكل أخ/أخت. مثال: مجموعة إخوة مؤهلة = 400 درهم بدل 450 درهم.",
  },
};

const APPROVED_SERVICES = {
  en: "Relax Fix UAE offers swimming and water-confidence coaching with Coach Ayman: private lessons, group lessons (up to 5 people), and a siblings discount when eligible.",
  ar: "Relax Fix UAE يقدّم تدريب سباحة وبناء ثقة داخل الماء مع الكوتش أيمن: حصص خاصة، حصص جماعية (حتى 5 أشخاص)، وخصم إخوة عند الاستحقاق.",
};

const HUMAN_HANDOFF_PATTERN =
  /(human|person|coach|ayman|speak to someone|talk to someone|موظف|بشري|كوتش|أيمن|مدرب|تحدث مع)/i;
const MEDICAL_PATTERN =
  /(sick|ill|medical|doctor|health|injury|pain|hospital|مريض|مرض|دكتور|صحة|ألم|جرح|مستشفى|تعبان)/i;
const LOCATION_PATTERN =
  /(where|location|address|map|place|are you located|فين|وين|موقع|عنوان|مكان|الموقع)/i;
const PRICING_PATTERN = /(price|cost|how much|fee|aed|dirham|سعر|اسعار|الأسعار|الاسعار|تكلفة|درهم|كم\s*ال)/i;
const SERVICES_PATTERN =
  /(what do you offer|services|packages|what .+ provide|خدمات|وش عندكم|شو عندكم|ماذا تقدم|عروضكم|باقات)/i;
const PRIVATE_PATTERN = /(private|individual|one[\s-]?on[\s-]?one|خاص|فردي|حصة خاصة|بريفت|برايفت)/i;
const GROUP_PATTERN = /(group|family|up to 5|مجموعة|عائلة|جماعي)/i;
const SIBLING_PATTERN = /(sibling|brother|sister|brothers|sisters|إخوة|أخوات|أشقاء|أخ|أخت)/i;
const BOOKING_PATTERN = /(book|booking|reserve|appointment|subscribe|حجز|موعد|اشتراك|أحجز|احجز)/i;
const AFFIRMATIVE_PATTERN = /^(?:yes|yep|yeah|sure|ok|okay)\b|^(?:نعم|أيوه|ايوه|تمام|موافق|يب|أجل)(?:\s|$)/i;
const NEGATIVE_FEAR_PATTERN = /(fear|afraid|scared|خوف|خايف|خائف)/i;
const COMFORTABLE_PATTERN = /(comfortable|fine|no fear|not afraid|مرتاح|ما في خوف|لا خوف)/i;
const GREETING_PATTERN =
  /^(?:hi|hello|hey|good morning|good evening|good night)\b|^(?:السلام عليكم|عليكم السلام|سلام|مرحبا|مرحبًا|صباح الخير|مساء الخير|أهلا|اهلا|أهلان|اختبار النظام)(?:\s|$)/i;
const LEARN_PATTERN =
  /(learn|swim|lesson|training|class|أتعلم|اتعلم|تعلم|سباح|أعوم|اعوم|حصة|دورة|مش بعرف اعوم|ما بعرف اعوم|ما اعرف اعوم)/i;
const COUNT_PATTERN =
  /(?:\b([1-5])\b|one|two|three|four|five|واحد|واحدة|اتنين|اثنين|ثنين|ثلاثة|ثلاث|أربعة|اربعة|خمسة)/i;
const TIMING_PATTERN =
  /(morning|evening|afternoon|weekend|weekday|night|صباح|مساء|ظهر|ليل|نهاية الأسبوع|ويكند|أيام الأسبوع)/i;

export function detectLanguage(text, fallback = "en") {
  if (/[ء-ي]/.test(text)) return "ar";
  if (/[A-Za-z]/.test(text)) return "en";
  return fallback === "ar" ? "ar" : "en";
}

function inferLanguage(body, input) {
  if (/[ء-ي]/.test(body)) return "ar";
  if (/[A-Za-z]/.test(body)) return "en";
  const recent = Array.isArray(input.recentMessages) ? input.recentMessages : [];
  for (let i = recent.length - 1; i >= 0; i -= 1) {
    const text = String(recent[i]?.body || recent[i]?.text || "");
    if (/[ء-ي]/.test(text)) return "ar";
    if (/[A-Za-z]/.test(text)) return "en";
  }
  return input.language === "ar" ? "ar" : "en";
}

function t(language, en, ar) {
  return language === "ar" ? ar : en;
}

function parseConciergeState(intent) {
  if (!intent || !intent.startsWith("concierge:")) return "greeting";
  return intent.slice("concierge:".length) || "greeting";
}

function formatIntent(state) {
  return `concierge:${state}`;
}

function pricingForService(language, service) {
  if (service === "private") return APPROVED_PRICING.private[language];
  if (service === "group") return APPROVED_PRICING.group[language];
  if (service === "siblings") return APPROVED_PRICING.siblings[language];
  return [
    APPROVED_PRICING.private[language],
    APPROVED_PRICING.group[language],
    APPROVED_PRICING.siblings[language],
  ].join("\n");
}

function handoffResult({ language, service, stage, score, fearOfWater, draftReply, state = "human_handoff" }) {
  return {
    processed: true,
    skipped: false,
    language,
    detectedIntent: state,
    draftReply,
    nextIntent: formatIntent(state),
    nextService: service,
    nextStage: stage === "new" ? "contacted" : stage,
    nextScore: score + 10,
    nextFearOfWater: fearOfWater,
    // false so channel Prepare nodes still deliver the handoff draft;
    // live RPC locks the conversation via mode=human_required.
    humanHandoff: false,
    outboundEnabled: false,
  };
}

function extractCount(body) {
  const digit = body.match(/\b([1-5])\b/);
  if (digit) return digit[1];
  if (/(one|واحد|واحدة)/i.test(body)) return "1";
  if (/(two|اتنين|اثنين|ثنين)/i.test(body)) return "2";
  if (/(three|ثلاثة|ثلاث)/i.test(body)) return "3";
  if (/(four|أربعة|اربعة)/i.test(body)) return "4";
  if (/(five|خمسة)/i.test(body)) return "5";
  return null;
}

function extractTiming(body) {
  if (/(morning|صباح)/i.test(body)) return "morning";
  if (/(evening|night|مساء|ليل)/i.test(body)) return "evening";
  if (/(afternoon|ظهر)/i.test(body)) return "afternoon";
  if (/(weekend|نهاية الأسبوع|ويكند)/i.test(body)) return "weekend";
  if (/(weekday|أيام الأسبوع)/i.test(body)) return "weekdays";
  return null;
}

export function buildSalesConciergeTurn(input) {
  const body = input.messageBody.trim();
  const language = inferLanguage(body, input);
  const mode = input.mode;
  const stage = input.stage;
  let score = input.score ?? 0;
  let service = input.service ?? null;
  let fearOfWater = input.fearOfWater ?? null;
  let humanHandoff = false;
  let nextStage = stage;
  const priorState = parseConciergeState(input.intent);
  let state = priorState;
  const recent = Array.isArray(input.recentMessages) ? input.recentMessages : [];
  const priorOutbound = recent.filter((m) => m.role === "assistant" || m.direction === "outbound").length;
  const isFirstTouch = priorOutbound === 0 && (priorState === "greeting" || !input.intent);

  if (mode !== "ai_active") {
    return {
      processed: false,
      skipped: true,
      skipReason: "CONVERSATION_NOT_AI_ACTIVE",
      language,
      detectedIntent: state,
      draftReply: null,
      nextIntent: input.intent ?? formatIntent(state),
      nextService: service,
      nextStage: stage,
      nextScore: score,
      nextFearOfWater: fearOfWater,
      humanHandoff: false,
      outboundEnabled: false,
    };
  }

  // Current inbound message always wins over stale stored intent for safety intents.
  if (HUMAN_HANDOFF_PATTERN.test(body)) {
    return handoffResult({
      language,
      service,
      stage,
      score,
      fearOfWater,
      draftReply: t(
        language,
        "I'll connect you with Coach Ayman for personal follow-up. He will reply shortly.",
        "تمام — سأوصلك بالكوتش أيمن للمتابعة الشخصية. سيرد عليك قريبًا.",
      ),
    });
  }

  if (MEDICAL_PATTERN.test(body)) {
    return handoffResult({
      language,
      service,
      stage,
      score,
      fearOfWater,
      draftReply: t(
        language,
        "For health or medical concerns, Coach Ayman will follow up personally. I won't give medical advice.",
        "لأي أمر صحي أو طبي، سيتابع معك الكوتش أيمن شخصيًا. لن أقدّم نصيحة طبية.",
      ),
    });
  }

  if (LOCATION_PATTERN.test(body)) {
    return handoffResult({
      language,
      service,
      stage,
      score,
      fearOfWater,
      draftReply: t(
        language,
        "I don't have the exact training location saved here. I'll connect you with Coach Ayman for the precise details.",
        "ما عندي الموقع الدقيق محفوظ هنا. سأوصلك بالكوتش أيمن لتفاصيل موقع التدريب الدقيقة.",
      ),
    });
  }

  // Progressive booking collection (one question at a time).
  if (priorState === "booking_ask_count") {
    const count = extractCount(body);
    if (count) {
      state = fearOfWater == null ? "awaiting_fear_of_water" : "booking_ask_timing";
      score += 10;
      nextStage = "booking_intent";
    } else if (AFFIRMATIVE_PATTERN.test(body) || BOOKING_PATTERN.test(body)) {
      state = "booking_ask_count";
    } else if (PRICING_PATTERN.test(body) || SERVICES_PATTERN.test(body)) {
      state = PRICING_PATTERN.test(body) ? "presented_pricing" : "awaiting_offer_type";
    } else {
      state = "booking_ask_count";
    }
  } else if (priorState === "booking_ask_timing") {
    const timing = extractTiming(body);
    if (timing || AFFIRMATIVE_PATTERN.test(body) || body.length > 0) {
      state = "booking_handoff";
      score += 15;
      nextStage = "booking_intent";
    } else {
      state = "booking_ask_timing";
    }
  } else if (PRICING_PATTERN.test(body)) {
    state = "presented_pricing";
    nextStage = stage === "new" ? "contacted" : stage;
    if (PRIVATE_PATTERN.test(body)) service = "private";
    else if (GROUP_PATTERN.test(body)) service = "group";
    else if (SIBLING_PATTERN.test(body)) service = "siblings";
  } else if (SERVICES_PATTERN.test(body)) {
    state = "awaiting_offer_type";
    nextStage = stage === "new" ? "contacted" : stage;
  } else if (
    BOOKING_PATTERN.test(body) ||
    (AFFIRMATIVE_PATTERN.test(body) &&
      (priorState === "presented_pricing" || priorState === "booking_guidance" || priorState === "booking_ask_count"))
  ) {
    if (fearOfWater == null && (service === "private" || service === "group")) {
      state = "awaiting_fear_of_water";
    } else {
      state = "booking_ask_count";
    }
    nextStage = "booking_intent";
    score += 20;
  } else if (PRIVATE_PATTERN.test(body)) {
    service = "private";
    state = fearOfWater == null ? "awaiting_fear_of_water" : "presented_pricing";
    nextStage = stage === "new" || stage === "contacted" ? "qualified" : stage;
    score += 10;
  } else if (SIBLING_PATTERN.test(body)) {
    service = "siblings";
    state = "presented_pricing";
    nextStage = stage === "new" || stage === "contacted" ? "qualified" : stage;
    score += 10;
  } else if (GROUP_PATTERN.test(body)) {
    service = "group";
    state = fearOfWater == null ? "awaiting_fear_of_water" : "presented_pricing";
    nextStage = stage === "new" || stage === "contacted" ? "qualified" : stage;
    score += 10;
  } else if (priorState === "awaiting_fear_of_water") {
    if (NEGATIVE_FEAR_PATTERN.test(body)) fearOfWater = true;
    else if (COMFORTABLE_PATTERN.test(body) || AFFIRMATIVE_PATTERN.test(body)) fearOfWater = false;
    if (stage === "booking_intent") {
      state = "booking_ask_timing";
      nextStage = "booking_intent";
    } else {
      state = "presented_pricing";
      nextStage = nextStage === "new" || nextStage === "contacted" ? "qualified" : nextStage;
    }
    score += 10;
  } else if (GREETING_PATTERN.test(body) || LEARN_PATTERN.test(body) || priorState === "greeting") {
    // Keep funnel context: greeting mid-conversation should not wipe progress.
    if (priorState === "presented_pricing" || priorState === "booking_ask_count" || priorState === "booking_ask_timing") {
      state = priorState;
    } else if (priorState === "awaiting_fear_of_water") {
      state = "awaiting_fear_of_water";
    } else if (priorState === "awaiting_offer_type" && !isFirstTouch) {
      state = "awaiting_offer_type";
    } else {
      state = "awaiting_offer_type";
      nextStage = stage === "new" ? "contacted" : stage;
    }
  } else if (priorState === "awaiting_offer_type") {
    state = "awaiting_offer_type";
  } else if (priorState === "booking_guidance") {
    state = "booking_ask_count";
    nextStage = "booking_intent";
  } else {
    return handoffResult({
      language,
      service,
      stage,
      score,
      fearOfWater,
      draftReply: t(
        language,
        "I don't want to guess on that. I'll connect you with Coach Ayman so he can answer accurately.",
        "ما أحب أخمّن في هذا. سأوصلك بالكوتش أيمن ليجيبك بدقة.",
      ),
    });
  }

  let draftReply = null;
  if (state === "awaiting_offer_type") {
    if (SERVICES_PATTERN.test(body)) {
      draftReply = [
        APPROVED_SERVICES[language],
        t(
          language,
          "Which suits you better: private or group (up to 5)?",
          "أيّها أنسب لك: خاصة أم مجموعة (حتى 5)؟",
        ),
      ].join(" ");
    } else if (!isFirstTouch && priorState === "awaiting_offer_type") {
      draftReply = t(
        language,
        "Just to guide you correctly — private lesson or group (up to 5 people)?",
        "عشان أوجّهك صح — حصة خاصة ولا مجموعة (حتى 5 أشخاص)؟",
      );
    } else {
      draftReply = t(
        language,
        "Welcome to Relax Fix UAE. Would you like a private lesson or a group lesson (up to 5 people)?",
        "أهلًا بك في Relax Fix UAE. هل تفضّل حصة خاصة أم مجموعة (حتى 5 أشخاص)؟",
      );
    }
  } else if (state === "awaiting_fear_of_water") {
    draftReply = t(
      language,
      "Quick question only: is the swimmer comfortable in water, or is there fear of water?",
      "سؤال سريع فقط: هل السبّاح مرتاح في الماء، أم يوجد خوف من الماء؟",
    );
  } else if (state === "presented_pricing") {
    draftReply = [
      pricingForService(language, service),
      t(language, "Would you like to proceed with booking?", "هل تود المتابعة للحجز؟"),
    ].join("\n\n");
  } else if (state === "booking_ask_count") {
    draftReply = t(
      language,
      "Great. How many people will join the lesson? (1–5)",
      "ممتاز. كم شخص سيحضر الحصة؟ (من 1 إلى 5)",
    );
  } else if (state === "booking_ask_timing") {
    draftReply = t(
      language,
      "Got it. What time of day suits you better — morning, evening, or weekend? (I won't invent exact slots; Coach Ayman confirms availability.)",
      "تمام. أي وقت يناسبك أكثر — صباح، مساء، ولا نهاية الأسبوع؟ (لن أخترع مواعيد محددة؛ الكوتش أيمن يؤكد التوفر.)",
    );
  } else if (state === "booking_handoff" || state === "booking_guidance") {
    state = "booking_handoff";
    draftReply = t(
      language,
      "Perfect — I’ll pass this to Coach Ayman to confirm booking details with you shortly.",
      "ممتاز — سأحوّل طلبك للكوتش أيمن لتأكيد تفاصيل الحجز معك قريبًا.",
    );
  }

  return {
    processed: true,
    skipped: false,
    language,
    detectedIntent: state,
    draftReply,
    nextIntent: formatIntent(state),
    nextService: service,
    nextStage,
    nextScore: score,
    nextFearOfWater: fearOfWater,
    humanHandoff,
    outboundEnabled: false,
  };
}

export { APPROVED_PRICING, APPROVED_SERVICES };
