import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BarChart3, Bot, CalendarDays, ContactRound, Inbox, LayoutDashboard, Library, LogOut, Settings2, ShieldAlert, Workflow } from "lucide-react";
import { z } from "zod";
import "./styles.css";
import "./ai-inbox.css";

const sections = [
  ["dashboard", "Command Center", LayoutDashboard, "get_staff_command_center"],
  ["inbox", "AI Inbox", Inbox, "get_staff_inbox"],
  ["crm", "CRM", ContactRound, "get_staff_crm_leads"],
  ["automations", "Automations", Workflow, "get_staff_content_automation_status"],
  ["content", "AI Content Studio", Bot, "get_staff_content_items"],
  ["planner", "30-Day Planner", CalendarDays, "get_staff_bookings"],
  ["media", "Media Library", Library, "get_staff_media_assets"],
  ["analytics", "Analytics", BarChart3, "get_staff_growth_analytics"],
  ["integrations", "Integrations", Settings2, "get_staff_operations_queue"],
] as const;

type SectionId = (typeof sections)[number][0];
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type Role = "super_admin" | "admin" | "reception" | "coach" | "content_manager";
type Session = { accessToken: string; displayName: string; role: Role };
type BookingStatus = "pending" | "contacted" | "confirmed" | "declined" | "cancelled";
type LeadStage = "new" | "contacted" | "qualified" | "booking_intent" | "booked" | "follow_up" | "lost" | "customer";
type ConversationMode = "ai_active" | "human_required" | "human_takeover" | "paused";

const ProfileSchema = z.object({ display_name: z.string().min(1), role: z.enum(["super_admin", "admin", "reception", "coach", "content_manager"]), active: z.literal(true) });
const BookingSchema = z.object({
  id: z.string().uuid(), full_name: z.string(), phone: z.string().nullable().optional(), normalized_phone: z.string().nullable().optional(),
  category: z.string().nullable().optional(), location: z.string().nullable().optional(), training_type: z.string().nullable().optional(),
  requested_date: z.string().nullable().optional(), requested_time: z.string().nullable().optional(),
  status: z.enum(["pending", "contacted", "confirmed", "declined", "cancelled"]), created_at: z.string(),
}).passthrough();
const LeadSchema = z.object({
  id: z.string().uuid(), name: z.string(), phone: z.string().nullable().optional(), channel: z.string().nullable().optional(),
  stage: z.enum(["new", "contacted", "qualified", "booking_intent", "booked", "follow_up", "lost", "customer"]),
  score: z.number().nullable().optional(), language: z.string().nullable().optional(), intent: z.string().nullable().optional(),
  fearOfWater: z.boolean().nullable().optional(), lastActivityAt: z.string().nullable().optional(), nextFollowUpAt: z.string().nullable().optional(),
  humanRequired: z.boolean(), doNotContact: z.boolean(),
}).passthrough();
const BookingUpdateSchema = z.object({ success: z.boolean(), code: z.string().optional(), bookingRequestId: z.string().uuid().optional(), status: z.enum(["pending", "contacted", "confirmed", "declined", "cancelled"]).optional() });
const LeadUpdateSchema = z.object({
  success: z.boolean(), code: z.string().optional(), leadId: z.string().uuid().optional(),
  stage: z.enum(["new", "contacted", "qualified", "booking_intent", "booked", "follow_up", "lost", "customer"]).optional(),
  humanRequired: z.boolean().optional(), doNotContact: z.boolean().optional(), nextFollowUpAt: z.string().nullable().optional(),
  followUpAttempt: z.number().nullable().optional(), updatedAt: z.string().optional(),
});
const ConversationSchema = z.object({
  id: z.string().uuid(), leadId: z.string().uuid(), leadName: z.string(),
  channel: z.enum(["instagram", "facebook", "whatsapp", "website"]),
  mode: z.enum(["ai_active", "human_required", "human_takeover", "paused"]),
  unread: z.number().int().nonnegative(), lastMessage: z.string(), updatedAt: z.string(),
  leadScore: z.number().int(), intent: z.string(), humanRequired: z.boolean(),
}).passthrough();
const MessageSchema = z.object({
  id: z.string().uuid(), conversationId: z.string().uuid(), direction: z.string(),
  authorType: z.string(), body: z.string(), safetyClassification: z.string().nullable().optional(),
  createdAt: z.string(),
}).passthrough();
const ConversationModeUpdateSchema = z.object({
  success: z.boolean(), code: z.string().optional(), conversationId: z.string().uuid().optional(),
  mode: z.enum(["ai_active", "human_required", "human_takeover", "paused"]).optional(),
});

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();
const STAFF_TABLE = (import.meta.env.VITE_STAFF_PROFILE_TABLE ?? "staff_profiles").trim();

function configurationReady() {
  try {
    const url = new URL(SUPABASE_URL);
    return url.protocol === "https:" && url.hostname.endsWith(".supabase.co") && SUPABASE_ANON_KEY.length > 20 && STAFF_TABLE.length > 0;
  } catch { return false; }
}
function rpcHeaders(session: Session) { return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json", Accept: "application/json" }; }

async function signIn(email: string, password: string): Promise<Session> {
  if (!configurationReady()) throw new Error("CONFIGURATION_REQUIRED");
  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY }, body: JSON.stringify({ email, password }) });
  if (!authResponse.ok) throw new Error("INVALID_LOGIN");
  const auth = z.object({ access_token: z.string(), user: z.object({ id: z.string().uuid() }) }).parse(await authResponse.json());
  const profileResponse = await fetch(`${SUPABASE_URL}/rest/v1/${encodeURIComponent(STAFF_TABLE)}?id=eq.${encodeURIComponent(auth.user.id)}&select=display_name,role,active&limit=1`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${auth.access_token}`, Accept: "application/json" } });
  if (!profileResponse.ok) throw new Error("PROFILE_CHECK_FAILED");
  const rows = z.array(ProfileSchema).parse(await profileResponse.json());
  if (rows.length !== 1) throw new Error("STAFF_ACCESS_DENIED");
  return { accessToken: auth.access_token, displayName: rows[0].display_name, role: rows[0].role };
}

async function callRpc(session: Session, rpcName: string, body: Record<string, unknown> = {}): Promise<JsonValue> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${encodeURIComponent(rpcName)}`, { method: "POST", headers: rpcHeaders(session), body: JSON.stringify(body) });
  if (response.status === 401) throw new Error("SESSION_EXPIRED");
  if (response.status === 403) throw new Error("STAFF_ACCESS_DENIED");
  if (!response.ok) throw new Error(`RPC_FAILED_${response.status}`);
  return (await response.json()) as JsonValue;
}

async function updateBookingStatus(session: Session, bookingId: string, status: BookingStatus) {
  const result = BookingUpdateSchema.parse(await callRpc(session, "update_booking_request_status", { p_booking_request_id: bookingId, p_status: status }));
  if (!result.success) throw new Error(result.code ?? "UPDATE_REJECTED");
  return result;
}

async function updateLeadWorkflow(session: Session, leadId: string, stage: LeadStage, humanRequired: boolean, doNotContact: boolean, nextFollowUpAt: string | null) {
  const result = LeadUpdateSchema.parse(await callRpc(session, "update_staff_lead_workflow", {
    p_lead_id: leadId, p_stage: stage, p_human_required: humanRequired, p_do_not_contact: doNotContact, p_next_follow_up_at: nextFollowUpAt,
  }));
  if (!result.success) throw new Error(result.code ?? "UPDATE_REJECTED");
  return result;
}

async function getConversationMessages(session: Session, conversationId: string) {
  return z.array(MessageSchema).parse(await callRpc(session, "get_staff_conversation_messages", { p_conversation_id: conversationId }));
}

async function setConversationMode(session: Session, conversationId: string, mode: ConversationMode) {
  const result = ConversationModeUpdateSchema.parse(await callRpc(session, "set_staff_conversation_mode", {
    p_conversation_id: conversationId, p_mode: mode,
  }));
  if (!result.success) throw new Error(result.code ?? "UPDATE_REJECTED");
  return result;
}

function Login({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { const session = await signIn(email.trim(), password); sessionStorage.setItem("relaxfix-command-session", JSON.stringify(session)); onAuthenticated(session); } catch (cause) { const code = cause instanceof Error ? cause.message : "LOGIN_FAILED"; setError(code === "CONFIGURATION_REQUIRED" ? "إعدادات الاتصال غير مكتملة. التطبيق مغلق بأمان." : "تعذر تسجيل الدخول أو أن الحساب غير مخول."); } finally { setBusy(false); } }
  return <main className="login-page"><section className="login-card"><div className="brand-mark"><ShieldAlert size={28} /></div><p className="eyebrow">RELAX FIX UAE</p><h1>Command Center Hub</h1><p className="muted">منصة العمليات الداخلية. الدخول للموظفين النشطين فقط.</p><form onSubmit={submit}><label>البريد الإلكتروني<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>كلمة المرور<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>{error && <div className="error-box">{error}</div>}<button disabled={busy}>{busy ? "جاري التحقق..." : "تسجيل الدخول"}</button></form><p className="security-note">لا يتم تخزين كلمة المرور. الجلسة تبقى في هذه النافذة فقط.</p></section></main>;
}

function DataView({ value }: { value: JsonValue }) {
  if (Array.isArray(value)) { if (value.length === 0) return <p className="muted">لا توجد بيانات متاحة حاليًا.</p>; return <div className="data-grid">{value.map((item, index) => <article className="data-card" key={index}><DataView value={item} /></article>)}</div>; }
  if (value && typeof value === "object") return <dl className="record">{Object.entries(value).map(([key, item]) => <React.Fragment key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{typeof item === "object" && item !== null ? <DataView value={item} /> : String(item ?? "—")}</dd></React.Fragment>)}</dl>;
  return <span>{String(value ?? "—")}</span>;
}

const conversationModeLabels: Record<ConversationMode, string> = {
  ai_active: "الذكاء الاصطناعي نشط",
  human_required: "مراجعة بشرية مطلوبة",
  human_takeover: "استلام بشري",
  paused: "متوقفة مؤقتًا",
};

function AIInboxView({ value, session, onChanged, onSessionExpired }: { value: JsonValue; session: Session; onChanged: () => void; onSessionExpired: () => void }) {
  const parsed = useMemo(() => z.array(ConversationSchema).safeParse(value), [value]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<z.infer<typeof MessageSchema>[]>([]);
  const [messageStatus, setMessageStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const canWrite = ["super_admin", "admin", "reception", "coach"].includes(session.role);
  const conversations = parsed.success ? parsed.data : [];
  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null;

  useEffect(() => {
    if (!parsed.success) return;
    if (!selectedId && conversations[0]) setSelectedId(conversations[0].id);
    if (selectedId && !conversations.some((conversation) => conversation.id === selectedId)) setSelectedId(conversations[0]?.id ?? null);
  }, [conversations, parsed.success, selectedId]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedId) { setMessages([]); setMessageStatus("idle"); return; }
    setMessageStatus("loading"); setMessages([]);
    getConversationMessages(session, selectedId).then((result) => {
      if (!cancelled) { setMessages(result); setMessageStatus("ready"); }
    }).catch((cause) => {
      if (cancelled) return;
      const code = cause instanceof Error ? cause.message : "LOAD_FAILED";
      if (code === "SESSION_EXPIRED") onSessionExpired();
      else setMessageStatus("error");
    });
    return () => { cancelled = true; };
  }, [onSessionExpired, selectedId, session]);

  if (!parsed.success) return <div className="error-box">صيغة بيانات AI Inbox غير متوافقة؛ لم يتم تنفيذ أي كتابة.</div>;
  if (conversations.length === 0) return <p className="muted">لا توجد محادثات حاليًا.</p>;

  async function changeMode(conversation: z.infer<typeof ConversationSchema>, next: ConversationMode) {
    if (!canWrite || busyId || conversation.mode === next) return;
    if (!window.confirm(`تأكيد تغيير وضع محادثة ${conversation.leadName} من «${conversationModeLabels[conversation.mode]}» إلى «${conversationModeLabels[next]}»؟ سيتم تسجيل العملية في Audit Log.`)) return;
    setBusyId(conversation.id); setNotice("");
    try {
      await setConversationMode(session, conversation.id, next);
      setNotice("تم تحديث وضع المحادثة وتسجيل العملية بنجاح.");
      onChanged();
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "UPDATE_FAILED";
      const messagesByCode: Record<string, string> = {
        INVALID_MODE: "وضع المحادثة المطلوب غير مسموح.",
        NOT_FOUND: "المحادثة لم تعد موجودة.",
        STAFF_ACCESS_DENIED: "ليست لديك صلاحية تنفيذ هذا التغيير.",
      };
      if (code === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setNotice(messagesByCode[code] ?? "تعذر التحديث بأمان؛ لم يتم اعتماد أي تغيير غير مؤكد.");
    } finally { setBusyId(null); }
  }

  return <>
    <div className="write-banner"><strong>تحكم مضبوظ في المحادثات</strong><span>RPC فقط · RBAC + تأكيد + منع التكرار + Audit Log</span></div>
    {notice && <div className="notice-box">{notice}</div>}
    <div className="inbox-layout">
      <div className="conversation-list" aria-label="قائمة المحادثات">
        {conversations.map((conversation) => <button type="button" key={conversation.id} className={selectedId === conversation.id ? "selected" : ""} onClick={() => { setSelectedId(conversation.id); setNotice(""); }}>
          <span><strong>{conversation.leadName}</strong>{conversation.unread > 0 && <b className="unread-count">{conversation.unread}</b>}</span>
          <small>{conversation.lastMessage || "لا توجد رسائل"}</small>
          <em>{conversation.channel} · {conversationModeLabels[conversation.mode]}</em>
        </button>)}
      </div>
      <section className="conversation-panel">
        <header>
          <div><h3>{selected?.leadName ?? "اختر محادثة"}</h3>{selected && <p>Score {selected.leadScore}/100 · {selected.intent}</p>}</div>
          {selected && <label>وضع المحادثة<select value={selected.mode} disabled={!canWrite || busyId !== null} onChange={(event) => void changeMode(selected, event.target.value as ConversationMode)}>{(Object.keys(conversationModeLabels) as ConversationMode[]).map((mode) => <option key={mode} value={mode}>{conversationModeLabels[mode]}</option>)}</select></label>}
        </header>
        {selected?.humanRequired && <div className="human-alert">تتطلب هذه المحادثة مراجعة بشرية حاليًا.</div>}
        <div className="message-stream">
          {messageStatus === "loading" && <p className="muted">جاري تحميل الرسائل بأمان...</p>}
          {messageStatus === "error" && <div className="error-box">تعذر تحميل الرسائل بأمان.</div>}
          {messageStatus === "ready" && messages.length === 0 && <p className="muted">لا توجد رسائل في هذه المحادثة.</p>}
          {messages.map((message) => <article key={message.id} className={`message-bubble ${message.direction === "outbound" ? "outbound" : "inbound"}`}>
            <p>{message.body}</p><small>{message.authorType}{message.safetyClassification ? ` · ${message.safetyClassification}` : ""} · {new Date(message.createdAt).toLocaleString("ar-AE")}</small>
          </article>)}
        </div>
        {!canWrite && <p className="read-only-note">دورك يملك صلاحية القراءة فقط؛ التحكم في وضع المحادثة معطل.</p>}
        {busyId === selected?.id && <p className="muted">جاري حفظ التغيير المراجع...</p>}
      </section>
    </div>
  </>;
}

function CRMView({ value, session, onChanged }: { value: JsonValue; session: Session; onChanged: () => void }) {
  const parsed = z.array(LeadSchema).safeParse(value);
  const [busyId, setBusyId] = useState<string | null>(null); const [notice, setNotice] = useState("");
  const canWrite = ["super_admin", "admin", "reception", "coach"].includes(session.role);
  if (!parsed.success) return <div className="error-box">صيغة بيانات CRM غير متوافقة؛ لم يتم تنفيذ أي كتابة.</div>;
  if (parsed.data.length === 0) return <p className="muted">لا توجد عملاء محتملون حاليًا.</p>;
  async function save(lead: z.infer<typeof LeadSchema>, form: HTMLFormElement) {
    if (!canWrite || busyId) return;
    const data = new FormData(form); const stage = String(data.get("stage")) as LeadStage;
    const humanRequired = data.get("humanRequired") === "on"; const doNotContact = data.get("doNotContact") === "on";
    const localFollowUp = String(data.get("nextFollowUpAt") ?? "").trim(); const nextFollowUpAt = localFollowUp ? new Date(localFollowUp).toISOString() : null;
    if (!window.confirm(`تأكيد تحديث مسار ${lead.name}؟ سيتم تطبيق قواعد المتابعة وتسجيل العملية في Audit Log.`)) return;
    setBusyId(lead.id); setNotice("");
    try { await updateLeadWorkflow(session, lead.id, stage, humanRequired, doNotContact, nextFollowUpAt); setNotice("تم تحديث مسار العميل وتسجيل العملية بنجاح."); onChanged(); }
    catch (cause) {
      const code = cause instanceof Error ? cause.message : "UPDATE_FAILED";
      const messages: Record<string, string> = { INVALID_FOLLOW_UP_TIME: "موعد المتابعة يجب أن يكون في المستقبل.", FOLLOW_UP_TOO_FAR: "موعد المتابعة يتجاوز الحد المسموح.", FOLLOW_UP_LIMIT_REACHED: "تم بلوغ الحد الأقصى لمحاولات المتابعة.", STAFF_ACCESS_DENIED: "ليست لديك صلاحية تنفيذ هذا التغيير." };
      setNotice(messages[code] ?? "تعذر التحديث بأمان؛ لم يتم اعتماد أي تغيير غير مؤكد.");
    } finally { setBusyId(null); }
  }
  return <><div className="write-banner"><strong>كتابة مضبوطة</strong><span>CRM workflow فقط · RBAC + locking + validation + Audit Log</span></div>{notice && <div className="notice-box">{notice}</div>}<div className="data-grid">{parsed.data.map((lead) => {
    const followUpLocal = lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toISOString().slice(0, 16) : "";
    return <article className="data-card booking-card" key={lead.id}><h3>{lead.name}</h3><p>{lead.phone ?? "بدون هاتف"} · {lead.channel ?? "قناة غير معروفة"}</p><p>{lead.intent ?? "غير مصنف"} · Score: {lead.score ?? "—"}</p><form onSubmit={(event) => { event.preventDefault(); void save(lead, event.currentTarget); }}><label>المرحلة<select name="stage" defaultValue={lead.stage} disabled={!canWrite || busyId === lead.id}>{(["new", "contacted", "qualified", "booking_intent", "booked", "follow_up", "lost", "customer"] as const).map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select></label><label>موعد المتابعة<input name="nextFollowUpAt" type="datetime-local" defaultValue={followUpLocal} disabled={!canWrite || busyId === lead.id} /></label><label><input name="humanRequired" type="checkbox" defaultChecked={lead.humanRequired} disabled={!canWrite || busyId === lead.id} /> يتطلب تدخلًا بشريًا</label><label><input name="doNotContact" type="checkbox" defaultChecked={lead.doNotContact} disabled={!canWrite || busyId === lead.id} /> عدم التواصل</label><button disabled={!canWrite || busyId === lead.id}>{busyId === lead.id ? "جاري الحفظ..." : "حفظ التغييرات"}</button></form>{!canWrite && <small>دورك يملك صلاحية القراءة فقط.</small>}</article>;
  })}</div></>;
}

function BookingView({ value, session, onChanged }: { value: JsonValue; session: Session; onChanged: () => void }) {
  const parsed = z.array(BookingSchema).safeParse(value);
  const [busyId, setBusyId] = useState<string | null>(null); const [notice, setNotice] = useState("");
  const canWrite = ["super_admin", "admin", "reception"].includes(session.role);
  if (!parsed.success) return <div className="error-box">صيغة بيانات الحجوزات غير متوافقة؛ لم يتم تنفيذ أي كتابة.</div>;
  if (parsed.data.length === 0) return <p className="muted">لا توجد طلبات حجز حاليًا.</p>;
  async function changeStatus(id: string, current: BookingStatus, next: BookingStatus, name: string) {
    if (!canWrite || current === next) return;
    if (!window.confirm(`تأكيد تغيير حالة طلب ${name} من ${current} إلى ${next}؟ سيتم تسجيل العملية في Audit Log.`)) return;
    setBusyId(id); setNotice("");
    try { await updateBookingStatus(session, id, next); setNotice("تم تحديث الحالة وتسجيل العملية بنجاح."); onChanged(); }
    catch (cause) { const code = cause instanceof Error ? cause.message : "UPDATE_FAILED"; setNotice(code === "STAFF_ACCESS_DENIED" ? "ليست لديك صلاحية تنفيذ هذا التغيير." : "تعذر التحديث بأمان؛ لم يتم اعتماد أي تغيير غير مؤكد."); }
    finally { setBusyId(null); }
  }
  return <><div className="write-banner"><strong>كتابة مضبوطة</strong><span>تحديث حالة الحجز فقط · RBAC + Server validation + Audit Log</span></div>{notice && <div className="notice-box">{notice}</div>}<div className="data-grid">{parsed.data.map((booking) => <article className="data-card booking-card" key={booking.id}><h3>{booking.full_name}</h3><p>{booking.normalized_phone ?? booking.phone ?? "بدون هاتف"}</p><p>{[booking.category, booking.training_type, booking.location].filter(Boolean).join(" · ") || "تفاصيل غير مكتملة"}</p><p>{[booking.requested_date, booking.requested_time].filter(Boolean).join(" · ") || "موعد غير محدد"}</p><label>الحالة<select value={booking.status} disabled={!canWrite || busyId === booking.id} onChange={(event) => void changeStatus(booking.id, booking.status, event.target.value as BookingStatus, booking.full_name)}>{(["pending", "contacted", "confirmed", "declined", "cancelled"] as const).map((status) => <option key={status} value={status}>{status}</option>)}</select></label>{!canWrite && <small>دورك يملك صلاحية القراءة فقط.</small>}</article>)}</div></>;
}

function Dashboard({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [active, setActive] = useState<SectionId>("dashboard"); const [reloadKey, setReloadKey] = useState(0); const [data, setData] = useState<JsonValue>(null); const [status, setStatus] = useState<"loading" | "ready" | "error">("loading"); const [error, setError] = useState("");
  const current = useMemo(() => sections.find(([id]) => id === active)!, [active]);
  useEffect(() => { let cancelled = false; setStatus("loading"); setError(""); callRpc(session, current[3]).then((result) => { if (!cancelled) { setData(result); setStatus("ready"); } }).catch((cause) => { if (cancelled) return; const message = cause instanceof Error ? cause.message : "LOAD_FAILED"; if (message === "SESSION_EXPIRED") onLogout(); else { setError("تعذر تحميل هذه الوحدة بأمان."); setStatus("error"); } }); return () => { cancelled = true; }; }, [current, onLogout, reloadKey, session]);
  const modeLabel = active === "planner" || active === "crm" || active === "inbox" ? "CONTROLLED WRITE" : "READ ONLY";
  return <div className="app-shell"><aside><div className="side-brand"><strong>Relax Fix AI OS</strong><span>{session.displayName} · {session.role}</span></div><nav>{sections.map(([id, label, Icon]) => <button key={id} className={active === id ? "active" : ""} onClick={() => setActive(id)}><Icon size={18} />{label}</button>)}</nav><button className="logout" onClick={onLogout}><LogOut size={18} />تسجيل الخروج</button></aside><main className="workspace"><p className="eyebrow">INTERNAL OPERATIONS · {modeLabel}</p><h1>{current[1]}</h1><section className="panel"><div className="panel-heading"><div><h2>بيانات تشغيل حقيقية</h2><p>Supabase RPC محمي بهوية الموظف وصلاحيات قاعدة البيانات.</p></div><button className="refresh" disabled={status === "loading"} onClick={() => setReloadKey((value) => value + 1)}>تحديث</button></div>{status === "loading" && <p className="muted">جاري التحميل الآمن...</p>}{status === "error" && <div className="error-box">{error}</div>}{status === "ready" && (active === "planner" ? <BookingView value={data} session={session} onChanged={() => setReloadKey((value) => value + 1)} /> : active === "crm" ? <CRMView value={data} session={session} onChanged={() => setReloadKey((value) => value + 1)} /> : active === "inbox" ? <AIInboxView value={data} session={session} onChanged={() => setReloadKey((value) => value + 1)} onSessionExpired={onLogout} /> : <DataView value={data} />)}</section></main></div>;
}

function App() { const [session, setSession] = useState<Session | null>(null); useEffect(() => { try { const raw = sessionStorage.getItem("relaxfix-command-session"); if (raw) setSession(z.object({ accessToken: z.string(), displayName: z.string(), role: ProfileSchema.shape.role }).parse(JSON.parse(raw))); } catch { sessionStorage.removeItem("relaxfix-command-session"); } }, []); if (!session) return <Login onAuthenticated={setSession} />; return <Dashboard session={session} onLogout={() => { sessionStorage.removeItem("relaxfix-command-session"); setSession(null); }} />; }
createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
