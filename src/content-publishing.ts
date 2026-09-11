import type { ContentBatchItem } from "./content-batch";

export const RELAXFIX_WHATSAPP_E164 = "971588219130";
export const RELAXFIX_CALL_E164 = "971551378660";
export const RELAXFIX_WHATSAPP_DISPLAY = "058 821 9130";
export const RELAXFIX_CALL_DISPLAY = "055 137 8660";
export const RELAXFIX_BRAND_LINE = "Relax Fix UAE Swimming Academy";
export const RELAXFIX_BRAND_WITH_COACH = "Relax Fix UAE Swimming Academy — Coach Ayman";
export const RELAXFIX_WHATSAPP_OPENER =
  "Hi Relax Fix UAE — I saw Coach Ayman's swimming content and would like a free initial assessment.";
export const RELAXFIX_WHATSAPP_CTA_LINE = `WhatsApp ${RELAXFIX_WHATSAPP_DISPLAY} — messages & booking`;
export const RELAXFIX_CALL_CTA_LINE = `Call ${RELAXFIX_CALL_DISPLAY} — admin team (phone calls only)`;
export const RELAXFIX_ASSESSMENT_CTA_LINE = "Free initial assessment.";

export function buildPublicContactCta(): string {
  return [RELAXFIX_WHATSAPP_CTA_LINE, RELAXFIX_CALL_CTA_LINE, RELAXFIX_ASSESSMENT_CTA_LINE].join("\n");
}

export function buildTrackedCta(platform: string, pillar?: string | null): string {
  const leadUrl = buildWhatsAppLeadUrl({ platform, pillar });
  return [
    RELAXFIX_WHATSAPP_CTA_LINE,
    RELAXFIX_CALL_CTA_LINE,
    RELAXFIX_ASSESSMENT_CTA_LINE,
    `WhatsApp link: ${leadUrl}`,
  ].join("\n");
}

export function ensureRelaxFixBrandLead(caption: string): string {
  if (/relax fix uae/i.test(caption)) return caption;
  return `${RELAXFIX_BRAND_WITH_COACH}\n\n${caption}`;
}

export function hashtagsForPlatform(platform: string, contentType?: string): string[] {
  const normalized = platform.toLowerCase();
  if (normalized === "facebook") return ["#RelaxFixUAE"];
  if (normalized === "tiktok") return ["#RelaxFixUAE", "#AbuDhabiSwimming", "#SwimTok"];
  if (contentType?.toLowerCase() === "reel") {
    return ["#RelaxFixUAE", "#AbuDhabiSwimming", "#SwimReel", "#CoachAyman"];
  }
  return ["#RelaxFixUAE", "#AbuDhabiSwimming", "#CoachAyman"];
}

export function buildWhatsAppLeadUrl(options: {
  platform: string;
  pillar?: string | null;
  campaign?: string;
  message?: string;
}): string {
  const params = new URLSearchParams();
  params.set("utm_source", options.platform.toLowerCase());
  params.set("utm_medium", "social");
  params.set("utm_campaign", options.campaign ?? "relaxfix-content-batch");
  if (options.pillar) params.set("utm_content", options.pillar);
  const text = options.message ?? RELAXFIX_WHATSAPP_OPENER;
  params.set("text", text);
  return `https://wa.me/${RELAXFIX_WHATSAPP_E164}?${params.toString()}`;
}

export const FACEBOOK_PAGE_ID = "1164107840123575";
export const AUTHORIZED_FACEBOOK_PUBLISH_ITEM_ID = "9cf29b08-aaa3-4278-80bc-08a4cf3bc381";

export type PublicationReceipt = {
  platform: string;
  status: string;
  externalPostId: string | null;
  externalContainerId: string | null;
  plainLanguageReason: string | null;
  updatedAt: string | null;
};

export type PublishPipelineStage =
  | "needs_review"
  | "approved_ready"
  | "awaiting_n8n"
  | "scheduled"
  | "published_live"
  | "failed"
  | "other";

export type LivePublishingReadiness = {
  approvedCount: number;
  awaitingN8nCount: number;
  publishedLiveCount: number;
  failedCount: number;
  authorizedItem: ContentBatchItem | null;
  authorizedStage: PublishPipelineStage | null;
  nextAction: "review" | "approve" | "publish_via_n8n" | "verify_receipt" | "continue_batch";
};

const PUBLISH_PLATFORMS = new Set(["facebook", "instagram", "tiktok"]);
const REVIEW_STATUSES = new Set(["draft", "generated", "needs_review", "idea"]);

export function parsePublicationReceipts(item: ContentBatchItem): PublicationReceipt[] {
  const raw = item.receipts;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    return [{
      platform: String(record.platform ?? ""),
      status: String(record.status ?? ""),
      externalPostId: typeof record.externalPostId === "string" ? record.externalPostId : null,
      externalContainerId: typeof record.externalContainerId === "string" ? record.externalContainerId : null,
      plainLanguageReason: typeof record.plainLanguageReason === "string" ? record.plainLanguageReason : null,
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : null,
    }];
  });
}

export function latestReceiptForPlatform(item: ContentBatchItem, platform: string): PublicationReceipt | null {
  const normalized = platform.toLowerCase();
  const receipts = parsePublicationReceipts(item)
    .filter((receipt) => receipt.platform.toLowerCase() === normalized)
    .sort((left, right) => new Date(right.updatedAt ?? 0).getTime() - new Date(left.updatedAt ?? 0).getTime());
  return receipts[0] ?? null;
}

export function buildExternalPostLink(platform: string, externalPostId: string | null | undefined): string | null {
  if (!externalPostId?.trim()) return null;
  const id = externalPostId.trim();
  if (/^https?:\/\//i.test(id)) return id;
  const normalized = platform.toLowerCase();
  if (normalized === "facebook") return `https://www.facebook.com/${FACEBOOK_PAGE_ID}/posts/${id}`;
  if (normalized === "instagram") return `https://www.instagram.com/p/${id.replace(/^\/+/, "")}/`;
  return null;
}

export function resolvePublishPipelineStage(item: ContentBatchItem): PublishPipelineStage {
  if (item.status === "failed") return "failed";
  if (item.status === "published" || item.publishedAt) return "published_live";
  if (item.status === "scheduled") return "scheduled";

  const platformReceipt = latestReceiptForPlatform(item, item.platform);
  if (platformReceipt?.status === "published") return "published_live";
  if (platformReceipt?.status === "failed" || platformReceipt?.status === "ambiguous") return "failed";

  if (item.status === "approved" && PUBLISH_PLATFORMS.has(String(item.platform).toLowerCase())) {
    return platformReceipt ? "awaiting_n8n" : "approved_ready";
  }

  if (REVIEW_STATUSES.has(item.status)) return "needs_review";
  return "other";
}

export function summarizeLivePublishingReadiness(items: ContentBatchItem[]): LivePublishingReadiness {
  let approvedCount = 0;
  let awaitingN8nCount = 0;
  let publishedLiveCount = 0;
  let failedCount = 0;

  for (const item of items) {
    const stage = resolvePublishPipelineStage(item);
    if (stage === "approved_ready" || stage === "awaiting_n8n") approvedCount += 1;
    if (stage === "awaiting_n8n") awaitingN8nCount += 1;
    if (stage === "published_live") publishedLiveCount += 1;
    if (stage === "failed") failedCount += 1;
  }

  const authorizedItem = items.find((item) => item.id === AUTHORIZED_FACEBOOK_PUBLISH_ITEM_ID) ?? null;
  const authorizedStage = authorizedItem ? resolvePublishPipelineStage(authorizedItem) : null;

  let nextAction: LivePublishingReadiness["nextAction"] = "continue_batch";
  if (authorizedItem && authorizedStage !== "published_live") nextAction = "publish_via_n8n";
  else if (publishedLiveCount === 0 && approvedCount > 0) nextAction = "publish_via_n8n";
  else if (items.some((item) => REVIEW_STATUSES.has(item.status))) nextAction = "review";
  else if (items.some((item) => item.status === "approved")) nextAction = "approve";
  else if (failedCount > 0) nextAction = "verify_receipt";

  return {
    approvedCount,
    awaitingN8nCount,
    publishedLiveCount,
    failedCount,
    authorizedItem,
    authorizedStage,
    nextAction,
  };
}
