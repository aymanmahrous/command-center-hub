import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BarChart3, Bot, CalendarDays, ContactRound, Inbox, LayoutDashboard, Library, LogOut, Settings2, ShieldAlert, Workflow } from "lucide-react";
import { z } from "zod";
import "./styles.css";

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

const ProfileSchema = z.object({ display_name: z.string().min(1), role: z.enum(["super_admin", "admin", "reception", "coach", "content_manager"]), active: z.literal(true) });
const BookingSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string(),
  phone: z.string().nullable().optional(),
  normalized_phone: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  training_type: z.string().nullable().optional(),
  requested_date: z.string().nullable().optional(),
  requested_time: z.string().nullable().optional(),
  status: z.enum(["pending", "contacted", "confirmed", "declined", "cancelled"]),
  created_at: z.string(),
}).passthrough();
const BookingUpdateSchema = z.object({ success: z.boolean(), code: z.string().optional(), bookingRequestId: z.string().uuid().optional(), status: z.enum(["pending", "contacted", "confirmed", "declined", "cancelled"]).optional() });

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();
const STAFF_TABLE = (import.meta.env.VITE_STAFF_PROFILE_TABLE ?? "staff_profiles").trim();

function configurationReady() {
  try {
    const url = new URL(SUPABASE_URL);
    return url.protocol === "https:" && url.hostname.endsWith(".supabase.co") && SUPABASE_ANON_KEY.length > 20 && STAFF_TABLE.length > 0;
  } catch {
    return false;
  }
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

function BookingView({ value, session, onChanged }: { value: JsonValue; session: Session; onChanged: () => void }) {
  const parsed = z.array(BookingSchema).safeParse(value);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
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
  const modeLabel = active === "planner" ? "CONTROLLED WRITE" : "READ ONLY";
  return <div className="app-shell"><aside><div className="side-brand"><strong>Relax Fix AI OS</strong><span>{session.displayName} · {session.role}</span></div><nav>{sections.map(([id, label, Icon]) => <button key={id} className={active === id ? "active" : ""} onClick={() => setActive(id)}><Icon size={18} />{label}</button>)}</nav><button className="logout" onClick={onLogout}><LogOut size={18} />تسجيل الخروج</button></aside><main className="workspace"><p className="eyebrow">INTERNAL OPERATIONS · {modeLabel}</p><h1>{current[1]}</h1><section className="panel"><div className="panel-heading"><div><h2>بيانات تشغيل حقيقية</h2><p>Supabase RPC محمي بهوية الموظف وصلاحيات قاعدة البيانات.</p></div><button className="refresh" disabled={status === "loading"} onClick={() => setReloadKey((value) => value + 1)}>تحديث</button></div>{status === "loading" && <p className="muted">جاري التحميل الآمن...</p>}{status === "error" && <div className="error-box">{error}</div>}{status === "ready" && (active === "planner" ? <BookingView value={data} session={session} onChanged={() => setReloadKey((value) => value + 1)} /> : <DataView value={data} />)}</section></main></div>;
}

function App() { const [session, setSession] = useState<Session | null>(null); useEffect(() => { try { const raw = sessionStorage.getItem("relaxfix-command-session"); if (raw) setSession(z.object({ accessToken: z.string(), displayName: z.string(), role: ProfileSchema.shape.role }).parse(JSON.parse(raw))); } catch { sessionStorage.removeItem("relaxfix-command-session"); } }, []); if (!session) return <Login onAuthenticated={setSession} />; return <Dashboard session={session} onLogout={() => { sessionStorage.removeItem("relaxfix-command-session"); setSession(null); }} />; }
createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
