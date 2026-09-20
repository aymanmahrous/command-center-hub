import { useEffect, useMemo, useState } from "react";
import { groupContentBatches, isDatabaseBatchId, selectPrimaryBatch, buildNextBatchReadyNotice, type ContentBatchItem } from "./content-batch";
import { COACH_AYMAN_PROVIDER_ID } from "./content-batch-generator";
import { attachMediaToCoachAymanBatch, buildCoachAyman30DayBatchWithMedia } from "./media-batch-link";
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
  onTabChange?: (tab: "overview" | "strategy" | "factory" | "content" | "designs" | "reels" | "campaigns" | "review" | "connections") => void;
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
  if (!response.ok) {
    const text = await response.text();
    if (text.includes("CONTENT_SLOT_ALREADY_PLANNED")) throw new Error("CONTENT_SLOT_ALREADY_PLANNED");
    throw new Error(`RPC_FAILED_${response.status}`);
  }
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
  onTabChange,
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
  const [activeFactoryTab, setActiveFactoryTab] = useState<"overview" | "strategy" | "factory" | "content" | "designs" | "reels" | "campaigns" | "review" | "connections">("overview");
  useEffect(() => {
    const targetId = activeFactoryTab === "content" ? "content-control-room" : ["designs", "reels", "campaigns", "review"].includes(activeFactoryTab) ? "content-review" : `content-${activeFactoryTab}`;
    requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [activeFactoryTab]);
  const showReviewWorkspace = ["designs", "reels", "campaigns", "review"].includes(activeFactoryTab);
  const factoryStages = [
    ["strategy", language === "ar" ? "الاستراتيجية" : "Strategy"],
    ["factory", language === "ar" ? "التوليد" : "Ideas / Generate"],
    ["content", language === "ar" ? "المحتوى" : "Content"],
    ["designs", language === "ar" ? "التصميم" : "Design"],
    ["review", language === "ar" ? "المراجعة" : "Review"],
    ["campaigns", language === "ar" ? "الجدولة" : "Schedule"],
    ["overview", language === "ar" ? "النشر والنتائج" : "Publish / Results"],
  ] as const;
  const planDays = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 30 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      const dayItems = items.filter((item) => {
        if (!item.scheduledFor) return false;
        const scheduled = new Date(item.scheduledFor);
        return scheduled.getFullYear() === day.getFullYear() && scheduled.getMonth() === day.getMonth() && scheduled.getDate() === day.getDate();
      });
      return { day, dayItems };
    });
  }, [items]);

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
      const mediaRaw = await callRpc(session, "get_staff_media_assets", {});
      const assets = parseMediaAssetRecords(mediaRaw);
      let saved: { success?: boolean; batchId?: string; code?: string } | null = null;

      for (let shiftDays = 0; shiftDays <= 45 && !saved; shiftDays += 1) {
        const start = new Date();
        start.setUTCDate(start.getUTCDate() + shiftDays);
        const batchNonce = shiftDays === 0 ? nonce : `${nonce}-${shiftDays}`;
        const items = await buildCoachAyman30DayBatchWithMedia(assets, start, batchNonce);

        try {
          saved = await callRpc(session, "create_staff_generated_content_batch", {
            p_items: items,
            p_provider_external_id: COACH_AYMAN_PROVIDER_ID,
          }) as { success?: boolean; batchId?: string; code?: string };
        } catch (cause) {
          const code = cause instanceof Error ? cause.message : "GENERATE_FAILED";
          if (code === "CONTENT_SLOT_ALREADY_PLANNED") continue;
          throw cause;
        }
      }

      if (!saved?.success || !saved.batchId) throw new Error(saved?.code ?? "GENERATE_FAILED");
      setGenerateNotice(copy.generateSuccess.replace("{batchId}", saved.batchId));
      setSelectedBatchId(saved.batchId);
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
    <div className="content-growth-hub" dir={language === "ar" ? "rtl" : "ltr"}>
      <nav className="content-section-nav" aria-label={language === "ar" ? "أقسام مصنع المحتوى" : "Content Factory sections"}>
        {([
          ["overview", language === "ar" ? "نظرة عامة" : "Overview"],
          ["strategy", language === "ar" ? "الاستراتيجية" : "Strategy"],
          ["factory", language === "ar" ? "التوليد" : "Generate"],
          ["content", language === "ar" ? "المحتوى" : "Content"],
          ["designs", language === "ar" ? "التصاميم" : "Designs"],
          ["reels", language === "ar" ? "الريلز" : "Reels"],
          ["campaigns", language === "ar" ? "الحملات" : "Campaigns"],
          ["review", language === "ar" ? "المراجعة" : "Review"],
          ["connections", language === "ar" ? "الاتصالات" : "Connections"],
        ] as const).map(([id, label]) => <button type="button" key={id} className={activeFactoryTab === id ? "active" : ""} onClick={() => { setActiveFactoryTab(id); onTabChange?.(id); }}>{label}</button>)}
      </nav>
      <section className="factory-control-room" aria-labelledby="factory-control-room-title">
        <div className="factory-control-room-heading">
          <div><span>{language === "ar" ? "مصنع واحد" : "ONE FACTORY"}</span><h2 id="factory-control-room-title">{language === "ar" ? "مسار الدعاية والنشر" : "Campaign and publishing flow"}</h2><p>{language === "ar" ? "افتح مرحلة واحدة، عدّل العنصر، ثم احفظ أو انقله للمرحلة التالية." : "Open one stage, edit the item, then save or move it to the next stage."}</p></div>
          <div className="factory-control-room-status"><strong>{selectedBatch ? selectedBatch.items.length : 0}</strong><span>{language === "ar" ? "عنصر في الدفعة" : "items in batch"}</span></div>
        </div>
        <div className="factory-stage-rail" role="list" aria-label={language === "ar" ? "مراحل المصنع" : "Factory stages"}>
          {factoryStages.map(([id, label], index) => <button type="button" role="listitem" key={id} className={activeFactoryTab === id ? "active" : ""} onClick={() => { setActiveFactoryTab(id); onTabChange?.(id); }}><b>{index + 1}</b><span>{label}</span></button>)}
        </div>
      </section>
      <section className="factory-30-day-plan" aria-labelledby="factory-30-day-title">
        <header><div><span>{language === "ar" ? "خطة 30 يومًا" : "30-DAY PLAN"}</span><h3 id="factory-30-day-title">{language === "ar" ? "افتح يومك بدل قراءة قائمة طويلة" : "Open a day instead of reading a long list"}</h3></div><small>{language === "ar" ? "العناصر المجدولة فقط — التعديل يتم داخل مساحة العمل الحالية." : "Scheduled items only — edits stay inside the existing workspace."}</small></header>
        <div className="factory-30-day-grid">
          {planDays.map(({ day, dayItems }, index) => <button type="button" key={day.toISOString()} className={dayItems.length > 0 ? "has-items" : ""} onClick={() => { setActiveFactoryTab(dayItems.length > 0 ? "campaigns" : "strategy"); onTabChange?.(dayItems.length > 0 ? "campaigns" : "strategy"); }}><span>{language === "ar" ? `اليوم ${index + 1}` : `Day ${index + 1}`}</span><strong>{dayItems.length}</strong><small>{day.toLocaleDateString(language === "ar" ? "ar-AE" : "en-AE", { month: "short", day: "numeric" })}</small>{dayItems.slice(0, 2).map((item) => <em key={item.id}>{item.topic}</em>)}</button>)}
        </div>
      </section>
      <section className="factory-action-desk" aria-label={language === "ar" ? "إجراءات مصنع المحتوى" : "Content Factory actions"}>
        <div className="factory-action-desk-heading"><div><span>{language === "ar" ? "ماذا تريد أن تفعل؟" : "WHAT DO YOU WANT TO DO?"}</span><h3>{language === "ar" ? "اختر خطوة واحدة بدل قراءة صفحة طويلة" : "Choose one task instead of reading a long page"}</h3></div><small>{language === "ar" ? "كل زر يفتح مساحة عمل مستقلة." : "Each button opens one focused workspace."}</small></div>
        <div className="factory-action-grid">
          {([
            ["strategy", language === "ar" ? "خطة التسويق" : "Marketing plan", language === "ar" ? "الأهداف والمنصات والأيام" : "Goals, platforms, and days"],
            ["factory", language === "ar" ? "إنشاء دفعة" : "Create batch", language === "ar" ? "أنشئ مقترحًا للمراجعة" : "Create a reviewable proposal"],
            ["content", language === "ar" ? "تحرير المحتوى" : "Edit content", language === "ar" ? "ابحث وعدّل واعتمد" : "Search, edit, and approve"],
            ["review", language === "ar" ? "مراجعة واعتماد" : "Review and approve", language === "ar" ? "اعتماد أو طلب تعديل" : "Approve or request changes"],
          ] as const).map(([id, label, detail]) => <button type="button" key={id} className={activeFactoryTab === id ? "active" : ""} onClick={() => { setActiveFactoryTab(id); onTabChange?.(id); }}><strong>{label}</strong><small>{detail}</small><span aria-hidden="true">→</span></button>)}
        </div>
      </section>
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

      {activeFactoryTab === "overview" && facebookAudit && (
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

      {activeFactoryTab === "overview" && <section id="content-overview" className="content-growth-section live-publish-section" aria-labelledby="live-publish-heading">
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
      </section>}

      {activeFactoryTab === "factory" && <section id="content-factory" className="content-growth-section" aria-labelledby="generate-batch-heading">
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
      </section>}

      {showReviewWorkspace && <section id="content-review" className="content-growth-section" aria-labelledby="content-pipeline-heading">
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
      </section>}

      {activeFactoryTab === "connections" && <section id="content-connections" className="content-growth-section" aria-labelledby="integration-status-heading">
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
      </section>}

      {activeFactoryTab === "strategy" && <section id="content-strategy" className="content-growth-section" aria-labelledby="strategy-mix-heading">
        <header>
          <p>{copy.strategyEyebrow}</p>
          <h3 id="strategy-mix-heading">{copy.strategyTitle}</h3>
        </header>
        <div className="factory-section-action-bar">
          <strong>{language === "ar" ? "الخطة جاهزة للتنفيذ" : "This plan is ready to use"}</strong>
          <span>{language === "ar" ? "لا تكتفِ بقراءة التوزيع: أنشئ دفعة أو افتح المحتوى الحالي للتعديل." : "Do not just read the mix: create a batch or open current content for editing."}</span>
          <div>
            <button type="button" className="primary-button" onClick={() => { setActiveFactoryTab("factory"); onTabChange?.("factory"); }}>{language === "ar" ? "إنشاء دفعة من الخطة" : "Create batch from plan"}</button>
            <button type="button" className="secondary" onClick={() => { setActiveFactoryTab("content"); onTabChange?.("content"); }}>{language === "ar" ? "فتح المحتوى للتعديل" : "Open content editor"}</button>
          </div>
        </div>
        <ul className="strategy-mix-list">
          {DEFAULT_BATCH_MIX.map((slot, index) => (
            <li key={`${slot.labelKey}-${index}`}>
              <strong>{copy.mixLabels[slot.labelKey as keyof typeof copy.mixLabels] ?? slot.labelKey}</strong>
              <span>{slot.platform.toUpperCase()} · {slot.contentType} · {copy.timeSlots[slot.timeSlot]}</span>
              <span>{PLATFORM_GUIDANCE[slot.platform].focus}</span>
            </li>
          ))}
        </ul>
      </section>}

      {activeFactoryTab === "strategy" && <section className="content-growth-section" aria-labelledby="insights-heading">
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
      </section>}

      {showReviewWorkspace && batches.length > 1 && (
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

      {showReviewWorkspace && selectedBatch && (
        <ContentBatchReviewPanel
          items={batchItems}
          batch={selectedBatch}
          canWrite={canWrite}
          busy={panelBusy}
          session={session}
          mediaAssets={mediaAssets}
          onMediaLinked={() => {
            void callRpc(session, "get_staff_media_assets", {})
              .then((raw) => setMediaAssets(parseMediaAssetRecords(raw)))
              .catch(() => undefined);
            onBatchCreated?.();
          }}
          onApproveItem={onApproveItem}
          onRequestChanges={onRequestChanges}
          onApproveAll={onApproveAll}
          onPublishRequested={onBatchCreated}
          onSessionExpired={onSessionExpired}
        />
      )}
    </div>
  );
}
