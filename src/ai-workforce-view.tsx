import { Bot, BrainCircuit, ClipboardCheck, Factory, Image, LockKeyhole, SearchCheck, ShieldCheck, Video, Workflow } from "lucide-react";
import "./ai-workforce.css";

type Language = "ar" | "en";
type Destination = "brain" | "content" | "media" | "connections" | "integrations";
type Entry = {
  id: string;
  name: string;
  category: string;
  status: "governance" | "in_app" | "embedded" | "unverified" | "historical" | "manual" | "human" | "frozen";
  responsibility: string;
  handoff: string;
  boundary: string;
  destination?: Destination;
  icon: typeof Bot;
};

const entries: Entry[] = [
  {
    id: "guardian",
    name: "A–Z Guardian",
    category: "governance",
    status: "governance",
    responsibility: "الإشراف التنفيذي والتقني على التطبيق، توزيع المهام، منع التكرار، ومراجعة نتائج كل وكيل.",
    handoff: "يستقبل هدف المالك ويحدد المسؤول والنتيجة المطلوبة.",
    boundary: "دور إشرافي خارج تشغيل التطبيق؛ لا يدّعي وجود Agent runtime مستقل داخله.",
    icon: ShieldCheck,
  },
  {
    id: "coach-brain",
    name: "Coach Brain",
    category: "coordinator",
    status: "in_app",
    responsibility: "يفهم الهدف التسويقي، يبحث، يضع الاستراتيجية، ويجهز موجز المهمة للمصنع.",
    handoff: "يسلّم موجزًا منظمًا إلى Content Factory عبر المسار الحالي.",
    boundary: "منسق داخل التطبيق، وليس فريقًا مستقلًا يعمل ذاتيًا في الخلفية.",
    destination: "brain",
    icon: BrainCircuit,
  },
  {
    id: "research",
    name: "Gemini Research",
    category: "specialist-capability",
    status: "unverified",
    responsibility: "تنفيذ البحث عبر مسار Coach Brain الحالي وتجميع المصادر والسياق.",
    handoff: "ملخص بحث ومصادر يعودان إلى Coach Brain.",
    boundary: "قدرة تنفيذ موجودة في مسار قائم؛ جاهزية بيانات اعتماد الخادم والتشغيل الحي غير مثبتة هنا.",
    destination: "brain",
    icon: SearchCheck,
  },
  {
    id: "strategy",
    name: "Marketing Strategy",
    category: "embedded-logic",
    status: "embedded",
    responsibility: "تحديد الجمهور والرسائل ومزيج المحتوى وأهداف الحملة.",
    handoff: "يوجه خطة Coach Brain ولا ينشئ طابورًا أو سجل مهام منفصلًا.",
    boundary: "منطق مدمج داخل Coach Brain، وليس وكيلًا مستقلاً.",
    destination: "brain",
    icon: Workflow,
  },
  {
    id: "factory",
    name: "Content Factory",
    category: "workflow",
    status: "in_app",
    responsibility: "تحويل الخطة إلى عناصر محتوى، توزيعها على المدة المحددة، وتجهيزها للمراجعة.",
    handoff: "موجز Coach Brain → دفعة المحتوى الحالية → Review.",
    boundary: "سير إنتاج موجود، وليس Agent runtime عام لكل مهام التطبيق.",
    destination: "content",
    icon: Factory,
  },
  {
    id: "design",
    name: "Design Specialist",
    category: "integration-capability",
    status: "unverified",
    responsibility: "إنتاج أو تجهيز الأصول البصرية عبر Canva ومسار الصور الحالي.",
    handoff: "الأصل يُربط بعنصر المحتوى ثم يظهر في Media Library / Review.",
    boundary: "اتصال Canva المسجل لا يثبت اكتمال إنشاء التصميم وتصديره. لا تشغيل مدفوع تلقائي.",
    destination: "connections",
    icon: Image,
  },
  {
    id: "video",
    name: "Video Specialist",
    category: "provider-and-handoff",
    status: "historical",
    responsibility: "مسار الفيديو الحالي يعتمد على Google Veo عند توفره؛ Runway يظل تسليمًا يدويًا.",
    handoff: "الفيديو أو الـbrief ينتقل إلى مكتبة الوسائط والمراجعة.",
    boundary: "يوجد سجل Veo ناجح سابقًا، لكن الأصل المرتبط كان محجوبًا عن المراجعة بسبب موافقة غير معروفة. Runway ليس API متصلًا.",
    destination: "media",
    icon: Video,
  },
  {
    id: "review",
    name: "Human Review",
    category: "human-gate",
    status: "human",
    responsibility: "مراجعة النصوص والتصميمات والوسائط، واعتماد ما يوافق هوية الأكاديمية.",
    handoff: "لا ينتقل المحتوى إلى مرحلة لاحقة دون قرار بشري واضح.",
    boundary: "بوابة بشرية وليست وكيل ذكاء اصطناعي.",
    destination: "content",
    icon: ClipboardCheck,
  },
  {
    id: "publisher",
    name: "Publisher",
    category: "protected-service",
    status: "frozen",
    responsibility: "التوزيع عبر مسار النشر الحالي بعد وجود تفويض مالك صالح.",
    handoff: "لا يستقبل إلا محتوى اجتاز المراجعة والتفويض المطلوب.",
    boundary: "النشر والجدولة وإعادة المحاولة محمية ومجمّدة حاليًا؛ لا تنفيذ أو تفعيل من هذه الشاشة.",
    destination: "integrations",
    icon: LockKeyhole,
  },
];

const copy = {
  ar: {
    eyebrow: "AI WORKFORCE · OWNER VIEW",
    title: "فريق الذكاء الاصطناعي",
    intro: "قائمة موحدة للأدوار والقدرات ومسؤوليات التسليم. المدير التنفيذي/التقني ينسق الفريق، وCoach Brain يقود أعمال التسويق والمحتوى.",
    roster: "الفريق والقدرات الحالية",
    open: "فتح المسار الحالي",
    governance: "إشراف وحوكمة",
    in_app: "موجود داخل التطبيق",
    embedded: "منطق مدمج",
    unverified: "يحتاج تحققًا",
    historical: "دليل سابق فقط",
    manual: "تسليم يدوي",
    human: "قرار بشري",
    frozen: "محمي / مجمّد",
    flowTitle: "مسار العمل المعتمد",
    flow: [
      ["1", "A–Z Guardian", "يحدد المهمة والمسؤول والحدود"],
      ["2", "Coach Brain", "بحث واستراتيجية وموجز منظم"],
      ["3", "Content Factory", "إنتاج العناصر وربط الوسائط"],
      ["4", "Media Library + Review", "حفظ الأصل ثم المراجعة البشرية"],
      ["5", "Publisher", "متوقف حتى تفويض المالك"],
    ],
    truthTitle: "ما لا ينبغي أن نَدّعيه الآن",
    truth: "لا يوجد حتى الآن سجل عام موحد لتشغيل وكلاء مستقلين أو إنشاء وكلاء جدد من الواجهة. سجلات تشغيل المحتوى الحالية تخص الأتمتة والمحتوى، ولا يصح تحويلها إلى سجل وكلاء وهمي. لذلك تعرض هذه الصفحة الموجود بدقة، ولا تعرض حالة تشغيل أو إنجازًا غير مثبت.",
    addTitle: "قاعدة إضافة أي وكيل جديد",
    add: "لا يُضاف الاسم إلى القائمة إلا بعد تحديد مهمته ومدخلاته ومخرجاته والأدوات المسموحة وحدود الصلاحية ومسار التسليم واختبار نتيجة حقيقية. لا يكفي ربط مزود أو إضافة زر لتسمية ذلك وكيلًا.",
    providerTitle: "المزودون ليسوا وكلاء",
    providers: "Gemini وOpenAI نماذج/مزودون يمكن أن يستخدمهم أكثر من دور. Canva وVeo أدوات إنتاج، وRunway تسليم يدوي حاليًا. لا نكررهم كمديرين مستقلين.",
    readOnly: "عرض تنظيمي فقط — لا يطلق توليدًا أو رسائل أو جدولة أو نشرًا.",
  },
  en: {
    eyebrow: "AI WORKFORCE · OWNER VIEW",
    title: "AI Workforce",
    intro: "One clear roster of roles, capabilities, and handoffs. A–Z Guardian governs the whole system; Coach Brain leads marketing and content work.",
    roster: "Current roles and capabilities",
    open: "Open existing workflow",
    governance: "Governance",
    in_app: "In the app",
    embedded: "Embedded logic",
    unverified: "Needs verification",
    historical: "Historical evidence only",
    manual: "Manual handoff",
    human: "Human decision",
    frozen: "Protected / frozen",
    flowTitle: "Approved work path",
    flow: [
      ["1", "A–Z Guardian", "Defines task, owner, and boundaries"],
      ["2", "Coach Brain", "Research, strategy, and structured brief"],
      ["3", "Content Factory", "Creates items and links media"],
      ["4", "Media Library + Review", "Stores the asset for human review"],
      ["5", "Publisher", "Paused until owner authorization"],
    ],
    truthTitle: "What is not proven yet",
    truth: "There is no general registry or execution ledger for independent agents, and no safe create-agent workflow in the app. Existing content automation runs are content-specific; they must not be presented as a generic agent ledger. This page reports existing capabilities without inventing live status or completed work.",
    addTitle: "Rule for adding a new agent",
    add: "A new agent is registered only after its mission, inputs, outputs, allowed tools, permission boundaries, handoff, and real-result test are defined. A provider connection or a button alone does not make an agent.",
    providerTitle: "Providers are not agents",
    providers: "Gemini and OpenAI are model providers that may serve multiple roles. Canva and Veo are production tools; Runway is currently a manual handoff. They are not independent managers.",
    readOnly: "Directory view only — no generation, messages, scheduling, or publishing is triggered.",
  },
};

export default function AIWorkforceView({ language, onNavigate }: {
  language: Language;
  onNavigate: (destination: Destination) => void;
}) {
  const t = copy[language];
  const statusLabel: Record<Entry["status"], string> = {
    governance: t.governance,
    in_app: t.in_app,
    embedded: t.embedded,
    unverified: t.unverified,
    historical: t.historical,
    manual: t.manual,
    human: t.human,
    frozen: t.frozen,
  };

  return <div className="ai-workforce">
    <header className="ai-workforce-intro">
      <p className="eyebrow">{t.eyebrow}</p>
      <h2>{t.title}</h2>
      <p>{t.intro}</p>
      <div className="ai-workforce-readonly"><ShieldCheck size={16} />{t.readOnly}</div>
    </header>

    <section className="ai-workforce-section" aria-labelledby="ai-workforce-roster">
      <div className="ai-workforce-section-heading">
        <h3 id="ai-workforce-roster">{t.roster}</h3>
        <span>{entries.length}</span>
      </div>
      <div className="ai-workforce-grid">
        {entries.map((entry) => {
          const Icon = entry.icon;
          return <article className="ai-workforce-card" key={entry.id}>
            <div className="ai-workforce-card-top">
              <span className="ai-workforce-icon"><Icon size={20} /></span>
              <span className={`ai-workforce-status status-${entry.status}`}>{statusLabel[entry.status]}</span>
            </div>
            <h4>{entry.name}</h4>
            <p className="ai-workforce-category">{entry.category.replaceAll("-", " ")}</p>
            <dl>
              <div><dt>{language === "ar" ? "المسؤولية" : "Responsibility"}</dt><dd>{language === "ar" ? entry.responsibility : ({
                guardian: "Whole-app technical and executive oversight, delegation, anti-duplication, and evidence review.",
                "coach-brain": "Understands marketing goals, researches, plans strategy, and prepares a task brief for Factory.",
                research: "Runs research through the existing Coach Brain path and returns sources and context.",
                strategy: "Defines audience, messaging, content mix, and campaign goals inside Coach Brain.",
                factory: "Turns the strategy into content items, spaces them over the chosen horizon, and prepares review.",
                design: "Produces or prepares visual assets through Canva and the existing image path.",
                video: "Uses the existing Google Veo path when available; Runway remains a manual handoff.",
                review: "Reviews copy, designs, and media; the owner retains approval.",
                publisher: "Distributes content only after review and valid owner authorization.",
              } as Record<string, string>)[entry.id]}</dd></div>
              <div><dt>{language === "ar" ? "التسليم" : "Handoff"}</dt><dd>{language === "ar" ? entry.handoff : ({
                guardian: "Receives the owner's goal and assigns an accountable capability.",
                "coach-brain": "Hands a structured brief to the existing Content Factory path.",
                research: "Returns a research summary and sources to Coach Brain.",
                strategy: "Guides Coach Brain without creating a separate queue or ledger.",
                factory: "Coach Brain brief → existing content batch → Review.",
                design: "Links the asset to the content item for Media Library / Review.",
                video: "Video asset or brief moves to Media Library and review.",
                review: "Nothing advances without a clear human decision.",
                publisher: "Receives only reviewed content with required authorization.",
              } as Record<string, string>)[entry.id]}</dd></div>
              <div><dt>{language === "ar" ? "الحدود" : "Boundary"}</dt><dd>{language === "ar" ? entry.boundary : ({
                guardian: "Governance role outside app execution; not a separate in-app agent runtime.",
                "coach-brain": "In-app coordinator, not an autonomous background team.",
                research: "Existing execution capability; server credential readiness and live operation are not currently proven.",
                strategy: "Embedded logic, not an independent agent.",
                factory: "Existing production workflow, not a general-purpose agent runtime.",
                design: "A connected Canva registry entry does not prove end-to-end design creation and export. No paid operation is triggered.",
                video: "One prior Veo job succeeded, but its linked asset was blocked from review because consent was unknown. Runway is not API-connected.",
                review: "Human gate, not an AI agent.",
                publisher: "Publishing, scheduling, and retry are protected and frozen; this page cannot trigger them.",
              } as Record<string, string>)[entry.id]}</dd></div>
            </dl>
            {entry.destination && <button type="button" className="ai-workforce-open" onClick={() => onNavigate(entry.destination!)}>{t.open}</button>}
          </article>;
        })}
      </div>
    </section>

    <section className="ai-workforce-section">
      <h3>{t.flowTitle}</h3>
      <ol className="ai-workforce-flow">
        {t.flow.map(([number, title, description]) => <li key={number}>
          <span>{number}</span><div><strong>{title}</strong><small>{description}</small></div>
        </li>)}
      </ol>
    </section>

    <section className="ai-workforce-notes">
      <article><h3>{t.truthTitle}</h3><p>{t.truth}</p></article>
      <article><h3>{t.addTitle}</h3><p>{t.add}</p></article>
      <article><h3>{t.providerTitle}</h3><p>{t.providers}</p></article>
    </section>
  </div>;
}
