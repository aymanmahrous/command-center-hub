export const COACH_AYMAN_BATCH_SIZE = 10;
export const COACH_AYMAN_PROVIDER_ID = "command-center-coach-ayman-2026";

const BRAND_LINE = "Relax Fix UAE Swimming Academy";
const BRAND_WITH_COACH = "Relax Fix UAE Swimming Academy — Coach Ayman";
const WHATSAPP_OPENER =
  "Hi Relax Fix UAE — I saw Coach Ayman's swimming content and would like a free initial assessment.";

const WHATSAPP = "058 821 9130";
const PHONE = "055 137 8660";

export const CONFIRMED_CTA = [
  `WhatsApp ${WHATSAPP} — messages & booking`,
  `Call ${PHONE} — admin team (phone calls only)`,
  "Free initial assessment.",
].join("\n");

export type DbContentPillar =
  | "water_fear"
  | "parent_concerns"
  | "confidence"
  | "swimming_education"
  | "coach_authority"
  | "real_progress"
  | "safety_awareness"
  | "aqua_training"
  | "behind_the_scenes"
  | "offer_booking";

export type DbContentSlot = "trust_morning" | "education_midday" | "conversion_evening";

export type MarketingFunnel = "attraction" | "education" | "trust" | "engagement" | "conversion";

export type GeneratedBatchItem = {
  platform: "instagram" | "facebook" | "tiktok";
  contentType: string;
  language: "en";
  contentPillar: DbContentPillar;
  contentSlot: DbContentSlot;
  plannedFor: string;
  topic: string;
  hook: string;
  caption: string;
  cta: string;
  hashtags: string[];
  visualPrompt: string;
  contentFingerprint: string;
  mediaAssetId?: string | null;
  mediaSource?: "real" | "ai_generated" | "pending";
  mediaPlan?: Record<string, unknown> | null;
};

type SlotTemplate = Omit<GeneratedBatchItem, "plannedFor" | "contentFingerprint"> & {
  dayOffset: number;
  slotHourGst: number;
  funnel: MarketingFunnel;
  primaryCta: string;
  topicHashtags: string[];
};

const FORBIDDEN_CLAIMS = /\b(guarantee|guaranteed|award-winning|#1|testimonial|before and after results|100% success|olympic coach|world record)\b/i;

const PRIMARY_CTAS = {
  save: "Save this tip for your next pool visit.",
  share: "Share this with another Abu Dhabi parent.",
  follow: "Follow for calm swimming tips from Coach Ayman.",
  ask: "Ask a swimming question in the comments.",
  whatsapp: "Send us a WhatsApp message to chat about your child's comfort in the water.",
  book: "Book a free initial assessment — no pressure, just clarity.",
} as const;

function gstSlotUtc(dayOffset: number, hourGst: number, start: Date): string {
  const base = new Date(start);
  base.setUTCHours(0, 0, 0, 0);
  base.setUTCDate(base.getUTCDate() + dayOffset + 1);
  base.setUTCHours(hourGst - 4, 0, 0, 0);
  return base.toISOString();
}

function mediaBrief(parts: {
  format: string;
  visualConcept: string;
  headline: string;
  supportingText: string;
  sceneIdea: string;
  cta: string;
  canva: string;
  capcut: string;
  runway?: string;
}): string {
  return [
    `FORMAT: ${parts.format}`,
    `VISUAL CONCEPT: ${parts.visualConcept}`,
    `HEADLINE: ${parts.headline}`,
    `SUPPORTING TEXT: ${parts.supportingText}`,
    `SCENE IDEA: ${parts.sceneIdea}`,
    `CTA: ${parts.cta}`,
    `CANVA: ${parts.canva}`,
    parts.runway ? `RUNWAY (optional): ${parts.runway}` : null,
    `CAPCUT: ${parts.capcut}`,
  ].filter(Boolean).join("\n");
}

const SLOT_TEMPLATES: SlotTemplate[] = [
  {
    dayOffset: 0,
    slotHourGst: 9,
    platform: "instagram",
    contentType: "carousel",
    language: "en",
    contentPillar: "swimming_education",
    contentSlot: "education_midday",
    funnel: "education",
    topic: "3 calm breathing habits before your child enters the pool",
    hook: "Most kids rush into the water before their body is ready.",
    caption: [
      BRAND_WITH_COACH,
      "",
      "Parents in Abu Dhabi often ask where to start.",
      "",
      "Before the first lane or play session, try these three calm habits:",
      "1) Stand together at the pool edge and name three things you both see.",
      "2) Practice slow nose/mouth breathing away from the splash zone.",
      "3) Let your child choose one small goal for the session — not a race, just one skill.",
      "",
      "Small routines reduce panic and help children listen to the coach faster.",
    ].join("\n"),
    primaryCta: PRIMARY_CTAS.save,
    cta: CONFIRMED_CTA,
    hashtags: [],
    topicHashtags: ["#SwimmingTips", "#ParentTips"],
    visualPrompt: mediaBrief({
      format: "Instagram carousel · 5 slides · 1080×1350",
      visualConcept: "Soft blue/teal palette, one tip per slide, Coach Ayman portrait placeholder.",
      headline: "3 calm habits before the pool",
      supportingText: "Short parent-friendly bullets with simple pool-edge icons.",
      sceneIdea: "Parent and child at pool edge, calm body language, no race imagery.",
      cta: PRIMARY_CTAS.save,
      canva: "5-slide carousel template with numbered tips and readable mobile text.",
      capcut: "Optional reel cut-down: 1 tip per second with on-screen captions.",
    }),
  },
  {
    dayOffset: 1,
    slotHourGst: 8,
    platform: "instagram",
    contentType: "story",
    language: "en",
    contentPillar: "water_fear",
    contentSlot: "trust_morning",
    funnel: "attraction",
    topic: "Story: one sentence that calms water fear",
    hook: "Fear shrinks when the plan is simple.",
    caption: [
      BRAND_WITH_COACH,
      "",
      "🇦🇪 للأهل: جملة واحدة قبل الدخول للمسبح — \"نمشي خطوة خطوة، وأنا معك.\"",
      "",
      "Story frame 1: child at the pool steps.",
      "Frame 2: text overlay — \"You can pause whenever you need.\"",
      "Frame 3: sticker prompt — tap to save this reminder.",
    ].join("\n"),
    primaryCta: PRIMARY_CTAS.follow,
    cta: CONFIRMED_CTA,
    hashtags: [],
    topicHashtags: ["#WaterConfidence", "#KidsSwimming"],
    visualPrompt: mediaBrief({
      format: "Instagram story · 3 frames · 9:16",
      visualConcept: "Minimal text overlays on calm pool-step photos.",
      headline: "You can pause whenever you need",
      supportingText: "One reassurance line per frame, large type, high contrast.",
      sceneIdea: "Close-up of pool steps, coach hand visible for safety cue only.",
      cta: PRIMARY_CTAS.follow,
      canva: "Story template pack with text-safe zones and sticker placeholders.",
      capcut: "Quick story export with 2-second holds per frame.",
    }),
  },
  {
    dayOffset: 2,
    slotHourGst: 12,
    platform: "instagram",
    contentType: "reel",
    language: "en",
    contentPillar: "real_progress",
    contentSlot: "education_midday",
    funnel: "education",
    topic: "Reel: bubble line to wall glide",
    hook: "Watch the shoulders drop when breathing is calm.",
    caption: [
      BRAND_WITH_COACH,
      "",
      "Reel script (15–20 seconds):",
      "0–2s hook: \"One drill that calms nervous swimmers.\"",
      "3–10s: bubbles at the wall, relaxed exhale.",
      "11–18s: short assisted glide, coach hands visible for safety.",
      "",
      "Keep music low; prioritize clear captions.",
    ].join("\n"),
    primaryCta: PRIMARY_CTAS.save,
    cta: CONFIRMED_CTA,
    hashtags: [],
    topicHashtags: ["#SwimReel", "#LearnToSwim"],
    visualPrompt: mediaBrief({
      format: "Instagram reel · 9:16 · 15–20s",
      visualConcept: "Hook text in first 2 seconds, drill demo, calm pacing.",
      headline: "One drill that calms nervous swimmers",
      supportingText: "Burned-in captions for every spoken line.",
      sceneIdea: "Pool wall, exhale bubbles, assisted glide with coach support.",
      cta: PRIMARY_CTAS.save,
      canva: "Cover frame with bold hook text on pool background.",
      capcut: "Vertical edit, hook in first 2 seconds, end card with soft CTA text.",
      runway: "Optional slow-motion exhale b-roll only — no AI-generated child faces.",
    }),
  },
  {
    dayOffset: 3,
    slotHourGst: 9,
    platform: "facebook",
    contentType: "post",
    language: "en",
    contentPillar: "safety_awareness",
    contentSlot: "trust_morning",
    funnel: "trust",
    topic: "Pool-edge safety parents can check in 30 seconds",
    hook: "Safety first does not mean fear — it means clear rules.",
    caption: [
      `${BRAND_WITH_COACH} keeps safety language simple for families in Abu Dhabi.`,
      "",
      "Before every session, check:",
      "• Is there active adult supervision near the pool edge?",
      "• Are toys or floats cleared from the entry area?",
      "• Does your child know where to wait before the coach invites them in?",
      "",
      "Clear boundaries help children feel secure — not scared.",
    ].join("\n"),
    primaryCta: PRIMARY_CTAS.share,
    cta: CONFIRMED_CTA,
    hashtags: [],
    topicHashtags: ["#PoolSafety"],
    visualPrompt: mediaBrief({
      format: "Facebook static post · 1200×630",
      visualConcept: "Checklist layout with pool-edge photo placeholder.",
      headline: "30-second pool-edge safety check",
      supportingText: "Three bullet checks with simple icons.",
      sceneIdea: "Supervised pool entry area, toys cleared, calm waiting spot marked.",
      cta: PRIMARY_CTAS.share,
      canva: "Single educational graphic with checklist and safety headline.",
      capcut: "Static post — no video required.",
    }),
  },
  {
    dayOffset: 4,
    slotHourGst: 13,
    platform: "instagram",
    contentType: "short_video",
    language: "en",
    contentPillar: "confidence",
    contentSlot: "education_midday",
    funnel: "engagement",
    topic: "Short video: wall hold reset in 10 seconds",
    hook: "Ten calm seconds at the wall can reset the whole lesson.",
    caption: [
      BRAND_WITH_COACH,
      "",
      "When energy spikes, pause at the wall:",
      "• Soft hand on the edge",
      "• One slow exhale",
      "• Eyes forward, shoulders down",
      "",
      "Try this before the next skill — not as punishment, as a reset.",
    ].join("\n"),
    primaryCta: PRIMARY_CTAS.ask,
    cta: CONFIRMED_CTA,
    hashtags: [],
    topicHashtags: ["#SwimmingConfidence", "#CoachAyman"],
    visualPrompt: mediaBrief({
      format: "Instagram short video · 9:16 · 10–15s",
      visualConcept: "Quick reset drill demo with large on-screen labels.",
      headline: "10-second wall reset",
      supportingText: "Three micro-steps shown sequentially.",
      sceneIdea: "Child at wall with coach nearby, calm exhale visible.",
      cta: PRIMARY_CTAS.ask,
      canva: "Title card + end frame with question prompt sticker idea.",
      capcut: "Fast but calm pacing, one step every 3 seconds, captions required.",
    }),
  },
  {
    dayOffset: 5,
    slotHourGst: 9,
    platform: "instagram",
    contentType: "post",
    language: "en",
    contentPillar: "parent_concerns",
    contentSlot: "trust_morning",
    funnel: "trust",
    topic: "What to tell a nervous child before lesson one",
    hook: "Your child does not need bravery — they need a plan.",
    caption: [
      BRAND_WITH_COACH,
      "",
      "If your child is nervous around water, honest, short reassurance helps:",
      "",
      "• \"The coach stays with you the whole time.\"",
      "• \"You can pause on the step whenever you need.\"",
      "• \"We practice small skills before anything new.\"",
      "",
      "Avoid comparing siblings or friends. Progress is personal.",
    ].join("\n"),
    primaryCta: PRIMARY_CTAS.share,
    cta: CONFIRMED_CTA,
    hashtags: [],
    topicHashtags: ["#ParentSupport", "#AbuDhabiParents"],
    visualPrompt: mediaBrief({
      format: "Instagram static post · 1080×1350",
      visualConcept: "Quote-style layout with parent + child near pool steps.",
      headline: "Your child needs a plan, not pressure",
      supportingText: "Three short reassurance lines in bullet form.",
      sceneIdea: "Warm supportive tone, no comparison language on screen.",
      cta: PRIMARY_CTAS.share,
      canva: "Quote card with soft illustration and readable bullets.",
      capcut: "Optional story version with text animation per bullet.",
    }),
  },
  {
    dayOffset: 6,
    slotHourGst: 18,
    platform: "tiktok",
    contentType: "video",
    language: "en",
    contentPillar: "aqua_training",
    contentSlot: "education_midday",
    funnel: "attraction",
    topic: "TikTok hook: stop forcing the kick",
    hook: "If the kick is frantic, the breath will never settle.",
    caption: [
      BRAND_WITH_COACH,
      "",
      "TikTok hook (1–2 seconds): \"Stop forcing the kick.\"",
      "",
      "Quick tip:",
      "Relax the ankles, small splashes, coach-supported float first.",
      "",
      "Direct tone, no hype, no fake results.",
    ].join("\n"),
    primaryCta: PRIMARY_CTAS.follow,
    cta: CONFIRMED_CTA,
    hashtags: [],
    topicHashtags: ["#SwimTok", "#KickDrill"],
    visualPrompt: mediaBrief({
      format: "TikTok vertical video · 9:16 · 20–30s",
      visualConcept: "Fast hook, one technique fix, conversational Coach Ayman tone.",
      headline: "Stop forcing the kick",
      supportingText: "Large captions, legs-only demo, no exaggerated claims.",
      sceneIdea: "Pool lane lines, relaxed ankle kick close-up, coach voiceover optional.",
      cta: PRIMARY_CTAS.follow,
      canva: "Export thumbnail title card only.",
      capcut: "Fast-cut pacing with bold captions and clean ending frame.",
      runway: "Optional short legs-only kick clip — use only if real footage is unavailable.",
    }),
  },
  {
    dayOffset: 7,
    slotHourGst: 12,
    platform: "facebook",
    contentType: "carousel",
    language: "en",
    contentPillar: "swimming_education",
    contentSlot: "education_midday",
    funnel: "education",
    topic: "3 common beginner mistakes at the pool wall",
    hook: "Fix these early and lessons feel easier.",
    caption: [
      BRAND_WITH_COACH,
      "",
      "The same beginner habits show up in Abu Dhabi pools:",
      "",
      "1) Holding breath instead of exhaling underwater.",
      "2) Stiff fingers on the wall — tension travels to the whole body.",
      "3) Looking up instead of forward when pushing off.",
      "",
      "Gentle correction beats rushing to full strokes.",
    ].join("\n"),
    primaryCta: PRIMARY_CTAS.save,
    cta: CONFIRMED_CTA,
    hashtags: [],
    topicHashtags: ["#BeginnerSwimming"],
    visualPrompt: mediaBrief({
      format: "Facebook carousel · 4 slides · 1080×1080",
      visualConcept: "Mistake vs calm correction side-by-side sketches.",
      headline: "3 beginner mistakes at the wall",
      supportingText: "One mistake per slide with a simple fix line.",
      sceneIdea: "Educational sketches only — no shaming language.",
      cta: PRIMARY_CTAS.save,
      canva: "Carousel with numbered slides and before/after style layouts.",
      capcut: "Optional reel cut-down: one mistake every 4 seconds.",
    }),
  },
  {
    dayOffset: 8,
    slotHourGst: 17,
    platform: "instagram",
    contentType: "short_video",
    language: "en",
    contentPillar: "behind_the_scenes",
    contentSlot: "education_midday",
    funnel: "engagement",
    topic: "Behind the lane: how Coach Ayman sets up a calm session",
    hook: "Calm sessions start before anyone enters the water.",
    caption: [
      BRAND_WITH_COACH,
      "",
      "Behind the scenes in Abu Dhabi:",
      "• Equipment laid out before families arrive",
      "• Clear wait spot marked at the pool edge",
      "• One skill focus written on the board",
      "",
      "Structure helps children feel safe and ready to listen.",
    ].join("\n"),
    primaryCta: PRIMARY_CTAS.follow,
    cta: CONFIRMED_CTA,
    hashtags: [],
    topicHashtags: ["#BehindTheScenes", "#SwimCoach"],
    visualPrompt: mediaBrief({
      format: "Instagram short video · 9:16 · 20s",
      visualConcept: "Quick BTS montage — setup, wait spot, skill board.",
      headline: "Calm sessions start before the water",
      supportingText: "Three fast cuts with short labels on screen.",
      sceneIdea: "Real pool deck setup, coach preparing equipment, no staged testimonials.",
      cta: PRIMARY_CTAS.follow,
      canva: "Cover frame with BTS headline and brand colors.",
      capcut: "Montage pacing, captions on each cut, soft CTA end card.",
    }),
  },
  {
    dayOffset: 9,
    slotHourGst: 18,
    platform: "instagram",
    contentType: "post",
    language: "en",
    contentPillar: "offer_booking",
    contentSlot: "conversion_evening",
    funnel: "conversion",
    topic: "Start with a free initial assessment",
    hook: "Not sure which lesson format fits your child?",
    caption: [
      BRAND_WITH_COACH,
      "",
      "🇦🇪 للأهل في أبوظبي: ابدأوا بتقييم أولي مجاني قبل اختيار نوع الحصة.",
      "",
      "Private coaching or small groups up to 4 learners — we help families choose the right starting point.",
      "",
      "We review comfort in the water, listening skills, and your goals together.",
    ].join("\n"),
    primaryCta: PRIMARY_CTAS.book,
    cta: CONFIRMED_CTA,
    hashtags: [],
    topicHashtags: ["#FreeAssessment", "#AbuDhabiSwimming"],
    visualPrompt: mediaBrief({
      format: "Instagram conversion post · 1080×1350",
      visualConcept: "Clean booking CTA layout with contact roles clearly separated.",
      headline: "Free initial assessment",
      supportingText: "WhatsApp for messages · phone line for admin calls only.",
      sceneIdea: "Simple CTA graphic — no fabricated reviews or badges.",
      cta: PRIMARY_CTAS.book,
      canva: "Conversion template with WhatsApp and phone icons in separate roles.",
      capcut: "Optional 10s CTA bumper with contact details on screen.",
    }),
  },
];

function ensureRelaxFixBrandLead(caption: string): string {
  if (/relax fix uae/i.test(caption)) return caption;
  return `${BRAND_WITH_COACH}\n\n${caption}`;
}

function buildHashtags(platform: GeneratedBatchItem["platform"], contentType: string, topicHashtags: string[]): string[] {
  const normalized = platform.toLowerCase();
  const unique = ["#RelaxFixUAE", ...topicHashtags];
  const deduped = [...new Set(unique.map((tag) => tag.trim()).filter(Boolean))];
  if (normalized === "facebook") return deduped.slice(0, 1);
  return deduped.slice(0, 5);
}

export async function contentFingerprint(seed: string): Promise<string> {
  const data = new TextEncoder().encode(seed);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function buildBatchTrackedCta(platform: string, pillar: string): string {
  const params = new URLSearchParams();
  params.set("utm_source", platform.toLowerCase());
  params.set("utm_medium", "social");
  params.set("utm_campaign", "relaxfix-content-batch");
  params.set("utm_content", pillar);
  params.set("text", WHATSAPP_OPENER);
  const leadUrl = `https://wa.me/971588219130?${params.toString()}`;
  return [
    BRAND_LINE,
    "WhatsApp 058 821 9130 — messages & booking",
    "Call 055 137 8660 — admin team (phone calls only)",
    "Free initial assessment.",
    `WhatsApp link: ${leadUrl}`,
  ].join("\n");
}

function buildCaptionBody(slot: SlotTemplate): string {
  const branded = ensureRelaxFixBrandLead(slot.caption);
  return `${branded}\n\n${slot.primaryCta}`;
}

export async function buildCoachAyman2026BatchItems(start = new Date(), batchNonce = start.toISOString()): Promise<GeneratedBatchItem[]> {
  const items: GeneratedBatchItem[] = [];
  for (let index = 0; index < SLOT_TEMPLATES.length; index += 1) {
    const slot = SLOT_TEMPLATES[index];
    const fingerprintSeed = `${COACH_AYMAN_PROVIDER_ID}:${batchNonce}:${index}:${slot.platform}:${slot.topic}`;
    const trackedCta = buildBatchTrackedCta(slot.platform, slot.contentPillar);
    const captionBody = buildCaptionBody(slot);
    items.push({
      platform: slot.platform,
      contentType: slot.contentType,
      language: slot.language,
      contentPillar: slot.contentPillar,
      contentSlot: slot.contentSlot,
      plannedFor: gstSlotUtc(slot.dayOffset, slot.slotHourGst, start),
      topic: slot.topic,
      hook: slot.hook,
      caption: `${captionBody}\n\n${trackedCta}`,
      cta: trackedCta,
      hashtags: buildHashtags(slot.platform, slot.contentType, slot.topicHashtags),
      visualPrompt: slot.visualPrompt,
      contentFingerprint: await contentFingerprint(fingerprintSeed),
    });
  }
  return items;
}

const FUNNEL_BY_PILLAR: Partial<Record<DbContentPillar, MarketingFunnel>> = {
  offer_booking: "conversion",
  water_fear: "attraction",
  confidence: "engagement",
  parent_concerns: "trust",
  safety_awareness: "trust",
  coach_authority: "trust",
  behind_the_scenes: "engagement",
  real_progress: "education",
  swimming_education: "education",
  aqua_training: "attraction",
};

function funnelForTemplate(slot: SlotTemplate): MarketingFunnel {
  return slot.funnel ?? FUNNEL_BY_PILLAR[slot.contentPillar] ?? "education";
}

export function validateCoachAymanBatch(items: GeneratedBatchItem[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (items.length !== COACH_AYMAN_BATCH_SIZE) errors.push(`expected ${COACH_AYMAN_BATCH_SIZE} items`);

  const fingerprints = new Set<string>();
  const planned = new Set<string>();
  const contentTypes = new Set<string>();
  const primaryCtas = new Set<string>();
  const funnels = new Set<MarketingFunnel>();
  let conversionCount = 0;
  let staticPostCount = 0;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const slot = SLOT_TEMPLATES[index];

    if (fingerprints.has(item.contentFingerprint)) errors.push("duplicate fingerprint");
    fingerprints.add(item.contentFingerprint);
    if (planned.has(item.plannedFor)) errors.push("duplicate plannedFor");
    planned.add(item.plannedFor);

    contentTypes.add(item.contentType.toLowerCase());
    if (item.contentType.toLowerCase() === "post") staticPostCount += 1;
    if (slot) {
      funnels.add(funnelForTemplate(slot));
      primaryCtas.add(slot.primaryCta);
    }

    if (item.contentPillar === "offer_booking") conversionCount += 1;
    if (!item.cta.includes(WHATSAPP) || !item.cta.includes(PHONE)) errors.push("missing confirmed CTA");
    if (!/messages & booking/i.test(item.caption)) errors.push("missing whatsapp role label");
    if (!/phone calls only/i.test(item.caption)) errors.push("missing call role label");
    if (/wa\.me\/971551378660/i.test(item.caption)) errors.push("8660 must not be used as whatsapp link");
    if (!/relax fix uae/i.test(item.caption)) errors.push("missing Relax Fix UAE brand lead");
    if (item.hashtags[0] !== "#RelaxFixUAE") errors.push("primary hashtag must be RelaxFixUAE");
    if (item.platform === "facebook" && item.hashtags.length > 1) errors.push("facebook should use at most one hashtag");
    if (item.platform === "instagram" && item.hashtags.length > 5) errors.push("instagram hashtag count out of range");
    if (item.platform === "tiktok" && item.hashtags.length > 5) errors.push("tiktok hashtag count out of range");
    if (item.hashtags.length < 1) errors.push("missing hashtags");
    if (FORBIDDEN_CLAIMS.test(`${item.topic} ${item.hook} ${item.caption}`)) errors.push("forbidden claim language");
    if (!/FORMAT:/i.test(item.visualPrompt) || !/CANVA:/i.test(item.visualPrompt) || !/CAPCUT:/i.test(item.visualPrompt)) {
      errors.push("missing production brief");
    }
    if (slot && !item.caption.includes(slot.primaryCta)) errors.push("missing primary CTA variety line");
  }

  if (conversionCount < 1 || conversionCount > 3) errors.push("conversion mix out of range");
  if (staticPostCount > 3) errors.push("too many static posts");
  if (contentTypes.size < 5) errors.push("content type diversity too low");
  if (primaryCtas.size < 5) errors.push("CTA variety too low");
  if (funnels.size < 4) errors.push("funnel diversity too low");

  const platforms = new Set(items.map((item) => item.platform));
  if (!platforms.has("instagram") || !platforms.has("facebook") || !platforms.has("tiktok")) {
    errors.push("missing platform coverage");
  }

  return { valid: errors.length === 0, errors };
}

export function summarizeCoachAymanBatch(items: GeneratedBatchItem[]) {
  const educational = items.filter((item) => item.contentPillar !== "offer_booking").length;
  return {
    total: items.length,
    educational,
    conversion: items.length - educational,
    platforms: [...new Set(items.map((item) => item.platform))],
    contentTypes: [...new Set(items.map((item) => item.contentType))],
  };
}
