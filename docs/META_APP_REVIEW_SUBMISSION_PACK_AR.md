# حزمة Meta App Review — Command Center Hub

**تاريخ الإعداد:** 24 سبتمبر 2026  
**التطبيق:** Relax Fix UAE Platform  
**App ID:** `980385998373405`  
**الحالة التي تم التحقق منها:** طلب Meta الحالي يعرض `business_management` فقط، وحالة المراجعة قيد التنفيذ. لا يوجد Feedback إضافي غير طلب فيديو يوضح الاستخدام الفعلي بالتفصيل.

## قرار التنفيذ

لم يتم تعديل `safe-content-publisher` أو Page ID أو Supabase أو n8n. اختبارات مسار النشر داخل التطبيق نجحت: **17 اختبارًا ناجحًا من 17**. لم يتم تنفيذ نشر خارجي تجريبي لأن ذلك يحتاج إلى اعتماد حي للنشر، ولأن تسجيل فيديو قبل ظهور منشور حقيقي سيؤدي إلى رفض جديد.

> **قاعدة مهمة:** لا تُرسل الصلاحيات ولا تسجل الفيديو إلا بعد نجاح منشور تجريبي واحد وظهوره فعليًا على صفحة Facebook.

---

## 1. الصلاحيات المطلوب تقديمها

قدّم الصلاحيات الثلاث التالية معًا، وبنفس الوصف والمسار في الفيديو:

| الصلاحية | لماذا يحتاجها التطبيق | ما الذي يجب أن يظهر في الفيديو |
|---|---|---|
| `pages_show_list` | لعرض صفحات Facebook التي يملكها أو يديرها المستخدم بعد تسجيل الدخول، حتى يختار الصفحة الصحيحة داخل Command Center. | ظهور الصفحة في قائمة الاختيار داخل التطبيق. |
| `pages_read_engagement` | لقراءة حالة وتفاعل المنشور بعد النشر والتحقق من أن النشر تم على الصفحة المختارة. | فتح Facebook Page أو معاينة المنشور والتحقق من ظهوره. |
| `pages_manage_posts` | لإنشاء منشور على صفحة Facebook التي اختارها المستخدم، وفقًا لصلاحياته. | إنشاء المنشور، تنفيذ Publish داخل التطبيق، ثم ظهور المنشور على الصفحة. |

### نص Permission Usage — `pages_show_list`

**English — paste into Meta:**

> Command Center Hub uses `pages_show_list` to display the Facebook Pages that the authorized user manages, so the user can select the correct Page inside the Command Center before creating content. The permission is used only after the user completes Facebook Login and grants access. The selected Page is shown in the publishing workspace and is used to make the destination explicit before the user confirms publishing. The app does not access Pages unrelated to the authorized user. The screen recording shows the login flow, the granted permissions, the list of available Pages, and the user selecting one Page for publishing.

**شرح عربي للفريق:**

> نستخدم الصلاحية لعرض صفحات Facebook التي يديرها المستخدم حتى يختار الصفحة الصحيحة داخل Command Center قبل إنشاء المنشور. لا نستخدمها للوصول إلى صفحات غير مرتبطة بالمستخدم.

### نص Permission Usage — `pages_read_engagement`

**English — paste into Meta:**

> Command Center Hub uses `pages_read_engagement` to verify the result of a Page publishing action and to read the Page engagement state needed to confirm that the content was published to the selected Facebook Page. The user initiates the action and sees the selected Page before publishing. After publishing, the app presents the publication result and the reviewer can open the Facebook Page to verify the live post. The permission is not used to read unrelated Pages or for advertising, profiling, or any purpose outside the connected Page workflow.

**شرح عربي للفريق:**

> نستخدم الصلاحية للتحقق من نتيجة النشر على الصفحة المختارة وإظهار حالة النشر، ثم يمكن للمراجع فتح الصفحة والتأكد من ظهور المنشور الحقيقي.

### نص Permission Usage — `pages_manage_posts`

**English — paste into Meta:**

> Command Center Hub uses `pages_manage_posts` to publish an approved content item to the Facebook Page explicitly selected by the authorized user. The user signs in with Facebook, grants the requested Page permissions, selects a Page in Command Center, reviews the content, and confirms the Publish action. The app then sends the approved post to the selected Page and displays the returned publication result. The reviewer can open the Page and verify the live post. The permission is used only for the Page selected and authorized by the user; the app does not publish to unrelated Pages, publish without user confirmation, or use Page publishing data for unrelated purposes. The screen recording demonstrates the complete flow from a fresh login through the live post on the Page.

**شرح عربي للفريق:**

> نستخدم الصلاحية لنشر منشور تمت الموافقة عليه على صفحة Facebook التي اختارها المستخدم بنفسه. المستخدم يسجل الدخول، يمنح الصلاحيات، يختار الصفحة، يراجع المحتوى، ثم يضغط Publish. بعد ذلك يظهر المنشور الحقيقي على الصفحة.

---

## 2. Test Instructions للمراجع

**English — paste into Meta:**

> 1. Open Command Center Hub in a fresh private/incognito browser session.
> 2. Start Facebook Login and sign in with the Facebook test account listed in the App Roles/Testers section.
> 3. Accept the requested permissions: `pages_show_list`, `pages_read_engagement`, and `pages_manage_posts`.
> 4. Return to Command Center Hub. The connected Facebook Pages will appear in the Page selector.
> 5. Select the test Page: `[INSERT EXACT TEST PAGE NAME]`.
> 6. Open the content publishing area and use the prepared approved test item titled: `[INSERT EXACT TEST ITEM TITLE]`.
> 7. Review the caption and destination Page, then click **Publish** / **نشر الآن**.
> 8. Wait for the success state and copy the returned post link or post ID if it is displayed.
> 9. Open the selected Facebook Page at: `[INSERT EXACT PAGE URL]`.
> 10. Verify that the test post is visible on the Page. The expected text begins with: `[INSERT UNIQUE TEST POST PREFIX]`.
> 11. Optional verification: open the post menu and demonstrate edit or delete only if the current test account and Page flow support it. This optional step is not required to approve the three permissions.
>
> If the reviewer cannot see the Page, confirm that the test account has Page access and that the exact test Page is assigned to the app/test account. No external n8n workflow is required for this test; the publish action is initiated from inside Command Center Hub.

### نسخة عربية للفريق غير التقني

1. افتح Command Center Hub في نافذة خاصة جديدة.
2. اضغط Facebook Login وسجّل بحساب الاختبار.
3. وافق على الصلاحيات الثلاث.
4. اختر صفحة الاختبار من القائمة.
5. افتح قسم النشر واختر المنشور التجريبي الجاهز.
6. راجع النص والصفحة واضغط **نشر الآن**.
7. انتظر رسالة النجاح.
8. افتح صفحة Facebook نفسها وتأكد أن المنشور ظهر فعلًا.
9. لا تسجل الفيديو ولا ترسل الطلب إذا لم يظهر المنشور.

---

## 3. سيناريو الفيديو — حوالي 2 إلى 3 دقائق

| الزمن | ما يظهر على الشاشة | التعليق الصوتي أو النص المقترح |
|---|---|---|
| 0:00–0:10 | نافذة خاصة جديدة وفتح Command Center Hub | “This is Command Center Hub. I am starting from a fresh login session.” |
| 0:10–0:30 | الضغط على Facebook Login | “The business owner connects a Facebook account to manage an authorized Facebook Page.” |
| 0:30–0:50 | شاشة Meta التي تعرض الصلاحيات الثلاث | “The requested permissions are pages_show_list, pages_read_engagement, and pages_manage_posts.” لا تُخفِ هذه الشاشة. |
| 0:50–1:05 | منح الصلاحية والعودة للتطبيق | “After authorization, the app returns to Command Center Hub.” |
| 1:05–1:20 | ظهور قائمة الصفحات واختيار صفحة الاختبار | “The app lists the Pages available to this authorized user. I select the test Page.” |
| 1:20–1:45 | فتح قسم النشر واختيار المنشور التجريبي | “This is an approved content item. The destination Page is visible before publishing.” |
| 1:45–2:00 | مراجعة النص والضغط على Publish | “I confirm the post from inside Command Center Hub.” |
| 2:00–2:15 | ظهور نجاح النشر أو رابط المنشور | “The app displays the result returned by Meta.” |
| 2:15–2:40 | فتح Facebook Page وإظهار المنشور الحقيقي | “The post is now visible on the selected Facebook Page. This verifies the complete use case.” |
| 2:40–2:55 | اختياري: إظهار edit/delete إن كان متاحًا | “The Page owner can manage the resulting post according to the Page’s normal controls.” |

### قواعد تسجيل مهمة

- لا تستخدم فيديو تجريبيًا أو شاشة ثابتة بدل النتيجة الحقيقية.
- لا تعرض كلمات مرور أو رموز وصول أو مفاتيح Supabase.
- لا تسجل n8n أو لوحة Supabase؛ المطلوب هو تجربة المستخدم داخل Command Center Hub ونتيجة Facebook.
- ابدأ من تسجيل دخول جديد حتى يرى المراجع شاشة الصلاحيات.
- استخدم منشورًا فريدًا، مثل بادئة: `META-REVIEW-2026-09-24 — Command Center test post`.
- اترك اسم الصفحة ومعرّف المنشور ظاهرين عند التحقق، مع إخفاء أي بيانات شخصية غير لازمة.

---

## 4. قائمة تحقق قبل الإرسال

- [ ] نجح منشور واحد حقيقي على صفحة الاختبار.
- [ ] ظهر المنشور على Facebook Page نفسها.
- [ ] الصلاحيات الثلاث مضافة إلى نفس طلب المراجعة.
- [ ] وصف كل صلاحية يذكر بوضوح أين تظهر في الفيديو.
- [ ] Test Instructions تحتوي اسم الصفحة والرابط واسم المنشور الفريد.
- [ ] الفيديو يبدأ من نافذة تسجيل دخول جديدة.
- [ ] شاشة Meta للصلاحيات ظاهرة بوضوح.
- [ ] لا توجد أسرار أو رموز وصول في الفيديو.
- [ ] رابط التطبيق يعمل للمراجع وحساب الاختبار لديه Page access.
- [ ] لا يتم الضغط على Submit/Send for Review قبل مراجعة الفيديو مرة واحدة.

---

## 5. ما تم التحقق منه في الكود

- النشر اليدوي المعتمد يمر عبر `supabase/functions/safe-content-publisher`.
- الواجهة ترسل `contentItemId` إلى وظيفة Meta المحمية.
- النتيجة تُسجل عبر RPC مدققة وقابلة للتكرار في سجل التدقيق.
- لا يوجد في الاختبارات توجيه للنشر عبر n8n.
- اختبارات Meta والنشر المستهدفة: **17/17 ناجحة**.
- الاختبار العام للمشروع لديه فشل منفصل في `tests/today-view-schema.test.mjs` بسبب اعتماد مفقود؛ لم نغيّره لأنه غير متعلق بمسار Meta ولا نريد استهلاك تعديل إضافي.

## 6. ترتيب العمل الأقل تكلفة

1. تأكيد أن إعداد Meta يعرض الصلاحيات الثلاث في طلب جديد.
2. تنفيذ منشور تجريبي واحد فقط.
3. إذا ظهر المنشور: تسجيل الفيديو بنفس المسار.
4. لصق النصوص أعلاه وإرفاق الفيديو.
5. إرسال `pages_manage_posts` و`pages_show_list` و`pages_read_engagement` للمراجعة.
6. إذا فشل المنشور: حفظ كود الخطأ فقط وعدم تسجيل الفيديو، ثم إصلاح الخطأ المحدد دون إعادة بناء النظام.

**لا توجد أي خطوة أخرى مطلوبة الآن من Meta قبل اكتمال منشور تجريبي حقيقي.**
