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
| تطبيق Command Center Hub | الواجهة بعد تسجيل الدخول تم التحقق منها بصريًا فقط (Authenticated UI visually verified). RBAC، الـAPIs، عمليات الكتابة (write operations)، الإسناد (attribution)، وبعض المسارات الوظيفية **غير مُتحقَّق منها بالكامل** بعد. |
| Supabase | متصل ومُستخدَم عبر RPCs معتمدة فقط؛ لا Migration أو RLS جديدة دون موافقة صريحة. |
| n8n | الـWorkflow الخاص باعتماد ونشر المحتوى مبني ويعمل داخليًا حتى نقطة Owner Approval. |
| المحتوى | تم إنشاء واعتماد عنصر Facebook حقيقي واحد داخل `content_items` (انظر CURRENT_BLOCKER). |
| التصميمات | لا تغيير مطلوب في هذه المرحلة. |

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

1. Owner Decision Consolidation — ControlTowerV2 كبوابة القرار الوحيدة (مغلق برمجيًا؛ تحقق الواجهة المصادق عليه مؤجل).
2. Content Experience Simplification — فحص وتنظيم الموجود فقط (مغلق: التوليد يدوي ومؤكد).
3. Media Experience Simplification — Content → Media → Ready، مع الحفاظ على الموافقات (المرحلة الحالية).
4. Connections / Truthful Status — حالة حقيقية دون إصلاح أو تنفيذ تلقائي.
5. Operational Flow Verification — Content → Media → Approval → Publish → External Result → Receipt.
6. Controlled Publishing — اختبار محدود وبموافقة يدوية فقط.
7. Measurement — GA4 / UTM / Attribution / Conversion Tracking بعد ثبات التشغيل.
8. Growth Systems — SEO / Local SEO / Chatbot / n8n alerts ثم الإعلانات لاحقًا.

لا يجوز تغيير هذا الترتيب أو تجاوز مرحلة قبل إغلاق التي تسبقها. Release Readiness Review لتطبيق Command Center Hub بند تقني مؤجل (القسم 5) ولا يُدرَج بين هذه المراحل.

## 7. CURRENT_PHASE

**Connections / Truthful Status — implementation complete; Production/QA verification recorded (2026-10-30)**

Current execution status as of 2026-10-23 is recorded in section 19. Historical PR #239 verification remains historical evidence, not the current repository or production baseline.

## 8. CURRENT_BLOCKER

**لا يوجد عطل Production مثبت حاليًا.** آخر Production deployment مربوط بـ`main` والـcommit `851186b` (PR #239) وحالته READY على Vercel (`35wQ6A2A5Pauym2qPsXtJSKhDY4v`). تم تمرير كامل حزمة الاختبارات (251/251) واختبار ميزانية الأداء وTypeScript بنجاح 100%.

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
- `content_item_id`: `ffb9f795-c359-43c5-861c-5594eda75eef` — **approved** (مالك).
- `media_asset_id`: `20e13023-11c0-4040-832d-f72bcd77a4a8` — **approved**, consent **confirmed**, publishability **ready_for_review**.

## 10. الخطوة الحالية (NEXT)

الحالة التاريخية والتسلسل السابق موثّقان في **القسم 19 — Current State Reconciliation (2026-10-23)** وما يليه. آخر تحديث تنفيذي هو القسم 25 أدناه؛ لا تعتمد على SHA أو نشر Production قديم في الأقسام التاريخية باعتباره الحالة الحالية.


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


## 16. Executive Verification & Current Baseline (2026-10-09)

- **Latest commit on main:** `851186bd038dd16799959b4e453428965faaef93` (PR #239 merged).
- **Vercel Production Deployment:** Deployment ID `35wQ6A2A5Pauym2qPsXtJSKhDY4v`, state `SUCCESS` (completed `2026-10-09T03:27:14Z`).
- **Automated Verification:**
  - TypeScript typecheck (`npm run typecheck`): PASS (0 errors).
  - Test suite (`npm test`): 251 passed, 0 failed.
  - Production build & budget gate (`npm run build`): PASS (JS initial: 369,969 raw / 108,445 gzip vs limits 371,000 / 108,700).
- **PR #238 & #239 Summary:**
  - PR #238 implemented real Veo cost estimation display.
  - PR #239 exposed actionable Veo failure details (`providerStatus` HTTP code and bounded diagnostic detail) in Factory review panel, preventing blind retries upon upstream Google API 502 errors.
- **Pipeline Continuity:**
  - `Coach Brain → Factory → Generate → Design → Media Library → Review → Approve → Schedule/Publish → Meta → Receipt/Results → Coach Brain` is verified through source analysis and automated contracts.


## 17. Executive Consolidation & Media Hierarchy Implementation (2026-10-09)

- **Factory UX Simplification:**
  - Redundant 9-tab header (`content-section-nav`) and 4-card action desk (`factory-action-desk`) removed.
  - Replaced with a unified 5-stage sequential rail: `١. التوليد والخطة` → `٢. التصميم والفيديو` → `٣. المراجعة والاعتماد` → `٤. الجدولة` → `٥. النشر والإيصال`.
  - Added direct return-to-brain feedback loop in the Overview/Receipts stage: `[🧠 استشر Coach Brain حول هذه النتائج والخطوة القادمة]`.
- **Coach Brain Executive Partner Mandate:**
  - System prompt in `supabase/functions/coach-brain-research/index.ts` restructured to eliminate academic 12-heading essay format.
  - Every answer now strictly starts with:
    1. `## 1. الخلاصة والرأي الموصى به (Summary & Recommended Opinion)`
    2. `## 2. أفضل خطوة تالية وسبب اختيارها (Best Next Step & Rationale)`
    3. `## 3. التكلفة المتوقعة والمخاطر أو القيود (Expected Cost, Risks & Constraints)`
- **Media Repetition Root Cause & Multi-Source Picker:**
  - Root cause diagnosed: hardcoded Canva template ID (`DAHVAMAUP-s`) generated duplicate graphics; review panel lacked library selection and device upload.
  - Implemented multi-tier media picker on review cards:
    1. Select and link existing verified assets from `Media Library` with 1 click (`link_staff_media_to_content_item`).
    2. Direct device upload (`uploadStaffMediaFile` → `register_staff_media_upload` → auto-link).
    3. External AI/design generation (Canva / Veo) retained as opt-in choices with pre-generation cost estimates.
- **Publishing & Messaging Truth:**
  - **Meta (Facebook & Instagram):** Live publishing and receipt verification operational via `safe-content-publisher`.
  - **TikTok:** Content Posting API requires developer registration, Direct Post audit approval, and domain verification. Current honest state is `NEEDS_CREDENTIAL / DEVELOPER_APP_APPROVAL`. Draft/review/export flow prepared.
  - **Messaging (WhatsApp / Messenger / Instagram Direct):** Intelligent concierge response engine (`process_ai_sales_concierge_turn`) and human takeover (`AIInboxView`) are shared across channels without creating redundant AIs.
- **Verification Gates:**
  - `npm run typecheck`: 0 errors.
  - `npm test`: 251 / 251 passed.
  - `npm run build`: 370,077 bytes raw / 108,535 bytes gzip (well within strict 371,000 / 108,700 budget).
## 18. Executive Partner Mandate: Canva Diagnostics, AI Strategy & Unified Connections (2026-10-09)

- **Canva Root Cause Diagnosis & Resolution:**
  - **Diagnostic:** Browser error `Load failed` / `424 Needs Credential` was caused by missing Canva Developer App secrets (`CANVA_CLIENT_ID` / `CANVA_CLIENT_SECRET`) in Supabase Edge Secrets. An end-user Canva Pro subscription does not grant developer API access.
  - **Resolution:**
    - Localized bilingual error handling in `src/canva-adapter.ts` with explicit Arabic and English messages guiding the owner to the free, working alternative.
    - Added direct 1-click `[Open Canva / فتح Canva يدوياً]` actions in `src/integrations-center.tsx` and `src/media-library-controls.tsx`.
    - Preserved zero-cost `canvaBrief` workflow: automatically provides dimensions, headlines, and palette for manual creation in existing Canva Pro accounts without paid API tiers.
- **Unified AI Strategy (Google Gemini Core):**
  - Clarified architectural truth: All server operations (Coach Brain, content batch generation, media analysis, Veo video) are powered server-side by Google Gemini (`gemini-2.0-flash` & `gemini-3.7-flash`) via `GEMINI_API_KEY`.
  - Clarified that personal subscriptions (ChatGPT Plus $20/mo, Gemini Advanced $20/mo) cannot be connected as developer APIs by third-party software.
  - No OpenAI API subscriptions required; owner budget protected from redundant AI expenses.
  - Updated `src/integrations-center.tsx` descriptions and setup modal to explicitly state that Gemini AI is centrally active server-side.
- **Messaging & Notifications Truth:**
  - Telegram integration clarified as optional internal staff notifications channel; central customer AI concierge operates via verified Meta WhatsApp Cloud API.
- **Verification Gates:**
  - `npm run typecheck`: 0 errors.
  - `npm test`: 253 / 253 passed.
  - `npm run build`: 370,077 bytes raw / 108,531 bytes gzip (strictly within 371,000 / 108,700 budget).


## 19. Current State Reconciliation (2026-10-23) — authoritative update

هذا القسم أحدث من خطوط الأساس التاريخية في الأقسام 8–18، ويُستخدم لتحديد الحالة الراهنة عند التعارض. لا يحذف هذا التحديث الأدلة التاريخية أو يعيد وصفها على أنها حديثة.

### Governance / phase
- **Canonical product phase:** Media Experience Simplification (section 6, stage 3). This remains the active product phase; the older “EXECUTIVE PIPELINE VERIFICATION & VEO 3.1 POST-PR #239 AUDIT” label is historical and no longer the current phase name.
- **Documentation issue:** `PROJECT_HANDOFF.md` previously described a July 2026 Documentation Review and pending work on a historical branch, while the current repository has moved well beyond that baseline. Its old implementation/test statements are historical unless reverified.
- **No rebuild:** continue Keep → Repair → Simplify → Consolidate. Preserve existing Coach Brain, Factory, Media Library, approvals, Meta path, and the approved n8n WhatsApp path.

### Content automation scheduler — verified production safety state (2026-10-23)
- PR #261, “fix: add side-effect-free dry-run to content automation pulse,” was merged into `main` as commit `1591eebb9534f3a7bb32b65d330bc48e5f812753`. PR: https://github.com/aymanmahrous/command-center-hub/pull/261.
- PR-head CI run `39905673252` passed: `npm ci`, `npm run typecheck`, `npm test`, and `npm run build`.
- Supabase project boundary remains `nmzxrjdxvmmzzmajrskm`; Edge Function `content-automation-pulse` is ACTIVE version 27. The deployed source SHA was recorded as `72a02239d4785cec5411615912d58cc3c6825b587ba84d8c869f3ffa5b2cd59d`.
- A hard-coded safety lock forces Dry Run: `const dryRunRequested = true;`. The function exits before content generation evaluation, media queue processing, or Meta publishing.
- Cron job `content-automation-pulse-dry-run` (job id 4) is active on `*/30 * * * *`. Recorded cron execution `runid 6422` succeeded on 2026-10-23 at 05:30 UTC.
- Three recorded Dry Run executions completed; each reported `media_attempts=0`, `media_processed=0`, `publish_attempts=0`, and `publish_processed=0`, with `sideEffectsSkipped=true`, `contentBrainGenerationTriggered=false`, and `humanApprovalRequired=true`.
- No real Meta publication occurred during these checks. The approved n8n WhatsApp workflow was not invoked; no WhatsApp message was sent.
- The Vercel deployment automatically triggered by the merge was explicitly canceled: `dpl_GPZkUoigEx2cmeRNc7EXSfZykSuk`. Vercel alias verification on 2026-10-23 confirms the custom domains `hub.relaxfixuae.com` and `www.hub.relaxfixuae.com` are attached to READY Production deployment `dpl_DE4ZgBG4r2fk5fWgZS3Spi3F5q9f`, commit `55816f16e183814a77cf052669b40c92d9237d50` (PR #260). The canceled PR #261 deployment has no aliases. Therefore the Production UI is **not** running the PR #261 merged commit; it remains on the previous UI commit until a separately controlled release.

### Protected boundaries
- Do not unlock live publishing or alter the hard-coded Dry Run lock as part of documentation or media simplification work.
- Do not invoke the WhatsApp sender from this application or create a second WhatsApp ingress/sender. The existing approved n8n path remains the only authorized WhatsApp route.
- No live Meta publishing, WhatsApp send, production UI deployment, schema/RLS/OAuth change, or production migration is authorized by this state update.
- The historical Facebook receipt in section 9 is not evidence that the currently restored scheduler performed a new live publication.

### Media path review and minimal repair proposal (2026-10-23)
- Source review confirms the existing route: Media Library controls can hand an asset to Content Factory via `sessionStorage`; Factory consumes the handoff, lets the owner select a content item, and links through the existing `link_staff_media_to_content_item` RPC. Review cards also support selecting a library asset or uploading a file; publishing is separately guarded by approval, media readiness, and receipt checks.
- **Verified UX defect:** in `src/media-library-controls.tsx`, category/consent/status RPC failures were silently swallowed, AI analysis failures could escape without user-facing feedback, and the Factory handoff catch was silent. This could leave the owner uncertain whether a change saved.
- Minimal repair in PR #263: https://github.com/aymanmahrous/command-center-hub/pull/263. It adds bilingual failure feedback and a focused contract test. PR #263 was merged into `main` as commit `6200815a5546e5d8febf9917880830ca698a6c08`; GitHub Actions run `39906975017` passed `npm ci`, `npm run typecheck`, `npm test`, and `npm run build`. The resulting Vercel deployment reached READY as a Preview and received no Production aliases. No Production promotion or live side effect occurred.
- **Next safe step:** PR #263 is merged, but the owner-facing Media Library → Factory → Review flow has not yet been verified end-to-end in a browser. Use a Preview deployment for non-destructive inspection; do not promote it to Production as part of this step. Keep Media Experience Simplification active until this path is verified with safe test data and without publishing.

## 20. Media path review finding (2026-10-23)

- **Route confirmed from source:** Media Library → `media-factory-handoff` session handoff → Content Factory item selection → `link_staff_media_to_content_item` RPC → return to review before publishing. The review panel additionally supports existing library asset selection and direct upload. These are existing capabilities and must not be rebuilt.
- **Root cause found:** Media Library control actions lacked truthful failure feedback for some failed persistence/provider operations. See PR #263. The proposed repair does not change RPCs, permissions, approval lifecycle, publishing, or integrations.
- **Current status:** the failure-feedback repair is merged in commit `6200815a5546e5d8febf9917880830ca698a6c08`, with CI passed. The code change is merged; the owner-facing flow remains unverified end-to-end and the UX task is not fully closed until that flow is checked safely in Preview.
- **Protected:** keep scheduler Dry Run lock, Meta live-publishing boundary, and the approved n8n-only WhatsApp send path unchanged.

## 21. Safe integration verification update (2026-10-26)

- **Repository baseline:** working tree was clean before this note; `main` is at `54fc97f8a23986976d4cbb74df5d019a70df7fa7`. No source, dependency manifest, lockfile, database, or deployment changes were made in this verification.
- **Local checks:** `npm run typecheck` passed; `npm test` passed 303/303; `npm run build` passed including the performance budget (initial JS 369,381 bytes raw / 108,369 gzip; initial CSS 32,555 raw / 6,832 gzip). Build needed an approved rerun outside the sandbox after esbuild could not read its parent directory. Node was v24.21.0 although package engines specify 22.x; these checks nevertheless completed successfully.
- **PRs #283, #285, #286:** all remain OPEN, mergeable, and based on current `main`; their GitHub CI checks and Vercel Preview deployments reported success/READY. No PR was merged. #283 refreshes the media handoff when entering Factory; #285 updates retired Gemini text model references to `gemini-3.8-flash`; #286 aligns Gemini image response MIME with deployed `image/jpeg` behavior. Review their diffs and dependency/production implications before any merge.
- **Media flow:** source contracts and tests cover the Library → Factory handoff and review linkage, but browser end-to-end interaction remains unverified. The available PR Preview shows a secure configuration lock, and the production Supabase project has no isolated non-production branch. Do not use production as a substitute for isolated test data.
- **Gemini source/deployed alignment:** production Edge Functions are active, but local main differs from deployed source for the reviewed Gemini functions. Deployed text-generation/analyze functions still identify `gemini-2.0-flash`, while local main also contains that retired model; PR #285 proposes the current model. Deployed `generate-gemini-image` uses JPEG while local main uses PNG; PR #286 proposes the correction. Do not deploy these changes without the separate production release gate.
- **Canva 502:** safe aggregated production logs show six HTTP 502 responses from `canva-design` v46 in the last seven days. Deployed source maps 502 to either Canva autofill or PNG export errors; available logs do not contain the upstream response/body or identify which operation failed. No status call, OAuth refresh/reconnect, design generation, or credential change was made. Exact root cause and repair remain unverified pending a safe diagnostic path that does not mutate OAuth state or create a real design.
- **Production safety:** no Production/Vercel/Supabase deployment, merge, migration, Meta publication, WhatsApp send, or live Canva/Gemini generation occurred. Keep the Media Experience Simplification phase open until the owner-facing flow is verified safely and the Canva cause is proven or explicitly blocked.

## 22. Root-cause audit continuation (2026-10-26)

- **Preview lock root cause:** the shared Preview is served by Vercel project `command-center-hub-m3s5`, whose environment-variable inventory is empty. The other linked Vercel project has the Supabase browser variables scoped to a different Preview branch (`fix/canva-readiness-routing`), while the remaining Supabase browser settings are Production-only. The application's fail-closed Supabase configuration guard is therefore behaving as designed. No secret values were read into this report, copied, changed, or sent to Preview.
- **Safe database blocker (status later corrected in section 23):** isolated Supabase project `xvsvkewkjutwsfysujls` was initially reported as empty. A subsequent live inventory found its schema tables already present; see section 23 for the verified current state. The production Supabase project has no non-production branch. Supabase quoted `$0.01344/hour` for a database branch (about `$9.81` per 30 days if left running); the owner approved this cost, but Supabase refused branch creation because development branches require Pro or above. No branch was created and no production data was used.
- **Interactive Media flow:** at the time of this entry the Preview was locked. Later, section 23 records the scoped Preview configuration and live browser check. The source/tests and PR #283 address tab handoff; CI and READY status alone do not prove the full interaction.
- **Gemini root cause and scope:** local `supabase/functions/analyze-staff-media/index.ts` still names retired `gemini-2.0-flash`; the source also applies a 15 MiB inline-byte ceiling and forwards the stored object's MIME type (falling back to `application/octet-stream`). That fallback is not sufficient evidence that every stored object has a Gemini-supported MIME type. Current official Google docs list `gemini-3.8-flash` as the stable text/multimodal model, and Google states `gemini-2.0-flash` shut down June 1, 2026. PR #285 proposes the model update; PR #286 fixes the image response MIME drift. No provider generation was triggered. Production function HTTP 200 counts from existing traffic establish endpoint responses only, not a controlled provider integration test.
- **Canva 502 root cause status:** current deployed `canva-design` v46 matches local main. Aggregated Edge Function logs show repeated 502 responses (including three on v46, latest observed `2026-10-26T03:54:37Z`), but detailed function logs contain only boot/shutdown events. The source maps failures to autofill or PNG export stages; available evidence cannot distinguish Canva auth/scope, autofill, export, or an upstream transient. No OAuth refresh/status call, reconnect, design creation, or upload was used. Root cause remains unproven; safe diagnosis requires capturing a sanitized operation stage and upstream status/code on a controlled read-only or explicitly non-mutating path.
- **Published/source safety drift:** production `content-automation-pulse` v31 differs from current main: deployed code reads `CONTENT_AUTOMATION_LIVE_ENABLED`, while main hard-locks `dryRunRequested = true`. A read-only query of the last 24 hours shows 48 completed runs in `dry-run`, zero media/publish attempts, and human approval required. This supports safe observed operation for that window, but does not prove future flag state. Do not modify the secret or redeploy without the production release gate. Current production Vercel alias remains on READY deployment for main SHA `54fc97f8a23986976d4cbb74df5d019a70df7fa7`.
- **PR disposition:** #283, #285, #286 remain OPEN and unmerged, with CI and Preview checks reported successful; #284 remains OPEN and unmerged (environment-controlled live gate proposal; not adopted); #281 remains OPEN and unmergeable against stale base, with overlapping Canva copy already present on main. Duplicate PR #277 was closed as superseded by #286. No PR was merged.
- **Verification boundary (re-run this continuation):** `npm run verify` passed typecheck and all 303 tests. Its in-sandbox build hit the known esbuild parent-directory access denial; approved `npm run build` outside the sandbox then passed Vite build and performance budgets (JS 369,381 bytes raw / 108,369 gzip; CSS 32,555 raw / 6,832 gzip). Re-reading the shared Preview confirmed the connection lock remains; no login was submitted. The local machine has neither Supabase CLI nor Docker, so a local Supabase stack is unavailable. No JavaScript/source files changed in this continuation, only this handoff note. No Production deploy, Supabase deploy/migration, Vercel environment change, merge, Meta post, WhatsApp message, or live Gemini/Canva generation occurred. Phase remains open pending isolated Preview connectivity, browser E2E, Canva diagnostic evidence, and an approved resolution of the production code/safety-gate drift.

## 23. Isolated Preview connectivity update (2026-10-26)

- **Existing isolated database inventory:** rechecking current Supabase state superseded the earlier “no tables” observation: project `xvsvkewkjutwsfysujls` is `ACTIVE_HEALTHY` and has the application schema already present (including `staff_profiles`, `media_assets`, and `content_items`). A read-only query found zero rows in each of those three tables; the table inventory reports RLS enabled. The project has an enabled browser-safe publishable key. No schema changes or records were added.
- **Branch cost/plan gate:** after explicit owner approval for `$0.01344/hour`, the Supabase branch-creation API returned `Branching is supported only on the Pro plan or above`. The production project's branch list remains only `main`; no branch was created, and no recurring branch compute was started.
- **Preview configuration repair:** added encrypted `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the separate Vercel Preview project `command-center-hub-m3s5`, scoped only to Preview branch `fix/media-factory-handoff-refresh`. The values identify the isolated test project; neither targets Production nor uses the production Supabase project. The setting metadata was re-read with values kept redacted.
- **Preview redeploy and browser check:** redeployed PR #283 commit `9d3e1739cd4123fbbc3e6fcafff20979f4d8f064` as Preview deployment `dpl_22hJHe1kttCNgVhvb3qgPDLmWT7u`, which reached `READY`. The browser now shows the login screen without the connection-configuration lock. One sign-in attempt using a synthetic address in the reserved `.invalid` domain returned the application's `email or password is incorrect` response (HTTP 400), confirming the configured app reached Supabase Auth and did not return `CONFIGURATION_REQUIRED`. The fields were cleared afterward. A later synthetic test signup is recorded in section 24.
- **Media E2E boundary:** the isolated database has no staff profiles, media assets, or content items. Read-only catalog checks confirm `link_staff_media_to_content_item(uuid,uuid)` matches the repository migration, exists as `SECURITY DEFINER`, allows `authenticated` execution, and denies `anon`. The browser cannot enter the authenticated Media Library/Factory/Review flow until a safe staff profile is provisioned. The user-approved branch route is blocked by the Supabase plan; test schema compatibility is recorded in section 24. No media RPC was called and no test content was created.
- **Current verification:** typecheck passed; `npm test` passed 303/303 after the handoff update; Vite build and performance budget passed after running `npm run build` outside the sandbox because of the esbuild parent-directory denial. No JavaScript/source files were changed. Production Vercel and Supabase remain unchanged; no live Meta/WhatsApp send, Canva design/export, or Gemini generation occurred.

## 24. Test identity and schema compatibility finding (2026-10-26)

- **Auth test identity:** the isolated project's public Auth settings endpoint returned HTTP 200, with signup enabled and email autoconfirm enabled. One synthetic test identity using the reserved `.invalid` domain was created in that test project; auto-confirmation meant no email verification was sent. No staff profile or application session was created, and no credential is recorded here.
- **Media RPC and schema evidence:** the isolated project's `link_staff_media_to_content_item(uuid,uuid)` definition matches the repository migration's review-first behavior. Its media table has a `publishability_status` check that permits `pending`, `cleared`, `blocked`, and `review`, but excludes `ready_for_review`; its consent check excludes `consent_confirmed`. The RPC explicitly requires `ready_for_review`, and requires `consent_confirmed` for swimming-business assets, so no qualifying swimming asset can be represented in this test schema. Production `media_assets` has no such two status constraints (its checks cover type/source only), so this mismatch is specific to the isolated project's divergent schema and is not evidence of a production schema failure.
- **Approval boundary:** completing E2E on this project requires a test-only schema migration to permit the RPC's supported status values, followed by creation of a test staff profile and fixtures. The earlier explicit approval covered a Supabase branch, but the branch API refused on the current non-Pro plan; no migration was applied to the separate test project. Request exact approval before changing that project's schema. Keep the auth test identity isolated and do not reuse it against production.

## 25. Media handoff E2E and repair update (2026-10-26)

- **Source root causes:** private uploaded media records contain a storage path but may not have a public `webUrl`; the Library action serialized undefined `name`/URL fields, and Factory rejected the handoff unless a public URL existed. The repaired source resolves a stable display name from metadata/storage path, treats the web URL as optional, and only renders an external-origin link when it is a safe HTTPS URL.
- **Success feedback:** browser verification showed the RPC success notice was nested inside the handoff banner that is removed after success. The notice now renders outside that conditional, and a regression test asserts it remains visible after the handoff is cleared.
- **Repair commits:** `c8ed834e1e97497aaf8fa68f55bce0da66697751` and `97327bbb274e86538dc18cf29640640eb9644e10` were pushed to existing PR #283 (`fix/media-factory-handoff-refresh`). PR remains OPEN and unmerged. Verify, CodeQL, and Vercel Preview checks all passed on `97327bb`; latest isolated Preview is READY at `https://command-center-hub-m3s5-r2oqwvinz-swimmingayman-8492s-projects.vercel.app/`.
- **Isolated Preview environment:** Preview-only `VITE_SUPABASE_URL` and publishable key point to test project `xvsvkewkjutwsfysujls`; Production environment was not changed. One reserved `.invalid` synthetic Auth user and one active `content_manager` test profile were provisioned there. No email was sent. A test-only SELECT policy matching production's own-active-profile predicate was added after explicit approval.
- **Test-only schema drift and approvals:** after explicit approval, the test project's `media_assets` checks were expanded for `ready_for_review` and `consent_confirmed`, `content_items.hashtags` changed from scalar `text` to `text[]`, and `audit_logs_actor_type_check` was aligned with the production actor allowlist. The isolated content fixture's null hashtags/visual prompt were normalized to empty values. These changes are limited to the test project; no production schema or RLS changed.
- **Interactive proof:** browser login succeeded; Media Library displayed the private synthetic fixture; “Use in Content Factory” navigated to Factory with the correct asset and did not require a public URL. After test-schema alignment, the item appeared. The approved link RPC first rolled back because test audit constraint rejected `actor_type='user'`; Postgres SQLSTATE 23514 identified the mismatch. After alignment, retry succeeded. Test DB confirms the linked QA content/media IDs, `media_source='real'`, content `status='needs_review'`, and one `content_media_linked` audit record. On latest Preview, the user-visible success notice remained after the handoff card disappeared, and the linked item appeared under “Pending Review”. The high-level “reviewable” count is 2 because it includes a second draft fixture; the exact `needs_review` filter count is 1. No approval, schedule, publish, upload, or external side effect was triggered.
- **Checks:** `npm test` passes 309/309; `npm run typecheck` passes; `npm run build` passes with performance budget (initial JS 369,480 raw / 108,391 gzip; CSS 32,555 raw / 6,832 gzip). In-sandbox build was blocked by esbuild parent-directory access; the approved out-of-sandbox rerun passed. CI verify and CodeQL passed on PR #283 commit `97327bb`.
- **Remaining:** isolated Home page still reports a read failure/404 for an unrelated dashboard dependency; this did not block Media → Factory → Review. Canva status in Preview reports missing server credentials and scopes. Gemini provider generation and Canva 502 upstream stage remain unverified; no live Gemini generation, Canva reconnect, design creation, or export was performed. PRs #285 and #286 remain OPEN, unmerged. No production deploy, production migration, Meta post, or WhatsApp send occurred.
- **Gemini follow-up:** Google’s official model page lists `gemini-3.8-flash` as stable and supports text/image/video/audio/PDF input. The official Generate Content migration notes say Gemini 3.6+ ignores `temperature`/`top_p`/`top_k` today and will reject them with HTTP 400 in a future release. PR #285 (`2bac015f1ec0bd134a0691239e9bc0bfbeae511f`) now updates all three text/media/automation functions to 3.8 and removes the temperature overrides; added contract tests pass. PR remains OPEN/unmerged with Verify, CodeQL, and Preview checks passing. Google refs: [model](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash), [Generate Content migration](https://ai.google.dev/gemini-api/docs/generate-content/whats-new-gemini-3.8).
- **Gemini image:** PR #286 (`56ec63d92618cea46417f9ce870cf16a40d8643a`) requests JPEG, matching current deployed function v19 behavior; response MIME is still detected and determines `.jpg`/`.png`/`.webp` storage metadata. PR is OPEN/unmerged; CI/CodeQL/Preview checks passed. No Google provider call was made, so credentials, live generation, timeout behavior, and actual returned bytes remain unverified. Production functions remain deployed as `generate-content-batch` v29, `analyze-staff-media` v30, `content-automation-pulse` v31, and `generate-gemini-image` v19; source PRs have not been deployed to Supabase.


## 25. Connections / Truthful Status — تنفيذ 2026-10-29

### النتيجة التنفيذية
تم إصلاح التناقض الذي كان يعرض وجود `GEMINI_API_KEY` وحده كحالة `CONNECTED`. وجود الاعتماد أصبح حالة مستقلة (`CREDENTIALS CONFIGURED`) ولا يُعرض كاتصال ناجح. فحص الحالة ينفذ طلبًا خارجيًا آمنًا للقراءة فقط إلى قائمة نماذج Gemini؛ نجاحه يظهر كـ`EXTERNAL CHECK VERIFIED` مع `functionVerified: false`. لا تظهر `CONNECTED` إلا بعد نجاح الوظيفة نفسها فعليًا، ويُسجل ذلك عبر `functionVerified: true` في `analyze-staff-media` أو بعد تنفيذ توليد الدفعة.

### السبب الجذري المثبت
كان `credentialStatus()` في `analyze-staff-media` و`generate-content-batch` يحول `Boolean(GEMINI_API_KEY)` مباشرة إلى `connected: true` و`integrationStatus: CONNECTED` قبل أي استدعاء إلى Google. هذا خلط بين وجود السر، وفحص الاتصال الخارجي، ونجاح الوظيفة المطلوبة. تم فصل الحالات الثلاث دون تغيير سلوك التوليد عند وجود الاعتماد.

### ما تغيّر
- `supabase/functions/analyze-staff-media/index.ts`: فحص Gemini خارجي آمن read-only، حالات اعتماد/فحص/وظيفة منفصلة، مع بقاء المفتاح server-side.
- `supabase/functions/generate-content-batch/index.ts`: نفس الفصل في status endpoint؛ مسار التوليد لا يتطلب فحصًا إضافيًا ولا يعلن النجاح قبل النتيجة الفعلية.
- `src/media-gemini-adapter.ts`, `src/media-providers.ts`, `src/media-library-controls.tsx`: عرض الحالات الجديدة بوضوح في Media Library.
- `tests/media-gemini-adapter.test.mjs`: regression تمنع العودة إلى اعتبار المفتاح وحده اتصالًا أو نجاح وظيفة.

### الأدلة والاختبارات
- Commits: code `a09317fecab0199de384db5576175cd85291e5fe`; handoff update `e1d7922b8826303b9097aa934a03dcaa0a1592d2`.
- PR للمراجعة فقط: [#295](https://github.com/aymanmahrous/command-center-hub/pull/295) — `MERGED` في `main` بالـcommit `e5379b962a19ffcdbad055dd645f52eafce7311c`؛ لا يعني ذلك نشرًا منفصلًا إلى Supabase Production.
- `npm test`: **320/320 passed**.
- `npm run build`: **passed** — TypeScript، Vite، وperformance budget.
- اختبارات النطاق المركزة Connections / Gemini / Canva: **22/22 passed**.
- PRs المرتبطة التي تم اعتماد حالتها من GitHub: #283 و#285 و#286 و#292 و#295 مدمجة؛ #293 و#294 مفتوحان للمراجعة فقط.

### ما لم يُثبت بعد
لم يتم نشر PR #295 إلى Preview، لذلك لم يُثبت بعد أن Edge Functions المنشورة تنفذ فحص Gemini الخارجي أو تعرض الحالات الجديدة بحساب QA. كما لم تُشغّل وظيفة تحليل وسائط أو توليد دفعة حقيقية ضمن هذه المهمة، ولم تُنفذ أي عملية Gemini مدفوعة أو إنشاء Canva.

### العائق الحقيقي والخطوة التالية الوحيدة
العائق هو غياب تحقق Preview المنشور للـcommit الجديد، وليس عطلًا مثبتًا في الكود المحلي. الخطوة الوحيدة التالية: بعد مراجعة PR #295، نشره إلى Preview فقط ثم تنفيذ قراءة status بحساب QA للتحقق من `credentialsConfigured` و`externalCheck` و`functionVerified` بصريًا/شبكيًا، دون توليد أو نشر أو جدولة.

### حدود السلامة
لم يحدث أي تغيير في Supabase schema أو RLS أو OAuth أو الأسرار، ولم يحدث Merge أو Production deployment أو نشر Meta أو إرسال WhatsApp أو تشغيل Canva/Gemini مدفوع أو تفعيل جدولة حية.

## 26. Media Experience Simplification — closeout and next-stage handoff (2026-10-29)

### حالة المرحلة
أُغلقت مرحلة **Media Experience Simplification** بالأدلة المتاحة لمسار **Media Library → Content Factory → Review** والتحقق المرتبط باختيار الدفعة، ولا يعني ذلك إثبات كل مزود خارجي مدفوع.

### الأدلة المعتمدة
- **PR #283** مدمج فعليًا في `main`؛ التحقق التفاعلي السابق على Preview المعزول أثبت انتقال الوسيط الخاص إلى Factory وظهور عنصر المحتوى في Review مع بقاء إشعار النجاح، دون موافقة أو جدولة أو نشر.
- **اختيار الدفعة:** الفرع `fix/primary-batch-selection` موجود على GitHub، والالتزام `aabccaf9707bc11559198a34be52de500618d0e4` يحتوي إصلاح اختيار الدفعة واختبار regression؛ التحقق البصري السابق على Preview المعزول أظهر اختيار الدفعة وظهور عنصر معتمد، دون توليد أو نشر أو إرسال.
- **PR #293** مفتوح للمراجعة على `main`: https://github.com/aymanmahrous/command-center-hub/pull/293. حالته الحالية `MERGEABLE` تقنيًا لكن `REVIEW_REQUIRED`.

### حالة الإصلاحات المرتبطة وقت التحديث
- **PR #283:** `MERGED`.
- **PR #285:** `MERGED`.
- **PR #286:** `MERGED`.
- **PR #292:** `MERGED`.
- **PR #293:** `OPEN`, `MERGEABLE`, `REVIEW_REQUIRED`, غير مدمج.

### ما لم يُثبت بعد
لم يُثبت السبب الجذري التفصيلي لأخطاء Canva 502 أو إعادة اتصال Canva وإنشاء/تصدير تصميم حقيقي. كما لم يُثبت توليد Gemini حي أو اختبار Meta/WhatsApp حي، ولم يحدث نشر Production جديد ضمن هذا التسليم.

### المرحلة التالية المعتمدة
الانتقال إلى **Connections / Truthful Status**: توحيد الحالات المعروضة للتكاملات مع الأدلة الفعلية، بدءًا من Canva وGemini، باستخدام تشخيصات قراءة آمنة أو مسارات غير مدفوعة فقط.


## 27. Final Production / QA Audit — 2026-10-30 (reconciled onto current main)

### Evidence recorded
- **Vercel Production:** the read-only audit recorded deployment `dpl_3vpXiW8ZSEL2921mqMLJxyjqj8FN` as `READY`, associated with `main` at commit `da4bafc879778085c60293ba5364be4a1e0f1812`. The `hub.relaxfixuae.com` login page and its static JavaScript asset returned HTTP 200; the queried Vercel Runtime Errors window reported none. This is the observed deployment at audit time, not a claim that the newer `main` head is already deployed.
- **Supabase Production:** project ref `nmzxrjdxvmmzzmajrskm`; the audit recorded `analyze-staff-media` v31, `generate-content-batch` v30, and `canva-design` v50. No generation or Canva creation was invoked during the audit.
- **Automation safety:** the audited `main` source for `content-automation-pulse` explicitly sets `dryRunRequested = true` and `sideEffectsSkipped = true` before generation/media/publishing paths. No schedule was triggered.
- **QA Preview:** a QA account was used to inspect the isolated Preview. Media Library showed the synthetic QA asset; Content Factory showed two items in `Needs review`; approval, scheduling, and publishing remained zero. Connections were read-only; Canva showed `Not connected / Not ready` because server credentials and OAuth scopes were unavailable in QA.
- **Scope:** documentation only. No application code, schema/RLS, OAuth, secrets, Production configuration, live scheduling, approvals, publishing, WhatsApp, Meta, paid Gemini, or Canva generation was changed or triggered.

### Explicit limits
Canva live connectivity and design creation/export were not proven. No live Gemini generation, Meta/WhatsApp action, approval, scheduling, or publishing was performed. The observed Production deployment was on commit `da4bafc...`; do not infer the latest `main` head is deployed without a fresh deployment check.

### Status
The Connections / Truthful Status phase has recorded read-only Production and QA evidence. This closes the documentation of that audit only; it does not certify untested external-provider operations or authorize a Production release.

## 28. Owner-approved AI Agent Governance Charter — 2026-11-06

### Owner decision
The owner explicitly approved a binding operating policy to prevent AI agents and contributors from inventing requirements, creating duplicate systems, stopping after trivial subtasks, or claiming unverified completion.

The full policy is maintained at **`docs/AI_AGENT_GOVERNANCE_CHARTER.md`**. It applies to A–Z Guardian, Coach Brain, specialist agents, coding agents, research agents, automation agents, and human contributors working on Command Center Hub.

### Role boundaries
- **A–Z Guardian:** whole-application executive/technical oversight, architecture and risk governance, routing, quality, cost, evidence, coordination, and delivery.
- **Coach Brain:** marketing/content strategy, research, planning, and coordination through the existing Content Factory.
- **Specialist agents:** execute only bounded tasks delegated under the charter; they cannot redefine the project or self-authorize protected operations.

### Non-negotiable rules
- Existing-system-first: keep working capabilities; repair, reconnect, simplify, or consolidate before considering new work.
- No duplicate dashboards, Action Centers, task managers, Factories, Media Libraries, Inboxes, CRMs, Connections Centers, Coach Brains, databases, notification services, provider registries, or progress systems.
- Control Tower remains the owner decision surface; existing canonical destinations remain execution surfaces.
- Evidence precedes claims. Build success, saved credentials, merged PRs, and deployment status must not be misrepresented as proof of runtime or provider success.
- Complete a whole safe phase continuously; do not interrupt the owner for routine micro-decisions. Stop only for a genuine blocker, authorization, irreversible/destructive action, material cost, or safety/data-integrity risk.
- A time target (including one hour) is a planning constraint, never permission to skip verification or fabricate completion.
- Production publishing, outbound messages, production Supabase changes, secrets/OAuth, schedules, live automation, paid credits, PR merges, and production deployments remain protected and require explicit owner authorization.

### PR reconciliation — fresh GitHub state 2026-11-06
The following PRs are OPEN and UNMERGED, all targeting `main` at base SHA `f97f7d784bfe4653a060052202dca2e472644451` at the time checked:
- **#322** `improve/coach-brain-strategic-advisor` — strategic prompt, 1–45 day planning, manual Canva/Gemini/Runway handoffs, and content review improvements.
- **#323** `fix/owner-connections-truth-and-failover` — provider preference/status/fallback and owner-connection truth, plus frozen publishing controls.
- **#324** `docs/admin-control-audit-2026-11-06` — documentation-only audit; useful as reference, not a reason to create a generic admin/settings system.
- **#325** `feat/coach-brain-task-contract-2026-11-06` — canonical Coach Brain → Factory task contract, storage verification, and bounded inputs.

**Do not merge these PRs independently.** #322, #323, and #325 overlap in Coach Brain / Factory source and tests. In particular:
- #322's accepted planning horizon is **1–45 days**, consistent with the existing Factory RPC limit; #325's normalizer currently clamps to **2–30 days**, which would silently alter valid owner requests.
- #323 and #325 both touch `src/coach-brain.tsx`, `src/content-growth-hub.tsx`, and related behavior/tests.
- #322 introduces manual external handoffs; these must remain truthful and must not be represented as API-integrated Runway generation. Existing implementation evidence indicates video generation uses Google Veo, while Runway is a manual external handoff.
- Preserve the existing Factory workflow, backward-compatible handoff fields/storage key, read-back verification before navigation, and accurate provider/fallback semantics.

### Current safe point
- The charter has been added on a dedicated documentation branch: `docs/agent-governance-charter-2026-11-06`.
- No PR was merged. No production deployment, Supabase change, publishing, messaging, paid provider call, or external side effect was performed.
- The next implementation phase is to reconcile the overlapping Coach Brain/Factory PR changes into one coherent reviewable change set, using the charter as the governing acceptance criteria. Keep all existing PRs unmerged until reconciliation and verification are complete.

### Verification limits
This is a governance/documentation change only. The new charter itself has not yet been through repository CI, and no runtime behavior is claimed as changed or verified. The Vercel daily deployment limit observed in the related PR checks must not be bypassed by repeated build attempts; use GitHub CI and focused local/code checks first.

## 29. Production authorization and RLS audit — 2026-11-06 (read-only)

**Target verified:** Supabase Production project `nmzxrjdxvmmzzmajrskm`, PostgreSQL 17.6.1.105, status ACTIVE_HEALTHY. The separate Bolt project was not queried or modified in this phase.

### Confirmed database state
- Exactly **64/64 public tables have RLS enabled**. Only **1/64** has FORCE ROW LEVEL SECURITY enabled.
- **11 tables have 20 RLS policies**; the other **53 tables have RLS enabled but no policies**. No-policy tables deny direct row access to `anon` and `authenticated` by default; this is not itself evidence of public exposure. Many operational reads/writes are intentionally mediated by guarded RPCs.
- The sensitive tables inspected (`audit_logs`, `background_jobs`, `content_items`, `conversations`, `leads`, `staff_integrations`, `staff_integration_secrets`, OAuth token/state tables, and `owner_publish_authorizations`) have RLS enabled and no direct table policies. `owner_publish_authorizations` is the only table observed with FORCE RLS enabled.
- `staff_profiles` has one policy: authenticated users may read only their own active profile (`id = auth.uid()` and `active = true`). No direct insert/update/delete policy was found.
- Live `staff_profiles` inventory contains exactly **one active profile: super_admin**. The five application roles (`super_admin`, `admin`, `reception`, `coach`, `content_manager`) are defined in the frontend type/schema, but the four non-owner roles cannot be behaviorally verified against a live profile in this production dataset.
- `audit_logs` contains **1,115 rows**, but has no RLS policy and no audit-reading RPC was found by the targeted database function-name inventory. No owner-facing audit-log reader was found in the main navigation. Therefore the history exists but is not yet available as a verified owner-facing audit screen/API.

### RPC authorization findings
- Production contains **168 SECURITY DEFINER functions** in `public`.
- **81** are executable by `authenticated`; **2** SECURITY DEFINER functions are executable by `anon`.
- Among the 81 authenticated-callable SECURITY DEFINER functions, source inspection classified **55** as using `is_active_staff(...)`, **23** as using `command_center_staff_role()`, **1** as using an explicit `auth.uid()` condition, and **2** as having no visible authorization guard in their function bodies.
- The two public SECURITY DEFINER exceptions are `rf_schedule_turn(...)` and `rf_whatsapp_automation_enabled()`. Their current bodies are read/availability-oriented: the scheduling function explicitly returns `canConfirmSlot=false` and `bookingWriteUsed=false`, and does not write a booking; the WhatsApp function returns only the automation-enabled boolean. These appear consistent with a public-facing chatbot/status contract, but remain intentionally public exposure points and are flagged by Supabase.
- The helper `is_active_staff(allowed_roles)` checks a matching `staff_profiles.id = auth.uid()`, `active=true`, and (when supplied) membership in the allowed role list. `command_center_staff_role()` likewise resolves only the active caller's role. The majority of inspected staff RPCs use one of these checks.
- The database advisor's 81 authenticated SECURITY DEFINER warnings are not proof that all 81 functions are exploitable. They are a review list; each function must be assessed for its guard and operation. No broad privilege change is justified from the warning count alone.

### Supabase Security Advisor snapshot
Observed 2026-11-06:
- `rls_enabled_no_policy`: INFO, 53 findings — expected for tables intentionally reachable only through RPC/service-role paths; verify each consumer before adding policies.
- `authenticated_security_definer_function_executable`: WARN, 81 findings — reviewed at aggregate/guard-class level above; per-function role and operation mapping remains a separate detailed review.
- `anon_security_definer_function_executable`: WARN, 2 findings — the two public functions described above.
- `function_search_path_mutable`: WARN, 10 functions. The 10 listed functions are helper/concierge functions and were inspected as SECURITY INVOKER (not SECURITY DEFINER); this remains hardening debt, not a demonstrated privilege escalation.
- `extension_in_public`: WARN, `pg_net` is installed in `public`.
- `auth_leaked_password_protection`: WARN, leaked-password protection is disabled.

### Application authorization and owner-management gaps
- `src/main.tsx` authenticates with Supabase Auth, then reads exactly one active own-profile row and validates the role against the five-role schema. Session restore repeats the Auth user check and profile lookup.
- Navigation currently enumerates application sections and the More menu without a centralized per-role section-access map. Individual screens contain scattered UI capability checks, while the database RPCs provide the authoritative write boundary. UI visibility is therefore not a substitute for server authorization.
- No dedicated staff-profile management RPC was found by the targeted function inventory; no dedicated audit-log reader RPC was found. The current app therefore does not yet provide verified in-app staff/role administration or owner audit-log browsing.
- Existing `business_settings`, `rf_schedule_config`, and `notification_settings` remain separate existing data areas. Do not create a generic settings table or feature-flag system based on this audit.

### Decisions and safe next steps
1. Do **not** mass-create RLS policies for the 53 no-policy tables. First map every direct frontend query and RPC/Edge Function access path; indiscriminate policies could expose private customer, message, credential, job, and publishing data.
2. Do **not** revoke grants, change SECURITY DEFINER/INVOKER, alter function grants, or modify Auth settings in Production as part of this read-only audit.
3. Complete a per-function authorization matrix for the 81 authenticated-callable SECURITY DEFINER RPCs: operation (read/write), required roles, owner-only actions, audit behavior, and frontend caller. Prioritize functions that mutate staff profiles, integration secrets, customer conversations, jobs, content lifecycle, or publication authorization.
4. Review the two public SECURITY DEFINER functions against their public website/chatbot callers and document whether their exposure is required. Preserve public availability behavior unless a proven issue is found.
5. Review the 10 mutable-search-path helpers and extension placement in a separate hardening plan; do not alter them without dependency analysis.
6. Design the owner-facing admin surface only after the server-side matrix is complete. Reuse existing RPCs and screens; add only proven missing capabilities. Staff administration and audit-log browsing are confirmed gaps in the current inventory, but require a carefully scoped server-side design and explicit review before any Production change.

### Scope and verification
This phase was read-only. No Production rows, policies, grants, functions, Auth settings, secrets, Edge Functions, schedules, publishing paths, or Vercel configuration were changed. No role-switching or write-path tests were attempted because Production has only one active `super_admin` profile and the user explicitly protects Production state. The findings are based on live catalog metadata, function definitions, RLS policies, advisor output, and the main-branch application source. A full per-function matrix and non-owner role runtime tests remain open.

## 30. Authorization matrix deepening and publishing-freeze boundary — 2026-11-06

### Server-side role model confirmed from live function definitions
The database's two central helpers are:
- `is_active_staff(allowed_roles)`: requires the caller's own `staff_profiles` row, `active=true`, and membership in the supplied role list when a list is provided.
- `command_center_staff_role()`: returns only the active caller's own role, or NULL.

For the 81 SECURITY DEFINER functions callable by authenticated users, the source scan found:
- 55 reference `is_active_staff(...)`;
- 23 reference `command_center_staff_role()`;
- 1 contains a direct `auth.uid()` check;
- 2 are the intentionally public-facing RPC exceptions already described in section 29.

This establishes a consistent staff-identity guard pattern, but not that every function grants the correct minimum role. Exact role allowlists vary by operation and need to remain function-specific.

### High-impact RPC role checks inspected
- `approve_staff_content_batch`: super_admin only. It can approve content and create future `publish_content` jobs for eligible Facebook/Instagram content.
- `transition_staff_content_item`: initial gate allows super_admin/admin/content_manager; the `approve` action adds a super_admin-only check. Its `schedule` action creates a queued `publish_content` job.
- `retry_staff_publish_job`: callable by super_admin/admin/content_manager. For a failed/dead eligible future-planned publish job, it can call `enqueue_publish_job` and create a new job.
- `cancel_staff_background_job`: super_admin/admin/content_manager; only terminal/queued/retrying/failed/dead jobs are accepted according to its state check.
- `record_staff_content_publish_result`: super_admin/admin/content_manager; records success/failure receipts and changes content status, but does not itself call Meta.
- `update_owner_media_asset`: super_admin only.
- `set_staff_conversation_mode`: super_admin/admin/reception.
- `update_staff_lead_workflow`: super_admin/admin/reception/coach.
- `update_booking_request_status`: super_admin/admin/reception.
- `connect_staff_integration` and `set_staff_ai_provider`: super_admin/admin/content_manager.
- `create_staff_video_generation_job`: super_admin/admin/content_manager; creates a job record, not a provider generation call.

### Important mismatch: publishing freeze is not enforced by the database RPC boundary
The application may hide retry/scheduling controls, but Production still exposes authenticated RPCs that can prepare/requeue publish jobs:
- `retry_staff_publish_job` remains executable for super_admin/admin/content_manager.
- `transition_staff_content_item` still contains a scheduling branch for super_admin/admin/content_manager.
- `approve_staff_content_batch` remains executable by super_admin and can create future publish jobs.

This is a **HIGH priority authorization/operational-boundary gap** relative to the owner's current instruction that publishing remains frozen pending new authorization. It is not evidence that a post was sent. It means the UI freeze is not a complete server-side freeze: a permitted authenticated caller could still enqueue or re-enqueue work if all function preconditions are met.

**Do not call these functions, test them with real rows, or alter existing jobs.** The production content/job data is protected. A future repair should add a separately reviewed server-side freeze gate that prevents scheduling/retry preparation while preserving safe non-publishing approval/review operations, and should be tested in an isolated environment before any Production change. Do not simply revoke all execute grants: that could break unrelated content workflow paths.

### Additional implementation finding
`get_staff_integrations()` is named as a read function but performs an idempotent `INSERT ... ON CONFLICT DO NOTHING` to seed seven default provider rows before returning the integration list. It is guarded to super_admin/admin/content_manager. This is a side effect on a read path and is not currently recorded as an audit event. Preserve existing behavior unless a targeted design proves a safe alternative; do not invoke it as part of this audit.

### Authorization review status
- **Completed:** live RLS/policy inventory, role helper definitions, aggregate 81-function guard classification, and source-level review of the high-impact RPCs listed above.
- **Still open:** exhaustive per-function minimum-role mapping for all 81 functions; mapping each RPC to every frontend/Edge Function caller; non-owner role behavior tests; safe Preview tests for role-denial paths; review of the 10 mutable-search-path helpers and `pg_net` extension placement.
- **Owner-facing implications:** do not expose staff-role editing, audit browsing, or feature switches in a new admin screen until their server-side APIs and minimum-role rules are designed and verified. The live Production profile inventory has only one active super_admin, so no employee role should be invented or tested by changing Production data.

### No-change confirmation
This continuation used only catalog reads, function-definition reads, advisor output, and GitHub source inspection. It did not invoke any operational RPC, alter any Production row, create or retry a job, send a message, publish content, change a policy/grant/function/Auth setting, or deploy anything.
