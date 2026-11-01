export const MEDIA_CATEGORIES = [
  "swimming_business",
  "family_personal",
  "other_business",
  "other",
  "unclassified",
] as const;

export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

export const MARKETING_BLOCKED_CATEGORIES = new Set<MediaCategory>([
  "family_personal",
  "other",
  "unclassified",
]);

export type ConsentStatus = "pending" | "granted" | "denied" | "expired" | "consent_confirmed" | null;
export type AiSuitabilityVerdict = "good" | "needs_review" | "unsuitable";
export type AiAnalysisStatus = "pending" | "analyzed" | "failed" | "skipped";
export type PublishabilityStatus = "pending" | "cleared" | "blocked" | "review" | "ready_for_review" | null;
export type MediaWorkflowStatus = "pending" | "ready" | "processing" | "failed";
export type MediaReviewStatus = "pending_review" | "approved" | "rejected" | "unsuitable";
export type MediaAssetType = "image" | "video" | "document" | "audio";
export type MediaSourceKind = "upload" | "generated" | "external" | "stock";

export type MediaAssetRecord = {
  id: string;
  assetType: MediaAssetType;
  source: MediaSourceKind;
  storagePath: string | null;
  name?: string;
  webUrl?: string | null;
  mimeType?: string | null;
  previewUrl?: string | null;
  folder?: string;
  category: MediaCategory;
  mediaStatus: MediaWorkflowStatus;
  aiAnalysisStatus: AiAnalysisStatus;
  publishabilityStatus: PublishabilityStatus;
  consentStatus: ConsentStatus;
  suggestedPlatforms: string[];
  suggestedFormats: string[];
  aiNotes: string;
  metadata: Record<string, unknown>;
  contentItemId: string | null;
  createdAt: string;
  updatedAt: string | null;
  [key: string]: unknown;
};

export function resolveMediaAssetName(asset: {
  metadata?: Record<string, unknown>;
  storagePath?: string | null;
}): string {
  for (const key of ["file_name", "fileName", "originalName", "name", "title"]) {
    const value = asset.metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  const pathName = asset.storagePath?.split("/").filter(Boolean).at(-1);
  return pathName || "Media asset";
}

export function normalizeMediaCategory(value: unknown): MediaCategory {
  if (typeof value === "string" && MEDIA_CATEGORIES.includes(value as MediaCategory)) {
    return value as MediaCategory;
  }
  return "unclassified";
}

export function isMarketingEligibleCategory(category: MediaCategory): boolean {
  return category === "swimming_business" || category === "other_business";
}

export function displayMediaWorkflowStatus(
  asset: Pick<MediaAssetRecord, "mediaStatus">,
): MediaWorkflowStatus {
  return asset.mediaStatus;
}

export function canUseInMarketingBatch(
  asset: Pick<MediaAssetRecord, "category" | "consentStatus" | "publishabilityStatus" | "mediaStatus" | "source" | "metadata">,
): boolean {
  if (!isMarketingEligibleCategory(asset.category)) return false;
  if (asset.mediaStatus !== "ready") return false;
  if (
    asset.category === "swimming_business"
    && asset.consentStatus !== "consent_confirmed"
    && !isSyntheticConsentExempt(asset.source, asset.metadata)
  ) return false;
  return asset.publishabilityStatus === "ready_for_review";
}

export function isSyntheticConsentExempt(
  source: MediaSourceKind,
  metadata: Record<string, unknown>,
): boolean {
  return source === "generated"
    && metadata.consentApplicability === "not_applicable_synthetic"
    && metadata.containsRealPerson === false;
}

export function derivePublishability(
  category: MediaCategory,
  consentStatus: ConsentStatus,
  mediaStatus: MediaWorkflowStatus,
  suitabilityVerdict?: AiSuitabilityVerdict,
  consentNotApplicableSynthetic = false,
): Exclude<PublishabilityStatus, null> {
  if (MARKETING_BLOCKED_CATEGORIES.has(category)) return "blocked";
  if (mediaStatus !== "ready" || suitabilityVerdict === "unsuitable") return "blocked";
  if (category === "swimming_business" && !consentNotApplicableSynthetic && consentStatus !== "consent_confirmed") return "blocked";
  return "ready_for_review";
}
