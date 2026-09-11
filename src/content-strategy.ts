export const CONTENT_CYCLE_DAYS = 10;
export const REVIEW_REMINDER_DAY = 9;

export const BRAND = {
  name: "Relax Fix UAE — Swimming Academy",
  publicLine: "Relax Fix UAE Swimming Academy",
  withCoach: "Relax Fix UAE Swimming Academy — Coach Ayman",
  coach: "Coach Ayman",
  primaryHashtag: "#RelaxFixUAE",
  whatsappOpener:
    "Hi Relax Fix UAE — I saw Coach Ayman's swimming content and would like a free initial assessment.",
  audience: "Parents in Abu Dhabi",
  experience: "15+ years swimming coaching experience",
  offers: ["Private coaching", "Small groups up to 4 learners", "Free initial assessment"],
  locations: ["Abu Dhabi", "ICS locations"],
  whatsapp: "058 821 9130",
  whatsappRole: "messages & booking",
  phone: "055 137 8660",
  phoneRole: "admin team — phone calls only",
} as const;

export const RELAXFIX_WHATSAPP_E164 = "971588219130";

export function ensureRelaxFixBrandLead(caption: string): string {
  if (/relax fix uae/i.test(caption)) return caption;
  return `${BRAND.withCoach}\n\n${caption}`;
}

export function hashtagsForPlatform(platform: string, contentType?: string): string[] {
  const normalized = platform.toLowerCase();
  if (normalized === "facebook") return [BRAND.primaryHashtag];
  if (normalized === "tiktok") return [BRAND.primaryHashtag, "#AbuDhabiSwimming", "#SwimTok"];
  if (contentType?.toLowerCase() === "reel") {
    return [BRAND.primaryHashtag, "#AbuDhabiSwimming", "#SwimReel", "#CoachAyman"];
  }
  return [BRAND.primaryHashtag, "#AbuDhabiSwimming", "#CoachAyman"];
}

export type ContentPillar =
  | "education"
  | "safety"
  | "water_confidence"
  | "parent_faq"
  | "coach_authority"
  | "local_abu_dhabi"
  | "conversion"
  | "reel_video"
  | "myth_fact"
  | "beginner_guidance";

export type PlatformTarget = "instagram" | "facebook" | "tiktok" | "all";

export type TimeSlot = "morning" | "evening" | "any";

export type BatchMixSlot = {
  pillar: ContentPillar;
  platform: PlatformTarget;
  timeSlot: TimeSlot;
  contentType: string;
  labelKey: string;
};

export const DEFAULT_BATCH_MIX: BatchMixSlot[] = [
  { pillar: "education", platform: "instagram", timeSlot: "morning", contentType: "carousel", labelKey: "mixEducation" },
  { pillar: "education", platform: "facebook", timeSlot: "morning", contentType: "post", labelKey: "mixEducation" },
  { pillar: "safety", platform: "instagram", timeSlot: "morning", contentType: "post", labelKey: "mixSafety" },
  { pillar: "water_confidence", platform: "facebook", timeSlot: "morning", contentType: "post", labelKey: "mixWaterConfidence" },
  { pillar: "reel_video", platform: "instagram", timeSlot: "evening", contentType: "reel", labelKey: "mixReel" },
  { pillar: "reel_video", platform: "tiktok", timeSlot: "evening", contentType: "video", labelKey: "mixReel" },
  { pillar: "coach_authority", platform: "instagram", timeSlot: "morning", contentType: "post", labelKey: "mixCoach" },
  { pillar: "local_abu_dhabi", platform: "facebook", timeSlot: "morning", contentType: "post", labelKey: "mixLocal" },
  { pillar: "conversion", platform: "facebook", timeSlot: "evening", contentType: "post", labelKey: "mixConversion" },
  { pillar: "parent_faq", platform: "instagram", timeSlot: "morning", contentType: "carousel", labelKey: "mixFaq" },
];

export const PLATFORM_GUIDANCE: Record<PlatformTarget, { focus: string; format: string }> = {
  instagram: {
    focus: "Premium visuals, save/share educational posts, Reels, carousels, Stories",
    format: "Reels · carousels · educational posts",
  },
  facebook: {
    focus: "Parent education, Abu Dhabi local trust, community tone, Reels",
    format: "Parent-focused posts · local trust · Reels",
  },
  tiktok: {
    focus: "Strong 1–2s hook, short tips, myths/mistakes, conversational Coach Ayman style",
    format: "Short hooks · quick tips · direct tone",
  },
  all: {
    focus: "Adapt one core idea per platform; do not copy identical captions everywhere",
    format: "Platform-specific versions of one idea",
  },
};

const PILLAR_KEYS = ["contentPillar", "content_pillar", "pillar", "topicCategory", "topic_category"] as const;

export function readContentPillar(item: Record<string, unknown>): ContentPillar | null {
  for (const key of PILLAR_KEYS) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) {
      const normalized = value.trim().toLowerCase().replace(/\s+/g, "_");
      if (isContentPillar(normalized)) return normalized;
    }
  }
  return null;
}

function isContentPillar(value: string): value is ContentPillar {
  return [
    "education", "safety", "water_confidence", "parent_faq", "coach_authority",
    "local_abu_dhabi", "conversion", "reel_video", "myth_fact", "beginner_guidance",
  ].includes(value);
}

const TIME_SLOT_KEYS = ["timeSlot", "time_slot", "postingSlot", "posting_slot"] as const;

export function readTimeSlot(item: Record<string, unknown>): TimeSlot {
  for (const key of TIME_SLOT_KEYS) {
    const value = item[key];
    if (value === "morning" || value === "evening") return value;
  }
  return "any";
}

export type PerformanceInsight = {
  id: string;
  label: string;
  direction: "increase" | "maintain" | "reduce";
  reason: string;
};

export function buildPerformanceInsights(items: Array<Record<string, unknown>>): PerformanceInsight[] {
  const scored = items
    .map((item) => {
      const views = readMetric(item, ["views", "reach", "impressions"]);
      const engagement = readMetric(item, ["engagement", "engagementRate", "engagement_rate"]);
      const saves = readMetric(item, ["saves", "saveCount", "save_count"]);
      const pillar = readContentPillar(item);
      const platform = typeof item.platform === "string" ? item.platform.toLowerCase() : "unknown";
      const contentType = typeof item.contentType === "string" ? item.contentType.toLowerCase() : "unknown";
      const score = (views ?? 0) * 0.4 + (engagement ?? 0) * 0.35 + (saves ?? 0) * 0.25;
      return { pillar, platform, contentType, score, status: item.status };
    })
    .filter((entry) => entry.status === "published" && entry.score > 0);

  if (scored.length < 3) {
    return [{
      id: "sample-size",
      label: "Performance guidance",
      direction: "maintain",
      reason: "Not enough published performance data yet. Follow the default 10-day mix until more posts are published.",
    }];
  }

  const byPillar = aggregateScores(scored, (entry) => entry.pillar ?? "unknown");
  const byType = aggregateScores(scored, (entry) => entry.contentType);
  const insights: PerformanceInsight[] = [];
  const topPillar = pickTop(byPillar);
  const topType = pickTop(byType);

  if (topPillar && topPillar.key.includes("safety")) {
    insights.push({
      id: "safety-reels",
      label: "Safety / water-confidence content",
      direction: "increase",
      reason: "Published safety-related content is performing relatively well. Consider more saveable safety and confidence posts — not as hard sales pitches.",
    });
  }
  if (topType && (topType.key.includes("reel") || topType.key.includes("video"))) {
    insights.push({
      id: "short-video",
      label: "Short-form video",
      direction: "increase",
      reason: "Short video formats are leading in the current sample. Keep 2–3 video concepts per batch, with strong opening hooks.",
    });
  }
  if (insights.length === 0) {
    insights.push({
      id: "balanced",
      label: "Balanced mix",
      direction: "maintain",
      reason: "Use the default educational mix: attract → educate → build trust → convert. Avoid repeating the same promotional angle.",
    });
  }
  return insights.slice(0, 3);
}

function readMetric(item: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  }
  return null;
}

function aggregateScores<T extends { score: number }>(entries: T[], pick: (entry: T) => string) {
  const totals = new Map<string, { total: number; count: number }>();
  for (const entry of entries) {
    const key = pick(entry);
    const current = totals.get(key) ?? { total: 0, count: 0 };
    current.total += entry.score;
    current.count += 1;
    totals.set(key, current);
  }
  return [...totals.entries()].map(([key, value]) => ({ key, avg: value.total / value.count }));
}

function pickTop(entries: Array<{ key: string; avg: number }>) {
  return entries.sort((left, right) => right.avg - left.avg)[0] ?? null;
}

