import { useState, type FormEvent } from "react";
import { ShieldAlert } from "lucide-react";
import { useLanguage } from "./i18n";

type LoginSession = { accessToken: string; displayName: string; role: "super_admin" | "admin" | "reception" | "coach" | "content_manager" };
type LoginViewProps = {
  onAuthenticated: (session: LoginSession) => void;
  onSignIn: (email: string, password: string) => Promise<LoginSession>;
  onRequestPasswordReset: (email: string) => Promise<void>;
  authMessage: (code: string) => string;
  resetSuccess: string;
};
function authErrorCode(cause: unknown) { return cause instanceof Error ? cause.message : "LOGIN_FAILED"; }
function LoginLanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage();
  const labels = t("language");
  return <div className="language-switcher" role="group" aria-label={labels.switchLabel}>
    <button type="button" className={language === "ar" ? "active" : ""} aria-pressed={language === "ar"} onClick={() => setLanguage("ar")}>{labels.ar}</button>
    <button type="button" className={language === "en" ? "active" : ""} aria-pressed={language === "en"} onClick={() => setLanguage("en")}>{labels.en}</button>
  </div>;
}
export default function LoginView({ onAuthenticated, onSignIn, onRequestPasswordReset, authMessage, resetSuccess }: LoginViewProps) {
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
      await onRequestPasswordReset(email.trim());
      setResetNotice(resetSuccess);
    } catch (cause) {
      setResetError(authMessage(authErrorCode(cause)));
    } finally {
      setResetBusy(false);
    }
  }

  return <main className="login-page"><section className="login-card" aria-busy={busy || resetBusy}><div className="login-card-top"><div className="brand-mark"><ShieldAlert size={28} /></div><LoginLanguageSwitcher /></div><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p className="muted">{copy.subtitle}</p><form onSubmit={submit}><label>{copy.emailLabel}<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label>{copy.passwordLabel}<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label><button type="button" className="text-button forgot-password" disabled={busy || resetBusy} onClick={() => void forgotPassword()}>{language === "ar" ? <span lang="ar" dir="rtl">نسيت كلمة المرور؟</span> : <span lang="en" dir="ltr">Forgot password?</span>}</button>{resetNotice && <div className="notice-box" role="status">{resetNotice}</div>}{resetError && <div className="error-box" role="alert">{resetError}</div>}{error && <div className="error-box" role="alert">{error}</div>}<button disabled={busy || resetBusy}>{busy ? copy.submitting : copy.submit}</button></form><p className="security-note">{copy.securityNote}</p></section></main>;
}

