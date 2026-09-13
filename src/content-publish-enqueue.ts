const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/$/, "");
const SUPABASE_PUBLIC_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

type PublishEnqueueSession = { accessToken: string };

export type PublishEnqueueResult = {
  success?: boolean;
  code?: string;
  contentItemId?: string;
  jobId?: string;
  authorizationId?: string;
  jobStatus?: string;
  detail?: string;
};

export async function requestPublishJob(
  session: PublishEnqueueSession,
  contentItemId: string,
): Promise<PublishEnqueueResult> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/enqueue_publish_job`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLIC_KEY,
      Authorization: `Bearer ${session.accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ p_content_item_id: contentItemId }),
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) throw new Error("SESSION_EXPIRED");

  const result = (await response.json().catch(() => ({}))) as PublishEnqueueResult;
  if (!response.ok && !result.code) {
    throw new Error(`RPC_FAILED_${response.status}`);
  }
  return result;
}

export function publishEnqueueErrorMessage(code: string | undefined, language: "ar" | "en"): string {
  const messages: Record<string, { ar: string; en: string }> = {
    STAFF_ACCESS_DENIED: {
      ar: "لا تملك صلاحية طلب النشر.",
      en: "You do not have permission to request publish.",
    },
    CONTENT_NOT_APPROVED: {
      ar: "يجب اعتماد المحتوى قبل طلب النشر.",
      en: "Content must be approved before requesting publish.",
    },
    CONTENT_ALREADY_PUBLISHED: {
      ar: "هذا المحتوى منشور بالفعل.",
      en: "This content is already published.",
    },
    PUBLISH_RECEIPT_EXISTS: {
      ar: "يوجد إيصال نشر منشور لهذا العنصر.",
      en: "A published receipt already exists for this item.",
    },
    MEDIA_ASSET_REQUIRED: {
      ar: "يلزم ربط وسائط جاهزة قبل طلب النشر.",
      en: "Publish-ready media must be linked before requesting publish.",
    },
    MEDIA_ASSET_NOT_PUBLISHABLE: {
      ar: "الوسائط المرتبطة غير جاهزة للنشر.",
      en: "Linked media is not publish-ready.",
    },
    CONTENT_NOT_READY: {
      ar: "المحتوى غير جاهز للنشر.",
      en: "Content is not ready to publish.",
    },
    PLATFORM_NOT_SUPPORTED: {
      ar: "المنصة غير مدعومة لطلب النشر.",
      en: "This platform is not supported for publish requests.",
    },
    ACTIVE_AUTHORIZATION_EXISTS: {
      ar: "يوجد تفويض نشر نشط لهذا العنصر.",
      en: "An active publish authorization already exists for this item.",
    },
  };
  const entry = code ? messages[code] : undefined;
  if (entry) return entry[language];
  return language === "ar" ? "تعذر طلب النشر." : "Publish request failed.";
}
