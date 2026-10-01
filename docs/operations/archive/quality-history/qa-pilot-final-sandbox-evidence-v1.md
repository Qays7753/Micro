# دليل أدلة QA/Pilot النهائي — sandbox

**الحالة:** `SANDBOX_EVIDENCE_RECORDED / PRODUCTION_AND_PILOT_NOT_VERIFIED`

هذا الملف سجل أدلة محلية اصطناعية، وليس شهادة قبول إنتاج أو جهاز. لا توجد فيه بيانات مالك أو عميل حقيقية، ولا يحول ملاحظة cache إلى إثبات offline.

## 1. بيئة التنفيذ

| الحقل | القيمة |
|---|---|
| المستودع | `Qays7753/Micro` |
| نقطة البداية | `main` بعد دمج C2 عبر `562f62e` |
| بيئة التطبيق | Vite development على `http://localhost:3001`، وbuilt preview على `http://localhost:4173/` |
| المتصفح | Chromium sandbox؛ بعض الفحوص headless |
| البيانات | profile اصطناعي `اختبار QA النهائي`، بلا owner/production data |
| المنطقة | `Asia/Amman` عند فحوص التاريخ المحلية |
| تاريخ السجل | 2026-08-24/25 بحسب سجل الجلسة |

## 2. أدلة PASS في sandbox

| المجال | الدليل المسجل | النتيجة |
|---|---|---|
| المسار الأولي | فتح `/setup`، إنشاء profile اصطناعي، ثم `/orders/new`؛ shell RTL وbottom navigation ظاهران | `PASS_SANDBOX` |
| export | Settings أنشأ `/home/ubuntu/Downloads/micro-local-2026-08-24.json`؛ المانيفست valid JSON وبداخله `format: micro-prototype-local-export`، `version: 11`، `schemaVersion: 20`، profile اصطناعي ومجموعات فارغة | `PASS_SANDBOX` |
| import preview | preview عرض `لم نغير بياناتك بعد` وملخص profile واحد/صفر سجلات، مع إلغاء واستبدال منفصلين | `PASS_UI_PREVIEW` |
| import replace | الضغط على `استبدال البيانات المحلية` أظهر `تم استبدال البيانات المحلية بالملف الذي راجعته.` | `PASS_UI_ROUND_TRIP` مع قيد uploader أدناه |
| Review | في Dark/RTL، أظهر الملخص `صورة الطلبات المسجلة` منفصلًا عن `لا توجد نتيجة طلب بعد` عند غياب الطلبات | `PASS_TRUTH_SURFACE` |
| Finance | في Dark/RTL، فُصل `الكاش المسجل` والذمم والالتزامات؛ الأصفار المعروفة بقيت `0.00` وG5 ظهر `غير متاح` حيث يلزم | `PASS_TRUTH_SURFACE` |
| themes/RTL | Settings وReview وFinance قُرئت في Dark وRTL؛ الفحص المقابل في Light متاح ضمن smoke المحلي | `PASS_SANDBOX` |
| responsive smoke | لقطات headless على `360×900` و`390×900` و`430×900`; لا clipping أفقي ظاهر، وbottom navigation داخل viewport، و430 أعاد ترتيب install card وبقي مقروءًا | `PASS_SMOKE_ONLY` |
| service worker | built preview فعّل service worker تحت `/` مع `controller: true` وWorkbox precache `workbox-precache-v2-http://localhost:4173/` | `OBSERVED` |
| cleanup | بعد الجولة: `databases: []`، `caches: []`، `localStorageLength: 0`، `sessionStorageLength: 0`، `serviceWorkers: 0` | `PASS_SANDBOX_CLEANUP` |

## 3. قيود وأدلة عدم التحقق

| البند | ما حدث فعليًا | القرار |
|---|---|---|
| OS file chooser | محاولتا upload مباشرتان بالـelement index لم تستهدفا input JSON المخفي في browser adapter؛ نجح controlled in-page File event في فتح preview والاستبدال | لا يرفع إلى `PASS_UPLOADER`؛ يسجل كـ`PASS_UI_ROUND_TRIP_WITH_TOOL_LIMIT` ويعاد على جهاز المالك |
| offline shell | بعد تحميلين online في built preview مع profile headless معزول، أوقف الخادم ثم reload؛ ظهرت علامات Chromium `ERR_` ولم يظهر App Shell | **`OFFLINE_SHELL_NOT_VERIFIED`**؛ لا قبول offline |
| 360/390/430 device | القياسات لقطات headless فقط وليست أجهزة حقيقية | لا قبول Android/iOS |
| Android | لم يُستخدم جهاز فعلي أو Chrome/وضع PWA حقيقي | `NOT_TESTED` |
| iOS | لم يُستخدم iPhone/iPad أو Safari | `NOT_TESTED` |
| Cloudflare Pages production | لم يُختبر عنوان إنتاجي حقيقي في هذه الجولة | `NOT_TESTED` |
| install/standalone/update production | لم يُثبت على هدف إنتاجي فعلي ولم يُتحقق من دورة update على جهاز | `PILOT_NEEDED` |
| human Pilot | لم تُشغّل عينة 5–8 مشاريع/30 يومًا | `PILOT_NOT_EXECUTED` |

## 4. اللقطات وسجل التشغيل

أُنشئت اللقطات محليًا في `/tmp/micro-qa-360.png` و`/tmp/micro-qa-390.png` و`/tmp/micro-qa-430.png` وفُحصت بصريًا. لم تُنسخ إلى المستودع لأنّها artifacts مؤقتة غير لازمة للتشغيل. السجل الخام غير المتعقب موجود في `/tmp/micro-final-qa.md` للاحتفاظ التشغيلي، بينما هذا الملف هو السجل المنقح الذي يدخل PR.

أُجريت محاولة offline بخادم preview معزول؛ انتهى الأمر بعودة reload بعلامات `ERR_`. كما أن أي exit code غير صفري ناتج عن tail/log formatting بعد إنشاء اللقطات لا يُفسر كفشل في إنشاء الصور نفسها.

## 5. تنظيف وعدم تلويث المستودع

أزيلت بيانات profile الاصطناعي من جلسة dev `http://localhost:3001` بعد الفحص. أزيلت IndexedDB وCache Storage وlocalStorage وsessionStorage وأُلغي service worker. لا يضاف `apps/prototype-web/client/public/__manus__/version.json` المولد محليًا إلى Git، ولا توجد تغييرات وظيفية مطلوبة لهذه المرحلة.

## 6. معنى النتيجة

النتيجة الحالية تثبت **قابلية القراءة المحلية ومسارات UI المحدودة**، وتثبت أن حدود المعرفة الظاهرة في Review وFinance لا تختلق قيمة مالية في الحالة الفارغة. لا تثبت قابلية الاستعادة دون شبكة، ولا التثبيت/التحديث عبر Android/iOS، ولا fallback على Pages production، ولا القيمة التشغيلية عند 5–8 مشاريع. اعتماد هذه البنود يتطلب تعبئة [بروتوكول القبول اليدوي](final-qa-pilot-acceptance-protocol-v1.md) مع URL وإصدار وجهاز وOS ومتصفح وخطوات وactual وصورة وPASS/FAIL.

## مراجع داخلية

[1]: [`final-qa-pilot-acceptance-protocol-v1.md`](final-qa-pilot-acceptance-protocol-v1.md)
[2]: [`../operations/current-state.md`](../operations/current-state.md)
[3]: [`../../todo.md`](../../todo.md)
