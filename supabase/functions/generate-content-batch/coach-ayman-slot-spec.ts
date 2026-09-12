export const COACH_AYMAN_PROVIDER_ID = "command-center-coach-ayman-2026";
export const COACH_AYMAN_BATCH_SIZE = 10;

export const BRAND_WITH_COACH = "Relax Fix UAE Swimming Academy — Coach Ayman";
export const BRAND_LINE = "Relax Fix UAE Swimming Academy";
export const WHATSAPP = "058 821 9130";
export const PHONE = "055 137 8660";
export const WHATSAPP_OPENER =
  "Hi Relax Fix UAE — I saw Coach Ayman's swimming content and would like a free initial assessment.";

export const PRIMARY_CTAS = {
  save: "Save this tip for your next pool visit.",
  share: "Share this with another Abu Dhabi parent.",
  follow: "Follow for calm swimming tips from Coach Ayman.",
  ask: "Ask a swimming question in the comments.",
  whatsapp: "Send us a WhatsApp message to chat about your child's comfort in the water.",
  book: "Book a free initial assessment — no pressure, just clarity.",
} as const;

export type PrimaryCtaKey = keyof typeof PRIMARY_CTAS;
export type MarketingFunnel = "attraction" | "education" | "trust" | "engagement" | "conversion";

export type CoachAymanSlotSpec = {
  dayOffset: number;
  hourGst: number;
  platform: "instagram" | "facebook" | "tiktok";
  contentType: string;
  contentPillar: string;
  contentSlot: "trust_morning" | "education_midday" | "conversion_evening";
  funnel: MarketingFunnel;
  topicSeed: string;
  hookSeed: string;
  topicHashtags: string[];
  primaryCtaKey: PrimaryCtaKey;
  arabicHint?: string;
  briefFormat: string;
};

export const FORBIDDEN_CLAIMS =
  /\b(guarantee|guaranteed|award-winning|#1|testimonial|before and after results|100% success|olympic coach|world record)\b/i;

/** Slot order and strategy mix — keep aligned with src/content-batch-generator.ts */
export const COACH_AYMAN_SLOT_SPEC: CoachAymanSlotSpec[] = [
  {
    dayOffset: 0,
    hourGst: 9,
    platform: "instagram",
    contentType: "carousel",
    contentPillar: "swimming_education",
    contentSlot: "education_midday",
    funnel: "education",
    topicSeed: "3 calm breathing habits before your child enters the pool",
    hookSeed: "Most kids rush into the water before their body is ready.",
    topicHashtags: ["#SwimmingTips", "#ParentTips"],
    primaryCtaKey: "save",
    briefFormat: "Instagram carousel · 5 slides · 1080×1350",
  },
  {
    dayOffset: 1,
    hourGst: 8,
    platform: "instagram",
    contentType: "story",
    contentPillar: "water_fear",
    contentSlot: "trust_morning",
    funnel: "attraction",
    topicSeed: "Story: one sentence that calms water fear",
    hookSeed: "Fear shrinks when the plan is simple.",
    topicHashtags: ["#WaterConfidence", "#KidsSwimming"],
    primaryCtaKey: "follow",
    arabicHint: "Include one short Arabic parent line (🇦🇪 للأهل: ...).",
    briefFormat: "Instagram story · 3 frames · 9:16",
  },
  {
    dayOffset: 2,
    hourGst: 12,
    platform: "instagram",
    contentType: "reel",
    contentPillar: "real_progress",
    contentSlot: "education_midday",
    funnel: "education",
    topicSeed: "Reel: bubble line to wall glide",
    hookSeed: "Watch the shoulders drop when breathing is calm.",
    topicHashtags: ["#SwimReel", "#LearnToSwim"],
    primaryCtaKey: "save",
    briefFormat: "Instagram reel · 9:16 · 15–20s",
  },
  {
    dayOffset: 3,
    hourGst: 9,
    platform: "facebook",
    contentType: "post",
    contentPillar: "safety_awareness",
    contentSlot: "trust_morning",
    funnel: "trust",
    topicSeed: "Pool-edge safety parents can check in 30 seconds",
    hookSeed: "Safety first does not mean fear — it means clear rules.",
    topicHashtags: ["#PoolSafety"],
    primaryCtaKey: "share",
    briefFormat: "Facebook static post · 1200×630",
  },
  {
    dayOffset: 4,
    hourGst: 13,
    platform: "instagram",
    contentType: "short_video",
    contentPillar: "confidence",
    contentSlot: "education_midday",
    funnel: "engagement",
    topicSeed: "Short video: wall hold reset in 10 seconds",
    hookSeed: "Ten calm seconds at the wall can reset the whole lesson.",
    topicHashtags: ["#SwimmingConfidence", "#CoachAyman"],
    primaryCtaKey: "ask",
    briefFormat: "Instagram short video · 9:16 · 10–15s",
  },
  {
    dayOffset: 5,
    hourGst: 9,
    platform: "instagram",
    contentType: "post",
    contentPillar: "parent_concerns",
    contentSlot: "trust_morning",
    funnel: "trust",
    topicSeed: "What to tell a nervous child before lesson one",
    hookSeed: "Your child does not need bravery — they need a plan.",
    topicHashtags: ["#ParentSupport", "#AbuDhabiParents"],
    primaryCtaKey: "share",
    briefFormat: "Instagram static post · 1080×1350",
  },
  {
    dayOffset: 6,
    hourGst: 18,
    platform: "tiktok",
    contentType: "video",
    contentPillar: "aqua_training",
    contentSlot: "education_midday",
    funnel: "attraction",
    topicSeed: "TikTok hook: stop forcing the kick",
    hookSeed: "If the kick is frantic, the breath will never settle.",
    topicHashtags: ["#SwimTok", "#KickDrill"],
    primaryCtaKey: "follow",
    briefFormat: "TikTok vertical video · 9:16 · 20–30s",
  },
  {
    dayOffset: 7,
    hourGst: 12,
    platform: "facebook",
    contentType: "carousel",
    contentPillar: "swimming_education",
    contentSlot: "education_midday",
    funnel: "education",
    topicSeed: "3 common beginner mistakes at the pool wall",
    hookSeed: "Fix these early and lessons feel easier.",
    topicHashtags: ["#BeginnerSwimming"],
    primaryCtaKey: "save",
    briefFormat: "Facebook carousel · 4 slides · 1080×1080",
  },
  {
    dayOffset: 8,
    hourGst: 17,
    platform: "instagram",
    contentType: "short_video",
    contentPillar: "behind_the_scenes",
    contentSlot: "education_midday",
    funnel: "engagement",
    topicSeed: "Behind the lane: how Coach Ayman sets up a calm session",
    hookSeed: "Calm sessions start before anyone enters the water.",
    topicHashtags: ["#BehindTheScenes", "#SwimCoach"],
    primaryCtaKey: "follow",
    briefFormat: "Instagram short video · 9:16 · 20s",
  },
  {
    dayOffset: 9,
    hourGst: 18,
    platform: "instagram",
    contentType: "post",
    contentPillar: "offer_booking",
    contentSlot: "conversion_evening",
    funnel: "conversion",
    topicSeed: "Start with a free initial assessment",
    hookSeed: "Not sure which lesson format fits your child?",
    topicHashtags: ["#FreeAssessment", "#AbuDhabiSwimming"],
    primaryCtaKey: "book",
    arabicHint: "Include one short Arabic parent line for Abu Dhabi families.",
    briefFormat: "Instagram conversion post · 1080×1350",
  },
];

export function gstSlotUtc(dayOffset: number, hourGst: number, start: Date): string {
  const base = new Date(start);
  base.setUTCHours(0, 0, 0, 0);
  base.setUTCDate(base.getUTCDate() + dayOffset + 1);
  base.setUTCHours(hourGst - 4, 0, 0, 0);
  return base.toISOString();
}

export async function contentFingerprint(seed: string): Promise<string> {
  const data = new TextEncoder().encode(seed);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function buildBatchTrackedCta(platform: string, pillar: string): string {
  const params = new URLSearchParams();
  params.set("utm_source", platform.toLowerCase());
  params.set("utm_medium", "social");
  params.set("utm_campaign", "relaxfix-content-batch");
  params.set("utm_content", pillar);
  params.set("text", WHATSAPP_OPENER);
  const leadUrl = `https://wa.me/971588219130?${params.toString()}`;
  return [
    BRAND_LINE,
    `WhatsApp ${WHATSAPP} — messages & booking`,
    `Call ${PHONE} — admin team (phone calls only)`,
    "Free initial assessment.",
    `WhatsApp link: ${leadUrl}`,
  ].join("\n");
}

export function buildHashtags(
  platform: CoachAymanSlotSpec["platform"],
  topicHashtags: string[],
): string[] {
  const unique = ["#RelaxFixUAE", ...topicHashtags];
  const deduped = [...new Set(unique.map((tag) => tag.trim()).filter(Boolean))];
  if (platform === "facebook") return deduped.slice(0, 1);
  return deduped.slice(0, 5);
}

export function ensureRelaxFixBrandLead(caption: string): string {
  if (/relax fix uae/i.test(caption)) return caption;
  return `${BRAND_WITH_COACH}\n\n${caption}`;
}

export function primaryCtaForSlot(slot: CoachAymanSlotSpec): string {
  return PRIMARY_CTAS[slot.primaryCtaKey];
}

export function ensureMediaBrief(visualPrompt: string, slot: CoachAymanSlotSpec, primaryCta: string): string {
  const trimmed = visualPrompt.trim();
  const hasStructure = /FORMAT:/i.test(trimmed) && /CANVA:/i.test(trimmed) && /CAPCUT:/i.test(trimmed);
  if (hasStructure) return trimmed;

  const body = trimmed || `Coach Ayman ${slot.contentPillar.replace(/_/g, " ")} content for ${slot.platform}.`;
  return [
    `FORMAT: ${slot.briefFormat}`,
    `VISUAL CONCEPT: ${body.split("\n")[0]}`,
    `HEADLINE: ${slot.hookSeed}`,
    `SUPPORTING TEXT: Keep copy parent-friendly and specific to Abu Dhabi swimming lessons.`,
    `SCENE IDEA: Real pool context with Coach Ayman authority; no fabricated reviews.`,
    `CTA: ${primaryCta}`,
    `CANVA: ${body}`,
    slot.contentType === "reel" || slot.contentType === "video" || slot.contentType === "short_video"
      ? "RUNWAY (optional): Use only if real footage is unavailable — no AI-generated child faces."
      : null,
    `CAPCUT: Edit with burned-in captions and calm pacing where video applies.`,
  ].filter(Boolean).join("\n");
}
