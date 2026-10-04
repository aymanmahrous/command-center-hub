# BLK-01 وCanva: مسودة التنفيذ والتحقق الحي

## 1. ملفات BLK-01 المطلوبة

| الملف | الغرض |
|---|---|
| `supabase/functions/coach-brain-research/cost.ts` | عقد نقي لحساب التوكنات والتكلفة، مع وضع fail-closed عند غياب الأسعار أو فساد بيانات المزود. |
| `supabase/functions/coach-brain-research/index.ts` | قراءة `usageMetadata` من Gemini وإرجاع `costTransparency` دون إعادة مفتاح Gemini أو حفظ السؤال. |
| `tests/coach-brain-cost.test.mjs` | اختبار معزول لا يستدعي Gemini: حساب صحيح، غياب الأسعار، ومدخلات مزود غير صالحة. |
| `src/coach-brain.tsx` | بطاقة ثنائية اللغة تعرض النموذج، توكنات الإدخال/الإخراج/الإجمالي، والتكلفة المقدرة أو `غير متاح`. |
| `src/coach-brain.css` | تخطيط البطاقة على الحاسوب والهاتف. |

## 2. أسرار وإعدادات Edge Function

تُضاف الأسعار إلى **Supabase Edge Function secrets** فقط، ولا تُضاف إلى Vite أو المستودع:

```text
COACH_BRAIN_INPUT_USD_PER_MILLION_TOKENS=<السعر الرسمي الحالي لإدخال النموذج>
COACH_BRAIN_OUTPUT_USD_PER_MILLION_TOKENS=<السعر الرسمي الحالي لإخراج النموذج>
```

لا يجب تخمين الأسعار. إذا لم تُضبط القيمتان، تعرض الواجهة عدد التوكنات وتعرض التكلفة `غير متاح` بدل اختلاق مبلغ. يجب تحديث القيم عند تغير قائمة أسعار Gemini أو النموذج.

> السعر المقدر توضيحي وليس فاتورة مزود. الفوترة الرسمية تبقى مصدر الحقيقة.

## 3. اختبار BLK-01 محليًا

من جذر المستودع:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test -- tests/coach-brain-cost.test.mjs
npm run typecheck
npm run build
```

يجب التحقق من:

- عدم وجود `GEMINI_API_KEY` أو أي مفتاح مزود داخل `src/` أو `dist/`.
- عدم تسجيل السؤال أو بيانات السباح في `cost.ts` أو عقد الاستجابة.
- عدم استدعاء الشبكة في `tests/coach-brain-cost.test.mjs`.
- عند غياب الأسعار: `pricingConfigured=false` و`estimatedCostUsd=null`.

لإثبات العزل عمليًا يمكن تشغيل الاختبار مع منع الشبكة على مستوى بيئة CI، لأن الاختبار لا يحتاج Gemini أصلًا:

```bash
NODE_OPTIONS=--no-network npm test -- tests/coach-brain-cost.test.mjs
```

إذا كان إصدار Node المستخدم لا يدعم `--no-network`، يُكتفى بالتدقيق بأن الاختبار يستورد `cost.ts` فقط ولا يستورد `index.ts` ولا يستخدم `fetch`.

## 4. خطوات اختبار Canva Edge Function المنشورة

### المتطلبات

- رابط مشروع Supabase المنشور، مثل `https://<project-ref>.supabase.co`.
- `curl` و`jq`.
- لا تحتاج اختبارات الحراسة السلبية إلى رمز دخول.
- لا تستخدم `-L`؛ نريد رؤية استجابة الدالة نفسها وعدم اتباع أي تحويل.

اضبط الرابط محليًا في جلسة الطرفية فقط:

```bash
export SUPABASE_URL='https://<project-ref>.supabase.co'
export CANVA_URL="$SUPABASE_URL/functions/v1/canva-oauth"
```

لا تضع الرابط الحقيقي أو الرموز في مستودع Git أو سجل CI.

### الاختبار A: preflight

```bash
curl --fail-with-body -sS -i -X OPTIONS "$CANVA_URL" \
  -H 'Origin: https://hub.relaxfixuae.com' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: authorization,content-type'
```

المتوقع:

- HTTP `204`.
- وجود `access-control-allow-methods` و`access-control-allow-headers`.
- لا يوجد استدعاء لمصادقة الموظف أو Canva OAuth.

### الاختبار B: غياب Authorization — بوابة BLK-02 الأساسية

```bash
body_file="$(mktemp)"
headers_file="$(mktemp)"
status="$(curl -sS -D "$headers_file" -o "$body_file" -w '%{http_code}' \
  -X POST "$CANVA_URL" \
  -H 'Content-Type: application/json' \
  --data '{"mode":"status"}')"

printf 'HTTP status: %s\n' "$status"
cat "$body_file" | jq .
jq -e '(.success == false and .code == "AUTH_REQUIRED")' "$body_file"
test "$status" = "400"
rm -f "$body_file" "$headers_file"
```

النجاح لا يُحتسب إلا إذا كانت النتيجة:

```json
{"success":false,"code":"AUTH_REQUIRED"}
```

وبحالة HTTP `400`، مع `content-type` من نوع JSON. هذه النقطة تثبت أن الحراسة الجديدة تعمل قبل فحص الموظف وقبل تحليل body.

### الاختبار C: صيغ Authorization غير المقبولة

لا تستخدم رمزًا حقيقيًا في هذه الحالات:

```bash
for auth in \
  'Basic deliberately-invalid' \
  'bearer deliberately-invalid' \
  'Bearer ' \
  'Basic'; do
  printf '\nTesting Authorization shape: %s\n' "${auth%% *}"
  curl -sS -X POST "$CANVA_URL" \
    -H 'Content-Type: application/json' \
    -H "Authorization: $auth" \
    --data '{"mode":"status"}' \
    -w '\nHTTP %{http_code}\n' | jq .
done
```

المتوقع لكل حالة: HTTP `400` و`AUTH_REQUIRED`. لا تُدخل قيمة Bearer صالحة في هذا الاختبار؛ الغرض هو اختبار شكل الرأس فقط.

### الاختبار D: Bearer شكلي فقط لإثبات تجاوز حراسة الشكل

استخدم قيمة غير حساسة ومصطنعة:

```bash
curl -sS -X POST "$CANVA_URL" \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer deliberately-invalid-test-token' \
  --data '{"mode":"status"}' \
  -w '\nHTTP %{http_code}\n'
```

المتوقع عادة HTTP `401` مع `AUTH_REQUIRED` من `supabase.auth.getUser`، أو `403` إذا وصل الطلب إلى ملف موظف غير مصرح. المهم هنا أن النتيجة **ليست** `400 AUTH_REQUIRED` الخاصة بشكل Authorization؛ وبذلك نثبت أن التنفيذ تجاوز `requireCanvaBearer` ووصل إلى بوابة الموظف. لا تعتبر هذه الحالة اختبار اتصال ناجحًا بحساب موظف.

### الاختبار E: المسار المصرح به باستخدام جلسة موظف

نفّذ هذا فقط من جلسة آمنة، ولا تطبع قيمة الرمز:

```bash
read -r -s CANVA_ACCESS_TOKEN
printf '\n'
export CANVA_ACCESS_TOKEN

curl -sS -X POST "$CANVA_URL" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $CANVA_ACCESS_TOKEN" \
  --data '{"mode":"status"}' \
  -w '\nHTTP %{http_code}\n' | jq .
unset CANVA_ACCESS_TOKEN
```

المتوقع بعد نجاح مصادقة الموظف:

- HTTP `200`.
- `success: true`.
- `integrationStatus` يساوي `CONNECTED` أو `NOT CONNECTED`.
- إذا كانت أسرار Canva غير مضبوطة، يجب أن يظهر `credentialsConfigured: false` و`NOT CONNECTED`، وليس خطأ مصادقة مبهمًا.

### الاختبار F: body غير صالح بعد المصادقة

باستخدام رمز موظف صالح فقط:

```bash
read -r -s CANVA_ACCESS_TOKEN
printf '\n'
curl -sS -X POST "$CANVA_URL" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $CANVA_ACCESS_TOKEN" \
  --data '{}' \
  -w '\nHTTP %{http_code}\n' | jq .
unset CANVA_ACCESS_TOKEN
```

المتوقع: HTTP `400` مع `{"success":false,"code":"INVALID_INPUT"}`. هذا يثبت ترتيب الحراسة: Authorization ثم الموظف ثم تحليل الإجراء.

## 5. معايير القبول والتوثيق

سجّل فقط القيم غير الحساسة التالية:

- وقت الاختبار والبيئة (`staging` أو `production`).
- commit أو إصدار Edge Function المنشور.
- HTTP status و`code` واسم integration status.
- نتيجة preflight.

لا تسجل:

- `Authorization` header.
- access/refresh token.
- `CANVA_CLIENT_SECRET`.
- body يحتوي على أسرار أو بيانات موظفين.

تُغلق بوابة Canva فقط بعد نجاح الاختبارات B وC وE وF، مع حفظ لقطة JSON منقّحة من النتائج. ولا يُعدّ نجاح الاختبار السلبي سببًا لدمج PR #170 وحده؛ يظل BLK-01 وGATE-04 وGATE-05 مستقلين.
