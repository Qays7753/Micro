# R5 — سجل الحدود (Boundary Ledger) — الجرد الكامل قبل أي نقل (2026-10-09)

**الأساس المقيس:** `refactoring/r5-application-boundaries-20261009` (شجرة الكود = main `58d281ed`).
**المصدر:** جردان مستقلان قراءة-فقط + تحقق المنفذ + تدقيق اللجنة الخماسية (بعد تعديلاتها المؤرخة — النسخة الأولى صُححت بمؤرخاتها: 61→54 ملفًا؛ 25→18 قارئًا؛ 10→9 ملفات فحص سلامة؛ 72→69 موقع واجهة؛ شيمة الميزانيات ميتة بعد S1 لا «مجمّدة اختباريًا»؛ ~10→13 وحدة نقية).
**القاعدة:** لا نقل يبدأ قبل وجود البطاقة والجرد (أمر الموجة Phase 1). هذا الملف هو المرجع الواحد لأرقام R5. المراجع file:line مثبتة للأعداد الحاملة للحراس والأسس؛ ما عداه مجاميع قابلة لإعادة الإنتاج بأوامر الجرد الموثقة في تقرير التنفيذ.

---

## §1 — مراجعة الأبواب الـ29 (كل باب: مستهلكوه الإنتاجيون)

المستهلكون الإنتاجيون = مواقع استيراد ساكنة/ديناميكية للباب `@/application/<house>` خارج الاختبارات وخارج البيت (تعريف العدّ المعلن). **صفر أبواب بلا مستهلك إنتاج** (تحقق مزدوج مستقل). تثبيت الأسطح (قيمًا وأنواعًا) في S2 يجعل «أضيق من البيت» حتميًا (تصديرات مسماة صريحة فقط؛ `export *` و`export * as ns` ممنوعان في الأبواب — لا أبواب تستخدمهما اليوم).

| الباب | مستهلكون إنتاجيون (مجاميع) | ملاحظة الحصر |
|---|---|---|
| time | 41 موقعًا (29 صفحة + 11 مكونًا + catalogPresentation:18) | أول قيمة فيه `todayInAmman` (R2/M-11) |
| finance | 31 (جذر تركيب 11 + 14 صفحة + 5 مكونات + catalogPresentation:17) | يوسّط RecurringExpenseService عبر شيمة ADR-013 (§4 صف 6) |
| inventory | 13 | — |
| input | 12 | — |
| cash | 11 | — |
| loans | 8 + 3 ديناميكية (Loans:53، ReceivedLoanEditor:82، ReceivedLoanDetail:57) | بناء كسول FIN-002 عبر الباب |
| owner-money | 8 | — |
| financial-records | 7 | — |
| agreements | 6 | — |
| diagnostics | 5 (منها pwa/register.ts:3-4) | — |
| fulfillment | 5 | — |
| scheduling | 4 + موضع نوعي واحد على الباب (Schedule:450 — معفى) | — |
| share | 4 | — |
| drafts | 4 | — |
| transfers | 4 | — |
| catalog | 3 | — |
| collections | 3 | — |
| preferences | 3 | — |
| suppliers | 3 | — |
| security | 2 (AppLockGate:17، LockSettingsCard:9) | — |
| budgets | 2 نوعيان (ExpenseBudgetsSectionBody:9,14) + بعد S1: مواقع Finance.tsx الأربعة + الديناميكي :78 | الباب الكنوني لخدمة الميزانيات |
| assets | 2 | — |
| parties | 1 (Parties:13) | نوعي فقط |
| activity | 1 (FinanceActivity:34) | نوعي فقط |
| financial-pulse | 1 (Finance:23) | نوعي فقط |
| follow-up | 1 (Orders:16) | نوعي فقط |
| home | 1 (Home:39) | نوعي فقط |
| cost | 1 (CostEditor:7) | نوعي فقط |
| estimates | 1 (CostCalculator:18) | نوعي فقط |

**توضيحان مقيسان (من اللجنة):** (1) سبعة أبواب (parties/activity/financial-pulse/follow-up/home/cost/estimates) مستهلكة **نوعيًا فقط** — «صفر أبواب ميتة» صادق بتعريف العدّ المعلن (مواقع استيراد) وليس ادعاء استهلاك قيمة. (2) ستة أبواب تحمل رمز نوع واحد بلا مستهلك بابي (نوع الخدمة في parties:13/activity:13/financial-pulse:13/follow-up:13/cost:13/estimates:13) — تُثبَّت كما هي (تقصيرها تغيير سطح خارج R5) بتعليق في أساس S2.

**حقائق هيكلية مقيسة:** لا استيراد لأي باب من داخل `application/` (إنتاجًا أو اختبارًا)؛ `MicroRouter`/`StartupGate` صفر استيرادات تطبيق؛ `contexts/`/`lib/`/`storage/` صفر استيرادات أبواب إنتاجية؛ ملفات جذر التطبيق الإنتاجية = `resultCodes.ts` وحده (يُثبَّت في S2).

## §2 — البيوت الثمانية بلا باب (التصريف)

| البيت | مستهلكوه الإنتاجيون | التصريف | المالك/محفز المراجعة |
|---|---|---|---|
| identity | application/diagnostics/localDiagnosticsService:22 + application/transfers/localTransferService:3 (داخلي تطبيقي فقط) | لا باب — قاعدة STR-615 السياقية | successor؛ محفز: مستهلك واجهة |
| direct-sales | جذر التركيب:45 (قيمة) + application/collections/collectionService:20 (نوع) | لا باب — استثناء جذر التركيب + داخلي | successor؛ محفز: مستهلك واجهة |
| financial-analysis | جذر التركيب:44 (قيمة) + finance/projectFinancialInsights:13 (قيمتا orderInputs/expenseInputs) + شيمة g5/g5Service:11 تعيد تصديره | لا باب — استثناء جذر التركيب + داخلي | successor؛ محفز: مستهلك واجهة |
| recurring | شيمة finance/recurringExpenseService:12 وحدها (يجتازها جذر التركيب:216 وباب finance:44,48) | لا باب — الوسيط الموثق ADR-013 عنقود 2 | successor؛ محفز: تقاعد الشيمة |
| formatting | 14 بيتًا تطبيقيًا + واجهة العرض presentation/formatters:5 | لا باب موازٍ — قرار ADR-011 §2 (واجهة العرض هي السطح القانوني؛ باب ثانٍ = مسار منافس) | مالك المنتج؛ محفز: موجة UI |
| g5 | 3 ملفات واجهة نوعية فقط (Finance:33، G5DeclarationEditor:11، G5DecisionPanel:4-5 و:54) | لا باب — **شيمة اسم تاريخي مجمّدة نوعية** (`export *` من financialAnalysisService — ليست «أضيق من باب» بل سطح توافق أسماء محفور لموجة UI) | مالك المنتج؛ محفز: موجة UI (مسار T) |
| owner | جذر التركيب:29 وحده | لا باب — استثناء جذر التركيب | successor؛ محفز: مستهلك واجهة |
| profile | جذر التركيب:28 وحده | لا باب — استثناء جذر التركيب | successor؛ محفز: مستهلك واجهة |

## §3 — ترتيب الاستيرادات العميقة (المصفوفة الكاملة)

### §3.1 عميق داخل المجال من خارجه (R1 — الأساس 3، ديناميكية كلها)

| الحافة (file:line) | السبب/المالك | السطح المقيس | محفز المراجعة |
|---|---|---|---|
| finance/integrityCheckSettlementBasis.ts:23 → @micro-domain/craft-order/settlementInvariant.js | D-034 عزل حزمة: تصدير البرميل مُجرَّب ورُفض ببوابة الميزانية **المفروضة** (`RAW_BYTE_LIMIT=650,000` في check-bundle-budget.mjs — المحاولة 650,292/+1,192)؛ STR-205/STR-313 | موقع واحد؛ رمز واحد `settlementInvariantResult` | R6 أو قرار مالك بالمسار الدلالي |
| finance/projectFinancialInsights.ts:140 → …/operatingBreakEven.js | D-034 نفسه — انتقلت حرفيًا مع القراءة (Wave F) | موقع واحد؛ رمز واحد | R6 | *(تصحيح مؤرخ 2026-10-09 — R6-W1 [R6-SCAN-F-007]: السطر الحي **:145** عند `fd92d7e8` — انحراف 5 أسطر من نمو الحميد داخل-الشريط الموثق [F-006]؛ القيد الأصلي أعلاه محفوظ كما كُتب)* |
| financial-analysis/financialAnalysisService.ts:403 → …/operatingBreakEven.js | D-034 نفسه | موقع واحد؛ رمز واحد | R6 |

**قرار R5:** الثلاثة `PRESERVE_BY_DESIGN` (تحقق عدائي مستقل: خيار البرميل مرفوض بقياس مفروض، وخيار نقل الملكية بقرار مالك STR-302). لا استيراد عميق آخر داخل المجال من خارجه في الشجرة.

### §3.2 واجهة → دواخل بيوت التطبيق (R6 — الأساس 43 قبل R5؛ **42 بعد S1**؛ المواقع الحية 47 بعد S1)

- **36 مفتاح جذر التركيب** (`PrototypeServicesContext.tsx`): استثناء DI موثق. محفز: باب يوصل في السياق.
- **3 مفاتيح شيمة g5** (Finance:33؛ G5DeclarationEditor:11؛ G5DecisionPanel:4-5 **+:54 بعد إصلاح S1 — المفتاح نفسه**): نوعية فقط. محفز: موجة UI.
- **3 مفاتيح واجهات العرض** (activityLabels:5، formatters:5، orderAgreementPresentation:5 — إعادة تصدير ADR-011): محفز: ترحيل مستهلكي الواجهة (موجة UI)؛ **بند محفز مسار T:** تثبيت أسطح هذه الواجهات الثلاث (S2 يمنع `export *` في الأبواب — الواجهات تبقى بلا تثبيت حتى موجة UI).
- **المفتاح المهاجر في S1:** `ExpenseBudgetsSectionBody:78 → finance/expenseBudgetService` — الباب الكنوني يصدّر الرموز نفسها؛ 43→42. مواقع Finance.tsx النوعية الأربعة تتحول للباب قبل دخول الأساس.
- **عدّ المواقع بعد S1 = 47** (46 القائمة − موقع ExpenseBudgetsSectionBody المهاجر + موقع G5DecisionPanel:54 المصير معدودًا).

## §4 — شيمات التوافق (11 صفًا — التصريف الكامل)

| # | الشيمة | المستهلكون (قياس حي) | التصريف | محفز الإزالة |
|---|---|---|---|---|
| 1 | application/finance/expenseBudgetService.ts | **قبل S1:** ExpenseBudgetsSectionBody:78 (ديناميكي) + Finance.tsx:155–159 (نوعي) — لا غيرهما من أي نوع (اختبار w174 يصلها عبر الموقع المهاجر نفسه)؛ **بعد S1: صفر من أي نوع** | ميتة بعد S1 — المحفز يشتعل بهجرة S1؛ الإزالة بقرار مالك (R7/مسار T — ممنوعة بنص §3 من أمر R5) | قرار مالك (R7/T) |
| 2 | application/finance/correctionHistoryService.ts | صفر إنتاج؛ 15 ملف اختبار | حية (اختبارات مجمّدة) | موجة UI |
| 3 | application/finance/expenseCategorySuggestions.ts | **صفر من أي نوع** | ميتة — المحفز مسجل (R1/TG-02)؛ الإزالة بقرار مالك | قرار مالك (R7/T) |
| 4 | application/finance/expenseRecordIntent.ts | **صفر من أي نوع** | ميتة — كما فوق | قرار مالك (R7/T) |
| 5 | application/finance/ownerEntitlementService.ts | صفر إنتاج؛ 17 ملف اختبار | حية (اختبارات مجمّدة)؛ **تحقق خطة R5: صفر مستهلك إنتاج لمسار الشيمة — Owner Money في بيته الكنوني (عقد 40 §2)** | موجة UI |
| 6 | application/finance/recurringExpenseService.ts | إنتاج واحد: جذر التركيب:216 (ديناميكي عبرها) + باب finance يوسّط عبرها (:44,48) + اختباران | حية بالتصميم الموثق (ADR-013) | تقاعد الشيمة (قرار مالك) |
| 7 | application/finance/retainedDepositService.ts | صفر إنتاج؛ 19 ملف اختبار | حية (اختبارات مجمّدة) | موجة UI |
| 8 | application/g5/g5Service.ts | إنتاج: 3 ملفات واجهة نوعية؛ اختبارات: 15 ملفًا | حية (نوعية؛ مجمّدة حتى موجة UI) | موجة UI (مسار T) |
| 9 | presentation/formatters.ts | **69 موقعًا** (68 ملف pages/components — قياس اللجنة؛ 3 مواضع اختبار أخرى منفصلة) | واجهة ADR-011 §2 — السطح القانوني حتى ترحيلها | موجة UI |
| 10 | presentation/orderAgreementPresentation.ts | 4 مواقع إنتاج | كما فوق | موجة UI |
| 11 | presentation/activityLabels.ts | موقع إنتاج واحد (FinanceActivity:22–25) | كما فوق | موجة UI |

**القاعدة الحاكمة:** لا حذف أي شيمة في R5 (§3 من الأمر). كل صف بمالك ومحفز.

## §5 — جرد القارئ/الكاتب (العائلات الخمس — 54 ملفًا غير اختباري)

**العدد المقيس (تصحيح مؤرخ — كان 61 بخطأ عدّ الجرد الأول):** finance 33 + owner-money 3 + financial-records 5 + budgets 2 + transfers 11 = **54** (شاملة الأبواب الخمسة والـfixture).

**الطواقم (مجاميع قابلة للإعادة):** 7 شيمات إعادة تصدير (§4) · **13 وحدة نقية** (dueDateAging، periodPresets، shortCashHorizon، statementMarkdownService، withdrawalWalletGuard، expenseCategorySuggestions، expenseRecordIntent + وحدات transfers النقية الست: transferFamilyValidators، transferSnapshotValidation، transferSnapshotMigrations، transferCounters، transferEnvelope، transferCompatibilityValues + domainTransferDriftAnchors بيانات + historical817.fixture) · **18 قارئًا خالصًا** (طاقم S3 المعلن حرفيًا: عائلة PFS القرائية الثلاثة + statementService + periodComparisonService + profitToCashBridgeService + ملفات فحص السلامة التسعة Service/Model/CoreFinance/Inventory/AssetsLoans/Continuity/SupplierWallet/SettlementBasis/OffenderSummaries + dueDatesService + upcomingService + correctionHistoryService الكنوني) · **7 كتّاب محروسة** (projectFinancialEventWrites، recurringWorkService، ownerEntitlementService، retainedDepositService، expenseBudgetService، localTransferService، guidedOpeningImportService) · **منسّق واحد** (projectFinancialService — 167 سطرًا، كل طريقة سطر تفويض).

**حقائق مسار الكتابة (PA-1 — تحقق):** لكل حقيقة كاتب أوحد كنوني — سياسات/سجلات/حركات المالك: `owner-money/ownerEntitlementService` وحده (**بثماني طرق كتابة** — تصحيح مؤرخ: الجرد الأول عدّ سبعًا وفاتته `reverseMovement` :971–1013 التي تكتب عند :1006)؛ الميزانيات: `budgets/expenseBudgetService` وحده؛ أحداث الفترة الحرة: `finance/projectFinancialEventWrites` وحده (`saveFinancialEvent` بمستدعٍ تطبيقي واحد :444) — **صياغة «لكل عائلة أحداث»**: أحداث عائلة الودائع يكتبها `retainedDepositService` ذريًا (:162/:235) والحد مفروض بالكود (`familyCorrectionGuard` :71–82 يرفض أحداث الودائع/الأصول/القروض في المسار العام)؛ سجل التصحيحات: لا كاتب (قارئ خالص)؛ الودائع المحتجزة: retainedDepositService وحده؛ استبدال اللقطة: خدمتا النقل وحدهما (`replaceSnapshot` :239/:309/:369). **صفر كتابات عبر شيمات.**

**هوية الأخطاء والقدم:** `storage_stale` صريحة في نتائج الميزانيات وحدها (expenseBudgetService:74,:234–239)؛ finance/owner-money/financial-records/transfers تطويها في `storage_error` (ownerEntitlement:184–188 يثبّت STORAGE_ERROR دائمًا؛ EventWrites:139,:198,:307,:447 عبر storageFailure؛ retainedDeposit:166,:240؛ localTransfer:240,:310). القناة `BroadcastChannel("micro-data-changed")` مملوكة موضعًا واحدًا (جذر التركيب:162–182) — صفر بث من الخدمات (PA-2).

**اختبارات:** لكل خدمة جوهرية اختبار مباشر؛ الشيمات بلا اختبارات مباشرة عمدًا؛ أشقاء PFS مغطون عبر منسّقها.

## §6 — مصفوفة STR-302 (ملكية القواعد المالية — قرار موثق بلا نقل)

| القاعدة | مالكها الحالي (كنوني — file:line) | قرار R5 |
|---|---|---|
| settlement arithmetic | `src/domain/craft-order/settlementInvariant.ts` | تبقى — لا نقل؛ المسار الدلالي المستقل (سجل الملكية §6/3) بقرار مالك بمدى exact |
| Withdrawal Coverage | `src/domain/owner-safe-withdrawal` + الدالة النقية `evaluateWithdrawalWalletCoverage` في `owner-money/withdrawalWalletGuard.ts:30–62` (مستهلكة من مساري الكتابة: EventWrites:420 وownerEntitlement:889) | تبقى — كلا الطبقتين في مالكها |
| derivePeriodCogs | `finance/projectFinancialPeriodReads.ts:77` (تستخدم :252 — قرار W2-D/D-034 المؤرخ) | تبقى — نقلها للمجال مسار دلالي مستقل |

**قاعدة الحظر (الخطة):** لا نقل «لمجرد الفصل الاسمي» — domain diff فارغ عبر البرامج (R0).

## §7 — جرد عقود PC-4 (قبل S4 — وبعده مكتمل)

قبل S4: العقد الكامل وحده في `projectFinancialService.ts:24–30`؛ أقرب نظير العقد السداسي `budgets/expenseBudgetService.ts:9–37`. الوعود الجزئية: statementService، integrityCheckService، dueDatesService، upcomingService، periodComparisonService، profitToCashBridgeService، correctionHistoryService. بلا عقد: ownerEntitlementService (قراءة)، retainedDepositService، أشقاء PFS الثلاثة. **S4 يسد الفجوة بترويسات الـ12 ملفًا المعددة في البطاقة (شاملة integrityCheckService لمصالحة هذا الجرد) + وسم آلي لآلية S3** — بعد S4 كل سطح قراءة في العائلات الخمس له عقد رباعي موثق.
