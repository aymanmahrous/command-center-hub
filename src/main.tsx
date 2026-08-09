import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BarChart3, Bot, CalendarDays, ContactRound, Inbox, LayoutDashboard, Library, LogOut, Settings2, ShieldAlert, Workflow } from "lucide-react";
import { z } from "zod";
import { LanguageProvider, useLanguage } from "./i18n";
import type { Dictionary, Language } from "./i18n";
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
const PASSWORD_RESET_PATH = (import.meta.env.VITE_PASSWORD_RESET_PATH ?? "").trim();

const AUTH_MESSAGES = {
  CONFIGURATION_REQUIRED: "إعدادات الاتصال غير مكتملة أو غير آمنة. التطبيق مغلق بأمان.\nConnection settings are incomplete or unsafe. The application is securely locked.",
  INVALID_LOGIN: "البريد الإلكتروني أو كلمة المرور غير صحيحة.\nThe email or password is incorrect.",
  STAFF_ACCESS_DENIED: "هذا الحساب غير مفعّل للوصول إلى لوحة التحكم.\nThis account is not active for Command Center access.",
  SERVICE_UNAVAILABLE: "تعذر الاتصال بالخدمة. تحقق من الإنترنت ثم حاول لاحقًا.\nUnable to reach the service. Check your connection and try again later.",
  LOGIN_FAILED: "تعذر تسجيل الدخول. حاول مرة أخرى.\nSign-in failed. Please try again.",
  RESET_SUCCESS: "إذا كان البريد مسجلاً، فستصلك رسالة لإعادة تعيين كلمة المرور.\nIf the email is registered, a password reset message will be sent.",
} as const;

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
function passwordResetRedirect() {
  if (!PASSWORD_RESET_PATH) return null;
  if (!PASSWORD_RESET_PATH.startsWith("/")) throw new Error("CONFIGURATION_REQUIRED");
  return new URL(PASSWORD_RESET_PATH, window.location.origin).toString();
}

function authErrorCode(cause: unknown) {
  return cause instanceof Error ? cause.message : "LOGIN_FAILED";
}

function authMessage(code: string) {
  if (code === "CONFIGURATION_REQUIRED") return AUTH_MESSAGES.CONFIGURATION_REQUIRED;
  if (code === "INVALID_LOGIN") return AUTH_MESSAGES.INVALID_LOGIN;
  if (code === "STAFF_ACCESS_DENIED") return AUTH_MESSAGES.STAFF_ACCESS_DENIED;
  if (code === "NETWORK_UNAVAILABLE" || code === "SERVICE_UNAVAILABLE" || code === "TOO_MANY_ATTEMPTS") return AUTH_MESSAGES.SERVICE_UNAVAILABLE;
  return AUTH_MESSAGES.LOGIN_FAILED;
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
  let authResponse: Response;
  try {
    authResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_PUBLIC_KEY }, body: JSON.stringify({ email, password }) });
  } catch {
    throw new Error("NETWORK_UNAVAILABLE");
  }
  if (authResponse.status === 429) throw new Error("TOO_MANY_ATTEMPTS");
  if (authResponse.status === 401 || authResponse.status === 403) throw new Error("INVALID_LOGIN");
  if (authResponse.status >= 500) throw new Error("SERVICE_UNAVAILABLE");
  if (!authResponse.ok) throw new Error("INVALID_LOGIN");
  const auth = z.object({ access_token: z.string(), user: z.object({ id: z.string().uuid() }) }).parse(await authResponse.json());
  return loadStaffProfile(auth.access_token, auth.user.id);
}

async function requestPasswordReset(email: string): Promise<void> {
  if (!configurationReady()) throw new Error("CONFIGURATION_REQUIRED");
  const redirectTo = passwordResetRedirect();
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_PUBLIC_KEY },
      body: JSON.stringify({ email, ...(redirectTo ? { redirect_to: redirectTo } : {}) }),
    });
  } catch {
    throw new Error("NETWORK_UNAVAILABLE");
  }
  if (response.status === 429) throw new Error("TOO_MANY_ATTEMPTS");
  if (response.status === 401 || response.status === 403) throw new Error("SERVICE_UNAVAILABLE");
  if (response.status >= 500) throw new Error("SERVICE_UNAVAILABLE");
  if (!response.ok) throw new Error("LOGIN_FAILED");
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

function LanguageSwitcher({ onDark = false }: { onDark?: boolean }) {
  const { language, setLanguage, t } = useLanguage();
  const labels = t("language");
  return <div className={onDark ? "language-switcher on-dark" : "language-switcher"} role="group" aria-label={labels.switchLabel}>
    <button type="button" className={language === "ar" ? "active" : ""} aria-pressed={language === "ar"} onClick={() => setLanguage("ar")}>{labels.ar}</button>
    <button type="button" className={language === "en" ? "active" : ""} aria-pressed={language === "en"} onClick={() => setLanguage("en")}>{labels.en}</button>
  </div>;
}

function Login({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const { language, t } = useLanguage();
  const copy = t("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetNotice, setResetNotice] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResetError("");
    setResetNotice("");
    try {
      const session = await signIn(email.trim(), password);
      sessionStorage.setItem("relaxfix-command-session", JSON.stringify({ accessToken: session.accessToken }));
      onAuthenticated(session);
    } catch (cause) {
      setError(authMessage(authErrorCode(cause)));
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    setResetBusy(true);
    setResetError("");
    setResetNotice("");
    try {
      await requestPasswordReset(email.trim());
      setResetNotice(AUTH_MESSAGES.RESET_SUCCESS);
    } catch (cause) {
      setResetError(authMessage(authErrorCode(cause)));
    } finally {
      setResetBusy(false);
    }
  }

  return <main className="login-page"><section className="login-card" aria-busy={busy || resetBusy}><div className="login-card-top"><div className="brand-mark"><ShieldAlert size={28} /></div><LanguageSwitcher /></div><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p className="muted">{copy.subtitle}</p><form onSubmit={submit}><label>{copy.emailLabel}<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>{copy.passwordLabel}<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label><button type="button" className="text-button forgot-password" disabled={busy || resetBusy} onClick={() => void forgotPassword()}>{language === "ar" ? <span lang="ar" dir="rtl">نسيت كلمة المرور؟</span> : <span lang="en" dir="ltr">Forgot password?</span>}</button>{resetNotice && <div className="notice-box" role="status">{resetNotice}</div>}{resetError && <div className="error-box" role="alert">{resetError}</div>}{error && <div className="error-box" role="alert">{error}</div>}<button disabled={busy || resetBusy}>{busy ? copy.submitting : copy.submit}</button></form><p className="security-note">{copy.securityNote}</p></section></main>;
}

const ID_LIKE_PATTERN = /^[0-9a-fA-F-]{16,}$/;

function DataLeaf({ value }: { value: JsonValue }) {
  const text = String(value ?? "—");
  if (typeof value === "string" && (ID_LIKE_PATTERN.test(value) || value.length > 40)) return <span className="id-text" title={text}>{text}</span>;
  return <span>{text}</span>;
}

function DataView({ value }: { value: JsonValue }) {
  const { t } = useLanguage();
  if (Array.isArray(value)) {
    if (value.length === 0) return <p className="muted">{t("common").noData}</p>;
    if (value.every((item) => item === null || typeof item !== "object")) return <div className="chip-list">{value.map((item, index) => <span className="chip" key={index}><DataLeaf value={item} /></span>)}</div>;
    return <div className="data-grid">{value.map((item, index) => <article className="data-card" key={index}><DataView value={item} /></article>)}</div>;
  }
  if (value && typeof value === "object") return <dl className="record">{Object.entries(value).map(([key, item]) => <React.Fragment key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{typeof item === "object" && item !== null ? <DataView value={item} /> : <DataLeaf value={item} />}</dd></React.Fragment>)}</dl>;
  return <DataLeaf value={value} />;
}

function AutomationsView({ value }: { value: JsonValue }) {
  const { t } = useLanguage();
  const copy = t("automations");
  const isEmpty = value === null || (Array.isArray(value) && value.length === 0) || (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0);
  return <div className="automations-view">
    <div className="operations-boundary"><div><strong>{copy.bannerTitle}</strong><p>{copy.bannerText}</p></div></div>
    {isEmpty ? <p className="muted">{copy.empty}</p> : <DataView value={value} />}
  </div>;
}

const conversationModeLabels: Record<Language, Record<ConversationMode, string>> = {
  ar: { ai_active: "الذكاء الاصطناعي نشط", human_required: "مراجعة بشرية مطلوبة", human_takeover: "استلام بشري", paused: "متوقفة مؤقتًا" },
  en: { ai_active: "AI active", human_required: "Human review required", human_takeover: "Human takeover", paused: "Paused" },
};

function AIInboxView({ value, session, onChanged, onSessionExpired }: { value: JsonValue; session: Session; onChanged: () => void; onSessionExpired: () => void }) {
  const { language, t } = useLanguage();
  const copy = t("inbox");
  const modeLabels = conversationModeLabels[language];
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

  if (!parsed.success) return <div className="error-box">{copy.invalidFormat}</div>;
  if (conversations.length === 0) return <p className="muted">{copy.noConversations}</p>;

  async function changeMode(conversation: z.infer<typeof ConversationSchema>, next: ConversationMode) {
    if (!canWrite || busyId || conversation.mode === next) return;
    const confirmMessage = language === "ar"
      ? `تأكيد تغيير وضع محادثة ${conversation.leadName} من «${modeLabels[conversation.mode]}» إلى «${modeLabels[next]}»؟ سيتم تسجيل العملية في Audit Log.`
      : `Change ${conversation.leadName}'s mode from "${modeLabels[conversation.mode]}" to "${modeLabels[next]}"? Recorded in the Audit Log.`;
    if (!window.confirm(confirmMessage)) return;
    setBusyId(conversation.id); setNotice("");
    try {
      await setConversationMode(session, conversation.id, next);
      setNotice(language === "ar" ? "تم تحديث وضع المحادثة وتسجيل العملية بنجاح." : "Mode updated and recorded.");
      onChanged();
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "UPDATE_FAILED";
      const messagesByCode: Record<string, string> = language === "ar" ? {
        INVALID_MODE: "وضع المحادثة المطلوب غير مسموح.",
        NOT_FOUND: "المحادثة لم تعد موجودة.",
        STAFF_ACCESS_DENIED: "ليست لديك صلاحية تنفيذ هذا التغيير.",
      } : {
        INVALID_MODE: "That mode isn't allowed.",
        NOT_FOUND: "This conversation no longer exists.",
        STAFF_ACCESS_DENIED: "You don't have permission for this.",
      };
      if (code === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setNotice(messagesByCode[code] ?? (language === "ar" ? "تعذر التحديث بأمان؛ لم يتم اعتماد أي تغيير غير مؤكد." : "Update failed safely; no change was made."));
    } finally { setBusyId(null); }
  }

  return <>
    <div className="write-banner"><strong>{copy.writeBannerTitle}</strong><span>{copy.writeBannerSubtitle}</span></div>
    {notice && <div className="notice-box" aria-live="polite">{notice}</div>}
    <div className="inbox-layout">
      <div className="conversation-list" aria-label={copy.listAriaLabel}>
        {conversations.map((conversation) => <button type="button" key={conversation.id} className={selectedId === conversation.id ? "selected" : ""} onClick={() => { setSelectedId(conversation.id); setNotice(""); }}>
          <span><strong>{conversation.leadName}</strong>{conversation.unread > 0 && <b className="unread-count">{conversation.unread}</b>}</span>
          <small>{conversation.lastMessage || copy.noMessages}</small>
          <em>{conversation.channel} · {modeLabels[conversation.mode]}</em>
        </button>)}
      </div>
      <section className="conversation-panel">
        <header>
          <div><h3>{selected?.leadName ?? copy.selectConversation}</h3>{selected && <p>Score {selected.leadScore}/100 · {selected.intent}</p>}</div>
          {selected && <label>{copy.modeLabel}<select value={selected.mode} disabled={!canWrite || busyId !== null} onChange={(event) => void changeMode(selected, event.target.value as ConversationMode)}>{(Object.keys(modeLabels) as ConversationMode[]).map((mode) => <option key={mode} value={mode}>{modeLabels[mode]}</option>)}</select></label>}
        </header>
        {selected?.humanRequired && <div className="human-alert">{copy.humanRequiredAlert}</div>}
        <div className="message-stream">
          {messageStatus === "loading" && <p className="muted">{copy.loadingMessages}</p>}
          {messageStatus === "error" && <div className="error-box">{copy.loadMessagesError}</div>}
          {messageStatus === "ready" && messages.length === 0 && <p className="muted">{copy.noMessagesInConversation}</p>}
          {messages.map((message) => <article key={message.id} className={`message-bubble ${message.direction === "outbound" ? "outbound" : "inbound"}`}>
            <p>{message.body}</p><small>{message.authorType}{message.safetyClassification ? ` · ${message.safetyClassification}` : ""} · {new Date(message.createdAt).toLocaleString(language === "ar" ? "ar-AE" : "en-AE")}</small>
          </article>)}
        </div>
        {!canWrite && <p className="read-only-note">{copy.readOnlyNote}</p>}
        {busyId === selected?.id && <p className="muted">{copy.savingChange}</p>}
      </section>
    </div>
  </>;
}

const leadStageLabels: Record<Language, Record<LeadStage, string>> = {
  ar: { new: "جديد", contacted: "تم التواصل", qualified: "مؤهل", booking_intent: "نية حجز", booked: "محجوز", follow_up: "متابعة", lost: "فاقد", customer: "عميل" },
  en: { new: "New", contacted: "Contacted", qualified: "Qualified", booking_intent: "Booking intent", booked: "Booked", follow_up: "Follow-up", lost: "Lost", customer: "Customer" },
};

function CRMView({ value, session, onChanged, onSessionExpired }: { value: JsonValue; session: Session; onChanged: () => void; onSessionExpired: () => void }) {
  const { language, t } = useLanguage();
  const copy = t("crm");
  const stageLabels = leadStageLabels[language];
  const parsed = z.array(LeadSchema).safeParse(value);
  const [busyId, setBusyId] = useState<string | null>(null); const [notice, setNotice] = useState("");
  const canWrite = ["super_admin", "admin", "reception", "coach"].includes(session.role);
  if (!parsed.success) return <div className="error-box">{copy.invalidFormat}</div>;
  if (parsed.data.length === 0) return <p className="muted">{copy.noLeads}</p>;
  async function save(lead: z.infer<typeof LeadSchema>, form: HTMLFormElement) {
    if (!canWrite || busyId) return;
    const data = new FormData(form); const stage = String(data.get("stage")) as LeadStage;
    const humanRequired = data.get("humanRequired") === "on"; const doNotContact = data.get("doNotContact") === "on";
    const localFollowUp = String(data.get("nextFollowUpAt") ?? "").trim();
    const followUpDate = localFollowUp ? new Date(localFollowUp) : null;
    if (followUpDate && Number.isNaN(followUpDate.getTime())) { setNotice(copy.invalidFollowUp); return; }
    const nextFollowUpAt = followUpDate?.toISOString() ?? null;
    const confirmMessage = language === "ar"
      ? `تأكيد تحديث مسار ${lead.name}؟ سيتم تطبيق قواعد المتابعة وتسجيل العملية في Audit Log.`
      : `Update ${lead.name}'s stage? Follow-up rules apply. Recorded in the Audit Log.`;
    if (!window.confirm(confirmMessage)) return;
    setBusyId(lead.id); setNotice("");
    try { await updateLeadWorkflow(session, lead.id, stage, humanRequired, doNotContact, nextFollowUpAt); setNotice(language === "ar" ? "تم تحديث مسار العميل وتسجيل العملية بنجاح." : "Stage updated and recorded."); onChanged(); }
    catch (cause) {
      const code = cause instanceof Error ? cause.message : "UPDATE_FAILED";
      if (code === "SESSION_EXPIRED") { onSessionExpired(); return; }
      const messages: Record<string, string> = language === "ar" ? {
        INVALID_FOLLOW_UP_TIME: "موعد المتابعة يجب أن يكون في المستقبل.", FOLLOW_UP_TOO_FAR: "موعد المتابعة يتجاوز الحد المسموح.",
        FOLLOW_UP_LIMIT_REACHED: "تم بلوغ الحد الأقصى لمحاولات المتابعة.", STAFF_ACCESS_DENIED: "ليست لديك صلاحية تنفيذ هذا التغيير.",
      } : {
        INVALID_FOLLOW_UP_TIME: "Follow-up time must be in the future.", FOLLOW_UP_TOO_FAR: "Follow-up time exceeds the allowed limit.",
        FOLLOW_UP_LIMIT_REACHED: "Max follow-up attempts reached.", STAFF_ACCESS_DENIED: "You don't have permission for this.",
      };
      setNotice(messages[code] ?? (language === "ar" ? "تعذر التحديث بأمان؛ لم يتم اعتماد أي تغيير غير مؤكد." : "Update failed safely; no change was made."));
    } finally { setBusyId(null); }
  }
  return <><div className="write-banner"><strong>{copy.writeBannerTitle}</strong><span>{copy.writeBannerSubtitle}</span></div>{notice && <div className="notice-box" aria-live="polite">{notice}</div>}<div className="data-grid">{parsed.data.map((lead) => {
    const followUpLocal = formatLocalDateTimeInput(lead.nextFollowUpAt ?? null);
    return <article className="data-card booking-card" key={lead.id}><h3>{lead.name}</h3><p>{lead.phone ?? copy.noPhone} · {lead.channel ?? copy.unknownChannel}</p><p>{lead.intent ?? copy.unclassified} · Score: {lead.score ?? "—"}</p><form aria-busy={busyId === lead.id} onSubmit={(event) => { event.preventDefault(); void save(lead, event.currentTarget); }}><label>{copy.stageLabel}<select name="stage" defaultValue={lead.stage} disabled={!canWrite || busyId !== null}>{(["new", "contacted", "qualified", "booking_intent", "booked", "follow_up", "lost", "customer"] as const).map((stage) => <option key={stage} value={stage}>{stageLabels[stage]}</option>)}</select></label><label>{copy.nextFollowUpLabel}<input name="nextFollowUpAt" type="datetime-local" defaultValue={followUpLocal} disabled={!canWrite || busyId !== null} /></label><label><input name="humanRequired" type="checkbox" defaultChecked={lead.humanRequired} disabled={!canWrite || busyId !== null} /> {copy.humanRequiredLabel}</label><label><input name="doNotContact" type="checkbox" defaultChecked={lead.doNotContact} disabled={!canWrite || busyId !== null} /> {copy.doNotContactLabel}</label><button disabled={!canWrite || busyId !== null}>{busyId === lead.id ? t("common").saving : copy.saveButton}</button></form>{!canWrite && <small>{t("common").readOnlyNote}</small>}</article>;
  })}</div></>;
}

const contentStatusLabels: Record<Language, Record<ContentStatus, string>> = {
  ar: { idea: "فكرة", draft: "مسودة", generated: "مولّد", needs_review: "بانتظار المراجعة", approved: "معتمد", scheduled: "مجدول", published: "منشور", failed: "فشل" },
  en: { idea: "Idea", draft: "Draft", generated: "Generated", needs_review: "Needs review", approved: "Approved", scheduled: "Scheduled", published: "Published", failed: "Failed" },
};

const contentActionLabels: Record<ContentAction, string> = {
  approve: "اعتماد المحتوى", return_to_review: "إعادة للمراجعة", schedule: "جدولة", unschedule: "إلغاء الجدولة",
};
const contentActionLabelsEn: Record<ContentAction, string> = {
  approve: "Approve content", return_to_review: "Return to review", schedule: "Schedule", unschedule: "Unschedule",
};

function contentErrorMessage(language: Language, code: string) {
  const messages: Record<string, string> = language === "ar" ? {
    STAFF_ACCESS_DENIED: "ليست لديك صلاحية تنفيذ هذا التغيير.", NOT_FOUND: "عنصر المحتوى لم يعد موجودًا.",
    PUBLISHED_CONTENT_IMMUTABLE: "المحتوى المنشور غير قابل للتحرير.", INVALID_CAPTION: "النص مطلوب ويجب ألا يتجاوز 5000 حرف.",
    CONTENT_FIELD_TOO_LONG: "أحد الحقول يتجاوز الحد المسموح.", TOO_MANY_HASHTAGS: "الحد الأقصى 30 وسمًا.",
    INVALID_HASHTAG: "أحد الوسوم غير صالح أو يتجاوز 100 حرف.", INVALID_TRANSITION: "هذا الانتقال غير مسموح للحالة الحالية.",
    APPROVAL_REQUIRED: "يجب اعتماد المحتوى قبل الجدولة.", INVALID_SCHEDULE_TIME: "وقت الجدولة يجب أن يكون في المستقبل.",
    SCHEDULE_TOO_FAR: "لا يمكن الجدولة لأكثر من 366 يومًا.", INVALID_ACTION: "الإجراء المطلوب غير مسموح.",
  } : {
    STAFF_ACCESS_DENIED: "You don't have permission for this.", NOT_FOUND: "This content item no longer exists.",
    PUBLISHED_CONTENT_IMMUTABLE: "Published content can't be edited.", INVALID_CAPTION: "Caption is required, max 5000 characters.",
    CONTENT_FIELD_TOO_LONG: "One field exceeds the allowed length.", TOO_MANY_HASHTAGS: "Max 30 hashtags.",
    INVALID_HASHTAG: "A hashtag is invalid or over 100 characters.", INVALID_TRANSITION: "Not allowed for the current status.",
    APPROVAL_REQUIRED: "Content must be approved before scheduling.", INVALID_SCHEDULE_TIME: "Scheduled time must be in the future.",
    SCHEDULE_TOO_FAR: "Can't schedule more than 366 days ahead.", INVALID_ACTION: "This action isn't allowed.",
  };
  return messages[code] ?? (language === "ar" ? "تعذر تنفيذ التغيير بأمان؛ لم يتم اعتماد أي تغيير غير مؤكد." : "Update failed safely; no change was made.");
}

function ContentStudioView({ value, session, onChanged, onSessionExpired }: { value: JsonValue; session: Session; onChanged: () => void; onSessionExpired: () => void }) {
  const { language, t } = useLanguage();
  const copy = t("content");
  const statusLabels = contentStatusLabels[language];
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

  if (!parsed.success) return <div className="error-box">{copy.invalidFormat}</div>;

  async function runMutation(itemId: string, operation: () => Promise<unknown>, successMessage: string) {
    if (!canWrite || busyId) return;
    setBusyId(itemId); setNotice("");
    try { await operation(); setNotice(successMessage); onChanged(); }
    catch (cause) {
      const code = cause instanceof Error ? cause.message : "UPDATE_FAILED";
      if (code === "SESSION_EXPIRED") { onSessionExpired(); return; }
      setNotice(contentErrorMessage(language, code));
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
    if (unchanged) { setNotice(copy.noChanges); return; }
    if (fields.caption.length < 2 || fields.caption.length > 5000 || fields.hashtags.length > 30) { setNotice(copy.checkFieldLengths); return; }
    const confirmMessage = language === "ar"
      ? `تأكيد حفظ تعديلات «${item.topic || "محتوى بدون عنوان"}»؟${item.status === "scheduled" ? " سيؤدي التحرير إلى إلغاء الجدولة وإعادة العنصر للمراجعة." : " سيعود العنصر إلى المراجعة."} سيتم تسجيل العملية في Audit Log.`
      : `Save changes to "${item.topic || copy.untitled}"?${item.status === "scheduled" ? " Unschedules and returns to review." : " Returns to review."} Recorded in the Audit Log.`;
    if (!window.confirm(confirmMessage)) return;
    await runMutation(item.id, () => updateContentItem(session, item.id, fields), language === "ar" ? "تم حفظ المحتوى وإعادته للمراجعة مع تسجيل العملية." : "Saved, returned to review, and recorded.");
  }

  async function transition(item: z.infer<typeof ContentItemSchema>, action: ContentAction, form: HTMLFormElement) {
    if (!canWrite || busyId) return;
    let scheduledFor: string | null = null;
    if (action === "schedule") {
      const localValue = String(new FormData(form).get("scheduledFor") ?? "").trim();
      if (!localValue) { setNotice(copy.pickScheduleTime); return; }
      const date = new Date(localValue);
      if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) { setNotice(copy.scheduleMustBeFuture); return; }
      scheduledFor = date.toISOString();
    }
    if ((action === "approve" && item.status === "approved") || (action === "return_to_review" && item.status === "needs_review")) return;
    const confirmMessage = language === "ar"
      ? `تأكيد «${contentActionLabels[action]}» للعنصر «${item.topic || "محتوى بدون عنوان"}»؟ سيتم تسجيل العملية في Audit Log.`
      : `"${contentActionLabelsEn[action]}" for "${item.topic || copy.untitled}"? Recorded in the Audit Log.`;
    if (!window.confirm(confirmMessage)) return;
    await runMutation(item.id, () => transitionContentItem(session, item.id, action, scheduledFor), language === "ar" ? `تم تنفيذ «${contentActionLabels[action]}» وتسجيل العملية بنجاح.` : `"${contentActionLabelsEn[action]}" completed and recorded.`);
  }

  return <>
    <div className="write-banner"><strong>{copy.writeBannerTitle}</strong><span>{copy.writeBannerSubtitle}</span></div>
    {notice && <div className="notice-box" aria-live="polite">{notice}</div>}
    <div className="content-toolbar">
      <label>{t("common").search}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} /></label>
      <label>{t("common").status}<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ContentStatus | "all")}><option value="all">{copy.allStatuses}</option>{(Object.keys(statusLabels) as ContentStatus[]).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
      <span>{filteredItems.length} {t("common").of} {items.length}</span>
    </div>
    {items.length === 0 && <p className="muted">{copy.noItems}</p>}
    {items.length > 0 && filteredItems.length === 0 && <p className="muted">{t("common").noResults}</p>}
    <div className="content-list">{filteredItems.map((item) => {
      const scheduledLocal = formatLocalDateTimeInput(item.scheduledFor);
      const locked = busyId !== null || !canWrite || item.status === "published";
      return <article className="content-card" key={item.id}>
        <header><div><span>{item.platform} · {item.contentType}</span><h3>{item.topic || copy.untitled}</h3></div><span className={`content-status status-${item.status}`}>{statusLabels[item.status]}</span></header>
        <form onSubmit={(event) => { event.preventDefault(); void save(item, event.currentTarget); }}>
          <div className="content-fields"><label>{copy.topicLabel}<input name="topic" defaultValue={item.topic} maxLength={300} disabled={locked} /></label><label>{copy.hookLabel}<input name="hook" defaultValue={item.hook} maxLength={500} disabled={locked} /></label></div>
          <label>{copy.captionLabel}<textarea name="caption" defaultValue={item.caption} minLength={2} maxLength={5000} rows={6} required disabled={locked} /></label>
          <div className="content-fields"><label>{copy.ctaLabel}<input name="cta" defaultValue={item.cta} maxLength={500} disabled={locked} /></label><label>{copy.hashtagsLabel}<input name="hashtags" defaultValue={item.hashtags.join(", ")} disabled={locked} /></label></div>
          <label>{copy.visualPromptLabel}<textarea name="visualPrompt" defaultValue={item.visualPrompt} maxLength={2000} rows={3} disabled={locked} /></label>
          <button type="submit" disabled={locked}>{busyId === item.id ? t("common").saving : copy.saveButton}</button>
        </form>
        <form className="content-actions" onSubmit={(event) => event.preventDefault()}>
          <label>{copy.scheduleTimeLabel}<input name="scheduledFor" type="datetime-local" defaultValue={scheduledLocal} disabled={!canWrite || busyId !== null || !["approved", "scheduled"].includes(item.status)} /></label>
          <div>
            {["draft", "generated", "needs_review"].includes(item.status) && <button type="button" disabled={!canWrite || busyId !== null} onClick={(event) => void transition(item, "approve", event.currentTarget.form!)}>{copy.approveButton}</button>}
            {["draft", "generated", "approved", "scheduled", "failed"].includes(item.status) && <button type="button" className="secondary" disabled={!canWrite || busyId !== null} onClick={(event) => void transition(item, "return_to_review", event.currentTarget.form!)}>{copy.returnToReviewButton}</button>}
            {["approved", "scheduled"].includes(item.status) && <button type="button" disabled={!canWrite || busyId !== null} onClick={(event) => void transition(item, "schedule", event.currentTarget.form!)}>{item.status === "scheduled" ? copy.rescheduleButton : copy.scheduleButton}</button>}
            {item.status === "scheduled" && <button type="button" className="secondary" disabled={!canWrite || busyId !== null} onClick={(event) => void transition(item, "unschedule", event.currentTarget.form!)}>{copy.unscheduleButton}</button>}
          </div>
        </form>
        <footer><span>{copy.lastUpdated}: {formatBookingDateTime(language, item.updatedAt)}</span>{item.publishedAt && <span>{copy.published}: {formatBookingDateTime(language, item.publishedAt)}</span>}{!canWrite && <span>{t("common").readOnlyNote}</span>}{item.status === "published" && <span>{copy.publishedLocked}</span>}</footer>
      </article>;
    })}</div>
  </>;
}

const mediaTypeLabels: Record<Language, Record<MediaAssetType, string>> = {
  ar: { image: "صورة", video: "فيديو", logo: "شعار", other: "مستند" },
  en: { image: "Image", video: "Video", logo: "Logo", other: "Document" },
};
const mediaSourceLabels: Record<Language, Record<MediaSource, string>> = {
  ar: { upload: "رفع موظف", ai_generated: "مولّد بالذكاء الاصطناعي", external: "مصدر خارجي" },
  en: { upload: "Staff upload", ai_generated: "AI generated", external: "External source" },
};

function mediaFileName(language: Language, copy: Dictionary["media"], storagePath: string | null, metadata: Record<string, unknown> = {}) {
  const metadataName = typeof metadata.file_name === "string" ? metadata.file_name.trim() : "";
  if (metadataName) return metadataName;
  if (!storagePath) return copy.noSavedFile;
  return storagePath.split("/").filter(Boolean).at(-1) ?? copy.privateFile;
}

function mediaPreviewHint(language: Language, copy: Dictionary["media"], assetType: MediaAssetType) {
  if (assetType === "video") return language === "ar" ? "معاينة خاصة غير مكشوفة" : "Private preview, not disclosed";
  if (assetType === "other") return copy.documentPreviewPrivate;
  return language === "ar" ? "معاينة خاصة غير مكشوفة" : "Private preview, not disclosed";
}

function mediaMetadataSummary(copy: Dictionary["media"], metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata);
  if (entries.length === 0) return copy.noMetadata;
  return entries.slice(0, 6).map(([key, value]) => {
    const rendered = typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : copy.compositeData;
    return `${key.replaceAll("_", " ")}: ${rendered.slice(0, 120)}`;
  }).join(" · ");
}

function MediaLibraryView({ value }: { value: JsonValue }) {
  const { language, t } = useLanguage();
  const copy = t("media");
  const typeLabels = mediaTypeLabels[language];
  const sourceLabels = mediaSourceLabels[language];
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
      return [mediaFileName(language, copy, asset.storagePath, asset.metadata), asset.provider, asset.providerJobId, asset.prompt, asset.contentItemId, mediaMetadataSummary(copy, asset.metadata)]
        .filter((field): field is string => Boolean(field))
        .some((field) => field.toLocaleLowerCase("ar").includes(normalized));
    });
  }, [assets, copy, language, query, sourceFilter, typeFilter]);

  if (!parsed.success) return <div className="error-box">{copy.invalidFormat}</div>;

  return <>
    <div className="media-security-banner"><strong>{language === "ar" ? "مكتبة وسائط خاصة للقراءة فقط" : "Private read-only media library"}</strong><span>{copy.bannerSubtitle}</span></div>
    <div className="media-summary" aria-label={language === "ar" ? "ملخص أنواع الوسائط" : "Media type summary"}>
      <button type="button" className={typeFilter === "all" ? "active" : ""} onClick={() => setTypeFilter("all")}><span>{copy.allLabel}</span><strong>{assets.length}</strong></button>
      {(Object.keys(typeLabels) as MediaAssetType[]).map((type) => <button type="button" key={type} className={typeFilter === type ? "active" : ""} onClick={() => setTypeFilter(type)}><span>{typeLabels[type]}</span><strong>{counts[type]}</strong></button>)}
    </div>
    <div className="media-toolbar">
      <label>{t("common").search}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} /></label>
      <label>{copy.sourceLabel}<select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as MediaSource | "all")}><option value="all">{copy.allSources}</option>{(Object.keys(sourceLabels) as MediaSource[]).map((source) => <option key={source} value={source}>{sourceLabels[source]}</option>)}</select></label>
      <span>{filteredAssets.length} {t("common").of} {assets.length}</span>
    </div>
    {assets.length === 0 && <p className="muted">{copy.noAssets}</p>}
    {assets.length > 0 && filteredAssets.length === 0 && <p className="muted">{copy.noResults}</p>}
    <div className="media-grid">{filteredAssets.map((asset) => <article className="media-card" key={asset.id}>
      <div className={`media-placeholder media-${asset.assetType}`}><Library size={26} /><span>{typeLabels[asset.assetType]}</span><small>{mediaPreviewHint(language, copy, asset.assetType)}</small></div>
      <div className="media-details">
        <header><div><span>{sourceLabels[asset.source]}</span><h3>{mediaFileName(language, copy, asset.storagePath, asset.metadata)}</h3></div><span className="private-badge">{copy.privateBadge}</span></header>
        <dl>
          <div><dt>{copy.providerLabel}</dt><dd>{asset.provider || copy.internalUnspecified}</dd></div>
          <div><dt>{copy.createdLabel}</dt><dd>{formatBookingDateTime(language, asset.createdAt)}</dd></div>
          <div><dt>{copy.contentItemLabel}</dt><dd>{asset.contentItemId ?? t("common").unlinked}</dd></div>
          <div><dt>{copy.providerJobLabel}</dt><dd>{asset.providerJobId ?? t("common").unavailable}</dd></div>
        </dl>
        {asset.prompt && <div className="media-prompt"><strong>{copy.generationDescription}</strong><p>{asset.prompt}</p></div>}
        <p className="media-metadata">{mediaMetadataSummary(copy, asset.metadata)}</p>
      </div>
    </article>)}</div>
  </>;
}

function safeRatio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

function AnalyticsView({ value }: { value: JsonValue }) {
  const { language, t } = useLanguage();
  const copy = t("analytics");
  const analyticsNumber = useMemo(() => new Intl.NumberFormat(language === "ar" ? "ar-AE" : "en-AE", { maximumFractionDigits: 0 }), [language]);
  const analyticsPercent = useMemo(() => new Intl.NumberFormat(language === "ar" ? "ar-AE" : "en-AE", { style: "percent", maximumFractionDigits: 1 }), [language]);
  const parsed = AnalyticsSchema.safeParse(value);
  if (!parsed.success) return <div className="error-box">{copy.invalidFormat}</div>;
  const analytics = parsed.data;
  const publishedShare = safeRatio(analytics.publishedItems, analytics.contentItems);
  const dmRate = safeRatio(analytics.dms, analytics.views);

  return <>
    <div className={`analytics-trust ${analytics.attributionReady ? "ready" : "limited"}`}>
      <div><strong>{analytics.attributionReady ? (language === "ar" ? "Attribution متاح" : "Attribution available") : (language === "ar" ? "Attribution غير مكتمل" : "Attribution incomplete")}</strong><p>{analytics.attributionReady ? (language === "ar" ? "يمكن ربط النتائج بالمصادر وفق العقد الحالي." : "Results can be linked to sources under the current contract.") : (language === "ar" ? "المؤشرات إجماليات تشغيلية مستقلة؛ لا تُفسر كتحويلات منسوبة لحملة أو منشور." : "These figures are independent operational totals; do not interpret them as conversions attributed to a campaign or post.")}</p></div>
      <span>{analytics.attributionReady ? copy.attributionReadyBadge : copy.attributionLimitedBadge}</span>
    </div>
    <div className="analytics-groups">
      <section><header><div><p>{copy.audienceGroupEyebrow}</p><h3>{copy.audienceGroupTitle}</h3></div><BarChart3 size={24} /></header><div className="analytics-metrics"><article><span>{copy.viewsLabel}</span><strong>{analyticsNumber.format(analytics.views)}</strong><small>{copy.viewsHint}</small></article><article><span>{copy.dmsLabel}</span><strong>{analyticsNumber.format(analytics.dms)}</strong><small>{dmRate == null ? copy.dmRateNoViews : `${analyticsPercent.format(dmRate)} ${copy.dmRateHint}`}</small></article></div></section>
      <section><header><div><p>{copy.leadsGroupEyebrow}</p><h3>{copy.leadsGroupTitle}</h3></div><ContactRound size={24} /></header><div className="analytics-metrics"><article><span>{copy.qualifiedLeadsLabel}</span><strong>{analyticsNumber.format(analytics.qualifiedLeads)}</strong><small>{copy.qualifiedLeadsHint}</small></article><article><span>{copy.bookingRequestsLabel}</span><strong>{analyticsNumber.format(analytics.bookingRequests)}</strong><small>{language === "ar" ? "إجمالي مستقل، غير منسوب للعملاء المؤهلين" : "Independent total, not attributed to qualified leads"}</small></article></div></section>
      <section><header><div><p>{copy.contentGroupEyebrow}</p><h3>{copy.contentGroupTitle}</h3></div><Bot size={24} /></header><div className="analytics-metrics"><article><span>{copy.totalContentLabel}</span><strong>{analyticsNumber.format(analytics.contentItems)}</strong><small>{copy.totalContentHint}</small></article><article><span>{copy.publishedLabel}</span><strong>{analyticsNumber.format(analytics.publishedItems)}</strong><small>{publishedShare == null ? copy.publishedNoContentHint : `${analyticsPercent.format(publishedShare)} ${copy.publishedShareHint}`}</small></article></div>{publishedShare != null && <progress className="analytics-progress" value={Math.min(publishedShare, 1)} max={1} aria-label={`${copy.publishedShareAria} ${analyticsPercent.format(publishedShare)}`}>{analyticsPercent.format(publishedShare)}</progress>}</section>
    </div>
    <div className="analytics-methodology"><strong>{copy.methodologyTitle}</strong><p>{analytics.note}</p><small>{copy.methodologyFootnote}</small></div>
  </>;
}

const jobStatusLabels: Record<Language, Record<JobStatus, string>> = {
  ar: { queued: "في الانتظار", processing: "قيد التنفيذ", completed: "مكتملة", failed: "فشلت", retrying: "إعادة محاولة", dead: "متوقفة نهائيًا" },
  en: { queued: "Queued", processing: "Processing", completed: "Completed", failed: "Failed", retrying: "Retrying", dead: "Dead" },
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
  const { language, t } = useLanguage();
  const copy = t("integrations");
  const statusLabels = jobStatusLabels[language];
  const parsed = useMemo(() => OperationsQueueSchema.safeParse(value), [value]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  if (!parsed.success) return <div className="error-box">{copy.invalidFormat}</div>;

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
    <div className="operations-boundary"><div><strong>{copy.boundaryTitle}</strong><p>{language === "ar" ? "تعكس طوابير المتابعة والمهام الداخلية المسجلة في آخر لقطة، ولا تثبت اتصال مزود خارجي لحظيًا." : "Reflects follow-up and internal job queues recorded in the latest snapshot; it does not prove a live external provider connection."}</p></div><span>{language === "ar" ? "لا توجد أوامر Retry أو Cancel" : "No Retry or Cancel commands are available here"}</span></div>
    <div className="operations-summary" aria-label={language === "ar" ? "ملخص صحة العمليات" : "Operations health summary"}>
      <button type="button" className={statusFilter === "all" ? "active" : ""} onClick={() => setStatusFilter("all")}><span>{copy.totalRecords}</span><strong>{allJobs.length}</strong></button>
      <button type="button" className={statusFilter === "processing" ? "active" : ""} onClick={() => setStatusFilter("processing")}><span>{copy.processing}</span><strong>{counts.processing}</strong></button>
      <button type="button" className={statusFilter === "retrying" ? "active" : ""} onClick={() => setStatusFilter("retrying")}><span>{copy.retrying}</span><strong>{counts.retrying}</strong></button>
      <button type="button" className={statusFilter === "failed" ? "active danger" : ""} onClick={() => setStatusFilter("failed")}><span>{copy.failedInspectable}</span><strong>{counts.failed}</strong></button>
      <div className={attentionCount > 0 ? "summary-alert danger" : "summary-alert"}><span>{copy.attentionNeeded}</span><strong>{attentionCount}</strong><small>Failed + Dead</small></div>
      <div className={overdueFollowUps > 0 ? "summary-alert warning" : "summary-alert"}><span>{language === "ar" ? "متابعات متأخرة" : "Overdue follow-ups"}</span><strong>{overdueFollowUps}</strong><small>Queued / Retrying</small></div>
    </div>
    <div className="operations-toolbar"><label htmlFor="operations-search">{copy.searchLabel}<input id="operations-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} /></label><label htmlFor="operations-status">{copy.statusLabel}<select id="operations-status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as JobStatus | "all")}><option value="all">{copy.allStatuses}</option>{(Object.keys(statusLabels) as JobStatus[]).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label></div>
    <div className="operations-columns">
      <section><header><div><p>{copy.followUpQueueEyebrow}</p><h3>{copy.followUpQueueTitle}</h3></div><span>{followUps.length} {t("common").of} {operations.followUps.length}</span></header>
        {followUps.length === 0 && <p className="muted">{copy.noFollowUps}</p>}
        <div className="operations-list">{followUps.map((job) => {
          const overdue = ["queued", "retrying"].includes(job.status) && isPast(job.scheduledFor, now);
          return <article key={job.id}><header><div><h4>{job.leadName}</h4><small>{copy.attemptLabel} {job.attemptNumber}</small></div><span className={`job-status job-${job.status}`}>{statusLabels[job.status]}</span></header><dl><div><dt>{copy.scheduledForLabel}</dt><dd>{formatBookingDateTime(language, job.scheduledFor)}</dd></div><div><dt>{copy.conversationLabel}</dt><dd>{job.conversationId ?? t("common").unlinked}</dd></div><div><dt>{copy.createdLabel}</dt><dd>{formatBookingDateTime(language, job.createdAt)}</dd></div></dl>{overdue && <p className="operation-warning">{copy.overdueWarning}</p>}{job.stoppedReason && <p className="operation-error"><strong>{copy.stoppedReasonLabel}</strong> {boundedOperationalText(job.stoppedReason)}</p>}</article>;
        })}</div>
      </section>
      <section><header><div><p>{copy.backgroundJobsEyebrow}</p><h3>{copy.backgroundJobsTitle}</h3></div><span>{backgroundJobs.length} {t("common").of} {operations.backgroundJobs.length}</span></header>
        {backgroundJobs.length === 0 && <p className="muted">{copy.noBackgroundJobs}</p>}
        <div className="operations-list">{backgroundJobs.map((job) => <article key={job.id}><header><div><h4>{job.jobType || copy.unspecifiedType}</h4><small>{job.attemptCount} {copy.attemptsLabel}</small></div><span className={`job-status job-${job.status}`}>{statusLabels[job.status]}</span></header><dl><div><dt>{copy.lastUpdatedLabel}</dt><dd>{formatBookingDateTime(language, job.updatedAt)}</dd></div><div><dt>{copy.nextRetryLabel}</dt><dd>{job.nextRetryAt ? formatBookingDateTime(language, job.nextRetryAt) : copy.notScheduled}</dd></div><div><dt>{copy.createdLabel}</dt><dd>{formatBookingDateTime(language, job.createdAt)}</dd></div></dl>{job.lastError && <p className="operation-error"><strong>{copy.lastErrorLabel}</strong> {boundedOperationalText(job.lastError)}</p>}</article>)}</div>
      </section>
    </div>
    <p className="operations-generated">{language === "ar" ? <>آخر لقطة من RPC: {formatBookingDateTime(language, operations.generatedAt)} · حد المصدر 250 سجلًا لكل طابور.</> : <>Latest RPC snapshot: {formatBookingDateTime(language, operations.generatedAt)} · source limit 250 records per queue.</>}</p>
  </>;
}

const bookingStatusLabels: Record<Language, Record<BookingStatus, string>> = {
  ar: { pending: "قيد الانتظار", contacted: "تم التواصل", confirmed: "مؤكد", declined: "مرفوض", cancelled: "ملغي" },
  en: { pending: "Pending", contacted: "Contacted", confirmed: "Confirmed", declined: "Declined", cancelled: "Cancelled" },
};

function formatBookingDateTime(language: Language, value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(language === "ar" ? "ar-AE" : "en-AE");
}

function formatLocalDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function BookingView({ value, session, onChanged, onSessionExpired }: { value: JsonValue; session: Session; onChanged: () => void; onSessionExpired: () => void }) {
  const { language, t } = useLanguage();
  const copy = t("planner");
  const statusLabels = bookingStatusLabels[language];
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

  if (!parsed.success) return <div className="error-box">{copy.invalidFormat}</div>;

  async function changeStatus(booking: z.infer<typeof BookingSchema>, next: BookingStatus) {
    if (!canWrite || busyId || booking.status === next) return;
    const confirmMessage = language === "ar"
      ? `تأكيد تغيير حالة طلب ${booking.full_name} من «${statusLabels[booking.status]}» إلى «${statusLabels[next]}»؟ سيتم تسجيل العملية في Audit Log.`
      : `Change ${booking.full_name}'s status from "${statusLabels[booking.status]}" to "${statusLabels[next]}"? Recorded in the Audit Log.`;
    if (!window.confirm(confirmMessage)) return;
    setBusyId(booking.id); setNotice("");
    try {
      await updateBookingStatus(session, booking.id, next);
      setNotice(language === "ar" ? "تم تحديث الحالة وتسجيل العملية بنجاح." : "Status updated and recorded.");
      onChanged();
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "UPDATE_FAILED";
      if (code === "SESSION_EXPIRED") { onSessionExpired(); return; }
      const messagesByCode: Record<string, string> = language === "ar" ? {
        STAFF_ACCESS_DENIED: "ليست لديك صلاحية تنفيذ هذا التغيير.",
        INVALID_STATUS: "حالة الحجز المطلوبة غير مسموحة.",
        NOT_FOUND: "طلب الحجز لم يعد موجودًا.",
      } : {
        STAFF_ACCESS_DENIED: "You don't have permission for this.",
        INVALID_STATUS: "That booking status isn't allowed.",
        NOT_FOUND: "This booking request no longer exists.",
      };
      setNotice(messagesByCode[code] ?? (language === "ar" ? "تعذر التحديث بأمان؛ لم يتم اعتماد أي تغيير غير مؤكد." : "Update failed safely; no change was made."));
    } finally { setBusyId(null); }
  }

  return <>
    <div className="write-banner"><strong>{copy.writeBannerTitle}</strong><span>{copy.writeBannerSubtitle}</span></div>
    {notice && <div className="notice-box" aria-live="polite">{notice}</div>}
    <div className="booking-summary" aria-label={language === "ar" ? "ملخص حالات الحجوزات" : "Booking status summary"}>
      <button type="button" className={statusFilter === "all" ? "active" : ""} onClick={() => setStatusFilter("all")}><span>{copy.totalLabel}</span><strong>{bookings.length}</strong></button>
      {(Object.keys(statusLabels) as BookingStatus[]).map((status) => <button type="button" key={status} className={statusFilter === status ? "active" : ""} onClick={() => setStatusFilter(status)}><span>{statusLabels[status]}</span><strong>{counts[status]}</strong></button>)}
    </div>
    <div className="booking-toolbar">
      <label htmlFor="booking-search">{copy.searchLabel}<input id="booking-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} /></label>
      <span>{filteredBookings.length} {t("common").of} {bookings.length}</span>
    </div>
    {bookings.length === 0 && <p className="muted">{copy.noBookings}</p>}
    {bookings.length > 0 && filteredBookings.length === 0 && <p className="muted">{t("common").noResults}</p>}
    <div className="booking-list">{filteredBookings.map((booking) => {
      const phone = booking.normalized_phone ?? booking.phone;
      const location = booking.location === "Other" ? booking.other_location : booking.location;
      return <article className="booking-operation-card" key={booking.id}>
        <header><div><h3>{booking.full_name}</h3><p>{phone ? <a href={`tel:${phone}`}>{phone}</a> : copy.noPhone}</p></div><span className={`booking-status status-${booking.status}`}>{statusLabels[booking.status]}</span></header>
        <dl>
          <div><dt>{copy.requestedSlotLabel}</dt><dd>{[booking.requested_date, booking.requested_time?.slice(0, 5)].filter(Boolean).join(" · ") || copy.notSpecified}</dd></div>
          <div><dt>{copy.serviceLabel}</dt><dd>{[booking.category, booking.training_type].filter(Boolean).join(" · ") || copy.serviceNotSpecified}</dd></div>
          <div><dt>{copy.locationLabel}</dt><dd>{location || copy.notSpecified}</dd></div>
          <div><dt>{copy.profileLabel}</dt><dd>{[booking.gender, booking.swam_before == null ? null : booking.swam_before ? copy.hasSwum : copy.hasNotSwum].filter(Boolean).join(" · ") || copy.profileIncomplete}</dd></div>
          <div><dt>{copy.requestedAtLabel}</dt><dd>{formatBookingDateTime(language, booking.created_at)}</dd></div>
        </dl>
        {booking.fear_of_water && <div className="booking-risk">{copy.fearOfWaterAlert}</div>}
        <label htmlFor={`booking-status-${booking.id}`}>{copy.updateStatusLabel}<select id={`booking-status-${booking.id}`} value={booking.status} disabled={!canWrite || busyId !== null} onChange={(event) => void changeStatus(booking, event.target.value as BookingStatus)}>{(Object.keys(statusLabels) as BookingStatus[]).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
        {busyId === booking.id && <small>{copy.savingChange}</small>}
        {!canWrite && <small>{t("common").readOnlyNote}</small>}
      </article>;
    })}</div>
  </>;
}

function Dashboard({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const { language, t } = useLanguage();
  const nav = t("nav");
  const dashboardCopy = t("dashboard");
  const [active, setActive] = useState<SectionId>("dashboard"); const [reloadKey, setReloadKey] = useState(0); const [data, setData] = useState<JsonValue>(null); const [status, setStatus] = useState<"loading" | "ready" | "error">("loading"); const [error, setError] = useState("");
  const current = useMemo(() => sections.find(([id]) => id === active)!, [active]);
  useEffect(() => { document.title = `${nav[current[0]]} · ${nav.dashboard}`; }, [current, nav]);
  useEffect(() => { const controller = new AbortController(); setStatus("loading"); setError(""); callRpc(session, current[3], {}, controller.signal).then((result) => { setData(result); setStatus("ready"); }).catch((cause) => { if (cause instanceof DOMException && cause.name === "AbortError") return; const message = cause instanceof Error ? cause.message : "LOAD_FAILED"; if (message === "SESSION_EXPIRED") onLogout(); else { setError(dashboardCopy.loadError); setStatus("error"); } }); return () => controller.abort(); }, [current, dashboardCopy.loadError, onLogout, reloadKey, session]);
  const modeLabel = active === "planner" || active === "crm" || active === "inbox" || active === "content" ? dashboardCopy.controlledWrite : dashboardCopy.readOnly;
  return <div className="app-shell"><a className="skip-link" href="#main-workspace">{nav.skipToContent}</a><aside><div className="side-brand"><strong>Relax Fix AI OS</strong><span>{session.displayName} · {session.role}</span></div><LanguageSwitcher onDark /><nav aria-label="وحدات Command Center">{sections.map(([id, , Icon]) => <button type="button" key={id} className={active === id ? "active" : ""} aria-current={active === id ? "page" : undefined} onClick={() => setActive(id)}><Icon size={18} aria-hidden="true" />{nav[id]}</button>)}</nav><button type="button" className="logout" onClick={onLogout}><LogOut size={18} aria-hidden="true" />{nav.logout}</button></aside><main className="workspace" id="main-workspace" tabIndex={-1}><p className="eyebrow">{dashboardCopy.eyebrow} · {modeLabel}</p><h1>{nav[current[0]]}</h1><section className="panel" aria-busy={status === "loading"}><div className="panel-heading"><div><h2>{dashboardCopy.panelHeading}</h2><p>{dashboardCopy.panelSubheading}</p></div><button type="button" className="refresh" disabled={status === "loading"} onClick={() => setReloadKey((value) => value + 1)}>{t("common").refresh}</button></div>{status === "loading" && <p className="muted" role="status">{t("common").loading}</p>}{status === "error" && <div className="error-box" role="alert">{error}</div>}{status === "ready" && (active === "planner" ? <BookingView value={data} session={session} onChanged={() => setReloadKey((value) => value + 1)} onSessionExpired={onLogout} /> : active === "crm" ? <CRMView value={data} session={session} onChanged={() => setReloadKey((value) => value + 1)} onSessionExpired={onLogout} /> : active === "inbox" ? <AIInboxView value={data} session={session} onChanged={() => setReloadKey((value) => value + 1)} onSessionExpired={onLogout} /> : active === "content" ? <ContentStudioView value={data} session={session} onChanged={() => setReloadKey((value) => value + 1)} onSessionExpired={onLogout} /> : active === "media" ? <MediaLibraryView value={data} /> : active === "analytics" ? <AnalyticsView value={data} /> : active === "integrations" ? <IntegrationsView value={data} /> : active === "automations" ? <AutomationsView value={data} /> : <DataView value={data} />)}</section></main></div>;
}

function App() {
  const { language } = useLanguage();
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
  if (restoring) return <main className="login-page"><p className="muted" role="status">{language === "ar" ? "جاري التحقق من الجلسة والموظف النشط..." : "Verifying session and active staff..."}</p></main>;
  if (!session) return <Login onAuthenticated={setSession} />;
  return <Dashboard session={session} onLogout={() => { sessionStorage.removeItem("relaxfix-command-session"); setSession(null); }} />;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><LanguageProvider><App /></LanguageProvider></React.StrictMode>);
