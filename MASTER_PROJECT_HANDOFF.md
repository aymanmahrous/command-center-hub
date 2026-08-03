# MASTER_PROJECT_HANDOFF.md — الحوكمة الدائمة لمشروع Relax Fix UAE / Swim Fluent UAE

هذا الملف هو **مصدر الحقيقة الإداري الدائم** للمشروع. أي مدير أو مستشار أو Agent جديد يجب أن يقرأه أولًا (بالإضافة إلى `AGENTS.md`، `OWNER_WORKING_PROFILE.md`، `OWNER_PROTECTION_AND_BUDGET_POLICY.md`، و`PROJECT_HANDOFF.md`) قبل أي تنفيذ.

## 1. تعريف المشروع والأنظمة المرتبطة

- **المشروع**: Relax Fix UAE / Swim Fluent UAE — منظومة تشغيل ونشر محتوى تجارية للمالك.
- **الأنظمة المرتبطة**:
  - **الموقع العام** (Relax Fix UAE website) — لا يُلمس ولا يُعدَّل من هذا المستودع إطلاقًا.
  - **تطبيق Command Center Hub** (هذا المستودع) — تطبيق تشغيلي داخلي للفريق (Inbox، Bookings، Content Studio، Media Library، Analytics، Integrations).
  - **Supabase** — قاعدة البيانات والمصادقة والـRPCs المعتمدة فقط؛ لا كتابة مباشرة على الجداول من الواجهة.
  - **n8n** — الـWorkflow المسؤول عن دورة اعتماد ونشر المحتوى (Owner Approval → Publishing)، بما يشمل قناة Facebook.
  - **المحتوى والتصميمات** — تُدار عبر Content Studio وجدول `content_items` في Supabase.

## 2. مصادر الحقيقة الحالية (Sources of Truth)

- `PROJECT_HANDOFF.md` — الحالة التقنية التفصيلية لتطوير تطبيق Command Center Hub (الميزات المدمجة، الـPRs، الأدلة التقنية).
- `MASTER_PROJECT_HANDOFF.md` (هذا الملف) — الحالة الإدارية والحوكمية الشاملة، بما فيها مرحلة نشر المحتوى الفعلية عبر n8n والتي تُدار خارج نطاق كود التطبيق.
- `docs/` — أدلة تقنية تفصيلية لكل ميزة (مرجع تكميلي، لا يُعاد فحصه إلا عند الحاجة الفعلية).
- `SWIM_FLUENT_DESIGN_SYSTEM.md` — **الاستراتيجية الرسمية والمرجع الإلزامي لكل وكيل تصميم** (العائلات الأربع، نسب الاستخدام، قواعد الهوية، الممنوعات، خطوات المراجعة). الحالة: `DESIGN_STRATEGY_LOCK_V1 — OWNER_APPROVED — ACTIVE IMMEDIATELY`. يُقرأ إلزاميًا قبل أي عمل تصميمي جديد ولا يُعاد فتحه من الصفر.
- عند التعارض بين الملفات: يُرجَّح آخر بند مؤكَّد ومسجَّل في هذا الملف تحت "آخر نتيجة مؤكدة"، ولا يُفترض أي شيء لم يُسجَّل صراحة هنا.

## 3. حالة الأنظمة

| النظام | الحالة |
|---|---|
| الموقع العام | خارج نطاق هذا المستودع؛ لا تغيير ولا نشر منه. |
| تطبيق Command Center Hub | الواجهة بعد تسجيل الدخول تم التحقق منها بصريًا فقط (Authenticated UI visually verified). RBAC، الـAPIs، عمليات الكتابة (write operations)، الإسناد (attribution)، وبعض المسارات الوظيفية **غير مُتحقَّق منها بالكامل** بعد. |
| Supabase | متصل ومُستخدَم عبر RPCs معتمدة فقط؛ لا Migration أو RLS جديدة دون موافقة صريحة. |
| n8n | الـWorkflow الخاص باعتماد ونشر المحتوى مبني ويعمل داخليًا حتى نقطة Owner Approval. |
| المحتوى | تم إنشاء واعتماد عنصر Facebook حقيقي واحد داخل `content_items` (انظر CURRENT_BLOCKER). |
| التصميمات | استراتيجية التصميم الرسمية مثبّتة ومفعّلة: `DESIGN_STRATEGY_LOCK_V1 — OWNER_APPROVED — ACTIVE IMMEDIATELY` (انظر `SWIM_FLUENT_DESIGN_SYSTEM.md`). لا تصميم أو نشر حي جديد في هذه المرحلة. |

## 4. ما يعمل وما لم يتم التحقق منه

**يعمل ومؤكَّد:**
- الواجهة الأمامية لتطبيق Command Center Hub بعد تسجيل الدخول: Authenticated UI visually verified.
- Workflow اعتماد المحتوى في n8n يعمل داخليًا وينفّذ حتى خطوة Owner Approval بنجاح دون نشر فعلي.
- إنشاء واعتماد عنصر Facebook حقيقي نصي بدون وسائط (`content_item_id: 9cf29b08-aaa3-4278-80bc-08a4cf3bc381`) وعرضه على المالك.

**لم يتم التحقق منه بعد:**
- RBAC، الـAPIs، عمليات الكتابة (write operations)، الإسناد (attribution)، وبعض المسارات الوظيفية للتطبيق — غير مُتحقَّق منها بالكامل.
- النشر الفعلي لعنصر Facebook الحقيقي عبر الـWorkflow (بانتظار تنفيذ التفويض المحدد من المالك).
- سلوك الـWorkflow الكامل بعد النشر الفعلي (توليد Facebook Post ID، الرابط، وقت النشر، execution ID، وreceipt status).

## 5. البنود المغلقة والمؤجلة والممنوعة

**مغلقة (لا تُعاد):**
- بناء واختبار تطبيق Command Center Hub التقني وميزاته الأساسية (موثّق بالتفصيل في `PROJECT_HANDOFF.md`).
- الاختبار الداخلي الأول لـWorkflow اعتماد المحتوى حتى نقطة Owner Approval — نجح ولا يُعاد فحصه دون خطأ مباشر جديد.

**مؤجلة:**
- Release Readiness Review للتطبيق (مذكورة في `PROJECT_HANDOFF.md`) — بند تقني مؤجل فقط، لا يُدرَج ضمن ترتيب مراحل خطة التسويق في القسم 6 ولا يعطلها.

**ممنوعة:**
- استخدام `test-content-0001` كعنصر اختبار حقيقي — إنه **Mock فقط** ولا يُستخدم للنشر أو كدليل جاهزية.
- إعادة فحص أي بند مغلق أعلاه دون سبب/خطأ مباشر وموثّق.
- إنشاء خطة عمل جديدة من الصفر تتجاوز أو تستبدل ترتيب المراحل المعتمد أدناه.
- أي نشر أو تفعيل أو حذف أو Merge أو Migration دون موافقة صريحة من المالك.

## 6. ترتيب المراحل المتبقية المعتمد

1. Complete and safely test Facebook publishing ← المرحلة الحالية (انظر CURRENT_PHASE في القسم 7).
2. Complete and test Instagram.
3. Approve and schedule week-one content.
4. Create and approve media after text approval.
5. Live publishing with receipts.
6. GA4 / UTM / Attribution / Conversion Tracking.
7. SEO / Local SEO.
8. Chatbot for service and leads.
9. n8n alerts / follow-ups / reports.
10. Google Ads.
11. Meta Ads.

لا يجوز تغيير هذا الترتيب أو تجاوز مرحلة قبل إغلاق التي تسبقها. Release Readiness Review لتطبيق Command Center Hub بند تقني مؤجل (القسم 5) ولا يُدرَج بين هذه المراحل.

## 7. CURRENT_PHASE

**Facebook Controlled Publishing Test**

## 8. CURRENT_BLOCKER

تم إنشاء عنصر Facebook حقيقي ومعتمد: `content_item_id: 9cf29b08-aaa3-4278-80bc-08a4cf3bc381`.
النشر الفعلي يتطلب تنفيذ التفويض المحدد من المالك ثم تسجيل إيصال النشر.

## 9. آخر نتيجة مؤكدة

تم إنشاء واعتماد عنصر Facebook حقيقي نصي بدون وسائط، وعُرض على المالك. منح المالك تفويضًا محدودًا لهذا المنشور الواحد فقط، دون Boost أو إعلانات أو إعادة نشر أو Retry تلقائي عند غموض النتيجة.

## 10. الخطوة الحالية (NEXT)

تنفيذ نشر عنصر Facebook المصرح به فقط عبر المسار المعتمد، ثم تقديم: Facebook Post ID، رابط المنشور، وقت النشر الفعلي، execution ID، وreceipt status. عند غموض النتيجة لا يُعاد النشر.

## 11. تذكير إلزامي لكل Agent

- لا تبدأ من الصفر — التزم بـCURRENT_PHASE أعلاه.
- لا تعِد فحص البنود المغلقة في القسم 5.
- لا تستخدم `test-content-0001` كدليل جاهزية أو للنشر.
- أي نشر فعلي لعنصر Facebook يتطلب موافقة صريحة من المالك بعد عرض العنصر عليه، ضمن التفويض المحدود المذكور في القسم 9 (منشور واحد فقط، بدون Boost أو إعلانات أو إعادة نشر).
- عند غموض نتيجة النشر: لا تُعِد المحاولة تلقائيًا؛ أبلغ المدير/المالك.
- التزم بحدود الأنظمة المعتمدة في القسم 12 (APPROVED SYSTEM BOUNDARIES) ولا تلمس الأنظمة أو الحسابات غير المدرجة فيه.

## 12. APPROVED SYSTEM BOUNDARIES

- Active Supabase project only: `nmzxrjdxvmmzzmajrskm`
- Never touch inactive Supabase: `aazhniddjvhuimlxxjfd`
- Approved n8n workflow only: `xNwYPSXQiUyzDSyZ`
- Old workflows must remain inactive and untouched: `7OVKtZ2TAZsrDIXc`, `Vj8Xh4UQ534LYist`
- Facebook Page ID: `1164107840123575`
- Instagram Account ID: `17841439747493221`
- Never expose tokens or secrets in documentation.

## 13. FUTURE PHASE ASSETS — DO NOT REBUILD

نتيجة Second-Pass Discovery Audit (2026-08-03) على مستودع الموقع العام `swim-fluent-uae` وSupabase الفعّال وn8n المعتمد. لا تُعاد بناء ما يلي عند وصول دور المراحل 6-8؛ التحقق النهائي من الحسابات الخارجية يبقى مطلوبًا أولًا:

- **SEO**: البنية التقنية (sitemap.xml, robots.txt, canonical, Open Graph, Schema.org JSON-LD لـ Organization/Person/Service) مبنية ومختبرة بعقود في `swim-fluent-uae`؛ موثّقة بتفصيل في `docs/seo/`.
- **GA4**: الكود موجود (Consent Mode v2) لكنه معطّل (`VITE_ENABLE_GA4=false`) وبدون Measurement ID مؤكد.
- **Chatbot الموقع**: واجهة FAQ أمامية مبنية ومتحقَّق منها بصريًا مرة واحدة في Preview، لكنها معطّلة بـ Feature Flag ولا تُخزّن أو ترسل أي بيانات.
- **Supabase**: جداول `conversations`/`leads`/`knowledge_entries` جاهزة هيكليًا للمرحلة 8 لكنها فارغة (0 صف).
- لا يوجد اتصال حي مؤكد بـ WhatsApp Business API أو Facebook Messenger أو Instagram Messaging (لا Webhooks، لا بيانات مسجَّلة).
- **Vercel Production / الدومين / Google Search Console / Google Business Profile**: BLOCKED_BY_ACCESS أو UNVERIFIED — لم تُفحص مباشرة في هذا الجرد؛ تتطلب دخول المالك عند وصول دور المرحلة المعنية فقط.
