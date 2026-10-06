# MASTER_PROJECT_HANDOFF.md — الحوكمة الدائمة لمشروع Relax Fix UAE / Swim Fluent UAE

هذا الملف هو **مصدر الحقيقة الإداري الدائم** للمشروع. أي مدير أو مستشار أو Agent جديد يجب أن يقرأه أولًا (بالإضافة إلى `AGENTS.md`، `OWNER_WORKING_PROFILE.md`، `OWNER_PROTECTION_AND_BUDGET_POLICY.md`، و`PROJECT_HANDOFF.md`) قبل أي تنفيذ.

## CURRENT EXECUTIVE MANDATE — ACTIVE

هذا القسم هو المرجع التنفيذي الحالي عند تعارضه مع تعليمات تاريخية في هذا الملف.

1. المالك غير تقني، ولا يُطلب منه اتخاذ قرارات تقنية.
2. المدير التقني والاستراتيجي هو صاحب التشخيص والقرار وتحديد نطاق التنفيذ.
3. الوكيل التنفيذي أداة تنفيذ فقط، ولا يوسّع النطاق من تلقاء نفسه.
4. أي تعليمات تاريخية تقول `approval only` أو `no execution without independent approval` تُعتبر تعليمات لمرحلة سابقة إذا تعارضت مع هذا التفويض التنفيذي الحالي.
5. المدير مخوّل بتفويض الوكيل لتنفيذ إصلاحات آمنة داخل Command Center Hub عندما تكون ضرورية لتحقيق هدف المنتج.
6. نطاق الإصلاح المسموح به عند الضرورة المثبتة:
   - Frontend / UX
   - Connections
   - Media
   - Content workflow
   - Existing publishing workflow
   - Safe production deployment عند الحاجة
7. لا إعادة بناء من الصفر، ولا إنشاء أنظمة مكررة.
8. لا fake Connected / Published / Generated / Success؛ كل حالة نجاح يجب أن تستند إلى دليل حقيقي.
9. لا تغيير واسع في Supabase schema أو RLS أو OAuth أو Meta أو n8n أو Buffer إلا إذا ثبتت الضرورة؛ عندها يتوقف الوكيل عند الحد الذي يحتاج قرارًا إضافيًا.
10. لا نشر حقيقي على Facebook أو Instagram إلا بعد أن يحدد المدير أن المسار جاهز للاختبار.
11. كل تنفيذ يكون Atomic Step واحدة فقط.
12. بعد نجاح Atomic Step يتوقف الوكيل.
13. يُعاد استخدام Verified Evidence ولا يُعاد اختبارها بلا سبب مباشر.
14. الهدف هو تبسيط المنتج وإصلاح الموجود، وليس زيادة الكود أو الصفحات.

### قاعدة تعارض التعليمات

إذا تعارضت تعليمات تاريخية في هذا الـHandoff مع `CURRENT EXECUTIVE MANDATE — ACTIVE`، فيُعتبر التفويض الحالي هو المرجع التنفيذي الحالي، مع الالتزام بحدود الأمان والنطاق أعلاه.

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
- عند التعارض بين الملفات: يُرجَّح آخر بند مؤكَّد ومسجَّل في هذا الملف تحت "آخر نتيجة مؤكدة"، ولا يُفترض أي شيء لم يُسجَّل صراحة هنا.

## 3. حالة الأنظمة

| النظام | الحالة |
|---|---|
| الموقع العام | خارج نطاق هذا المستودع؛ لا تغيير ولا نشر منه. |
| تطبيق Command Center Hub | `main` عند `b0dfb87806d9b80a05f958e3619e589690f1991c` بعد PR #195؛ هذا يثبت نسخة الشيفرة فقط ولا يثبت نسخة Production الحالية. المسار التشغيلي الجاري فحصه موثق في القسم 9. |
| Supabase | المشروع النشط `nmzxrjdxvmmzzmajrskm` بحالة `ACTIVE_HEALTHY`؛ استُخدمت قراءات محدودة فقط في Atomic Step 4، بلا كتابة أو Migration أو RLS. |
| n8n | المسار المعتمد موثق حتى Owner Approval؛ لم يُعثر على تنفيذ لهذا العنصر في نافذة النشر المسجلة. لا ننسب النشر إلى n8n دون دليل. |
| المحتوى | يوجد عنصر Instagram حقيقي بحالة `published` وإيصال داخلي مطابق؛ ظهور المنشور للجمهور لم يُتحقق منه مستقلًا. |
| التصميمات | لا تغيير مطلوب في هذه المرحلة. |

## 4. ما يعمل وما لم يتم التحقق منه

**أدلة مؤكدة:**
- PR #195 دُمج بعد موافقة المالك ونجاح فحوصاته؛ غيّر وصف الحالة إلى نجاح فحص الإعداد المحلي، ولم يختبر مزودًا خارجيًا.
- للعنصر `ffb9f795-c359-43c5-861c-5594eda75eef` تطابق سجل المحتوى والإيصال ومعرّف المنشور ومهمة النشر وتفويض المالك؛ التفاصيل والحدود في القسم 9.
- اجتازت مجموعة Button/Capability Audit المركزة 26/26 اختبارًا قبل PR #195؛ هذا تحقق عقدي محدود، وليس فحصًا بصريًا أو تدقيقًا كاملًا.

**غير مؤكد بعد:**
- علاقة الوسيط بالعنصر لها رابط مباشر من `content_items.media_asset_id`، لكن سجل الوسيط نفسه يحمل `content_item_id` لعنصر آخر؛ لا يوجد دليل كافٍ هنا لتصنيفها إعادة استخدام مقصودة أو خطأ.
- لم يظهر تنفيذ مطابق للـworkflow المعتمد في n8n خلال نافذة 2026-09-12 18:20–19:10 UTC؛ لذلك لا يوجد execution ID يمكن ربطه بهذا النشر.
- وجود `external_post_id` وإيصال `published` دليل مسجل على نتيجة المزود، لكنه لا يثبت أن المنشور ما زال ظاهرًا للجمهور الآن.
- حالة Production الحالية لم تُفحص ضمن هذه الخطوة؛ لا يُستنتج نشر الإنتاج من commit `main` أو معاينة PR.

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

1. Owner Decision Consolidation — ControlTowerV2 كبوابة القرار الوحيدة (مغلق برمجيًا؛ تحقق الواجهة المصادق عليه مؤجل).
2. Content Experience Simplification — فحص وتنظيم الموجود فقط (مغلق: التوليد يدوي ومؤكد).
3. Media Experience Simplification — Content → Media → Ready، مع الحفاظ على الموافقات (**جزئي**: توجد عناصر وضوابط قائمة؛ الربط المعكوس للوسيط في العنصر المختار يحتاج تفسيرًا قبل إغلاق المرحلة).
4. Connections / Truthful Status — **تصحيح وصف الحالة الداخلية دُمج في PR #195**؛ تحقق قدرة المزود الخارجية ما زال منفصلًا وغير مُثبت.
5. Operational Flow Verification — **Atomic Step 4 جارٍ/جزئي**: مطابقة قراءة فقط لعنصر حقيقي واحد؛ لا تُغلق المراحل السابقة عالميًا اعتمادًا على عينة واحدة.
6. Controlled Publishing — **Atomic Step 5 المخطط بعد إغلاق Step 4**؛ اختبار محدود لعنصر محدد وبموافقة يدوية صريحة مستقلة فقط.
7. Measurement — GA4 / UTM / Attribution / Conversion Tracking بعد ثبات التشغيل.
8. Growth Systems — SEO / Local SEO / Chatbot / n8n alerts ثم الإعلانات لاحقًا.

لا يجوز تغيير هذا الترتيب أو تجاوز مرحلة قبل إغلاق التي تسبقها. Release Readiness Review لتطبيق Command Center Hub بند تقني مؤجل (القسم 5) ولا يُدرَج بين هذه المراحل.

## 7. CURRENT_PHASE

**Atomic Step 4 — Read-only Operational Flow Evidence Trace، عنصر حقيقي واحد.**

حالة الخطوة: **تمت المطابقة الداخلية جزئيًا، مع فجوات موثقة بالقسم 9؛ لا نشر ولا تعديل بيانات.** تدقيق الأزرار السابق كان محدودًا بالاختبارات المركزة، وحالة Connections عُدلت برمجيًا في PR #195؛ لا ندعي فحصًا بصريًا أو تحققًا شاملًا من مزودي الخدمة.

## 8. CURRENT_BLOCKER

**لا يوجد فحص Production حديث ضمن Atomic Step 4.** العبارة التاريخية عن Production READY والـcommit `6a5e2f8` قديمة ولا تصلح كحالة حالية. المرجع الحالي للشفرة هو `main` عند `b0dfb87806d9b80a05f958e3619e589690f1991c`؛ حالة النشر الفعلية غير مستنتجة منه.

## 9. آخر نتيجة مؤكدة

**Facebook Controlled Publishing Test — مغلق بتحفظ (2026-09-11):**
- عنصر Facebook المعتمد: `content_item_id: 9cf29b08-aaa3-4278-80bc-08a4cf3bc381`
- **Post ID:** `1164107840123575_122116295205382830`
- **Receipt status:** `published` (Supabase)
- **Published at:** `2026-08-05T21:57:29.690357+00`
- **تحقق عام:** الرابط العام على Facebook أظهر «المحتوى غير متاح» بدون تسجيل دخول — **تحقق يدوي مطلوب** على الصفحة. **لا إعادة نشر تلقائي** (قاعدة الغموض).

**Hub:** لوحة اليوم + Inbox + Content Studio يعملون بعد إصلاح حالة `cancelled` (PR #80).

**Media Library + Canva (2026-09-12):**
- معاينة الصور/الفيديو عبر signed URLs (PR #84، مدمج في `main`).
- Canva Brand Template `EAHVAAahmjU` — Generate **PASS**؛ `media_asset_id`: `20e13023-11c0-4040-832d-f72bcd77a4a8`.
- دفعة محتوى `batch_id`: `17ce0f07-219a-45a9-a52d-1a2c8b5af447` (10 عناصر؛ 6 Instagram).

**Instagram prep (2026-09-12):**
- **تحديث قراءة فقط (2026-10-06):** العنصر `ffb9f795-c359-43c5-861c-5594eda75eef` حالته `published` منذ `2026-09-12 18:51:41 UTC`؛ تطابق `provider_external_id` مع `external_post_id=17885945559478615` في إيصال Instagram `published`.
- المهمة `71504a73-28ea-4532-858e-ded0bdc76c08` نوعها `publish_content`، حالتها `completed`، ومحاولاتها 1؛ تفويض المالك `single_publish` مرتبط بالمهمة ومستهلك وغير ملغى.
- سجل التدقيق يذكر محاولة أسبق فشلت ثم وُثّق أنها **لم تُرسل**، وبعدها تفويض مالك ثانٍ للمهمة الناجحة؛ لم تُنفذ أي إعادة محاولة ضمن Atomic Step 4.
- العنصر يشير إلى وسيط Canva `20e13023-11c0-4040-832d-f72bcd77a4a8` وحالته `approved` وموافقته `consent_confirmed`؛ لكن حالة قابلية النشر المسجلة `ready_for_review`، كما أن `media_assets.content_item_id` يشير إلى عنصر آخر (`c72db3ff-30c1-4382-944c-ea9157c77756`). قد تكون إعادة استخدام مقصودة، لكنها غير مثبتة من هذا الدليل.
- البحث في workflow n8n المعتمد `xNwYPSXQiUyzDSyZ` عن تنفيذات بين 2026-09-12 18:20 و19:10 UTC أعاد صفر نتائج. لذلك لا نثبت أن n8n نفّذ نشر هذا العنصر.
- وجود الإيصال ومعرّف Instagram يثبتان النتيجة المسجلة في قاعدة البيانات؛ **الظهور العام الحالي لم يُتحقق منه**. لم تُجرَ إعادة محاولة أو إعادة نشر.

**مصالحة التوثيق:** `PROJECT_HANDOFF.md` ما زال يحمل NEXT_REQUIRED_ACTION تاريخيًا من مراجعة التوثيق السابقة؛ لا يُستخدم كمرجع للحالة الحالية أو لمرحلة المحتوى. هذا الملف يثبت التسلسل الإداري أعلاه، والحالة التقنية تُحدَّث عند إغلاق العمل الحالي.

**آخر تحديث تقني (2026-10-06):** PR #195 مدمج بموافقة المالك وكل فحوص GitHub ناجحة؛ `main` = `b0dfb87806d9b80a05f958e3619e589690f1991c`.

## 10. الخطوة الحالية (NEXT)

1. Atomic Step 4 هو تتبع سجل عنصر Instagram المذكور في القسم 9 فقط، قراءةً من المشروع النشط؛ لا بيانات محتوى أو أسرار أو روابط Storage خاصة.
2. الدليل الداخلي متطابق في المحتوى، وتفويض المالك، ومهمة الخلفية، والإيصال، ومعرّف المنشور؛ الوسيط approved/consent-confirmed، لكن ملكيته العكسية وحالة `ready_for_review` تحتاجان تفسيرًا.
3. لا يوجد تنفيذ n8n مطابق في النافذة المختبرة، ولا تحقق من الظهور العام؛ تُسجل هذه الحالات **غير متحققة** بدل سدها بالافتراض.
4. لا تشغيل Workflow، لا إعادة محاولة، لا نشر أو تعديل بيانات أو Migration أو OAuth؛ توقف عند هذا الحد.
5. بعد إغلاق فجوات Step 4، Atomic Step 5 في ترتيب الخطة هو **Controlled Publishing**، وليس تفويضًا تلقائيًا للنشر: يلزم عنصر محدد وموافقة يدوية صريحة منفصلة. لا يُكرر نشر سابق ولا يُستخدم `test-content-0001`.

**آخر نقطة آمنة مؤكدة:** `main` = `b0dfb87806d9b80a05f958e3619e589690f1991c` بعد PR #195؛ Production الحالي **غير متحقق منه**.

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


## 14. Owner-directed technical task — BLK-01 (2026-10-01)

- Branch: `blk-01-coachbrain-cost-transparency`, based on latest main `a56d54c`.
- **Draft PR #171:** https://github.com/aymanmahrous/command-center-hub/pull/171. It is for review only; no merge or production deployment is authorized by this record. This technical task does not change the content-stage `CURRENT_PHASE` above.
- Coach Brain now forwards Gemini usage metadata and displays bilingual token counts plus a dated, paid-tier token-cost estimate. Missing usage is shown as unavailable; Google Search grounding costs and remaining quota are not guessed. Provider error detail is no longer returned.
- Validation on latest main: 15 focused tests passed; application TypeScript, strict pricing-helper TypeScript, Edge Function syntax transpile, and `git diff --check` passed. The Vite build compiles but the existing performance gate fails on both base and branch: limit 371,000 raw / 108,700 gzip; clean `origin/main` 400,062 / 117,338; PR branch 400,062 / 117,344. Raw size is unchanged; gzip differs by 6 bytes. No Gemini or Canva provider API call, DB/schema/auth/secret change, or publication occurred. PR pushes triggered Vercel Preview deployments; see section 15. No Production deployment was observed.

### Canva safe-verification boundary

- The read-only function/version listing and no-credential `OPTIONS` reachability check were completed; see section 15. They prove only function metadata and route/CORS reachability, not OAuth health.
- Do **not** use `POST mode: "status"` as a health check: current source calls `refreshCanvaAccessToken` and upserts refreshed credentials in `staff_canva_tokens`. Do **not** use `POST mode: "generate"`: it creates/exports a Canva design and stores media.
- Current repository source still contains `staffId = staffId` in the user-auth path. Deployed source parity was not checked, so do not assume the same code is live. Any fix or authenticated runtime test is a separate atomic step.

**NEXT ATOMIC STEP:** Owner review of open Draft PR #171. Do not merge or make a Production deployment without a separate decision. Bundle-budget optimization is a separate step; no code change is authorized by this record.


## 15. Follow-up verification — PR, Vercel, and Canva (2026-10-01)

- PR #171 remains **OPEN / DRAFT / unmerged**. All six GitHub checks passed. The PR includes the Coach Brain usage tests and records the 15 passing focused tests, TypeScript checks, Edge Function syntax check, diff check, and the current-base build-budget comparison.
- GitHub branch pushes triggered Vercel deployments. The two inspected deployments were **READY Preview deployments** for this PR branch (branch-specific `vercel.app` hosts, `target: null`); neither was a Production deployment. Future pushes to this branch may trigger more Preview deployments automatically. No production deployment or production-domain change was observed.
- Supabase lists `canva-design` as **ACTIVE, version 20**. A request with no Authorization/API-key headers to its deployed endpoint using `OPTIONS` returned **HTTP 204**, with an empty body and `POST, OPTIONS` in `Access-Control-Allow-Methods`. This proves only that the endpoint's OPTIONS/CORS handler is reachable; it does not verify Canva OAuth or credentials. No `POST status` or `POST generate` was sent.
- This follow-up supersedes the earlier expectation that the Canva metadata/route check was still pending. The PR remains for owner review; no merge or production deployment is authorized by this record.

**Safe future work, only as a separate atomic step:** Analyze the existing initial-JavaScript size gate and chunk/import graph against the clean main baseline, then propose the smallest reversible optimization. Do not change code, alter the budget, or deploy until that step is authorized and has a measurable acceptance criterion.
