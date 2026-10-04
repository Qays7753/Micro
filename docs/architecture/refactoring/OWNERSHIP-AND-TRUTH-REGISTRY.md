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
| financial-analysis (الاسم الأساس الحالي — Wave 4A؛ التاريخي g5) | عقد 12/17 + `src/domain/financial-analysis/` | domain/financial-analysis | application/financial-analysis؛ finance read models؛ integrity | storage (shortCashDeclarations — **سجل مخزّن**) | `shortCashDeclaration` family | `tests/domain/financial-analysis.test.ts` + `operatingBreakEven.test.ts` | عقد 12/17 | PRESERVE؛ تنفذ 4A: المسار الأساس financial-analysis + برميل توافق g5 للواجهة المجمدة؛ shortCashDeclarations سجل مخزّن لا read model |
| financial-event توزيعات | عقد 14 (توزيع نتيجة الفترة) | domain/financial-event + finance (قراءة فقط) | finance؛ owner؛ transfers | storage (allocations) | ضمن families | ownershipBoundaries.exe017 | عقد 14 | PRESERVE (قفل exe017) |

**ملاحظات الحالة:** لا مفهوم مجال بلا مالك. التداخل الوحيد المسجل: application finance يقرأ الجميع عبر projectFinancialService (القارئ الأساسي وفق عقد 40) — دور قارئ لا يغيّر الملكية.

---

## 2. جرد منافذ التخزين — 130 طريقة في 22 مجموعة قدرة

المصدر السلطوي للمنفذ: `apps/prototype-web/client/src/storage/local/types.ts` (`export interface PrototypeLocalStore`). المحوّلان المنفّذان: `IndexedDbLocalStore.ts` (130/130) و`MemoryLocalStore.ts` (130/130) — parity مثبتة بأجنحة conformance. *(العدّ 131→130 — Wave D/STR-618، 2026-10-04: أُزيلت `getActualTimeRecord` الميتة كليًا — بلا مستهلك إنتاج ولا اختبار؛ التفصيل في ملاحظة جرد STR-618 أدناه.)*

| مجموعة القدرة | الطرق (عدد) | مالك المفهوم | حراس الكتابة | مستهلكو التطبيق | لمسة التصدير | حالة التصنيف |
|---|---|---|---|---|---|---|
| Order lifecycle | 9 (listOrders/getOrder/saveOrder + 6 commit*) | domain/craft-order | craftOrderCommitGuard ضمن الحدود + deliveryReversalCommitGuard | fulfillment؛ collections؛ agreements؛ scheduling | craftOrder family | مصنّفة — **قدرة مستخرجة (Wave 4C/RC-7 منفذة):** منفذ `OrderLifecycleStore` في `storage/local/capabilities/orderLifecycleStore.ts` مشتق من الواجهة التوافقية (Pick — لا انحراف تواقيع)؛ المحوّلان يحققانه (مراسي نوعية + عقد اختبار بالمحوّلين معًا)؛ ثلاث خدمات تستهلك النوع الضيق (agreementService، agreementContextService، financialPulseService)؛ الواجهة التوافقية تبقى المصدر السلطوي ولا تُحذف طريقة منها إلا بإثبات خلوّها من المستهلكين هنا |
| Owner entitlement & movements | 14 (العدّ الحي من الواجهة — المصدر السلطوي) | domain/owner-entitlement | ownerEntitlementCommitGuard؛ ownerMovementGuard | owner-money (ownerEntitlementService — الكاتب الوحيد)؛ قراء listOwnerMovements العرضيون (correctionHistoryService؛ statementService؛ profitToCashBridgeService؛ projectFinancialService) | ownerEntitlement family | مصنّفة — عنقود Owner Money — **قدرة مستخرجة (Wave C/ADR-015 مجموعة 6 — 2026-10-04، مراجعة exe017 منفذة):** منفذ `OwnerEntitlementStore` في `storage/local/capabilities/ownerEntitlementStore.ts` مشتق من الواجهة التوافقية (Pick)؛ المحوّلان يحققانه (مراسي نوعية + عقد اختبار بالمحوّلين معًا)؛ الكاتب على Omit من القدرة + القراءات المصرحة؛ وقارئان عرضيان (correctionHistoryService؛ statementService) على أقسام Pick مع قراءاتهما؛ وقراءان يبقيان على الواجهة الكاملة بقرار موثق (projectFinancialService — القارئ الكنوني عقد ٤۰ وهدف تقسيم Wave F؛ وprofitToCashBridgeService — يبني القارئ الكنوني داخليًا فيتبع نوعه)؛ قفل الملكية محفوظ: الاستخراج اشتقاقي لا يفتح كاتبًا ثانيًا |
| Recurring expense | 10 | domain/recurring-expense | recurringExpenseCommitGuard | recurring/recurringExpenseService (وحدة توافق finance/ للواجهة المجمدة) | recurringExpense family | مصنّفة — **قدرة مستخرجة (Wave C/ADR-015 مجموعة 1 — 2026-10-03):** منفذ `RecurringExpenseStore` في `storage/local/capabilities/recurringExpenseStore.ts` مشتق من الواجهة التوافقية (Pick)؛ المحوّلان يحققانه (مراسي نوعية + عقد اختبار بالمحوّلين معًا)؛ المستهلك الوحيد (recurringExpenseService) على النوع الضيق (القدرة + قراءتي الحدث المالي المصرحتين)؛ **نُقل إلى بيته الأساس application/recurring/ (Wave E/ADR-013 — 2026-10-04 — نمط 4B/#307)** |
| Inventory & materials | 9 (+activation 2) | domain/inventory-material | inventoryCommitGuard | inventory/inventoryMaterialService | ضمن snapshot + catalogCore | مصنّفة |
| Catalog & units & templates | 11 | domain/catalog | catalogTemplateRevisionGuard | catalog؛ craft-order costing | catalog family | مصنّفة |
| Financial events | 5 | domain/financial-event | financialEventCorrection/Replacement guards | finance (records)؛ expense flows | financialEvent family | مصنّفة |
| Supplier purchases | 5 | domain/supplier-purchase | supplierPurchaseCommitGuard؛ attribution atomicity | suppliers؛ finance | supplierPurchase family | مصنّفة |
| Schedules & recurrences | 9 | domain/craft-order (scheduling) | scheduleCommitGuard؛ recurrenceGuard | scheduling | ضمن craftOrder family | مصنّفة |
| Direct sales | 3 | domain/direct-sale | directSaleCollectionReversal guard | direct-sales؛ collections | directSale family | مصنّفة |
| Cash continuity & wallets | 3 | domain/cash-continuity | cashContinuityCommitGuard | cash؛ finance reads | ضمن snapshot | مصنّفة |
| Loans & received loans & deposits | 10 | domain/loan؛ domain/received-loan | loanCommitGuard؛ receivedLoanGuard؛ depositClassification guards | loans (loanService؛ receivedLoanService)؛ financial-records (retainedDepositService)؛ finance/integrityCheckService (قراءتان — يبقى على الواجهة الكاملة حتى تقسيم Wave F) | loan/receivedLoan families | مصنّفة — **قدرة مستخرجة (Wave C/ADR-015 مجموعة 3 — 2026-10-04):** منفذ `LoanStore` في `storage/local/capabilities/loanStore.ts` مشتق من الواجهة التوافقية (Pick)؛ المحوّلان يحققانه (مراسي نوعية + عقد اختبار بالمحوّلين معًا)؛ ثلاثة مستهلكين على أنواع ضيقة (أقسام Pick من القدرة + القراءات المصرح بها)؛ القراءتان الشاملتان لفاحص السلامة تبقيان على الواجهة التوافقية بقرار موثق |
| Assets | 4 | domain/asset | assetRecordGuard؛ acquisitionCorrection guard | assets؛ finance | assetResidual family | مصنّفة |
| Owner profiles & security & prefs | 9 | identity/preferences/security (تطبيق) | — (سجلات محلية بسيطة) | profile؛ security؛ preferences | ضمن snapshot (ما عدا localStorage-only الثلاثة — STR-315) | مصنّفة — 3 سجلات localStorage خارج snapshot مسجلة في touchpoints |
| Drafts & form drafts | 8 | application/drafts؛ input | — | drafts؛ pages (مسودة الاسترداد) | ضمن snapshot | مصنّفة |
| Cost estimates | 4 | application/estimates | — | estimates؛ orders | ضمن snapshot | مصنّفة — مسار عقد 40 الصحيح `estimates` لا `cost-estimates` (STR-403) |
| Actual time records | 2 (كانت 3 — أزيل Wave D/STR-618 القراءة الفردية الميتة getActualTimeRecord) | domain/actual-time | — | time؛ finance | ضمن snapshot | مصنّفة |
| Short cash declarations | 4 | domain/g5 (سجل مخزّن) | shortCashDeclarationReversal guard | financial-analysis (financialAnalysisService) | shortCashDeclaration family | مصنّفة — سجل مخزّن لا read model (قيد 4A) — **قدرة مستخرجة (Wave C/ADR-015 مجموعة 5 — 2026-10-04):** منفذ `ShortCashDeclarationStore` في `storage/local/capabilities/shortCashDeclarationStore.ts` مشتق من الواجهة التوافقية (Pick)؛ المحوّلان يحققانه (مراسي نوعية + عقد اختبار بالمحوّلين معًا)؛ المستهلك الوحيد (financialAnalysisService) على النوع الضيق (قسم القدرة + القراءات المصرحة؛ getShortCashDeclaration بلا مستهلك إنتاج — تبقى بالواجهة حتى خطوة حذف موثقة) |
| Allocation policies | 4 | domain/financial-event (توزيع) | allocationPolicySuccessor guard | finance (recurringWorkService) | ضمن snapshot | مصنّفة — قفل exe017: كتابة التوزيع للمالية وحدها — **قدرة مستخرجة (Wave C/ADR-015 مجموعة 4 — 2026-10-04):** منفذ `AllocationPolicyStore` في `storage/local/capabilities/allocationPolicyStore.ts` مشتق من الواجهة التوافقية (Pick)؛ المحوّلان يحققانه (مراسي نوعية + عقد اختبار بالمحوّلين معًا)؛ المستهلك الوحيد (finance/recurringWorkService — الكاتب المالي الوحيد بموجب exe017) على النوع الضيق (القدرة + القراءات المصرح بها)؛ القفل محفوظ: الاستخراج اشتقاقي لا يفتح كاتبًا ثانيًا |
| Expense budgets | 3 | domain/budget | expenseBudgetCommitGuard | budgets/expenseBudgetService (وحدة التوافق finance/ إعادة تصدير لا مستهلكًا) | expenseBudget family | مصنّفة — **قدرة مستخرجة (Wave C/ADR-015 مجموعة 2 — 2026-10-04):** منفذ `ExpenseBudgetStore` في `storage/local/capabilities/expenseBudgetStore.ts` مشتق من الواجهة التوافقية (Pick)؛ المحوّلان يحققانه (مراسي نوعية + عقد اختبار بالمحوّلين معًا)؛ المستهلك الوحيد (budgets/expenseBudgetService) على النوع الضيق (القدرة + قراءة الأحداث المالية المصرحة listFinancialEvents) |
| Recurring expense revisions/occurrences | (ضمن 10 أعلاه) | domain/recurring-expense | ضمن الحراس | finance/recurring | recurringExpense family | مصنّفة (مفصكة مع المجموعة الأم) |
| Snapshot transfer | 2 (readSnapshot/replaceSnapshot) | application/transfers (تنسيق) + storage (حد الكتابة) | EXE-014 نسخة احتياطية متحققة قبل الاستبدال | localTransferService فقط | المظروف نفسه | مصنّفة — حد حرج؛ لا تغيير |
| Profile/preferences misc | (مغطاة أعلاه) | — | — | — | — | — |

**مجموع الطرق:** 130/130 مصنّفة (كانت 131 — إزالة Wave D/STR-618). *ملاحظة (تصحيح Agent 2):* أعداد الطرق لكل مجموعة أدلة تنقّل تقريبية؛ **الواجهة `PrototypeLocalStore` نفسها هي المصدر السلطوي للعدّ**. لا طريقة «معلقة بلا سبب». *دقة حراس الكتابة (تصحيح STR-606، 2026-10-03):* أسماء عمود «حراس الكتابة» أعلاه هي **مفاهيم حراسة** — الوحدات النقية المستقلة ملفات هي **9 بالضبط** في `storage/local/` (orderCommit، loanCommit، receivedLoanCommit، recurringExpenseCommit، expenseBudgetCommit، cashContinuityCommit، deliveryReversalCommit، supplierAttributionCommit، supplierScheduleCommit)؛ وما عداها (مراجعات القوالب، خلافة التوزيع، CAS والذرية، تصحيح الأحداث…) منطق مفروض داخل المحوّلين/أجسام الطرق لا ملفات مستقلة (STR-306 PRESERVE). *التبعيات الجانبية الأربع للمحولات (تحديث Wave D/STR-618، 2026-10-04):* IndexedDB global (معزولة)؛ **Clock — صارت منفذًا مسمى** `application/time/clock.ts` (`Clock` + `systemClock` الافتراضي الوحيد؛ 42 موقع حقن هُجّرت ميكانيكيًا؛ الساعة الدومينية الموثقة تبقى في shared/businessTime)؛ localDiagnostics (ثماني حقن موثقة)؛ touchpoints registry (37+3). *جرد STR-618 — تصنيف الطرق الثماني الخاملة (قياس حي 2026-10-04، قرار لكل طريقة):* ① `getActualTimeRecord` — **أُزيلت** (ميتة كليًا: صفر إنتاج + صفر اختبار؛ الواجهة والمحوّلان في نفس الـPR). ② `saveOrder` — **تُبقى بقرار**: مسار الإنشاء والبذور المحروس بعقد G-003/F-053 (saveOrderGuard.contract) وعضو قدرة دورة حياة الطلب 4C ومستهلك dom-test (U07) — الكتابة الإنتاجية كلها عبر الالتزامات المحروسة. ③ `saveSchedule` و④ `saveRecurrence` — **تُبقيان بقرار**: سطح دعم اختبارات لعائلة الجدولة (4+1 ملفات اختبار)؛ الكتابة الإنتاجية عبر scheduleCommitGuard/recurrenceGuard؛ إزالتهما تُلزم بتغيير دلالة تجهيزات الاختبارات — ممنوع في الموجات البنيوية. ⑤ `saveSupplierPurchase` — **تُبقى بقرار**: بدائيّة تجهيز اختبارات في 10 ملفات؛ الكتابة الإنتاجية عبر حراس attribution/schedule المحروسة؛ السبب نفسه. ⑥ `getShortCashDeclaration` و⑦ `getOwnerEntitlementRecord` و⑧ `getOwnerMovement` — **تُبقى بقرار**: قراءات فردية تكافئ قراءات القوائم المستعملة داخل عضوية القدرات المستخرجة (Wave C)؛ موثقة «بلا مستهلك إنتاج» في صفوفها. **مراجع كل قرار:** أي مستهلك إنتاج جديد يُلغي القرار ويستدعي الترحيل إلى الالتزامات المحروسة أو الاستعمال المباشر؛ **حد الخروج:** إعادة تصميم العائلة أو مسار الاختبارات.

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
| profitToCashBridgeService.ts | Financial Read Models | جسر الربح→الكاش | domain/financial-analysis + قارئ (بعد 4A) | profitToCashBridgeService.test.ts | مصنّفة |
| shortCashHorizon.ts | Financial Read Models | أفق الكاش القصير | domain/financial-analysis (بعد 4A) | shortCashHorizon.test.ts | مصنّفة |
| application/g5/g5Service.ts | Financial Read Models (عنقود التحليل) | خدمات تحليل التعادل/السيولة | domain/g5 | g5Service.test.ts (+shortCashHorizon) | مصنّفة — مسار 4A rename |
| application/owner-money/ownerEntitlementService.ts (انتقل مع العنقود — Wave 4B منفذة) | **Owner Money (منفذ)** | دورة سجل استحقاق المالك والتسويات | domain/owner-entitlement + storage | ownerEntitlementService.test.ts + ownerCrossModelDuplicates (انتقلا معه) | منفذة |
| application/owner-money/withdrawalWalletGuard.ts (انتقل مع العنقود) | Owner Money | حارس محفظة السحب (قاعدة حسابية — STR-302 قرار مالك للتوطين) | domain/owner-safe-withdrawal | withdrawalWalletGuard.test.ts مباشر (انتقل معه) | منفذة النقل؛ **DECISION_REQUIRED** تبقى لنقل القاعدة الحسابية إلى المجال (مسار R) |
| application/financial-records/expenseRecordIntent.ts | Financial Records | قصد تسجيل المصروف وتصنيفه | domain/financial-event | expenseRecordIntent.test.ts (انتقل مع العنقود) | **منفذة النقل** (شريحة متابعة 4B)؛ وحدة توافق في finance/ للواجهة المجمدة |
| application/financial-records/expenseCategorySuggestions.ts | Financial Records | اقتراحات تصنيف المصروف | سجل تاريخي محلي | expenseCategorySuggestions.test.ts (انتقل مع العنقود) | **منفذة النقل**؛ وحدة توافق في finance/ |
| application/financial-records/correctionHistoryService.ts | Financial Records | تاريخ التصحيحات (قراءة) | storage | correctionHistoryService.test.ts (انتقل مع العنقود) | **منفذة النقل**؛ وحدة توافق في finance/؛ حافة عرضها المحروسة أُعيد قياسها لحارس الحدود |
| application/financial-records/retainedDepositService.ts | Financial Records | العربونات المحتجزة | domain + storage | retainedDepositService.test.ts (انتقل مع العنقود) | **منفذة النقل**؛ وحدة توافق في finance/ |
| recurringExpenseService.ts (application/recurring/ — نقل Wave E/ADR-013 2026-10-04) | Recurring Planning | سلاسل المصروف المتكرر وقراراته | domain/recurring-expense | recurringExpenseService.test.ts (انتقل مع المسؤولية) | مصنّفة |
| recurringWorkService.ts | Recurring Planning | العمل المتكرر | domain | recurringWorkService.test.ts (+fin006) | مصنّفة |
| application/budgets/expenseBudgetService.ts | Budgets & Planning | ميزانيات المصروف (عقد 42) | domain/budget | expenseBudgetService.3c.test.ts (تغطية 3C المباشرة انتقلت معه) | **منفذة النقل** (شريحة متابعة 4B)؛ وحدة توافق في finance/؛ فجوة STR-406 مغلقة فعلًا في 3C |
| integrityCheckService.ts | Integrity & Diagnostics | فحوص سلامة السجلات (قراءة فقط) — لا يملك قواعد مالية | كل السجلات عبر المنفذ | integrityCheckService.test.ts + fullCycleReconciliation | مصنّفة |

**قواعد العناقيد:** (1) لا تُنقل معادلة أو تقريب أو تصنيف أو حالة نتيجة أبدًا — نقل ميكانيكي للملفات فقط. (2) التشخيص لا يخترع قواعد مالية. (3) shortCashDeclarations تبقى سجلًا مخزّنًا بملكية domain/g5 المسجلة.

## 3م. صفوف ملكية خدمات application خارج البيت المالي (إكمال STR-619 — Wave G2، 2026-10-04)

المسح المعادي وجد `financialPulseService` و`capacityDecisionService` بلا صفوف ملكية، و~16 بيتًا غير مالي بمستوى الملف فقط. هذان الصفان يسدّان الأول، والجدول بعدهما يكمل الثاني بدلالة مالك المفهوم وأدلة الاختبار الحية (كل الأعداد مقيسة على الشجرة الحية عند التحرير؛ التحديث اللاحق عبر إعادة توليد خريطة G2):

| الخدمة | البيت | الدور | مصدر الحقيقة الذي تقرأه | اختبارات مباشرة | حالة |
|---|---|---|---|---|---|
| `financialPulseService.ts` (75 nbLOC) | application/financial-pulse/ | نبض مالي محلي: تجميعات معرّفة لحقول CraftOrder فقط — لا يدّعي كاش المشروع أو ربحه أو دفترًا (رأس الملف عقدًا) | منفذ `OrderLifecycleStore` الضيق (قدرة 4C) + `isRegisteredCustomerDebt` من المجال | `financialPulseService.test.ts` (مجاور) | مصنّفة — **الصف كان مفقودًا (STR-619) وسُدّ هنا** |
| `capacityDecisionService.ts` (57 nbLOC) | application/scheduling/ | اشتقاق قرار القدرة (unknown/needs_review/within_limit/over_limit) من يوم الجدولة | `scheduleService` (البيت نفسه) | `capacityDecisionService.test.ts` + `capacityDecisionViewModel.test.ts` (مجاوران) | مصنّفة — **الصف كان مفقودًا (STR-619) وسُدّ هنا** |

**إكمال تغطية بيوت application غير المالية** (بيوت المال الستة — finance/financial-analysis/financial-records/owner-money/g5/recurring — مغطاة بعناقيد §3 أعلاه؛ البيوت التالية بدلالة مالك مفهومها وأدلة اختبارها المباشرة المجاورة):

| البيت | مالك المفهوم (المجال/العقد) | ملفات إنتاج | اختبارات مجاورة | ملاحظة |
|---|---|---|---|---|
| activity/ | الحدث المالي (عقد 30 — القارئ الموحد) | 2 | 1 | — |
| agreements/ | G7-A (عقد 20) | 5 | 4 | — |
| assets/ | الأصول (عقد 43) | 1 | 1 | — |
| budgets/ | الميزانيات (عقد 42) | 2 | 1 | عنقود §3 — نقل 4B |
| cash/ | استمرارية الكاش (عقد 10) | 2 | 2 | — |
| catalog/ | الكتالوج (عقد 15) | 2 | 3 | — |
| collections/ | التحصيل (عقد 02) | 3 | 3 | — |
| cost/ | نسخة التكلفة (عقد 03) | 1 | 1 | — |
| diagnostics/ | التشخيص المحلي (عقد 36-مجاور) | 2 | 2 | — |
| direct-sales/ | البيع المباشر | 1 | 1 | — |
| drafts/ | المسودات (عقد 36) | 4 | 3 | — |
| estimates/ | التقديرات (عقد 03) | 1 | 1 | — |
| financial-pulse/ | **صف فردي أعلاه (STR-619)** | 1 | 1 | — |
| follow-up/ | G7-A متابعة | 1 | 1 | — |
| formatting/ | أدوات عرض مشتركة | 1 | 0 مجاورًا | التغطية في `presentation/formatters.test.ts` + `businessTime.characterization.test.ts` (سبب موثق: أدوات عرض يستهلكها العرض فيُختبر هناك) |
| fulfillment/ | دورة الطلب (عقد 02) | 4 | 9 | — |
| home/ | لوحة التحكم H01A | 2 | 2 | — |
| identity/ | هوية النشاط | 1 | 1 | — |
| input/ | الإدخال الموجّه (عقد 27) | 1 | 3 | — |
| inventory/ | مواد المخزون (عقد 11/28 — ADR-014) | 11 | 3 | تقسيم Wave F شريحة ٣ (مُنسّق + 7 أشقاء) |
| loans/ | القروض (عقد 29) | 2 | 2 | — |
| owner/ | استحقاق المالك | 1 | 1 | — |
| parties/ | الأطراف | 1 | 2 | — |
| preferences/ | التفضيلات | 2 | 2 | — |
| profile/ | ملف النشاط | 1 | 1 | — |
| scheduling/ | **صف فردي أعلاه (STR-619)** + عقد 07/19/22 | 4 | 3 | — |
| security/ | القفل المحلي (عقد 37) | 1 | 1 | — |
| share/ | المشاركة اليدوية (عقد 33) | 1 | 1 | — |
| suppliers/ | المورد والشراء (عقد 09) | 1 | 3 | — |
| time/ | الساعة (حد D-044) | 2 | 1 | — |
| transfers/ | منظومة النقل (عقود 21/39 + سجل 4D) | 10 | 28 | transferFamilyValidators = PRESERVE (ADR-017 §3) |

**قاعدة هذا القسم:** البيوت أعلاه ملكية مفهومها للمجال/العقد المسمّى، وحسابها قراءة عبر المنافذ/القراءات الكنسية لا ملكًا لقاعدة مجال. أي خدمة جديدة في هذه البيوت تُضاف بصف فردي هنا (شرط قبول G2: صفر وحدة بلا دليل تغطية أو سبب موثق).

---

## 4. مجموعات القيم المكررة يدويًا بين المجال ومحوّلات النقل (بذرة STR-104/509)

**الظاهرة (أُغلقت في Wave 4D):** `transferFamilyValidators.ts` كان يكرر حرفيًا اتحادات قيم المجال كأشرطة قبول، بلا مصدر واحد مسمى. **تنفيذ 4D (بطاقة RC-8 — مصحح بتدقيق A5 النهائي):** (1) ما كان برميله داخل أصلًا في رأس الحزمة صار يُستهلك من مالكه مباشرة — materialUnits وقائمتا الميزانية (3 طواقم مفوضة فعلًا) ومصدر الاتفاق يُستهلك من السجل نفسه؛ أما unitDimensions وقوائم المصروف المتكرر الأربع وcatalogItemKinds فتفويضها **مؤجل عمدًا (D-034 — هامش السقف الخام لا يحتمل سحب البرميلين الجديدين)** وطواقمها الحرفية موسومة المصدر (GUARDED_UNION) ومحروسة باختبارات الوصف والسجل؛ (2) القيم التاريخية التوافقية (3 مصادر اتفاق) صارت في سجلها الموثق **الوحيد لنطاقها** `transferCompatibilityValues.ts` (سبب/إصدارات/اختبارات + إثبات نوعي أنها خارج الاتحاد الحالي) — *دقة (تصحيح STR-623/STR-606، 2026-10-03): «الوحيد» هنا يعني حصرًا قيم التوافق التاريخي لعائلات النقل؛ اكتشف المسح المعادي لما بعد الإغلاق موقعين يكرران معرفة قيم قبول خارج هذا السجل وكل حراسة (STR-623) — مسجلان في الجدول أدناه؛* (3) ما هو اتحاد نوعي فقط تبقى قيمه الحرفية تحت حراسة مراسي دريفت Wave 3B (طبقتا تشغيل وأنواع) والذهبيات كـoracle دائم؛ (4) خريطة مصادر القبول لكل عائلة موثقة في السجل نفسه (DOMAIN_RUNTIME_LIST / GUARDED_UNION / HISTORICAL_REGISTRY). طواقم القبول لم تتغير حرفيًا — شهدت بذلك اختبارات الوصف والذهبيات قبل وبعد.

| مجموعة القيم | المصدر السلطوي (المجال) | النسخة المكررة (Transfer) | القرار |
|---|---|---|---|
| OrderStatus (craft-order) | `src/domain/craft-order/types.ts` | validator عائلة craftOrder | 3B منفذ (غارد)؛ 4D منفذ: GUARDED_UNION موسومة المصدر |
| AgreementStatus | craft-order/types.ts | craftOrder family | كما فوق — انظر صف AgreementSource أدناه |
| DeliveryTerms | craft-order (deliveryTermsValidation) | craftOrder family | مفوض أصلًا لمدقق المجال (لا تكرار) |
| FinancialEventKind/Status | financial-event/types.ts | financialEvent family | 3B منفذ؛ 4D: GUARDED_UNION موسومة |
| ExpenseCategory | financial-event (تصنيف المصروف) | financialEvent family | GUARDED_UNION موسومة |
| AllocationPolicyStatus | financial-event (توزيع) | allocation ضمن families | مفوض لمدقق المجال isValidAllocationPolicy |
| AssetKind/Status | asset/types.ts | assetResidual family | GUARDED_UNION موسومة |
| LoanStatus | loan/types.ts | loan family | GUARDED_UNION موسومة |
| ReceivedLoanStatus | received-loan/types.ts | receivedLoan family | GUARDED_UNION موسومة |
| RecurringExpenseSeriesStatus/OccurrenceDecision | recurring-expense/types.ts | recurringExpense family | GUARDED_UNION — طواقم حرفية مطابقة للقوائم المجالية؛ **تفويض مؤجل (D-034)** |
| MeasurementUnitKind | catalog/types.ts | catalog family | unitDimensions + catalogItemKinds: GUARDED_UNION حرفية مطابقة؛ **تفويض مؤجل (D-034)** |
| OwnerEntitlementPolicyStatus/RecordStatus | owner-entitlement/types.ts | ownerEntitlement family | مفوض لمدققات المجال (isValidOwnerEntitlement*) |
| OwnerMovementKind | owner-entitlement (movements) | ownerEntitlement family | مفوض لمدقق المجال isValidOwnerMovement |
| ShortCashDeclarationStatus | financial-analysis/types.ts | shortCashDeclaration family | GUARDED_UNION موسومة |
| DirectSaleStatus | direct-sale/types.ts | directSale family | GUARDED_UNION موسومة |
| SupplierPurchaseStatus | supplier-purchase/types.ts | supplierPurchase family | GUARDED_UNION موسومة |
| KnowledgeState | craft-order/types.ts (اتحاد وحيد — حُسمت الثلاثية الموثقة سابقًا) | application validator | 3B منفذ؛ 4D: GUARDED_UNION موسومة |
| **AgreementSource (توافق تاريخي)** | storage/local/types.ts (5 حالية) | 5 حالية + 3 تاريخية | **4D منفذ: HISTORICAL_REGISTRY** — LEGACY_AGREEMENT_SOURCES في سجلها الموثق وحده |
| **STR-623 (مكتشف المعادي لما بعد الإغلاق): LegacyAgreementSource محلي في التطبيق** | المفروض: سجل التوافق `transferCompatibilityValues.ts` (HISTORICAL_REGISTRY) + `storage/local/types.ts` | `application/agreements/agreementContextService.ts:9-39` — اتحاد محلي + طاقم 5+3 قيم يكرر معرفة مصدر الاتفاق | **غير محروس ولا مسجل قبل الآن** — تسجيله هنا (STR-606/623): مراسي دريفت قيد التنفيذ (Wave H/STR-623)، ثم التوحيد للمصدر السلطوي متى سمح هامش الميزانية (STR-608) |
| **STR-623: walletKinds + materialUnits محليان في مستورد الفتح الموجه** | `src/domain/catalog/types.ts` (materialUnits — DOMAIN_RUNTIME_LIST) + أنواع المحفظة الكنونية | `application/transfers/guidedOpeningImportService.ts:76-77` — طاقمان محليان يُستخدمان للقبول عند :128/:150 | **غير محروس ولا مسجل قبل الآن** — نفس مسار STR-623 أعلاه (تسجيل ← مراسي ← توحيد) |

القائمة الكاملة القابلة للتنفيذ (~83 اتحادًا) تُقاس آليًا باختبار الدريفت في Wave 3B — هذا السجل يثبت المبدأ والمسؤولية لا يعيد كتابة القيم. **القيم التاريخية التوافقية تبقى منفصلة وموسومة** (مفتاح: إصدار التصدير/العقد التاريخي) ولا تُدمج مع القيم الحية أبدًا (عقد 39).

**تصرّف الملف (ADR-017 §3، 2026-10-04):** `transferFamilyValidators.ts` نفسه صُنّف **PRESERVE — إبقاء موثق** (مسؤولية واحدة متماسكة؛ المستهلكون الثمانية كلهم داخل بيت transfers؛ جذر الخطر تكرار المعرفة لا خلط المسؤوليات، والتقسيم لا يعالجه) — حد النمو مثبّت بالراتشة، ومحفزات المراجعة وشرط إعادة فتح التقسيم موثقة في ADR-017 وبطاقة السجل. لا يُحتسب شريحة إنتاجية في المجمع المحدود لميزانية الحزمة؛ مسار إغلاق جذر التكرار يبقى استكمال 4D (STR-104/211/509) بقرار مالك.

---

## 5. سجل الاستيرادات العميقة والدورات والتنازلات (الحالة الحالية)

| النوع | العنصر | الموقع | التصنيف |
|---|---|---|---|
| Deep import (domain) | settlementInvariant خارج البرميل | application/finance (dynamic) | STR-205 — **استثناء تصميمي مقيس (Wave B، 2026-10-03):** جرى تجربة التصدير عبر البرميل مع استيراد ثابت للعميل فرفضته بوابة الميزانية (D-034): المدخل صار 650,292 بايتًا (+1,192) فوق سقف 650,000 — التحميل الكسول عبر المسار العميق هو استراتيجية إبقاء الفحص خارج حزمة الدخول عمدًا؛ يُحمَل عند الفحص فقط (تعليق الكود الموثق)؛ محروس بحارس الحدود 4E (R1) |
| Deep import (domain) | operatingBreakEven ×2 (D-034) | application/finance/projectFinancialInsights + application/financial-analysis/financialAnalysisService | تنازل موثق D-034 (حزمة) — يبقى؛ يحرسه حارس الحدود 4E (R1). **(Wave F/ADR-013 عنقود ٣، 2026-10-04):** قراءة المؤشرات انتقلت حرفيًا من projectFinancialService.ts إلى بيته الشقيق projectFinancialInsights.ts — الحافة الموثقة نفسها (خارج حزبة الدخول عمدًا) انتقلت معها؛ أساس الحارس R1 حُدّث في نفس الـPR |
| Deep import (domain) | STR-030 alias ×2 + type import ×1 | domain-internal | موثق S2 |
| Deep import (application→domain) | integrityCheckSettlementBasis.ts:24 — استيراد ديناميكي لـsettlementInvariant من عمق craft-order (رمزه غير مصدّر من البرميل) | application → domain depth | **تصحيح تصنيف (STR-606، 2026-10-03):** الحافة نحو عمق **المجال** لا application↔application؛ المكتشف الكنسي المجمّع **STR-205** (الأصل S1:STR-108/S3:STR-313) — الاستثناء المفرد الموثق في قائمة الاستيراد العميق المسموح؛ الحل الجذري: تصديره عبر البرميل (Wave J/STR-615). **(Wave F/ADR-013، 2026-10-04):** انتقل فحص MIC-18 حرفيًا من integrityCheckService.ts:1437 إلى بيته الشقيق integrityCheckSettlementBasis.ts — الحافة الموثقة نفسها بلا تغيير سلوك؛ أساس حارس الحدود R1 حُدّث في نفس الـPR |
| Type cycle (SCC) | storage types ↔ supplierScheduleCommitGuard | storage/local | STR-307 — type-only، موثق، لا حادثة تشغيل؛ **(Wave H/STR-617 بند 1، 2026-10-04):** صار محروسًا بحارس الدورات النوعية الجديد `check-type-cycles.mjs` (أساس = هذه وحدها؛ أي SCC نوعي جديد يرفض) |
| Type cycle (SCC) | financialAnalysisService ↔ projectFinancialService (التسمية الأساس بعد 4A — الاسم التاريخي كان g5Service) | application | **أُغلقت (Wave E/STR-620، 2026-10-04):** فُكّت ميكانيكيًا — أنواع القراءة المشتركة (ProjectFinancialPosition وسلسلة أدلتها وFinanceResult) انتقلت حرفيًا إلى `finance/projectFinancialTypes.ts` الورقية التي يعيد تصديرها القارئ الكنوني كما هي؛ والتحليل يعلن حقنه بالنوع البنيوي `ProjectFinancialReader` (readPosition وحدها — قياس حي). الحافة المتبقية تشغيلية باتجاه واحد (القارئ يستورد expenseInputs/orderInputs من التحليل) — صفر SCC على أي مستوى |
| Type cycle (SCC) | FinancePeriodResultSection ↔ pages/Finance | component↔page (type-only) | STR-204c — جذر مكوّن داخل صفحة؛ Wave T للفك البصري |
| ESLint waiver | StartupGate storage import | apps/…/app/StartupGate.tsx | تنازل موثق في eslint.config.js |
| ESLint waiver | PrototypeServicesContext storage import | composition root | تنازل موثق |
| ESLint waiver | page/component test localStorage | ملفات اختبار | تنازل موثق |
| ESLint waiver | domain-test vitest | tests/domain | تنازل موثق |
| ESLint waiver | shared Math | domain/shared | تنازل موثق (مقارنات آمنة) |
| ESLint waiver | application Math ×3 | **diagnostics/home/input** (تصحيح موقع — STR-606: `localDiagnosticsService.ts` + `homeControlCenterService.ts` + `englishNumeric.ts` — كلها غير مالية: معرّف خطأ، فرق أيام، حدود تمثيل؛ الملفات الثلاثة معدة في eslint.config.js حرفيًا) | تنازل موثق |
| ESLint waiver | storage types → UI (type-only) | 17 ملف UI (تصحيح عدّ — STR-606، 2026-10-03: قياس حي pages+components بلا اختبارات، بكل الامتدادات = 17؛ كان الجدول يقول 16) | سياسة موثقة (STR-305 قرار مالك مؤجل) |
| Application→presentation | 14 حافة قيمة / 12 ملفًا | application → presentation/formatters | STR-203 — OWNER_DECISION_REQUIRED (waiver أو نقل — Wave G) |
| UI→domain direct | 13 حافة قيمة عند القياس الحي 4E (8 صفحات) | UI → domain | STR-106 — OWNER_DECISION_REQUIRED (سياسة اتجاه)؛ **مجمّدة بحارس الحدود 4E (R2)** — العدد الحي 13 (كان 16 عند بذرة v1.0 قبل موجات 3A-4D)؛ **(Wave H/STR-617 بند 4، 2026-10-04):** ضمّت طبقة العرض presentation إلى UI_LAYERS فصار الأساس 15 (13 + حافتا catalogPresentation وownerEntitlementPresentation المؤرختان — formatters انتقلت للتطبيق في Wave B)؛ أي حافة عرض→مجال جديدة تُرفض الآن بدل أن تمر خارج الحراسة |
| Deep import (domain-internal cross-area) | 3 أزواج عميقة عابرة للمناطق (recurring-expense→financial-event نوعي؛ recurring-margin→inventory-material قيمة+نوع) | domain-internal | **(Wave H/STR-617 بند 2، 2026-10-04):** كانت بلا قاعدة (المراقب يستثني layer=domain) — صارت مجمدة بقاعدة R4 الجديدة في حارس الحدود (الأساس الثلاثة الموثقة أعلاه STR-030/مالك سياق الهدر)؛ أي زوج جديد يُرفض حتى صف سجل |
| UI→storage runtime (resolution-based) | حافتا القيمة الموثقتان (StartupGate → persistentStorage؛ PrototypeServicesContext → createBrowserLocalStore) | app-shell → storage/local | **(Wave H/STR-617 بند 3، 2026-10-04):** قاعدة R5 الجديدة في حارس الحدود تعدّ بحل الاستيرادات فلا إفلات بمسار نسبي (مكمل ESLint النصي) — الاستثناءان هما نفسيهما تنازلي ESLint الموثقين أدناه بشروط إزالة مسار UI؛ أي حافة قيمة ثالثة تُرفض |

**قاعدة السجل:** أي استثناء جديد يحتاج صفًا هنا + سببًا + تاريخ مراجعة. الرقم الحالي خط أساس — **الحارس (Wave 4E/RC-9 — منفذ؛ موسّع Wave H/STR-617 — 2026-10-04) يمنع الزيادة الصامتة**: `scripts/check-module-boundaries.mjs` (قائم على الفَلْحة/AST) يجمد الأساس المقبول (3 استيرادات عميقة داخل المجال؛ 15 حافة واجهة→مجال بعد ضم العرض؛ 0 حافة تطبيق→عرض؛ 3 أزواج عميقة عابرة لمناطق المجال R4؛ حافتا واجهة→تخزين R5) ويرفض أي حافة جديدة فوقه، و`scripts/check-type-cycles.mjs` يجمد الدورات النوعية (أساس 1)، و`scripts/check-registry-coverage.mjs` يوجب ذكر كل بيت تطبيق ومنطقة مجال في هذا السجل، و`scripts/check-acceptance-value-anchors.mjs` يثبت مراسي قيم القبول الأربعة (STR-623)، و`scripts/check-file-size-ratchet.mjs` يرفض أي تصعيد شريطي حجمي فوق أساس JSON مراجَع — تحديث الأساس عمدًا في نفس PR الحافة المشروعة/النمو المسجل مع صف هنا، لا بعده.

> **توضيح تسمية «تحصين الحدود» (STR-622 — تصحيح ضمن دفعة STR-601/606، 2026-10-03):** Wave 4E سلّمت **تجميدًا + راتشة** (لا نمو صامت فوق الأساس المقبول)، لا حلًا لسياستي الاتجاه المفتوحتين (STR-106/STR-203) — الحواف القائمة تبقى قائمة بقرار مالك (Wave G/STR-609) ولا يجوز أن يقرأ أحد إغلاق 4E على أن الحدود «حُلّت».

---

## 6. القرارات المفتوحة المرتبطة بالملكية (تُحسم عند المالك لا هنا)

| # | القرار | البند | الحالة (تحديث Wave G — 2026-10-03) |
|---|---|---|---|
| 1 | سياسة اتجاه UI→domain (قراءة قيمة صرفة) | STR-106 | **محسومة بقرار مالك مجمع** — ADR-011 §1: استثناء مؤقت محروس بشرط ترحيل قابل للقياس (13→0 عند فتح مسار UI) |
| 2 | سياسة application→presentation (waiver أم نقل نواة التنسيق) | STR-203 | **محسومة** — ADR-011 §2: إعادة توجيه جذرية (استخراج البدائل النقية إلى بيت محايد + إعادة تصدير توافقي) في Wave B؛ الشرط 14→0 |
| 3 | توطين قواعد حسابية في application (settlement arithmetic، withdrawalWalletGuard، derivePeriodCogs) — مسار دلالي مستقل | STR-302 | **يبقى مسارًا دلاليًا مستقلًا (R)** — خارج البرنامج البنيوي؛ لا يفتح إلا بقرار مالك مستقل بمدى exact |
| 4 | shortCashDeclarations: يبقى سجلًا مخزنًا بملكية g5 (توصية) أم ينقل | قيد 4A | يبقى سجلًا مخزنًا بملكية domain/financial-analysis المسجلة (قدرة Wave C مجموعة 5 تستخرج منفذها دون تغيير ملكية السجل) |
| 5 | عرض أنواع التخزين كـview models للـUI | STR-305 (Wave T-adjacent) | يبقى بقرار مالك مؤجل (مسار UI) — الاستثناء موثق ومعدد (17 ملفًا — تصحيح STR-606) |

> **قرارات Wave G المسجلة (2026-10-03، بالتفويض المجمع):** STR-608 هامش الميزانية → **ADR-012** (تنميط + ضغط أولًا؛ الرفع ملاذ أخير موثق)؛ STR-609 → **ADR-011**؛ STR-610 تصديق البطاقات → **ADR-010**؛ STR-611 العناقيد الثلاثة → **ADR-013** (حفظ الفحص/التشخيص ونماذج القراءة بعقد 40 + **نقل المصروف المتكرر إلى `application/recurring/` في Wave E**)؛ STR-612 → **ADR-014** (تقسيم داخلي في Wave F)؛ STR-613 ترتيب القدرات → **ADR-015**؛ STR-614 شيمة السحب → **ADR-016** (هجرة المستهلك الوحيد غير-UI + إزالة الشيمة في Wave E — العدد 9→8).

**حالة السجل:** مفاهيم المجال 18/18 مملوكة؛ منافذ التخزين 131/131 مصنفة (الطيار 4C منفذ: قدرة Order lifecycle مستخرجة بمنفذ مشتق ومستهلكين مهاجرين)؛ خدمات المالية 20+1/20+1 مصنفة في 6 عناقيد (طيار Owner Money منفذ في 4B)؛ فجوة قياس الدريفت مغلقة بغارد Wave 3B (طبقتا تشغيل وأنواع)؛ الاستثناءات والدورات كلها مسجلة. لا مفهوم عالي الخطورة بلا صف.
