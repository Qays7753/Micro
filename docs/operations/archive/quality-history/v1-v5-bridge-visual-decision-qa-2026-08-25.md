# QA نهائي لبرنامج إصلاح القرار البصري V1–V5

## حالة الجولة

هذه الجولة تحقق Agent داخل Bridge النهائي `80db2ad20f7456d5124df45559a1219c846ba13a` بعد دمج PR #93. بدأت المقارنة من `origin/main` عند `a1cd56fae238dff8ffde7a7aac51efed72a66c55`، ولم تُنفذ كتابة على `main`. الرابط المحلي كان `http://127.0.0.1:3000` عبر Vite، في Chromium داخل sandbox، واتجاه العرض عربي RTL. كل البيانات التي ظهرت في الجولة اصطناعية ومحلية فقط.

نجحت فحوص `pnpm check` و`pnpm prototype:check` و`pnpm prototype:test` و`pnpm prototype:build`، كما نجح `git diff --check origin/main...HEAD`. أُعيد بناء PWA محليًا وولّد البناء manifest وService Worker، لكن ذلك لا يثبت قبول جهاز فعلي أو Offline أو Cloudflare Pages Production.

## المسارات والحالات التي اختُبرت

| المسار أو الحالة | النتيجة | الدليل |
| --- | --- | --- |
| `/settings` في Light وRTL | `PASS — Agent`؛ ظهر القرار المحلي، ثم `احمِ بياناتك` والتصدير/الاستيراد قبل التفضيل الاختياري، وصف المظهر يذكر الوضع الحالي والفعل التالي | `/home/ubuntu/micro_audit_work/final-qa-screenshots/settings-light-rtl.webp` |
| `/settings` في Dark وRTL | `PASS — Agent`؛ بقي النص مقروءًا، وتحوّل الاختصار إلى `تفعيل المظهر الفاتح` والزر إلى `التبديل إلى الفاتح` | `/home/ubuntu/micro_audit_work/final-qa-screenshots/settings-dark-rtl.webp` |
| `/orders/new` ومسودة تصميم | `PASS — Agent`؛ الاسم `مسودة تصميم`، ثم Draft فعلي محلي، وعبارات الأرقام `0–9` | `/home/ubuntu/micro_audit_work/final-qa-screenshots/draft-unsaved-guard-dark-rtl.webp` (يوثق شاشة Draft والحارس؛ لقطتا New Draft الخام أزيلتا بعد الجولة) |
| رجوع Draft مع تعديل غير محفوظ | `PASS — Agent`؛ ظهر الحارس القائم بخيارات احفظ واستمر/اخرج دون حفظ/إلغاء، من دون حفظ صامت | `/home/ubuntu/micro_audit_work/final-qa-screenshots/draft-unsaved-guard-dark-rtl.webp` |
| الحفظ الصريح ثم الخروج إلى Orders | `PASS — Agent`؛ حفظ الخيار الصريح المسودة وظهر الصف كزر واحد قابل للتركيز | `/home/ubuntu/micro_audit_work/final-qa-screenshots/orders-after-explicit-save-dark-rtl.webp` |
| direct route لمسودة غير موجودة | `PASS — Agent`؛ رسالة عدم العثور قالت إن السجل لم يُحفظ أو أُزيل محليًا وقدمت رجوعًا حقيقيًا | `/home/ubuntu/micro_audit_work/final-qa-screenshots/draft-missing-route-dark-rtl.webp` |
| `/schedule` في حالة تشغيلية فارغة | `PASS — Agent`؛ القرار وCTA ظهرا قبل الشهر، و`بدء طلب` ظهر فقط مع غياب الالتزامات التشغيلية، ثم ظهرت قراءة الشهر والتكرار والسعة في الأسفل | `/home/ubuntu/micro_audit_work/final-qa-screenshots/schedule-empty-final-dark-rtl.webp` (اللقطة الأولى الخام أزيلت بعد الجولة) |
| Orders row markup وkeyboard | `PASS — Agent`؛ الفحص النصي أثبت أن كل صف زر واحد بلا anchor/button متداخل، ولم يُجرَ تعديل تجميلي | `Orders.tsx` ولقطة Orders |
| Cost/Agreement والبدائل الرقمية الظاهرة | `PASS — Agent`؛ استُبدلت الصياغة التقنية الظاهرة بأرقام `0–9` مع إبقاء ASCII/validation | ملفات الصفحات في PR #93 |
| Suppliers/Catalog/Agreement copy | `PASS — Agent`؛ اختُصر التكرار، وأضيف `لماذا؟` في Catalog مع بقاء حدود المال والمعرفة | ملفات الصفحات في PR #93 |

## أبعاد العرض والمظهر

حقق Chromium معاينة هاتفية داخل shell بعرض تطبيقي أقصى يقارب 430px، مع لقطات 960×800 viewport للمسارات التي احتاجت ذلك. تم فحص Light وDark وRTL. لم تسمح بيئة المتصفح الحالية بإعادة تشغيل مستقلة موثقة عند 360×800 و390×844 و430×932 لكل مسار؛ لذلك لا أرفع هذه الأبعاد إلى `PASS — Owner`. يجب على المالك إعادة اختبار القص والتمرير وموضع CTA وBottomNav على الأبعاد الثلاثة في G15.

## المصفوفة التي بقيت للمالك

| الاختبار | النتيجة الحالية | سبب عدم الرفع إلى قبول نهائي |
| --- | --- | --- |
| Android/iOS وفتح الرابط المنشور | `ينتظر المالك` | لم يُستخدم جهاز فعلي أو Pages Production في هذه الجولة |
| تثبيت standalone وsafe area وupdate | `ينتظر المالك` | لا يثبتها Chromium sandbox |
| Offline reload وdirect route بلا شبكة | `ينتظر المالك` | لم تُنفذ جولة انقطاع الشبكة على هاتف؛ Service Worker وحده لا يكفي |
| Files/Downloads وتصدير-استيراد على الهاتف | `ينتظر المالك` | لم تُختبر واجهات Files الأصلية |
| لوحة مفاتيح عربية/إنجليزية والمؤشر وnative date | `PARTIAL` | تم فحص markup والنص في Chromium، لا لوحة مفاتيح هاتف أو native picker فعلي |
| Tab/focus/back/touch على جهاز | `PARTIAL` | تحقق guard وmarkup في Chromium؛ touch وsafe area والأداء الحقيقي للمالك |
| الأداء على شبكة وهاتف حقيقي | `ينتظر المالك` | لا قياس أداء ميداني |
| Pilot G16 لمدة 30 يومًا | `خارج النطاق` | لم يبدأ Pilot، ولم تُجمع بيانات مستخدمين أو مالية حقيقية |

## تنظيف الجولة

اكتمل تنظيف الجولة بعد QA. أزال المتصفح قاعدة IndexedDB `micro-prototype-local`، ولم تكن هناك Cache Storage أو Service Workers مسجلة وقت التنظيف، ومُسحت مفاتيح `localStorage` و`sessionStorage`. حُذفت اللقطات والنصوص الخام من مجلدي المتصفح، وحُذفت ملاحظات QA وملف وصف PR المؤقتان؛ أُبقيت ست لقطات منتقاة فقط خارج المستودع في `/home/ubuntu/micro_audit_work/final-qa-screenshots/`. لم تُستخدم بيانات حقيقية.

## سجل التنظيف

| الأثر | النتيجة | الدليل |
| --- | --- | --- |
| IndexedDB | `PASS — Agent` | حُذفت قاعدة `micro-prototype-local` عبر Console قبل التسليم |
| Cache Storage | `PASS — Agent` | قائمة Cache الفعلية كانت فارغة، ثم أُعيد التحقق من عدم وجود لقطات خام |
| `localStorage` و`sessionStorage` | `PASS — Agent` | القائمتان أصبحتا فارغتين بعد `clear()` |
| Service Workers | `PASS — Agent` | عدد التسجيلات كان صفرًا، ولم يبق تسجيل محلي |
| ملفات QA المؤقتة | `PASS — Agent` | أُزيلت ملفات page-texts واللقطات الخام وملاحظات V5؛ بقيت اللقطات المنتقاة خارج Git فقط |

## قرار QA

النتيجة هي **PASS — Agent للعرض والسلوك المحدودين داخل Chromium المحلي**، مع `PARTIAL/ينتظر المالك` لكل شرط G15 الذي يحتاج Android أو iOS أو standalone أو Offline أو Files أو لوحة مفاتيح/لمس/أداء فعلي، و`خارج النطاق` لـPilot G16. لا يغيّر هذا الحكم العقود المالية أو يجعل الكاش ربحًا أو النقص صفرًا، ولا يقرر دمج `main`.
