import type { ContentBatchItem } from "./content-batch";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const SUPABASE_PUBLIC_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

type GeminiImageSession = { accessToken: string };
type GeminiImageResponse = {
  success?: boolean;
  code?: string;
  detail?: string;
  providerStatus?: number;
  model?: string;
  estimatedCostUsd?: number;
  mediaAssetId?: string;
  storagePath?: string;
};

async function callGeminiImageEdge(session: GeminiImageSession, body: Record<string, unknown>): Promise<GeminiImageResponse> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-gemini-image`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLIC_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) throw new Error("SESSION_EXPIRED");
  const result = await response.json().catch(() => ({})) as GeminiImageResponse;
  if (!response.ok || result.success !== true) {
    const code = typeof result.code === "string" ? result.code : `GEMINI_IMAGE_FAILED_${response.status}`;
    const providerStatus = typeof result.providerStatus === "number" ? ` (Google HTTP ${result.providerStatus})` : "";
    const detail = typeof result.detail === "string" ? result.detail.trim().slice(0, 160) : "";
    throw new Error([code + providerStatus, detail].filter(Boolean).join(": "));
  }
  return result;
}

function buildImagePrompt(item: ContentBatchItem) {
  return [
    typeof item.visualPrompt === "string" ? item.visualPrompt : "",
    typeof item.topic === "string" ? `Topic: ${item.topic}` : "",
    typeof item.hook === "string" ? `Headline direction: ${item.hook}` : "",
    typeof item.caption === "string" ? `Caption context: ${item.caption.slice(0, 1200)}` : "",
  ].filter(Boolean).join("\n\n").slice(0, 5000);
}

export async function estimateGeminiImageGeneration(session: GeminiImageSession): Promise<{ estimatedCostUsd: number; model: string }> {
  const result = await callGeminiImageEdge(session, { mode: "estimate" });
  if (typeof result.estimatedCostUsd !== "number") throw new Error("GEMINI_IMAGE_ESTIMATE_MISSING");
  return {
    estimatedCostUsd: result.estimatedCostUsd,
    model: typeof result.model === "string" ? result.model : "gemini-nano-banana-2.1",
  };
}

export async function generateGeminiImageForContentItem(session: GeminiImageSession, item: ContentBatchItem): Promise<{ mediaAssetId: string }> {
  const result = await callGeminiImageEdge(session, {
    mode: "generate",
    contentItemId: item.id,
    prompt: buildImagePrompt(item),
  });
  if (typeof result.mediaAssetId !== "string" || !result.mediaAssetId) throw new Error("GEMINI_IMAGE_MEDIA_ASSET_MISSING");
  return { mediaAssetId: result.mediaAssetId };
}

export function geminiImageDesignErrorMessage(code: string | undefined, language: "ar" | "en"): string {
  const messages: Record<string, { ar: string; en: string }> = {
    GEMINI_CREDENTIAL_MISSING: {
      ar: "توليد الصور عبر Gemini غير مهيأ على الخادم؛ لم يتم إنشاء صورة أو تحصيل تكلفة.",
      en: "Gemini image generation is not configured on the server; no image was generated or charged.",
    },
    GEMINI_IMAGE_ESTIMATE_MISSING: {
      ar: "تعذر تأكيد التكلفة قبل إنشاء الصورة.",
      en: "Could not confirm the estimated cost before image generation.",
    },
    GEMINI_IMAGE_REQUEST_FAILED: {
      ar: "رفض Google طلب إنشاء الصورة. راجع تفاصيل الخطأ قبل إعادة المحاولة.",
      en: "Google rejected the image-generation request. Review the error details before retrying.",
    },
    GEMINI_IMAGE_MISSING: {
      ar: "لم يُرجع Gemini ملف صورة صالحًا؛ لم يتم تسجيل أصل جديد.",
      en: "Gemini did not return a valid image file; no new asset was registered.",
    },
    MEDIA_STORAGE_UPLOAD_FAILED: {
      ar: "تم طلب الصورة لكن تعذر حفظها في مكتبة الوسائط.",
      en: "The image request completed, but saving it to Media Library failed.",
    },
    MEDIA_REGISTER_FAILED: {
      ar: "تعذر تسجيل الصورة في مكتبة الوسائط.",
      en: "Failed to register the image in Media Library.",
    },
    MEDIA_LINK_FAILED: {
      ar: "تم حفظ الصورة، لكن تعذر ربطها بالمحتوى؛ راجع مكتبة الوسائط.",
      en: "The image was saved but could not be linked to the content; check Media Library.",
    },
    MEDIA_ASSET_NOT_PUBLISHABLE: {
      ar: "تم حفظ الصورة، لكن ضوابط المكتبة منعت ربطها؛ راجع حالة الأصل في مكتبة الوسائط.",
      en: "The image was saved, but Media Library safeguards blocked linking; review the asset status.",
    },
    MEDIA_ASSET_ALREADY_LINKED: {
      ar: "الصورة مرتبطة بالفعل بعنصر محتوى آخر.",
      en: "This image is already linked to another content item.",
    },
    CONTENT_ITEM_NOT_FOUND: {
      ar: "عنصر المحتوى لم يعد موجودًا؛ الصورة محفوظة في المكتبة.",
      en: "The content item no longer exists; the image remains in Media Library.",
    },
    PUBLISHED_CONTENT_IMMUTABLE: {
      ar: "لا يمكن تغيير وسائط محتوى منشور؛ الصورة محفوظة في المكتبة.",
      en: "Published content media cannot be changed; the image remains in Media Library.",
    },
  };
  if (code === "SESSION_EXPIRED") return language === "ar" ? "انتهت الجلسة؛ سجّل الدخول مجددًا." : "Session expired; sign in again.";
  const key = code?.split(/[ (:]/, 1)[0] ?? "";
  return messages[key]?.[language] ?? code ?? (language === "ar" ? "تعذر إنشاء الصورة عبر Gemini." : "Gemini image generation failed.");
}
