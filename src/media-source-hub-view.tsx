import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Image as ImageIcon, Search, ShieldCheck, Sparkles, Video } from "lucide-react";
import { openCommandCenterWorkspace } from "./command-center-workspace";
import { useLanguage } from "./i18n";
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

const DEMO_ITEMS: RemoteMediaItem[] = [
  { id: "demo-drive-pool", provider: "google_drive", name: "Pool training session.jpg", mimeType: "image/jpeg", webUrl: "https://drive.google.com/", folder: "Brand / Pool", consent: "needs_review" },
  { id: "demo-photos-coach", provider: "google_photos", name: "Coach lesson reel.mp4", mimeType: "video/mp4", webUrl: "https://photos.google.com/", folder: "Swim Fluent", consent: "blocked" },
  { id: "demo-dropbox-family", provider: "dropbox", name: "Family water confidence.jpg", mimeType: "image/jpeg", webUrl: "https://www.dropbox.com/", folder: "Campaign candidates", consent: "approved" },
  { id: "demo-onedrive-brand", provider: "onedrive", name: "Brand logo pack.png", mimeType: "image/png", webUrl: "https://onedrive.live.com/", folder: "Brand", consent: "approved" },
];

export default function MediaSourceHubView({ onOpenProvider }: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState<MediaProviderKey | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [objective, setObjective] = useState(ar ? "تعليم السباحة بثقة وأمان" : "Confident, safe swimming lessons");
  const [briefLanguage, setBriefLanguage] = useState<"ar" | "en">(language);
  const [copied, setCopied] = useState(false);
  const [enabledProviders, setEnabledProviders] = useState<MediaProviderKey[]>([]);
  const connections = useMemo(() => readProviderConnections(import.meta.env as unknown as Record<string, unknown>), []);
  const items = useMemo(() => filterRemoteMedia(DEMO_ITEMS, query, provider), [query, provider]);
  const selected = DEMO_ITEMS.find((item) => item.id === selectedId) ?? null;
  const brief = selected ? buildCreativeBrief(selected, briefLanguage, objective) : null;

  function toggleProvider(key: MediaProviderKey) {
    setEnabledProviders((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
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
      <div className="media-hub-banner-actions"><div className="media-hub-safe"><ShieldCheck size={18} /> {ar ? "خصوصية ومراجعة قبل النشر" : "Privacy + review before publish"}</div><button type="button" className="coach-brain-launch" onClick={() => openCommandCenterWorkspace(language)}><Sparkles size={16} /> {ar ? "فتح Coach Brain" : "Open Coach Brain"}</button></div>
    </div>

    <section className="provider-strip" aria-label={ar ? "مصادر الوسائط" : "Media sources"}>
      {connections.map((connection) => { const enabled = enabledProviders.includes(connection.key); return <div className={`provider-chip ${connection.configured ? "configured" : ""} ${enabled ? "enabled" : ""}`} key={connection.key}>
        <div className="provider-chip-top"><span>{connection.label}</span><small>{enabled ? (ar ? "مُشغّل" : "Enabled") : connection.configured ? (ar ? "جاهز للاتصال" : "OAuth ready") : (ar ? "أضف المفتاح" : "Add key")}</small></div>
        <div className="provider-chip-actions"><button type="button" onClick={() => toggleProvider(connection.key)}>{enabled ? (ar ? "فصل" : "Disconnect") : (ar ? "تشغيل" : "Enable")}</button><button type="button" className="provider-settings" onClick={() => onOpenProvider?.(connection.key)}>{ar ? "إعداد" : "Setup"}</button></div>
      </div>; })}
    </section>

    <div className="media-hub-grid">
      <section className="media-browser-panel">
        <div className="media-panel-heading"><div><p>{ar ? "المصادر الموحدة" : "Unified sources"}</p><h3>{ar ? "ابحث واختر صورة أو فيديو" : "Search and select an image or video"}</h3></div><span>{items.length} {ar ? "أصل" : "assets"}</span></div>
        <div className="media-hub-toolbar">
          <label className="media-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ar ? "ابحث بالاسم أو المجلد" : "Search by name or folder"} /></label>
          <select value={provider} onChange={(event) => setProvider(event.target.value as MediaProviderKey | "all")}><option value="all">{ar ? "كل المصادر" : "All sources"}</option>{(Object.keys(MEDIA_PROVIDER_LABELS) as MediaProviderKey[]).map((key) => <option key={key} value={key}>{MEDIA_PROVIDER_LABELS[key]}</option>)}</select>
        </div>
        <div className="remote-asset-list">
          {items.map((item) => { const selectable = canSelectForCreative(item); return <article key={item.id} className={`remote-asset ${selectedId === item.id ? "selected" : ""} ${!selectable ? "blocked" : ""}`}>
            <div className="remote-asset-icon">{item.mimeType.startsWith("video/") ? <Video size={22} /> : <ImageIcon size={22} />}</div>
            <div className="remote-asset-info"><strong>{item.name}</strong><span>{MEDIA_PROVIDER_LABELS[item.provider]} · {item.folder}</span><small className={`consent-${item.consent}`}>{item.consent === "approved" ? (ar ? "مصرح" : "Approved") : item.consent === "blocked" ? (ar ? "محظور حتى تأكيد الموافقة" : "Blocked until consent") : (ar ? "يحتاج مراجعة" : "Needs review")}</small></div>
            <div className="remote-asset-actions"><a href={item.webUrl} target="_blank" rel="noreferrer" aria-label={ar ? "فتح المصدر" : "Open source"}><ExternalLink size={16} /></a><button type="button" disabled={!selectable} onClick={() => setSelectedId(item.id)}>{selectedId === item.id ? <Check size={16} /> : ar ? "اختيار" : "Select"}</button></div>
          </article>; })}
        </div>
        <p className="media-source-note">{ar ? "العناصر التجريبية توضح تجربة الاستخدام. عند إضافة OAuth، ستستبدلها نتائج الملفات الحقيقية من المصدر المتصل." : "Demo items illustrate the workflow. Once OAuth is configured, real provider results replace them."}</p>
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
