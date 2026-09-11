import { useEffect, useState } from "react";
import { z } from "zod";
import type { AiSuitabilityVerdict, MediaAssetRecord, MediaCategory, ConsentStatus } from "./media-types";
import { displayMediaWorkflowStatus } from "./media-types";
import { analyzeMediaWithProvider, fetchGeminiIntegrationStatus, type GeminiIntegrationStatus } from "./media-gemini-adapter";
import type { MediaAnalysisResult } from "./media-ai-analysis";
import { displayProviderStatus, readMediaProviderStatuses } from "./media-providers";
import { normalizeMediaCategory } from "./media-types";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const SUPABASE_PUBLIC_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

type ControlSession = { accessToken: string };

async function callRpc(session: ControlSession, rpcName: string, body: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${encodeURIComponent(rpcName)}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLIC_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (response.status === 401 || response.status === 403) throw new Error("SESSION_EXPIRED");
  if (!response.ok) throw new Error(`RPC_FAILED_${response.status}`);
  return response.json();
}

export function parseMediaAssetRecords(value: unknown): MediaAssetRecord[] {
  const parsed = z.array(z.object({
    id: z.string().uuid(),
    assetType: z.enum(["image", "video", "logo", "other"]),
    source: z.enum(["upload", "ai_generated", "external"]),
    storagePath: z.string().nullable(),
    category: z.string().optional(),
    mediaStatus: z.string().optional(),
    aiAnalysisStatus: z.string().optional(),
    publishabilityStatus: z.string().optional(),
    consentStatus: z.string().optional(),
    suggestedPlatforms: z.array(z.string()).optional(),
    suggestedFormats: z.array(z.string()).optional(),
    aiNotes: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
    contentItemId: z.string().uuid().nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string().nullable().optional(),
  }).passthrough()).safeParse(value);
  if (!parsed.success) return [];
  return parsed.data.map((row) => ({
    ...row,
    category: normalizeMediaCategory(row.category),
    mediaStatus: (row.mediaStatus ?? "unclassified") as MediaAssetRecord["mediaStatus"],
    aiAnalysisStatus: (row.aiAnalysisStatus ?? "not_started") as MediaAssetRecord["aiAnalysisStatus"],
    publishabilityStatus: (row.publishabilityStatus ?? "blocked") as MediaAssetRecord["publishabilityStatus"],
    consentStatus: (row.consentStatus ?? "unknown") as ConsentStatus,
    suggestedPlatforms: row.suggestedPlatforms ?? [],
    suggestedFormats: row.suggestedFormats ?? [],
    aiNotes: row.aiNotes ?? "",
    metadata: row.metadata ?? {},
    contentItemId: row.contentItemId ?? null,
    updatedAt: row.updatedAt ?? null,
  }));
}

export function MediaProviderStrip({ session }: { session?: ControlSession } = {}) {
  const [geminiStatus, setGeminiStatus] = useState<GeminiIntegrationStatus | null>(null);
  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    fetchGeminiIntegrationStatus(session)
      .then((status) => { if (!controller.signal.aborted) setGeminiStatus(status.integrationStatus); })
      .catch(() => { if (!controller.signal.aborted) setGeminiStatus("NOT CONNECTED"); });
    return () => controller.abort();
  }, [session]);
  const providers = readMediaProviderStatuses();
  return (
    <div className="media-provider-strip" aria-label="Media provider status">
      {providers.map((provider) => (
        <span
          key={provider.key}
          className={(provider.connected || (geminiStatus === "CONNECTED" && provider.key === "gemini")) ? "connected" : provider.optional ? "optional" : provider.manual ? "manual" : "disconnected"}
          title={provider.detail}
        >
          {provider.key}: {displayProviderStatus(provider, geminiStatus ?? undefined)}
        </span>
      ))}
    </div>
  );
}

export function MediaAssetControls({
  asset,
  session,
  canWrite,
  busy,
  labels,
  onChanged,
  onSessionExpired,
}: {
  asset: MediaAssetRecord;
  session: ControlSession;
  canWrite: boolean;
  busy: boolean;
  labels: Record<string, string>;
  onChanged: () => void;
  onSessionExpired: () => void;
}) {
  async function update(fields: { category?: MediaCategory; consent_status?: ConsentStatus; media_status?: MediaAssetRecord["mediaStatus"] }) {
    if (!canWrite || busy) return;
    try {
      await callRpc(session, "update_staff_media_asset", {
        p_media_asset_id: asset.id,
        ...(fields.category ? { p_category: fields.category } : {}),
        ...(fields.consent_status ? { p_consent_status: fields.consent_status } : {}),
        ...(fields.media_status ? { p_media_status: fields.media_status } : {}),
      });
      onChanged();
    } catch (cause) {
      if (cause instanceof Error && cause.message === "SESSION_EXPIRED") onSessionExpired();
    }
  }

  async function runAnalysis() {
    if (!canWrite || busy || asset.category !== "swimming_business") return;
    const result = await analyzeMediaWithProvider(asset, session);
    try {
      await callRpc(session, "save_staff_media_ai_analysis", {
        p_media_asset_id: asset.id,
        p_analysis: result.analysis,
        p_provider: result.provider,
      });
      onChanged();
    } catch (cause) {
      if (cause instanceof Error && cause.message === "SESSION_EXPIRED") onSessionExpired();
    }
  }

  const workflowStatus = displayMediaWorkflowStatus(asset);
  const analysis = (asset.metadata.analysis ?? null) as MediaAnalysisResult | null;

  return (
    <div className="media-asset-controls">
      <p className="media-status-line">
        {labels.workflowStatusLabel}: {labels[`workflow_${workflowStatus}`] ?? workflowStatus}
        {" · "}{labels.publishabilityLabel}: {asset.publishabilityStatus}
        {" · "}{labels.aiStatusLabel}: {asset.aiAnalysisStatus}
      </p>
      <label>{labels.categoryLabel}
        <select
          disabled={!canWrite || busy}
          value={asset.category}
          onChange={(event) => void update({ category: event.target.value as MediaCategory })}
        >
          {(["unclassified", "swimming_business", "family_personal", "other_business", "other"] as MediaCategory[]).map((category) => (
            <option key={category} value={category}>{labels[`category_${category}`] ?? category}</option>
          ))}
        </select>
      </label>
      <label>{labels.consentLabel}
        <select
          disabled={!canWrite || busy}
          value={asset.consentStatus}
          onChange={(event) => void update({ consent_status: event.target.value as ConsentStatus })}
        >
          {(["unknown", "consent_required", "consent_confirmed", "no_consent"] as ConsentStatus[]).map((status) => (
            <option key={status} value={status}>{labels[`consent_${status}`] ?? status}</option>
          ))}
        </select>
      </label>
      <div className="media-control-actions">
        <button type="button" disabled={!canWrite || busy} onClick={() => void update({ media_status: "approved" })}>{labels.approveMedia}</button>
        <button type="button" className="secondary" disabled={!canWrite || busy} onClick={() => void update({ media_status: "rejected" })}>{labels.rejectMedia}</button>
        <button type="button" className="secondary" disabled={!canWrite || busy} onClick={() => void update({ media_status: "unsuitable" })}>{labels.unsuitableMedia}</button>
        <button type="button" disabled={!canWrite || busy || asset.category !== "swimming_business"} onClick={() => void runAnalysis()}>{labels.analyzeMedia}</button>
      </div>
      {analysis && (
        <div className="media-ai-review-panel" aria-label={labels.aiReviewTitle}>
          <strong>{labels.aiReviewTitle}</strong>
          <p>{labels.aiVerdictLabel}: {labels[`aiVerdict_${analysis.suitabilityVerdict}`] ?? analysis.suitabilityVerdict}</p>
          <p>{labels.recommendedPlatformLabel}: {(analysis.suggestedFormats.length ? analysis.suggestedFormats : analysis.suggestedPlatforms).join(" · ")}</p>
          <dl>
            <div><dt>{labels.suggestedHookLabel}</dt><dd>{analysis.hook}</dd></div>
            <div><dt>{labels.onScreenTextLabel}</dt><dd>{analysis.onScreenText}</dd></div>
            <div><dt>{labels.suggestedCaptionLabel}</dt><dd>{analysis.captionIdea}</dd></div>
            <div><dt>{labels.suggestedCtaLabel}</dt><dd>{analysis.cta}</dd></div>
            <div><dt>{labels.suggestedCropLabel}</dt><dd>{analysis.cropSuggestion}</dd></div>
            <div><dt>{labels.suggestedEditLabel}</dt><dd>{analysis.editSuggestion}</dd></div>
            {analysis.bestReelSegment && (
              <div><dt>{labels.reelSegmentLabel}</dt><dd>{analysis.bestReelSegment.startSec}s–{analysis.bestReelSegment.endSec}s · {analysis.bestReelSegment.reason}</dd></div>
            )}
          </dl>
          {analysis.notes && <p className="media-ai-notes">{analysis.notes}</p>}
        </div>
      )}
    </div>
  );
}
