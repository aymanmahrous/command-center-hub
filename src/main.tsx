import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BarChart3, Bot, CalendarDays, ContactRound, Inbox, LayoutDashboard, Library, LogOut, Settings2, ShieldAlert, Workflow } from "lucide-react";
import { z } from "zod";
import "./styles.css";
import "./ai-inbox.css";
import "./bookings.css";
import "./content-studio.css";
import "./media-library.css";
import "./analytics.css";
import "./integrations.css";
import "./system-polish.css";

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
type ContentStatus = "idea" | "draft" | "generated" | "needs_review" | "approved" | "scheduled" | "published" | "failed";
type ContentAction = "approve" | "return_to_review" | "schedule" | "unschedule";
type MediaAssetType = "image" | "video" | "logo" | "other";
type MediaSource = "upload" | "ai_generated" | "external";
type JobStatus = "queued" | "processing" | "completed" | "failed" | "retrying" | "dead";

const ProfileSchema = z.object({ display_name: z.string().min(1), role: z.enum(["super_admin", "admin", "reception", "coach", "content_manager"]), active: z.literal(true) });
const BookingSchema = z.object({
  id: z.string().uuid(), full_name: z.string(), phone: z.string().nullable().optional(), normalized_phone: z.string().nullable().optional(),
  gender: z.string().nullable().optional(), category: z.string().nullable().optional(), location: z.string().nullable().optional(), other_location: z.string().nullable().optional(),
  swam_before: z.boolean().nullable().optional(), fear_of_water: z.boolean().nullable().optional(), training_type: z.string().nullable().optional(),
  requested_date: z.string().nullable().optional(), requested_time: z.string().nullable().optional(),
  status: z.enum(["pending", "contacted", "confirmed", "declined", "cancelled"]), created_at: z.string(), updated_at: z.string().nullable().optional(),
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
const ContentItemSchema = z.object({
  id: z.string().uuid(), scheduledFor: z.string().nullable(), platform: z.string(), contentType: z.string(),
  topic: z.string(), hook: z.string(), caption: z.string(), cta: z.string(), hashtags: z.array(z.string()),
  visualPrompt: z.string(), status: z.enum(["idea", "draft", "generated", "needs_review", "approved", "scheduled", "published", "failed"]),
  providerExternalId: z.string().nullable(), publishedAt: z.string().nullable(), createdAt: z.string(), updatedAt: z.string(),
}).passthrough();
const ContentMutationSchema = z.object({
  success: z.boolean(), code: z.string().optional(), contentItemId: z.string().uuid().optional(),
  status: z.enum(["idea", "draft", "generated", "needs_review", "approved", "scheduled", "published", "failed"]).optional(),
  scheduledFor: z.string().nullable().optional(), updatedAt: z.string().optional(),
});
const MediaAssetSchema = z.object({
  id: z.string().uuid(), createdBy: z.string().uuid(), contentItemId: z.string().uuid().nullable(),
  assetType: z.enum(["image", "video", "logo", "other"]), source: z.enum(["upload", "ai_generated", "external"]),
  storagePath: z.string().nullable(), provider: z.string().nullable(), providerJobId: z.string().nullable(),
  prompt: z.string().nullable(), metadata: z.record(z.unknown()), createdAt: z.string(),
}).passthrough();
const AnalyticsSchema = z.object({
  views: z.number().int().nonnegative(), dms: z.number().int().nonnegative(), qualifiedLeads: z.number().int().nonnegative(),
  bookingRequests: z.number().int().nonnegative(), publishedItems: z.number().int().nonnegative(), contentItems: z.number().int().nonnegative(),
  attributionReady: z.boolean(), note: z.string(),
}).passthrough();
const FollowUpJobSchema = z.object({
  id: z.string().uuid(), leadId: z.string().uuid(), leadName: z.string(), conversationId: z.string().uuid().nullable(),
  attemptNumber: z.number().int().nonnegative(), scheduledFor: z.string(), status: z.enum(["queued", "processing", "completed", "failed", "retrying", "dead"]),
  stoppedReason: z.string().nullable(), createdAt: z.string(),
}).passthrough();
const BackgroundJobSchema = z.object({
  id: z.string().uuid(), jobType: z.string(), status: z.enum(["queued", "processing", "completed", "failed", "retrying", "dead"]),
  attemptCount: z.number().int().nonnegative(), nextRetryAt: z.string().nullable(), lastError: z.string().nullable(), createdAt: z.string(), updatedAt: z.string(),
}).passthrough();
const OperationsQueueSchema = z.object({
  followUps: z.array(FollowUpJobSchema), backgroundJobs: z.array(BackgroundJobSchema), generatedAt: z.string(),
}).passthrough();
const StoredSessionSchema = z.object({ accessToken: z.string().min(1) }).passthrough();

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const SUPABASE_PUBLIC_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();
const STAFF_TABLE = (import.meta.env.VITE_STAFF_PROFILE_TABLE ?? "staff_profiles").trim();

function legacyKeyRole(key: string) {
  try {
    const encodedPayload = key.split(".")[1];
    if (!encodedPayload) return null;
    const normalized = encodedPayload.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
    return z.object({ role: z.string() }).parse(JSON.parse(atob(normalized))).role;
  } catch { return null; }
}

function browserSafeApiKey(key: string) {
  if (/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(key)) return true;
  if (key.startsWith("sb_secret_")) return false;
  return legacyKeyRole(key) === "anon";
}

function configurationReady() {
  try {
    const url = new URL(SUPABASE_URL);
    return url.protocol === "https:" && url.hostname.endsWith(".supabase.co") && browserSafeApiKey(SUPABASE_PUBLIC_KEY) && STAFF_TABLE.length > 0;
  } catch { return false; }
}
function rpcHeaders(session: Session) { return { apikey: SUPABASE_PUBLIC_KEY, Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json", Accept: "application/json" }; }

async function loadStaffProfile(accessToken: string, userId: string, signal?: AbortSignal) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${encodeURIComponent(STAFF_TABLE)}?id=eq.${encodeURIComponent(userId)}&select=display_name,role,active&limit=1`, {
    headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: `Bearer ${accessToken}`, Accept: "application/json" }, cache: "no-store", signal,
  });
  if (response.status === 401) throw new Error("SESSION_EXPIRED");
  if (!response.ok) throw new Error("PROFILE_CHECK_FAILED");
  const rows = z.array(ProfileSchema).parse(await response.json());
  if (rows.length !== 1) throw new Error("STAFF_ACCESS_DENIED");
  return { accessToken, displayName: rows[0].display_name, role: rows[0].role } satisfies Session;
}

async function signIn(email: string, password: string): Promise<Session> {
  if (!configurationReady()) throw new Error("CONFIGURATION_REQUIRED");
  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_PUBLIC_KEY }, body: JSON.stringify({ email, password }) });
  if (authResponse.status === 429) throw new Error("TOO_MANY_ATTEMPTS");
  if (!authResponse.ok) throw new Error("INVALID_LOGIN");
  const auth = z.object({ access_token: z.string(), user: z.object({ id: z.string().uuid() }) }).parse(await authResponse.json());
  return loadStaffProfile(auth.access_token, auth.user.id);
}

async function restoreSession(accessToken: string, signal: AbortSignal): Promise<Session> {
  if (!configurationReady()) throw new Error("CONFIGURATION_REQUIRED");
  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: `Bearer ${accessToken}`, Accept: "application/json" }, cache: "no-store", signal,
  });
  if (!authResponse.ok) throw new Error("SESSION_EXPIRED");
  const user = z.object({ id: z.string().uuid() }).parse(await authResponse.json());
  return loadStaffProfile(accessToken, user.id, signal);
}

async function callRpc(session: Session, rpcName: string, body: Record<string, unknown> = {}, signal?: AbortSignal): Promise<JsonValue> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${encodeURIComponent(rpcName)}`, { method: "POST", headers: rpcHeaders(session), body: JSON.stringify(body), signal });
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

async function getConversationMessages(session: Session, conversationId: string, signal?: AbortSignal) {
  return z.array(MessageSchema).parse(await callRpc(session, "get_staff_conversation_messages", { p_conversation_id: conversationId }, signal));
}

async function setConversationMode(session: Session, conversationId: string, mode: ConversationMode) {
  const result = ConversationModeUpdateSchema.parse(await callRpc(session, "set_staff_conversation_mode", {
    p_conversation_id: conversationId, p_mode: mode,
  }));
  if (!result.success) throw new Error(result.code ?? "UPDATE_REJECTED");
  return result;
}

async function updateContentItem(session: Session, contentItemId: string, fields: { topic: string; hook: string; caption: string; cta: string; hashtags: string[]; visualPrompt: string }) {
  const result = ContentMutationSchema.parse(await callRpc(session, "update_staff_content_item", {
    p_content_item_id: contentItemId, p_topic: fields.topic, p_hook: fields.hook, p_caption: fields.caption,
    p_cta: fields.cta, p_hashtags: fields.hashtags, p_visual_prompt: fields.visualPrompt,
  }));
  if (!result.success) throw new Error(result.code ?? "UPDATE_REJECTED");
  return result;
}

async function transitionContentItem(session: Session, contentItemId: string, action: ContentAction, scheduledFor: string | null = null) {
  const result = ContentMutationSchema.parse(await callRpc(session, "transition_staff_content_item", {
    p_content_item_id: contentItemId, p_action: action, p_scheduled_for: scheduledFor,
  }));
  if (!result.success) throw new Error(result.code ?? "UPDATE_REJECTED");
  return result;
}

function Login({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { const session = await signIn(email.trim(), password); sessionStorage.setItem("relaxfix-command-session", JSON.stringify({ accessToken: session.accessToken })); onAuthenticated(session); } catch (cause) { const code = cause instanceof Error ? cause.message : "LOGIN_FAILED"; setError(code === "CONFIGURATION_REQUIRED" ? "إعدادات الاتصال غير مكتملة أو المفتاح غير آمن. التطبيق مغلق بأمان." : code === "TOO_MANY_ATTEMPTS" ? "محاولات تسجيل الدخول كثيرة. انتظر قليلًا ثم أعد المحاولة." : "تعذر تسجيل الدخول أو أن الحساب غير مخول."); } finally { setBusy(false); } }
  return <main className="login-page"><section className="login-card" aria-busy={busy}><div className="brand-mark"><ShieldAlert size={28} /></div><p className="eyebrow">RELAX FIX UAE</p><h1>Command Center Hub</h1><p className="muted">منصة العمليات الداخلية. الدخول للموظفين النشطين فقط.</p><form onSubmit={submit}><label>البريد الإلكتروني<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>كلمة المرور<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>{error && <div className="error-box" role="alert">{error}</div>}<button disabled={busy}>{busy ? "جاري التحقق..." : "تسجيل الدخول"}</button></form><p className="security-note">لا يتم تخزين كلمة المرور. الجلسة تبقى في هذه النافذة فقط.</p></section></main>;
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
    const controller = new AbortController();
    if (!selectedId) { setMessages([]); setMessageStatus("idle"); return; }
    setMessageStatus("loading"); setMessages([]);
    getConversationMessages(session, selectedId, controller.signal).then((result) => {
      setMessages(result); setMessageStatus("ready");
    }).catch((cause) => {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      const code = cause instanceof Error ? cause.message : "LOAD_FAILED";
      if (code === "SESSION_EXPIRED") onSessionExpired();
      else setMessageStatus("error");
    });
    return () => controller.abort();
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
    {notice && <div className="notice-box" aria-live="polite">{notice}</div>}
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

function CRMView({ value, session, onChanged, onSessionExpired }: { value: JsonValue; session: Session; onChanged: () => void; onSessionExpired: () => void }) {
  const parsed = z.array(LeadSchema).safeParse(value);
  const [busyId, setBusyId] = useState<string | null>(null); const [notice, setNotice] = useState("");
  const canWrite = ["super_admin", "admin", "reception", "coach"].includes(session.role);
  if (!parsed.success) return <div className="error-box">صيغة بيانات CRM غير متوافقة؛ لم يتم تنفيذ أي كتابة.</div>;
  if (parsed.data.length === 0) return <p className="muted">لا توجد عملاء محتملون حاليًا.</p>;
  async function save(lead: z.infer<typeof LeadSchema>, form: HTMLFormElement) {
    if (!canWrite || busyId) return;
    const data = new FormData(form); const stage = String(data.get("stage")) as LeadStage;
    const humanRequired = data.get("humanRequired") === "on"; const doNotContact = data.get("doNotContact") === "on";
    const localFollowUp = String(data.get("nextFollowUpAt") ?? "").trim();
    const followUpDate = localFollowUp ? new Date(localFollowUp) : null;
    if (followUpDate && Number.isNaN(followUpDate.getTime())) { setNotice("موعد المتابعة غير صالح؛ لم يتم تنفيذ أي تغيير."); return; }
    const nextFollowUpAt = followUpDate?.toISOString() ?? null;
    if (!window.confirm(`تأكيد تحديث مسار ${lead.name}؟ سيتم تطبيق قواعد المتابعة وتسجيل العملية في Audit Log.`)) return;
    setBusyId(lead.id); setNotice("");
    try { await updateLeadWorkflow(session, lead.id, stage, humanRequired, doNotContact, nextFollowUpAt); setNotice("تم تحديث مسار العميل وتسجيل العملية بنجاح."); onChanged(); }
    catch (cause) {
      const code = cause instanceof Error ? cause.message : "UPDATE_FAILED";
      if (code === "SESSION_EXPIRED") { onSessionExpired(); return; }
      const messages: Record<string, string> = { INVALID_FOLLOW_UP_TIME: "موعد المتابعة يجب أن يكون في المستقبل.", FOLLOW_UP_TOO_FAR: "موعد المتابعة يتجاوز الحد المسموح.", FOLLOW_UP_LIMIT_REACHED: "تم بلوغ الحد الأقصى لمحاولات المتابعة.", STAFF_ACCESS_DENIED: "ليست لديك صلاحية تنفيذ هذا التغيير." };
      setNotice(messages[code] ?? "تعذر التحديث بأمان؛ لم يتم اعتماد أي تغيير غير مؤكد.");
    } finally { setBusyId(null); }
  }
  return <><div className="write-banner"><strong>كتابة مضبوطة</strong><span>CRM workflow فقط · RBAC + locking + validation + Audit Log</span></div>{notice && <div className="notice-box" aria-live="polite">{notice}</div>}<div className="data-grid">{parsed.data.map((lead) => {
    const followUpLocal = formatLocalDateTimeInput(lead.nextFollowUpAt ?? null);
    return <article className="data-card booking-card" key={lead.id}><h3>{lead.name}</h3><p>{lead.phone ?? "بدون هاتف"} · {lead.channel ?? "قناة غير معروفة"}</p><p>{lead.intent ?? "غير مصنف"} · Score: {lead.score ?? "—"}</p><form aria-busy={busyId === lead.id} onSubmit={(event) => { event.preventDefault(); void save(lead, event.currentTarget); }}><label>المرحلة<select name="stage" defaultValue={lead.stage} disabled={!canWrite || busyId !== null}>{(["new", "contacted", "qualified", "booking_intent", "booked", "follow_up", "lost", "customer"] as const).map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select></label><label>موعد المتابعة<input name="nextFollowUpAt" type="datetime-local" defaultValue={followUpLocal} disabled={!canWrite || busyId !== null} /></label><label><input name="humanRequired" type="checkbox" defaultChecked={lead.humanRequired} disabled={!canWrite || busyId !== null} /> يتطلب تدخلًا بشريًا</label><label><input name="doNotContact" type="checkbox" defaultChecked={lead.doNotContact} disabled={!canWrite || busyId !== null} /> عدم التواصل</label><button disabled={!canWrite || busyId !== null}>{busyId === lead.id ? "جاري الحفظ..." : "حفظ التغييرات"}</button></form>{!canWrite && <small>دورك يملك صلاحية القراءة فقط.</small>}</article>;
  })}</div></>;
}

const contentStatusLabels: Record<ContentStatus, string> = {
  idea: "فكرة", draft: "مسودة", generated: "مولّد", needs_review: "بانتظار المراجعة",
  approved: "معتمد", scheduled: "مجدول", published: "منشور", failed: "فشل",
};

const contentActionLabels: Record<ContentAction, string> = {
  approve: "اعتماد المحتوى", return_to_review: "إعادة للمراجعة", schedule: "جدولة", unschedule: "إلغاء الجدولة",
};

function contentErrorMessage(code: string) {
  const messages: Record<string, string> = {
    STAFF_ACCESS_DENIED: "ليست لديك صلاحية تنفيذ هذا التغيير.", NOT_FOUND: "عنصر المحتوى لم يعد موجودًا.",
    PUBLISHED_CONTENT_IMMUTABLE: "المحتوى المنشور غير قابل للتحرير.", INVALID_CAPTION: "النص مطلوب ويجب ألا يتجاوز 5000 حرف.",
    CONTENT_FIELD_TOO_LONG: "أحد الحقول يتجاوز الحد المسموح.", TOO_MANY_HASHTAGS: "الحد الأقصى 30 وسمًا.",
    INVALID_HASHTAG: "أحد الوسوم غير صالح أو يتجاوز 100 حرف.", INVALID_TRANSITION: "هذا الانتقال غير مسموح للحالة الحالية.",
    APPROVAL_REQUIRED: "يجب اعتماد المحتوى قبل الجدولة.", INVALID_SCHEDULE_TIME: "وقت الجدولة يجب أن يكون في المستقبل.",
    SCHEDULE_TOO_FAR: "لا يمكن الجدولة لأكثر من 366 يومًا.", INVALID_ACTION: "الإجراء المطلوب غير مسموح.",
  };
  return messages[code] ?? "تعذر تنفيذ التغيير بأمان؛ لم يتم اعتماد أي تغيير غير مؤكد.";
}

function ContentStudioView({ value, session, onChanged, onSessionExpired }: { value: JsonValue; session: Session; onChanged: () => void; onSessionExpired: () => void }) {
  const parsed = useMemo(() => z.array(ContentItemSchema).safeParse(value), [value]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ContentStatus | "all">("all");
  const canWrite = ["super_admin", "admin", "content_manager"].includes(session.role);
  const items = parsed.success ? parsed.data : [];
  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ar");
    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!normalized) return true;
      return [item.topic, item.hook, item.caption, item.cta, item.platform, item.contentType, ...item.hashtags]
        .some((field) => field.toLocaleLowerCase("ar").includes(normalized));
    });
  }, [items, query, statusFilter]);

  if (!parsed.success) return <div className="error-box">صيغة بيانات Content Studio غير متوافقة؛ لم يتم تنفيذ أي كتابة.</div>;

  async function runMutation(itemId: string, operation: () => Promise<unknown>, successMessage: string) {
    if (!canWrite || busyId) return;
    setBusyId(itemId); setNotice("");
    try { await operation(); setNotice(successMessage); onChanged(); }
    catch (cause) {
      const code = cause instanceof Error ? cause.message : "UPDATE_FAILED";
      if (code === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setNotice(contentErrorMessage(code));
    } finally { setBusyId(null); }
  }

  async function save(item: z.infer<typeof ContentItemSchema>, form: HTMLFormElement) {
    if (!canWrite || busyId || item.status === "published") return;
    const data = new FormData(form);
    const fields = {
      topic: String(data.get("topic") ?? "").trim(), hook: String(data.get("hook") ?? "").trim(),
      caption: String(data.get("caption") ?? "").trim(), cta: String(data.get("cta") ?? "").trim(),
      hashtags: [...new Set(String(data.get("hashtags") ?? "").split(/[,\n]/).map((tag) => tag.trim()).filter(Boolean))],
      visualPrompt: String(data.get("visualPrompt") ?? "").trim(),
    };
    const unchanged = fields.topic === item.topic && fields.hook === item.hook && fields.caption === item.caption && fields.cta === item.cta
      && fields.visualPrompt === item.visualPrompt && JSON.stringify(fields.hashtags) === JSON.stringify(item.hashtags);
    if (unchanged) { setNotice("لا توجد تغييرات جديدة للحفظ."); return; }
    if (fields.caption.length < 2 || fields.caption.length > 5000 || fields.hashtags.length > 30) { setNotice("تحقق من طول النص وعدد الوسوم قبل الحفظ."); return; }
    const scheduleWarning = item.status === "scheduled" ? " سيؤدي التحرير إلى إلغاء الجدولة وإعادة العنصر للمراجعة." : " سيعود العنصر إلى المراجعة.";
    if (!window.confirm(`تأكيد حفظ تعديلات «${item.topic || "محتوى بدون عنوان"}»؟${scheduleWarning} سيتم تسجيل العملية في Audit Log.`)) return;
    await runMutation(item.id, () => updateContentItem(session, item.id, fields), "تم حفظ المحتوى وإعادته للمراجعة مع تسجيل العملية.");
  }

  async function transition(item: z.infer<typeof ContentItemSchema>, action: ContentAction, form: HTMLFormElement) {
    if (!canWrite || busyId) return;
    let scheduledFor: string | null = null;
    if (action === "schedule") {
      const localValue = String(new FormData(form).get("scheduledFor") ?? "").trim();
      if (!localValue) { setNotice("حدد وقتًا مستقبليًا للجدولة."); return; }
      const date = new Date(localValue);
      if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) { setNotice("وقت الجدولة يجب أن يكون في المستقبل."); return; }
      scheduledFor = date.toISOString();
    }
    if ((action === "approve" && item.status === "approved") || (action === "return_to_review" && item.status === "needs_review")) return;
    if (!window.confirm(`تأكيد «${contentActionLabels[action]}» للعنصر «${item.topic || "محتوى بدون عنوان"}»؟ سيتم تسجيل العملية في Audit Log.`)) return;
    await runMutation(item.id, () => transitionContentItem(session, item.id, action, scheduledFor), `تم تنفيذ «${contentActionLabels[action]}» وتسجيل العملية بنجاح.`);
  }

  return <>
    <div className="write-banner"><strong>Content Studio مضبوط</strong><span>RPC فقط · اعتماد بشري · قفل ضد التكرار · Audit Log</span></div>
    {notice && <div className="notice-box" aria-live="polite">{notice}</div>}
    <div className="content-toolbar">
      <label>بحث<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="الموضوع، النص، المنصة..." /></label>
      <label>الحالة<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ContentStatus | "all")}><option value="all">جميع الحالات</option>{(Object.keys(contentStatusLabels) as ContentStatus[]).map((status) => <option key={status} value={status}>{contentStatusLabels[status]}</option>)}</select></label>
      <span>{filteredItems.length} من {items.length}</span>
    </div>
    {items.length === 0 && <p className="muted">لا توجد عناصر محتوى حاليًا.</p>}
    {items.length > 0 && filteredItems.length === 0 && <p className="muted">لا توجد نتائج مطابقة.</p>}
    <div className="content-list">{filteredItems.map((item) => {
      const scheduledLocal = formatLocalDateTimeInput(item.scheduledFor);
      const locked = busyId !== null || !canWrite || item.status === "published";
      return <article className="content-card" key={item.id}>
        <header><div><span>{item.platform} · {item.contentType}</span><h3>{item.topic || "محتوى بدون عنوان"}</h3></div><span className={`content-status status-${item.status}`}>{contentStatusLabels[item.status]}</span></header>
        <form onSubmit={(event) => { event.preventDefault(); void save(item, event.currentTarget); }}>
          <div className="content-fields"><label>الموضوع<input name="topic" defaultValue={item.topic} maxLength={300} disabled={locked} /></label><label>Hook<input name="hook" defaultValue={item.hook} maxLength={500} disabled={locked} /></label></div>
          <label>النص<textarea name="caption" defaultValue={item.caption} minLength={2} maxLength={5000} rows={6} required disabled={locked} /></label>
          <div className="content-fields"><label>CTA<input name="cta" defaultValue={item.cta} maxLength={500} disabled={locked} /></label><label>الوسوم مفصولة بفاصلة<input name="hashtags" defaultValue={item.hashtags.join(", ")} disabled={locked} /></label></div>
          <label>وصف الوسائط<textarea name="visualPrompt" defaultValue={item.visualPrompt} maxLength={2000} rows={3} disabled={locked} /></label>
          <button type="submit" disabled={locked}>{busyId === item.id ? "جاري الحفظ..." : "حفظ وإعادة للمراجعة"}</button>
        </form>
        <form className="content-actions" onSubmit={(event) => event.preventDefault()}>
          <label>وقت الجدولة<input name="scheduledFor" type="datetime-local" defaultValue={scheduledLocal} disabled={!canWrite || busyId !== null || !["approved", "scheduled"].includes(item.status)} /></label>
          <div>
            {["draft", "generated", "needs_review"].includes(item.status) && <button type="button" disabled={!canWrite || busyId !== null} onClick={(event) => void transition(item, "approve", event.currentTarget.form!)}>اعتماد</button>}
            {["draft", "generated", "approved", "scheduled", "failed"].includes(item.status) && <button type="button" className="secondary" disabled={!canWrite || busyId !== null} onClick={(event) => void transition(item, "return_to_review", event.currentTarget.form!)}>إعادة للمراجعة</button>}
            {["approved", "scheduled"].includes(item.status) && <button type="button" disabled={!canWrite || busyId !== null} onClick={(event) => void transition(item, "schedule", event.currentTarget.form!)}>{item.status === "scheduled" ? "إعادة الجدولة" : "جدولة"}</button>}
            {item.status === "scheduled" && <button type="button" className="secondary" disabled={!canWrite || busyId !== null} onClick={(event) => void transition(item, "unschedule", event.currentTarget.form!)}>إلغاء الجدولة</button>}
          </div>
        </form>
        <footer><span>آخر تحديث: {formatBookingDateTime(item.updatedAt)}</span>{item.publishedAt && <span>نشر: {formatBookingDateTime(item.publishedAt)}</span>}{!canWrite && <span>دورك للقراءة فقط.</span>}{item.status === "published" && <span>المحتوى المنشور محمي من التحرير.</span>}</footer>
      </article>;
    })}</div>
  </>;
}

const mediaTypeLabels: Record<MediaAssetType, string> = { image: "صورة", video: "فيديو", logo: "شعار", other: "أخرى" };
const mediaSourceLabels: Record<MediaSource, string> = { upload: "رفع موظف", ai_generated: "مولّد بالذكاء الاصطناعي", external: "مصدر خارجي" };

function mediaFileName(storagePath: string | null) {
  if (!storagePath) return "بدون ملف محفوظ";
  return storagePath.split("/").filter(Boolean).at(-1) ?? "ملف خاص";
}

function mediaMetadataSummary(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata);
  if (entries.length === 0) return "لا توجد بيانات وصفية";
  return entries.slice(0, 6).map(([key, value]) => {
    const rendered = typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : "بيانات مركبة";
    return `${key.replaceAll("_", " ")}: ${rendered.slice(0, 120)}`;
  }).join(" · ");
}

function MediaLibraryView({ value }: { value: JsonValue }) {
  const parsed = useMemo(() => z.array(MediaAssetSchema).safeParse(value), [value]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<MediaAssetType | "all">("all");
  const [sourceFilter, setSourceFilter] = useState<MediaSource | "all">("all");
  const assets = parsed.success ? parsed.data : [];
  const counts = useMemo(() => {
    const initial: Record<MediaAssetType, number> = { image: 0, video: 0, logo: 0, other: 0 };
    for (const asset of assets) initial[asset.assetType] += 1;
    return initial;
  }, [assets]);
  const filteredAssets = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ar");
    return assets.filter((asset) => {
      if (typeFilter !== "all" && asset.assetType !== typeFilter) return false;
      if (sourceFilter !== "all" && asset.source !== sourceFilter) return false;
      if (!normalized) return true;
      return [mediaFileName(asset.storagePath), asset.provider, asset.providerJobId, asset.prompt, asset.contentItemId, mediaMetadataSummary(asset.metadata)]
        .filter((field): field is string => Boolean(field))
        .some((field) => field.toLocaleLowerCase("ar").includes(normalized));
    });
  }, [assets, query, sourceFilter, typeFilter]);

  if (!parsed.success) return <div className="error-box">صيغة بيانات Media Library غير متوافقة؛ لم يتم عرض روابط أو تنفيذ أي كتابة.</div>;

  return <>
    <div className="media-security-banner"><strong>مكتبة وسائط خاصة للقراءة فقط</strong><span>RPC مصادق · ملفات خاصة · لا رفع أو حذف أو توليد من هذه الواجهة</span></div>
    <div className="media-summary" aria-label="ملخص أنواع الوسائط">
      <button type="button" className={typeFilter === "all" ? "active" : ""} onClick={() => setTypeFilter("all")}><span>الكل</span><strong>{assets.length}</strong></button>
      {(Object.keys(mediaTypeLabels) as MediaAssetType[]).map((type) => <button type="button" key={type} className={typeFilter === type ? "active" : ""} onClick={() => setTypeFilter(type)}><span>{mediaTypeLabels[type]}</span><strong>{counts[type]}</strong></button>)}
    </div>
    <div className="media-toolbar">
      <label>بحث<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="اسم الملف، المزود، الوصف..." /></label>
      <label>المصدر<select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as MediaSource | "all")}><option value="all">جميع المصادر</option>{(Object.keys(mediaSourceLabels) as MediaSource[]).map((source) => <option key={source} value={source}>{mediaSourceLabels[source]}</option>)}</select></label>
      <span>{filteredAssets.length} من {assets.length}</span>
    </div>
    {assets.length === 0 && <p className="muted">لا توجد أصول وسائط مرتبطة بهذا الموظف حاليًا.</p>}
    {assets.length > 0 && filteredAssets.length === 0 && <p className="muted">لا توجد وسائط مطابقة للبحث أو الفلاتر.</p>}
    <div className="media-grid">{filteredAssets.map((asset) => <article className="media-card" key={asset.id}>
      <div className={`media-placeholder media-${asset.assetType}`}><Library size={26} /><span>{mediaTypeLabels[asset.assetType]}</span><small>معاينة خاصة غير مكشوفة</small></div>
      <div className="media-details">
        <header><div><span>{mediaSourceLabels[asset.source]}</span><h3>{mediaFileName(asset.storagePath)}</h3></div><span className="private-badge">خاص</span></header>
        <dl>
          <div><dt>المزود</dt><dd>{asset.provider || "داخلي / غير محدد"}</dd></div>
          <div><dt>تاريخ الإنشاء</dt><dd>{formatBookingDateTime(asset.createdAt)}</dd></div>
          <div><dt>عنصر المحتوى</dt><dd>{asset.contentItemId ?? "غير مرتبط"}</dd></div>
          <div><dt>مهمة المزود</dt><dd>{asset.providerJobId ?? "غير متاح"}</dd></div>
        </dl>
        {asset.prompt && <div className="media-prompt"><strong>وصف التوليد</strong><p>{asset.prompt}</p></div>}
        <p className="media-metadata">{mediaMetadataSummary(asset.metadata)}</p>
      </div>
    </article>)}</div>
  </>;
}

const analyticsNumber = new Intl.NumberFormat("ar-AE", { maximumFractionDigits: 0 });
const analyticsPercent = new Intl.NumberFormat("ar-AE", { style: "percent", maximumFractionDigits: 1 });

function safeRatio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

function AnalyticsView({ value }: { value: JsonValue }) {
  const parsed = AnalyticsSchema.safeParse(value);
  if (!parsed.success) return <div className="error-box">صيغة بيانات Analytics غير متوافقة؛ لن يتم عرض مؤشرات قد تكون مضللة.</div>;
  const analytics = parsed.data;
  const publishedShare = safeRatio(analytics.publishedItems, analytics.contentItems);
  const dmRate = safeRatio(analytics.dms, analytics.views);

  return <>
    <div className={`analytics-trust ${analytics.attributionReady ? "ready" : "limited"}`}>
      <div><strong>{analytics.attributionReady ? "Attribution متاح" : "Attribution غير مكتمل"}</strong><p>{analytics.attributionReady ? "يمكن ربط النتائج بالمصادر وفق العقد الحالي." : "المؤشرات إجماليات تشغيلية مستقلة؛ لا تُفسر كتحويلات منسوبة لحملة أو منشور."}</p></div>
      <span>{analytics.attributionReady ? "موثوق للربط" : "إجماليات فقط"}</span>
    </div>
    <div className="analytics-groups">
      <section><header><div><p>إشارات الجمهور</p><h3>الوصول والتفاعل</h3></div><BarChart3 size={24} /></header><div className="analytics-metrics"><article><span>المشاهدات</span><strong>{analyticsNumber.format(analytics.views)}</strong><small>آخر لقطة قياس لكل محتوى</small></article><article><span>الرسائل الخاصة</span><strong>{analyticsNumber.format(analytics.dms)}</strong><small>{dmRate == null ? "لا توجد مشاهدات لحساب النسبة" : `${analyticsPercent.format(dmRate)} من إجمالي المشاهدات — نسبة وصفية`}</small></article></div></section>
      <section><header><div><p>مسار العملاء</p><h3>حجم العمل التشغيلي</h3></div><ContactRound size={24} /></header><div className="analytics-metrics"><article><span>عملاء مؤهلون</span><strong>{analyticsNumber.format(analytics.qualifiedLeads)}</strong><small>مراحل qualified وما بعدها</small></article><article><span>طلبات الحجز</span><strong>{analyticsNumber.format(analytics.bookingRequests)}</strong><small>إجمالي مستقل، غير منسوب للعملاء المؤهلين</small></article></div></section>
      <section><header><div><p>صحة المحتوى</p><h3>التغطية المنشورة</h3></div><Bot size={24} /></header><div className="analytics-metrics"><article><span>إجمالي المحتوى</span><strong>{analyticsNumber.format(analytics.contentItems)}</strong><small>كل حالات المحتوى</small></article><article><span>المحتوى المنشور</span><strong>{analyticsNumber.format(analytics.publishedItems)}</strong><small>{publishedShare == null ? "لا يوجد محتوى لحساب النسبة" : `${analyticsPercent.format(publishedShare)} من إجمالي المحتوى`}</small></article></div>{publishedShare != null && <progress className="analytics-progress" value={Math.min(publishedShare, 1)} max={1} aria-label={`نسبة المحتوى المنشور ${analyticsPercent.format(publishedShare)}`}>{analyticsPercent.format(publishedShare)}</progress>}</section>
    </div>
    <div className="analytics-methodology"><strong>ملاحظة المنهجية</strong><p>{analytics.note}</p><small>لا تُستخدم هذه اللوحة لإثبات السببية أو العائد على الاستثمار حتى تكتمل روابط Attribution في مصدر البيانات.</small></div>
  </>;
}

const jobStatusLabels: Record<JobStatus, string> = {
  queued: "في الانتظار",
  processing: "قيد التنفيذ",
  completed: "مكتملة",
  failed: "فشلت",
  retrying: "إعادة محاولة",
  dead: "متوقفة نهائيًا",
};

function boundedOperationalText(value: string, maximum = 240) {
  const normalized = value.trim();
  return normalized.length > maximum ? `${normalized.slice(0, maximum)}…` : normalized;
}

function isPast(value: string, reference: number) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp < reference;
}

function IntegrationsView({ value }: { value: JsonValue }) {
  const parsed = useMemo(() => OperationsQueueSchema.safeParse(value), [value]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  if (!parsed.success) return <div className="error-box">صيغة بيانات العمليات غير متوافقة؛ لن يتم عرض حالة تكامل قد تكون غير دقيقة.</div>;

  const operations = parsed.data;
  const now = Date.now();
  const allJobs = [...operations.followUps, ...operations.backgroundJobs];
  const counts = allJobs.reduce<Record<JobStatus, number>>((result, job) => {
    result[job.status] += 1;
    return result;
  }, { queued: 0, processing: 0, completed: 0, failed: 0, retrying: 0, dead: 0 });
  const normalizedQuery = query.trim().toLocaleLowerCase("ar");
  const matches = (status: JobStatus, fields: Array<string | null>) => {
    if (statusFilter !== "all" && status !== statusFilter) return false;
    return !normalizedQuery || fields.some((field) => field?.toLocaleLowerCase("ar").includes(normalizedQuery));
  };
  const followUps = operations.followUps.filter((job) => matches(job.status, [job.leadName, job.id, job.leadId, job.conversationId, job.stoppedReason]));
  const backgroundJobs = operations.backgroundJobs.filter((job) => matches(job.status, [job.jobType, job.id, job.lastError]));
  const attentionCount = counts.failed + counts.dead;
  const overdueFollowUps = operations.followUps.filter((job) => ["queued", "retrying"].includes(job.status) && isPast(job.scheduledFor, now)).length;

  return <>
    <div className="operations-boundary"><div><strong>مراقبة تشغيلية للقراءة فقط</strong><p>تعكس طوابير المتابعة والمهام الداخلية المسجلة في آخر لقطة، ولا تثبت اتصال مزود خارجي لحظيًا.</p></div><span>لا توجد أوامر Retry أو Cancel</span></div>
    <div className="operations-summary" aria-label="ملخص صحة العمليات">
      <button type="button" className={statusFilter === "all" ? "active" : ""} onClick={() => setStatusFilter("all")}><span>إجمالي السجلات</span><strong>{allJobs.length}</strong></button>
      <button type="button" className={statusFilter === "processing" ? "active" : ""} onClick={() => setStatusFilter("processing")}><span>قيد التنفيذ</span><strong>{counts.processing}</strong></button>
      <button type="button" className={statusFilter === "retrying" ? "active" : ""} onClick={() => setStatusFilter("retrying")}><span>إعادة محاولة</span><strong>{counts.retrying}</strong></button>
      <button type="button" className={statusFilter === "failed" ? "active danger" : ""} onClick={() => setStatusFilter("failed")}><span>فشل قابل للفحص</span><strong>{counts.failed}</strong></button>
      <div className={attentionCount > 0 ? "summary-alert danger" : "summary-alert"}><span>تحتاج انتباهًا</span><strong>{attentionCount}</strong><small>Failed + Dead</small></div>
      <div className={overdueFollowUps > 0 ? "summary-alert warning" : "summary-alert"}><span>متابعات متأخرة</span><strong>{overdueFollowUps}</strong><small>Queued / Retrying</small></div>
    </div>
    <div className="operations-toolbar"><label htmlFor="operations-search">بحث تشغيلي<input id="operations-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="العميل، نوع المهمة، المعرّف أو الخطأ..." /></label><label htmlFor="operations-status">الحالة<select id="operations-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as JobStatus | "all")}><option value="all">كل الحالات</option>{(Object.keys(jobStatusLabels) as JobStatus[]).map((status) => <option key={status} value={status}>{jobStatusLabels[status]}</option>)}</select></label></div>
    <div className="operations-columns">
      <section><header><div><p>Follow-up queue</p><h3>متابعات العملاء</h3></div><span>{followUps.length} من {operations.followUps.length}</span></header>
        {followUps.length === 0 && <p className="muted">لا توجد متابعات مطابقة.</p>}
        <div className="operations-list">{followUps.map((job) => {
          const overdue = ["queued", "retrying"].includes(job.status) && isPast(job.scheduledFor, now);
          return <article key={job.id}><header><div><h4>{job.leadName}</h4><small>محاولة {job.attemptNumber}</small></div><span className={`job-status job-${job.status}`}>{jobStatusLabels[job.status]}</span></header><dl><div><dt>موعد التنفيذ</dt><dd>{formatBookingDateTime(job.scheduledFor)}</dd></div><div><dt>المحادثة</dt><dd>{job.conversationId ?? "غير مرتبطة"}</dd></div><div><dt>تاريخ الإنشاء</dt><dd>{formatBookingDateTime(job.createdAt)}</dd></div></dl>{overdue && <p className="operation-warning">متابعة متأخرة وفق توقيت لقطة البيانات.</p>}{job.stoppedReason && <p className="operation-error"><strong>سبب التوقف:</strong> {boundedOperationalText(job.stoppedReason)}</p>}</article>;
        })}</div>
      </section>
      <section><header><div><p>Background jobs</p><h3>المهام الخلفية</h3></div><span>{backgroundJobs.length} من {operations.backgroundJobs.length}</span></header>
        {backgroundJobs.length === 0 && <p className="muted">لا توجد مهام مطابقة.</p>}
        <div className="operations-list">{backgroundJobs.map((job) => <article key={job.id}><header><div><h4>{job.jobType || "نوع غير محدد"}</h4><small>{job.attemptCount} محاولة</small></div><span className={`job-status job-${job.status}`}>{jobStatusLabels[job.status]}</span></header><dl><div><dt>آخر تحديث</dt><dd>{formatBookingDateTime(job.updatedAt)}</dd></div><div><dt>المحاولة التالية</dt><dd>{job.nextRetryAt ? formatBookingDateTime(job.nextRetryAt) : "غير مجدولة"}</dd></div><div><dt>تاريخ الإنشاء</dt><dd>{formatBookingDateTime(job.createdAt)}</dd></div></dl>{job.lastError && <p className="operation-error"><strong>آخر خطأ:</strong> {boundedOperationalText(job.lastError)}</p>}</article>)}</div>
      </section>
    </div>
    <p className="operations-generated">آخر لقطة من RPC: {formatBookingDateTime(operations.generatedAt)} · حد المصدر 250 سجلًا لكل طابور.</p>
  </>;
}

const bookingStatusLabels: Record<BookingStatus, string> = {
  pending: "قيد الانتظار",
  contacted: "تم التواصل",
  confirmed: "مؤكد",
  declined: "مرفوض",
  cancelled: "ملغي",
};

function formatBookingDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ar-AE");
}

function formatLocalDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function BookingView({ value, session, onChanged, onSessionExpired }: { value: JsonValue; session: Session; onChanged: () => void; onSessionExpired: () => void }) {
  const parsed = useMemo(() => z.array(BookingSchema).safeParse(value), [value]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all");
  const canWrite = ["super_admin", "admin", "reception"].includes(session.role);
  const bookings = parsed.success ? parsed.data : [];
  const counts = useMemo(() => {
    const initial: Record<BookingStatus, number> = { pending: 0, contacted: 0, confirmed: 0, declined: 0, cancelled: 0 };
    for (const booking of bookings) initial[booking.status] += 1;
    return initial;
  }, [bookings]);
  const filteredBookings = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ar");
    return bookings.filter((booking) => {
      if (statusFilter !== "all" && booking.status !== statusFilter) return false;
      if (!normalizedQuery) return true;
      return [booking.full_name, booking.phone, booking.normalized_phone, booking.category, booking.training_type, booking.location, booking.other_location]
        .filter((item): item is string => Boolean(item))
        .some((item) => item.toLocaleLowerCase("ar").includes(normalizedQuery));
    });
  }, [bookings, query, statusFilter]);

  if (!parsed.success) return <div className="error-box">صيغة بيانات الحجوزات غير متوافقة؛ لم يتم تنفيذ أي كتابة.</div>;

  async function changeStatus(booking: z.infer<typeof BookingSchema>, next: BookingStatus) {
    if (!canWrite || busyId || booking.status === next) return;
    if (!window.confirm(`تأكيد تغيير حالة طلب ${booking.full_name} من «${bookingStatusLabels[booking.status]}» إلى «${bookingStatusLabels[next]}»؟ سيتم تسجيل العملية في Audit Log.`)) return;
    setBusyId(booking.id); setNotice("");
    try {
      await updateBookingStatus(session, booking.id, next);
      setNotice("تم تحديث الحالة وتسجيل العملية بنجاح.");
      onChanged();
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "UPDATE_FAILED";
      if (code === "SESSION_EXPIRED") { onSessionExpired(); return; }
      const messagesByCode: Record<string, string> = {
        STAFF_ACCESS_DENIED: "ليست لديك صلاحية تنفيذ هذا التغيير.",
        INVALID_STATUS: "حالة الحجز المطلوبة غير مسموحة.",
        NOT_FOUND: "طلب الحجز لم يعد موجودًا.",
      };
      setNotice(messagesByCode[code] ?? "تعذر التحديث بأمان؛ لم يتم اعتماد أي تغيير غير مؤكد.");
    } finally { setBusyId(null); }
  }

  return <>
    <div className="write-banner"><strong>تشغيل الحجوزات</strong><span>الكتابة الوحيدة: تحديث الحالة عبر RPC · RBAC + تأكيد + Audit Log</span></div>
    {notice && <div className="notice-box" aria-live="polite">{notice}</div>}
    <div className="booking-summary" aria-label="ملخص حالات الحجوزات">
      <button type="button" className={statusFilter === "all" ? "active" : ""} onClick={() => setStatusFilter("all")}><span>الإجمالي</span><strong>{bookings.length}</strong></button>
      {(Object.keys(bookingStatusLabels) as BookingStatus[]).map((status) => <button type="button" key={status} className={statusFilter === status ? "active" : ""} onClick={() => setStatusFilter(status)}><span>{bookingStatusLabels[status]}</span><strong>{counts[status]}</strong></button>)}
    </div>
    <div className="booking-toolbar">
      <label htmlFor="booking-search">بحث في الحجوزات<input id="booking-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="الاسم، الهاتف، الفئة، الموقع..." /></label>
      <span>{filteredBookings.length} من {bookings.length}</span>
    </div>
    {bookings.length === 0 && <p className="muted">لا توجد طلبات حجز حاليًا.</p>}
    {bookings.length > 0 && filteredBookings.length === 0 && <p className="muted">لا توجد نتائج مطابقة للبحث أو الفلتر.</p>}
    <div className="booking-list">{filteredBookings.map((booking) => {
      const phone = booking.normalized_phone ?? booking.phone;
      const location = booking.location === "Other" ? booking.other_location : booking.location;
      return <article className="booking-operation-card" key={booking.id}>
        <header><div><h3>{booking.full_name}</h3><p>{phone ? <a href={`tel:${phone}`}>{phone}</a> : "بدون هاتف"}</p></div><span className={`booking-status status-${booking.status}`}>{bookingStatusLabels[booking.status]}</span></header>
        <dl>
          <div><dt>الموعد المطلوب</dt><dd>{[booking.requested_date, booking.requested_time?.slice(0, 5)].filter(Boolean).join(" · ") || "غير محدد"}</dd></div>
          <div><dt>الخدمة</dt><dd>{[booking.category, booking.training_type].filter(Boolean).join(" · ") || "غير محددة"}</dd></div>
          <div><dt>الموقع</dt><dd>{location || "غير محدد"}</dd></div>
          <div><dt>الملف</dt><dd>{[booking.gender, booking.swam_before == null ? null : booking.swam_before ? "سبق له السباحة" : "لم يسبح سابقًا"].filter(Boolean).join(" · ") || "غير مكتمل"}</dd></div>
          <div><dt>تاريخ الطلب</dt><dd>{formatBookingDateTime(booking.created_at)}</dd></div>
        </dl>
        {booking.fear_of_water && <div className="booking-risk">تنبيه: العميل أشار إلى وجود خوف من الماء.</div>}
        <label htmlFor={`booking-status-${booking.id}`}>تحديث الحالة<select id={`booking-status-${booking.id}`} value={booking.status} disabled={!canWrite || busyId !== null} onChange={(event) => void changeStatus(booking, event.target.value as BookingStatus)}>{(Object.keys(bookingStatusLabels) as BookingStatus[]).map((status) => <option key={status} value={status}>{bookingStatusLabels[status]}</option>)}</select></label>
        {busyId === booking.id && <small>جاري حفظ التغيير المراجع...</small>}
        {!canWrite && <small>دورك يملك صلاحية القراءة فقط.</small>}
      </article>;
    })}</div>
  </>;
}

function Dashboard({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [active, setActive] = useState<SectionId>("dashboard"); const [reloadKey, setReloadKey] = useState(0); const [data, setData] = useState<JsonValue>(null); const [status, setStatus] = useState<"loading" | "ready" | "error">("loading"); const [error, setError] = useState("");
  const current = useMemo(() => sections.find(([id]) => id === active)!, [active]);
  useEffect(() => { document.title = `${current[1]} · Command Center`; }, [current]);
  useEffect(() => { const controller = new AbortController(); setStatus("loading"); setError(""); callRpc(session, current[3], {}, controller.signal).then((result) => { setData(result); setStatus("ready"); }).catch((cause) => { if (cause instanceof DOMException && cause.name === "AbortError") return; const message = cause instanceof Error ? cause.message : "LOAD_FAILED"; if (message === "SESSION_EXPIRED") onLogout(); else { setError("تعذر تحميل هذه الوحدة بأمان."); setStatus("error"); } }); return () => controller.abort(); }, [current, onLogout, reloadKey, session]);
  const modeLabel = active === "planner" || active === "crm" || active === "inbox" || active === "content" ? "CONTROLLED WRITE" : "READ ONLY";
  return <div className="app-shell"><a className="skip-link" href="#main-workspace">تجاوز إلى المحتوى الرئيسي</a><aside><div className="side-brand"><strong>Relax Fix AI OS</strong><span>{session.displayName} · {session.role}</span></div><nav aria-label="وحدات Command Center">{sections.map(([id, label, Icon]) => <button type="button" key={id} className={active === id ? "active" : ""} aria-current={active === id ? "page" : undefined} onClick={() => setActive(id)}><Icon size={18} aria-hidden="true" />{label}</button>)}</nav><button type="button" className="logout" onClick={onLogout}><LogOut size={18} aria-hidden="true" />تسجيل الخروج</button></aside><main className="workspace" id="main-workspace" tabIndex={-1}><p className="eyebrow">INTERNAL OPERATIONS · {modeLabel}</p><h1>{current[1]}</h1><section className="panel" aria-busy={status === "loading"}><div className="panel-heading"><div><h2>بيانات تشغيل حقيقية</h2><p>Supabase RPC محمي بهوية الموظف وصلاحيات قاعدة البيانات.</p></div><button type="button" className="refresh" disabled={status === "loading"} onClick={() => setReloadKey((value) => value + 1)}>تحديث</button></div>{status === "loading" && <p className="muted" role="status">جاري التحميل الآمن...</p>}{status === "error" && <div className="error-box" role="alert">{error}</div>}{status === "ready" && (active === "planner" ? <BookingView value={data} session={session} onChanged={() => setReloadKey((value) => value + 1)} onSessionExpired={onLogout} /> : active === "crm" ? <CRMView value={data} session={session} onChanged={() => setReloadKey((value) => value + 1)} onSessionExpired={onLogout} /> : active === "inbox" ? <AIInboxView value={data} session={session} onChanged={() => setReloadKey((value) => value + 1)} onSessionExpired={onLogout} /> : active === "content" ? <ContentStudioView value={data} session={session} onChanged={() => setReloadKey((value) => value + 1)} onSessionExpired={onLogout} /> : active === "media" ? <MediaLibraryView value={data} /> : active === "analytics" ? <AnalyticsView value={data} /> : active === "integrations" ? <IntegrationsView value={data} /> : <DataView value={data} />)}</section></main></div>;
}

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    try {
      const raw = sessionStorage.getItem("relaxfix-command-session");
      if (!raw) { setRestoring(false); return () => controller.abort(); }
      const stored = StoredSessionSchema.parse(JSON.parse(raw));
      restoreSession(stored.accessToken, controller.signal).then((restored) => {
        if (controller.signal.aborted) return;
        sessionStorage.setItem("relaxfix-command-session", JSON.stringify({ accessToken: restored.accessToken }));
        setSession(restored);
      }).catch((cause) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        sessionStorage.removeItem("relaxfix-command-session");
      }).finally(() => { if (!controller.signal.aborted) setRestoring(false); });
    } catch { sessionStorage.removeItem("relaxfix-command-session"); setRestoring(false); }
    return () => controller.abort();
  }, []);
  if (restoring) return <main className="login-page"><p className="muted" role="status">جاري التحقق من الجلسة والموظف النشط...</p></main>;
  if (!session) return <Login onAuthenticated={setSession} />;
  return <Dashboard session={session} onLogout={() => { sessionStorage.removeItem("relaxfix-command-session"); setSession(null); }} />;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
