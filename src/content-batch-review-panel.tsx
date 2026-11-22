import { lazy, Suspense, useLayoutEffect, useMemo, useState } from "react";
import {
  approveAllCandidates,
  approveAllWouldChange,
  overallBatchStatus,
  canApproveContentItem,
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
import { buildManualDesignPrompt, readContentPillar, readTimeSlot } from "./content-strategy";
import { readPublishingCopy } from "./content-publishing-copy";
import { ContentBatchMediaPreview } from "./content-batch-media-preview";
import { canvaDesignErrorMessage, generateCanvaDesignForContentItem } from "./canva-design-adapter";
import { resolveDesignProvider, type DesignProvider } from "./canva-readiness";
import { uploadStaffMediaFile } from "./staff-media-storage";
import { canUseInMarketingBatch, isNewMediaAssetForContentItem, type MediaAssetRecord } from "./media-types";
import type { CapabilityState } from "./content-growth";
import { useLanguage } from "./i18n";
import { formatLocalDateTimeInput } from "./date-utils";
import "./content-batch-review.css";

const manualDesignSites = [
  ["Gemini", "https://gemini.google.com/"],
  ["Canva", "https://www.canva.com/"],
  ["Runway", "https://app.runwayml.com/"],
] as const;

const BrandedPosterStudio = lazy(() =>
  import("./branded-poster-studio").then((module) => ({ default: module.BrandedPosterStudio }))
);

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const SUPABASE_PUBLIC_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

type PublishEnqueueResult = {
  success?: boolean;
  code?: string;
  providerExternalId?: string;
};

async function requestPublishJob(session: { accessToken: string }, contentItemId: string): Promise<PublishEnqueueResult> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/safe-content-publisher`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLIC_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ contentItemId }),
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) throw new Error("SESSION_EXPIRED");
  const result = (await response.json().catch(() => ({}))) as PublishEnqueueResult;
  if (!response.ok && !result.code) throw new Error(`RPC_FAILED_${response.status}`);
  return result;
}

const PUBLISHING_FREEZE_COPY = {
  ar: "أوقف التجميد طلب النشر لهذا المنشور.",
  en: "The publishing freeze blocked this post’s publish request.",
} as const;

const UNSUPPORTED_PLATFORM_COPY = {
  ar: "هذه المنصة غير مدعومة للنشر الآلي المباشر حاليًا. يمكنك تجهيز النص والوسائط ونشرها يدويًا.",
  en: "Direct automated publishing is not supported for this platform yet. Prepare the caption and media for manual publishing.",
} as const;

function publishEnqueueErrorMessage(code: string | undefined, language: "ar" | "en"): string {
  const messages: Record<string, { ar: string; en: string }> = {
    OWNER_PUBLISHING_FROZEN: PUBLISHING_FREEZE_COPY,
    UNSUPPORTED_PLATFORM: UNSUPPORTED_PLATFORM_COPY,
    STAFF_ACCESS_DENIED: { ar: "لا تملك صلاحية طلب النشر.", en: "You do not have permission to request publish." },
    CONTENT_NOT_APPROVED: { ar: "يجب اعتماد المحتوى قبل طلب النشر.", en: "Content must be approved before requesting publish." },
    CONTENT_ALREADY_PUBLISHED: { ar: "هذا المحتوى منشور بالفعل.", en: "This content is already published." },
    PUBLISH_RECEIPT_EXISTS: { ar: "يوجد إيصال نشر منشور لهذا العنصر.", en: "A published receipt already exists for this item." },
    MEDIA_ASSET_REQUIRED: { ar: "يلزم ربط وسائط جاهزة قبل طلب النشر.", en: "Publish-ready media must be linked before requesting publish." },
    MEDIA_ASSET_NOT_PUBLISHABLE: { ar: "الوسائط المرتبطة غير جاهزة للنشر.", en: "Linked media is not publish-ready." },
    CONTENT_NOT_READY: { ar: "المحتوى غير جاهز للنشر.", en: "Content is not ready to publish." },
    PLATFORM_NOT_SUPPORTED: UNSUPPORTED_PLATFORM_COPY,
    ACTIVE_AUTHORIZATION_EXISTS: { ar: "يوجد تفويض نشر نشط لهذا العنصر.", en: "An active publish authorization already exists for this item." },
    META_NOT_CONFIGURED: { ar: "لم يكتمل إعداد Meta الآمن في الخادم.", en: "The secure Meta server configuration is incomplete." },
    MEDIA_MISSING: { ar: "يلزم وجود صورة أو فيديو محفوظ للنشر.", en: "A stored image or video is required for publishing." },
    META_API_ERROR: { ar: "رفضت Meta عملية النشر أو تعذر الاتصال بها.", en: "Meta rejected the publish request or could not be reached." },
    RECORD_FAILED: { ar: "تم إرسال المنشور لكن تعذر تسجيل النتيجة؛ أوقفنا التكرار للمراجعة.", en: "The post was sent but the result could not be recorded; retry is blocked for review." },
  };
  const entry = code ? messages[code] : undefined;
  if (entry) return entry[language];
  return language === "ar" ? "تعذر طلب النشر." : "Publish request failed.";
}

function canShowPublishAction(item: ContentBatchItem): boolean {
  if (item.publishedAt) return false;
  if (typeof item.providerExternalId === "string" && item.providerExternalId.trim()) return false;
  const receipt = latestReceiptForPlatform(item, item.platform);
  // An ambiguous external result must be manually reconciled before any retry.
  if (receipt?.status.toLowerCase() === "published" || receipt?.status.toLowerCase() === "ambiguous") return false;
  return item.status === "approved"
    || (item.status === "failed" && receipt?.status.toLowerCase() === "failed" && !receipt.externalPostId?.trim());
}

export function offersPublishNow(item: ContentBatchItem): boolean {
  return item.status === "approved" && canShowPublishAction(item)
    && latestReceiptForPlatform(item, item.platform)?.status.toLowerCase() !== "failed";
}

const REQUEST_PUBLISH_COPY = {
  en: {
    button: "Publish Now",
    retryButton: "Retry confirmed failure",
    retryNeedsApproval: "This item needs review and approval again before you can retry publishing.",
    confirm: "Publish this approved item to its connected platform now? The existing secure publisher will publish immediately and record the real result.",
    retryConfirm: "The last result is a confirmed failure. Retry publishing this approved item now? Ambiguous results are blocked from retry.",
    success: "Publish request completed. Refresh to see the recorded result.",
    already: "This item is already published or already has a publish result.",
    busy: "Requesting publish…",
  },
  ar: {
    button: "نشر الآن",
    retryButton: "إعادة محاولة فشل مؤكد",
    retryNeedsApproval: "يحتاج هذا المنشور إلى المراجعة والاعتماد مجددًا قبل إعادة محاولة نشره.",
    confirm: "نشر هذا العنصر المعتمد الآن على المنصة المتصلة؟ مسار النشر الآمن الحالي سينفذ النشر ويسجل النتيجة.",
    retryConfirm: "النتيجة السابقة فشل مؤكد. هل تريد إعادة محاولة نشر هذا العنصر المعتمد؟ النتائج الملتبسة ممنوعة من إعادة المحاولة.",
    success: "اكتمل طلب النشر. حدّث الشاشة لرؤية النتيجة المسجلة.",
    already: "هذا العنصر منشور بالفعل أو توجد له نتيجة نشر مسجلة.",
    busy: "جاري طلب النشر…",
  },
} as const;

type CanvaNotice = { summary: string; details: string[] };

export function CanvaStatusNotice({ notice, language }: { notice: CanvaNotice; language: "ar" | "en" }) {
  return (
    <div className="factory-canva-notice">
      <span role="status">{notice.summary}</span>
      <details>
        <summary>{language === "ar" ? "تفاصيل Canva" : "Canva details"}</summary>
        <ul lang="en" dir="ltr">{notice.details.map((detail, index) => <li key={index}>{detail}</li>)}</ul>
      </details>
    </div>
  );
}

type DesignMethod = "" | "personal" | "upload" | "poster" | "automatic";
type ScheduleDraft = { original: string | null; value: string };
export type FactoryCardTarget = { id: string; status: "scheduled"; scheduledFor: string } | { id: string; status: "approved" };
export type ScheduleResult = { itemId: string; ok: boolean; code: string; message: string };

export function matchesSavedSchedule(item: ContentBatchItem, scheduledFor: string) {
  return item.status === "scheduled" && !!item.scheduledFor && Date.parse(item.scheduledFor) === Date.parse(scheduledFor);
}
type ItemFilter = "all" | "needs_review" | "approved" | "scheduled" | "published" | "failed";

function matchesFilter(item: ContentBatchItem, filter: ItemFilter) {
  if (filter === "needs_review") return canApproveContentItem(item);
  return filter === "all" || item.status === filter;
}

type ContentBatchReviewPanelProps = {
  items: ContentBatchItem[];
  batch: ContentBatch;
  cardTarget?: FactoryCardTarget | null;
  scheduleAttempts?: Readonly<Record<string, { result?: ScheduleResult }>>;
  onRefreshStatus?: () => void;
  canWrite: boolean;
  busy: boolean;
  session?: { accessToken: string; role?: string };
  mediaAssets?: MediaAssetRecord[];
  onMediaLinked?: (showReviewCard?: boolean) => void;
  onApproveItem: (item: ContentBatchItem) => Promise<ScheduleResult>;
  onEditItem?: (item: ContentBatchItem, visualPrompt: string, scheduledFor: string | null, onSaved: () => void) => Promise<void>;
  onRequestChanges: (item: ContentBatchItem, kind: ChangeRequestKind, note: string, onSaved: () => void) => Promise<void>;
  onApproveAll: (items: ContentBatchItem[]) => Promise<void>;
  onPublishRequested?: () => void;
  onSessionExpired?: () => void;
  onOpenConnections?: () => void;
  workspaceMode?: "designs" | "reels" | "campaigns" | "review";
  designCapabilityState?: CapabilityState;
  canvaStatusNotice?: CanvaNotice;
  videoCapabilityState?: CapabilityState;
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
  cardTarget,
  scheduleAttempts,
  onRefreshStatus,
  canWrite,
  busy,
  session,
  mediaAssets = [],
  onMediaLinked,
  onApproveItem,
  onEditItem,
  onRequestChanges,
  onApproveAll,
  onPublishRequested,
  onSessionExpired,
  onOpenConnections,
  workspaceMode = "review",
  designCapabilityState = "NOT_CONFIGURED",
  canvaStatusNotice,
  videoCapabilityState = "NOT_CONFIGURED",
}: ContentBatchReviewPanelProps) {
  const { language, t } = useLanguage();
  const copy = t("contentBatch");
  const growthCopy = t("contentGrowth");
  const publishingCopy = readPublishingCopy(language);
  const itemStatusLabels = t("contentStatus");
  const batchStatusLabels = t("contentBatchStatus");
  const pipelineStageLabels = publishingCopy.pipelineStages;
  const [changeTargetId, setChangeTargetId] = useState<string | null>(null);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [changeKind, setChangeKind] = useState<ChangeRequestKind>("caption");
  const [designMethods, setDesignMethods] = useState<Record<string, DesignMethod>>({});
  const [changeNote, setChangeNote] = useState("");
  const [designBusyId, setDesignBusyId] = useState<string | null>(null);
  const [designNotice, setDesignNotice] = useState<string | CanvaNotice>("");
  const [designProviderByItem, setDesignProviderByItem] = useState<Record<string, string>>({});
  const [publishBusyId, setPublishBusyId] = useState<string | null>(null);
  const [publishNotice, setPublishNotice] = useState("");
  const [metaSetupItemId, setMetaSetupItemId] = useState<string | null>(null);
  const [videoTargetId, setVideoTargetId] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<4 | 6 | 8>(8);
  const [videoResolution, setVideoResolution] = useState<"720p" | "1080p">("720p");
  const [videoEstimate, setVideoEstimate] = useState<{ costUsd: number; model: string } | null>(null);
  const [videoBusyId, setVideoBusyId] = useState<string | null>(null);
  const [videoNotice, setVideoNotice] = useState("");
  const [itemFilter, setItemFilter] = useState<ItemFilter>("all");
  useLayoutEffect(() => {
    if (!cardTarget) return;
    setItemFilter(cardTarget.status);
    const frame = requestAnimationFrame(() => {
      const card = document.getElementById(`factory-post-${cardTarget.id}`);
      card?.focus({ preventScroll: true });
      card?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [cardTarget]);
  const [selectedAssetByItem, setSelectedAssetByItem] = useState<Record<string, string>>({});
  const [mediaActionBusyId, setMediaActionBusyId] = useState<string | null>(null);
  const [presenceByItem, setPresenceByItem] = useState<Record<string, string>>({});
  const [mediaErrors, setMediaErrors] = useState<Record<string, string>>({});
  const [scheduleTimes, setScheduleTimes] = useState<Record<string, ScheduleDraft>>({});
  const requestPublishCopy = REQUEST_PUBLISH_COPY[language];

  const batchStatus = overallBatchStatus(batch.items);
  const approveCandidates = approveAllCandidates(batch.items);
  const canApproveByRole = session?.role === "super_admin";
  const approveAllEnabled = canApproveByRole && !busy && approveAllWouldChange(batch.items);
  const assetById = useMemo(() => new Map(mediaAssets.map((asset) => [asset.id, asset])), [mediaAssets]);
  const workspaceItems = useMemo(() => {
    if (workspaceMode === "designs") return items.filter((item) => !item.mediaAssetId);
    if (workspaceMode === "reels") return items.filter((item) => String(item.contentType).toLowerCase() === "reel");
    if (workspaceMode === "campaigns") return items.filter((item) => ["approved", "scheduled", "published", "failed"].includes(item.status));
    return items;
  }, [items, workspaceMode]);
  const visibleItems = workspaceItems.filter((item) => matchesFilter(item, itemFilter));
  const previewLabels = {
    designPreview: copy.designPreview,
    designPending: copy.designPending,
    canvaBriefLabel: copy.canvaBriefLabel,
    noPreview: copy.noPreview,
  };
  const workspaceLabel = language === "ar"
    ? ({ designs: "مساحة التصميم", reels: "مساحة الريلز", campaigns: "مساحة الحملات والجدولة", review: "مساحة المراجعة" } as const)[workspaceMode]
    : ({ designs: "Design workspace", reels: "Reels workspace", campaigns: "Campaigns and scheduling workspace", review: "Review workspace" } as const)[workspaceMode];

  async function handleApproveAll() {
    if (!approveAllEnabled || approveCandidates.length === 0) return;
    const confirmMessage = language === "ar"
      ? `تأكيد اعتماد ${approveCandidates.length} عنصر(عناصر) في هذه الدفعة؟ لن يتم جدولة أو نشر أي عنصر من هذه الشاشة.`
      : `Approve ${approveCandidates.length} item(s) in this batch? Nothing will be scheduled or published from this screen.`;
    if (!window.confirm(confirmMessage)) return;
    await onApproveAll(approveCandidates);
  }

  function selectDesignMethod(itemId: string, method: DesignMethod) {
    setDesignMethods((current) => ({ ...current, [itemId]: method }));
    setPresenceByItem((current) => ({ ...current, [itemId]: "" }));
  }

  function scheduleForItem(item: ContentBatchItem) {
    const draft = scheduleTimes[item.id];
    if (!draft || draft.original !== item.scheduledFor || draft.value === formatLocalDateTimeInput(item.scheduledFor)) return item.scheduledFor;
    return draft.value || null;
  }

  function confirmApproval(item: ContentBatchItem) {
    const selectedTime = scheduleForItem(item);
    const time = selectedTime ? new Date(selectedTime) : null;
    if (!time || !(time.getTime() > Date.now())) return;
    const topic = item.topic || copy.untitled;
    const confirmMessage = language === "ar"
      ? `اعتماد «${topic}» وجدولته في ${formatWhen(language, time.toISOString())}؟`
      : `Approve "${topic}" and schedule it for ${formatWhen(language, time.toISOString())}?`;
    if (window.confirm(confirmMessage)) return onApproveItem({ ...item, scheduledFor: time.toISOString() });
  }

  async function submitChangeRequest(item: ContentBatchItem) {
    if (!changeNote.trim()) return;
    const topic = item.topic || copy.untitled;
    const confirmMessage = language === "ar"
      ? `تأكيد طلب تعديل «${topic}» وإعادته للمراجعة؟`
      : `Request changes and return "${topic}" to review?`;
    if (!window.confirm(confirmMessage)) return;
    await onRequestChanges(item, changeKind, changeNote.trim(), () => {
      setChangeTargetId(null);
      setChangeNote("");
      setChangeKind("caption");
    });
  }

  async function submitEdit(item: ContentBatchItem, form: HTMLFormElement) {
    const data = new FormData(form);
    const selectedTime = scheduleForItem(item);
    const scheduledFor = selectedTime && selectedTime !== item.scheduledFor ? new Date(selectedTime).toISOString() : selectedTime;
    await onEditItem?.(item, String(data.get("visualPrompt") ?? "").trim(), scheduledFor, () => setEditTargetId(null));
  }

  function recommendedDesignProvider(item: ContentBatchItem): Exclude<DesignProvider, "auto"> {
    const isVideo = /reel|video/i.test(String(item.contentType));
    return resolveDesignProvider("auto", isVideo, designCapabilityState === "AVAILABLE", videoCapabilityState === "AVAILABLE");
  }

  function availableDesignProviders(item: ContentBatchItem) {
    const isVideo = /reel|video/i.test(String(item.contentType));
    return [
      { key: "auto" as const, label: language === "ar" ? "تلقائي — أوصي بالأفضل" : "Auto — recommend best", available: true, detail: language === "ar" ? "يختار المسار الأفضل حسب ما هو متصل ومتحقق" : "Chooses the best verified connected path" },
      { key: "canva" as const, label: "Canva", available: !isVideo && designCapabilityState === "AVAILABLE", detail: designCapabilityState === "AVAILABLE"
          ? (language === "ar" ? "Canva متصل وجاهز لتصميم صورة / Carousel" : "Canva is connected and ready for image / carousel design")
          : canvaStatusNotice?.summary ?? (language === "ar" ? "Canva غير جاهز للتصميم حاليًا" : "Canva is not ready for design yet") },
      { key: "gemini" as const, label: "Gemini Image", available: !isVideo, detail: language === "ar" ? "توليد صورة عبر Gemini مع تأكيد التكلفة" : "Gemini image generation; confirm cost first" },
      { key: "chatgpt" as const, label: "ChatGPT", available: false, detail: language === "ar" ? "توليد بصري — غير موصول داخل المصنع حاليًا" : "Visual generation — not wired into Factory yet" },
      { key: "runway" as const, label: "Runway", available: isVideo && videoCapabilityState === "AVAILABLE", detail: language === "ar" ? "توليد فيديو" : "Video generation" },
      { key: "capcut" as const, label: "CapCut", available: isVideo, detail: language === "ar" ? "تحرير فيديو يدوي" : "Manual video editing" },
      { key: "manual" as const, label: language === "ar" ? "يدوي" : "Manual", available: true, detail: language === "ar" ? "استخدم الـBrief الجاهز" : "Use the prepared brief" },
    ];
  }

  function selectedDesignProvider(item: ContentBatchItem): DesignProvider {
    return (designProviderByItem[item.id] as DesignProvider | undefined) ?? "auto";
  }

  async function handleGenerateDesign(item: ContentBatchItem) {
    if (!session || !canWrite || busy || designBusyId) return;
    setDesignBusyId(item.id);
    setDesignNotice("");
    let activeProvider = selectedDesignProvider(item);
    try {
      const requestedProvider = selectedDesignProvider(item);
      const isVideo = /reel|video/i.test(String(item.contentType));
      if (requestedProvider === "auto" && isVideo && videoCapabilityState !== "AVAILABLE") {
        onOpenConnections?.();
        return;
      }
      const provider = resolveDesignProvider(requestedProvider, isVideo, designCapabilityState === "AVAILABLE", videoCapabilityState === "AVAILABLE");
      activeProvider = provider;
      const providerInfo = availableDesignProviders(item).find((entry) => entry.key === provider);
      if (!providerInfo?.available) {
        if (provider === "runway") {
          onOpenConnections?.();
          return;
        }
        setDesignNotice(provider === "canva" && canvaStatusNotice
          ? canvaStatusNotice.summary
          : language === "ar"
            ? "هذا المزود غير جاهز حاليًا. لم يتم تشغيل أي عملية."
            : "This provider is not ready right now. No operation was started.");
        return;
      }
      if (provider === "gemini") {
        if (!confirmScheduledMediaChange(item)) return;
        const { estimateGeminiImageGeneration, generateGeminiImageForContentItem } = await import("./gemini-image-design-adapter");
        const estimate = await estimateGeminiImageGeneration(session);
        const confirmed = window.confirm(language === "ar"
          ? "إنشاء صورة عبر Gemini. التكلفة التقديرية للصورة الواحدة بدقة 1K: $" + estimate.estimatedCostUsd.toFixed(3) + " تقريبًا. قد تختلف التكلفة الفعلية. هل تريد المتابعة؟"
          : "Generate one Gemini image. Estimated cost for a 1K image: approximately $" + estimate.estimatedCostUsd.toFixed(3) + ". Actual charges may vary. Continue?");
        if (!confirmed) return;
        const generated = await generateGeminiImageForContentItem(session, item);
        await linkMediaToItem(item.id, generated.mediaAssetId);
        setDesignNotice(language === "ar"
          ? "تم توليد الصورة وحفظها وربطها بالمحتوى. الأصل الآن للمراجعة قبل أي نشر."
          : "Image generated, stored, and linked to the content. The asset is in review before any publishing.");
        selectDesignMethod(item.id, "");
        onMediaLinked?.();
        return;
      }
      if (provider !== "canva") {
        setDesignNotice(language === "ar"
          ? provider === "runway" ? "Runway هو اختيار الفيديو، لكن التنفيذ الآلي يتطلب اتصالًا متحققًا به. لا ندّعي توليدًا غير موجود." : provider === "capcut" ? "CapCut متاح هنا كمسار تحرير يدوي؛ الـBrief جاهز." : "تم اختيار المسار اليدوي؛ استخدم الـBrief الجاهز."
          : provider === "runway" ? "Runway is the video choice, but automated execution requires a verified connection. No unsupported generation is claimed." : provider === "capcut" ? "CapCut is available here as a manual editing path; the brief is ready." : "Manual path selected; use the prepared brief.");
        return;
      }
      if (!confirmScheduledMediaChange(item)) return;
      const generated = await generateCanvaDesignForContentItem(session, item);
      setDesignNotice(generated.imageApplied
        ? copy.designGeneratedNotice
        : language === "ar"
          ? "تم إنشاء التصميم، لكن الصورة لم تتغير تلقائيًا. اربط صورة من المكتبة واستخدم قالب Canva بحقل صورة قابل للتعبئة."
          : "Canva design created, but the main image was not replaced automatically. Link a Media Library image and use a template with an autofillable image field.");
      selectDesignMethod(item.id, "");
      onMediaLinked?.();
    } catch (cause) {
      if (cause instanceof Error && cause.message === "SESSION_EXPIRED") throw cause;
      const code = cause instanceof Error ? cause.message : undefined;
      if (activeProvider === "gemini") {
        const { geminiImageDesignErrorMessage } = await import("./gemini-image-design-adapter");
        setDesignNotice(geminiImageDesignErrorMessage(code, language));
      } else {
        setDesignNotice({
          summary: language === "ar" ? "تعذّر إنشاء التصميم في Canva" : "Canva could not create this design",
          details: [canvaDesignErrorMessage(code)],
        });
      }
    } finally {
      setDesignBusyId(null);
    }
  }

  async function mediaRpc(name: string, body: Record<string, unknown>, failure: string) {
    if (!session) throw new Error("AUTH_REQUIRED");
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLIC_KEY,
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (response.status === 401) throw new Error("SESSION_EXPIRED");
    if (response.status === 403) throw new Error("MEDIA_ACCESS_DENIED");
    const res = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok || res.success !== true) throw new Error(typeof res.code === "string" ? res.code : failure);
    return res;
  }

  async function linkMediaToItem(itemId: string, assetId: string) {
    await mediaRpc("link_staff_media_to_content_item", { p_content_item_id: itemId, p_media_asset_id: assetId }, "MEDIA_LINK_FAILED");
    setMediaErrors((current) => ({ ...current, [itemId]: "" }));
  }

  function scheduledMediaChangeWarning(): string {
    return language === "ar"
      ? "سيُلغى موعد النشر ويُعاد المحتوى للمراجعة."
      : "This cancels scheduling and returns the content to review.";
  }

  function confirmScheduledMediaChange(item: ContentBatchItem): boolean {
    if (item.status !== "scheduled") return true;
    return window.confirm(`${scheduledMediaChangeWarning()} ${language === "ar" ? "هل تتابع؟" : "Continue?"}`);
  }

  function mediaLinkErrorMessage(code: string | undefined): string {
    const messages: Record<string, { ar: string; en: string }> = {
      MEDIA_ASSET_NOT_PUBLISHABLE: {
        ar: "الأصل غير جاهز للنشر بعد (يحتاج تأكيد الموافقة أو تصنيفه في مكتبة الوسائط).",
        en: "Media asset is not publish-ready yet (requires consent confirmation or classification in Media Library).",
      },
      MEDIA_ASSET_ALREADY_LINKED: {
        ar: "هذا الأصل مرتبط بالفعل بعنصر محتوى آخر.",
        en: "This asset is already linked to another content item.",
      },
      CONTENT_ITEM_NOT_FOUND: {
        ar: "عنصر المحتوى غير موجود.",
        en: "Content item not found.",
      },
      PUBLISHED_CONTENT_IMMUTABLE: {
        ar: "المحتوى المنشور لا يمكن تعديل وسائطه.",
        en: "Published content cannot be modified.",
      },
      UPLOAD_REGISTRATION_FAILED: {
        ar: "تعذر تسجيل الملف المرفوع في مكتبة الوسائط.",
        en: "Failed to register uploaded file in Media Library.",
      },
      UPLOAD_FAILED: {
        ar: "تعذر رفع الملف من الجهاز.",
        en: "Failed to upload file from device.",
      },
      MEDIA_LINK_FAILED: {
        ar: "تعذر ربط الوسائط بالمحتوى.",
        en: "Failed to link media to content.",
      },
      MEDIA_ACCESS_DENIED: { ar: "حسابك لا يملك صلاحية إكمال ربط الصورة.", en: "Your account cannot complete this media link." },
      MEDIA_REVIEW_FAILED: { ar: "تعذر حفظ تصنيف التصميم أو تأكيد مراجعته.", en: "The design classification or review could not be saved." },
    };
    return messages[code ?? ""]?.[language] ?? ((language === "ar" ? "تعذر إكمال ربط الوسائط" : "Media link failed") + (code ? ` (${code})` : "."));
  }

  async function handleLinkMedia(item: ContentBatchItem, assetId: string) {
    if (!session || !canWrite || busy || mediaActionBusyId || !assetId) return;
    if (!confirmScheduledMediaChange(item)) return;
    setMediaActionBusyId(item.id);
    setDesignNotice("");
    try {
      await linkMediaToItem(item.id, assetId);
      setDesignNotice(language === "ar" ? "تم ربط الأصل من المكتبة بنجاح وهو الآن قيد المراجعة." : "Media asset linked successfully and is now in review.");
      selectDesignMethod(item.id, "");
      onMediaLinked?.();
    } catch (cause) {
      if (cause instanceof Error && cause.message === "SESSION_EXPIRED") onSessionExpired?.();
      else setMediaErrors((current) => ({ ...current, [item.id]: mediaLinkErrorMessage(cause instanceof Error ? cause.message : undefined) }));
    } finally {
      setMediaActionBusyId(null);
    }
  }

  async function handleUploadMedia(item: ContentBatchItem, file: File) {
    if (!session || !canWrite || busy || mediaActionBusyId || !file || item.status === "published") return;
    const presence = presenceByItem[item.id];
    if (presence !== "none" && presence !== "consented") {
      setMediaErrors((current) => ({ ...current, [item.id]: language === "ar" ? "اختر حالة الأشخاص في التصميم أولًا." : "Select who appears in the design first." }));
      return;
    }
    const containsPeople = presence === "consented";
    const attestation = containsPeople
      ? (language === "ar" ? "لدي موافقة نشر من كل شخص ظاهر أو وليّ أمره." : "I have permission to publish from everyone shown or their guardian.")
      : (language === "ar" ? "لا يظهر أي شخص حقيقي في التصميم." : "No real person appears in this design.");
    if (!window.confirm((language === "ar"
      ? `أؤكد أن «${file.name}» تصميم لنشاط السباحة، مطابق لهوية الأكاديمية وجاهز للنشر. ${attestation}\nاعتماد الصورة وربطها بالمنشور للمراجعة؟`
      : `I confirm "${file.name}" is a swimming business design, matches the academy brand and is ready to publish. ${attestation}\nApprove the media and link it to this post for review?`))) return;
    if (!confirmScheduledMediaChange(item)) return;
    setMediaActionBusyId(item.id);
    setDesignNotice("");
    let registered = false;
    try {
      const uploaded = await uploadStaffMediaFile(session, file);
      const reg = await mediaRpc("register_staff_media_upload", {
        p_asset_type: uploaded.assetType,
        p_storage_path: uploaded.storagePath,
        p_metadata: { file_name: uploaded.fileName, mime_type: file.type || null },
      }, "UPLOAD_REGISTRATION_FAILED");
      const newAssetId = typeof reg.mediaAssetId === "string" ? reg.mediaAssetId : "";
      if (!newAssetId) throw new Error("UPLOAD_REGISTRATION_FAILED");
      registered = true;
      const asset = { p_media_asset_id: newAssetId };
      await mediaRpc("attest_media_person_presence", { ...asset, p_contains_real_person: containsPeople }, "MEDIA_REVIEW_FAILED");
      await mediaRpc(session.role === "super_admin" ? "update_owner_media_asset" : "update_staff_media_asset", {
        ...asset, p_category: "swimming_business", p_media_status: "ready",
        ...(containsPeople ? { p_consent_status: "consent_confirmed" } : {}),
      }, "MEDIA_REVIEW_FAILED");
      await mediaRpc("review_staff_media_asset", { ...asset, p_review_status: "approved" }, "MEDIA_REVIEW_FAILED");
      await linkMediaToItem(item.id, newAssetId);

      setDesignNotice(language === "ar"
        ? "رُبط التصميم بالمنشور. اختر موعدًا مستقبليًا على البطاقة قبل الاعتماد والجدولة."
        : "Design linked. Choose a future time on the card before approving and scheduling.");
      if (designMethods[item.id] === "upload") selectDesignMethod(item.id, "");
      setItemFilter("all");
      setScheduleTimes((current) => ({ ...current, [item.id]: { original: item.scheduledFor, value: "" } }));
      onMediaLinked?.(true);
    } catch (cause) {
      if (cause instanceof Error && cause.message === "SESSION_EXPIRED") onSessionExpired?.();
      else {
        const reason = mediaLinkErrorMessage(cause instanceof Error ? cause.message : "UPLOAD_FAILED");
        const recovery = registered ? (language === "ar" ? " حُفظ الملف في المكتبة. يمكنك إكمال مراجعته هناك ثم اختيار «ربط هذا الأصل»." : " The file is in the library. Finish its review there, then choose Link asset.") : "";
        setMediaErrors((current) => ({ ...current, [item.id]: reason + recovery }));
        if (registered) onMediaLinked?.();
      }
    } finally {
      setMediaActionBusyId(null);
      setPresenceByItem((current) => ({ ...current, [item.id]: "" }));
    }
  }

  async function requestVeo(session: { accessToken: string }, body: Record<string, unknown>) {
    const response = await fetch(SUPABASE_URL + "/functions/v1/generate-veo-video", {
      method: "POST",
      headers: {
        apikey: SUPABASE_PUBLIC_KEY,
        Authorization: "Bearer " + session.accessToken,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (response.status === 401 || response.status === 403) throw new Error("SESSION_EXPIRED");
    const result = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      const code = typeof result.error === "string" ? result.error : "VEO_FAILED_" + response.status;
      const providerStatus = typeof result.providerStatus === "number" ? " (Google HTTP " + result.providerStatus + ")" : "";
      const detail = typeof result.detail === "string" ? result.detail.trim().slice(0, 180) : "";
      throw new Error([code + providerStatus, detail].filter(Boolean).join(": "));
    }
    return result;
  }

  async function openVideoCreator(item: ContentBatchItem) {
    if (!session || !canWrite || busy || videoBusyId) return;
    setVideoTargetId(item.id);
    setVideoEstimate(null);
    setVideoNotice("");
    try {
      const result = await requestVeo(session, { mode: "estimate", duration: videoDuration, resolution: videoResolution, aspectRatio: "9:16" });
      setVideoEstimate({
        costUsd: typeof result.estimatedCostUsd === "number" ? result.estimatedCostUsd : 0,
        model: typeof result.model === "string" ? result.model : "veo-3.1-lite-generate-preview",
      });
    } catch (cause) {
      if (cause instanceof Error && cause.message === "SESSION_EXPIRED") { onSessionExpired?.(); return; }
      setVideoNotice(language === "ar" ? "تعذر حساب التكلفة قبل التوليد." : "Could not calculate the cost before generation.");
    }
  }

  async function handleGenerateVideo(item: ContentBatchItem) {
    if (!session || !canWrite || busy || videoBusyId || videoTargetId !== item.id) return;
    setVideoBusyId(item.id);
    setVideoNotice("");
    try {
      const estimate = await requestVeo(session, { mode: "estimate", duration: videoDuration, resolution: videoResolution, aspectRatio: "9:16" });
      const costUsd = typeof estimate.estimatedCostUsd === "number" ? estimate.estimatedCostUsd : null;
      const confirmed = window.confirm(
        language === "ar"
          ? "فيديو رأسي " + videoDuration + " ثوانٍ بدقة " + videoResolution + ". التكلفة التقديرية: $" + (costUsd == null ? "غير معروفة" : costUsd.toFixed(2)) + "."
            + (item.status === "scheduled" ? " " + scheduledMediaChangeWarning() : "")
            + " إنشاء الفيديو الآن؟"
          : "Vertical " + videoDuration + "s video at " + videoResolution + ". Estimated cost: $" + (costUsd == null ? "unknown" : costUsd.toFixed(2)) + "."
            + (item.status === "scheduled" ? " " + scheduledMediaChangeWarning() : "")
            + " Generate now?",
      );
      if (!confirmed) return;
      setVideoEstimate(costUsd == null ? null : { costUsd, model: typeof estimate.model === "string" ? estimate.model : "veo-3.1-lite-generate-preview" });
      const result = await requestVeo(session, {
        mode: "generate",
        duration: videoDuration,
        resolution: videoResolution,
        aspectRatio: "9:16",
        prompt: String(item.visualPrompt || item.hook || item.topic || "Short swimming training Reel for parents in Abu Dhabi."),
      });
      const mediaAssetId = typeof result.mediaAssetId === "string" ? result.mediaAssetId : "";
      if (!mediaAssetId) throw new Error("VEO_MEDIA_ASSET_MISSING");
      await linkMediaToItem(item.id, mediaAssetId);
      setVideoNotice(language === "ar" ? "تم إنشاء الفيديو وحفظه وربطه بالمحتوى. عاد للمراجعة قبل أي نشر." : "Video generated, stored, and linked to the content. It is back in review before any publish.");
      setVideoTargetId(null);
      selectDesignMethod(item.id, "");
      onMediaLinked?.();
    } catch (cause) {
      if (cause instanceof Error && cause.message === "SESSION_EXPIRED") onSessionExpired?.();
      else setVideoNotice(cause instanceof Error ? cause.message : "VEO_FAILED");
    } finally {
      setVideoBusyId(null);
    }
  }

  async function handleRequestPublish(item: ContentBatchItem) {
    if (!session || !canWrite || busy || publishBusyId || item.status !== "approved" || !canShowPublishAction(item)) return;
    const priorReceipt = latestReceiptForPlatform(item, item.platform);
    const confirmedFailure = priorReceipt?.status.toLowerCase() === "failed";
    if (!window.confirm(confirmedFailure ? requestPublishCopy.retryConfirm : requestPublishCopy.confirm)) return;
    setPublishBusyId(item.id);
    setPublishNotice("");
    setMetaSetupItemId(null);
    try {
      const result = await requestPublishJob(session, item.id);
      if (!result.success) {
        if (result.code === "META_NOT_CONFIGURED") {
          setMetaSetupItemId(item.id);
          return;
        }
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
          <p className="batch-meta">{copy.eyebrow} · {workspaceLabel}</p>
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

      <div className="publish-pipeline-panel" role="status">
        <strong>{language === "ar" ? "بحسب آخر قرار للمالك، النشر المباشر مجمّد." : "The owner’s latest decision freezes direct publishing."}</strong>
        <p className="publish-ready-note">{language === "ar" ? "يمكنك تجهيز المنشور ومراجعته هنا." : "You can prepare and review the post here."}</p>
      </div>

      {workspaceMode === "reels" && (
        <div className="content-batch-design-notice" role="status">
          {language === "ar"
            ? "تحليل واقتراح Reel متاح داخل هذه المساحة. توليد الفيديو الفعلي يتم عبر Google Veo؛ تُفحص الاعتمادات وتُحسب التكلفة قبل بدء التوليد."
            : "Reel analysis and proposals are available here. Actual video generation uses Google Veo; credentials and estimated cost are checked before generation starts."}
        </div>
      )}
      {workspaceMode === "campaigns" && (
        <div className="content-batch-design-notice" role="status">
          {language === "ar"
            ? "هذه المساحة تعرض حالة الحملات الحالية. النشر الفوري يظهر داخل العنصر المعتمد نفسه؛ لا توجد غرفة نشر ثانية."
            : "This workspace shows current campaign states. Immediate publish stays on the approved item itself; there is no second publishing room."}
        </div>
      )}

      <div className="content-batch-actions">
        {canApproveByRole && <button type="button" disabled={!approveAllEnabled} title={busy ? copy.actionDisabledBusy : approveCandidates.length === 0 ? copy.batchNothingToApprove : undefined} onClick={() => void handleApproveAll()}>
          {busy ? t("common").saving : copy.approveAllButton}
        </button>}
      </div>
      {designNotice && (typeof designNotice === "string"
        ? <p className="content-batch-design-notice" role="status">{designNotice}</p>
        : <CanvaStatusNotice notice={designNotice} language={language} />)}
      {publishNotice && <p className="content-batch-design-notice" role="status">{publishNotice}</p>}
      {videoNotice && <p className="content-batch-design-notice" role="status">{videoNotice}</p>}

      <div className="content-review-toolbar">
        <div>
          <strong>{language === "ar" ? "مراجعة الدفعة" : "Batch review"}</strong>
          <span>{language === "ar" ? "اعرض الحالة التي تريد التعامل معها فقط." : "Show only the status you want to work on."}</span>
        </div>
        <div className="content-review-filters" role="group" aria-label={language === "ar" ? "تصفية حالات المحتوى" : "Content status filters"}>
          {(["all", "needs_review", "approved", "scheduled", "published", "failed"] as const).map((filter) => {
            const count = workspaceItems.filter((item) => matchesFilter(item, filter)).length;
            const label = filter === "all"
              ? (language === "ar" ? "الكل" : "All")
              : filter === "needs_review"
                ? (language === "ar" ? "للمراجعة" : "Needs review")
                : filter === "approved"
                  ? (language === "ar" ? "معتمد" : "Approved")
                  : filter === "scheduled"
                    ? (language === "ar" ? "مجدول" : "Scheduled")
                    : filter === "published"
                      ? (language === "ar" ? "منشور" : "Published")
                      : (language === "ar" ? "فشل" : "Failed");
            return (
              <button
                type="button"
                key={filter}
                className={itemFilter === filter ? "active" : ""}
                onClick={() => setItemFilter(filter)}
              >
                {label} <b>{count}</b>
              </button>
            );
          })}
        </div>
      </div>
      {visibleItems.length === 0 ? <p className="content-review-empty">{language === "ar" ? "لا توجد عناصر في هذه الحالة." : "No items match this status."}</p> : <div className="content-batch-grid">
        {visibleItems.map((item) => {
          const designPrompt = buildManualDesignPrompt(String(item.visualPrompt || item.caption || item.topic || ""));
          const canApproveStatus = canApproveContentItem(item);
          const canRequestChanges = ["draft", "generated", "approved", "scheduled", "failed"].includes(item.status);
          const itemLocked = busy || !canWrite;
          const pillar = readContentPillar(item);
          const timeSlot = readTimeSlot(item);
          const selectableMediaAssets = mediaAssets.filter((asset) => isNewMediaAssetForContentItem(asset, item.createdAt));
          const showingForm = changeTargetId === item.id;
          const pipelineStage = resolvePublishPipelineStage(item);
          const receipts = parsePublicationReceipts(item);
          const platformReceipt = latestReceiptForPlatform(item, item.platform);
          const postLink = buildExternalPostLink(item.platform, platformReceipt?.externalPostId);
          const itemDisabledReason = !canWrite ? copy.actionDisabledReadOnly : busy ? copy.actionDisabledBusy : undefined;
          const linkedMediaAssetId = typeof item.mediaAssetId === "string" ? item.mediaAssetId : "";
          const linkedMediaAsset = assetById.get(linkedMediaAssetId);
          const mediaReadyForPublish = Boolean(linkedMediaAsset && canUseInMarketingBatch(linkedMediaAsset));
          const showingEditForm = editTargetId === item.id;
          const canChangeMedia = Boolean(session) && item.status !== "published";
          const chosenMethod = designMethods[item.id] ?? "";
          const designMethod = !canChangeMedia && (chosenMethod === "upload" || chosenMethod === "automatic") ? "" : chosenMethod;
          const canSetSchedule = (canApproveStatus && canApproveByRole) || (onEditItem && item.status !== "published");
          const scheduledTime = scheduleForItem(item);
          const attempt = scheduleAttempts?.[item.id];
          const result = attempt?.result;
          const awaitingSchedule = !!attempt && result?.ok !== false;
          const futureTime = Boolean(scheduledTime && new Date(scheduledTime).getTime() > Date.now());
          const personPresence = (
            <label>{language === "ar" ? "من يظهر في التصميم؟" : "Who appears in the design?"}
              <select value={presenceByItem[item.id] ?? ""} disabled={itemLocked || Boolean(mediaActionBusyId)}
                onChange={(event) => setPresenceByItem({ ...presenceByItem, [item.id]: event.target.value })}>
                <option value="">{language === "ar" ? "اختر حالة الأشخاص" : "Select person presence"}</option>
                <option value="none">{language === "ar" ? "لا يظهر أشخاص حقيقيون" : "No real people appear"}</option>
                <option value="consented">{language === "ar" ? "توجد موافقة نشر لكل من يظهر" : "Everyone shown has given permission to publish"}</option>
              </select>
            </label>
          );
          return (
            <article className="content-batch-item" key={item.id} id={`factory-post-${item.id}`} tabIndex={-1}>
              {cardTarget?.id === item.id && cardTarget.status === "scheduled" && matchesSavedSchedule(item, cardTarget.scheduledFor) && (
                <p role="status">{language === "ar" ? "حُفظ موعد المنشور" : "Post schedule saved"}</p>
              )}
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
              {mediaErrors[item.id] && <p className="error-box" role="alert">{mediaErrors[item.id]}</p>}
              {linkedMediaAssetId && (!mediaErrors[item.id] || linkedMediaAsset?.storagePath) && <ContentBatchMediaPreview item={item} session={session} assetById={assetById} labels={previewLabels} />}
              <details className="content-item-details">
                <summary>{language === "ar" ? "المزيد والتفاصيل" : "More details"}</summary>
                <p className="item-caption">{item.caption.trim() || copy.noCaption}</p>
                {!item.mediaAssetId && !mediaErrors[item.id] && <ContentBatchMediaPreview item={item} session={session} assetById={assetById} labels={previewLabels} />}
              {(Boolean(item.mediaSource) || Boolean(item.mediaAssetId) || item.mediaPlan != null) && (
                <p className="item-meta">
                  {copy.mediaSourceLabel}: {String(item.mediaSource ?? "—").toUpperCase()}
                  {item.mediaAssetId ? ` · ${copy.mediaLinked}` : ""}
                  {item.mediaSource === "pending" ? ` · ${copy.mediaFallbackPending}` : ""}
                </p>
              )}
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
                    {receipt.updatedAt && <time className="item-meta" dateTime={receipt.updatedAt}>{language === "ar" ? "وقت النتيجة" : "Result time"}: {formatWhen(language, receipt.updatedAt)}</time>}
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
              <div className="factory-design-method">
                  <label>{language === "ar" ? "طريقة التصميم" : "Design method"}
                    <select value={designMethod}
                      disabled={mediaActionBusyId === item.id || designBusyId === item.id || videoBusyId === item.id}
                      onChange={(event) => selectDesignMethod(item.id, event.target.value as DesignMethod)}>
                      <option value="">{item.mediaAssetId && canChangeMedia
                        ? (language === "ar" ? "استبدال الصورة / تغيير التصميم" : "Replace photo / change design")
                        : (language === "ar" ? "اختر طريقة التصميم" : "Choose a design method")}</option>
                      <option value="personal">{language === "ar" ? "حسابك الشخصي" : "Personal account"}</option>
                      {canChangeMedia && <option value="upload">{language === "ar" ? "رفع من الجهاز أو المكتبة" : "Upload or choose from library"}</option>}
                      <option value="poster">{language === "ar" ? "بوستر محلي" : "Local poster"}</option>
                      {canChangeMedia && <option value="automatic">{language === "ar" ? "توليد تلقائي" : "Automatic generation"}</option>}
                    </select>
                  </label>
                {designMethod === "personal" && <div className="content-design-provider-picker" role="group" aria-label={language === "ar" ? "تصميم يدوي بدون API" : "Manual design without API"}>
                  <details><summary>{language === "ar" ? "برومبت التصميم" : "Design prompt"}</summary><textarea readOnly rows={4} value={designPrompt} onFocus={(event) => event.currentTarget.select()} /></details>
                  {manualDesignSites.map(([site, url]) => (
                    <button key={site} type="button" className="secondary" disabled={!designPrompt.trim()} onClick={async () => {
                      window.open(url, "_blank", "noopener,noreferrer");
                      try {
                        await navigator.clipboard.writeText(designPrompt);
                        setDesignNotice(language === "ar" ? "تم نسخ برومبت التصميم." : "Design prompt copied.");
                      } catch {
                        setDesignNotice(language === "ar" ? "تعذر النسخ. افتح برومبت التصميم وحدد النص وانسخه يدويًا." : "Copy failed. Expand the design prompt, select the text and copy manually.");
                      }
                    }}>{language === "ar" ? "نسخ البرومبت وفتح " : "Copy prompt and open "}{site}</button>
                  ))}
                  <small>{language === "ar" ? "صمّم خارجيًا ثم اربط الأصل أو ارفعه بالخيارات الموجودة؛ تبقى الموافقات وأقفال النشر مطلوبة." : "Design externally, then link or upload using the existing controls; approval and publishing locks still apply."}</small>
                </div>}
                {designMethod === "upload" && canChangeMedia && (
                  <div className="content-media-source-selector" role="group" aria-label={language === "ar" ? "ربط أصل أو رفعه" : "Link or upload asset"}>
                    <div className="content-media-source-header">
                      <strong>{language === "ar" ? "📁 اختر من أصول المكتبة أو ارفع صورة" : "📁 Choose Library Asset or Upload"}</strong>
                      <small>{language === "ar" ? "لن نعيد استخدام تصميم قديم. ارفع تصميمًا جديدًا بعد إنشاء هذه المسودة ليظهر هنا." : "Old designs are not reused. Upload a new design after creating this draft to make it available here."}</small>
                    </div>
                    {selectableMediaAssets.length > 0 && (
                      <div className="content-media-library-picker">
                        <select
                          aria-label={language === "ar" ? "اختر من مكتبة الوسائط" : "Choose from library"}
                          value={selectedAssetByItem[item.id] ?? ""}
                          onChange={(e) => setSelectedAssetByItem((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          disabled={itemLocked || mediaActionBusyId === item.id}
                        >
                          <option value="">{language === "ar" ? "— اختر صورة/فيديو من المكتبة —" : "— Select asset from library —"}</option>
                          {selectableMediaAssets.map((asset) => {
                            const assetName = typeof asset.metadata?.file_name === "string" ? asset.metadata.file_name : typeof asset.metadata?.name === "string" ? asset.metadata.name : asset.id.slice(0, 8);
                            const ready = canUseInMarketingBatch(asset);
                            return (
                              <option key={asset.id} value={asset.id}>
                                {ready ? "✅ " : "⏳ "}{assetName} ({asset.category || asset.assetType})
                              </option>
                            );
                          })}
                        </select>
                        <button
                          type="button"
                          className="secondary"
                          disabled={itemLocked || mediaActionBusyId === item.id || !selectedAssetByItem[item.id]}
                          onClick={() => void handleLinkMedia(item, selectedAssetByItem[item.id])}
                        >
                          {mediaActionBusyId === item.id ? (language === "ar" ? "جاري الربط…" : "Linking…") : (language === "ar" ? "ربط هذا الأصل" : "Link asset")}
                        </button>
                      </div>
                    )}
                    {personPresence}
                    <label className="secondary-button-label">
                      <span>{mediaActionBusyId === item.id ? (language === "ar" ? "جاري الرفع للمكتبة…" : "Uploading…") : (language === "ar" ? "📤 رفع صورة/فيديو للمكتبة" : "📤 Upload to Media Library")}</span>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        className="sr-only"
                        disabled={itemLocked || Boolean(mediaActionBusyId) || !presenceByItem[item.id]}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleUploadMedia(item, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                )}
                {designMethod === "poster" && (
                  <div className="content-design-provider-picker">
                    {canChangeMedia && canWrite && personPresence}
                    <Suspense fallback={<p role="status">{language === "ar" ? "جارٍ تحميل استوديو البوستر…" : "Loading poster studio…"}</p>}>
                      <BrandedPosterStudio item={item} language={language} onClose={() => selectDesignMethod(item.id, "")}
                        onSaveDesign={session && canWrite && item.status !== "published" && presenceByItem[item.id] ? (file) => handleUploadMedia(item, file) : undefined} />
                    </Suspense>
                  </div>
                )}
                {designMethod === "automatic" && canChangeMedia && (
                  <div className="content-design-provider-picker" role="group" aria-label={language === "ar" ? "اختيار مزود التصميم" : "Design provider selection"}>
                    <label>
                      {language === "ar" ? "مزود التصميم" : "Design provider"}
                      <select
                        value={selectedDesignProvider(item)}
                        onChange={(event) => setDesignProviderByItem((current) => ({ ...current, [item.id]: event.target.value }))}
                        disabled={itemLocked || designBusyId === item.id}
                      >
                        {availableDesignProviders(item).map((provider) => (
                          <option key={provider.key} value={provider.key}>
                            {provider.label}{provider.available ? "" : language === "ar" ? " — غير متاح حاليًا" : " — unavailable"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <small>{language === "ar" ? "المقترح لهذا المنشور: " : "Suggested for this post: "}
                      <bdi>{availableDesignProviders(item).find((provider) => provider.key === recommendedDesignProvider(item))?.label}</bdi>
                    </small>
                    {canvaStatusNotice && <CanvaStatusNotice notice={canvaStatusNotice} language={language} />}
                    {designCapabilityState === "NOT_CONFIGURED" && onOpenConnections && (
                      <button
                        type="button"
                        className="secondary"
                        disabled={itemLocked || designBusyId === item.id}
                        onClick={onOpenConnections}
                        title={language === "ar" ? "افتح الاتصالات لربط Canva" : "Open Connections to connect Canva"}
                      >
                        {language === "ar" ? "ربط Canva" : "Connect Canva"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="secondary"
                      data-testid="generateDesignButton"
                      aria-label={item.mediaAssetId ? copy.regenerateDesignButton : copy.generateDesignButton}
                      disabled={itemLocked || designBusyId === item.id || (recommendedDesignProvider(item) === "canva" && designCapabilityState === "NOT_CONFIGURED")}
                      title={itemDisabledReason}
                      onClick={() => void handleGenerateDesign(item)}
                    >
                      {designBusyId === item.id
                        ? copy.generateDesignBusy
                        : language === "ar" ? "إنشاء التصميم" : "Create design"}
                    </button>
                  </div>
                )}
                {designMethod === "automatic" && canChangeMedia && /reel|video/i.test(String(item.contentType)) && (
                  <div className="content-design-provider-picker" role="group" aria-label={language === "ar" ? "إنشاء فيديو" : "Create video"}>
                    <strong>{language === "ar" ? "فيديو Reel" : "Reel video"}</strong>
                    <small>{language === "ar" ? "Veo · عمودي 9:16 · الصوت مدمج" : "Veo · 9:16 portrait · audio included"}</small>
                    {videoTargetId === item.id && (
                      <>
                        <label>
                          <span>{language === "ar" ? "المدة" : "Duration"}</span>
                          <select value={videoDuration} onChange={(event) => setVideoDuration(Number(event.target.value) as 4 | 6 | 8)} disabled={videoBusyId === item.id}>
                            <option value={4}>4s</option><option value={6}>6s</option><option value={8}>8s</option>
                          </select>
                        </label>
                        <label>
                          <span>{language === "ar" ? "الدقة" : "Resolution"}</span>
                          <select value={videoResolution} onChange={(event) => setVideoResolution(event.target.value as "720p" | "1080p")} disabled={videoBusyId === item.id}>
                            <option value="720p">720p</option>
                            <option value="1080p" disabled={videoDuration !== 8}>1080p</option>
                          </select>
                        </label>
                        {videoEstimate && <small role="status">{language === "ar" ? "التكلفة التقديرية: $" + videoEstimate.costUsd.toFixed(2) + " · " + videoDuration + " ث · " + videoResolution : "Estimated cost: $" + videoEstimate.costUsd.toFixed(2) + " · " + videoDuration + "s · " + videoResolution}</small>}
                        <button type="button" className="primary-button" disabled={itemLocked || videoBusyId === item.id || !videoEstimate} onClick={() => void handleGenerateVideo(item)}>
                          {videoBusyId === item.id ? (language === "ar" ? "جاري الإنشاء…" : "Generating…") : (language === "ar" ? "إنشاء الفيديو" : "Generate video")}
                        </button>
                      </>
                    )}
                    {videoTargetId !== item.id && (
                      <button type="button" className="secondary" disabled={itemLocked || videoBusyId === item.id} onClick={() => void openVideoCreator(item)}>
                        {language === "ar" ? "إنشاء فيديو" : "Create video"}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <footer>
                {canSetSchedule ? (
                  <label className="factory-schedule-field">{language === "ar" ? "موعد النشر" : "Publish time"}
                    <input type="datetime-local" value={formatLocalDateTimeInput(scheduledTime)} disabled={itemLocked || awaitingSchedule}
                      onChange={(event) => {
                        const value = event.target.value;
                        setScheduleTimes((current) => ({ ...current, [item.id]: { original: item.scheduledFor, value } }));
                      }} />
                  </label>
                ) : <p className="item-meta">{copy.scheduledFor}: {formatWhen(language, item.scheduledFor)}</p>}
                {canApproveStatus && canApproveByRole && (
                  <button type="button" disabled={itemLocked || awaitingSchedule || !futureTime || Boolean(mediaActionBusyId)} title={itemDisabledReason} onClick={() => confirmApproval(item)}>
                    {language === "ar" ? "اعتماد وجدولة" : "Approve and schedule"}
                  </button>
                )}
                {result && (result.ok ? <>
                  <p role="status">{language === "ar" ? "قُبل الطلب، جارٍ التحقق من الموعد" : "Request accepted, checking the schedule"}</p>
                  <button type="button" className="secondary" onClick={onRefreshStatus}>
                    {language === "ar" ? "تحديث الحالة" : "Refresh status"}
                  </button>
                </> : <p className="error-box" role="alert">{result.message}</p>)}
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
                {onEditItem && item.status !== "published" && (
                  <button
                    type="button"
                    className="secondary"
                    disabled={itemLocked}
                    title={itemDisabledReason}
                    onClick={() => { setEditTargetId(showingEditForm ? null : item.id); setChangeTargetId(null); }}
                  >
                    {showingEditForm ? (language === "ar" ? "إغلاق" : "Close") : (language === "ar" ? "تعديل" : "Edit")}
                  </button>
                )}
                {canShowPublishAction(item) && session && (
                  <>
                    <button
                      type="button"
                      className="primary-button"
                      disabled={itemLocked || publishBusyId === item.id || item.status === "failed" || !mediaReadyForPublish}
                      aria-describedby={item.status === "failed" ? `retry-approval-${item.id}` : undefined}
                      title={itemDisabledReason ?? (!mediaReadyForPublish ? (language === "ar" ? "الوسائط المرتبطة ليست جاهزة للنشر." : "Linked media is not publish-ready.") : undefined)}
                      onClick={() => void handleRequestPublish(item)}
                    >
                      {publishBusyId === item.id ? requestPublishCopy.busy : platformReceipt?.status.toLowerCase() === "failed" ? requestPublishCopy.retryButton : requestPublishCopy.button}
                    </button>
                    {item.status === "failed" && (
                      <small id={`retry-approval-${item.id}`} className="item-action-disabled-reason">{requestPublishCopy.retryNeedsApproval}</small>
                    )}
                  </>
                )}
                {item.status === "approved" && !mediaReadyForPublish && (
                  <small className="item-action-disabled-reason">
                    {language === "ar" ? "طلب النشر متوقف: اربط وسائط معتمدة ومؤكدة الموافقة أولًا." : "Publish request blocked: attach approved media with confirmed consent first."}
                  </small>
                )}
              </footer>
              {metaSetupItemId === item.id && (
                <div className="content-batch-design-notice">
                  <p role="alert">{publishEnqueueErrorMessage("META_NOT_CONFIGURED", language)}</p>
                  <button type="button" className="secondary" onClick={() => window.dispatchEvent(new CustomEvent("command-center:navigate", { detail: { section: "connections" } }))}>
                    {language === "ar" ? "فتح مركز الاتصالات" : "Open Connections Center"}
                  </button>
                </div>
              )}
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
              {showingEditForm && onEditItem && (
                <form
                  className="change-request-form factory-edit-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitEdit(item, event.currentTarget);
                  }}
                >
                  <label>{language === "ar" ? "طلب التصميم" : "Design request"}<textarea name="visualPrompt" defaultValue={String(item.visualPrompt ?? "")} maxLength={2000} rows={3} disabled={!canWrite || item.status === "published"} /></label>
                  <button type="submit" disabled={itemLocked}>{language === "ar" ? "حفظ" : "Save"}</button>
                </form>
              )}
            </article>
          );
        })}
      </div>}
    </section>
  );
}
