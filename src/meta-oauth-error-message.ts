type Language = "ar" | "en";
type MetaOAuthProvider = "facebook" | "instagram";

export function metaOAuthErrorMessage(provider: MetaOAuthProvider, code: string, language: Language): string {
  const service = provider === "facebook" ? "Facebook" : "Instagram";
  return language === "ar"
    ? `تعذر بدء ربط ${service} عبر Meta (${code}). تحقق من إعداد OAuth الخاص بـMeta أو أعد المحاولة لاحقًا.`
    : `${service} OAuth could not start (${code}). Check the Meta OAuth setup or try again later.`;
}
