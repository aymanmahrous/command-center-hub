import { useMemo, useState } from "react";
import { AlertTriangle, BookOpen, Brain, CheckCircle2, ChevronRight, ShieldCheck, Sparkles } from "lucide-react";
import { evidenceForCoachBrain } from "./coach-brain-evidence";
import "./coach-brain.css";

type RiskBand = "TRAIN" | "ADAPT" | "REFER" | "STOP";

type CaseInput = {
  age: string;
  level: string;
  stroke: string;
  issue: string;
  observation: string;
  goal: string;
  diagnosis: string;
  healthNotes: string;
};

const INITIAL_CASE: CaseInput = {
  age: "",
  level: "",
  stroke: "",
  issue: "",
  observation: "",
  goal: "",
  diagnosis: "",
  healthNotes: "",
};

const HIGH_RISK_TERMS = [
  "uncontrolled seizure",
  "active seizure",
  "recent surgery",
  "chest pain",
  "fainting",
  "loss of consciousness",
  "severe breathing",
  "acute injury",
  "نزيف",
  "إغماء",
  "تشنجات غير مسيطر",
  "عملية حديثة",
  "ألم صدر",
  "فقدان الوعي",
];

const REFERRAL_TERMS = [
  "cerebral palsy",
  "down syndrome",
  "spina bifida",
  "muscular dystrophy",
  "neurological",
  "post surgery",
  "rehabilitation",
  "physiotherapy",
  "physio",
  "تأهيل",
  "علاج طبيعي",
  "شلل دماغي",
  "متلازمة داون",
  "ضمور عضلي",
];

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function classifyRisk(input: CaseInput): RiskBand {
  const text = normalize([input.diagnosis, input.healthNotes, input.issue, input.observation].join(" "));
  if (HIGH_RISK_TERMS.some((term) => text.includes(term))) return "STOP";
  if (REFERRAL_TERMS.some((term) => text.includes(term))) return "REFER";
  if (input.diagnosis.trim() || /autism|adhd|sensory|التوحد|تشتت|حسي/.test(text)) return "ADAPT";
  return "TRAIN";
}

const copy = {
  ar: {
    title: "Coach Brain",
    subtitle: "مساعد السباحة التكيفية ودعم التدريب المائي",
    privacy: "هذه الأداة مخصصة لدعم المدرب وليست أداة تشخيص أو وصف علاج طبي.",
    newCase: "حالة جديدة",
    age: "العمر",
    level: "المستوى",
    stroke: "السباحة / المهارة",
    issue: "المشكلة التي لاحظتها",
    observation: "ماذا رأيت أثناء الحصة؟",
    goal: "الهدف التدريبي",
    diagnosis: "تشخيص معروف إن وُجد (اختياري)",
    healthNotes: "معلومات صحية أو قيود معروفة (اختياري)",
    analyze: "تحليل الحالة بأمان",
    train: "🟢 تدريب سباحة",
    adapt: "🟡 سباحة تكيفية",
    refer: "🟠 إحالة لمختص قبل برنامج تأهيلي",
    stop: "🔴 إيقاف التوصية التدريبية وطلب تقييم مختص",
    verify: "ما يجب التحقق منه",
    plan: "خطة تعليمية أولية",
    drills: "أفكار تمارين",
    safety: "السلامة والحدود",
    sources: "مصادر وأدلة",
    save: "حفظ كحالة تدريبية",
    research: "آخر الأبحاث",
    noDiagnosis: "لا نستنتج تشخيصًا من السلوك أو الأداء.",
    noForced: "لا يوجد إجبار على الغمر أو أي مهارة تخالف استجابة الطفل.",
  },
  en: {
    title: "Coach Brain",
    subtitle: "Adaptive swimming and aquatic-support coaching assistant",
    privacy: "For coaching support only. It does not diagnose conditions or prescribe medical treatment.",
    newCase: "New case",
    age: "Age",
    level: "Level",
    stroke: "Stroke / skill",
    issue: "Observed problem",
    observation: "What did you observe in the session?",
    goal: "Coaching goal",
    diagnosis: "Known diagnosis, if any (optional)",
    healthNotes: "Known health notes or restrictions (optional)",
    analyze: "Analyze safely",
    train: "🟢 Swimming training",
    adapt: "🟡 Adaptive swimming",
    refer: "🟠 Refer before a rehabilitation program",
    stop: "🔴 Stop coaching recommendation and seek professional assessment",
    verify: "What to verify",
    plan: "Initial teaching plan",
    drills: "Drill ideas",
    safety: "Safety and boundaries",
    sources: "Sources and evidence",
    save: "Save as coaching case",
    research: "Latest research",
    noDiagnosis: "Do not infer a diagnosis from behavior or performance.",
    noForced: "No forced submersion or skill should be used against the swimmer's response.",
  },
};

export type CoachBrainProps = { language?: "ar" | "en" };

export default function CoachBrain({ language = "ar" }: CoachBrainProps) {
  const t = copy[language];
  const [input, setInput] = useState<CaseInput>(INITIAL_CASE);
  const [analyzed, setAnalyzed] = useState(false);
  const risk = useMemo(() => classifyRisk(input), [input]);
  const evidence = useMemo(() => evidenceForCoachBrain([input.diagnosis, input.issue, input.observation, input.goal].join(" ")), [input]);

  const update = (key: keyof CaseInput, value: string) => setInput((current) => ({ ...current, [key]: value }));

  const riskText = risk === "TRAIN" ? t.train : risk === "ADAPT" ? t.adapt : risk === "REFER" ? t.refer : t.stop;

  const plan = risk === "STOP"
    ? ["Do not generate a session prescription.", "Confirm the swimmer is safe and follow the family/clinical safety plan.", "Refer to the appropriate licensed professional before aquatic activity when required."]
    : risk === "REFER"
      ? ["Clarify the functional goal and documented restrictions.", "Request the relevant professional guidance before presenting a rehabilitation program.", "Use only low-risk teaching adaptations that are clearly within the coach's scope."]
      : risk === "ADAPT"
        ? ["Break the skill into small predictable steps.", "Use demonstration, short cues, repetition and visual structure.", "Progress only after the swimmer demonstrates safety and readiness."]
        : ["Observe the movement before changing it.", "Choose one coaching cue at a time.", "Use short practice blocks and reassess the same skill before progressing."];

  const drills = risk === "STOP"
    ? ["No drill prescription until the safety concern is resolved."]
    : risk === "REFER"
      ? ["Water familiarization within documented restrictions", "Supported movement exploration", "Simple breathing/relaxation practice only when appropriate"]
      : ["Skill decomposition", "Demonstration + imitation", "Single-variable drill with immediate feedback", "Short repeat sets with a clear success criterion"];

  return (
    <main className="coach-brain" dir={language === "ar" ? "rtl" : "ltr"}>
      <header className="coach-brain__hero">
        <div>
          <div className="coach-brain__eyebrow"><Brain size={17} /> {t.title}</div>
          <h1>{t.subtitle}</h1>
          <p>{t.privacy}</p>
        </div>
        <div className="coach-brain__status"><ShieldCheck size={18} /> Safety Gate</div>
      </header>

      <section className="coach-brain__grid">
        <form className="coach-brain__card" onSubmit={(event) => { event.preventDefault(); setAnalyzed(true); }}>
          <h2>{t.newCase}</h2>
          <div className="coach-brain__fields">
            <label>{t.age}<input value={input.age} onChange={(e) => update("age", e.target.value)} placeholder="10" /></label>
            <label>{t.level}<input value={input.level} onChange={(e) => update("level", e.target.value)} placeholder={language === "ar" ? "مبتدئ / متوسط / متقدم" : "Beginner / Intermediate / Advanced"} /></label>
            <label>{t.stroke}<input value={input.stroke} onChange={(e) => update("stroke", e.target.value)} placeholder={language === "ar" ? "حرة / ظهر / تنفس" : "Freestyle / backstroke / breathing"} /></label>
            <label>{t.goal}<input value={input.goal} onChange={(e) => update("goal", e.target.value)} /></label>
          </div>
          <label>{t.issue}<textarea value={input.issue} onChange={(e) => update("issue", e.target.value)} /></label>
          <label>{t.observation}<textarea value={input.observation} onChange={(e) => update("observation", e.target.value)} /></label>
          <label>{t.diagnosis}<input value={input.diagnosis} onChange={(e) => update("diagnosis", e.target.value)} /></label>
          <label>{t.healthNotes}<textarea value={input.healthNotes} onChange={(e) => update("healthNotes", e.target.value)} /></label>
          <button className="coach-brain__primary" type="submit"><Sparkles size={17} /> {t.analyze}</button>
        </form>

        <section className="coach-brain__card coach-brain__result" aria-live="polite">
          {!analyzed ? (
            <div className="coach-brain__empty"><BookOpen size={34} /><strong>{language === "ar" ? "اكتب الحالة ثم حللها" : "Enter a case and analyze it"}</strong><span>{language === "ar" ? "سيتم تطبيق بوابة السلامة قبل أي اقتراح." : "The safety gate runs before any coaching suggestion."}</span></div>
          ) : (
            <>
              <div className={`coach-brain__risk coach-brain__risk--${risk.toLowerCase()}`}><AlertTriangle size={18} /><strong>{riskText}</strong></div>
              <ResultSection title={t.verify} items={risk === "STOP" ? ["Verify the immediate safety concern", "Follow the swimmer's existing medical/safety plan", "Do not treat this output as clearance for aquatic activity"] : ["Check breathing, comfort and water safety", "Observe the exact movement rather than assuming the cause", "Record what changes with a simpler cue or drill"]} />
              <ResultSection title={t.plan} items={plan} />
              <ResultSection title={t.drills} items={drills} />
              <ResultSection title={t.safety} items={[t.noDiagnosis, t.noForced, language === "ar" ? "أي برنامج تأهيلي سريري يحتاج إشراف المختص المناسب." : "A clinical rehabilitation program requires the appropriate licensed professional."]} />
              <section className="coach-brain__sources"><h3><BookOpen size={16} /> {t.sources}</h3>{evidence.length === 0 ? <p>{language === "ar" ? "لا توجد مصادر محددة لهذه الحالة بعد؛ استخدم بوابة السلامة ولا تعتبر المخرجات تصريحًا طبيًا." : "No specific source was selected for this case yet; use the safety gate and do not treat output as medical clearance."}</p> : evidence.map((source) => <article key={source.id} className="coach-brain__evidence"><strong>{source.title}</strong><small>{source.year} · {source.evidenceLevel}</small><p><b>{language === "ar" ? "الاستخدام العملي" : "Practical use"}:</b> {source.practicalUse}</p><p><b>{language === "ar" ? "حدود الدليل" : "Evidence limitation"}:</b> {source.limitation}</p><a href={source.url} target="_blank" rel="noreferrer">{language === "ar" ? "فتح المصدر" : "Open source"}</a></article>)}</section>
              <button type="button" className="coach-brain__secondary"><CheckCircle2 size={17} /> {t.save}<ChevronRight size={16} /></button>
            </>
          )}
        </section>
      </section>

      <section className="coach-brain__research"><BookOpen size={18} /><div><strong>{t.research}</strong><span>{language === "ar" ? "مصادر منتقاة مع توضيح مستوى الدليل والقيود؛ الربط الحي بمصادر جديدة سيأتي لاحقًا بعد التحقق." : "Curated sources with evidence levels and limitations; live retrieval will come later after verification."}</span></div></section>
    </main>
  );
}

function ResultSection({ title, items }: { title: string; items: string[] }) {
  return <section className="coach-brain__section"><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></section>;
}
