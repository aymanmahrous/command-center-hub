export function normalizeHashtag(tag: unknown): string {
  const value = String(tag ?? "").trim().replace(/^#+/, "");
  return value ? `#${value}` : "";
}
export function formatHashtags(tags: unknown): string {
  if (!Array.isArray(tags)) return "";
  return tags.map(normalizeHashtag).filter(Boolean).join(" ");
}
export type PublishableMedia = {
  content_item_id?: unknown; storage_path?: unknown; asset_type?: unknown; source?: unknown;
  category?: unknown; media_status?: unknown; consent_status?: unknown; publishability_status?: unknown; metadata?: unknown;
};
export function mediaApprovalError(media: PublishableMedia | null | undefined, contentItemId: string): string | null {
  if (!media) return "MEDIA_MISSING";
  if (media.content_item_id !== contentItemId) return "MEDIA_NOT_LINKED";
  if (typeof media.storage_path !== "string" || !media.storage_path.trim()) return "MEDIA_MISSING";
  if (media.asset_type !== "image" && media.asset_type !== "video") return "MEDIA_TYPE_UNSUPPORTED";
  if (media.media_status !== "ready" || media.publishability_status !== "ready_for_review") return "MEDIA_NOT_READY";
  if (media.category !== "swimming_business" && media.category !== "other_business") return "MEDIA_CATEGORY_BLOCKED";
  const metadata = typeof media.metadata === "object" && media.metadata !== null ? media.metadata as Record<string, unknown> : {};
  if (metadata.reviewStatus !== "approved") return "MEDIA_NOT_APPROVED";
  const noRealPerson = metadata.containsRealPerson === false;
  const syntheticAttested = media.source === "generated"
    && metadata.consentApplicability === "not_applicable_synthetic"
    && typeof metadata.syntheticAttestedAt === "string" && Boolean(metadata.syntheticAttestedAt.trim())
    && typeof metadata.syntheticAttestedBy === "string" && Boolean(metadata.syntheticAttestedBy.trim());
  const personPresenceReviewed = media.source !== "generated"
    && metadata.consentApplicability === "not_applicable_no_real_person"
    && typeof metadata.personPresenceReviewedAt === "string" && Boolean(metadata.personPresenceReviewedAt.trim())
    && typeof metadata.personPresenceReviewedBy === "string" && Boolean(metadata.personPresenceReviewedBy.trim());
  const consentValid = media.category !== "swimming_business"
    || media.consent_status === "consent_confirmed"
    || (noRealPerson && (syntheticAttested || personPresenceReviewed));
  if (!consentValid) return "MEDIA_CONSENT_REQUIRED";
  return null;
}
export function confirmedExternalPostId(data: Record<string, unknown> | null | undefined): string | null {
  const value = data?.post_id ?? data?.id;
  if ((typeof value !== "string" && typeof value !== "number") || !String(value).trim()) return null;
  const normalized = String(value).trim();
  return ["undefined", "null"].includes(normalized.toLowerCase()) ? null : normalized;
}
