import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Image as ImageIcon, Search, ShieldCheck, Sparkles, Video } from "lucide-react";
import { openCommandCenterWorkspace } from "./command-center-workspace";
import { useLanguage } from "./i18n";
import { connectGoogleDriveForMedia, fetchGoogleDriveMedia, isGoogleDriveMediaConfigured } from "./google-drive-media-source";
import {
  buildCreativeBrief,
  canSelectForCreative,
  CREATIVE_FORMAT_LABELS,
  filterRemoteMedia,
  MEDIA_PROVIDER_LABELS,
  readProviderConnections,
  type MediaProviderKey,
  type RemoteMediaItem,
} from "./media-source-hub";
import "./media-source-hub.css";

type Props = { onOpenProvider?: (provider: MediaProviderKey) => void };

export default function MediaSourceHubView({ onOpenProvider }: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState<MediaProviderKey | "all">("all");
  const [selected, setSelected] = useState<RemoteMediaItem | null>(null);
  const [objective, setObjective] = useState(ar ? "تعليم السباحة بثقة وأمان" : "Confident, safe swimming lessons");
  const [briefLanguage, setBriefLanguage] = useState<"ar" | "en">(language);
  const [copied, setCopied] = useState(false);
  const [driveToken, setDriveToken] = useState("");
  const [driveItems, setDriveItems] = useState<RemoteMediaItem[]>([]);
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveMessage, setDriveMessage] = useState("");
  const driveConfigured = isGoogleDriveMediaConfigured();
  const connections = useMemo(() => readProviderConnections(import.meta.env as unknown as Record<string, unknown>).map((connection) =>
    connection.key === "google_drive" ? { ...connection, connected: Boolean(driveToken) } : connection,
  ), [driveToken]);
  const items = useMemo(() => filterRemoteMedia(driveItems, query, provider), [driveItems, query, provider]);
  const brief = selected ? buildCreativeBrief(selected, briefLanguage, objective) : null;

  async function connectDrive() {
    setDriveBusy(true);
    setDriveMessage("");
    try {
      const token = await connectGoogleDriveForMedia();
      setDriveToken(token);
      setDriveItems(await fetchGoogleDriveMedia(token));
    } catch (cause) {
      setDriveMessage(cause instanceof Error ? cause.message : (ar ? "تعذر الاتصال بـ Google Drive." : "Could not connect to Google Drive."));
    } finally {
      setDriveBusy(false);
    }
  }

  async function refreshDrive() {
    if (!driveToken) return;
    setDriveBusy(true);
    setDriveMessage("");
    try {
      setDriveItems(await fetchGoogleDriveMedia(driveToken));
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith("DRIVE_HTTP_401")) setDriveToken("");
      setDriveMessage(cause instanceof Error ? cause.message : (ar ? "تعذر قراءة Google Drive." : "Could not read Google Drive."));
    } finally {
      setDriveBusy(false);
    }
  }

  async function copyBrief() {
    if (!brief) return;
    await navigator.clipboard?.writeText(JSON.stringify(brief, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return <div className="media-source-hub">
    <div className="media-hub-banner">
      <div>
        <p className="media-hub-kicker">{ar ? "مركز مصادر الوسائط ومصنع الإعلانات" : "MEDIA SOURCE HUB + CREATIVE FACTORY"}</p>
        <h2>{ar ? "اختر الأصل المناسب، ثم حوّله إلى حملة" : "Choose the right asset, then turn it into a campaign"}</h2>
        <p>{ar ? "هذه الواجهة هي طبقة التشغيل الموحدة. الاتصالات الحية تحتاج OAuth ولا تحفظ أي أسرار في المتصفح." : "This is the unified operating layer. Live connections require OAuth and never store secrets in the browser."}</p>
      </div>
      <div className="media-hub-banner-actions"><span className="demo-mode-badge">{ar ? "لا توجد نتائج وهمية" : "NO FABRICATED RESULTS"}</span><div className="media-hub-safe"><ShieldCheck size={18} /> {ar ? "خصوصية ومراجعة قبل النشر" : "Privacy + review before publish"}</div><button type="button" className="coach-brain-launch" onClick={() => openCommandCenterWorkspace(language)}><Sparkles size={16} /> {ar ? "فتح Coach Brain" : "Open Coach Brain"}</button></div>
    </div>

    <section className="provider-strip" aria-label={ar ? "مصادر الوسائط" : "Media sources"}>
      {connections.map((connection) => { return <div className={`provider-chip ${connection.configured ? "configured" : ""}`} key={connection.key}>
        <div className="provider-chip-top"><span>{connection.label}</span><small>{connection.configured ? (ar ? "الإعداد موجود · يلزم اتصال OAuth" : "Configuration present · OAuth connection required") : (ar ? "غير متصل · يحتاج إعداداً" : "Not connected · setup required")}</small></div>
        <div className="provider-chip-actions">{connection.key === "google_drive" && connection.configured ? <button type="button" className="provider-settings" onClick={() => void (driveToken ? refreshDrive() : connectDrive())} disabled={driveBusy}>{driveBusy ? (ar ? "جاري الاتصال…" : "Connecting…") : driveToken ? (ar ? "تحديث Drive" : "Refresh Drive") : (ar ? "اتصال Google Drive" : "Connect Google Drive")}</button> : <span className="provider-settings" title={connection.authScope}>{connection.configured ? (ar ? "اتصل من اللوحة المخصصة" : "Connect from the provider panel") : (ar ? "راجع متطلبات الإعداد" : "Review setup requirements")}</span>}</div>
      </div>; })}
    </section>

    <section className="media-connection-plan" aria-label={ar ? "خطة ربط السحابات" : "Cloud connection plan"}>
      <div className="media-panel-heading"><div><p>{ar ? "خطة الربط الآمن" : "SAFE CONNECTION PLAN"}</p><h3>{ar ? "ما الذي سيحدث عند ربط السحابة؟" : "What happens when a cloud is connected?"}</h3></div><ShieldCheck size={20} color="#86efac" /></div>
      <div className="media-plan-grid">
        <article><span className="media-plan-number">1</span><div><strong>{ar ? "اتصال بصلاحية قراءة فقط" : "Read-only connection"}</strong><p>{ar ? "لا حذف ولا نقل ولا نشر تلقائي." : "No deletion, moving, or automatic publishing."}</p></div></article>
        <article><span className="media-plan-number">2</span><div><strong>{ar ? "فهرسة الأسماء والمجلدات" : "Index names and folders"}</strong><p>{ar ? "تظهر الأصول الحقيقية فقط بعد موافقة الاتصال." : "Only real assets appear after connection approval."}</p></div></article>
        <article><span className="media-plan-number">3</span><div><strong>{ar ? "اقتراح الاستخدام ثم المراجعة" : "Suggest use, then review"}</strong><p>{ar ? "تصميم أو معلومة أو Reel — والمالك يقرر قبل أي استخدام." : "Design, information, or Reel — the owner decides before use."}</p></div></article>
      </div>
      <p className="media-plan-note">{driveToken ? (ar ? `Google Drive متصل — تم العثور على ${driveItems.length} صورة/فيديو حقيقي. كل أصل يبدأ بحالة «يحتاج مراجعة».` : `Google Drive connected — ${driveItems.length} real image/video assets found. Every asset starts as “Needs review”.`) : (ar ? "الحالة الحالية: Google Drive غير متصل. لن يتم عرض صور وهمية ولا يتم استهلاك خدمة ذكاء اصطناعي." : "Current state: Google Drive is not connected. No fabricated images are shown and no AI service is consumed.")}</p>{driveMessage && <p className="media-source-note" role="status">{driveMessage}</p>}
    </section>

    <div className="media-hub-grid">
      <section className="media-browser-panel">
        <div className="media-panel-heading"><div><p>{ar ? "المصادر الموحدة" : "Unified sources"}</p><h3>{ar ? "ابحث واختر صورة أو فيديو" : "Search and select an image or video"}</h3></div><span>{items.length} {ar ? "أصل" : "assets"}</span></div>
        <div className="media-hub-toolbar">
          <label className="media-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ar ? "ابحث بالاسم أو المجلد" : "Search by name or folder"} /></label>
          <select value={provider} onChange={(event) => setProvider(event.target.value as MediaProviderKey | "all")}><option value="all">{ar ? "كل المصادر" : "All sources"}</option>{(Object.keys(MEDIA_PROVIDER_LABELS) as MediaProviderKey[]).map((key) => <option key={key} value={key}>{MEDIA_PROVIDER_LABELS[key]}</option>)}</select>
        </div>
        <div className="remote-asset-list">
          {items.map((item) => { const selectable = canSelectForCreative(item); return <article key={item.id} className={`remote-asset ${selected?.id === item.id ? "selected" : ""} ${!selectable ? "blocked" : ""}`}>
            <div className="remote-asset-icon">{item.mimeType.startsWith("video/") ? <Video size={22} /> : <ImageIcon size={22} />}</div>
            <div className="remote-asset-info"><strong>{item.name}</strong><span>{MEDIA_PROVIDER_LABELS[item.provider]} · {item.folder}</span><small className={`consent-${item.consent}`}>{item.consent === "approved" ? (ar ? "مصرح" : "Approved") : item.consent === "blocked" ? (ar ? "محظور حتى تأكيد الموافقة" : "Blocked until consent") : (ar ? "يحتاج مراجعة" : "Needs review")}</small></div>
            <div className="remote-asset-actions"><a href={item.webUrl} target="_blank" rel="noreferrer" aria-label={ar ? "فتح المصدر" : "Open source"}><ExternalLink size={16} /></a><button type="button" disabled={!selectable} onClick={() => setSelected(item)}>{selected?.id === item.id ? <Check size={16} /> : ar ? "اختيار" : "Select"}</button></div>
          </article>; })}
        </div>
        <p className="media-source-note">{driveConfigured ? (driveToken ? (ar ? "الأصول مأخوذة مباشرة من Google Drive. لا يتم تنزيل الملفات أو تخزين رمز الوصول." : "Assets are read directly from Google Drive. Files are not downloaded and the access token is not persisted.") : (ar ? "اضغط اتصال Google Drive لعرض الصور والفيديو الحقيقية." : "Connect Google Drive to load real image and video assets.")) : (ar ? "Google Drive يحتاج إعداد Client ID ومجلد الأرشيف." : "Google Drive requires its Client ID and archive folder configuration.")}</p>
      </section>

      <section className="creative-factory-panel">
        <div className="media-panel-heading"><div><p>{ar ? "مصنع الإعلانات" : "Creative factory"}</p><h3>{ar ? "حوّل الأصل إلى موجز جاهز" : "Turn the asset into a ready brief"}</h3></div><Sparkles size={20} color="#00b4d8" /></div>
        {!selected && <div className="creative-empty"><Sparkles size={28} /><p>{ar ? "اختر صورة أو فيديو صالحًا من القائمة لبدء التوليد." : "Select an eligible image or video to start generation."}</p></div>}
        {selected && brief && <div className="creative-form">
          <div className="selected-source"><strong>{selected.name}</strong><span>{ar ? "تم اختيار المصدر" : "Source selected"}</span></div>
          <label>{ar ? "هدف الحملة" : "Campaign objective"}<textarea value={objective} onChange={(event) => setObjective(event.target.value)} rows={2} /></label>
          <label>{ar ? "لغة الإعلان" : "Ad language"}<select value={briefLanguage} onChange={(event) => setBriefLanguage(event.target.value as "ar" | "en")}><option value="ar">العربية</option><option value="en">English</option></select></label>
          <div className="brief-preview"><div><span>{ar ? "النص الأساسي" : "Primary text"}</span><p>{brief.primaryText}</p></div><div><span>{ar ? "العنوان" : "Headline"}</span><p>{brief.headline}</p></div><div><span>{ar ? "الدعوة للإجراء" : "Call to action"}</span><p>{brief.callToAction}</p></div></div>
          <div className="format-list"><span>{ar ? "المخرجات المقترحة" : "Suggested outputs"}</span>{brief.formats.map((format) => <b key={format}>{CREATIVE_FORMAT_LABELS[format]}</b>)}</div>
          <div className={`creative-approval approval-${brief.approval}`}><ShieldCheck size={16} />{brief.approval === "blocked" ? (ar ? "محظور حتى تأكيد الحقوق" : "Blocked until rights are confirmed") : (ar ? "جاهز لمراجعة المالك" : "Ready for owner review")}</div>
          <button type="button" className="copy-brief" onClick={() => void copyBrief()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? (ar ? "تم النسخ" : "Copied") : (ar ? "نسخ موجز الإعلان" : "Copy creative brief")}</button>
        </div>}
      </section>
    </div>
  </div>;
}
