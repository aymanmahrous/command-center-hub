// Normalize historical database vocabulary at the read boundary. Never promote
// legacy "approved" rows to publish-ready: they require fresh human review.
export function normalizeLegacyMediaAssetRows(value: unknown): unknown {
  return Array.isArray(value) ? value.map((item) => {
  if (!item || typeof item !== "object" || Array.isArray(item)) return item;
  const row = item as Record<string, unknown>;
  const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? { ...(row.metadata as Record<string, unknown>) }
    : {};
  const rememberLegacy = (key: string, legacy: unknown) => {
    if (typeof legacy === "string" && legacy.length > 0) metadata[`legacy_${key}`] = legacy;
  };

  let assetType = row.assetType;
  if (assetType === "other") rememberLegacy("asset_type", assetType);
  let source = row.source;
  if (source === "ai_generated") {
    rememberLegacy("source", source);
    source = "generated";
  }
  let mediaStatus = row.mediaStatus;
  if (mediaStatus === "approved" || mediaStatus === "unclassified") {
    rememberLegacy("media_status", mediaStatus);
    mediaStatus = "pending";
  }
  let aiAnalysisStatus = row.aiAnalysisStatus;
  if (aiAnalysisStatus === "completed") {
    rememberLegacy("ai_analysis_status", aiAnalysisStatus);
    aiAnalysisStatus = "analyzed";
  } else if (aiAnalysisStatus === "not_started") {
    rememberLegacy("ai_analysis_status", aiAnalysisStatus);
    aiAnalysisStatus = "pending";
  }
  let publishabilityStatus = row.publishabilityStatus;
  if (publishabilityStatus === "consent_required") {
    rememberLegacy("publishability_status", publishabilityStatus);
    publishabilityStatus = "blocked";
  }
  let consentStatus = row.consentStatus;
  if (consentStatus === "unknown" || consentStatus === "consent_required") {
    rememberLegacy("consent_status", consentStatus);
    consentStatus = "pending";
  }

  return { ...row, assetType, source, mediaStatus, aiAnalysisStatus, publishabilityStatus, consentStatus, metadata };
  }) : value;
}