import { useEffect, useState } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, CircleDollarSign, MessageCircle, Users, Workflow } from "lucide-react";
import { useLanguage } from "./i18n";
import type { Language } from "./i18n";

type Session = { accessToken: string; role: string };
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

function money(language: Language, value: number) {
  return new Intl.NumberFormat(language === "ar" ? "ar-AE" : "en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(value || 0);
}
function number(language: Language, value: number) {
  return new Intl.NumberFormat(language === "ar" ? "ar-AE" : "en-AE").format(value || 0);
}
function percent(language: Language, value: number) {
  return new Intl.NumberFormat(language === "ar" ? "ar-AE" : "en-AE", { style: "percent", maximumFractionDigits: 0 }).format(Math.max(0, Math.min(1, value)));
}

function alertLabel(language: Language, code: string) {
  const labels: Record<string, [string, string]> = {
    human_required: ["محادثات تحتاج تدخلًا بشريًا", "Conversations need human attention"],
    customer_at_risk: ["عملاء معرضون لفقدان الثقة", "Customers at risk of confusion"],
    new_customer: ["عملاء WhatsApp جدد", "New WhatsApp customers"],
    pending_bookings: ["حجوزات معلقة", "Bookings are waiting for action"],
    hot_radar: ["فرص ساخنة تحتاج مراجعة", "Hot opportunities need review"],
    content_review: ["محتوى ينتظر المراجعة", "Content is waiting for review"],
    failed_jobs: ["مهام خلفية فاشلة", "Background jobs have failed or are dead"],
    failed_content: ["محتوى فاشل", "Content items have failed"],
    new_leads: ["عملاء محتملون يحتاجون متابعة", "New or contacted leads need follow-up"],
  };
  return labels[code]?.[language === "ar" ? 0 : 1] ?? code;
}

export default function ControlTowerV2({ session, onSessionExpired }: { session: Session; onSessionExpired: () => void }) {
  const { language } = useLanguage();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    loadSummary(session, controller.signal).then((result) => { setSummary(result); setStatus("ready"); }).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (error instanceof Error && error.message === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setStatus("error");
    });
    return () => controller.abort();
  }, [onSessionExpired, session]);

  if (status === "loading") return <p className="muted">{language === "ar" ? "جاري تجهيز مركز القيادة..." : "Preparing control tower..."}</p>;
  if (status === "error" || !summary) return <div className="error-box">{language === "ar" ? "تعذر تحميل ملخص مركز القيادة بأمان." : "Control tower summary could not be loaded safely."}</div>;

  const attention = summary.attentionScore;
  const health = summary.automation.failed === 0 && summary.content.failed === 0;
  const leadToBooking = summary.leads.total > 0 ? summary.bookings.total / summary.leads.total : 0;
  const bookingToCustomer = summary.bookings.total > 0 ? summary.leads.customers / summary.bookings.total : 0;
  const invoiceCollection = summary.revenue.invoiceTotal > 0 ? summary.revenue.paidInvoiceTotal / summary.revenue.invoiceTotal : 0;
  const alerts = [...(summary.alerts ?? [])].sort((a, b) => (a.priority === "critical" ? 0 : a.priority === "high" ? 1 : a.priority === "medium" ? 2 : 3) - (b.priority === "critical" ? 0 : b.priority === "high" ? 1 : b.priority === "medium" ? 2 : 3));
  const cards = [
    { icon: Users, label: language === "ar" ? "العملاء المحتملون" : "Leads", value: number(language, summary.leads.total), hint: `${number(language, summary.leads.new)} ${language === "ar" ? "جديدة" : "new"}` },
    { icon: CalendarDays, label: language === "ar" ? "الحجوزات" : "Bookings", value: number(language, summary.bookings.total), hint: `${number(language, summary.bookings.confirmed)} ${language === "ar" ? "مؤكدة" : "confirmed"}` },
    { icon: CircleDollarSign, label: language === "ar" ? "الإيراد المحصل" : "Collected revenue", value: money(language, summary.revenue.paidInvoiceTotal), hint: `${number(language, summary.revenue.invoiceCount)} ${language === "ar" ? "فواتير" : "invoices"}` },
    { icon: MessageCircle, label: language === "ar" ? "تدخل بشري" : "Human attention", value: number(language, summary.conversations.humanRequired), hint: language === "ar" ? "محادثات تحتاج تدخلًا" : "conversations requiring action" },
    { icon: CheckCircle2, label: language === "ar" ? "المحتوى المنشور" : "Published content", value: number(language, summary.content.published), hint: `${number(language, summary.content.review)} ${language === "ar" ? "للمراجعة" : "in review"}` },
    { icon: Workflow, label: language === "ar" ? "الأتمتة النشطة" : "Active automation", value: number(language, summary.automation.active), hint: `${number(language, summary.automation.failed)} ${language === "ar" ? "أخطاء" : "failures"}` },
  ];

  return <div className="today-operations">
    <div className="operations-boundary">
      <div><strong>{language === "ar" ? "🎯 مركز القيادة التنفيذي" : "🎯 Executive Control Tower"}</strong><p>{language === "ar" ? "صورة موحدة للعملاء والحجوزات والمحتوى والإيرادات وصحة التشغيل." : "One view across leads, bookings, content, revenue, and operational health."}</p></div>
      <span>{new Date(summary.generatedAt).toLocaleString(language === "ar" ? "ar-AE" : "en-AE")}</span>
    </div>

    {alerts.length > 0 && (
      <section className="today-section" aria-labelledby="control-alerts-heading">
        <header><p>{language === "ar" ? "إجراءات مطلوبة" : "Action required"}</p><h3 id="control-alerts-heading">{language === "ar" ? "مركز التنبيهات" : "Alert center"}</h3></header>
        <div className="operations-summary today-numbers">
          {alerts.map((alert) => (
            <div className={`summary-alert ${alert.priority === "critical" ? "danger" : alert.priority === "high" ? "warning" : ""}`} key={alert.code}>
              <AlertTriangle size={20} aria-hidden="true" />
              <span>{alertLabel(language, alert.code)}</span>
              <strong>{number(language, alert.count)}</strong>
              <small>{alert.message}</small>
            </div>
          ))}
        </div>
      </section>
    )}

    <section className="today-section">
      <header><p>{language === "ar" ? "نبض المشروع" : "Business pulse"}</p><h3>{language === "ar" ? "الصورة الكبيرة" : "The big picture"}</h3></header>
      <div className="operations-summary today-numbers">
        {cards.map(({ icon: Icon, label, value, hint }) => <div className="summary-alert" key={label}><Icon size={20} aria-hidden="true" /><span>{label}</span><strong>{value}</strong><small>{hint}</small></div>)}
      </div>
    </section>

    <section className="today-section">
      <header><p>{language === "ar" ? "رحلة العميل" : "Customer journey"}</p><h3>{language === "ar" ? "من الاهتمام إلى العميل" : "From interest to customer"}</h3></header>
      <div className="operations-summary today-numbers">
        <div className="summary-alert"><span>{language === "ar" ? "عملاء محتملون" : "Leads"}</span><strong>{number(language, summary.leads.total)}</strong><small>{number(language, summary.leads.hot)} {language === "ar" ? "ساخنة" : "hot"}</small></div>
        <div className="summary-alert"><span>{language === "ar" ? "حجوزات" : "Bookings"}</span><strong>{number(language, summary.bookings.total)}</strong><small>{percent(language, leadToBooking)} {language === "ar" ? "من العملاء المحتملين" : "of leads"}</small></div>
        <div className="summary-alert"><span>{language === "ar" ? "عملاء" : "Customers"}</span><strong>{number(language, summary.leads.customers)}</strong><small>{percent(language, bookingToCustomer)} {language === "ar" ? "من الحجوزات" : "of bookings"}</small></div>
        <div className="summary-alert"><span>{language === "ar" ? "تحصيل الفواتير" : "Invoice collection"}</span><strong>{percent(language, invoiceCollection)}</strong><small>{money(language, summary.revenue.paidInvoiceTotal)} / {money(language, summary.revenue.invoiceTotal)}</small></div>
      </div>
    </section>

    <section className="today-section">
      <header><p>{language === "ar" ? "الإيرادات" : "Revenue"}</p><h3>{language === "ar" ? "مركز الإيرادات" : "Revenue center"}</h3></header>
      <div className="operations-summary today-numbers">
        <div className="summary-alert"><span>{language === "ar" ? "إجمالي الفواتير" : "Invoice value"}</span><strong>{money(language, summary.revenue.invoiceTotal)}</strong><small>{number(language, summary.revenue.invoiceCount)} {language === "ar" ? "فواتير" : "invoices"}</small></div>
        <div className="summary-alert"><span>{language === "ar" ? "المحصل" : "Collected"}</span><strong>{money(language, summary.revenue.paidInvoiceTotal)}</strong><small>{percent(language, invoiceCollection)} {language === "ar" ? "معدل التحصيل" : "collection rate"}</small></div>
        <div className="summary-alert"><span>{language === "ar" ? "الطلبات" : "Orders"}</span><strong>{number(language, summary.revenue.orderCount)}</strong><small>{money(language, summary.revenue.orderTotal)}</small></div>
      </div>
    </section>

    <section className="today-section">
      <header><p>{language === "ar" ? "ما يحتاج قرارًا" : "Decision queue"}</p><h3>{language === "ar" ? "مؤشرات الانتباه" : "Attention indicators"}</h3></header>
      <div className="operations-summary today-numbers">
        <div className={attention > 0 ? "summary-alert warning" : "summary-alert"}><AlertTriangle size={20} aria-hidden="true" /><span>{language === "ar" ? "إجمالي عناصر الانتباه" : "Attention score"}</span><strong>{number(language, attention)}</strong><small>{language === "ar" ? "لا يعني أن كل عنصر خطأ" : "Not every item is an error"}</small></div>
        <div className={summary.radar.hot > 0 ? "summary-alert warning" : "summary-alert"}><span>{language === "ar" ? "فرص ساخنة" : "Hot opportunities"}</span><strong>{number(language, summary.radar.hot)}</strong></div>
        <div className={summary.bookings.pending > 0 ? "summary-alert warning" : "summary-alert"}><span>{language === "ar" ? "حجوزات معلقة" : "Pending bookings"}</span><strong>{number(language, summary.bookings.pending)}</strong></div>
        <div className={summary.content.failed > 0 ? "summary-alert danger" : "summary-alert"}><span>{language === "ar" ? "محتوى فاشل" : "Failed content"}</span><strong>{number(language, summary.content.failed)}</strong></div>
      </div>
    </section>

    <section className="today-section">
      <header><p>{language === "ar" ? "صحة المركز" : "Control health"}</p><h3>{health ? (language === "ar" ? "النظام مستقر" : "System stable") : (language === "ar" ? "يحتاج مراجعة" : "Review required")}</h3></header>
      <p className={health ? "operation-success" : "operation-warning"}>{health ? (language === "ar" ? "لا توجد أخطاء محتوى أو مهام خلفية فاشلة في اللقطة الحالية." : "No failed content or background jobs in the current snapshot.") : (language === "ar" ? "توجد أخطاء تشغيلية يجب مراجعتها قبل اعتبار المركز مستقرًا." : "Operational errors need review before the center can be considered stable.")}</p>
    </section>
  </div>;
}
