# P-4.4-2 — جرد طبقة تنسيق العرض (Presentation Format Inventory)

التاريخ: 2026-09-18 · الفرع: `feat/wave-4-4-2-formatters` · النطاق: `apps/prototype-web/client/src`

## 1. المبدأ

مصدر واحد لكل تنسيق عرض: التاريخ والوقت والمنطقة الزمنية والمبالغ تخرج كلها من
`presentation/formatters.ts` (+ مكوّنات `DisplayValue.tsx` للعزل الاتجاهي). لا ينشئ
أي مكوّن منسّقًا محليًا موازيًا، ولا يمرر أي مسار عرض قيمة مخزنة عبر تحويل يغيرها.

الجرد أدناه يغطي كل أنماط التنسيق المطلوب جرّها في مواصفة الحزمة: `Date`،
`Intl.DateTimeFormat`، `toLocaleDateString`، `toLocaleString`، تقسيم سلاسل ISO،
منسّقات المبالغ، `Intl.NumberFormat`، `.toFixed`، ضمّ العملة، التقريب على مبالغ
العرض، وحقول الإدخال المالية.

## 2. مصفوفة الجرد — التاريخ والوقت والمنطقة الزمنية

| الاستخدام | الملف | النوع | المنسق قبل 4.4 | المنسق بعد 4.4 | ملاحظة |
| --- | --- | --- | --- | --- | --- |
| لحظة كاملة (حدث/نسخة احتياطية/تشغيل فحص) | `presentation/formatters.ts` → `formatLocalDateTime` | Intl.DateTimeFormat | ثابت `Asia/Amman`، 24 ساعة، `DD/MM/YYYY HH:MM` | توقيت الجهاز (معامل `timeZone` اختياري للاختبارات الحتمية فقط)، 12 ساعة بص/م وفاصلة عربية: `16/09/2026، 03:30 م` | عقد الموجة: لا منطقة مثبتة في العرض؛ التخزين UTC الكنوني لا يتغير |
| Date-only الكنوني `YYYY-MM-DD` | `formatters.ts` → `formatLocalDate` | تقسيم ISO + تحقق المجال | `DD/MM/YYYY` | كما هو — بلا أي تحويل منطقة زمنية | التاريخ التجاري ليس لحظة؛ لا انزياح يوم |
| الوقت المستقل `HH:MM` (24) | `formatters.ts` → `formatTime` | تمرير حرفي | `HH:MM` كما خُزن | تحويل عرض إلى 12 ساعة: `03:30 م` | التخزين يبقى `HH:MM` بنظام 24 |
| تسمية الشهر | `formatters.ts` → `formatMonthLabel` | قصّ نص | `MM/YYYY` | كما هو | أرقام فقط (المجموعة ٦ بند ٥) |
| مكوّن قيمة لحظة كاملة | `components/presentation/DisplayValue.tsx` → `DateTimeValue` | تغليف | `<bdi dir="ltr">` | `<bdi>` (auto) — النص عربي مختلط | حسم العزل الاتجاهي بحسب أول حرف قوي |
| مكوّن وقت مستقل | `DisplayValue.tsx` → `TimeValue` | تغليف | `<bdi dir="ltr">` + تمرير 24 ساعة | `<bdi>` (auto) + 12 ساعة بص/م | كما فوق |
| مكوّن تاريخ | `DisplayValue.tsx` → `LocalDateValue` | تغليف | `<bdi dir="ltr">` | كما هو | أرقام صرفة — العزل LTR يبقى صحيحًا |
| حقل تاريخ للقراءة | `components/forms/LocalDateField.tsx` | `formatLocalDate` | قراءة `DD/MM/YYYY` بجدار LTR + إدخال ISO بلغة إنجليزية | كما هو — يستهلك المصدر الموحد | لا تغيير |
| تاريخ أعمال من لحظة | `formatters.ts` → `businessDateFromTimestamp` (جديد) | قصّ UTC مباشر في 14 موقعًا | `x.slice(0, 10)` في المواضع أدناه | `ammanDateOrNull(x)` — عقد المجموعة ٩ | كانت المواضع تزيح اليوم بعد 21:00Z |
| ↳ عرض «حُفظ في» | `pages/EstimateDetail.tsx:129` | قصّ UTC | `createdAt.slice(0,10)` | `businessDateFromTimestamp` | إصلاح انزياح اليوم |
| ↳ عرض تاريخ التقدير | `pages/Tools.tsx:155` | قصّ UTC | `updatedAt.slice(0,10)` | `businessDateFromTimestamp` | كذلك |
| ↳ سطر النشاط المالي | `pages/FinanceActivity.tsx:110` | قصّ UTC (احتياطي) | `recordedAt.slice(0,10)` | `businessDateFromTimestamp` | كذلك |
| ↳ طبقة التصحيحات | `components/finance/CorrectionsLayer.tsx:82,84` | قصّ UTC | `recordedAt.slice(0,10)` | `businessDateFromTimestamp` | كذلك |
| ↳ أسماء ملفات النسخ | `pages/Settings.tsx:318,362,509` | قصّ UTC | `exportedAt.slice(0,10)` | `businessDateFromTimestamp` | اتساق اسم الملف مع تاريخ الأعمال المعروض |
| ↳ قراءة دفتر التحصيل | `application/collections/collectionService.ts:92` | قصّ UTC | `updatedAt.slice(0,10)` | `localDateInAmman` | محاذاة بنمط activityService (مراجعة 5-RV-A) |
| ↳ قراءة دفتر الناس | `application/parties/partyLedgerService.ts:101,111` | قصّ UTC | `updatedAt.slice(0,10)` | `localDateInAmman` | كذلك |
| ↳ قراءة مركز الرئيسية | `application/home/homeControlCenterService.ts:241,437` | قصّ UTC | `slice(0,10)` | `localDateInAmman` | كذلك |
| ↳ قراءة سلامة الحسابات | `application/finance/integrityCheckService.ts:232,243` | قصّ UTC | `slice(0,10)` | `ammanDate()` | كذلك |
| ↳ قراءة سجل التصحيحات | `application/finance/correctionHistoryService.ts:308` | قصّ UTC | `slice(0,10)` | `ammanDateOrNull ?? احتياطي` | كذلك |
| ↳ نافذة إدارة المخزون | `application/finance/projectFinancialService.ts:589` | قصّ UTC | `slice(0,10)` | `ammanDateOrNull` | كذلك |
| ↳ أدلة مواد المخزون | `application/inventory/inventoryMaterialService.ts:332` | قصّ UTC | `slice(0,10)` | `localDateInAmman` | كذلك |
| ↳ تاريخ «حتى» الإهلاك | `application/assets/assetService.ts:123,177` | قصّ UTC | `now().slice(0,10)` | `localDateInAmman(now())` | كذلك — قراءة فقط، الإهلاك المسجل حدث صريح |
| حساب نهاية الشهر (قراءة) | `pages/Statement.tsx`, `pages/Finance.tsx`, `pages/FinanceActivity.tsx`, `presentation/catalogPresentation.ts`, `pages/ScheduleEditor.tsx`, `pages/Schedule.tsx` | `Date.UTC` بمرساة منتصف النهار | حساب تاريخ كنوني `YYYY-MM-DD` | كما هو — حساب لا عرض | الناتج يمر عبر `formatLocalDate` الموحد |
| النشاط (سجل الأثر) | `application/activity/activityService.ts` | `localDateInAmman` | النمط المرجعي المعتمد (مراجعة 5-RV-A) | كما هو | المرجع الذي حُوّلت إليه الانحرافات أعلاه |

## 3. مصفوفة الجرد — المبالغ والعملة

| الاستخدام | الملف | النوع | المنسق قبل 4.4 | المنسق بعد 4.4 | ملاحظة |
| --- | --- | --- | --- | --- | --- |
| مبلغ بمنزلتين | `presentation/formatters.ts` → `formatMoneyMinor` | `Intl.NumberFormat` en-US | `1,234.56` | كما هو | مصدر واحد — 280 نداء عبر 59 ملفًا |
| مبلغ + وحدة | `formatters.ts` → `formatMoneyWithUnit` | ضمّ ` د.أ` | `25.00 د.أ` | كما هو | الوحدة خارج العزل الاتجاهي للرقم (عقد W2) |
| مكوّن رقم مالي | `DisplayValue.tsx` → `MoneyValue` | تغليف | `dir="ltr"` + `data-negative` | كما هو | الإشارة السالبة معزولة ومعلنة بلا لون |
| مكوّن رقم + وحدة | `DisplayValue.tsx` → `MoneyWithUnit` | تغليف | الوحدة `micro-money-unit` | كما هو | تمرير الوحدة إلزامي من المستدعي |
| قيمة كمية (milli) | `formatters.ts` → `formatQuantityMilli`/`formatQuantityMilliFixed3` | بناء نصي صحيح | منزلة الألف | كما هو | قسمة صحيحة/صحيحة — لا شوائب ثنائية |
| عدد صحيح | `formatters.ts` → `formatInteger` | `Intl.NumberFormat` | تجميع آلاف | كما هو | — |
| كسر التعادل | `formatters.ts` → `formatBreakEvenDisplay` | integer + تسمية وحدة | كما هو | كما هو | — |
| إدخال مالي | `application/input/englishNumeric.ts` → `parseEnglishNumberInput` | `.toFixed(2)` عند التحويل العكسي للعرض | مسار إدخال (minor↔major) | كما هو | عقد الإدخال لا العرض؛ التقريب بإزاحة عشرية آمنة |
| إدخال كمية | `components/forms/EnglishQuantityInput.tsx` | `(v/1000).toFixed(3)` | مسار إدخال | كما هو | كذلك |
| جمع عربي | `formatters.ts` → `formatArabicPlural` | قواعد 0/1/2/3-10/11-99/100+ | كما هو | كما هو | — |

**لا يوجد** في طبقة العرض بعد الجرد: `toLocaleDateString`/`toLocaleString`
مباشرة في أي مكوّن، ولا `Math.round` على مبلغ عرض (الاستثناءات الموثقة:
`englishNumeric.ts` لمسار الإدخال بإزاحة آمنة، و`G5DecisionPanel` أزال تقريبًا
دفاعيًا سابقًا)، ولا ضمّ عملة خارج `formatMoneyWithUnit`/`MoneyWithUnit`
(كل `د.أ` في الصفحات إما عبر الوظيفة أو داخل نص وصفي لقيمة واردة منها).

## 4. القيم غير المعروفة — الفصل الصريح

| الحالة | التمثيل | العرض |
| --- | --- | --- |
| صفر حقيقي | `0` (minor) | `0.00 د.أ` |
| غير مسجل/غير معروف | `null` / `undefined` | `—` (لا `0.00` أبدًا) |
| قيمة غير منتهية/فاسدة | `NaN` / `Infinity` | `—` |
| تاريخ ناقص/فاسد | `null` أو نص غير صالح | `null` → المكوّن يعرض `—` |

تثبّته اختبارات `PresentationFormats.w44.dom.test.tsx` («المجهول ليس صفرًا»،
«القيمة الناقصة والفاسدة تعلنان غياب المعرفة»).

## 5. أثر السقوف (§10.1)

محرفا فترة النهار «ص»/«م» المعتمدان في عقد 12 ساعة دخلان عدّ السلاسل الثابتة
لكل سطح يعرض وقتًا (+2 لكل سطح، مثبت بمقارنة المجموعات قبل/بعد على 33 سطحًا —
لا سلاسل أخرى تغيرت). رُفعت السقوف بمقدار +2 موثقًا بتاريخ 2026-09-18
وسبب P-4.4-2 في `scripts/text-density-count.py` لكل سطح متأثر؛ القياس نفسه لم
يُخفف — المحرفان يُعدّان كما كان كل نص آخر.
