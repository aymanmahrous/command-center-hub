import { FormEvent, useState } from "react";
import { AlertTriangle, BookOpen, Brain, Search, ShieldCheck, Sparkles } from "lucide-react";
import "./coach-brain.css";
import { executeCoachBrainContentGeneration } from "./coach-brain-actions";

type Source = { title: string; url: string };
type ResearchUsage = {
  requestedModel: string;
  modelVersion: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  thinkingTokens: number | null;
  totalTokens: number | null;
  toolUsePromptTokens: number | null;
  groundingSearchQueries: number | null;
  estimatedTokenCostUsd: number | null;
  pricingStatus: "estimated" | "unavailable";
  pricingAsOf: string;
  pricingEffectiveFrom: string | null;
  pricingEffectiveThrough: string | null;
  inputUsdPerMillion: number | null;
  outputUsdPerMillion: number | null;
  pricingSource: string;
  groundingFeeIncluded: false;
  groundingQuotaStatus: "unknown";
};
type ResearchResult = { answer: string; sources: Source[]; searchQueries?: string[]; usage: ResearchUsage | null };

const copy = {
  ar: {
    title: "Coach Brain",
    subtitle: "ابحث عن أفضل طرق التدريب والتعليم من الأدلة الحديثة",
    privacy: "اكتب سؤالك فقط. لا يتم إنشاء ملف للسباح أو حفظ بيانات الأطفال.",
    placeholder: "مثال: سباح عمره 12 سنة، 100م حرة في 45 ثانية. كيف أطور السرعة؟ هل أركز على الاستارت أم الدوران؟ وما التدريبات والأدوات المناسبة؟",
    search: "ابحث وحلل",
    execute: "نفّذ المهمة",
    executing: "جاري التنفيذ الحقيقي...",
    generationReady: "تم إنشاء دفعة المحتوى فعليًا وحفظها للمراجعة.",
    searching: "جاري البحث في المصادر وتحليلها...",
    direct: "الإجابة البحثية",
    sources: "المصادر التي اعتمد عليها البحث",
    evidence: "الأدلة",
    safety: "السلامة",
    usageTitle: "استخدام Gemini والتكلفة التقديرية",
    inputTokens: "رموز الإدخال",
    responseTokens: "رموز الإجابة والتفكير",
    totalTokens: "إجمالي الرموز",
    searchQueries: "عمليات بحث Google",
    usageEstimate: "تقدير رموز النموذج (مرجع السعر المدفوع)",
    usageUnavailable: "التكلفة التقديرية غير متاحة؛ لم تصل بيانات استخدام كافية من المزود.",
    usageCaveat: "هذا تقدير وليس فاتورة. لا يشمل رسوم Google Search؛ لا نعرف الحصة الشهرية المتبقية أو فئة الفوترة من هذه الشاشة.",
    searchUsageUnknown: "غير متاحة",
    modelLabel: "النموذج",
    pricingSource: "مصدر السعر الرسمي",
    rateAsOf: "مرجع السعر بتاريخ",
    empty: "اكتب أي سؤال عن السباحة أو التدريب أو التقنية أو الاستارت أو الدوران أو الأدوات.",
    actionsTitle: "ماذا تريد أن تفعل؟",
    actionsHint: "اختر مهمة جاهزة بدل كتابة سؤال من الصفر.",
    actions: ["جهز لي خطة محتوى 10 أيام", "أعطني أفكارًا متنوعة لمحتوى السباحة", "راجع هذا النص وحسّنه", "لخّص هذه المحادثة واقترح الخطوة التالية"],
    error: "تعذر تنفيذ البحث الآن. لم يتم حفظ السؤال أو إنشاء أي بيانات.",
    privacyNote: "البحث يتم عبر خادم آمن، ومفتاح Gemini لا يصل إلى الهاتف.",
    examples: [
      "طفل عنده تشتت انتباه، ما أول خطوة لتعليمه السباحة؟",
      "كيف أحسن دوران سباح 12 سنة في 100م حرة؟",
      "ما أفضل تدريبات التنفس في freestyle؟",
    ],
  },
  en: {
    title: "Coach Brain",
    subtitle: "Research the best current coaching and teaching methods",
    privacy: "Write the question only. No swimmer or child profile is created or stored.",
    placeholder: "Example: 12-year-old swimmer, 100m freestyle in 45s. How should I improve speed? Start, turn, drills and equipment?",
    search: "Research & analyze",
    execute: "Execute task",
    executing: "Executing for real...",
    generationReady: "The content batch was created and saved for review.",
    searching: "Searching sources and analyzing the evidence...",
    direct: "Research answer",
    sources: "Sources used by the research",
    evidence: "Evidence",
    safety: "Safety",
    usageTitle: "Gemini usage & estimated cost",
    inputTokens: "Input tokens",
    responseTokens: "Answer and thinking tokens",
    totalTokens: "Total tokens",
    searchQueries: "Google Search queries",
    usageEstimate: "Estimated model-token cost (published paid-tier reference)",
    usageUnavailable: "Cost estimate unavailable because the provider did not return enough usage data.",
    usageCaveat: "Estimate only, not an invoice. Google Search fees are excluded; this screen cannot see the monthly quota remaining or billing tier.",
    searchUsageUnknown: "Not returned",
    modelLabel: "Model",
    pricingSource: "Official pricing source",
    rateAsOf: "Pricing reference date",
    empty: "Ask any swimming, coaching, technique, start, turn, training or equipment question.",
    actionsTitle: "What do you want to do?",
    actionsHint: "Choose a ready task instead of starting from a blank question.",
    actions: ["Prepare a 10-day content plan", "Give me varied swimming content ideas", "Review and improve this copy", "Summarize this conversation and suggest the next step"],
    error: "The research could not be completed. The question was not saved and no swimmer record was created.",
    privacyNote: "Research runs through a secure server; the Gemini key never reaches the phone.",
    examples: [
      "A child has attention difficulties. What is the first step for teaching swimming?",
      "How should I improve a 12-year-old's 100m freestyle turn?",
      "What are the best freestyle breathing drills?",
    ],
  },
};

function getSessionToken() {
  try {
    const raw = sessionStorage.getItem("relaxfix-command-session");
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { accessToken?: unknown };
    return typeof parsed.accessToken === "string" ? parsed.accessToken : "";
  } catch { return ""; }
}

function formatTokenCount(value: number | null, language: "ar" | "en") {
  return value === null ? "—" : new Intl.NumberFormat(language === "ar" ? "ar-AE" : "en-US").format(value);
}

function formatUsd(value: number, language: "ar" | "en") {
  if (value > 0 && value < 0.000001) return language === "ar" ? "أقل من 0.000001 دولار" : "Less than $0.000001";
  return new Intl.NumberFormat(language === "ar" ? "ar-AE" : "en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 6, maximumFractionDigits: 6,
  }).format(value);
}

export type CoachBrainProps = { language?: "ar" | "en" };

export default function CoachBrain({ language = "ar" }: CoachBrainProps) {
  const t = copy[language];
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<ResearchResult | null>(null);
  const usage = result?.usage ?? null;
  const responseTokens = usage?.outputTokens !== null && usage?.outputTokens !== undefined && usage?.thinkingTokens !== null && usage?.thinkingTokens !== undefined
    ? usage.outputTokens + usage.thinkingTokens
    : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [actionNotice, setActionNotice] = useState("");

  async function executeTask() {
    if (!question.trim() || busy || actionBusy) return;
    const normalized = question.trim().toLocaleLowerCase();
    const isExecutable = /خطة محتوى|دفعة محتوى|محتوى|content plan|content batch|generate content|content generation|صورة|صور|image|photo|design|تصميم|canva|كانفا|فيديو|فديو|video|reel|runway/i.test(normalized);
    if (!isExecutable) {
      setError(language === "ar"
        ? "شغّل «ابحث وحلل» أولًا لهذه المهمة؛ Coach Brain سيحوّل النتيجة إلى إجراء عندما تتوفر قدرة تنفيذ مناسبة."
        : "Run Research & analyze first for this task; Coach Brain will route the result to an execution capability when appropriate.");
      return;
    }
    setActionBusy(true); setError(""); setActionNotice("");
    try {
      const token = getSessionToken();
      if (!token) throw new Error("AUTH_REQUIRED");
      const result = await executeCoachBrainContentGeneration({ accessToken: token }, question);
      const notice = result.kind === "video"
        ? (language === "ar" ? "تم تشغيل توليد الفيديو عبر Runway." : "Video generation started through Runway.")
        : result.kind === "image"
          ? (language === "ar" ? "تم توليد الصورة عبر مسار الذكاء الاصطناعي." : "Image generation completed through the AI generation route.")
          : result.kind === "design"
            ? (language === "ar" ? "تم إنشاء التصميم عبر Canva وحفظه داخل النظام." : "The Canva design was created and saved in the system.")
            : `${t.generationReady} ${result.itemCount} items${result.batchId ? ` · Batch ${result.batchId}` : ""}`;
      setActionNotice(notice);
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "ACTION_FAILED";
      if (code === "SESSION_EXPIRED" || code === "AUTH_REQUIRED") {
        setError(language === "ar" ? "جلسة الدخول غير صالحة. لم يتم تغيير أي بيانات." : "The staff session is invalid. No data was changed.");
      } else if (code === "CONTENT_SLOT_ALREADY_PLANNED") {
        setError(language === "ar" ? "لا توجد خانة تخطيط متاحة ضمن المدى الآمن الحالي. لم يتم إنشاء دفعة مكررة." : "No planning slot is available in the current safe window. No duplicate batch was created.");
      } else {
        setError(language === "ar" ? "تعذر تنفيذ المهمة بأمان. لم يتم اعتماد نتيجة غير مؤكدة." : "The task could not be executed safely. No unverified result was accepted.");
      }
    } finally { setActionBusy(false); }
  }

  async function research(event: FormEvent) {
    event.preventDefault();
    const value = question.trim();
    if (!value || busy) return;
    setBusy(true); setError(""); setResult(null);
    try {
      const baseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
      const publicKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "");
      const token = getSessionToken();
      if (!baseUrl || !publicKey || !token) throw new Error("AUTH_REQUIRED");
      const response = await fetch(`${baseUrl}/functions/v1/coach-brain-research`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: publicKey, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question: value }),
      });
      const payload = await response.json().catch(() => ({})) as { success?: boolean; code?: string; answer?: string; sources?: Source[]; searchQueries?: string[]; usage?: ResearchUsage | null };
      if (!response.ok || !payload.success || !payload.answer) {
        const code = payload.code ?? (response.status === 401 ? "AUTH_REQUIRED" : response.status === 403 ? "STAFF_ACCESS_DENIED" : "RESEARCH_FAILED");
        if (code === "NEEDS_CREDENTIAL") throw new Error("NEEDS_CREDENTIAL");
        if (code === "AUTH_REQUIRED" || response.status === 401) throw new Error("AUTH_REQUIRED");
        if (code === "STAFF_ACCESS_DENIED" || response.status === 403) throw new Error("STAFF_ACCESS_DENIED");
        if (code === "ACADEMY_CONTEXT_FAILED") throw new Error("ACADEMY_CONTEXT_FAILED");
        throw new Error("RESEARCH_FAILED");
      }
      setResult({ answer: payload.answer, sources: Array.isArray(payload.sources) ? payload.sources : [], searchQueries: payload.searchQueries, usage: payload.usage ?? null });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : "RESEARCH_FAILED";
      if (code === "NEEDS_CREDENTIAL") setError(language === "ar" ? "Coach Brain يحتاج مفتاح Gemini في Supabase Edge Function باسم GEMINI_API_KEY. لا تضع المفتاح داخل التطبيق." : "Coach Brain needs the Gemini key in Supabase Edge Function secrets as GEMINI_API_KEY. Do not put the key in the app.");
      else if (code === "AUTH_REQUIRED" || code === "STAFF_ACCESS_DENIED") setError(language === "ar" ? "جلسة الدخول غير صالحة أو لا تملك صلاحية Coach Brain. سجّل الدخول مرة أخرى." : "The staff session is invalid or does not have Coach Brain access. Sign in again.");
      else if (code === "ACADEMY_CONTEXT_FAILED") setError(language === "ar" ? "Coach Brain وصل للخدمة لكن لم يستطع تحميل Academy Knowledge. سأحتاج إصلاح مسار المعرفة، وليس مفتاحًا جديدًا." : "Coach Brain reached the service but could not load Academy Knowledge. This needs a knowledge-path fix, not a new key.");
      else setError(t.error);
    } finally { setBusy(false); }
  }

  return (
    <main className="coach-brain" dir={language === "ar" ? "rtl" : "ltr"}>
      <header className="coach-brain__hero">
        <div>
          <div className="coach-brain__eyebrow"><Brain size={17} /> {t.title}</div>
          <h1>{t.subtitle}</h1>
          <p>{t.privacy}</p>
        </div>
        <div className="coach-brain__status"><ShieldCheck size={18} /> {language === "ar" ? "بحث آمن" : "Safe research"}</div>
      </header>

      <nav className="coach-brain__subnav" aria-label={language === "ar" ? "أقسام Coach Brain" : "Coach Brain sections"}>
        <a href="#coach-question">{language === "ar" ? "سؤال جديد" : "New question"}</a>
        <a href="#coach-examples">{language === "ar" ? "أمثلة جاهزة" : "Examples"}</a>
        <a href="#coach-results">{language === "ar" ? "النتائج" : "Results"}</a>
      </nav>

      <section className="coach-brain__card coach-brain__actions-card" aria-labelledby="coach-actions-title">
        <div className="coach-brain__section-heading"><span className="coach-brain__step">1</span><div><strong id="coach-actions-title">{t.actionsTitle}</strong><p>{t.actionsHint}</p></div></div>
        <div className="coach-brain__action-grid">{t.actions.map((action) => <button key={action} type="button" disabled={busy} onClick={() => { setQuestion(action); setResult(null); setError(""); document.getElementById("coach-brain-question")?.focus(); }}>{action}<Sparkles size={15} /></button>)}</div>
      </section>

      <section id="coach-question" className="coach-brain__card coach-brain__research-card">
        <div className="coach-brain__section-heading"><span className="coach-brain__step">2</span><div><strong>{language === "ar" ? "راجع المهمة أو اكتب سؤالك" : "Review the task or write your question"}</strong><p>{language === "ar" ? "يمكنك تعديل النص قبل تشغيل البحث." : "You can edit the prompt before running research."}</p></div></div>
        <form onSubmit={research}>
          <label className="coach-brain__question-label" htmlFor="coach-brain-question">{language === "ar" ? "ماذا تريد أن تعرف؟" : "What do you want to know?"}</label>
          <textarea id="coach-brain-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t.placeholder} rows={6} maxLength={5000} disabled={busy} />
          <div className="coach-brain__actions">
            <button className="coach-brain__primary" type="submit" disabled={busy || actionBusy || !question.trim()}>
              {busy ? <Sparkles size={17} className="coach-brain__spin" /> : <Search size={17} />}
              {busy ? t.searching : t.search}
            </button>
            <button className="coach-brain__execute" type="button" onClick={() => void executeTask()} disabled={busy || actionBusy || !question.trim()}>
              {actionBusy ? <Sparkles size={17} className="coach-brain__spin" /> : <Brain size={17} />}
              {actionBusy ? t.executing : t.execute}
            </button>
            <span className="coach-brain__privacy-note">{t.privacyNote}</span>
          </div>
          {actionNotice && <div className="coach-brain__action-notice" role="status">{actionNotice}</div>}
        </form>
        <div id="coach-examples" className="coach-brain__examples">
          <div className="coach-brain__examples-heading"><span className="coach-brain__step">3</span><strong>{language === "ar" ? "أو اختر مثالًا تدريبيًا" : "Or choose a coaching example"}</strong></div>
          {t.examples.map((example) => <button key={example} type="button" disabled={busy} onClick={() => setQuestion(example)}>{example}</button>)}
        </div>
      </section>

      {error && <section className="coach-brain__error" role="alert"><AlertTriangle size={18} /> {error}</section>}

      {!result && !busy && !error && <section className="coach-brain__empty"><BookOpen size={32} /><strong>{t.empty}</strong></section>}

      {busy && <section className="coach-brain__empty"><Sparkles size={30} className="coach-brain__spin" /><strong>{t.searching}</strong><span>{language === "ar" ? "يتم البحث أولًا ثم تحويل النتائج إلى خطة عملية للمدرب." : "Research comes first, then the findings are turned into a practical coaching plan."}</span></section>}

      {result && (
        <section id="coach-results" className="coach-brain__results" aria-live="polite">
          <div className="coach-brain__results-heading"><span className="coach-brain__step">4</span><div><strong>{language === "ar" ? "النتيجة العملية" : "Practical result"}</strong><p>{language === "ar" ? "راجع النتيجة. Coach Brain يوجّه العمل داخليًا؛ لا تحتاج لفتح مساحة أخرى." : "Review the result. Coach Brain routes the work internally; you do not need to open another workspace."}</p></div><div className="coach-brain__results-actions"><button type="button" className="coach-brain__reset" onClick={() => { setResult(null); setQuestion(""); setError(""); }}>{language === "ar" ? "مهمة جديدة" : "New task"}</button></div></div>
          <article className="coach-brain__card coach-brain__answer">
            <div className="coach-brain__result-title"><Sparkles size={18} /> <h2>{t.direct}</h2></div>
            <div className="coach-brain__answer-text">{result.answer}</div>
          </article>
          <article className="coach-brain__card coach-brain__usage" aria-label={t.usageTitle}>
            <div className="coach-brain__result-title"><strong>{t.usageTitle}</strong></div>
            {usage ? <>
              <dl className="coach-brain__usage-grid">
                <div><dt>{t.modelLabel}</dt><dd>{usage.requestedModel}</dd></div>
                <div><dt>{t.inputTokens}</dt><dd>{formatTokenCount(usage.inputTokens, language)}</dd></div>
                <div><dt>{t.responseTokens}</dt><dd>{formatTokenCount(responseTokens, language)}</dd></div>
                <div><dt>{t.totalTokens}</dt><dd>{formatTokenCount(usage.totalTokens, language)}</dd></div>
                <div><dt>{t.searchQueries}</dt><dd>{usage.groundingSearchQueries === null ? t.searchUsageUnknown : formatTokenCount(usage.groundingSearchQueries, language)}</dd></div>
              </dl>
              {usage.estimatedTokenCostUsd === null
                ? <p role="status">{t.usageUnavailable}</p>
                : <p className="coach-brain__usage-cost"><strong>{t.usageEstimate}:</strong> {formatUsd(usage.estimatedTokenCostUsd, language)}</p>}
              <p className="coach-brain__usage-note">{t.usageCaveat} {t.rateAsOf}: {usage.pricingAsOf}.</p>
              <a href={usage.pricingSource} target="_blank" rel="noreferrer">{t.pricingSource}</a>
            </> : <p role="status">{t.usageUnavailable}</p>}
          </article>
          <article className="coach-brain__card coach-brain__sources">
            <div className="coach-brain__result-title"><BookOpen size={18} /> <h2>{t.sources}</h2></div>
            {result.sources.length ? result.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="coach-brain__source-link"><strong>{source.title}</strong><span>{source.url}</span></a>) : <p>{language === "ar" ? "لم يعرض مزود البحث مصادر مباشرة لهذه الإجابة." : "The research provider did not return direct source links for this answer."}</p>}
          </article>
          <div className="coach-brain__safety"><AlertTriangle size={17} /><strong>{t.safety}:</strong><span>{language === "ar" ? "Coach Brain لا يشخّص ولا يقدم علاجًا طبيًا، ولا يوصي بالغمر القسري. في الإصابة أو الألم أو التأهيل السريري يجب الرجوع للمختص المناسب." : "Coach Brain does not diagnose or provide medical treatment, and it does not recommend forced submersion. For injury, pain or clinical rehabilitation, use the appropriate licensed professional."}</span></div>
        </section>
      )}
    </main>
  );
}
