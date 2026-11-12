import { useState, type FormEvent } from "react";
import { ShieldAlert } from "lucide-react";
import { useLanguage } from "./i18n";

type LoginSession = { accessToken: string; refreshToken?: string; expiresAt?: number; displayName: string; role: "super_admin" | "admin" | "reception" | "coach" | "content_manager" };
type LoginViewProps = {
  onAuthenticated: (session: LoginSession) => void;
  onSignIn: (email: string, password: string) => Promise<LoginSession>;
  onRequestPasswordReset: (email: string) => Promise<void>;
};
function authErrorCode(cause: unknown) { return cause instanceof Error ? cause.message : "LOGIN_FAILED"; }
const AUTH_MESSAGES = {
  CONFIGURATION_REQUIRED: "إعدادات الاتصال غير مكتملة أو غير آمنة. التطبيق مغلق بأمان.\nConnection settings are incomplete or unsafe. The application is securely locked.",
  INVALID_LOGIN: "البريد الإلكتروني أو كلمة المرور غير صحيحة.\nThe email or password is incorrect.",
  STAFF_ACCESS_DENIED: "هذا الحساب غير مفعّل للوصول إلى لوحة التحكم.\nThis account is not active for Command Center access.",
  SERVICE_UNAVAILABLE: "تعذر الاتصال بالخدمة. تحقق من الإنترنت ثم حاول لاحقًا.\nUnable to reach the service. Check your connection and try again later.",
  LOGIN_FAILED: "تعذر تسجيل الدخول. حاول مرة أخرى.\nSign-in failed. Please try again.",
  RESET_SUCCESS: "إذا كان البريد مسجلاً، فستصلك رسالة لإعادة تعيين كلمة المرور.\nIf the email is registered, a password reset message will be sent.",
} as const;
function authMessage(code: string) {
  if (code === "CONFIGURATION_REQUIRED") return AUTH_MESSAGES.CONFIGURATION_REQUIRED;
  if (code === "INVALID_LOGIN") return AUTH_MESSAGES.INVALID_LOGIN;
  if (code === "STAFF_ACCESS_DENIED") return AUTH_MESSAGES.STAFF_ACCESS_DENIED;
  if (code === "NETWORK_UNAVAILABLE" || code === "SERVICE_UNAVAILABLE" || code === "TOO_MANY_ATTEMPTS") return AUTH_MESSAGES.SERVICE_UNAVAILABLE;
  return AUTH_MESSAGES.LOGIN_FAILED;
}
function LoginLanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  const labels = t("language");
  return <div className="language-switcher" role="group" aria-label={labels.switchLabel}>
    <button type="button" className={language === "ar" ? "active" : ""} aria-pressed={language === "ar"} onClick={() => setLanguage("ar")}>{labels.ar}</button>
    <button type="button" className={language === "en" ? "active" : ""} aria-pressed={language === "en"} onClick={() => setLanguage("en")}>{labels.en}</button>
  </div>;
}
export default function LoginView({ onAuthenticated, onSignIn, onRequestPasswordReset }: LoginViewProps) {
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
      const session = await onSignIn(email.trim(), password);
      sessionStorage.setItem("relaxfix-command-session", JSON.stringify({
        accessToken: session.accessToken,
        ...(session.refreshToken ? { refreshToken: session.refreshToken } : {}),
        ...(session.expiresAt ? { expiresAt: session.expiresAt } : {}),
      }));
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
      await onRequestPasswordReset(email.trim());
      setResetNotice(AUTH_MESSAGES.RESET_SUCCESS);
    } catch (cause) {
      setResetError(authMessage(authErrorCode(cause)));
    } finally {
      setResetBusy(false);
    }
  }

  return <main className="login-page"><section className="login-card" aria-busy={busy || resetBusy}><div className="login-card-top"><div className="brand-mark"><ShieldAlert size={28} /></div><LoginLanguageSwitcher /></div><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p className="muted">{copy.subtitle}</p><form onSubmit={submit}><label>{copy.emailLabel}<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>{copy.passwordLabel}<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label><button type="button" className="text-button forgot-password" disabled={busy || resetBusy} onClick={() => void forgotPassword()}>{language === "ar" ? <span lang="ar" dir="rtl">نسيت كلمة المرور؟</span> : <span lang="en" dir="ltr">Forgot password?</span>}</button>{resetNotice && <div className="notice-box" role="status">{resetNotice}</div>}{resetError && <div className="error-box" role="alert">{resetError}</div>}{error && <div className="error-box" role="alert">{error}</div>}<button disabled={busy || resetBusy}>{busy ? copy.submitting : copy.submit}</button></form><p className="security-note">{copy.securityNote}</p></section></main>;
}

