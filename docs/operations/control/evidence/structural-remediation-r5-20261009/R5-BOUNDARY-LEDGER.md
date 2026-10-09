# R5 — سجل الحدود (Boundary Ledger) — الجرد الكامل قبل أي نقل (2026-10-09)

**الأساس المقيس:** `refactoring/r5-application-boundaries-20261009` @ `55e83ff8` (بعد شريحة المصالحة الإدارية؛ الشجرة = main `58d281ed` + توثيق فقط).
**المصدر:** جردان مستقلان قراءة-فقط (وكيلان بلا كتابة) + تحقق المنفذ — كل رقم بمرجع file:line من الشجرة الحية.
**القاعدة:** لا نقل يبدأ قبل وجود البطاقة والجرد (أمر الموجة Phase 1). هذا الملف هو المرجع الواحد لأرقام R5 — لا تقارير منافسة.

---

## §1 — مراجعة الأبواب الـ29 (كل باب: مستهلكوه الإنتاجيون وأضيقيته)

المستهلكون الإنتاجيون = مواقع استيراد ساكنة/ديناميكية للباب `@/application/<house>` خارج اختبارات وخارج البيت نفسه. **صفر أبواب بلا مستهلك إنتاج** (تحقق مباشر). «أضيق من البيت» = سطح الباب المسجل (قيم+أنواع) أصغر من طاقم ملفات البيت المصدّرة — يثبت ميكانيكيًا بتثبيت S2 (أسطح مسماة صريحة فقط؛ `export *` ممنوع في الأبواب).

| الباب | مستهلكون إنتاجيون (مجاميع) | ملاحظة الحصر |
|---|---|---|
| time | 41 موقعًا (29 صفحة + 11 مكونًا + catalogPresentation) | أول قيمة فيه `todayInAmman` (R2/M-11) |
| finance | 31 (جذر تركيب 11 + 14 صفحة + 5 مكونات + catalogPresentation) | يوسّط RecurringExpenseService عبر شيمة ADR-013 (FD-4) |
| inventory | 13 | — |
| input | 12 | — |
| cash | 11 | — |
| loans | 8 + 3 ديناميكية | بناء كسول FIN-002 عبر الباب نفسه |
| owner-money | 8 | — |
| financial-records | 7 | — |
| agreements | 6 | — |
| diagnostics | 5 (منها pwa/register.ts ×2) | — |
| fulfillment | 5 | — |
| scheduling | 4 + موضع نوعي واحد (الباب — معفى) | — |
| share | 4 | — |
| drafts | 4 | — |
| transfers | 4 | — |
| catalog | 3 | — |
| collections | 3 | — |
| preferences | 3 | — |
| suppliers | 3 | — |
| security | 2 | — |
| budgets | 2 (نوعيان) + بعد S1: مواقع Finance.tsx الأربعة تتحول إليه + ExpenseBudgetsSectionBody الديناميكي | الباب الكنوني لخدمة الميزانيات |
| assets | 2 | — |
| parties | 1 | — |
| activity | 1 | — |
| financial-pulse | 1 | — |
| follow-up | 1 | — |
| home | 1 | — |
| cost | 1 | — |
| estimates | 1 | — |

**حقائق هيكلية مقيسة:** لا يوجد أي استيراد لباب من داخل `application/` نفسها (إنتاجًا أو اختبارًا) — الاستهلاك الداخلي بين البيوت عميق أو عبر ملفات جذر التطبيق (`resultCodes.ts`) بحكم التصميم (`applicationInteriorOf` يعفي ملفات الجذر)؛ `MicroRouter`/`StartupGate` صفر استيرادات تطبيق؛ `contexts/`/`lib/`/`storage/` صفر استيرادات أبواب إنتاجية.

## §2 — البيوت الثمانية بلا باب (التصريف)

| البيت | ملفاته | مستهلكوه الإنتاجيون | التصريف | المالك/محفز المراجعة |
|---|---|---|---|---|
| identity | buildIdentity.ts | application/diagnostics + application/transfers (داخلي تطبيقي فقط) | لا باب — قاعدة STR-615 السياقية | successor؛ محفز: ظهور مستهلك واجهة |
| direct-sales | directSaleService.ts | جذر التركيب (قيمة) + application/collections (نوع) | لا باب — استثناء جذر التركيب الموثق + داخلي | successor؛ محفز: مستهلك واجهة |
| financial-analysis | financialAnalysisService.ts | جذر التركيب (قيمة) + application/finance/projectFinancialInsights (قيمتا orderInputs/expenseInputs) | لا باب — استثناء جذر التركيب + داخلي | successor؛ محفز: مستهلك واجهة |
| recurring | recurringExpenseService.ts | شيمة finance/recurringExpenseService وحدها (والتي يمر عبرها جذر التركيب وباب finance) | لا باب — الوسيط الموثق ADR-013 عنقود 2 | successor؛ محفز: تقاعد الشيمة |
| formatting | formatters.ts | 14 بيتًا تطبيقيًا + واجهة العرض التوافقية | لا باب موازٍ — قرار ADR-011 §2 (واجهة العرض هي السطح؛ باب ثانٍ = مسار منافس) | مالك المنتج؛ محفز: موجة UI (ترحيل مستهلكي الواجهة) |
| g5 | g5Service.ts (شيمة 11 سطرًا) | 3 ملفات واجهة (نوعي فقط: G5Decision/ShortCashHorizonReading/G5LinkOptions/G5Service) | لا باب — الشيمة أضيق من أي باب (اسم تاريخي مجمّد) | مالك المنتج؛ محفز: موجة UI (مسار T) |
| owner | ownerProfileService.ts | جذر التركيب وحده | لا باب — استثناء جذر التركيب | successor؛ محفز: مستهلك واجهة |
| profile | profileService.ts | جذر التركيب وحده | لا باب — استثناء جذر التركيب | successor؛ محفز: مستهلك واجهة |

## §3 — ترتيب الاستيرادات العميقة (المصفوفة الكاملة)

### §3.1 عميق داخل المجال من خارجه (R1 — الأساس 3، ديناميكية كلها)

| الحافة | السبب/المالك | السطح المقيس | محفز المراجعة |
|---|---|---|---|
| finance/integrityCheckSettlementBasis.ts → @micro-domain/craft-order/settlementInvariant.js | D-034 عزل حزمة: تصدير البرميل مُجرَّب ورُفض ببوابة الميزانية (+1,192 خام فوق 650,000) — التحميل عند فحص MIC-18 فقط؛ STR-205/STR-313 | موقع واحد (:23)؛ رمز واحد `settlementInvariantResult` | R6 (مراجعة شطر integrityCheck) أو قرار مالك بفتح المسار الدلالي |
| finance/projectFinancialInsights.ts → @micro-domain/financial-analysis/operatingBreakEven.js | D-034 نفسه — خارج حزمة الدخول عمدًا؛ انتقلت حرفيًا مع القراءة (Wave F) | موقع واحد (:140)؛ رمز واحد `composeOperatingBreakEven` | R6 |
| financial-analysis/financialAnalysisService.ts → …/operatingBreakEven.js | D-034 نفسه | موقع واحد (:403)؛ رمز واحد | R6 |

**قرار R5 (FD-5/الخطة):** الثلاثة `PRESERVE_BY_DESIGN` — خيار «البرميل» مُختبر ومرفوض بالقياس، وخيار «نقل الملكية» يفتح المسار الدلالي المستقل (سجل الملكية §6/3 — قرار مالك)، والاستثناء مقيس ومحروس. لا استيراد عميق آخر داخل المجال من خارجه في الشجرة (تحقق مسح كامل).

### §3.2 واجهة → دواخل بيوت التطبيق (R6 — الأساس 43 مفتاحًا قبل R5؛ **42 بعد S1**)

- **36 مفتاح جذر التركيب** (`PrototypeServicesContext.tsx`): استثناء موثق بتصميم DI (ترويسات الأبواب نفسها تسجله). محفز المراجعة: أي باب يصبح موصولًا في السياق.
- **3 مفاتيح شيمة g5** (Finance.tsx:33؛ G5DeclarationEditor.tsx:11؛ G5DecisionPanel.tsx:4-5 **+:54 بعد إصلاح S1 — المفتاح نفسه**): نوعية فقط؛ شيمة الاسم التاريخي المجمدة. محفز: موجة UI.
- **3 مفاتيح واجهات العرض** (activityLabels/formatters/orderAgreementPresentation — إعادة تصدير ADR-011): محفز: ترحيل مستهلكي الواجهة (موجة UI).
- **المفتاح المهاجر في S1:** `ExpenseBudgetsSectionBody → finance/expenseBudgetService` — الباب الكنوني `@/application/budgets` يصدّر القيمة نفسها؛ الهجرة تُزيل المفتاح (43→42) ومواقع Finance.tsx النوعية الأربعة تتحول للباب قبل أن تدخل الأساس أصلًا.
- **مواقع «الأسطح» مقابل «المسار»:** ماسح S1 يحصي المواضع النوعية؛ الباب معفى بالتصميم (loans/scheduling مواقعها الديناميكية والنوعية على الأبواب — خارج الحد).

## §4 — شيمات التوافق (11 صفًا — التصريف الكامل)

| # | الشيمة | محتواها | المستهلكون (قياس حي) | التصريف | محفز الإزالة |
|---|---|---|---|---|---|
| 1 | application/finance/expenseBudgetService.ts | إعادة تصدير حرفية من budgets/ | إنتاج: ExpenseBudgetsSectionBody:78 (ديناميكي) + Finance.tsx:155–159 (نوعي) — **كلاهما يهاجر في S1** | بعد S1: صفر مستهلك إنتاج (اختبارات DOM فقط) | موجة UI (ترحيل مستهلكي الاختبار المجمدة) |
| 2 | application/finance/correctionHistoryService.ts | إعادة تصدير من financial-records/ | صفر إنتاج؛ 15 ملف اختبار | حية (اختبارات مجمّدة) | موجة UI |
| 3 | application/finance/expenseCategorySuggestions.ts | إعادة تصدير من financial-records/ | **صفر من أي نوع** | ميتة — المحفز اشتعل ومسجل (R1/TG-02)؛ الإزالة بقرار مالك في R7/مسار T (ممنوعة بنص §3 من أمر R5) | قرار مالك (R7/T) |
| 4 | application/finance/expenseRecordIntent.ts | إعادة تصدير من financial-records/ | **صفر من أي نوع** | ميتة — كما فوق | قرار مالك (R7/T) |
| 5 | application/finance/ownerEntitlementService.ts | إعادة تصدير من owner-money/ | صفر إنتاج؛ 17 ملف اختبار | حية (اختبارات مجمّدة)؛ **تحقق FD-الخطة: صفر مستهلك إنتاج لمسار الشيمة — Owner Money في بيته الكنوني (عقد 40 §2)** | موجة UI |
| 6 | application/finance/recurringExpenseService.ts | إعادة تصدير من recurring/ (ADR-013 عنقود 2) | إنتاج واحد: جذر التركيب:216 (ديناميكي عبر الشيمة) + باب finance يوسّط عبرها + اختباران | حية بالتصميم الموثق | تقاعد الشيمة (قرار مالك لاحق) |
| 7 | application/finance/retainedDepositService.ts | إعادة تصدير من financial-records/ | صفر إنتاج؛ 19 ملف اختبار | حية (اختبارات مجمّدة) | موجة UI |
| 8 | application/g5/g5Service.ts | إعادة تصدير من financial-analysis/ + مرادف الاسم التاريخي | إنتاج: 3 ملفات واجهة نوعية فقط؛ اختبارات: 15 ملفًا | حية (نوعية؛ مجمّدة حتى موجة UI — جرد الملفات §343) | موجة UI (مسار T) |
| 9 | presentation/formatters.ts | `export *` من application/formatting | **72 موقعًا** عبر pages/components | واجهة ADR-011 §2 — السطح القانوني للواجهة حتى ترحيلها | موجة UI |
| 10 | presentation/orderAgreementPresentation.ts | `export *` من application/agreements | 4 مواقع إنتاج | كما فوق | موجة UI |
| 11 | presentation/activityLabels.ts | `export *` من application/activity | موقع إنتاج واحد (FinanceActivity:22–25) | كما فوق | موجة UI |

**القاعدة الحاكمة:** لا حذف أي شيمة في R5 (§3 من الأمر). كل صف بمالك ومحفز — لا تأجيل بلا مالك.

## §5 — جرد القارئ/الكاتب (العائلات الخمس — 61 ملفًا غير اختباري)

**الطواقم:** 7 شيمات إعادة تصدير (§4) · ~10 وحدات نقية (dueDateAging، periodPresets، shortCashHorizon، statementMarkdownService، withdrawalWalletGuard، expenseCategorySuggestions، expenseRecordIntent + وحدات transfers النقية الست) · **25 قارئًا خالصًا** (عائلة PFS القرائية الثلاثة + statementService + periodComparisonService + profitToCashBridgeService + ملفات فحص السلامة العشرة + dueDatesService + upcomingService + correctionHistoryService) · **7 كتّاب محروسة** (projectFinancialEventWrites، recurringWorkService، ownerEntitlementService، retainedDepositService، expenseBudgetService، localTransferService، guidedOpeningImportService) · **منسّق واحد** (projectFinancialService — 167 سطرًا، كل طريقة سطر تفويض واحد).

**حقائق مسار الكتابة (PA-1 — تحقق):** لكل حقيقة كاتب أوحد كنوني — سياسات/سجلات/حركات المالك: `owner-money/ownerEntitlementService` وحده؛ الميزانيات: `budgets/expenseBudgetService` وحده؛ أحداث الفترة: `finance/projectFinancialEventWrites` (عبر المنسّق) وحده؛ سجل التصحيحات: لا كاتب (قارئ خالص — الكتابة عند مالكي العائلات)؛ الودائع المحتجزة: `financial-records/retainedDepositService` وحده؛ استبدال اللقطة: خدمتا النقل وحدهما (`replaceSnapshot` — أقوى كاتب، خلف بوابة تحقق ونسخة متحققة EXE-014). **صفر كتابات عبر شيمات** (الشيمات إعادة تصدير بلا منطق).

**هوية الأخطاء والقدم:** `storage_stale` تظهر صريحة في نتائج الميزانيات وحدها؛ finance/owner-money/financial-records/transfers تطويها في `storage_error` (مقيس بمرجع السطر في الجرد الأصلي — يوثق كما هو؛ توحيدها قرار دلالي خارج R5). القناة `BroadcastChannel("micro-data-changed")` مملوكة موضعًا واحدًا (جذر التركيب:162–182) — صفر بث من الخدمات (PA-2 يتحقق).

**اختبارات:** لكل خدمة جوهرية اختبار مباشر (جرد كامل في الجرد الأصلي)؛ الشيمات بلا اختبارات مباشرة عمدًا (البيوت الكنونية تحملها)؛ أشقاء PFS مغطون عبر منسّقها (المسار الموثق Wave F).

## §6 — مصفوفة STR-302 (ملكية القواعد المالية — قرار موثق بلا نقل)

| القاعدة | مالكها الحالي (كنوني) | قرار R5 |
|---|---|---|
| settlement arithmetic (settlementInvariant) | `src/domain/craft-order/settlementInvariant.ts` (المجال) | تبقى — لا نقل؛ المسار الدلالي المستقل (سجل الملكية §6/3) لا يفتح إلا بقرار مالك بمدى exact |
| Withdrawal Coverage | `src/domain/owner-safe-withdrawal` (المجال) + `application/owner-money/withdrawalWalletGuard.ts` (دالة نقية للحارسين) | تبقى — كلا الطبقتين في مالكها؛ الحارس النقي مستهلك من مساري الكتابة |
| derivePeriodCogs | `application/finance/projectFinancialPeriodReads.ts` (التطبيق — قرار W2-D/D-034 المؤرخ) | تبقى — نقلها للمجال مسار دلالي مستقل بقرار مالك |

**قاعدة الحظر (الخطة):** لا نقل لأي منها «لمجرد الفصل الاسمي» — التحقق أعلاه يثبت عدم حدوث أي نقل صامت (domain diff فارغ عبر البرامج — R0).

## §7 — جرد عقود PC-4 (قبل S4)

عقد PC-4 الكامل موجود وحده في `projectFinancialService.ts:24–30` (المدخلات/الاشتقاق/الإبطال/القدم)؛ أقرب نظير: العقد السداسي لـ`budgets/expenseBudgetService.ts:9–37`. الوعود القرائية الجزئية (بلا الرباعية): statementService، integrityCheckService، dueDatesService، upcomingService، periodComparisonService، profitToCashBridgeService، correctionHistoryService. **بلا أي عقد:** ownerEntitlementService (قراءة)، retainedDepositService، أشقاء PFS الثلاثة (ملاحظات نقل فقط). S4 يسدّ هذه الفجوة بترويسات صادقة مقيسة؛ الحقيقة (لا تُخفى): أشقاء PFS تشارك عقد منسّقها بالتفويض — الترويسة توجه إليه وتستكمل الرباعية.

---

## حصر الجرد

هذا السجل يغطي أسطح R5 كلها: 37 بيتًا (29 بباب + 8 بلا) · أساس R1 (3) + R6 (43→42 بعد S1) · 11 شيمة · 61 ملف عائلات القارئ/الكاتب · 3 قواعد STR-302. أي موقع جديد يكتشف أثناء التنفيذ يُسجل هنا ببطاقة قبل لمسه.
