import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, Command, MessageCircle, Search, Sparkles, Users, Workflow } from "lucide-react";
import { useLanguage } from "./i18n";
import type { Language } from "./i18n";

type Session = { accessToken: string; role: string; displayName?: string };
type Summary = {
  generatedAt: string;
  leads: { total: number; customers: number; new: number; hot: number };
  conversations: { humanRequired: number };
  bookings: { total: number; pending: number; confirmed: number };
  content: { total: number; review: number; scheduled: number; published: number; failed: number };
  radar: { hot: number };
  automation: { failed: number; active: number };
  revenue: { invoiceCount: number; invoiceTotal: number; paidInvoiceTotal: number; orderCount: number; orderTotal: number };
  alerts?: Array<{ code: string; priority: string; count: number; message: string }>;
  attentionScore: number;
};

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const SUPABASE_PUBLIC_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

async function loadSummary(session: Session, signal: AbortSignal) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_staff_control_tower_summary`, {
    method: "POST",
    headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
    body: "{}",
    signal,
  });
  if (response.status === 401) throw new Error("SESSION_EXPIRED");
  if (response.status === 403) throw new Error("STAFF_ACCESS_DENIED");
  if (!response.ok) throw new Error(`RPC_FAILED_${response.status}`);
  return (await response.json()) as Summary;
}

function n(language: Language, value: number) {
  return new Intl.NumberFormat(language === "ar" ? "ar-AE" : "en-AE").format(value || 0);
}
function money(language: Language, value: number) {
  return new Intl.NumberFormat(language === "ar" ? "ar-AE" : "en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(value || 0);
}
function pct(language: Language, value: number) {
  return new Intl.NumberFormat(language === "ar" ? "ar-AE" : "en-AE", { style: "percent", maximumFractionDigits: 0 }).format(Math.max(0, Math.min(1, value)));
}
function go(section: string) {
  window.location.assign(`?section=${encodeURIComponent(section)}`);
}

const alertText: Record<string, [string, string]> = {
  human_required: ["محادثات تحتاج تدخلاً بشرياً", "Conversations need human attention"],
  pending_bookings: ["حجوزات معلقة", "Bookings are waiting for action"],
  content_review: ["محتوى ينتظر الموافقة", "Content is waiting for review"],
  hot_radar: ["فرص ساخنة تحتاج مراجعة", "Hot opportunities need review"],
  failed_jobs: ["مهام خلفية فاشلة", "Background jobs need attention"],
  failed_content: ["محتوى فاشل", "Failed content items"],
  new_leads: ["عملاء محتملون يحتاجون متابعة", "Leads need follow-up"],
};

export default function ControlTowerV2({ session, onSessionExpired }: { session: Session; onSessionExpired: () => void }) {
  const { language } = useLanguage();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [query, setQuery] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    loadSummary(session, controller.signal).then((result) => { setSummary(result); setStatus("ready"); }).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (error instanceof Error && error.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setStatus("error");
    });
    return () => controller.abort();
  }, [onSessionExpired, session]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen(true); }
      if (event.key === "Escape") setCommandOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const filteredAlerts = useMemo(() => {
    if (!summary) return [];
    const q = query.trim().toLocaleLowerCase("ar");
    return (summary.alerts ?? []).filter((item) => !q || `${item.code} ${item.message}`.toLocaleLowerCase("ar").includes(q));
  }, [query, summary]);

  if (status === "loading") return <div className="v2-loading"><Sparkles size={20} />{language === "ar" ? "جاري تشغيل مركز القيادة…" : "Starting Command Center…"}</div>;
  if (status === "error" || !summary) return <div className="error-box">{language === "ar" ? "تعذر تحميل مركز القيادة بأمان." : "Command Center could not be loaded safely."}</div>;

  const human = summary.conversations.humanRequired;
  const pending = summary.bookings.pending;
  const review = summary.content.review;
  const failed = summary.automation.failed + summary.content.failed;
  const healthy = failed === 0;
  const leadToBooking = summary.leads.total ? summary.bookings.total / summary.leads.total : 0;
  const collection = summary.revenue.invoiceTotal ? summary.revenue.paidInvoiceTotal / summary.revenue.invoiceTotal : 0;
  const actions = [
    human > 0 ? { icon: MessageCircle, count: human, label: language === "ar" ? "محادثات تحتاج ردًا بشريًا" : "conversations need human reply", section: "inbox" } : null,
    review > 0 ? { icon: Sparkles, count: review, label: language === "ar" ? "محتوى ينتظر الموافقة" : "content items waiting approval", section: "content" } : null,
    pending > 0 ? { icon: CalendarDays, count: pending, label: language === "ar" ? "طلبات حجز تحتاج تأكيدًا" : "booking requests need confirmation", section: "planner" } : null,
    failed > 0 ? { icon: Workflow, count: failed, label: language === "ar" ? "مؤشرات تشغيل تحتاج مراجعة" : "operational issues need review", section: "integrations" } : null,
  ].filter(Boolean) as Array<{ icon: typeof MessageCircle; count: number; label: string; section: string }>;

  const cards = [
    { icon: MessageCircle, label: language === "ar" ? "التواصل" : "Conversations", value: n(language, human), hint: `${n(language, human)} ${language === "ar" ? "تحتاج تدخلاً" : "need attention"}`, section: "inbox" },
    { icon: Users, label: language === "ar" ? "العملاء المحتملون" : "Leads", value: n(language, summary.leads.total), hint: `${n(language, summary.leads.hot)} ${language === "ar" ? "ساخنة" : "hot"}`, section: "crm" },
    { icon: CalendarDays, label: language === "ar" ? "الحجوزات" : "Bookings", value: n(language, summary.bookings.total), hint: `${n(language, summary.bookings.confirmed)} ${language === "ar" ? "مؤكدة" : "confirmed"}`, section: "planner" },
    { icon: CheckCircle2, label: language === "ar" ? "المحتوى المنشور" : "Published content", value: n(language, summary.content.published), hint: `${n(language, review)} ${language === "ar" ? "للمراجعة" : "in review"}`, section: "content" },
  ];

  const journey = [
    { label: language === "ar" ? "عملاء محتملون" : "Leads", value: summary.leads.total, hint: language === "ar" ? `${summary.leads.new} جديد · ${summary.leads.hot} ساخن` : `${summary.leads.new} new · ${summary.leads.hot} hot`, section: "crm" },
    { label: language === "ar" ? "تواصل يحتاج متابعة" : "Conversations", value: human, hint: language === "ar" ? "تدخل بشري" : "human attention", section: "inbox" },
    { label: language === "ar" ? "نية حجز" : "Booking intent", value: summary.bookings.pending, hint: language === "ar" ? "طلبات معلقة" : "pending requests", section: "planner" },
    { label: language === "ar" ? "حجوزات مؤكدة" : "Confirmed", value: summary.bookings.confirmed, hint: language === "ar" ? "تم التأكيد" : "confirmed", section: "planner" },
    { label: language === "ar" ? "عملاء" : "Customers", value: summary.leads.customers, hint: language === "ar" ? "تحولوا إلى عملاء" : "converted customers", section: "crm" },
  ];

  return <div className="v2-command-home" dir={language === "ar" ? "rtl" : "ltr"}>
    <header className="v2-topbar">
      <div><span className="v2-kicker">COMMAND CENTER V2</span><h2>{language === "ar" ? `صباح الخير${session.displayName ? `، ${session.displayName}` : ""}` : `Good morning${session.displayName ? `, ${session.displayName}` : ""}`}</h2></div>
      <div className="v2-top-actions"><button className="v2-search" type="button" onClick={() => setCommandOpen(true)}><Search size={17} />{language === "ar" ? "بحث أو أمر…" : "Search or Command…"}<kbd>⌘K</kbd></button><span className={`v2-system ${healthy ? "ok" : "warn"}`}><span />{healthy ? "SYSTEM OPERATIONAL" : "REVIEW REQUIRED"}</span></div>
    </header>

    <section className="v2-action-center">
      <div className="v2-section-head"><div><span>NEEDS YOUR ATTENTION</span><h3>{language === "ar" ? "ماذا يحتاج قرارك الآن؟" : "What needs your decision now?"}</h3></div><button type="button" onClick={() => setCommandOpen(true)}>{language === "ar" ? "مراجعة الكل" : "Review All"}<ArrowRight size={16} /></button></div>
      {actions.length === 0 ? <div className="v2-empty"><CheckCircle2 size={21} />{language === "ar" ? "لا توجد إجراءات عاجلة في اللقطة الحالية." : "No urgent actions in the current snapshot."}</div> : <div className="v2-action-grid">{actions.map((item) => { const Icon = item.icon; return <button type="button" className="v2-action-card" key={item.section} onClick={() => go(item.section)}><span className="v2-action-icon"><Icon size={20} /></span><strong>{n(language, item.count)}</strong><span>{item.label}</span><ArrowRight size={16} /></button>; })}</div>}
    </section>

    <section className="v2-pulse"><div className="v2-section-head"><div><span>BUSINESS PULSE</span><h3>{language === "ar" ? "نبض النشاط" : "Business pulse"}</h3></div></div><div className="v2-metric-grid">{cards.map(({ icon: Icon, label, value, hint, section }) => <button type="button" className="v2-metric" key={label} onClick={() => go(section)}><Icon size={19} /><span>{label}</span><strong>{value}</strong><small>{hint}</small></button>)}</div></section>

    <section className="v2-panel v2-customer-ops"><div className="v2-section-head"><div><span>CUSTOMER OPERATIONS</span><h3>{language === "ar" ? "رحلة العميل من الاهتمام إلى الحجز" : "Customer journey from interest to booking"}</h3><p className="v2-panel-note">{language === "ar" ? "مؤشرات تشغيلية موحدة — لا يوجد تنفيذ تلقائي من هذه الشاشة." : "Unified operational signals — this view never executes actions automatically."}</p></div><button type="button" onClick={() => go("crm")}>{language === "ar" ? "فتح مركز العملاء" : "Open customer center"}<ArrowRight size={16} /></button></div><div className="v2-journey">{journey.map((item, index) => <button type="button" className="v2-journey-step" key={item.label} onClick={() => go(item.section)}><span className="v2-journey-index">{index + 1}</span><strong>{n(language, item.value)}</strong><span>{item.label}</span><small>{item.hint}</small>{index < journey.length - 1 && <ArrowRight className="v2-journey-arrow" size={15} />}</button>)}</div></section>

    <div className="v2-two-col">
      <section className="v2-panel"><div className="v2-section-head"><div><span>AI ACTIVITY</span><h3>{language === "ar" ? "نشاط الذكاء الاصطناعي" : "AI activity"}</h3></div><span className="v2-live"><span />LIVE DATA</span></div><div className="v2-activity"><p><CheckCircle2 />{n(language, summary.content.published)} {language === "ar" ? "محتوى منشور" : "content items published"}</p><p><MessageCircle />{n(language, human)} {language === "ar" ? "محادثات للمراجعة البشرية" : "conversations for human review"}</p><p><Sparkles />{n(language, summary.radar.hot)} {language === "ar" ? "فرص ساخنة مكتشفة" : "hot opportunities detected"}</p><p><Workflow />{n(language, summary.automation.active)} {language === "ar" ? "أتمتات نشطة" : "active automations"}</p></div></section>
      <section className="v2-panel"><div className="v2-section-head"><div><span>TODAY</span><h3>{language === "ar" ? "الوصول السريع" : "Quick operating view"}</h3></div></div><div className="v2-quick-list"><button type="button" onClick={() => go("crm")}><Users />{language === "ar" ? "العملاء المحتملون" : "Open leads"}<ArrowRight /></button><button type="button" onClick={() => go("planner")}><CalendarDays />{language === "ar" ? "الحجوزات" : "Review bookings"}<ArrowRight /></button><button type="button" onClick={() => go("content")}><Sparkles />{language === "ar" ? "مصنع المحتوى" : "Content Factory"}<ArrowRight /></button><button type="button" onClick={() => go("automations")}><Workflow />{language === "ar" ? "الأتمتة" : "Automation health"}<ArrowRight /></button></div></section>
    </div>

    <section className="v2-panel"><div className="v2-section-head"><div><span>DECISION RADAR</span><h3>{language === "ar" ? "إشارات تحتاج انتباهك" : "Signals that may need attention"}</h3></div><div className="v2-search-inline"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={language === "ar" ? "ابحث داخل الإشارات…" : "Search signals…"} /></div></div>{filteredAlerts.length === 0 ? <div className="v2-empty">{language === "ar" ? "لا توجد إشارات مطابقة." : "No matching signals."}</div> : <div className="v2-alert-list">{filteredAlerts.slice(0, 6).map((alert) => { const label = alertText[alert.code]?.[language === "ar" ? 0 : 1] ?? alert.code; const target = alert.code.includes("content") ? "content" : alert.code.includes("booking") ? "planner" : alert.code.includes("human") ? "inbox" : alert.code.includes("job") ? "integrations" : "radar"; return <button type="button" key={alert.code} onClick={() => go(target)}><span className={`v2-priority ${alert.priority}`}><AlertTriangle size={15} /></span><div><strong>{n(language, alert.count)} · {label}</strong><small>{alert.message}</small></div><ArrowRight size={16} /></button>; })}</div>}</section>

    <section className="v2-bottom-strip"><div><span>OPERATING SYSTEM</span><strong>{language === "ar" ? "من الاهتمام إلى الحجز" : "From interest to booking"}</strong><small>{n(language, summary.leads.total)} leads → {n(language, summary.bookings.total)} bookings · {pct(language, leadToBooking)}</small></div><div><span>REVENUE</span><strong>{money(language, summary.revenue.paidInvoiceTotal)}</strong><small>{pct(language, collection)} {language === "ar" ? "تحصيل الفواتير" : "invoice collection"}</small></div><div><span>AUTOMATION</span><strong>{n(language, summary.automation.active)}</strong><small>{n(language, summary.automation.failed)} {language === "ar" ? "أخطاء" : "failures"}</small></div></section>

    {commandOpen && <div className="v2-command-backdrop" role="presentation" onMouseDown={() => setCommandOpen(false)}><section className="v2-command-modal" role="dialog" aria-modal="true" aria-label={language === "ar" ? "البحث والأوامر" : "Search and commands"} onMouseDown={(event) => event.stopPropagation()}><div className="v2-command-input"><Command size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={language === "ar" ? "ابحث أو اكتب أمرًا…" : "Search or type a command…"} /><kbd>ESC</kbd></div><div className="v2-command-results"><button type="button" onClick={() => go("inbox")}><MessageCircle />{language === "ar" ? "المحادثات التي تحتاج تدخلاً بشرياً" : "Conversations needing human attention"}<ArrowRight /></button><button type="button" onClick={() => go("content")}><Sparkles />{language === "ar" ? "المحتوى الذي يحتاج موافقتي" : "Content needing approval"}<ArrowRight /></button><button type="button" onClick={() => go("planner")}><CalendarDays />{language === "ar" ? "الحجوزات المعلقة" : "Pending bookings"}<ArrowRight /></button><button type="button" onClick={() => go("crm")}><Users />{language === "ar" ? "العملاء المحتملون" : "Leads"}<ArrowRight /></button><button type="button" onClick={() => go("radar")}><AlertTriangle />{language === "ar" ? "فرص جديدة في Opportunity Radar" : "New opportunities in Opportunity Radar"}<ArrowRight /></button></div></section></div>}
  </div>;
}
