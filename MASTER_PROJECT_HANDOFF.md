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


## 28. Owner Administration Capability Audit — 2026-11-06

### Scope and safety
- Owner-authorized administrative audit of existing application settings, staff roles, module navigation, backend authorization, audit history, Supabase configuration tables, and Production deployment state.
- Repository baseline inspected: `main` at `f97f7d784bfe4653a060052202dca2e472644451`.
- Production Vercel deployment observed: READY deployment `dpl_gHnq8Bong8gMYeugLBGT75tF1FZd`, commit `df4df0bab8aa8fe00fd1605d9623823977980034`, aliases `hub.relaxfixuae.com` and `www.hub.relaxfixuae.com`. The latest `main` commit is newer than the observed Production commit; do not infer it is live.
- No application source, Supabase schema/RLS, credentials, Edge Functions, Production environment, publishing, WhatsApp, OAuth, or deployment state was changed during this audit.

### Confirmed existing capabilities
- Staff authentication uses Supabase Auth plus exactly one active `staff_profiles` row keyed by `auth.uid()`; restored sessions revalidate the JWT and active profile.
- Existing fixed roles: `super_admin`, `admin`, `reception`, `coach`, `content_manager`. Database role constraint accepts only these values.
- Frontend contains role-specific write gates for Inbox, bookings, content, and media. Backend RPCs also enforce role checks for many read/write paths; this is not only UI hiding.
- Existing language switcher supports Arabic and English.
- Existing canonical destinations remain: Control Tower, Coach Brain, Content Studio/Factory, Inbox, Media Library, Operations, Integrations/Connections, Automations, Bookings/Planner, CRM, Analytics, Radar, Archive, and Workspace.
- Integrations already have a dedicated management screen and existing server-side connect/test/disconnect RPCs. Do not create a second integration center.
- `audit_logs` already records administrative/operational events; observed row count at audit time: 1,115.

### Confirmed gaps / incomplete administration
- No owner-only application administration destination exists in the current More navigation.
- No verified staff invitation, staff-role update, or staff deactivation management path was found in the current application source or Production public-schema function inventory. The existing profile table and role model are present, but not an owner-facing CRUD capability.
- `business_settings` has one primary row and a public-read policy. No current staff-facing update RPC or application editing screen was found. It is the correct existing source for business profile/booking settings; do not create a duplicate business-settings table.
- `settings` is a legacy generic website-style table (site title/description, WhatsApp, theme color, background URL). It has one row in the direct live count, but no current application consumer or safe admin edit path was identified. Do not repurpose it as Command Center configuration.
- `rf_schedule_config` has two rows but no verified owner-facing configuration editor.
- `notification_settings` currently has zero rows and no verified owner-facing management flow.
- No dedicated module/feature-flag or role-permission configuration table was found among the 64 public tables.
- No audit-log read policy or owner-facing audit-log reader RPC was found. The audit trail is being written, but is not yet exposed as a safe owner view.
- The current primary and More navigation lists are static and are not filtered by `session.role`. Backend RPC checks remain the security boundary; the navigation gap is primarily an owner/staff UX inconsistency, not proof of backend authorization bypass.

### Live Supabase security evidence
- Production project: `nmzxrjdxvmmzzmajrskm`.
- All 64 public tables have RLS enabled. The Supabase advisor reports 53 RLS-enabled tables with no direct policies. This can be intentional for tables accessible only through guarded SECURITY DEFINER RPCs; do not add broad table policies merely to silence the advisor.
- The live catalog contains 168 SECURITY DEFINER functions; 81 are executable by authenticated users. The focused grant/definition audit found only two functions executable by anon: `rf_schedule_turn` (public scheduling-assistant turn, with no booking write) and `rf_whatsapp_automation_enabled` (boolean configuration read). The 79 other authenticated-executable functions in that focused set expose staff/identity guards; preserve the existing grant restrictions.
- The repository already contains migration `20261023160000_restrict_sensitive_rpc_execute_grants.sql`, which revokes anonymous/public execution from selected staff RPCs and service-only routines. Do not blanket-revoke authenticated execution.
- Advisor warnings observed: 10 mutable function search paths, `pg_net` installed in public, two anon-executable SECURITY DEFINER functions, 81 authenticated-executable SECURITY DEFINER functions, and leaked-password protection disabled. These require scoped review; they are not authorization to perform a broad security migration during the admin UI task.
- `staff_profiles` currently has one active profile, with role `super_admin`. No other role was present in the live table at audit time.
- Live configuration row counts: `business_settings` 1, `settings` 1, `rf_schedule_config` 2, `notification_settings` 0, `staff_integrations` 7, `staff_integration_secrets` 2. Secret values were not read or emitted.

### Recommended minimal architecture
1. Add one owner-only **إدارة التطبيق / App Administration** destination under More. It must not replace Control Tower or duplicate existing workspaces.
2. Reuse `staff_profiles` and the existing five-role allowlist for staff management. Do not create a second users/roles table or custom roles in the first iteration.
3. Reuse `business_settings` for the existing business/booking settings. Keep secrets out of this public-readable table.
4. Expose `audit_logs` through a paginated, read-only, super-admin-only server endpoint; do not add direct client RLS access to the whole audit table.
5. Keep existing Integrations, Automations, Content, Media, Bookings, CRM, and Analytics destinations canonical; the admin page should link to them and show truthful status rather than copy their controls.
6. Do not make role/module permissions dynamically editable in the first iteration. The backend currently has explicit role checks across many RPCs and Edge Functions; a dynamic permission editor would require replacing those checks consistently. First centralize and document the existing role-to-module matrix. Any future global module switch must be treated as UX availability only, never as a substitute for backend authorization.
7. For staff invitation/role changes and business-setting writes, use one authenticated server-side administration endpoint with JWT verification, a fresh active `super_admin` check, strict action/field allowlists, audit logging, and protections against self-lockout or disabling the last active super-admin. Never expose the service/secret key to the browser.
8. Follow Supabase's current security guidance: keep user JWT verification on user-facing Edge Functions; use privileged server credentials only after validating the caller; for SECURITY DEFINER functions, pin `search_path`, explicitly authorize the caller, and narrow EXECUTE grants.

### Verification and release gates
- Required tests: unauthenticated denial; inactive staff denial; non-super-admin denial; super-admin success; fixed-role validation; no self-demotion/deactivation; no disabling the last active super-admin; field allowlists; secret redaction; audit record written; pagination bounds; and no effect on existing operational RPCs.
- Validate with isolated QA identities for each relevant role before considering Production. Do not use the Production owner profile as a test fixture.
- No Production migration, Edge Function deployment, Vercel Production promotion, staff invitation email, role mutation, module toggle, live publish, or WhatsApp action is authorized by this audit record.
- Current safe point: diagnosis and architecture decision are complete; implementation is NOT_STARTED. The next bounded step is to implement the owner-only server-side administration contract and UI on a feature branch, then verify against isolated QA before any Production change.

## 29. AI Agent Operating Model — owner mandate reconciliation (2026-11-06)

### Product purpose — non-negotiable
The primary business purpose of Command Center Hub is to let the owner operate the academy with a coordinated AI workforce, so the owner can focus on swimming instruction and business decisions instead of manually coordinating tools and repetitive work. Administration is supporting infrastructure; it is not the product's primary outcome.

### Agreed operating model
- **Coach Brain is the coordinator/orchestrator**: understands the owner's intent, researches when needed, chooses the next safe workflow, creates the plan, routes work to existing capabilities, compares provider/cost choices, and returns a clear owner decision when required. It is not a second Content Factory or a duplicate agent runtime.
- **OpenAI**: reasoning, planning, structured decisions, quality review, and orchestration where selected by Coach Brain.
- **Gemini**: content/media analysis and generation tasks already supported by the existing provider integrations; do not assume a live provider operation is verified merely because credentials exist.
- **Canva**: design/template population and asset creation through the existing Canva integration.
- **Runway**: video-generation/editing provider handoff where the existing connection and supported API path permit it; do not claim automatic execution until an end-to-end capability is verified.
- **Content Factory**: the existing execution workspace for content creation; it receives the Coach Brain handoff (userIntent, planStrategy, researchContext, requestedDuration, contentGoal) rather than being rebuilt as another agent.
- **Media Library / Review / Operations / existing publishing path**: remain the canonical downstream execution stages. Preserve approval and publishing boundaries.

### Required end-to-end operating flow
Owner command → Coach Brain → research/plan/provider choice → existing Factory → Media → Draft/Review → Owner Approval → Operations → explicitly authorized schedule/publish → external receipt/result → measurement/analysis → next Coach Brain plan.

### Required owner experience
- The owner sees one simple request/decision surface, not provider settings, raw prompts, tokens, API keys, or technical routing.
- Coach Brain explains the recommended action, expected output, provider choice and cost/uncertainty in plain Arabic, then routes work to the existing destination.
- Show each delegated task with truthful states such as queued, working, needs owner decision, completed, blocked, or failed; each completion must have a real artifact/result or execution receipt.
- Preserve a clear audit trail: who/which agent initiated the task, the task input/output references, provider, time, cost when available, approval, and resulting action.
- Owner approval remains mandatory for content approval and any real external publishing, activation, or spend.

### Administration scope correction
The proposed App Administration area is subordinate to this operating model. It must not become a conventional settings portal that distracts from agent execution. Its first release should make the existing workforce understandable and controllable without creating duplicate systems:
1. An inventory of existing agents/capabilities and their responsibility, current availability, supported actions, and canonical destination.
2. Coach Brain orchestration visibility: current task, delegated destination, status, blocker, next owner decision, and evidence/result.
3. Provider readiness and cost visibility for the existing OpenAI/Gemini/Canva/Runway integrations, linking to the canonical Integrations screen rather than duplicating connection controls.
4. Existing staff/role administration and audit history, only after isolated QA and secure server-side authorization are available.

### Discovery and implementation constraints
- Before adding any agent registry, task table, queue, scheduler, provider adapter, or dashboard, inspect the current code, Supabase schema/RPCs, Edge Functions, and existing workflow handoffs for reusable equivalents. Reuse first; add only a proven missing capability.
- Do not label a provider integration as an autonomous agent unless it has a defined task contract, bounded permissions, observable execution, failure handling, and a verified result.
- Do not create parallel agents for work already owned by Coach Brain, Content Factory, Media, Automations, or Operations.
- Agent-level permissions must be enforced server-side and scoped to the task; hiding a UI control is not authorization.
- Preserve least privilege, budget limits, retries/idempotency, cancellation/timeout handling, and human approval gates. No secret is exposed to the browser or to the owner UI.
- No live publish, schedule, external message, provider spend, account activation, migration, or Production release without the applicable explicit approval.

### Acceptance criteria for the next implementation phase
- A single owner request can be interpreted by Coach Brain and handed to the existing Factory without re-entering the same brief.
- The handoff preserves all five agreed context fields and has a visible, truthful status/result.
- Provider selection is based on task suitability, readiness, and known cost; unknown cost/readiness is shown as unknown, not guessed.
- The owner can see which existing capability is responsible and what requires their decision.
- Existing approval, publishing freeze/authorization, WhatsApp, Meta, and production boundaries remain unchanged.
- Tests prove no duplicate task execution, no false success, no unauthorized tool/action, and no loss of the existing workflow.

### Current implementation gate
This section records the owner's clarified primary objective and corrects the emphasis of section 28; it does not authorize new tables, runtime infrastructure, provider calls, live actions, or Production changes. The current QA limitation remains: the available Supabase connector exposes project/database and Edge Function operations but no Auth Admin invite/create-user operation, and no Preview deployment exists for the administration branch. Continue safe repository-level work and test-contract design; do not use the Production owner identity as a QA fixture or bypass Supabase Auth.

## 30. Coach Brain / Factory as-is implementation baseline — 2026-11-06

### Direct source inspection
- `src/coach-brain.tsx` currently provides evidence research, ready-made task prompts, a limited content sample request, plan-window/mix/execution choices, and a route into the existing Content Factory. Research calls the `coach-brain-research` Edge Function; that function uses Gemini with Google Search grounding and validates the active staff identity.
- The current Coach Brain → Factory handoff is implemented in `src/coach-brain-factory-handoff.ts` and is persisted in browser session/local storage. The payload currently carries `question`, `answer`, `sources`, `planWindowDays`, `planMix`, `planExecution`, optional sample fields, and a timestamp.
- `src/content-growth-hub.tsx` consumes the handoff as supporting research context, combines it with existing Academy Knowledge, strategy, performance guidance, and provider selection, then uses the existing batch-generation and `create_staff_generated_content_batch` path.
- The batch provider contract already supports `auto`, `gemini`, and `openai` in `src/gemini-batch-adapter.ts`. This is provider routing inside the existing Factory, not proof of three autonomous agents.
- Canva remains an existing design integration. Runway is currently represented as an integration/capability status in the Factory; the inspected video-generation contract/test identifies Google Veo (`generate-veo-video`) as the actual video-generation path. Do not report Runway as an active autonomous video agent or silently substitute it for Veo.
- Existing PR #316 and its merged commit `d4869c8de90759bf19f71460e9640bff1caff7e7` already addressed persistent Coach Brain → Factory handoff. Do not recreate that feature.
- Existing PR #319 and `main` commit `f97f7d784bfe4653a060052202dca2e472644451` enforce the owner publishing freeze/authorization across scheduled, manual, and automation publishing paths. Preserve it.

### Verified gap — orchestration is not yet a complete agent workforce
- The inspected source shows a useful Coach Brain research-to-Factory workflow, but not a verified multi-agent dispatcher with named task ownership, delegated task IDs, durable execution states, retry/cancel policy, and a unified owner-visible execution history.
- The current handoff payload does not yet expose the five canonical orchestration fields as a typed contract: `userIntent`, `planStrategy`, `researchContext`, `requestedDuration`, and `contentGoal`. Current equivalents exist under different fields (`question`, `planMix`/`planExecution`, `answer`/`sources`, `planWindowDays`, and sample/action context), so the gap is contract normalization and traceability—not a reason to replace the existing handoff.
- The browser-storage handoff is a transfer mechanism, not a durable task ledger. Before introducing persistence, inspect existing content batch records, operational/audit records, RPCs, and n8n handoffs to determine whether they already provide the required task lifecycle evidence.
- No code change to Coach Brain, Factory, provider routing, task persistence, or publishing was made in this documentation step.

### Smallest implementation sequence
1. Normalize the existing Coach Brain → Factory payload into a typed, backward-compatible task contract while retaining current fields and the existing storage key.
2. Add contract tests proving all five canonical fields are populated, bounded, validated, and consumed by the existing Factory; preserve old handoff compatibility.
3. Reuse existing batch IDs, audit records, and execution receipts to display truthful task progress where possible; add no new table/queue until the source audit proves no reusable lifecycle record exists.
4. Surface the existing provider decision and capability truth in Coach Brain/Factory without duplicating Integrations controls; clearly distinguish OpenAI/Gemini content providers, Canva design, and Veo video generation from Runway's current status-only capability.
5. Verify in isolated QA and Preview. Keep all publish, schedule, WhatsApp, Meta, OAuth, and Production actions frozen unless separately authorized.


## 31. Coach Brain Task Contract — implementation and queue reality check (2026-11-06)

### Implementation delivered on a separate feature branch
- Feature PR: https://github.com/aymanmahrous/command-center-hub/pull/325
- Branch: `feat/coach-brain-task-contract-2026-11-06`
- Latest verified head at handoff update: `0de6683e8bb20de63b53ef456118f73736ef0313`.
- Files changed: `src/coach-brain-factory-handoff.ts` and `tests/coach-brain-task-contract.test.mjs`.
- The existing handoff key and session/local storage fallback are preserved.
- The five canonical fields are now normalized and bounded: `userIntent`, `planStrategy`, `researchContext`, `requestedDuration`, and `contentGoal`.
- A compatibility adapter maps canonical-only payloads into the legacy fields already consumed by Content Factory. Existing legacy payloads remain readable and retain their prior question/answer/source fields.
- No Factory generation, provider call, task execution, publish, or schedule is triggered by normalization.

### Verification evidence
- GitHub Actions — Verify Command Center, run #894: SUCCESS.
- `npm run typecheck`: PASS.
- `npm test`: 387/387 PASS.
- `npm run build`: PASS.
- Vercel checks remain blocked by the account build-rate limit (`upgradeToPro=build-rate-limit`); no Preview deployment was created. This is not a code-test failure.
- PR #325 remains Draft and unmerged. No Production deployment or promotion occurred.

### Read-only Production queue inspection — reuse decision
- `background_jobs` already has durable `queued / processing / completed / failed / retrying / dead` states, JSON payload/result, attempt count, retry time, and timestamps. RLS is enabled; direct table reads have no row policies, while service-role access exists.
- Its observed live job types are `generate_content_media`, `publish_content`, and `radar_hot_opportunity`. Existing claim/complete/fail/retry functions and workers are purpose-built around content media and publishing; do not insert Coach Brain tasks into this queue without a separately reviewed job type, worker, authorization, and idempotency contract.
- Read-only live counts at inspection time: 119 completed content-media jobs; publish jobs 12 completed, 53 dead, 10 processing, 50 queued; 4 queued radar jobs. These records were not changed.
- `content_automation_runs` is the existing automation-pulse run history (7,021 completed, 84 partial at inspection time), not a general per-agent task ledger.
- `ai_media_jobs` is provider-media-specific (one Google Veo succeeded record at inspection time), not a multi-agent ledger.
- No general Coach Brain / multi-agent task ledger was identified. Existing batch IDs, media jobs, automation runs, audit logs, and publication receipts each cover narrower operational lifecycles.

### Decision and next safe point
- Keep the delivered handoff contract; do not create a second handoff, queue, task table, or agent dashboard at this stage.
- The next implementation design must first define the actual agent responsibilities and permitted actions, then prove whether the existing `background_jobs` queue can safely host a distinct Coach Brain task type without interfering with the protected publishing/media workers. If it cannot, document the smallest isolated alternative before any schema change.
- Isolated QA identity and Preview remain required before any database/RPC/Edge Function change or Production release.
- Protected boundaries remain unchanged: publishing freeze, owner approval, WhatsApp, Meta, OAuth, credentials, and Production.


## 32. Coach Brain producer wiring and agent-role truth — 2026-11-06

### Producer now emits the canonical contract directly
- Feature PR #325 now also updates `src/coach-brain.tsx` so the existing “Send to Content Factory” action explicitly emits all five canonical fields before writing to the same `coach-brain-factory-handoff` storage key.
- Legacy fields (`question`, `answer`, `sources`, `planWindowDays`, `planMix`, `planExecution`) are emitted alongside canonical fields for compatibility with the current Factory consumer.
- Added `tests/coach-brain-task-producer.test.mjs` to assert that the real producer emits the contract and retains the existing Factory navigation.
- Latest feature branch head: `719d6b53cad45fbaf64b3bb7b4e826636ea603d3`.
- The earlier 387/387, typecheck, and build pass was recorded at commit `0de6683e8bb20de63b53ef456118f73736ef0313`, before these latest producer-wiring changes. The latest head has not yet produced a fresh GitHub Actions run or Vercel Preview; do not describe the latest changes as newly CI-verified.

### Agent roster integrity
- Prior conversation retrieval confirms Coach Brain is the sole orchestration interface over existing capabilities. It does not recover an exact, previously approved named roster of autonomous agents and individual role assignments.
- Do not invent or claim a historical owner-approved roster. Keep the existing verified capability boundaries explicit:
  - Coach Brain: research-led owner interface and handoff/orchestration entry point.
  - Gemini + Google Search grounding: verified research path through `coach-brain-research`; this is a provider/tool path, not a separate autonomous agent runtime.
  - OpenAI/Gemini content provider routing: existing content-generation capability used by the Factory; providers are not agents.
  - Canva: existing design integration/capability; not an autonomous agent by itself.
  - Google Veo: verified video-generation provider path in the existing media capability.
  - Runway: capability/status integration only until a real execution path is verified; do not mark it as an active video agent.
  - Factory Review and publishing: existing human approval and protected publishing boundary; do not convert them into unattended agents.
- Any future role catalog must distinguish a named workflow responsibility from an independently executing agent, identify its actual backend action, and display truthful capability/connection status. The roster should be proposed explicitly before being represented as owner-approved.

### Next safe implementation gate
- Re-read the current Factory consumer and its batch-save RPC before adding task tracking. Current verified path remains Coach Brain → existing browser handoff → Factory → `create_staff_generated_content_batch` → `content_items` with `needs_review`.
- A new task ledger/queue or an autonomous multi-agent runtime is not authorized by the current evidence. First prove whether existing batch IDs, audit logs, media jobs, and receipts can represent the needed progress without changing the publishing workflow.
- Latest producer wiring remains Draft pending a fresh CI run and isolated Preview/QA. No merge, Production deployment, provider execution, content publishing, or database mutation occurred.


## 33. Functional AI workforce map — implementation target, not a false agent claim (2026-11-06)

The user’s product goal is a coordinated AI workforce with one owner-facing manager. The current repository proves a set of capabilities and handoffs, not a fleet of independently running agents. Implement the following responsibilities behind Coach Brain while preserving that distinction:

| Responsibility | Existing implementation/evidence | Truthful current state |
|---|---|---|
| Orchestrator / owner interface | `src/coach-brain.tsx`, `coach-brain-research`, shared Factory handoff | Existing primary interface; no general autonomous agent runtime |
| Research analyst | Gemini 3.7 Flash + Google Search grounding in `coach-brain-research` | Real research execution path |
| Marketing strategist | `src/content-strategy.ts`, Coach Brain strategy inputs and plan fields | Embedded strategy logic, not a separate agent process |
| Content producer | Existing Factory and Gemini/OpenAI provider adapter | Real generation capability through the existing Factory |
| Visual designer | Existing Canva integration and `canva-design` path | Real connected capability; actual readiness still depends on connection/template diagnostics |
| Video producer | Existing Google Veo media-generation path and `ai_media_jobs` | Verified provider execution path; not evidence of a separate autonomous agent |
| Runway video role | Existing Runway capability/status entry | Status-only until a real generation path is demonstrated; do not label active |
| Quality reviewer | Existing Factory review flow and `content_items` status `needs_review` | Human review gate; no separate autonomous reviewer proven |
| Publishing operator | Existing protected publisher/receipts and approval checks | Publishing remains frozen pending new owner authorization; never auto-publish from this task contract |
| Performance analyst | Existing Radar/Analytics capabilities | Existing analysis surfaces; no general agent execution ledger proven |

### Product rule
- Coach Brain is the single coordinator and owner-facing entry point.
- Each responsibility may be implemented by a model, tool, existing application logic, or human approval. UI labels must state which one it is; do not market every integration as an autonomous agent.
- Agent/task tracking must show actual input, responsible capability, output/reference ID, status, and whether owner approval is required.
- No parallel agent dashboard or duplicate provider/connection center. Surface the role and task state within Coach Brain and link to the existing execution screen when action is required.
- No background agent execution, new queue, database ledger, publishing automation, or provider invocation is authorized by this documentation map alone.


## 34. Latest Coach Brain handoff verification — 2026-11-06 16:00 UTC

- Latest feature head: `6cb303c4d9e5401d2f8bd7c1871a06e2df0b81c6`.
- GitHub Actions Verify Command Center run #906 completed successfully.
- `npm ci --ignore-scripts --no-audit --no-fund`: PASS.
- `npm run typecheck`: PASS.
- `npm test`: 388/388 PASS, 0 failed.
- `npm run build`: PASS.
- The first producer-wiring run #903 exposed one stale source-pattern test that still expected the old inline `answer: result?.answer?.slice(...)` expression. The implementation now names the canonical `researchSummary`; the test was updated to assert the new variable and legacy adapter. The next run #906 passed all checks.
- Vercel Preview checks still fail at the account build-rate limit (`upgradeToPro=build-rate-limit`); this is external to the successful GitHub code verification. No Preview or Production deployment was created.
- PR #325 remains Draft, open, and unmerged. The new handoff contract and producer wiring are code-verified but not runtime-verified in Preview/isolated QA.
