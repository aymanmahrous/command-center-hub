import { useEffect, useState, type FormEvent } from "react";
import { ShieldAlert } from "lucide-react";
import { useLanguage } from "./i18n";

type PasswordRecoveryProps = { supabaseUrl: string; publicKey: string; configurationReady: boolean };

export default function PasswordRecovery({ supabaseUrl, publicKey, configurationReady }: PasswordRecoveryProps) {
  const { language } = useLanguage();
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const accessToken = params.get("access_token") ?? "";
  const recoveryType = params.get("type") === "recovery";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    // Keep recovery tokens out of the visible URL/history after capturing them in memory.
    if (recoveryType) window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [recoveryType]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!configurationReady) { setError(language === "ar" ? "إعدادات الاتصال غير مكتملة أو غير آمنة. التطبيق مغلق بأمان." : "Connection settings are incomplete or unsafe. The application is securely locked."); return; }
    if (!accessToken || !recoveryType) { setError(language === "ar" ? "رابط الاستعادة غير صالح أو منتهي الصلاحية. اطلب رابطًا جديدًا." : "This recovery link is invalid or expired. Request a new link."); return; }
    if (password.length < 8) { setError(language === "ar" ? "استخدم كلمة مرور من 8 أحرف على الأقل." : "Use a password with at least 8 characters."); return; }
    if (password !== confirmPassword) { setError(language === "ar" ? "كلمتا المرور غير متطابقتين." : "The passwords do not match."); return; }
    setBusy(true);
    try {
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: "PUT",
        headers: { apikey: publicKey, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ password }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? "RECOVERY_LINK_EXPIRED" : "PASSWORD_UPDATE_FAILED");
      setComplete(true);
      setPassword("");
      setConfirmPassword("");
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "PASSWORD_UPDATE_FAILED";
      setError(code === "RECOVERY_LINK_EXPIRED"
        ? (language === "ar" ? "انتهت صلاحية الرابط أو استُخدم من قبل. اطلب رابطًا جديدًا." : "This recovery link expired or was already used. Request a new one.")
        : (language === "ar" ? "تعذر تحديث كلمة المرور. اطلب رابطًا جديدًا وحاول مرة أخرى." : "Could not update the password. Request a new link and try again."));
    } finally {
      setBusy(false);
    }
  }

  const ar = language === "ar";
  return <main className="login-page"><section className="login-card" aria-busy={busy}>
    <div className="login-card-top"><div className="brand-mark"><ShieldAlert size={28} /></div><LanguageSwitcher /></div>
    <p className="eyebrow">RELAX FIX UAE</p>
    <h1>{ar ? "تعيين كلمة مرور جديدة" : "Set a new password"}</h1>
    {complete
      ? <><div className="notice-box" role="status">{ar ? "تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن." : "Password updated. You can now sign in."}</div><a className="text-button" href="/">{ar ? "العودة إلى تسجيل الدخول" : "Return to sign in"}</a></>
      : <><p className="muted">{ar ? "اختر كلمة مرور جديدة لحسابك." : "Choose a new password for your account."}</p>
        <form onSubmit={submit}>
          <label>{ar ? "كلمة المرور الجديدة" : "New password"}<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <label>{ar ? "تأكيد كلمة المرور" : "Confirm password"}<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label>
          {error && <div className="error-box" role="alert">{error}</div>}
          <button disabled={busy || !accessToken || !recoveryType}>{busy ? (ar ? "جارٍ التحديث..." : "Updating...") : (ar ? "تحديث كلمة المرور" : "Update password")}</button>
        </form>
        {!accessToken || !recoveryType ? <p className="muted">{ar ? "الرابط غير صالح أو منتهي الصلاحية. ارجع لتسجيل الدخول واطلب رابط استعادة جديدًا." : "The link is invalid or expired. Return to sign in and request a new recovery link."}</p> : null}
      </>}
  </section></main>;
}

