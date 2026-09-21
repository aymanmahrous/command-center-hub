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
import {
  buildExternalPostLink,
  latestReceiptForPlatform,
  parsePublicationReceipts,
  resolvePublishPipelineStage,
} from "./content-publishing";
import { readContentPillar, readTimeSlot } from "./content-strategy";
import { readPublishingCopy } from "./content-publishing-copy";
import { ContentBatchMediaPreview } from "./content-batch-media-preview";
import { canvaDesignErrorMessage, generateCanvaDesignForContentItem } from "./canva-design-adapter";
import type { MediaAssetRecord } from "./media-types";
import { useLanguage } from "./i18n";
import "./content-batch-review.css";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const SUPABASE_PUBLIC_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

type PublishEnqueueResult = {
  success?: boolean;
  code?: string;
};

async function requestPublishJob(session: { accessToken: string }, contentItemId: string): Promise<PublishEnqueueResult> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/enqueue_publish_job`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLIC_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ p_content_item_id: contentItemId }),
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) throw new Error("SESSION_EXPIRED");
  const result = (await response.json().catch(() => ({}))) as PublishEnqueueResult;
  if (!response.ok && !result.code) throw new Error(`RPC_FAILED_${response.status}`);
  return result;
}

function publishEnqueueErrorMessage(code: string | undefined, language: "ar" | "en"): string {
  const messages: Record<string, { ar: string; en: string }> = {
    STAFF_ACCESS_DENIED: { ar: "لا تملك صلاحية طلب النشر.", en: "You do not have permission to request publish." },
    CONTENT_NOT_APPROVED: { ar: "يجب اعتماد المحتوى قبل طلب النشر.", en: "Content must be approved before requesting publish." },
    CONTENT_ALREADY_PUBLISHED: { ar: "هذا المحتوى منشور بالفعل.", en: "This content is already published." },
    PUBLISH_RECEIPT_EXISTS: { ar: "يوجد إيصال نشر منشور لهذا العنصر.", en: "A published receipt already exists for this item." },
    MEDIA_ASSET_REQUIRED: { ar: "يلزم ربط وسائط جاهزة قبل طلب النشر.", en: "Publish-ready media must be linked before requesting publish." },
    MEDIA_ASSET_NOT_PUBLISHABLE: { ar: "الوسائط المرتبطة غير جاهزة للنشر.", en: "Linked media is not publish-ready." },
    CONTENT_NOT_READY: { ar: "المحتوى غير جاهز للنشر.", en: "Content is not ready to publish." },
    PLATFORM_NOT_SUPPORTED: { ar: "المنصة غير مدعومة لطلب النشر.", en: "This platform is not supported for publish requests." },
    ACTIVE_AUTHORIZATION_EXISTS: { ar: "يوجد تفويض نشر نشط لهذا العنصر.", en: "An active publish authorization already exists for this item." },
  };
  const entry = code ? messages[code] : undefined;
  if (entry) return entry[language];
  return language === "ar" ? "تعذر طلب النشر." : "Publish request failed.";
}

function canRequestPublish(item: ContentBatchItem): boolean {
  if (item.status !== "approved") return false;
  if (item.publishedAt) return false;
  if (typeof item.providerExternalId === "string" && item.providerExternalId.trim()) return false;
  const receipt = latestReceiptForPlatform(item, item.platform);
  if (receipt?.status === "published") return false;
  return true;
}

const REQUEST_PUBLISH_COPY = {
  en: {
    button: "Request Publish",
    confirm: "Schedule this approved item for its planned publish time? Authorization is created automatically at due time by the existing publish workflow.",
    success: "Publish scheduled for the planned time. Authorization will be created automatically at due time.",
    already: "Publish is already scheduled for this item.",
    busy: "Requesting publish…",
  },
  ar: {
    button: "طلب النشر",
    confirm: "جدولة هذا العنصر المعتمد لوقت النشر المخطط؟ يُنشأ التفويض تلقائيًا عند موعد النشر عبر مسار النشر الحالي.",
    success: "تمت جدولة النشر لوقتها المخطط. سيُنشأ التفويض تلقائيًا عند موعد النشر.",
    already: "النشر مجدول بالفعل لهذا العنصر.",
    busy: "جاري طلب النشر…",
  },
} as const;

type ContentBatchReviewPanelProps = {
  items: ContentBatchItem[];
  batch: ContentBatch;
  canWrite: boolean;
  busy: boolean;
  session?: { accessToken: string };
  mediaAssets?: MediaAssetRecord[];
  onMediaLinked?: () => void;
  onApproveItem: (item: ContentBatchItem) => Promise<void>;
  onRequestChanges: (item: ContentBatchItem, kind: ChangeRequestKind, note: string) => Promise<void>;
  onApproveAll: (items: ContentBatchItem[]) => Promise<void>;
  onPublishRequested?: () => void;
  onSessionExpired?: () => void;
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
  session,
  mediaAssets = [],
  onMediaLinked,
  onApproveItem,
  onRequestChanges,
  onApproveAll,
  onPublishRequested,
  onSessionExpired,
}: ContentBatchReviewPanelProps) {
  const { language, t } = useLanguage();
  const copy = t("contentBatch");
  const growthCopy = t("contentGrowth");
  const publishingCopy = readPublishingCopy(language);
  const itemStatusLabels = t("contentStatus");
  const batchStatusLabels = t("contentBatchStatus");
  const pipelineStageLabels = publishingCopy.pipelineStages;
  const [changeTargetId, setChangeTargetId] = useState<string | null>(null);
  const [changeKind, setChangeKind] = useState<ChangeRequestKind>("caption");
  const [changeNote, setChangeNote] = useState("");
  const [designBusyId, setDesignBusyId] = useState<string | null>(null);
  const [designNotice, setDesignNotice] = useState("");
  const [publishBusyId, setPublishBusyId] = useState<string | null>(null);
  const [publishNotice, setPublishNotice] = useState("");
  const [itemFilter, setItemFilter] = useState<"all" | "needs_review" | "approved" | "scheduled" | "failed">("all");
  const requestPublishCopy = REQUEST_PUBLISH_COPY[language];

  const summary = useMemo(() => summarizeBatch(batch.items), [batch.items]);
  const batchStatus = overallBatchStatus(batch.items);
  const approveCandidates = approveAllCandidates(batch.items);
  const approveAllEnabled = canWrite && !busy && approveAllWouldChange(batch.items);
  const visibleItems = itemFilter === "all" ? items : items.filter((item) => item.status === itemFilter);
  const assetById = useMemo(() => new Map(mediaAssets.map((asset) => [asset.id, asset])), [mediaAssets]);
  const previewLabels = {
    designPreview: copy.designPreview,
    designPending: copy.designPending,
    canvaBriefLabel: copy.canvaBriefLabel,
    noPreview: copy.noPreview,
  };

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

  async function handleGenerateDesign(item: ContentBatchItem) {
    if (!session || !canWrite || busy || designBusyId) return;
    setDesignBusyId(item.id);
    setDesignNotice("");
    try {
      await generateCanvaDesignForContentItem(session, item);
      setDesignNotice(copy.designGeneratedNotice);
      onMediaLinked?.();
    } catch (cause) {
      if (cause instanceof Error && cause.message === "SESSION_EXPIRED") throw cause;
      setDesignNotice(canvaDesignErrorMessage(cause instanceof Error ? cause.message : undefined));
    } finally {
      setDesignBusyId(null);
    }
  }

  async function handleRequestPublish(item: ContentBatchItem) {
    if (!session || !canWrite || busy || publishBusyId || !canRequestPublish(item)) return;
    if (!window.confirm(requestPublishCopy.confirm)) return;
    setPublishBusyId(item.id);
    setPublishNotice("");
    try {
      const result = await requestPublishJob(session, item.id);
      if (!result.success) {
        setPublishNotice(publishEnqueueErrorMessage(result.code, language));
        return;
      }
      setPublishNotice(
        result.code === "ALREADY_ENQUEUED" || result.code === "ALREADY_PREPARED"
          ? requestPublishCopy.already
          : requestPublishCopy.success,
      );
      onPublishRequested?.();
    } catch (cause) {
      if (cause instanceof Error && cause.message === "SESSION_EXPIRED") {
        onSessionExpired?.();
        return;
      }
      setPublishNotice(publishEnqueueErrorMessage(undefined, language));
    } finally {
      setPublishBusyId(null);
    }
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
        <button type="button" disabled={!approveAllEnabled} title={!canWrite ? copy.actionDisabledReadOnly : busy ? copy.actionDisabledBusy : approveCandidates.length === 0 ? copy.batchNothingToApprove : undefined} onClick={() => void handleApproveAll()}>
          {busy ? t("common").saving : copy.approveAllButton}
        </button>
        {!canWrite ? <small>{copy.actionDisabledReadOnly}</small> : approveCandidates.length === 0 ? <small>{copy.batchNothingToApprove}</small> : null}
      </div>
      {designNotice && <p className="content-batch-design-notice" role="status">{designNotice}</p>}
      {publishNotice && <p className="content-batch-design-notice" role="status">{publishNotice}</p>}

      <div className="content-review-toolbar"><div><strong>{language === "ar" ? "مراجعة الدفعة" : "Batch review"}</strong><span>{language === "ar" ? "اعرض الحالة التي تريد التعامل معها فقط." : "Show only the status you want to work on."}</span></div><div className="content-review-filters" role="group" aria-label={language === "ar" ? "تصفية حالات المحتوى" : "Content status filters"}>{(["all", "needs_review", "approved", "scheduled", "failed"] as const).map((filter) => { const count = filter === "all" ? items.length : items.filter((item) => item.status === filter).length; const label = filter === "all" ? (language === "ar" ? "الكل" : "All") : filter === "needs_review" ? (language === "ar" ? "للمراجعة" : "Needs review") : filter === "approved" ? (language === "ar" ? "معتمد" : "Approved") : filter === "scheduled" ? (language === "ar" ? "مجدول" : "Scheduled") : (language === "ar" ? "فشل" : "Failed"); return <button type="button" key={filter} className={itemFilter === filter ? "active" : ""} onClick={() => setItemFilter(filter)}>{label} <b>{count}</b></button>; })}</div></div>
      {visibleItems.length === 0 ? <p className="content-review-empty">{language === "ar" ? "لا توجد عناصر في هذه الحالة." : "No items match this status."}</p> : <div className="content-batch-grid">
        {visibleItems.map((item) => {
          const canApprove = ["draft", "generated", "needs_review"].includes(item.status);
          const canRequestChanges = ["draft", "generated", "approved", "scheduled", "failed"].includes(item.status);
          const itemLocked = busy || !canWrite;
          const pillar = readContentPillar(item);
          const timeSlot = readTimeSlot(item);
          const showingForm = changeTargetId === item.id;
          const pipelineStage = resolvePublishPipelineStage(item);
          const receipts = parsePublicationReceipts(item);
          const platformReceipt = latestReceiptForPlatform(item, item.platform);
          const postLink = buildExternalPostLink(item.platform, platformReceipt?.externalPostId);
          const itemDisabledReason = !canWrite ? copy.actionDisabledReadOnly : busy ? copy.actionDisabledBusy : undefined;
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
              <details className="content-item-details">
                <summary>{language === "ar" ? "المزيد والتفاصيل" : "More details"}</summary>
                <p className="item-caption">{item.caption.trim() || copy.noCaption}</p>
                <ContentBatchMediaPreview item={item} session={session} assetById={assetById} labels={previewLabels} />
              {(Boolean(item.mediaSource) || Boolean(item.mediaAssetId) || item.mediaPlan != null) && (
                <p className="item-meta">
                  {copy.mediaSourceLabel}: {String(item.mediaSource ?? "—").toUpperCase()}
                  {item.mediaAssetId ? ` · ${copy.mediaLinked}` : ""}
                  {item.mediaSource === "pending" ? ` · ${copy.mediaFallbackPending}` : ""}
                </p>
              )}
              <p className="item-meta">{copy.scheduledFor}: {formatWhen(language, item.scheduledFor)}</p>
              <div className="publish-pipeline-panel" aria-label={publishingCopy.pipelineAria}>
                <p className="item-meta">
                  {publishingCopy.pipelineLabel}: {pipelineStageLabels[pipelineStage] ?? pipelineStage}
                </p>
                {typeof item.publishedAt === "string" && item.publishedAt && (
                  <p className="item-meta">{publishingCopy.publishedAtLabel}: {formatWhen(language, item.publishedAt)}</p>
                )}
                {receipts.length === 0 && pipelineStage === "approved_ready" && (
                  <p className="publish-ready-note">{publishingCopy.awaitingN8nNote}</p>
                )}
                {receipts.map((receipt, index) => (
                  <div className="publish-receipt" key={`${receipt.platform}-${receipt.updatedAt ?? index}`}>
                    <strong>{receipt.platform.toUpperCase()} · {receipt.status}</strong>
                    {receipt.plainLanguageReason && <span>{receipt.plainLanguageReason}</span>}
                    {buildExternalPostLink(receipt.platform, receipt.externalPostId) && (
                      <a href={buildExternalPostLink(receipt.platform, receipt.externalPostId) ?? "#"} target="_blank" rel="noopener noreferrer">
                        {publishingCopy.openPostLink}
                      </a>
                    )}
                  </div>
                ))}
                {postLink && pipelineStage === "published_live" && (
                  <a className="publish-live-link" href={postLink} target="_blank" rel="noopener noreferrer">{publishingCopy.openLivePost}</a>
                )}
                </div>
              </details>
              <footer>
                {!item.mediaAssetId && session && (
                  <button
                    type="button"
                    className="secondary"
                    disabled={itemLocked || designBusyId === item.id}
                    title={itemDisabledReason}
                    onClick={() => void handleGenerateDesign(item)}
                  >
                    {designBusyId === item.id ? copy.generateDesignBusy : copy.generateDesignButton}
                  </button>
                )}
                {canApprove && (
                  <button type="button" disabled={itemLocked} title={itemDisabledReason} onClick={() => void onApproveItem(item)}>
                    {copy.approveButton}
                  </button>
                )}
                {canRequestChanges && (
                  <button
                    type="button"
                    className="secondary"
                    disabled={itemLocked}
                    title={itemDisabledReason}
                    onClick={() => {
                      setChangeTargetId(showingForm ? null : item.id);
                      setChangeNote("");
                      setChangeKind("caption");
                    }}
                  >
                    {copy.requestChangesButton}
                  </button>
                )}
                {canRequestPublish(item) && session && (
                  <button
                    type="button"
                    className="secondary"
                    disabled={itemLocked || publishBusyId === item.id}
                    title={itemDisabledReason}
                    onClick={() => void handleRequestPublish(item)}
                  >
                    {publishBusyId === item.id ? requestPublishCopy.busy : requestPublishCopy.button}
                  </button>
                )}
              </footer>
              {itemDisabledReason && <small className="item-action-disabled-reason">{itemDisabledReason}</small>}
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
      </div>}
    </section>
  );
}
