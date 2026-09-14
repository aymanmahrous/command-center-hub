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

function isVideoContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase();
  return normalized === "reel" || normalized === "short_video" || normalized === "video";
}

function buildVideoBrief(parts: {
  hook: string;
  scene: string;
  strategyLabel: string;
  cta: string;
}): string {
  return [
    "VIDEO BRIEF:",
    `HOOK: ${parts.hook}`,
    "DURATION: 10 seconds (allowed 5–15 seconds)",
    `SCENE: ${parts.scene} — real Abu Dhabi pool context with Coach Ayman, no staged testimonials.`,
    `ON-SCREEN TEXT: ${parts.hook}`,
    `CAPTION LEAD: ${parts.strategyLabel} for kids swimming lessons in Abu Dhabi.`,
    `CTA: ${parts.cta}`,
    "REQUIRED MEDIA: real pool b-roll or coach footage; burned-in captions; no AI-generated child faces; no fake before/after.",
  ].join("\n");
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
  videoBrief?: string;
}): string {
  return [
    `FORMAT: ${parts.format}`,
    `VISUAL CONCEPT: ${parts.visualConcept}`,
    `HEADLINE: ${parts.headline}`,
    `SUPPORTING TEXT: ${parts.supportingText}`,
    `SCENE IDEA: ${parts.sceneIdea}`,
    `CTA: ${parts.cta}`,
    parts.videoBrief ?? null,
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
    contentType: "reel",
    language: "en",
    contentPillar: "parent_concerns",
    contentSlot: "trust_morning",
    funnel: "attraction",
    topic: "Short Reel: why kids panic at the pool edge",
    hook: "Most water fear starts before they even get wet.",
    caption: [
      BRAND_WITH_COACH,
      "",
      "Short Reel (10 seconds):",
      '0–2s hook on screen: "Most water fear starts before they get wet."',
      "3–8s: child and parent at pool edge, calm coach cue, no pressure.",
      "9–10s: soft CTA text — follow for calm swimming tips.",
    ].join("\n"),
    primaryCta: PRIMARY_CTAS.follow,
    cta: CONFIRMED_CTA,
    hashtags: [],
    topicHashtags: ["#KidsSwimming", "#WaterConfidence"],
    visualPrompt: mediaBrief({
      format: "Instagram reel · 9:16 · 10s default (5–15s)",
      visualConcept: "Attention reel about a common water-fear moment at the pool edge.",
      headline: "Most water fear starts before they get wet",
      supportingText: "Kids swimming lessons in Abu Dhabi — calm coaching, no pressure.",
      sceneIdea: "Pool edge, parent reassurance, coach nearby, no fake results.",
      cta: PRIMARY_CTAS.follow,
      videoBrief: buildVideoBrief({
        hook: "Most water fear starts before they even get wet.",
        scene: "Child hesitating at the pool edge while Coach Ayman gives one calm cue",
        strategyLabel: "Short Reel — common swimming problem",
        cta: PRIMARY_CTAS.follow,
      }),
      canva: "Cover frame with bold hook text on calm pool background.",
      capcut: "Vertical 9:16, 10-second default pacing, burned-in captions.",
      runway: "Optional b-roll only if real footage is unavailable — no AI-generated child faces.",
    }),
  },
  {
    dayOffset: 1,
    slotHourGst: 12,
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
      "Parents in Abu Dhabi often ask where to start with kids swimming lessons.",
      "",
      "Before the first lane or play session, try these three calm habits:",
      "1) Stand together at the pool edge and name three things you both see.",
      "2) Practice slow nose/mouth breathing away from the splash zone.",
      "3) Let your child choose one small goal for the session — not a race, just one skill.",
    ].join("\n"),
    primaryCta: PRIMARY_CTAS.save,
    cta: CONFIRMED_CTA,
    hashtags: [],
    topicHashtags: ["#SwimmingTips", "#ParentTips"],
    visualPrompt: mediaBrief({
      format: "Instagram carousel · 5 slides · 1080×1350",
      visualConcept: "Education carousel for parents about calm breathing habits.",
      headline: "3 calm habits before the pool",
      supportingText: "Parent-friendly swimming education for Abu Dhabi families.",
      sceneIdea: "Pool-edge education slides, no fabricated progress claims.",
      cta: PRIMARY_CTAS.save,
      canva: "5-slide carousel with numbered parent tips.",
      capcut: "Optional reel cut-down with one tip every 3 seconds.",
    }),
  },
  {
    dayOffset: 2,
    slotHourGst: 9,
    platform: "instagram",
    contentType: "reel",
    language: "en",
    contentPillar: "swimming_education",
    contentSlot: "education_midday",
    funnel: "attraction",
    topic: "Short Reel: the rushed kick mistake parents miss",
    hook: "If the kick is frantic, the breath will never settle.",
    caption: [
      BRAND_WITH_COACH,
      "",
      "Short Reel (10 seconds):",
      'Hook: "If the kick is frantic, the breath will never settle."',
      "Show one calm correction at the wall — small splashes, relaxed ankles.",
    ].join("\n"),
    primaryCta: PRIMARY_CTAS.save,
    cta: CONFIRMED_CTA,
    hashtags: [],
    topicHashtags: ["#SwimReel", "#LearnToSwim"],
    visualPrompt: mediaBrief({
      format: "Instagram reel · 9:16 · 10s default (5–15s)",
      visualConcept: "Common kick mistake parents miss during swimming lessons.",
      headline: "If the kick is frantic, the breath will never settle",
      supportingText: "Swimming skills coaching in Abu Dhabi — calm technique first.",
      sceneIdea: "Legs-only kick demo with coach support, no exaggerated claims.",
      cta: PRIMARY_CTAS.save,
      videoBrief: buildVideoBrief({
        hook: "If the kick is frantic, the breath will never settle.",
        scene: "Close-up of a frantic kick then a calm corrected kick at the wall",
        strategyLabel: "Short Reel — common mistake",
        cta: PRIMARY_CTAS.save,
      }),
      canva: "Bold hook title card on pool lane background.",
      capcut: "10-second vertical edit with hook in first 2 seconds.",
      runway: "Optional legs-only b-roll — no AI-generated child faces.",
    }),
  },
  {
    dayOffset: 3,
    slotHourGst: 9,
    platform: "facebook",
    contentType: "post",
    language: "en",
    contentPillar: "parent_concerns",
    contentSlot: "trust_morning",
    funnel: "trust",
    topic: "FAQ: how long until my child feels safe in the water?",
    hook: "Parents ask this every week in Abu Dhabi.",
    caption: [
      BRAND_WITH_COACH,
      "",
      "FAQ for Abu Dhabi parents:",
      "Q: How long until my child feels safe in the water?",
      "A: It depends on comfort, listening skills, and consistency — not age alone.",
      "",
      "We start with small, structured steps: wait spot, calm breathing, one skill at a time.",
    ].join("\n"),
    primaryCta: PRIMARY_CTAS.share,
    cta: CONFIRMED_CTA,
    hashtags: [],
    topicHashtags: ["#AbuDhabiParents"],
    visualPrompt: mediaBrief({
      format: "Facebook static post · 1200×630",
      visualConcept: "FAQ layout for parents about water confidence timelines.",
      headline: "How long until my child feels safe?",
      supportingText: "Honest parent FAQ — no guaranteed timelines.",
      sceneIdea: "Simple Q&A graphic with pool context photo placeholder.",
      cta: PRIMARY_CTAS.share,
      canva: "FAQ graphic with question headline and short answer bullets.",
      capcut: "Static post — no video required.",
    }),
  },
  {
    dayOffset: 4,
    slotHourGst: 12,
    platform: "instagram",
    contentType: "reel",
    language: "en",
    contentPillar: "safety_awareness",
    contentSlot: "education_midday",
    funnel: "attraction",
    topic: "Short Reel: pool-edge safety check in 10 seconds",
    hook: "Safety first does not mean fear — it means clear rules.",
    caption: [
      BRAND_WITH_COACH,
      "",
      "Short Reel (10 seconds):",
      "Quick pool-edge safety check parents can do in 10 seconds.",
      "Supervision · clear entry area · calm wait spot.",
    ].join("\n"),
    primaryCta: PRIMARY_CTAS.save,
    cta: CONFIRMED_CTA,
    hashtags: [],
    topicHashtags: ["#PoolSafety", "#SwimmingSkills"],
    visualPrompt: mediaBrief({
      format: "Instagram reel · 9:16 · 10s default (5–15s)",
      visualConcept: "Water safety reel for parents at the pool edge.",
      headline: "10-second pool-edge safety check",
      supportingText: "Water safety and swimming skills for Abu Dhabi families.",
      cta: PRIMARY_CTAS.save,
      sceneIdea: "Supervised pool entry area, calm wait spot, no fear-based messaging.",
      videoBrief: buildVideoBrief({
        hook: "Safety first does not mean fear — it means clear rules.",
        scene: "Parent and child at a supervised pool edge with three quick safety checks on screen",
        strategyLabel: "Short Reel — swimming skill / safety",
        cta: PRIMARY_CTAS.save,
      }),
      canva: "Safety checklist cover frame.",
      capcut: "10-second checklist reel with burned-in captions.",
      runway: "Optional pool-edge b-roll only.",
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
      "Parent advice for lesson one:",
      '• "The coach stays with you the whole time."',
      '• "You can pause on the step whenever you need."',
      '• "We practice small skills before anything new."',
    ].join("\n"),
    primaryCta: PRIMARY_CTAS.share,
    cta: CONFIRMED_CTA,
    hashtags: [],
    topicHashtags: ["#ParentSupport", "#AbuDhabiParents"],
    visualPrompt: mediaBrief({
      format: "Instagram static post · 1080×1350",
      visualConcept: "Parent advice post about nervous first swimming lessons.",
      headline: "Your child needs a plan, not pressure",
      supportingText: "Confidence-building language for Abu Dhabi parents.",
      sceneIdea: "Supportive parent-child tone, no comparison language.",
      cta: PRIMARY_CTAS.share,
      canva: "Quote card with three reassurance bullets.",
      capcut: "Optional story version with text per bullet.",
    }),
  },
  {
    dayOffset: 6,
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
    ].join("\n"),
    primaryCta: PRIMARY_CTAS.book,
    cta: CONFIRMED_CTA,
    hashtags: [],
    topicHashtags: ["#FreeAssessment", "#AbuDhabiSwimming"],
    visualPrompt: mediaBrief({
      format: "Instagram conversion post · 1080×1350",
      visualConcept: "Free initial assessment CTA for swimming lessons.",
      headline: "Free initial assessment",
      supportingText: "WhatsApp for messages · phone line for admin calls only.",
      sceneIdea: "Clean CTA graphic — no fabricated reviews.",
      cta: PRIMARY_CTAS.book,
      canva: "Conversion template with WhatsApp and phone roles separated.",
      capcut: "Optional 10s CTA bumper with contact details on screen.",
    }),
  },
  {
    dayOffset: 7,
    slotHourGst: 12,
    platform: "instagram",
    contentType: "reel",
    language: "en",
    contentPillar: "swimming_education",
    contentSlot: "education_midday",
    funnel: "education",
    topic: "Short Reel: bubble line to calm breathing",
    hook: "Watch the shoulders drop when breathing is calm.",
    caption: [
      BRAND_WITH_COACH,
      "",
      "Short Reel (10 seconds):",
      "Bubble line at the wall → calm exhale → relaxed shoulders.",
      "Educational reel for parents watching swimming skills develop safely.",
    ].join("\n"),
    primaryCta: PRIMARY_CTAS.save,
    cta: CONFIRMED_CTA,
    hashtags: [],
    topicHashtags: ["#SwimReel", "#CoachAyman"],
    visualPrompt: mediaBrief({
      format: "Instagram reel · 9:16 · 10s default (5–15s)",
      visualConcept: "Educational reel about calm breathing at the wall.",
      headline: "Watch the shoulders drop when breathing is calm",
      supportingText: "Swimming education for kids in Abu Dhabi.",
      sceneIdea: "Bubble line drill with coach support, calm pacing.",
      cta: PRIMARY_CTAS.save,
      videoBrief: buildVideoBrief({
        hook: "Watch the shoulders drop when breathing is calm.",
        scene: "Bubble line drill at the pool wall with visible calm exhale",
        strategyLabel: "Short Reel — educational",
        cta: PRIMARY_CTAS.save,
      }),
      canva: "Hook cover frame with pool-wall context.",
      capcut: "10-second educational reel with captions on each step.",
      runway: "Optional slow-motion exhale b-roll only.",
    }),
  },
  {
    dayOffset: 8,
    slotHourGst: 9,
    platform: "facebook",
    contentType: "carousel",
    language: "en",
    contentPillar: "real_progress",
    contentSlot: "education_midday",
    funnel: "trust",
    topic: "Structured swimming progress parents can track",
    hook: "Small skills build confidence before speed.",
    caption: [
      BRAND_WITH_COACH,
      "",
      "Structured swimming progress parents can notice:",
      "1) Calm wait spot at the pool edge",
      "2) Comfortable exhale at the wall",
      "3) One new skill per session",
      "",
      "Progress is personal — we track skills, not comparisons.",
    ].join("\n"),
    primaryCta: PRIMARY_CTAS.save,
    cta: CONFIRMED_CTA,
    hashtags: [],
    topicHashtags: ["#BeginnerSwimming"],
    visualPrompt: mediaBrief({
      format: "Facebook carousel · 4 slides · 1080×1080",
      visualConcept: "Structured progress carousel — trust and proof without fake results.",
      headline: "Structured swimming progress parents can track",
      supportingText: "Confidence and skills over speed.",
      sceneIdea: "Skill-step slides, no before/after claims.",
      cta: PRIMARY_CTAS.save,
      canva: "Four-slide progress checklist carousel.",
      capcut: "Optional reel cut-down with one skill per slide.",
    }),
  },
  {
    dayOffset: 9,
    slotHourGst: 18,
    platform: "instagram",
    contentType: "post",
    language: "en",
    contentPillar: "coach_authority",
    contentSlot: "conversion_evening",
    funnel: "conversion",
    topic: "Coach Ayman on building water confidence in Abu Dhabi",
    hook: "Calm coaching beats pressure every time.",
    caption: [
      BRAND_WITH_COACH,
      "",
      "Trust + next step:",
      "Coach Ayman focuses on structured swimming progress, water safety, and confidence for children in Abu Dhabi.",
      "",
      "Start with a free initial assessment — no pressure, just clarity.",
    ].join("\n"),
    primaryCta: PRIMARY_CTAS.book,
    cta: CONFIRMED_CTA,
    hashtags: [],
    topicHashtags: ["#SwimmingCoach", "#AbuDhabiSwimming"],
    visualPrompt: mediaBrief({
      format: "Instagram conversion post · 1080×1350",
      visualConcept: "Authority + conversion post for Coach Ayman swimming academy.",
      headline: "Calm coaching beats pressure every time",
      supportingText: "Swimming coach Abu Dhabi — structured lessons for kids.",
      sceneIdea: "Coach authority portrait with calm pool context, no fake testimonials.",
      cta: PRIMARY_CTAS.book,
      canva: "Trust + conversion layout with assessment CTA.",
      capcut: "Optional 10s authority bumper with CTA end card.",
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
  if (staticPostCount > 4) errors.push("too many static posts");
  if (contentTypes.size < 3) errors.push("content type diversity too low");
  if (primaryCtas.size < 4) errors.push("CTA variety too low");
  if (funnels.size < 4) errors.push("funnel diversity too low");

  const reelCount = items.filter((item) => ["reel", "short_video", "video"].includes(item.contentType.toLowerCase())).length;
  if (reelCount < 4) errors.push("expected at least 4 short reels");

  const sorted = [...items].sort((a, b) => a.plannedFor.localeCompare(b.plannedFor));
  for (let index = 1; index < sorted.length; index += 1) {
    const previousDay = sorted[index - 1].plannedFor.slice(0, 10);
    const currentDay = sorted[index].plannedFor.slice(0, 10);
    const previousDate = new Date(`${previousDay}T00:00:00.000Z`);
    const currentDate = new Date(`${currentDay}T00:00:00.000Z`);
    const diffDays = (currentDate.getTime() - previousDate.getTime()) / 86_400_000;
    if (diffDays !== 1) errors.push("plannedFor days are not consecutive calendar days");
  }

  const publishDays = new Set(sorted.map((item) => item.plannedFor.slice(0, 10)));
  if (publishDays.size !== items.length) errors.push("duplicate publish days in batch");
  for (const item of sorted) {
    if (!["instagram", "facebook"].includes(item.platform)) {
      errors.push("each batch day must use instagram or facebook for daily publishing");
      break;
    }
  }

  const platforms = new Set(items.map((item) => item.platform));
  if (!platforms.has("instagram") || !platforms.has("facebook")) {
    errors.push("missing instagram or facebook coverage");
  }

  return { valid: errors.length === 0, errors };
}

export function summarizeCoachAymanBatch(items: GeneratedBatchItem[]) {
  const educational = items.filter((item) => item.contentPillar !== "offer_booking").length;
  return {
    total: items.length,
    educational,
    conversion: items.length - educational,
    reels: items.filter((item) => ["reel", "short_video", "video"].includes(item.contentType.toLowerCase())).length,
    platforms: [...new Set(items.map((item) => item.platform))],
    contentTypes: [...new Set(items.map((item) => item.contentType))],
  };
}
