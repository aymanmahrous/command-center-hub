# MASTER_PROJECT_HANDOFF.md — الحوكمة الدائمة لمشروع Relax Fix UAE / Swim Fluent UAE

> **CANONICAL / FINAL ACTIVE HANDOFF:** هذا هو مرجع الـHandoff النشط والنهائي الوحيد للوكلاء التنفيذيين اللاحقين. الملفان `CURRENT_OWNER_HANDOFF.md` و`PROJECT_HANDOFF.md` محفوظان كسجلين تاريخيين فقط وموسومان بأنهما `SUPERSEDED`؛ لا يُستخدمان كنقطة بدء للتنفيذ.

هذا الملف هو **مصدر الحقيقة الإداري الدائم** للمشروع. أي مدير أو مستشار أو Agent جديد يجب أن يقرأه أولًا (بالإضافة إلى `AGENTS.md`، `OWNER_WORKING_PROFILE.md`، و`OWNER_PROTECTION_AND_BUDGET_POLICY.md`) قبل أي تنفيذ.

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

**Instagram Controlled Publishing Test**

## 8. CURRENT_BLOCKER

**Instagram Controlled Publishing Test — جاهز للنشر عبر n8n فقط.** عنصر الاختبار `ffb9f795-c359-43c5-861c-5594eda75eef` («3 calm breathing habits…»): محتوى **approved**، تصميم Canva **approved** + معاينة تعمل (PR #84)، `consent_confirmed`، `publishability_status=ready_for_review`، `ai_analysis_status=completed`. **المعوق الوحيد:** تشغيل n8n workflow `xNwYPSXQiUyzDSyZ` يدويًا (enqueue يتطلب `service_role` — خارج Hub). لا Boost ولا إعلانات ولا إعادة نشر تلقائي.

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

1. ~~إنشاء دفعة محتوى (10 عناصر)~~ — **مغلق** (`17ce0f07-…`).
2. ~~اعتماد منشور Instagram واحد~~ — **مغلق** (`ffb9f795-…`).
3. تشغيل n8n workflow `xNwYPSXQiUyzDSyZ` للنشر الحي لذلك المنشور فقط.
4. تقديم: Instagram Post ID، رابط المنشور، وقت النشر، execution ID، receipt status.
5. عند غموض النتيجة: لا إعادة نشر — إبلاغ المالك.

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

## 14. Final Manager & Executive Agent Handoff — 2026-09-27

# Command Center Hub — Final Manager & Executive Agent Handoff
## Current Execution Phases — 2026-09-27

> **DOCUMENT STATUS:** Plan Mode / Documentation and approval reference only.
>
> This document does **not** authorize application changes, code changes, Database/RLS/Auth changes, OAuth changes, provider or credential creation, external tests, Meta/n8n/Buffer execution, Merge, Deploy, or live publishing.

## 1. Governing Record and Preservation Rule

The existing Handoff remains the governing project record and must be preserved as-is unless an approved documentation update is explicitly authorized.

- Do not delete the existing Handoff.
- Do not rewrite it from zero.
- Do not replace it with a new parallel Handoff.
- Do not recreate a duplicate system, UX, integration, workflow, provider, credential, or plan.
- Preserve all correct existing commitments, verified evidence, restrictions, phase order, and owner decisions.
- Add or strengthen documentation only; do not silently remove an existing obligation.

### Active reference

`MASTER_PROJECT_HANDOFF.md` is the sole active project handoff reference. Historical handoff files must be clearly marked as superseded and must not be used as the starting point for execution.

## 2. Scope of This Plan

This Phase 0–5 sequence applies to **Command Center Hub only**.

It does not replace, reorder, close, or authorize the project's separate marketing, publishing, Instagram, Facebook, n8n, Buffer, or other external-operations phases. The existing project `CURRENT_PHASE` and `CURRENT_BLOCKER` remain unchanged unless a separate, documented Change Request explicitly updates them.

## 3. Current Verified Starting Evidence

- PR #161 is **Merged**.
- Previous verification for PR #161 is recorded.
- Official deployment status for PR #161 is **NOT VERIFIED** unless separate direct evidence is recorded.
- Do not describe PR #161 as deployed merely because it was merged or because CI passed.
- Do not repeat previously successful tests, builds, scans, or performance checks unless there is a real Change, Conflict, or New Evidence.
- The existing Integrations read-only review found no visible hard-coded API key, token, or secret in the reviewed UI code.
- Secret values are entered by the user and sent to the existing RPC path; after save, only `secretHint` may be shown if available.
- The Owner UX integration contract is **NOT COMPLETE**.
- External capability verification is **NOT COMPLETE**.
- The current Integrations UI still requires owner-safe wording and clearer separation between local configuration and real external connection testing.

## 4. Fixed Execution Sequence

The following sequence is the approved working path for the next Command Center Hub work. It must not be reordered, merged, skipped, or expanded merely because another path appears faster.

1. **Phase 0 — Continuity Gate**
2. **Phase 1 — Owner UX Smoke Test**
3. **Phase 2 — Integrations Owner-UX Audit**
4. **Phase 3 — Integrations Atomic Step**
5. **Phase 4 — Coach Brain & Cost Transparency**
6. **Phase 5 — Facebook Publish Block / Guardrail**

Each phase has one defined output. After that output is produced and the required verification is complete, the responsible agent must stop and wait for the next approved point.

---

# PHASE 0 — CONTINUITY GATE

## Purpose

Read the current state before any direction or execution. Reuse verified evidence and prevent duplicate work.

## Manager actions

The Manager must read:

- The latest reliable active Handoff.
- The last verified report.
- The last Atomic Step.
- The current PR or work item related only to the proposed Atomic Step.
- The minimum relevant files/functions only.

The Manager must identify:

- `VERIFIED`
- `NOT VERIFIED`
- `UNVERIFIED`
- `BLOCKED`
- `UNFINISHED`
- `SUPERSEDED` historical information
- The exact point where the previous path stopped.

The Manager must confirm the actual PR #161 status as:

> **Merged / Previous verification recorded / Official deployment status not verified**

## Prohibited Phase 0 actions

- No Full Scan without a documented reason.
- No repeat of the 218-test suite, Build, TypeScript, or Performance checks when they are already verified and no qualifying change exists.
- No code change.
- No external test.
- No Merge or Deploy.
- No change to Database, Auth, RLS, OAuth, Provider, Credential, n8n, Meta, Buffer, or Coach Brain behavior.
- No new PR merely to continue the process.

## Required output

A short Continuity Gate status report, not implementation.

If the current state, active Handoff, or last verified evidence cannot be identified reliably:

> **SAFE STOP — CONTINUITY EVIDENCE INCOMPLETE**

---

# PHASE 1 — OWNER UX SMOKE TEST

## Entry conditions

This phase may begin only when all of the following are true:

1. PR #161 is merged.
2. Official deployment is directly verified.
3. The required independent approval for this focused smoke test is recorded.
4. The Manager provides a complete Execution Brief.

If any entry condition is missing:

> **BLOCKED — OWNER UX SMOKE TEST CANNOT START**

## Focused path

Verify only the owner navigation and unified Owner UX:

```text
Home → Content → Inbox → Media → Operations → More
```

## Verify

- One Owner-facing interface is visible.
- The old navigation interface is not visible.
- No duplicate link exposes the same function unnecessarily.
- Each button routes to the correct Owner section.
- No blank page or broken route appears.
- Existing capabilities are not missing.
- Home summarizes rather than duplicating the content of other sections.
- Internal pages preserve their parent section and back behavior where applicable.
- Only one main section is active at a time.

## Prohibited actions

- No navigation rebuild.
- No new Router merely because a state problem is suspected.
- No Full Scan.
- No repeat of already verified Build or test evidence without a qualifying reason.
- No Merge or Deploy from the smoke test.
- If a defect appears, record the file/path, observed effect, and evidence, then stop modification.

## Required output

A focused Owner UX Smoke Test report. It is not authorization for Phase 2.

---

# PHASE 2 — INTEGRATIONS OWNER-UX AUDIT

## Purpose

Read-only review of the existing Integrations UI and contracts. This phase produces a gap report only.

## Required audit table fields

For each existing provider or integration item, record:

```text
Provider
Current UI item
Connect method
Open available
Test type
Status evidence
Owner-safe copy
Gap
```

## Verify

- No hard-coded API key, token, or secret is exposed.
- No secret or token is displayed after save, except a safe bounded `secretHint` if the existing contract provides it.
- Technical terms are not unnecessarily exposed in the final Owner UI.
- `Connected` is not displayed without real supporting evidence.
- `Connect`, `Open`, `Reconnect`, and `Disconnect` have distinct, understandable meanings.
- Local configuration is distinguished from external capability verification.
- A local test is not presented as an external `Test Connection`.
- Unrepresented or unverified capabilities remain `UNVERIFIED` or `NOT_CONFIGURED`, not `CONNECTED`.
- Any gap is documented rather than silently fixed.

## Prohibited actions

- No code modification.
- No new Provider.
- No new OAuth flow.
- No new Credential.
- No new Token or API selection.
- No external connection test.
- No n8n, Meta, Canva, Buffer, or live publishing execution.
- No Full Scan outside the existing Integrations list.

## Required output

A read-only Integrations Owner-UX Audit report. The report must not contain secrets.

---

# PHASE 3 — INTEGRATIONS ATOMIC STEP

## Entry conditions

This phase may begin only after:

1. The Phase 2 gap report exists.
2. One specific gap is selected.
3. Separate approval for that exact change is recorded.
4. A complete Execution Brief is provided.

## Allowed change

One smallest safe change in the affected Integrations UI or behavior, such as:

- Hide a technical label from the Owner UI.
- Replace `Credential` with owner-understandable wording.
- Separate local configuration status from external connection testing.
- Add `Open Service` only if the destination and path are already proven.

## Prohibited actions

- No rebuilding the UX.
- No parallel integration system.
- No provider, OAuth, credential, token, or architecture addition.
- No batch of unrelated fixes.
- No automatic external test.
- No automatic move to Phase 4.
- No trial-and-error.

If an architectural change, protected permission, new provider, or new integration contract is required:

> **STOP → CHANGE REQUEST → WAIT**

## Verification

Focused verification of the affected area only. Then stop.

---

# PHASE 4 — COACH BRAIN & COST TRANSPARENCY

## Canonical entry rule

Coach Brain remains one canonical entry. Contextual links from Home, Content, or More may point to it, but they must not create duplicate AI pages or parallel Coach Brain systems.

## Before any generation or paid capability

The Owner-facing experience must clearly state, in simple language:

- What will be created.
- Which source, capability, service, or provider will be used.
- Whether it is Free or Paid.
- The estimated cost, only when confirmed by reliable evidence.
- A free alternative, when available.
- Why the capability is being suggested, when relevant.

The experience must include a clear confirmation step before a paid action.

## Prohibited actions

- No silent paid service.
- No choosing a Token, API, or Model ID on behalf of the Owner.
- No claiming a cost or capability is confirmed without evidence.
- No duplicate Coach Brain page.
- No paid generation before the capability and cost evidence are clear.

If cost, provider capability, or pricing is uncertain:

> **UNVERIFIED — NO PAID ACTION**

This phase does not authorize a paid generation or provider configuration by itself.

---

# PHASE 5 — FACEBOOK PUBLISH BLOCK / GUARDRAIL

This phase is a separate protection gate. It does not authorize live publishing by itself.

## Entry condition

Only explicit execution approval for the exact publishing test may open this phase.

## Required controlled sequence

```text
Authorization
→ One Content Item for the same Job
→ One Facebook Test
→ Meta Response
→ Error or Receipt
→ STOP
```

## Rules

- One content item only.
- One controlled Facebook test only.
- No Instagram in the same round.
- No n8n or Buffer in the same round unless separately authorized.
- No Boost, Ads, or automatic republishing.
- No automatic code change after a failed test.
- If the result is ambiguous, do not Retry and do not republish.
- Report the observed result, error, or receipt to the Owner/Manager and stop.
- A successful test does not automatically authorize another phase or another publication.

---

# MANDATORY EXECUTION GATES

## A. Mandatory pre-check order

Every Manager and Executive Agent must follow this order:

```text
INSPECT
→ UNDERSTAND
→ IDENTIFY EXISTING CAPABILITY
→ CHOOSE LOWEST-RISK PATH
→ EXECUTE ONE APPROVED ATOMIC STEP
→ VERIFY
→ STOP
```

## B. Mandatory Execution Brief

No Executive Agent may start work unless the Manager's instruction contains all fields below:

```text
Atomic Step:
Goal:
Starting Evidence:
Allowed Scope:
Forbidden Scope:
Verification Method:
Stop Condition:
Required Report:
```

If one field is missing, unclear, contradictory, or outside the locked plan:

> **SAFE STOP — EXECUTION BRIEF INCOMPLETE**

The Executive Agent must not guess, expand the scope, or begin a trial-and-error process.

## C. Manager Gate

The Manager must:

- Read the active Handoff first.
- Confirm the current phase and previous evidence.
- Choose the lowest-risk path.
- Keep the sequence fixed.
- Ensure the previous phase has its required written report.
- Ensure required verification is complete.
- Resolve or explicitly record blockers and conflicts.
- Define one Atomic Step only.
- Record a Change Request when a proposed action is outside the plan.
- Explain the result to the non-technical Owner in simple language.

The Manager may not:

- Skip a phase because it appears faster.
- Merge two phases without a documented approved change.
- Turn a broad Owner request into an undefined technical authorization.
- Treat CI success as Merge approval.
- Treat Merge as Deploy approval.
- Treat Deploy as external testing or publishing approval.

## D. Executive Agent Gate

The Executive Agent must:

- Read the active Handoff and relevant evidence before acting.
- Execute only the approved Atomic Step.
- Work only within the Allowed Scope.
- Preserve existing work and reuse existing capability.
- Avoid duplicate systems, duplicate pages, and duplicate PRs.
- Avoid repeating Verified Evidence without Change, Conflict, or New Evidence.
- Use focused verification only.
- Stop immediately when the Atomic Step and its verification are complete.
- Report honestly using `VERIFIED`, `NOT VERIFIED`, `UNVERIFIED`, `BLOCKED`, or `SAFE STOP`.

The Executive Agent must not:

- Guess.
- Add an unapproved phase.
- Reorder the plan.
- Expand the Scope.
- Modify code during a read-only audit.
- Change Database, Auth, RLS, OAuth, Providers, Credentials, n8n, Meta, Buffer, or Coach Brain behavior without separate authorization.
- Merge, Deploy, publish, or perform an external test by assumption.
- Claim success without evidence.

## E. Evidence status rules

Use these statuses precisely:

- **VERIFIED:** supported by direct, relevant, dated evidence.
- **NOT VERIFIED:** sufficient evidence does not exist yet.
- **UNVERIFIED:** the capability or status is unknown or not confirmed end to end.
- **BLOCKED:** a known blocker prevents safe continuation.
- **UNFINISHED:** started or planned but not completed.
- **SUPERSEDED:** historical information that must not be used as current state.
- **SAFE STOP:** work intentionally stopped because continuing would violate scope, evidence, permission, plan, or resource safety.

No Agent may convert `NOT VERIFIED`, `UNVERIFIED`, or `BLOCKED` into `AVAILABLE`, `CONNECTED`, `READY`, `PASS`, `DEPLOYED`, or `COMPLETE` without new evidence.

`ASSUMED` is not an allowed project status.

## F. Action authority separation

```text
CI PASS ≠ Merge
Merge ≠ Deploy
Deploy ≠ External Test
External Test ≠ Publishing Approval
```

Each action requires its own authorization where the project rules require it.

## G. Handoff update rule

After every completed Atomic Step, the responsible Agent must provide or update a report containing:

- What was verified.
- What changed.
- What remains unverified.
- Whether the plan remains unchanged.
- Any blocker or conflict.
- The next approved point.

The Agent must stop after the report and must not begin the next phase automatically.

## H. No-claim-without-evidence rule

No Agent may report `fixed`, `passed`, `connected`, `deployed`, `ready`, or `complete` unless the evidence for that exact claim is recorded.

If evidence is insufficient:

> **NOT VERIFIED — NO SUCCESS CLAIM**

---

# CHANGE CONTROL / PLAN CHANGE GATE

The plan is fixed unless a documented change is approved.

If a Manager or Agent identifies something necessary that is not covered by the current plan, do not add or implement it silently. Report:

```text
CHANGE REASON:
NEW EVIDENCE:
RISK IF UNCHANGED:
LOWEST-RISK ALTERNATIVE:
REQUIRED OWNER APPROVAL:
```

Then:

> **STOP → WAIT**

A request to move faster, skip a gate, or choose a technical shortcut is not by itself approval to change the plan.

---

# RESOURCE, CREDIT, AND TIME PROTECTION

- Preserve Credits, time, cost, and project stability before speed.
- Do not run Full Scan without a documented reason.
- Do not use Trial and Error.
- Do not retry repeatedly.
- Do not run unnecessary builds, tests, browser checks, integration checks, or external checks.
- If continuing is unsafe because of resources, time, uncertainty, or permission:

> **STOP IMMEDIATELY → SAFE STOP HANDOFF → WAIT**

Do not force a result merely to produce a PASS.

The goal is the highest evidence-based probability of success with the fewest safe steps; no Agent may promise 100% success before the required evidence exists.

---

# REQUIRED REPORT AFTER EVERY ATOMIC STEP

```text
STATUS: PASS / PARTIAL / BLOCKED / SAFE STOP

STARTING POINT:

AUTHORIZED SCOPE:

DONE:

VERIFIED:

NOT VERIFIED:

FILES CHANGED: NONE or exact file names

PRODUCTION IMPACT: NONE or exact impact

RESOURCE/CREDIT STATUS:

UNFINISHED WORK:

NEXT APPROVED POINT:
```

After the report:

> **STOP → WAIT**

---

# INTEGRATION AND EXTERNAL-SYSTEM SAFETY

- Never expose Secrets, Tokens, API Keys, or technical credential values in documentation or Owner UI.
- Do not invent or infer a Connected status.
- Do not run n8n, Meta, Canva, Buffer, or live publishing as a UI test.
- Do not create media merely to make a button appear available.
- Do not change Instagram IDs.
- Do not add a migration or RPC unless a documented capability matrix proves existing contracts cannot support the approved requirement.
- Do not touch an external system outside the approved scope.
- Do not use a protected credential or service role without explicit authorization.

---

# POST-APPROVAL DOCUMENTATION CHECKLIST

After this plan is formally approved, the active Handoff may be updated to record only these documentation facts:

1. Owner UX Smoke Test is a later phase conditional on PR #161 merged status and verified official deployment.
2. Integrations Gap Audit is a limited read-only phase before any fix.
3. The reviewed UI code showed no visible hard-coded secrets, but technical labels and the Owner UX integration contract remain incomplete.
4. Coach Brain remains one canonical entry under More, with contextual links from Home or Content.
5. Cost transparency gate: Free / Paid / UNVERIFIED before confirmation of generation.
6. The Manager and Executive Agent may not change phase order or convert a broad Owner request into a risky technical change.

This checklist does not authorize implementation, Merge, Deploy, external testing, or publishing.

---

# FINAL DECISION RULE

Before any action, ask:

1. What is the one Atomic Step?
2. What evidence proves the starting point?
3. What is allowed and forbidden?
4. How will only this step be verified?
5. What is the stop condition?
6. What must be reported?

If the answer is incomplete or contradictory:

> **SAFE STOP — WAIT FOR CLARIFICATION OR APPROVAL**

**Preserve first. Reuse verified evidence. Choose the lowest-risk path. Execute one approved Atomic Step. Verify only that step. Stop. Report. Wait.**
