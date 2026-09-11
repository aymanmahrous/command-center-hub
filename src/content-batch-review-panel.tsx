import { useMemo, useState } from "react";
import {
  approveAllCandidates,
  approveAllWouldChange,
  overallBatchStatus,
  summarizeBatch,
  type ContentBatch,
  type ContentBatchItem,
} from "./content-batch";
import type { ChangeRequestKind } from "./content-growth";
import { readContentPillar, readTimeSlot } from "./content-strategy";
import { useLanguage } from "./i18n";
import "./content-batch-review.css";

type ContentBatchReviewPanelProps = {
  items: ContentBatchItem[];
  batch: ContentBatch;
  canWrite: boolean;
  busy: boolean;
  onApproveItem: (item: ContentBatchItem) => Promise<void>;
  onRequestChanges: (item: ContentBatchItem, kind: ChangeRequestKind, note: string) => Promise<void>;
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
  batch,
  canWrite,
  busy,
  onApproveItem,
  onRequestChanges,
  onApproveAll,
}: ContentBatchReviewPanelProps) {
  const { language, t } = useLanguage();
  const copy = t("contentBatch");
  const growthCopy = t("contentGrowth");
  const itemStatusLabels = t("contentStatus");
  const batchStatusLabels = t("contentBatchStatus");
  const [changeTargetId, setChangeTargetId] = useState<string | null>(null);
  const [changeKind, setChangeKind] = useState<ChangeRequestKind>("caption");
  const [changeNote, setChangeNote] = useState("");

  const summary = useMemo(() => summarizeBatch(batch.items), [batch.items]);
  const batchStatus = overallBatchStatus(batch.items);
  const approveCandidates = approveAllCandidates(batch.items);
  const approveAllEnabled = canWrite && !busy && approveAllWouldChange(batch.items);

  async function handleApproveAll() {
    if (!approveAllEnabled || approveCandidates.length === 0) return;
    const confirmMessage = language === "ar"
      ? `تأكيد اعتماد ${approveCandidates.length} عنصر(عناصر) في هذه الدفعة؟ لن يتم جدولة أو نشر أي عنصر من هذه الشاشة.`
      : `Approve ${approveCandidates.length} item(s) in this batch? Nothing will be scheduled or published from this screen.`;
    if (!window.confirm(confirmMessage)) return;
    await onApproveAll(approveCandidates);
  }

  async function submitChangeRequest(item: ContentBatchItem) {
    if (!changeNote.trim()) return;
    await onRequestChanges(item, changeKind, changeNote.trim());
    setChangeTargetId(null);
    setChangeNote("");
    setChangeKind("caption");
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

      <div className="content-batch-summary" aria-label={copy.summaryAria}>
        <article><span>{copy.needsReview}</span><strong>{summary.needsReview}</strong></article>
        <article><span>{copy.approved}</span><strong>{summary.approved}</strong></article>
        <article><span>{copy.scheduled}</span><strong>{summary.scheduled}</strong></article>
        <article><span>{copy.published}</span><strong>{summary.published}</strong></article>
        <article><span>{copy.failed}</span><strong>{summary.failed}</strong></article>
      </div>

      <div className="content-batch-actions">
        <button type="button" disabled={!approveAllEnabled} onClick={() => void handleApproveAll()}>
          {busy ? t("common").saving : copy.approveAllButton}
        </button>
        {!canWrite && <small>{t("common").readOnlyNote}</small>}
      </div>

      <div className="content-batch-grid">
        {items.map((item) => {
          const canApprove = ["draft", "generated", "needs_review"].includes(item.status);
          const canRequestChanges = ["draft", "generated", "approved", "scheduled", "failed"].includes(item.status);
          const itemLocked = busy || !canWrite;
          const pillar = readContentPillar(item);
          const timeSlot = readTimeSlot(item);
          const showingForm = changeTargetId === item.id;
          return (
            <article className="content-batch-item" key={item.id}>
              <header>
                <div>
                  <span className="item-meta">
                    {item.platform} · {item.contentType}
                    {pillar ? ` · ${growthCopy.pillarLabels[pillar] ?? pillar}` : ""}
                    {timeSlot !== "any" ? ` · ${growthCopy.timeSlots[timeSlot]}` : ""}
                  </span>
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
                  <button
                    type="button"
                    className="secondary"
                    disabled={itemLocked}
                    onClick={() => {
                      setChangeTargetId(showingForm ? null : item.id);
                      setChangeNote("");
                      setChangeKind("caption");
                    }}
                  >
                    {copy.requestChangesButton}
                  </button>
                )}
              </footer>
              {showingForm && (
                <form
                  className="change-request-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitChangeRequest(item);
                  }}
                >
                  <label>
                    {growthCopy.changeKindLabel}
                    <select value={changeKind} onChange={(event) => setChangeKind(event.target.value as ChangeRequestKind)}>
                      {(Object.keys(growthCopy.changeKinds) as ChangeRequestKind[]).map((kind) => (
                        <option key={kind} value={kind}>{growthCopy.changeKinds[kind]}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {growthCopy.changeNoteLabel}
                    <textarea
                      value={changeNote}
                      onChange={(event) => setChangeNote(event.target.value)}
                      placeholder={growthCopy.changeNotePlaceholder}
                      maxLength={500}
                      required
                    />
                  </label>
                  <button type="submit" disabled={itemLocked || !changeNote.trim()}>{growthCopy.submitChangeRequest}</button>
                </form>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
