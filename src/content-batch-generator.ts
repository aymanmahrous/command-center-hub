export const COACH_AYMAN_BATCH_SIZE = 10;
export const COACH_AYMAN_PROVIDER_ID = "command-center-coach-ayman-2026";

const WHATSAPP = "058 821 9130";
const PHONE = "055 137 8660";

export const CONFIRMED_CTA = [
  `WhatsApp ${WHATSAPP}`,
  `Call ${PHONE}`,
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
};

const FORBIDDEN_CLAIMS = /\b(guarantee|guaranteed|award-winning|#1|testimonial|before and after results|100% success|olympic coach|world record)\b/i;

function gstSlotUtc(dayOffset: number, hourGst: number, start: Date): string {
  const base = new Date(start);
  base.setUTCHours(0, 0, 0, 0);
  base.setUTCDate(base.getUTCDate() + dayOffset + 1);
  base.setUTCHours(hourGst - 4, 0, 0, 0);
  return base.toISOString();
}

function visualBrief(parts: { canva: string; runway?: string; capcut: string }): string {
  return [
    `CANVA: ${parts.canva}`,
    parts.runway ? `RUNWAY: ${parts.runway}` : null,
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
    topic: "3 calm breathing habits before your child enters the pool",
    hook: "Most kids rush into the water before their body is ready.",
    caption: [
      "Parents in Abu Dhabi often ask Coach Ayman where to start.",
      "",
      "Before the first lane or play session, try these three calm habits:",
      "1) Stand together at the pool edge and name three things you both see.",
      "2) Practice slow nose/mouth breathing away from the splash zone.",
      "3) Let your child choose one small goal for the session — not a race, just one skill.",
      "",
      "Small routines reduce panic and help children listen to the coach faster.",
      "",
      CONFIRMED_CTA,
    ].join("\n"),
    cta: CONFIRMED_CTA,
    hashtags: ["#AbuDhabiSwimming", "#SwimLessons", "#CoachAyman", "#WaterConfidence", "#ParentTips"],
    visualPrompt: visualBrief({
      canva: "5-slide carousel, soft blue/teal palette, Coach Ayman portrait placeholder, one tip per slide, large readable text for mobile.",
      capcut: "Optional reel cut-down: 1 tip per second, on-screen captions, gentle pool ambient audio.",
    }),
  },
  {
    dayOffset: 1,
    slotHourGst: 8,
    platform: "facebook",
    contentType: "post",
    language: "en",
    contentPillar: "safety_awareness",
    contentSlot: "trust_morning",
    topic: "Pool-edge safety parents can check in 30 seconds",
    hook: "Safety first does not mean fear — it means clear rules.",
    caption: [
      "At Relax Fix UAE Swimming Academy, Coach Ayman keeps safety language simple for families in Abu Dhabi.",
      "",
      "Before every session, check:",
      "• Is there active adult supervision near the pool edge?",
      "• Are toys or floats cleared from the entry area?",
      "• Does your child know where to wait before the coach invites them in?",
      "",
      "Clear boundaries help children feel secure — not scared.",
      "",
      CONFIRMED_CTA,
    ].join("\n"),
    cta: CONFIRMED_CTA,
    hashtags: ["#WaterSafety", "#AbuDhabiParents", "#SwimSchool", "#RelaxFixUAE"],
    visualPrompt: visualBrief({
      canva: "Single educational graphic: checklist layout, pool-edge photo placeholder, bold safety headline.",
      capcut: "Static post — no video required.",
    }),
  },
  {
    dayOffset: 2,
    slotHourGst: 9,
    platform: "instagram",
    contentType: "post",
    language: "en",
    contentPillar: "parent_concerns",
    contentSlot: "trust_morning",
    topic: "What to tell a nervous child before lesson one",
    hook: "Your child does not need bravery — they need a plan.",
    caption: [
      "If your child is nervous around water, Coach Ayman recommends honest, short reassurance:",
      "",
      "• \"The coach stays with you the whole time.\"",
      "• \"You can pause on the step whenever you need.\"",
      "• \"We practice small skills before anything new.\"",
      "",
      "Avoid comparing siblings or friends. Progress is personal.",
      "",
      "Water confidence grows from small repeats — bubbles, wall holds, and short glides with coach support.",
      "",
      CONFIRMED_CTA,
    ].join("\n"),
    cta: CONFIRMED_CTA,
    hashtags: ["#ParentAdvice", "#SwimAnxiety", "#AbuDhabiKids", "#CoachAyman"],
    visualPrompt: visualBrief({
      canva: "Quote-style post with parent + child silhouette near pool steps, warm supportive tone.",
      capcut: "Optional story version with text animation per bullet.",
    }),
  },
  {
    dayOffset: 3,
    slotHourGst: 18,
    platform: "instagram",
    contentType: "post",
    language: "en",
    contentPillar: "offer_booking",
    contentSlot: "conversion_evening",
    topic: "Start with a free initial assessment",
    hook: "Not sure which lesson format fits your child?",
    caption: [
      "Private coaching or small groups up to 4 learners — Coach Ayman helps Abu Dhabi families choose the right starting point.",
      "",
      "Book a free initial assessment first. We review comfort in the water, listening skills, and your goals together.",
      "",
      CONFIRMED_CTA,
    ].join("\n"),
    cta: CONFIRMED_CTA,
    hashtags: ["#BookSwimLessons", "#AbuDhabiSwimming", "#RelaxFixUAE", "#CoachAyman"],
    visualPrompt: visualBrief({
      canva: "Conversion post with calendar/assessment icon, WhatsApp + phone visible, no fabricated reviews.",
      capcut: "15s CTA reel with contact overlay.",
    }),
  },
  {
    dayOffset: 4,
    slotHourGst: 12,
    platform: "instagram",
    contentType: "post",
    language: "en",
    contentPillar: "swimming_education",
    contentSlot: "education_midday",
    topic: "3 common beginner mistakes at the pool wall",
    hook: "Fix these early and lessons feel easier.",
    caption: [
      "Coach Ayman sees the same beginner habits in Abu Dhabi pools:",
      "",
      "1) Holding breath instead of exhaling underwater.",
      "2) Stiff fingers on the wall — tension travels to the whole body.",
      "3) Looking up instead of forward when pushing off.",
      "",
      "Gentle correction beats rushing to full strokes.",
      "",
      CONFIRMED_CTA,
    ].join("\n"),
    cta: CONFIRMED_CTA,
    hashtags: ["#SwimmingTips", "#BeginnerSwimmer", "#CoachAyman", "#AbuDhabiSwimming"],
    visualPrompt: visualBrief({
      canva: "Split graphic: mistake vs calm correction sketch, educational tone only.",
      capcut: "Reel option: 3 quick cuts, one mistake each, text overlay.",
    }),
  },
  {
    dayOffset: 5,
    slotHourGst: 9,
    platform: "instagram",
    contentType: "post",
    language: "en",
    contentPillar: "coach_authority",
    contentSlot: "trust_morning",
    topic: "How Coach Ayman structures a first assessment",
    hook: "Every child starts with listening — not laps.",
    caption: [
      "Coach Ayman brings 15+ years of swimming coaching experience to families across Abu Dhabi.",
      "",
      "A free initial assessment covers:",
      "• Comfort level in shallow water",
      "• Listening and following simple cues",
      "• Parent goals (safety, confidence, stroke basics)",
      "",
      "Private coaching and small groups up to 4 learners keep sessions focused.",
      "",
      CONFIRMED_CTA,
    ].join("\n"),
    cta: CONFIRMED_CTA,
    hashtags: ["#CoachAyman", "#SwimCoach", "#AbuDhabi", "#RelaxFixUAE"],
    visualPrompt: visualBrief({
      canva: "Coach introduction card, ICS/Abu Dhabi location mention, professional pool background placeholder.",
      capcut: "Talking-head reel: 20–30s intro, captions required.",
    }),
  },
  {
    dayOffset: 6,
    slotHourGst: 8,
    platform: "facebook",
    contentType: "post",
    language: "en",
    contentPillar: "behind_the_scenes",
    contentSlot: "education_midday",
    topic: "Swimming in Abu Dhabi heat — timing lessons wisely",
    hook: "Heat changes energy. Plan sessions with the weather.",
    caption: [
      "Families training with Relax Fix UAE around Abu Dhabi and ICS locations know afternoon heat can drain focus.",
      "",
      "Coach Ayman recommends:",
      "• Hydrate before arriving at the pool",
      "• Morning or evening slots when possible",
      "• Short skill blocks instead of long endurance sets for young learners",
      "",
      "Comfort keeps technique clean.",
      "",
      CONFIRMED_CTA,
    ].join("\n"),
    cta: CONFIRMED_CTA,
    hashtags: ["#AbuDhabiLife", "#SwimLessonsUAE", "#ParentTips", "#RelaxFixUAE"],
    visualPrompt: visualBrief({
      canva: "Local Abu Dhabi pool context photo placeholder, sun/schedule iconography, no fabricated stats.",
      capcut: "Static Facebook post.",
    }),
  },
  {
    dayOffset: 7,
    slotHourGst: 17,
    platform: "instagram",
    contentType: "reel",
    language: "en",
    contentPillar: "real_progress",
    contentSlot: "education_midday",
    topic: "Reel idea: bubble line to wall glide",
    hook: "Watch the shoulders drop when breathing is calm.",
    caption: [
      "Reel script for Coach Ayman (15–20 seconds):",
      "",
      "0–2s hook: \"One drill that calms nervous swimmers.\"",
      "3–10s: bubbles at the wall, relaxed exhale.",
      "11–18s: short assisted glide, coach hands visible for safety.",
      "",
      "Keep music low; prioritize clear captions.",
      "",
      CONFIRMED_CTA,
    ].join("\n"),
    cta: CONFIRMED_CTA,
    hashtags: ["#SwimReel", "#LearnToSwim", "#AbuDhabi", "#CoachAyman"],
    visualPrompt: visualBrief({
      canva: "Cover frame: bold hook text on pool background.",
      runway: "Optional b-roll: slow-motion exhale at pool wall, natural lighting, no AI-generated child faces.",
      capcut: "Vertical 9:16, hook in first 2 seconds, burned-in captions, end card with CTA text only.",
    }),
  },
  {
    dayOffset: 8,
    slotHourGst: 18,
    platform: "tiktok",
    contentType: "video",
    language: "en",
    contentPillar: "real_progress",
    contentSlot: "education_midday",
    topic: "TikTok hook: stop forcing the kick",
    hook: "If the kick is frantic, the breath will never settle.",
    caption: [
      "TikTok hook (1–2 seconds): \"Stop forcing the kick.\"",
      "",
      "Quick tip from Coach Ayman:",
      "Relax the ankles, small splashes, coach-supported float first.",
      "",
      "Direct tone, no hype, no fake results.",
      "",
      CONFIRMED_CTA,
    ].join("\n"),
    cta: CONFIRMED_CTA,
    hashtags: ["#SwimTok", "#SwimmingTips", "#AbuDhabi", "#CoachAyman"],
    visualPrompt: visualBrief({
      canva: "Title card for export thumbnail.",
      runway: "Short clip: legs-only kick demo with pool lane lines, coach voiceover optional.",
      capcut: "Fast cut TikTok pacing, large captions, conversational Coach Ayman style.",
    }),
  },
  {
    dayOffset: 9,
    slotHourGst: 18,
    platform: "facebook",
    contentType: "post",
    language: "en",
    contentPillar: "offer_booking",
    contentSlot: "conversion_evening",
    topic: "Book a free initial assessment in Abu Dhabi",
    hook: "Ready for a calm first step in the water?",
    caption: [
      "Relax Fix UAE Swimming Academy — Coach Ayman",
      "",
      "Private coaching · small groups up to 4 learners · Abu Dhabi & ICS locations",
      "",
      "Start with a free initial assessment. No pressure — just clarity on the right next step for your child.",
      "",
      CONFIRMED_CTA,
    ].join("\n"),
    cta: CONFIRMED_CTA,
    hashtags: ["#BookSwimLessons", "#AbuDhabiSwimming", "#RelaxFixUAE", "#CoachAyman"],
    visualPrompt: visualBrief({
      canva: "Clean booking CTA graphic, WhatsApp + phone icons, brand colors, no discount claims beyond approved offers.",
      capcut: "Optional 10s CTA bumper with contact details on screen.",
    }),
  },
];

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
  params.set(
    "text",
    "Hi Coach Ayman, I saw your swimming content and would like a free initial assessment.",
  );
  const leadUrl = `https://wa.me/971588219130?${params.toString()}`;
  return [
    "WhatsApp 058 821 9130",
    "Call 055 137 8660",
    "Free initial assessment.",
    `Tracked booking link: ${leadUrl}`,
  ].join("\n");
}

export async function buildCoachAyman2026BatchItems(start = new Date(), batchNonce = start.toISOString()): Promise<GeneratedBatchItem[]> {
  const items: GeneratedBatchItem[] = [];
  for (let index = 0; index < SLOT_TEMPLATES.length; index += 1) {
    const slot = SLOT_TEMPLATES[index];
    const fingerprintSeed = `${COACH_AYMAN_PROVIDER_ID}:${batchNonce}:${index}:${slot.platform}:${slot.topic}`;
    const trackedCta = buildBatchTrackedCta(slot.platform, slot.contentPillar);
    items.push({
      platform: slot.platform,
      contentType: slot.contentType,
      language: slot.language,
      contentPillar: slot.contentPillar,
      contentSlot: slot.contentSlot,
      plannedFor: gstSlotUtc(slot.dayOffset, slot.slotHourGst, start),
      topic: slot.topic,
      hook: slot.hook,
      caption: slot.caption.includes("wa.me/") ? slot.caption : `${slot.caption}\n\n${trackedCta}`,
      cta: trackedCta,
      hashtags: slot.hashtags,
      visualPrompt: slot.visualPrompt,
      contentFingerprint: await contentFingerprint(fingerprintSeed),
    });
  }
  return items;
}

export function validateCoachAymanBatch(items: GeneratedBatchItem[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (items.length !== COACH_AYMAN_BATCH_SIZE) errors.push(`expected ${COACH_AYMAN_BATCH_SIZE} items`);
  const fingerprints = new Set<string>();
  const planned = new Set<string>();
  let conversionCount = 0;
  for (const item of items) {
    if (fingerprints.has(item.contentFingerprint)) errors.push("duplicate fingerprint");
    fingerprints.add(item.contentFingerprint);
    if (planned.has(item.plannedFor)) errors.push("duplicate plannedFor");
    planned.add(item.plannedFor);
    if (item.contentPillar === "offer_booking") conversionCount += 1;
    if (!item.cta.includes(WHATSAPP) || !item.cta.includes(PHONE)) errors.push("missing confirmed CTA");
    if (FORBIDDEN_CLAIMS.test(`${item.topic} ${item.hook} ${item.caption}`)) errors.push("forbidden claim language");
    if (!/CANVA:/i.test(item.visualPrompt) || !/CAPCUT:/i.test(item.visualPrompt)) errors.push("missing production brief");
  }
  if (conversionCount < 1 || conversionCount > 3) errors.push("conversion mix out of range");
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
  };
}
