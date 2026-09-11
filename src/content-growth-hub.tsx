import { useEffect, useMemo, useState } from "react";
import { groupContentBatches, selectPrimaryBatch, type ContentBatchItem } from "./content-batch";
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
};

async function callRpc(session: GrowthSession, rpcName: string, signal?: AbortSignal) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${encodeURIComponent(rpcName)}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLIC_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: "{}",
    signal,
  });
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
  const integrations = useMemo(() => readIntegrationStatuses(automationStatus), [automationStatus]);

  useEffect(() => {
    const controller = new AbortController();
    callRpc(session, "get_staff_content_automation_status", controller.signal)
      .then(setAutomationStatus)
      .catch(() => setAutomationStatus(null));
    return () => controller.abort();
  }, [session]);

  useEffect(() => {
    if (!selectedBatchId && primaryBatch) setSelectedBatchId(primaryBatch.batchId);
  }, [primaryBatch, selectedBatchId]);

  const batchItems = selectedBatch?.items ?? [];

  return (
    <div className="content-growth-hub">
      {dayNine?.show && (
        <div className="content-growth-banner" role="status">
          <strong>{copy.dayNineTitle}</strong>
          <p>{copy.dayNineBody.replace("{count}", String(dayNine.reviewableCount)).replace("{day}", String(dayNine.cycleDay))}</p>
        </div>
      )}

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
          busy={busy}
          onApproveItem={onApproveItem}
          onRequestChanges={onRequestChanges}
          onApproveAll={onApproveAll}
        />
      )}
    </div>
  );
}
