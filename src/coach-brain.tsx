import { FormEvent, useState } from "react";
import { AlertTriangle, BookOpen, Brain, Search, ShieldCheck, Sparkles } from "lucide-react";
import "./coach-brain.css";

type Source = { title: string; url: string };
type ResearchResult = { answer: string; sources: Source[]; searchQueries?: string[] };

const copy = {
  ar: {
    title: "Coach Brain",
    subtitle: "ابحث عن أفضل طرق التدريب والتعليم من الأدلة الحديثة",
    privacy: "اكتب سؤالك فقط. لا يتم إنشاء ملف للسباح أو حفظ بيانات الأطفال.",
    placeholder: "مثال: سباح عمره 12 سنة، 100م حرة في 45 ثانية. كيف أطور السرعة؟ هل أركز على الاستارت أم الدوران؟ وما التدريبات والأدوات المناسبة؟",
    search: "ابحث وحلل",
    searching: "جاري البحث في المصادر وتحليلها...",
    direct: "الإجابة البحثية",
    sources: "المصادر التي اعتمد عليها البحث",
    evidence: "الأدلة",
    safety: "السلامة",
    empty: "اكتب أي سؤال عن السباحة أو التدريب أو التقنية أو الاستارت أو الدوران أو الأدوات.",
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
    searching: "Searching sources and analyzing the evidence...",
    direct: "Research answer",
    sources: "Sources used by the research",
    evidence: "Evidence",
    safety: "Safety",
    empty: "Ask any swimming, coaching, technique, start, turn, training or equipment question.",
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

export type CoachBrainProps = { language?: "ar" | "en" };

export default function CoachBrain({ language = "ar" }: CoachBrainProps) {
  const t = copy[language];
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
      const payload = await response.json().catch(() => ({})) as { success?: boolean; answer?: string; sources?: Source[]; searchQueries?: string[] };
      if (!response.ok || !payload.success || !payload.answer) throw new Error("RESEARCH_FAILED");
      setResult({ answer: payload.answer, sources: Array.isArray(payload.sources) ? payload.sources : [], searchQueries: payload.searchQueries });
    } catch {
      setError(t.error);
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

      <section id="coach-question" className="coach-brain__card coach-brain__research-card">
        <div className="coach-brain__section-heading"><span className="coach-brain__step">1</span><div><strong>{language === "ar" ? "اكتب سؤالك" : "Write your question"}</strong><p>{language === "ar" ? "ابدأ بسؤال واحد واضح لتحصل على خطة قابلة للتنفيذ." : "Start with one clear question for an actionable plan."}</p></div></div>
        <form onSubmit={research}>
          <label className="coach-brain__question-label" htmlFor="coach-brain-question">{language === "ar" ? "ماذا تريد أن تعرف؟" : "What do you want to know?"}</label>
          <textarea id="coach-brain-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t.placeholder} rows={6} maxLength={5000} disabled={busy} />
          <div className="coach-brain__actions">
            <button className="coach-brain__primary" type="submit" disabled={busy || !question.trim()}>
              {busy ? <Sparkles size={17} className="coach-brain__spin" /> : <Search size={17} />}
              {busy ? t.searching : t.search}
            </button>
            <span className="coach-brain__privacy-note">{t.privacyNote}</span>
          </div>
        </form>
        <div id="coach-examples" className="coach-brain__examples">
          <div className="coach-brain__examples-heading"><span className="coach-brain__step">2</span><strong>{language === "ar" ? "أو اختر مثالًا جاهزًا" : "Or choose a ready example"}</strong></div>
          {t.examples.map((example) => <button key={example} type="button" disabled={busy} onClick={() => setQuestion(example)}>{example}</button>)}
        </div>
      </section>

      {error && <section className="coach-brain__error" role="alert"><AlertTriangle size={18} /> {error}</section>}

      {!result && !busy && !error && <section className="coach-brain__empty"><BookOpen size={32} /><strong>{t.empty}</strong></section>}

      {busy && <section className="coach-brain__empty"><Sparkles size={30} className="coach-brain__spin" /><strong>{t.searching}</strong><span>{language === "ar" ? "يتم البحث أولًا ثم تحويل النتائج إلى خطة عملية للمدرب." : "Research comes first, then the findings are turned into a practical coaching plan."}</span></section>}

      {result && (
        <section id="coach-results" className="coach-brain__results" aria-live="polite">
          <div className="coach-brain__results-heading"><span className="coach-brain__step">3</span><div><strong>{language === "ar" ? "النتيجة العملية" : "Practical result"}</strong><p>{language === "ar" ? "اقرأ الإجابة، راجع المصادر، ثم ابدأ سؤالًا جديدًا عند الحاجة." : "Read the answer, review the sources, and start a new question when needed."}</p></div><button type="button" className="coach-brain__reset" onClick={() => { setResult(null); setQuestion(""); setError(""); }}>{language === "ar" ? "بحث جديد" : "New research"}</button></div>
          <article className="coach-brain__card coach-brain__answer">
            <div className="coach-brain__result-title"><Sparkles size={18} /> <h2>{t.direct}</h2></div>
            <div className="coach-brain__answer-text">{result.answer}</div>
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
