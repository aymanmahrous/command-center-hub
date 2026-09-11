import { useEffect, useMemo, useState } from "react";
import { groupContentBatches, isDatabaseBatchId, selectPrimaryBatch, type ContentBatchItem } from "./content-batch";
import {
  buildCoachAyman2026BatchItems,
  COACH_AYMAN_PROVIDER_ID,
} from "./content-batch-generator";
import {
  readIntegrationStatuses,
  summarizePipeline,
  type ChangeRequestKind,
} from "./content-growth";
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
  const batches = useMemo(() => groupContentBatches(items), [items]);
  const primaryBatch = useMemo(() => selectPrimaryBatch(batches), [batches]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const selectedBatch = useMemo(() => {
    if (selectedBatchId) return batches.find((batch) => batch.batchId === selectedBatchId) ?? primaryBatch;
    return primaryBatch;
  }, [batches, primaryBatch, selectedBatchId]);
  const pipeline = useMemo(() => summarizePipeline(items), [items]);
  const dayNine = useMemo(() => buildDayNineReminder(items), [items]);
  const insights = useMemo(() => buildPerformanceInsights(items), [items]);
  const [automationStatus, setAutomationStatus] = useState<unknown>(null);
  const [generateNotice, setGenerateNotice] = useState("");
  const [generating, setGenerating] = useState(false);
  const integrations = useMemo(() => readIntegrationStatuses(automationStatus), [automationStatus]);

  useEffect(() => {
    const controller = new AbortController();
    callRpc(session, "get_staff_content_automation_status", {}, controller.signal)
      .then(setAutomationStatus)
      .catch(() => setAutomationStatus(null));
    return () => controller.abort();
  }, [session]);

  useEffect(() => {
    if (!selectedBatchId && primaryBatch) setSelectedBatchId(primaryBatch.batchId);
  }, [primaryBatch, selectedBatchId]);

  const batchItems = selectedBatch?.items ?? [];
  const panelBusy = busy || generating;

  async function generateCoachAymanBatch() {
    if (!canWrite || panelBusy) return;
    if (!window.confirm(copy.generateConfirm)) return;
    setGenerating(true);
    setGenerateNotice("");
    try {
      const nonce = crypto.randomUUID();
      const items = await buildCoachAyman2026BatchItems(new Date(), nonce);
      const result = await callRpc(session, "create_staff_generated_content_batch", {
        p_items: items,
        p_provider_external_id: COACH_AYMAN_PROVIDER_ID,
      }) as { success?: boolean; batchId?: string; code?: string };
      if (!result.success || !result.batchId) throw new Error(result.code ?? "GENERATE_FAILED");
      setGenerateNotice(copy.generateSuccess.replace("{batchId}", result.batchId));
      setSelectedBatchId(result.batchId);
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
      {dayNine?.show && (
        <div className="content-growth-banner" role="status">
          <strong>{copy.dayNineTitle}</strong>
          <p>{copy.dayNineBody.replace("{count}", String(dayNine.reviewableCount)).replace("{day}", String(dayNine.cycleDay))}</p>
        </div>
      )}

      {generateNotice && <div className="notice-box" aria-live="polite">{generateNotice}</div>}

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
            <article key={integration.key} className={integration.connected ? "connected" : "disconnected"}>
              <strong>{copy.integrationLabels[integration.key]}</strong>
              <small>{integration.connected ? copy.connected : copy.notConnected}</small>
              <small>{integration.detail}</small>
            </article>
          ))}
        </div>
        <p className="batch-meta">{copy.integrationsNote}</p>
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
          onApproveItem={onApproveItem}
          onRequestChanges={onRequestChanges}
          onApproveAll={onApproveAll}
        />
      )}
    </div>
  );
}
