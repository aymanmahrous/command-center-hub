# خطة اعتماد Coach Brain وIntegrations — شفافية التكلفة

**الحالة:** خطة عرض واعتماد فقط. لا تمنح هذه الوثيقة تفويضًا لتعديل التطبيق أو إنشاء Merge أو Deploy أو إجراء اختبار خارجي.

## القرار الإداري

- الحفاظ على الموجود أولًا، ومنع التكرار أو التلف.
- لا إعادة بناء لـ`UX` أو `Integrations` ولا إعادة اختبارات موثقة النجاح.
- يبقى `PR #161` (**Verified / Ready for Review / Not Merged / Not Deployed**) نقطة البداية المرجعية.
- أي خطوة تنفيذ لاحقة تحتاج موافقة مستقلة مناسبة لها؛ طلب اختصار أو تغيير تقني لا يغيّر ترتيب الخطة تلقائيًا.

## الحالة الحالية المؤكدة

- المراجعة القراءة فقط لم تجد أسرارًا hard-coded ظاهرة في كود واجهة Integrations.
- القيم السرية تأتي من إدخال المستخدم وتُرسل إلى RPC، ولا يظهر بعد الحفظ إلا `secretHint` إن توفر.
- عقد تجربة المالك للتكاملات غير مكتمل: الواجهة ما زالت تعرض مصطلحات تقنية، ولا تثبت اتصالًا خارجيًا حقيقيًا.
- **Owner UX integration contract = NOT COMPLETE**.
- **External capability verification = NOT COMPLETE**.
- لا يُعدّل الكود في هذه المرحلة؛ تُسجل الفجوات كخطوات ذرية لاحقة.

## المراحل الثابتة

### المرحلة 0 — Continuity Gate

قراءة آخر Hand-off وتقرير آخر خطوة، وتسجيل حالة `PR #161`، وتجاوز الفحوص الموثقة مكتملتها. لا إنشاء PR جديد ولا إعادة اختبارات `218` أو Build/TypeScript/Performance إلا عند ظهور تعارض أو تغيير. يظل Facebook `BLOCKED / NOT OPERATIONALLY VERIFIED` وBuffer `UNVERIFIED` إن لم يظهر دليل جديد. **المخرج تقرير حالة قصير، وليس تنفيذًا.**

### المرحلة 1 — Owner UX Smoke Test

بعد أن يصبح `PR #161` مدموجًا ومنشورًا رسميًا، وبعد موافقة مستقلة على ذلك فقط، يُختبر مسار التنقل: `Home → Content → Inbox → Media → Operations → More`. يتحقق الاختبار من ظهور واجهة مالك واحدة، اختفاء الواجهة القديمة والروابط المكررة، صحة الأزرار والمسارات، عدم وجود صفحات فارغة أو ميزات مفقودة، وعدم تكرار محتوى Home. لا Merge أو Deploy تلقائيًا.

### المرحلة 2 — Integrations Owner-UX Audit

مراجعة قراءة محدودة للقائمة الحالية فقط، وتصنيف كل مزود إلى: `Provider / Current UI item / Connect method / Open available / Test type / Status evidence / Owner-safe copy / Gap`. يجب ألا تظهر مفاتيح أو Tokens، وألا تعرض الواجهة مصطلحات تقنية، وألا تظهر `Connected` بلا دليل، وأن تكون معاني `Connect / Open / Reconnect / Disconnect` واضحة. لا يضيف الوكيل OAuth أو Provider أو Credential ولا يعدل الكود؛ يقدّم تقريرًا فقط.

### المرحلة 3 — Integrations Atomic Step

لا تبدأ إلا بعد تقرير المرحلة 2 وموافقة مستقلة على تعديل محدد. يقتصر التعديل على أصغر تغيير ممكن، مثل إخفاء تسمية تقنية، استبدال `Credential` بنص مفهوم للمالك، فصل فحص الإعداد المحلي عن `Test Connection` الخارجي، أو إضافة `Open Service` فقط عند ثبوت الرابط/المسار. اختبار الشاشة المتأثرة فقط ثم التوقف.

### المرحلة 4 — Coach Brain والتكلفة

يبقى Coach Brain مدخلًا واحدًا تحت `Coach Brain` مع روابط سياقية من `Content` أو `Home` أو `More`، ولا يتحول إلى صفحة AI مكررة. قبل أي `Generate` أو تصميم أو اقتراح مدفوع، تعرض الواجهة: ما سيتم إنشاؤه، المصدر/القدرة المستخدمة، مجاني أم مدفوع، التكلفة التقديرية إن كانت مؤكدة، والبديل المجاني إن توفر. لا استخدام صامت لخدمة مدفوعة؛ وإذا كانت القدرة أو التكلفة غير مؤكدة تظهر `UNVERIFIED` ولا يختار المالك `Token` أو `API` أو `Model ID` نيابة عن النظام.

### المرحلة 5 — Facebook Publish Block

تظل منفصلة تمامًا عن UX وIntegrations ولا تبدأ إلا بموافقة تنفيذ صريحة: Authorization جديد → عنصر محتوى واحد لنفس Job → Facebook Test واحد → Meta response → Error أو Receipt → **STOP**. لا تعديل كود تلقائي ولا اختبار Instagram أو n8n أو Buffer في الجولة نفسها. عند الفشل يُقدّم السبب والتعديل الأدنى فقط، ثم ينتظر موافقة جديدة.

## بوابة منع تغيير الخطة

لا يجوز تغيير ترتيب المراحل أو دمجها أو تنفيذ مرحلة لاحقة لمجرد أنها أسرع. أي تغيير يحتاج توثيق:

- `CHANGE REASON:`
- `NEW EVIDENCE:`
- `RISK IF UNCHANGED:`
- `LOWEST-RISK ALTERNATIVE:`
- `REQUIRED OWNER APPROVAL:`

لا يتحول طلب المالك غير التقني إلى أمر تقني إذا أدى إلى حذف أو كسر أو تكرار؛ يختار المدير الحل الآمن ويشرح النتيجة بلغة بسيطة.

## قالب توجيه المرحلة والتقرير

كل توجيه يجب أن يحدد: `Atomic Step / Goal / Starting Evidence / Allowed Scope / Forbidden / Verification / Stop Condition / Required Report`.

ويجب أن يتضمن التقرير: `STATUS (PASS / PARTIAL / BLOCKED / SAFE STOP)`, `STARTING POINT`, `AUTHORIZED SCOPE`, `DONE`, `VERIFIED`, `NOT VERIFIED`, `FILES CHANGED`, `PRODUCTION IMPACT`, `RESOURCE/CREDIT STATUS`, `UNFINISHED WORK`, و`NEXT APPROVED POINT`.

## التوقف الآمن

عند الاقتراب من حد الرصيد أو الوقت، أو عند ظهور حاجة إلى Trial and Error أو Full Scan أو صلاحية محمية:

> **STOP IMMEDIATELY → SAFE STOP HANDOFF → WAIT**

لا إعادة محاولة، ولا تعديل، ولا حذف، ولا ادعاء نجاح دون دليل.

## القيود التنفيذية

هذه الوثيقة لا تغيّر الكود ولا قاعدة البيانات ولا التكاملات ولا النشر. لا Merge أو Deploy أو اختبار خارجي قبل الموافقة المستقلة المناسبة لكل مرحلة.

**المصدر:** `plan.docx` المقدم من المالك بتاريخ 2026-09-27.
