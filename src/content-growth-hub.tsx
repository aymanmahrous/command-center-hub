import { useEffect, useMemo, useState } from "react";
import { groupContentBatches, isDatabaseBatchId, selectPrimaryBatch, buildNextBatchReadyNotice, type ContentBatchItem } from "./content-batch";
import { COACH_AYMAN_PROVIDER_ID } from "./content-batch-generator";
import { attachMediaToCoachAymanBatch, buildCoachAyman2026BatchWithMedia } from "./media-batch-link";
import { generateCoachAymanBatchWithGemini } from "./gemini-batch-adapter";
import { parseMediaAssetRecords, MediaProviderStrip } from "./media-library-controls";
import {
  readIntegrationStatuses,
  summarizePipeline,
  type ChangeRequestKind,
} from "./content-growth";
import { AUTHORIZED_INSTAGRAM_PUBLISH_ITEM_ID, buildFacebookPublishAudit, summarizeLivePublishingReadiness } from "./content-publishing";
import { readPublishingCopy } from "./content-publishing-copy";
import { buildDayNineReminder } from "./content-batch";
import {
  DEFAULT_BATCH_MIX,
  PLATFORM_GUIDANCE,
  buildPerformanceInsights,
} from "./content-strategy";
import { ContentBatchReviewPanel } from "./content-batch-review-panel";
import { useLanguage } from "./i18n";
import "./content-growth-hub.css";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const SUPABASE_PUBLIC_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

type GrowthSession = { accessToken: string };

type ContentGrowthHubProps = {
  items: ContentBatchItem[];
  session: GrowthSession;
  canWrite: boolean;
  busy: boolean;
  onApproveItem: (item: ContentBatchItem) => Promise<void>;
  onRequestChanges: (item: ContentBatchItem, kind: ChangeRequestKind, note: string) => Promise<void>;
  onApproveAll: (items: ContentBatchItem[]) => Promise<void>;
  onBatchCreated?: () => void;
  onSessionExpired?: () => void;
};

async function callRpc(session: GrowthSession, rpcName: string, body: Record<string, unknown> = {}, signal?: AbortSignal) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${encodeURIComponent(rpcName)}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLIC_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });
  if (response.status === 401 || response.status === 403) throw new Error("SESSION_EXPIRED");
  if (!response.ok) throw new Error(`RPC_FAILED_${response.status}`);
  return response.json();
}

export default function ContentGrowthHub({
  items,
  session,
  canWrite,
  busy,
  onApproveItem,
  onRequestChanges,
  onApproveAll,
  onBatchCreated,
  onSessionExpired,
}: ContentGrowthHubProps) {
  const { language, t } = useLanguage();
  const copy = t("contentGrowth");
  const publishCopyFacebook = readPublishingCopy(language, "facebook");
  const publishCopyInstagram = readPublishingCopy(language, "instagram");
  const batches = useMemo(() => groupContentBatches(items), [items]);
  const primaryBatch = useMemo(() => selectPrimaryBatch(batches), [batches]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const selectedBatch = useMemo(() => {
    if (selectedBatchId) return batches.find((batch) => batch.batchId === selectedBatchId) ?? primaryBatch;
    return primaryBatch;
  }, [batches, primaryBatch, selectedBatchId]);
  const pipeline = useMemo(() => summarizePipeline(items), [items]);
  const dayNine = useMemo(() => buildDayNineReminder(items), [items]);
  const batchReady = useMemo(() => buildNextBatchReadyNotice(items), [items]);
  const insights = useMemo(() => buildPerformanceInsights(items), [items]);
  const instagramPublishing = useMemo(() => summarizeLivePublishingReadiness(items, "instagram"), [items]);
  const facebookAudit = useMemo(() => buildFacebookPublishAudit(items), [items]);
  const [automationStatus, setAutomationStatus] = useState<unknown>(null);
  const [generateNotice, setGenerateNotice] = useState("");
  const [generating, setGenerating] = useState(false);
  const [mediaAssets, setMediaAssets] = useState<ReturnType<typeof parseMediaAssetRecords>>([]);
  const integrations = useMemo(() => readIntegrationStatuses(automationStatus), [automationStatus]);

  useEffect(() => {
    const controller = new AbortController();
    callRpc(session, "get_staff_content_automation_status", {}, controller.signal)
      .then(setAutomationStatus)
      .catch(() => setAutomationStatus(null));
    callRpc(session, "get_staff_media_assets", {}, controller.signal)
      .then((raw) => { if (!controller.signal.aborted) setMediaAssets(parseMediaAssetRecords(raw)); })
      .catch(() => { if (!controller.signal.aborted) setMediaAssets([]); });
    return () => controller.abort();
  }, [session]);

  useEffect(() => {
    if (!selectedBatchId && primaryBatch) setSelectedBatchId(primaryBatch.batchId);
  }, [primaryBatch, selectedBatchId]);

  const batchItems = selectedBatch?.items ?? [];
  const panelBusy = busy || generating;
  const instagramNextStepCopy = {
    review: publishCopyInstagram.livePublishNextReview,
    approve: publishCopyInstagram.livePublishNextApprove,
    publish_via_n8n: publishCopyInstagram.livePublishNextN8n,
    verify_receipt: publishCopyInstagram.livePublishNextVerify,
    continue_batch: publishCopyInstagram.livePublishNextContinue,
  }[instagramPublishing.nextAction];

  async function generateCoachAymanBatch() {
    if (!canWrite || panelBusy) return;
    if (!window.confirm(copy.generateConfirm)) return;
    setGenerating(true);
    setGenerateNotice("");
    try {
      const nonce = crypto.randomUUID();
      const start = new Date();
      const mediaRaw = await callRpc(session, "get_staff_media_assets", {});
      const assets = parseMediaAssetRecords(mediaRaw);
      let items;
      try {
        const geminiItems = await generateCoachAymanBatchWithGemini(session, nonce, start);
        items = geminiItems ? attachMediaToCoachAymanBatch(geminiItems, assets) : await buildCoachAyman2026BatchWithMedia(assets, start, nonce);
      } catch {
        items = await buildCoachAyman2026BatchWithMedia(assets, start, nonce);
      }
      const result = await callRpc(session, "create_staff_generated_content_batch", {
        p_items: items,
        p_provider_external_id: COACH_AYMAN_PROVIDER_ID,
      }) as { success?: boolean; batchId?: string; code?: string };
      if (!result.success || !result.batchId) throw new Error(result.code ?? "GENERATE_FAILED");
      setGenerateNotice(copy.generateSuccess.replace("{batchId}", result.batchId));
      setSelectedBatchId(result.batchId);
      setMediaAssets(assets);
      onBatchCreated?.();
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "GENERATE_FAILED";
      if (code === "SESSION_EXPIRED") {
        onSessionExpired?.();
        return;
      }
      setGenerateNotice(copy.generateError);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="content-growth-hub">
      {batchReady?.show && (
        <div className="content-growth-banner batch-ready-banner" role="status">
          <strong>{copy.batchReadyTitle}</strong>
          <p>{copy.batchReadyBody
            .replace("{count}", String(batchReady.reviewableCount))
            .replace("{real}", String(batchReady.realMediaCount))
            .replace("{pending}", String(batchReady.pendingMediaCount))}</p>
        </div>
      )}

      {dayNine?.show && (
        <div className="content-growth-banner" role="status">
          <strong>{copy.dayNineTitle}</strong>
          <p>{copy.dayNineBody.replace("{count}", String(dayNine.reviewableCount)).replace("{day}", String(dayNine.cycleDay))}</p>
        </div>
      )}

      {generateNotice && <div className="notice-box" aria-live="polite">{generateNotice}</div>}

      {facebookAudit && (
        <section className="content-growth-section facebook-audit-section" aria-labelledby="facebook-audit-heading">
          <header>
            <p>{copy.pipelineEyebrow}</p>
            <h3 id="facebook-audit-heading">{publishCopyFacebook.facebookAuditTitle}</h3>
          </header>
          <p className="batch-meta">{publishCopyFacebook.facebookAuditBody}</p>
          <div className="facebook-audit-grid" role="group" aria-label={publishCopyFacebook.facebookAuditTitle}>
            <article><span>{publishCopyFacebook.facebookAuditPostId}</span><strong dir="ltr">{facebookAudit.externalPostId ?? copy.notConnected}</strong></article>
            <article><span>{publishCopyFacebook.facebookAuditReceipt}</span><strong>{facebookAudit.receiptStatus ?? copy.notConnected}</strong></article>
            <article><span>{publishCopyFacebook.publishedAtLabel}</span><strong>{facebookAudit.publishedAt ?? copy.notConnected}</strong></article>
          </div>
          <p className="batch-meta">{facebookAudit.topic}</p>
          {facebookAudit.needsManualPublicCheck && (
            <p className="facebook-audit-warning" role="status">{publishCopyFacebook.facebookAuditManualCheck}</p>
          )}
          {facebookAudit.postUrl && (
            <a className="today-quick-action" href={facebookAudit.postUrl} target="_blank" rel="noreferrer noopener">
              {publishCopyFacebook.openLivePost}
            </a>
          )}
        </section>
      )}

      <section className="content-growth-section live-publish-section" aria-labelledby="live-publish-heading">
        <header>
          <p>{copy.pipelineEyebrow}</p>
          <h3 id="live-publish-heading">{publishCopyInstagram.livePublishTitle}</h3>
        </header>
        <p className="batch-meta">{publishCopyInstagram.livePublishBody}</p>
        {!AUTHORIZED_INSTAGRAM_PUBLISH_ITEM_ID && (
          <p className="batch-meta">{publishCopyInstagram.instagramPickAuthorized}</p>
        )}
        <div className="live-publish-grid" aria-label={publishCopyInstagram.livePublishTitle}>
          <article><span>{copy.approved}</span><strong>{instagramPublishing.approvedCount}</strong></article>
          <article><span>{publishCopyInstagram.livePublishAwaiting}</span><strong>{instagramPublishing.awaitingN8nCount}</strong></article>
          <article><span>{copy.published}</span><strong>{instagramPublishing.publishedLiveCount}</strong></article>
          <article><span>{copy.failed}</span><strong>{instagramPublishing.failedCount}</strong></article>
        </div>
        <p className="live-publish-next-step" role="status">{instagramNextStepCopy}</p>
        {instagramPublishing.authorizedItem && (
          <div className="authorized-post-banner" role="status">
            <strong>{publishCopyInstagram.authorizedPostTitle}</strong>
            <span>{instagramPublishing.authorizedStage === "published_live" ? publishCopyInstagram.authorizedPostLive : publishCopyInstagram.authorizedPostPending}</span>
            <span>{instagramPublishing.authorizedItem.topic}</span>
          </div>
        )}
      </section>

      <section className="content-growth-section" aria-labelledby="generate-batch-heading">
        <header>
          <p>{copy.generateEyebrow}</p>
          <h3 id="generate-batch-heading">{copy.generateTitle}</h3>
        </header>
        <p className="batch-meta">{copy.generateBody}</p>
        <p className="batch-meta">
          {copy.activeBatchLabel}: {selectedBatch && isDatabaseBatchId(selectedBatch.batchId) ? selectedBatch.batchId : copy.notConnected}
        </p>
        <button type="button" className="primary-button" disabled={!canWrite || panelBusy} onClick={() => void generateCoachAymanBatch()}>
          {generating ? copy.generateBusy : copy.generateButton}
        </button>
        <p className="batch-meta">{copy.generateMixNote}</p>
      </section>

      <section className="content-growth-section" aria-labelledby="content-pipeline-heading">
        <header>
          <p>{copy.pipelineEyebrow}</p>
          <h3 id="content-pipeline-heading">{copy.pipelineTitle}</h3>
        </header>
        <div className="content-pipeline-grid" aria-label={copy.pipelineTitle}>
          <article><span>{copy.needsReview}</span><strong>{pipeline.needsReview}</strong></article>
          <article><span>{copy.approved}</span><strong>{pipeline.approved}</strong></article>
          <article><span>{copy.scheduled}</span><strong>{pipeline.scheduled}</strong></article>
          <article><span>{copy.published}</span><strong>{pipeline.published}</strong></article>
          <article><span>{copy.failed}</span><strong>{pipeline.failed}</strong></article>
          <article><span>{copy.totalItems}</span><strong>{pipeline.total}</strong></article>
        </div>
      </section>

      <section className="content-growth-section" aria-labelledby="integration-status-heading">
        <header>
          <p>{copy.integrationsEyebrow}</p>
          <h3 id="integration-status-heading">{copy.integrationsTitle}</h3>
        </header>
        <div className="integration-grid">
          {integrations.map((integration) => (
            <article key={integration.key} className={integration.connected ? "connected" : integration.key === "canva" ? "optional" : "disconnected"}>
              <strong>{copy.integrationLabels[integration.key]}</strong>
              <small>{integration.key === "canva" ? copy.optionalNotConnected : integration.connected ? copy.connected : copy.notConnected}</small>
              <small>{integration.detail}</small>
            </article>
          ))}
        </div>
        <p className="batch-meta">{copy.integrationsNote}</p>
        <MediaProviderStrip session={session} canWrite={canWrite} />
      </section>

      <section className="content-growth-section" aria-labelledby="strategy-mix-heading">
        <header>
          <p>{copy.strategyEyebrow}</p>
          <h3 id="strategy-mix-heading">{copy.strategyTitle}</h3>
        </header>
        <ul className="strategy-mix-list">
          {DEFAULT_BATCH_MIX.map((slot, index) => (
            <li key={`${slot.labelKey}-${index}`}>
              <strong>{copy.mixLabels[slot.labelKey as keyof typeof copy.mixLabels] ?? slot.labelKey}</strong>
              <span>{slot.platform.toUpperCase()} · {slot.contentType} · {copy.timeSlots[slot.timeSlot]}</span>
              <span>{PLATFORM_GUIDANCE[slot.platform].focus}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="content-growth-section" aria-labelledby="insights-heading">
        <header>
          <p>{copy.insightsEyebrow}</p>
          <h3 id="insights-heading">{copy.insightsTitle}</h3>
        </header>
        <ul className="insight-list">
          {insights.map((insight) => (
            <li key={insight.id}>
              <strong>{insight.label}</strong>
              <span>{copy.directionLabels[insight.direction]} · {insight.reason}</span>
            </li>
          ))}
        </ul>
      </section>

      {batches.length > 1 && (
        <div className="batch-switcher" aria-label={copy.batchSwitcherAria}>
          {batches.map((batch) => (
            <button
              type="button"
              key={batch.batchId}
              className={selectedBatch?.batchId === batch.batchId ? "active" : ""}
              onClick={() => setSelectedBatchId(batch.batchId)}
            >
              {batch.isExplicitBatch ? batch.batchId : copy.reviewWindow} ({batch.items.length})
            </button>
          ))}
        </div>
      )}

      {selectedBatch && (
        <ContentBatchReviewPanel
          items={batchItems}
          batch={selectedBatch}
          canWrite={canWrite}
          busy={panelBusy}
          session={session}
          mediaAssets={mediaAssets}
          onApproveItem={onApproveItem}
          onRequestChanges={onRequestChanges}
          onApproveAll={onApproveAll}
        />
      )}
    </div>
  );
}
