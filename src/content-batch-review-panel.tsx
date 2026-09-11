import { useMemo } from "react";
import {
  approveAllCandidates,
  approveAllWouldChange,
  groupContentBatches,
  overallBatchStatus,
  selectPrimaryBatch,
  summarizeBatch,
  type ContentBatchItem,
} from "./content-batch";
import { useLanguage } from "./i18n";
import "./content-batch-review.css";

type ContentBatchReviewPanelProps = {
  items: ContentBatchItem[];
  canWrite: boolean;
  busy: boolean;
  onApproveItem: (item: ContentBatchItem) => Promise<void>;
  onRequestChanges: (item: ContentBatchItem) => Promise<void>;
  onApproveAll: (items: ContentBatchItem[]) => Promise<void>;
};

function formatWhen(language: "ar" | "en", value: string | null) {
  if (!value) return language === "ar" ? "غير محدد" : "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "ar" ? "ar-AE" : "en-AE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function ContentBatchReviewPanel({
  items,
  canWrite,
  busy,
  onApproveItem,
  onRequestChanges,
  onApproveAll,
}: ContentBatchReviewPanelProps) {
  const { language, t } = useLanguage();
  const copy = t("contentBatch");
  const itemStatusLabels = t("contentStatus");
  const batchStatusLabels = t("contentBatchStatus");

  const batch = useMemo(() => selectPrimaryBatch(groupContentBatches(items)), [items]);
  const summary = useMemo(() => (batch ? summarizeBatch(batch.items) : null), [batch]);
  const batchStatus = batch ? overallBatchStatus(batch.items) : "mixed";
  const approveCandidates = batch ? approveAllCandidates(batch.items) : [];
  const approveAllEnabled = canWrite && !busy && approveAllWouldChange(batch?.items ?? []);

  if (!batch || batch.items.length === 0) return null;

  async function handleApproveAll() {
    if (!approveAllEnabled || approveCandidates.length === 0) return;
    const confirmMessage = language === "ar"
      ? `تأكيد اعتماد ${approveCandidates.length} عنصر(عناصر) في هذه الدفعة؟ لن يتم جدولة أو نشر أي عنصر من هذه الشاشة.`
      : `Approve ${approveCandidates.length} item(s) in this batch? Nothing will be scheduled or published from this screen.`;
    if (!window.confirm(confirmMessage)) return;
    await onApproveAll(approveCandidates);
  }

  return (
    <section className="content-batch-panel" aria-labelledby="content-batch-heading">
      <header>
        <div>
          <p className="batch-meta">{copy.eyebrow}</p>
          <h2 id="content-batch-heading">{copy.title}</h2>
          <p className="batch-meta">
            {batch.isExplicitBatch ? copy.explicitBatch : copy.heuristicBatch}
            {" · "}
            {copy.itemCount.replace("{count}", String(batch.items.length))}
            {batch.reviewDeadline ? ` · ${copy.reviewDeadline}: ${formatWhen(language, batch.reviewDeadline)}` : ""}
          </p>
        </div>
        <span className={`content-status batch-status-${batchStatus}`}>{batchStatusLabels[batchStatus] ?? batchStatus}</span>
      </header>

      {summary && (
        <div className="content-batch-summary" aria-label={copy.summaryAria}>
          <article><span>{copy.needsReview}</span><strong>{summary.needsReview}</strong></article>
          <article><span>{copy.approved}</span><strong>{summary.approved}</strong></article>
          <article><span>{copy.scheduled}</span><strong>{summary.scheduled}</strong></article>
          <article><span>{copy.published}</span><strong>{summary.published}</strong></article>
          <article><span>{copy.failed}</span><strong>{summary.failed}</strong></article>
        </div>
      )}

      <div className="content-batch-actions">
        <button type="button" disabled={!approveAllEnabled} onClick={() => void handleApproveAll()}>
          {busy ? t("common").saving : copy.approveAllButton}
        </button>
        {!canWrite && <small>{t("common").readOnlyNote}</small>}
      </div>

      <div className="content-batch-grid">
        {batch.items.map((item) => {
          const canApprove = ["draft", "generated", "needs_review"].includes(item.status);
          const canRequestChanges = ["draft", "generated", "approved", "scheduled", "failed"].includes(item.status);
          const itemLocked = busy || !canWrite;
          return (
            <article className="content-batch-item" key={item.id}>
              <header>
                <div>
                  <span className="item-meta">{item.platform} · {item.contentType}</span>
                  <h3>{item.topic || copy.untitled}</h3>
                </div>
                <span className={`content-status status-${item.status}`}>{itemStatusLabels[item.status as keyof typeof itemStatusLabels] ?? item.status}</span>
              </header>
              <p className="item-caption">{item.caption.trim() || copy.noCaption}</p>
              <p className="item-meta">{copy.scheduledFor}: {formatWhen(language, item.scheduledFor)}</p>
              <footer>
                {canApprove && (
                  <button type="button" disabled={itemLocked} onClick={() => void onApproveItem(item)}>
                    {copy.approveButton}
                  </button>
                )}
                {canRequestChanges && (
                  <button type="button" className="secondary" disabled={itemLocked} onClick={() => void onRequestChanges(item)}>
                    {copy.requestChangesButton}
                  </button>
                )}
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
