import type { Language } from "./i18n";
import type { PublishPipelineStage } from "./content-publishing";

export type PublishingCopy = {
  livePublishTitle: string;
  livePublishBody: string;
  livePublishAwaiting: string;
  livePublishNextReview: string;
  livePublishNextApprove: string;
  livePublishNextN8n: string;
  livePublishNextVerify: string;
  livePublishNextContinue: string;
  authorizedPostTitle: string;
  authorizedPostPending: string;
  authorizedPostLive: string;
  pipelineAria: string;
  pipelineLabel: string;
  publishedAtLabel: string;
  awaitingN8nNote: string;
  openPostLink: string;
  openLivePost: string;
  pipelineStages: Record<PublishPipelineStage, string>;
};

const COPY: Record<Language, PublishingCopy> = {
  en: {
    livePublishTitle: "Publishing readiness (Facebook first)",
    livePublishBody: "Approve here. Live posting runs via approved n8n — not this screen.",
    livePublishAwaiting: "Awaiting n8n",
    livePublishNextReview: "Next: review remaining batch items.",
    livePublishNextApprove: "Next: approve reviewed items (no auto publish).",
    livePublishNextN8n: "Next: run n8n for the authorized Facebook post.",
    livePublishNextVerify: "Next: verify unclear publish receipts.",
    livePublishNextContinue: "Next: keep building the 10-day batch mix.",
    authorizedPostTitle: "Authorized Facebook test post",
    authorizedPostPending: "Approved — waiting for n8n publish.",
    authorizedPostLive: "Live on Facebook.",
    pipelineAria: "Publish status",
    pipelineLabel: "Stage",
    publishedAtLabel: "Published",
    awaitingN8nNote: "Approved here. Live posting is handled by n8n outside the app.",
    openPostLink: "Receipt link",
    openLivePost: "Live post",
    pipelineStages: {
      needs_review: "Needs review",
      approved_ready: "Ready for n8n",
      awaiting_n8n: "Awaiting n8n",
      scheduled: "Scheduled",
      published_live: "Live",
      failed: "Issue",
      other: "Other",
    },
  },
  ar: {
    livePublishTitle: "جاهزية النشر (Facebook أولاً)",
    livePublishBody: "الاعتماد هنا. النشر الحي عبر n8n المعتمد — وليس من هذه الشاشة.",
    livePublishAwaiting: "بانتظار n8n",
    livePublishNextReview: "التالي: مراجعة عناصر الدفعة المتبقية.",
    livePublishNextApprove: "التالي: اعتماد العناصر (بدون نشر تلقائي).",
    livePublishNextN8n: "التالي: تشغيل n8n لمنشور Facebook المصرّح.",
    livePublishNextVerify: "التالي: التحقق من إيصالات النشر.",
    livePublishNextContinue: "التالي: متابعة بناء دفعة 10 أيام.",
    authorizedPostTitle: "منشور Facebook التجريبي",
    authorizedPostPending: "معتمد — بانتظار n8n.",
    authorizedPostLive: "منشور حي على Facebook.",
    pipelineAria: "حالة النشر",
    pipelineLabel: "المرحلة",
    publishedAtLabel: "نُشر",
    awaitingN8nNote: "معتمد هنا. النشر الحي يتم عبر n8n خارج التطبيق.",
    openPostLink: "رابط الإيصال",
    openLivePost: "المنشور الحي",
    pipelineStages: {
      needs_review: "يحتاج مراجعة",
      approved_ready: "جاهز لـ n8n",
      awaiting_n8n: "بانتظار n8n",
      scheduled: "مجدول",
      published_live: "حي",
      failed: "مشكلة",
      other: "أخرى",
    },
  },
};

export function readPublishingCopy(language: Language): PublishingCopy {
  return COPY[language];
}
