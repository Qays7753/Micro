# أدلة الحزمة 6 — P-4.4-6: الجهاز وPWA والأداء والانحدار النهائي

**الفرع:** `feat/wave-4-4-6-device-pwa-regression` · CI أخضر على PR وعلى Merge SHA

## 1. الإصلاحات داخل نطاق الحزمة (عيوب وُجدت بالقياس وأُصلحت)

| العيب | الدليل | الإصلاح |
|---|---|---|
| تمرير أفقي في `/suppliers` بكل المقاسات (111/81/41px عند 360/390/430) | مسح المسح قبل/بعد + `screens/full-suppliers-*.png` | `flex: 0 1 auto` + `min-width: min-content` (تعليق موثق في `index.css`) |
| تمرير أفقي عند 320px في `/cash` (34px) و`/inventory` (9px) | مسح 320 قبل/بعد | درجة نزول `@media (max-width: 340px)`: تكديس عمودي (نمط §1.7) |
| أخطاء React console: `<bdi>` داخل `<option>` (4 مواضع: Schedule 1 + OwnerLedgerFormsSection 3) | `agent-browser console` قبل/بعد — 1 خطأ على /schedule ببيانات حقيقية، 0 بعدها | نص خالص داخل option (نمط CashDistribution الموثق) + حارس مصدر دائم |

## 2. المسح النهائي المعتمد

- **152/152** فحص تمرير أفقي: 19 مسارًا × {320, 360, 390, 430} × {فاتح، ليلي} — صفر.
- 13 مسارًا عميقًا عند 360 — صفر.
- صفر أخطاء صفحة عبر 19 مسارًا (`agent-browser errors`).
- صفر أخطاء console عبر 19 مسارًا بعد الإصلاح.
- axe-core (WCAG 2.0/2.1/2.2 A+AA): **صفر مخالفات** على `/`، `/finance`، `/parties`، `/cash`، `/suppliers`، `/orders`، `/settings`، `/tools/integrity`، `/assets`، `/loans`، `/owner`.

## 3. PWA على بناء الإنتاج

`manifest.webmanifest` مخدوم · SW مسجل `activated` ويسيطر (173 أصلًا، 2338 KiB) · التنقل offline يعمل عبر navigateFallback مع حالة «أنت غير متصل الآن» · التحديث بموافقة صريحة (prompt) · لوحة التثبيت بديل صادق · هوامش أمان `env(safe-area-inset-*)` في الكرومين · `viewport-fit=cover`.

القياس (بناء إنتاج، بيانات كاملة مستوردة):

| الصفحة | FCP | LCP | CLS |
|---|---|---|---|
| الرئيسية | 116ms | 756ms | 0.10 |
| المالية | 144ms | 1092ms | 0.00 |
| دفتر الناس | 156ms | 736ms | 0.00 |

الحزمة: 599,270 raw / 142,301 gzip — ضمن 650,000/155,000.

## 4. رحلات حية موثقة بالجلسة (بيانات اصطناعية كاملة)

بيع نقدي/آجل/صغير · مصروف · طلب بعربون → تنفيذ → تسليم («الإيراد المعترف 960.00 د.أ — مرة واحدة») · إشعار تسليم قابل للتحرير مع سقوط صادق للنسخ عند غياب navigator.share · محفظة ثانية بافتتاح 1500 · تغطية غير الموزع السالب −2,600 («سُجّلت التغطية ✓») · موردان (جزئي الدفع + التزام مستحق 10/09) · استلام مخزون 500 قطعة · مال مالك 2000 · قرض 750 · أصل 1850/60 شهرًا · سلامة 13/13 («قواعد المخطط 35 · التصدير 27») · تصدير ملف مُتحقق 29.9KB · استيراد كامل على أصل الإنتاج عبر بوابة رمز القفل (تفعيل → تأكيد PIN → استبدال → فحص سلامة سليم بعد الاستعادة) · لوحتا «قريبًا» بلوحة مفاتيح حقيقية (Enter/Tab/Escape وإعادة التركيز) · روابط قديمة 6/6 · returnTo وdestinationWalletId · بداية باردة على رابط عميق.

## 5. لقطات الشاشة (`screens/`)

- `empty-{home,finance}-{360,390,430}-light.png` + `empty-home-390-dark.png` — الحالات الفارغة.
- `full-{home,finance,parties,suppliers}-{360,390,430}-light.png` — الحالة الممتلئة بالمقاسات الثلاثة.
- `full-{home,finance,parties,suppliers,cash,integrity}-390-dark.png` — الوضع الليلي.
- `home-360-longname.png` · `finance-390-zoom200.png` — النص الطويل والتكبير.
- `cash-negative-unallocated-390-light.png` — المبلغ السالب قبل المعالجة (رسالة التخصيص الزائد الصادقة).
- `offline-finance-390.png` · `pwa-offline-shell-390.png` · `pwa-install-prompt-390.png` — Offline والتثبيت.
- `prod-imported-home-390.png` — أصل الإنتاج بعد الاستيراد الكامل.
- `device-iphone16-chromium-emu-finance.png` · `device-galaxys25-chromium-emu-parties.png` — بروفيلات الأجهزة.

## 6. ما لم يتوفر

```text
REAL_DEVICE_QA_NOT_PERFORMED
```

WebKit/Safari غير متوفر في البيئة (`playwright webkit` غير مثبت) — موثّق غير مُختبر.
