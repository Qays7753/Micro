# Micro — Ownership and Truth Registry

**الإصدار:** v1.0 (seed — 2026-10-03)
**الغرض:** السجل الوحيد لملكية المفاهيم في برنامج التحصين وإعادة الهيكلة. خريطة تنقّل وملكية — **ليس** مصدر سياسة أعمال ثانيًا: يربط إلى المصدر السلطوي ولا يعيد صياغة معادلات أو سياسات مالية أبدًا.
**رأس التأسيس:** `a59eeb1546a7323ecfe720e4ce9a77f178474fb6` (فرع `docs/architecture-refactoring-plan-20261002` فوق main عند `e7688efda3bbae945a258cca92eabce889c7dab4`)
**القواعد:** (1) لكل مفهوم مصدر سلطوي واحد نشط. (2) كل نسخة مشتقة/توافقية/تاريخية تُسجَّل بوصفها كذلك ولا تُعد مصدرًا. (3) الصف يحدَّث داخل نفس PR أي تغيير ملكية. (4) مفهوم بلا مالك = ثغرة تسجَّل لا تُخمَّن.

---

## 1. خريطة ملكية مفاهيم المجال (18 منطقة + صف توزيعات مكمّل = 19 صفًا)

الأعمدة: المفهوم | المصدر السلطوي (سلوكًا) | مالك التنفيذ | مستهلكون رئيسيون | مالك التخزين | مستهلك التصدير/الاستيراد | اختبارات | توثيق | حالة

| المفهوم | المصدر السلطوي | مالك التنفيذ | مستهلكون رئيسيون | مالك التخزين | تصدير/استيراد | اختبارات | توثيق | حالة |
|---|---|---|---|---|---|---|---|---|
| shared (مال/وقت/كمية) | `src/domain/shared/` + عقد المقياس (قرش=1/100، بمنزلتين) | domain/shared | كل مناطق المجال؛ presentation formatters | — (نقي) | عبر القيم في العائلات | `tests/domain/shared.test.ts` | AGENTS §10؛ plan §3 | PRESERVE (Shared Kernel بحكم الواقع) |
| craft-order | عقد 02/10/12 + `src/domain/craft-order/` | domain/craft-order | orders/schedule/collect؛ fulfillment؛ collections؛ integrity؛ transfers | storage (stores orders/schedules) | `craftOrder` family | `tests/domain/craft-order*.test.ts` (7 ملفات) | عقد التنفيذ 02-coverage | PRESERVE — STR-204c عمليات مستقبلية فقط |
| financial-event | عقد 05 + `src/domain/financial-event/` | domain/financial-event | finance؛ cash؛ assets؛ loans؛ recurring-expense؛ transfers | storage (financialEvents) | `financialEvent` family | `tests/domain/financial-event.test.ts` + finance suites | عقد 05 | PRESERVE (محور عنقود السجلات المالية) |
| asset | عقد 43 + `src/domain/asset/` | domain/asset | finance؛ assets pages؛ transfers | storage (assets) | `assetResidual` family | `tests/domain/asset*.test.ts` | عقد 43 | PRESERVE |
| loan | عقد 05 + `src/domain/loan/` | domain/loan | loans pages؛ finance؛ transfers | storage (loans) | `loan` family | `tests/domain/loan.test.ts` | عقد 05 | PRESERVE |
| received-loan | عقد 05 + `src/domain/received-loan/` | domain/received-loan | loans pages؛ finance؛ transfers | storage (receivedLoans) | `receivedLoan` family | `tests/domain/receivedLoan.test.ts` | عقد 05 | PRESERVE |
| recurring-expense | عقد 41 + `src/domain/recurring-expense/` | domain/recurring-expense | finance recurring؛ transfers | storage (3 stores لعقد 41) | `recurringExpense` family | `tests/domain/recurring-expense.test.ts` | عقد 41 | PRESERVE |
| recurring-margin | عقد 12/17 + `src/domain/recurring-margin/` | domain/recurring-margin | finance read models | storage (عبر financial records) | ضمن العائلات | `tests/domain/recurring-margin.test.ts` | عقد 12/17 | PRESERVE |
| budget | عقد 42 + `src/domain/budget/` | domain/budget | finance budgets | storage (expenseBudgets) | `expenseBudget` family | `tests/domain/budget.test.ts` | عقد 42 | PRESERVE |
| cash-continuity | عقد 03 + `src/domain/cash-continuity/` | domain/cash-continuity | cash services؛ finance reads | storage (cashWallets/cashContinuity) | ضمن snapshot | `tests/domain/cash-continuity.test.ts` | عقد 03 | PRESERVE |
| catalog | عقد 15 + `src/domain/catalog/` | domain/catalog | catalog pages؛ craft-order costing | storage (catalog*) | `catalog` family | `tests/domain/catalog.test.ts` | عقد 15 | PRESERVE |
| inventory-material | عقد 06 + `src/domain/inventory-material/` | domain/inventory-material | inventory pages؛ integrity؛ transfers | storage (materials/movements) | ضمن snapshot | `tests/domain/inventory-material.test.ts` | عقد 06 | PRESERVE |
| supplier-purchase | عقد 07 + `src/domain/supplier-purchase/` | domain/supplier-purchase | suppliers pages؛ finance؛ transfers | storage (supplierPurchases) | `supplierPurchase` family | `tests/domain/supplier-purchase*.test.ts` | عقد 07 | PRESERVE |
| direct-sale | عقد 09 + `src/domain/direct-sale/` | domain/direct-sale | direct-sale pages؛ collections؛ finance | storage (directSales) | `directSale` family | `tests/domain/*.test.ts` colocated + root | عقد 09 | PRESERVE |
| owner-entitlement | عقد 13 + `src/domain/owner-entitlement/` | domain/owner-entitlement | finance owner surfaces؛ transfers | storage (ownerEntitlement*) | `ownerEntitlement` family | `tests/owner-entitlement.test.ts` | عقد 13 | PRESERVE — عنقود Owner Money |
| owner-safe-withdrawal | عقد 13/14 + `src/domain/owner-safe-withdrawal/` | domain/owner-safe-withdrawal | Finance.tsx (قيمة STR-304)؛ owner services | storage (عبر owner movements) | ضمن owner families | `tests/domain/owner-safe-withdrawal.test.ts` | عقد 13/14 | PRESERVE |
| actual-time | عقد 16 + `src/domain/actual-time/` | domain/actual-time | time surfaces؛ finance reads | storage (actualTimeRecords) | ضمن snapshot | `tests/domain/actual-time.test.ts` | عقد 16 | PRESERVE |
| g5 (تحليل مالي — اسم حالي تاريخي) | عقد 12/17 + `src/domain/g5/` | domain/g5 | application/g5؛ finance read models؛ integrity | storage (shortCashDeclarations — **سجل مخزّن**) | `shortCashDeclaration` family | `tests/domain/g5.test.ts` + `operatingBreakEven.test.ts` | عقد 12/17 | PRESERVE + إعادة تسمية مسار (Wave 4A)؛ shortCashDeclarations سجل مخزّن لا read model |
| financial-event توزيعات | عقد 14 (توزيع نتيجة الفترة) | domain/financial-event + finance (قراءة فقط) | finance؛ owner؛ transfers | storage (allocations) | ضمن families | ownershipBoundaries.exe017 | عقد 14 | PRESERVE (قفل exe017) |

**ملاحظات الحالة:** لا مفهوم مجال بلا مالك. التداخل الوحيد المسجل: application finance يقرأ الجميع عبر projectFinancialService (القارئ الأساسي وفق عقد 40) — دور قارئ لا يغيّر الملكية.

---

## 2. جرد منافذ التخزين — 131 طريقة في 22 مجموعة قدرة

المصدر السلطوي للمنفذ: `apps/prototype-web/client/src/storage/local/types.ts` (`export interface PrototypeLocalStore`). المحوّلان المنفّذان: `IndexedDbLocalStore.ts` (131/131) و`MemoryLocalStore.ts` (131/131) — parity مثبتة بأجنحة conformance.

| مجموعة القدرة | الطرق (عدد) | مالك المفهوم | حراس الكتابة | مستهلكو التطبيق | لمسة التصدير | حالة التصنيف |
|---|---|---|---|---|---|---|
| Order lifecycle | 10 (getOrder/saveOrder/listOrders + 7 commit*) | domain/craft-order | craftOrderCommitGuard ضمن الحدود | fulfillment؛ collections؛ agreements؛ scheduling | craftOrder family | مصنّفة — Wave 4C مرشح قدرة |
| Owner entitlement & movements | 15 | domain/owner-entitlement | ownerEntitlementCommitGuard؛ ownerMovementGuard | finance/ownerEntitlementService؛ owner | ownerEntitlement family | مصنّفة — عنقود Owner Money |
| Recurring expense | 10 | domain/recurring-expense | recurringExpenseCommitGuard | finance/recurringExpenseService | recurringExpense family | مصنّفة |
| Inventory & materials | 9 (+activation 2) | domain/inventory-material | inventoryCommitGuard | inventory/inventoryMaterialService | ضمن snapshot + catalogCore | مصنّفة |
| Catalog & units & templates | 11 | domain/catalog | catalogTemplateRevisionGuard | catalog؛ craft-order costing | catalog family | مصنّفة |
| Financial events | 5 | domain/financial-event | financialEventCorrection/Replacement guards | finance (records)؛ expense flows | financialEvent family | مصنّفة |
| Supplier purchases | 5 | domain/supplier-purchase | supplierPurchaseCommitGuard؛ attribution atomicity | suppliers؛ finance | supplierPurchase family | مصنّفة |
| Schedules & recurrences | 9 | domain/craft-order (scheduling) | scheduleCommitGuard؛ recurrenceGuard | scheduling | ضمن craftOrder family | مصنّفة |
| Direct sales | 3 | domain/direct-sale | directSaleCollectionReversal guard | direct-sales؛ collections | directSale family | مصنّفة |
| Cash continuity & wallets | 3 | domain/cash-continuity | cashContinuityCommitGuard | cash؛ finance reads | ضمن snapshot | مصنّفة |
| Loans & received loans & deposits | 10 | domain/loan؛ domain/received-loan | loanCommitGuard؛ receivedLoanGuard؛ depositClassification guards | loans؛ finance | loan/receivedLoan families | مصنّفة |
| Assets | 4 | domain/asset | assetRecordGuard؛ acquisitionCorrection guard | assets؛ finance | assetResidual family | مصنّفة |
| Owner profiles & security & prefs | 9 | identity/preferences/security (تطبيق) | — (سجلات محلية بسيطة) | profile؛ security؛ preferences | ضمن snapshot (ما عدا localStorage-only الثلاثة — STR-315) | مصنّفة — 3 سجلات localStorage خارج snapshot مسجلة في touchpoints |
| Drafts & form drafts | 8 | application/drafts؛ input | — | drafts؛ pages (مسودة الاسترداد) | ضمن snapshot | مصنّفة |
| Cost estimates | 4 | application/estimates | — | estimates؛ orders | ضمن snapshot | مصنّفة — مسار عقد 40 الصحيح `estimates` لا `cost-estimates` (STR-403) |
| Actual time records | 3 | domain/actual-time | — | time؛ finance | ضمن snapshot | مصنّفة |
| Short cash declarations | 4 | domain/g5 (سجل مخزّن) | shortCashDeclarationReversal guard | application/g5؛ finance | shortCashDeclaration family | مصنّفة — سجل مخزّن لا read model (قيد 4A) |
| Allocation policies | 4 | domain/financial-event (توزيع) | allocationPolicySuccessor guard | finance | ضمن snapshot | مصنّفة — قفل exe017: كتابة التوزيع للمالية وحدها |
| Expense budgets | 3 | domain/budget | — | finance/expenseBudgetService | expenseBudget family | مصنّفة |
| Recurring expense revisions/occurrences | (ضمن 10 أعلاه) | domain/recurring-expense | ضمن الحراس | finance/recurring | recurringExpense family | مصنّفة (مفصكة مع المجموعة الأم) |
| Snapshot transfer | 2 (readSnapshot/replaceSnapshot) | application/transfers (تنسيق) + storage (حد الكتابة) | EXE-014 نسخة احتياطية متحققة قبل الاستبدال | localTransferService فقط | المظروف نفسه | مصنّفة — حد حرج؛ لا تغيير |
| Profile/preferences misc | (مغطاة أعلاه) | — | — | — | — | — |

**مجموع الطرق:** 131/131 مصنّفة. *ملاحظة (تصحيح Agent 2):* أعداد الطرق لكل مجموعة أدلة تنقّل تقريبية؛ **الواجهة `PrototypeLocalStore` نفسها هي المصدر السلطوي للعدّ**. لا طريقة «معلقة بلا سبب». حراس الكتابة المشتركون: 9 وحدات حراسة نقية داخل حد الكتابة (STR-306 PRESERVE). التبعيات الجانبية الأربع للمحولات: IndexedDB global، Clock (حقن ~25 خدمة)، localDiagnostics، touchpoints registry.

---

## 3. تصنيف خدمات application/finance حسب المسؤولية (6 عناقيد — Wave 4B)

| الخدمة | العنقود | الدور | مصدر الحقيقة الذي تقرأه | اختبارات مباشرة | حالة |
|---|---|---|---|---|---|
| projectFinancialService.ts | Financial Read Models | **القارئ المالي الأساسي** (عقد 40) — نتائج الفترة، سياقات العائلات | domain + storage عبر المنفذ | 5 ملفات اختبار (category/evidence/familyContexts/redelivery/رئيسي) | PRESERVE في دوره؛ نقل ميكانيكي فقط بعد قبول السجل |
| periodComparisonService.ts | Financial Read Models | مقارنات الفترات | عبر القارئ الأساسي | periodComparisonService.test.ts | مصنّفة |
| periodPresets.ts | Financial Read Models | قوالب الفترات | نقية | periodPresets.test.ts | مصنّفة |
| dueDatesService.ts / dueDateAging.ts | Financial Read Models | استحقاقات وأعمار الدين | storage + domain | dueDatesService.test.ts | مصنّفة |
| upcomingService.ts | Financial Read Models | الالتزامات القادمة | عبر القارئ | upcomingService.test.ts مباشر | مصنّفة |
| statementService.ts / statementMarkdownService.ts | Financial Read Models | بيان الفترة وتمثيله النصي | عبر القارئ | statementService.test.ts وstatementMarkdownService.test.ts مباشرة | مصنّفة |
| profitToCashBridgeService.ts | Financial Read Models | جسر الربح→الكاش (G5) | domain/g5 + قارئ | profitToCashBridgeService.test.ts | مصنّفة |
| shortCashHorizon.ts | Financial Read Models | أفق الكاش القصير (G5) | domain/g5 | shortCashHorizon.test.ts | مصنّفة |
| application/g5/g5Service.ts | Financial Read Models (عنقود التحليل) | خدمات تحليل التعادل/السيولة | domain/g5 | g5Service.test.ts (+shortCashHorizon) | مصنّفة — مسار 4A rename |
| ownerEntitlementService.ts | **Owner Money (الطيار)** | دورة سجل استحقاق المالك والتسويات | domain/owner-entitlement + storage | ownerEntitlementService.test.ts + ownerCrossModelDuplicates | مصنّفة — طيار Wave 4B |
| withdrawalWalletGuard.ts | Owner Money | حارس محفظة السحب (قاعدة حسابية — STR-302 قرار مالك للتوطين) | domain/owner-safe-withdrawal | withdrawalWalletGuard.test.ts مباشر (410 أسطر/13 اختبارًا) | مصنّفة — **DECISION_REQUIRED** لنقل القاعدة؛ البنية تبقى |
| expenseRecordIntent.ts | Financial Records | قصد تسجيل المصروف وتصنيفه | domain/financial-event | expenseRecordIntent.test.ts | مصنّفة |
| expenseCategorySuggestions.ts | Financial Records | اقتراحات تصنيف المصروف | سجل تاريخي محلي | expenseCategorySuggestions.test.ts | مصنّفة |
| correctionHistoryService.ts | Financial Records | تاريخ التصحيحات (قراءة) | storage | correctionHistoryService.test.ts | مصنّفة |
| retainedDepositService.ts | Financial Records | العربونات المحتجزة | domain + storage | retainedDepositService.test.ts | مصنّفة |
| recurringExpenseService.ts | Recurring Planning | سلاسل المصروف المتكرر وقراراته | domain/recurring-expense | recurringExpenseService.test.ts | مصنّفة |
| recurringWorkService.ts | Recurring Planning | العمل المتكرر | domain | recurringWorkService.test.ts (+fin006) | مصنّفة |
| expenseBudgetService.ts | Budgets & Planning | ميزانيات المصروف (عقد 42) | domain/budget | **لا اختبار وحدة مباشر — فجوة STR-406: تُغلق في Wave 3C** (تحقق مستقل Agent 2) | مصنّفة + بطاقة تغطية |
| integrityCheckService.ts | Integrity & Diagnostics | فحوص سلامة السجلات (قراءة فقط) — لا يملك قواعد مالية | كل السجلات عبر المنفذ | integrityCheckService.test.ts + fullCycleReconciliation | مصنّفة |

**قواعد العناقيد:** (1) لا تُنقل معادلة أو تقريب أو تصنيف أو حالة نتيجة أبدًا — نقل ميكانيكي للملفات فقط. (2) التشخيص لا يخترع قواعد مالية. (3) shortCashDeclarations تبقى سجلًا مخزّنًا بملكية domain/g5 المسجلة.

---

## 4. مجموعات القيم المكررة يدويًا بين المجال ومحوّلات النقل (بذرة STR-104/509)

**الظاهرة:** `transferFamilyValidators.ts` (1,715 سطرًا) يكرر حرفيًا اتحادات قيم المجال كأشرطة قبول، بلا مصدر واحد مسمى. الانحراف الصامت سيرفض تصديرًا مشروعًا (أعلى فخ توافق بيانات مجاور للبرنامج).

| مجموعة القيم | المصدر السلطوي (المجال) | النسخة المكررة (Transfer) | القرار |
|---|---|---|---|
| OrderStatus (craft-order) | `src/domain/craft-order/types.ts` | validator عائلة craftOrder | Wave 3B: دريفت غارد؛ 4D: توحيد المصدر |
| AgreementStatus | craft-order/types.ts | craftOrder family | كما выше |
| DeliveryTerms | craft-order (deliveryTermsValidation) | craftOrder family | كما فوق |
| FinancialEventKind/Status | financial-event/types.ts | financialEvent family | كما فوق |
| ExpenseCategory | financial-event (تصنيف المصروف) | financialEvent family | كما فوق |
| AllocationPolicyStatus | financial-event (توزيع) | allocation ضمن families | كما فوق |
| AssetKind/Status | asset/types.ts | assetResidual family | كما فوق |
| LoanStatus | loan/types.ts | loan family | كما فوق |
| ReceivedLoanStatus | received-loan/types.ts | receivedLoan family | كما فوق |
| RecurringExpenseSeriesStatus/OccurrenceDecision | recurring-expense/types.ts | recurringExpense family | كما فوق |
| MeasurementUnitKind | catalog/types.ts | catalog family | كما فوق |
| OwnerEntitlementPolicyStatus/RecordStatus | owner-entitlement/types.ts | ownerEntitlement family | كما فوق |
| OwnerMovementKind | owner-entitlement (movements) | ownerEntitlement family | كما فوق |
| ShortCashDeclarationStatus | g5/types.ts | shortCashDeclaration family | كما فوق |
| DirectSaleStatus | direct-sale/types.ts | directSale family | كما فوق |
| SupplierPurchaseStatus | supplier-purchase/types.ts | supplierPurchase family | كما فوق |
| KnowledgeState | domain/shared (نوع) + storage (نوع مواز) + application validator | **ثلاثية موثقة (STR-208)** | 4D: توحيد عبر guard مجالي |

القائمة الكاملة القابلة للتنفيذ (~83 اتحادًا) تُقاس آليًا باختبار الدريفت في Wave 3B — هذا السجل يثبت المبدأ والمسؤولية لا يعيد كتابة القيم. **القيم التاريخية التوافقية تبقى منفصلة وموسومة** (مفتاح: إصدار التصدير/العقد التاريخي) ولا تُدمج مع القيم الحية أبدًا (عقد 39).

---

## 5. سجل الاستيرادات العميقة والدورات والتنازلات (الحالة الحالية)

| النوع | العنصر | الموقع | التصنيف |
|---|---|---|---|
| Deep import (domain) | settlementInvariant خارج البرميل | application (dynamic import ×3) | STR-205 — Wave J: تصدير عبر البرميل |
| Deep import (domain) | operatingBreakEven ×2 (D-034) | application/g5 | تنازل موثق D-034 (حزمة) — يبقى |
| Deep import (domain) | STR-030 alias ×2 + type import ×1 | domain-internal | موثق S2 |
| Deep import (application) | integrityCheckService.ts:1437 | application↔application | STR-313 — تنازل مفرد موثق |
| Type cycle (SCC) | storage types ↔ supplierScheduleCommitGuard | storage/local | STR-307 — type-only، موثق، لا حادثة تشغيل |
| Type cycle (SCC) | g5Service ↔ projectFinancialService | application | غير موثق سابقًا — يسجل هنا (STR-204b)؛ Wave 4A/4D يفكه بالنقل الميكانيكي أو يوثق |
| Type cycle (SCC) | FinancePeriodResultSection ↔ pages/Finance | component↔page (type-only) | STR-204c — جذر مكوّن داخل صفحة؛ Wave T للفك البصري |
| ESLint waiver | StartupGate storage import | apps/…/app/StartupGate.tsx | تنازل موثق في eslint.config.js |
| ESLint waiver | PrototypeServicesContext storage import | composition root | تنازل موثق |
| ESLint waiver | page/component test localStorage | ملفات اختبار | تنازل موثق |
| ESLint waiver | domain-test vitest | tests/domain | تنازل موثق |
| ESLint waiver | shared Math | domain/shared | تنازل موثق (مقارنات آمنة) |
| ESLint waiver | application Math ×3 | finance (تقريب محكوم) | تنازل موثق |
| ESLint waiver | storage types → UI (type-only) | 16 ملف UI | سياسة موثقة (STR-305 قرار مالك مؤجل) |
| Application→presentation | 14 حافة قيمة / 12 ملفًا | application → presentation/formatters | STR-203 — OWNER_DECISION_REQUIRED (waiver أو نقل — Wave G) |
| UI→domain direct | 16 حافة قيمة (منها 6 صفحات) | UI → domain | STR-106 — OWNER_DECISION_REQUIRED (سياسة اتجاه) |

**قاعدة السجل:** أي استثناء جديد يحتاج صفًا هنا + سببًا + تاريخ مراجعة. الرقم الحالي خط أساس — الحارس (Wave 4E) يمنع الزيادة لا يقللها قسرًا.

---

## 6. القرارات المفتوحة المرتبطة بالملكية (تُحسم عند المالك لا هنا)

| # | القرار | البند |
|---|---|---|
| 1 | سياسة اتجاه UI→domain (قراءة قيمة صرفة) | STR-106 |
| 2 | سياسة application→presentation (waiver أم نقل نواة التنسيق) | STR-203 |
| 3 | توطين قواعد حسابية في application (settlement arithmetic، withdrawalWalletGuard، derivePeriodCogs) — مسار دلالي مستقل | STR-302 |
| 4 | shortCashDeclarations: يبقى سجلًا مخزنًا بملكية g5 (توصية) أم ينقل | قيد 4A |
| 5 | عرض أنواع التخزين كـview models للـUI | STR-305 (Wave T-adjacent) |

**حالة السجل:** مفاهيم المجال 18/18 مملوكة؛ منافذ التخزين 131/131 مصنفة؛ خدمات المالية 20+1/20+1 مصنفة في 6 عناقيد؛ التكرارات مسجلة بمبدئها مع فجوة قياس 3B؛ الاستثناءات والدورات كلها مسجلة. لا مفهوم عالي الخطورة بلا صف.
