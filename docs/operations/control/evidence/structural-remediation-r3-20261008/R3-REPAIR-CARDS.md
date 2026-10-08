# R3 Repair Cards — Storage Capability Extraction (WS-216 / ARCH-007)

**البرنامج:** `WS-216` / `ARCH-007` — successor البنيوي R0–R10.
**الموجة:** R3 — استخراج قدرات التخزين وإصلاح البوابة الكبيرة (البرنامج كاملًا — لا pilot).
**تاريخ الإنشاء:** 2026-10-08 (قبل أي تغيير إنتاجي — بوابة العقد §R3 والخطة R3 وأمر المالك «Full R3 Storage Execution»).
**الأساس الحي عند إنشاء البطاقات:** `origin/main` = `b5a9ec3802abd603b5f372aed7dbd10e104a01bf` (فرع التنفيذ `refactoring/r3-storage-capabilities-20261008` منشأ منه بعد دمج R2: PR #330 @ `a0224d6` + مصالحتها PR #331 @ `b5a9ec3`).
**منهج الجرد:** مسح قراءة-فقط حي للمنفذ والمستهلكين (عدّ أعضاء `PrototypeLocalStore` في `storage/local/types.ts` بالضبط؛ تعداد مستهلكين آلي لكل مجموعة عبر استدعاءات `store.<method>` في ملفات الإنتاج غير الاختبارية) + مراجعة تخصصية S2 (قدرات التخزين) وS3 (المعمارية) وS4 (الاختبارات/الأمان) وS5 (السجلات) — كلها دُمجت هنا قبل التنفيذ.

**قاعدة الحدود المشتركة لكل البطاقات (تُقتبس ولا تُعاد):** النمط المثبت RC-7/4C/Wave-C حصرًا: واجهة قدرة **مشتقة** `Pick` من `PrototypeLocalStore` (لا عقد موازٍ أبدًا) + مراسي نوعية للمحوّلين والواجهة + عقد اختبار مشترك يعمل على المحوّلين معًا (Memory مباشرة وIndexedDB عبر fake-indexeddb) + هجرة ميكانيكية للمستهلكين إلى النوع الضيق + بقاء الـfacade. لا تغيير Schema 38 / Export 30 / هجرات / لقطات / Transfer قبول داخل شريحة قدرة؛ الحراس التسعة ومعنى واحد لـidempotency وCAS و`storage_stale` محفوظة؛ لا حذف طريقة من الواجهة إلا بإثبات صفر مستهلكين في خطوة منفصلة لاحقة. كل شريحة قابلة للرجوع مستقلة (revert واحد — لا أثر بيانات).

---

## R3-SC-00 — الجرد الحي للمنفذ والمستهلكين (Census)

- **التصنيف:** `INVENTORY` (توثيق محض).
- **المنفذ الحي:** `PrototypeLocalStore` في `apps/prototype-web/client/src/storage/local/types.ts:429-884` — **130 طريقة بالضبط** (عدّ آلي مؤكد؛ يطابق تصحيح R1/TG-01 المؤرخ 2026-10-07: إزالة STR-618 لـ`getActualTimeRecord`). المخطط 38 (`types.ts:55`) والتصدير 30 (`types.ts:71`).
- **المحوّلان:** `IndexedDbLocalStore` (4,137 سطرًا؛ 130/130) و`MemoryLocalStore` (2,095 سطرًا؛ 130/130) — تطابق مجموعة الطرق تام (فرق المجموعتين المرتبتين فارغ).
- **القدرات المستخرجة سابقًا (7 تغطي 54 طريقة):** orderLifecycle (9)، ownerEntitlement (14)، loan (10)، recurringExpense (10)، expenseBudget (3)، allocationPolicy (4)، shortCashDeclaration (4) — لكل منها مراسي + عقد سلوك مزدوج المحوّل.
- **المتبقي غير المغطى:** 76 طريقة في 14 مجموعة (جرد المستهلكين الحي أدناه).
- **حاقنو المنفذ الكامل:** 48 ملف إنتاج تطبيقي يحقن `PrototypeLocalStore` كاملًا؛ 13 ملفًا بالفعل على أنواع ضيقة (قدرات أو `Pick`)؛ 5 مواقع UI تنشئ خدمات عبر `getPrototypeLocalStore()` (Loans.tsx:58، ReceivedLoanDetail.tsx:62، ReceivedLoanEditor.tsx:87، ExpenseBudgetsSectionBody.tsx:82، Finance.tsx:19)؛ جذر تركيب واحد `PrototypeServicesContext.tsx` (367 سطرًا، ~40 خدمة).
- **الحراس التسعة (كلها مشتركة بين المحوّلين):** orderCommitGuard، deliveryReversalCommitGuard، supplierScheduleCommitGuard (عائلتا مورد+جدول)، recurringExpenseCommitGuard، cashContinuityCommitGuard، expenseBudgetCommitGuard، loanCommitGuard، receivedLoanCommitGuard، supplierAttributionCommitGuard.
- **حدود R4 المحمية:** `readSnapshot`/`replaceSnapshot` مستهلكان حصريًا بخدمتَي Transfer (EXE-014 النسخ الاحتياطي قبل الاستبدال)؛ المفاتيح الذهبية للتصدير في `docs/fixtures/export-goldens/**`؛ لا قدرة تُنشئ تعرض زوج اللقطة.
- **القيود المعمارية الناقلة (S3):** types.ts يبقى结构的ًا كما هو (SPLIT_CANDIDATE مؤجل لبوابة Wave O — القدرات ملفات Pick منفصلة لا تشطر الواجهة)؛ لا نطاق SCC نوعي ثانٍ غير `types.ts ↔ supplierScheduleCommitGuard`؛ `transferSnapshotValidation.ts` عند 1192/1199 — صفر أسطر تُضاف؛ القدرات تُستهلك type-only من طبقة التطبيق (لا باب تخزين ولا تعميم)؛ راتشة R6 (43 مفتاحًا/47 سجلًا) لا تتغير.
- **متطلبات كل بطاقة EXTRACT_NOW (غير قابلة للتفاوض، من ADR-015):** جرد مستهلكين؛ المصدر السلطوي = `Pick` من المنفذ؛ مطابقة IndexedDB+Memory (عقد مشترك)؛ اختبارات parity؛ حد رجوع؛ تسجيل bytes الحزمة؛ حذف طريقة facade فقط بإثبات صفر + قبول منفصل.

### مصفوفة المجموعات الحية (130 طريقة → 15 مجموعة)

| المجموعة | الطرق | مستهلكو الإنتاج | القدرة الموجودة | القرار |
|---|---|---|---|---|
| Order Lifecycle | 9 | 31 | ✅ orderLifecycleStore | **EXTRACT_NOW** (إكمال هجرة المستهلكين) |
| Owner Entitlement | 14 | 3+ | ✅ ownerEntitlementStore | KEEP (مكتملة) |
| Financial Events | 5 | 21 | — | **EXTRACT_NOW** |
| Supplier Purchases | 5 | 14 | — | **EXTRACT_NOW** |
| Direct Sales | 3 | 13 | — | **EXTRACT_NOW** |
| Assets | 4 | 4 | — | **EXTRACT_NOW** |
| Expense Budgets | 3 | 1 | ✅ expenseBudgetStore | KEEP (مكتملة) |
| Cost Estimates | 4 | 1 | — | **EXTRACT_NOW** |
| Inventory/Materials | 8 | 17 | — | **EXTRACT_NOW** |
| Loans (+deposit classification) | 10 | 3 | ✅ loanStore | KEEP (مكتملة) |
| Recurring Expense | 10 | 1 | ✅ recurringExpenseStore | KEEP (مكتملة) |
| Schedules + Recurrences | 9 | 3 | — | **EXTRACT_NOW** |
| Allocation Policies | 4 | 1 | ✅ allocationPolicyStore | KEEP (مكتملة) |
| Short Cash | 4 | 1 | ✅ shortCashDeclarationStore | KEEP (مكتملة) |
| Catalog | 13 | 8 | — | **EXTRACT_NOW** |
| Actual Time | 2 | 3 | — | **EXTRACT_NOW** |
| Cash Continuity/Wallets | 3 | 17 | — | KEEP (استثناء موثق R3-SC-19) |
| Identity/Profile/Prefs/Security | 9 | 9 | — | KEEP (استثناء موثق R3-SC-18) |
| Drafts + Form Drafts | 9 | 4 | — | KEEP (استثناء موثق R3-SC-17) |
| Backup/Snapshot/Transfer | 2 | 2 | — | R4_BOUNDARY (R3-SC-16) |

مجموع EXTRACT_NOW الجديدة: 9 قدرات / 53 طريقة. إكمال الهجرة: Order Lifecycle (31 مستهلكًا) + مستهلكو المجموعات الجديدة (تُهاجر مع شريحتها) + القرّاء العابرون للعائلات يتحولون إلى `Pick` موضعي (نمط statementService المثبت).

---

## R3-SC-01 — Order Lifecycle: إكمال هجرة المستهلكين إلى القدرة الموجودة

- **المالك:** المفهوم `domain/craft-order`؛ المنفذ `OrderLifecycleStore` (موجود، 9 طرق، عقد مطابقة مزدوج 394 سطرًا).
- **الطرق:** listOrders, getOrder, saveOrder, commitOrderUpdate, commitOrderCollectionReversal, commitDepositRefundSettlement, commitOrderFromDraft, commitOrderDelivery, commitOrderDeliveryReversal.
- **المستهلكون (31 ملفًا):** agreements×2 (agreementService 4، agreementContextService 3)، fulfillment×2 (fulfillmentService 4، deliveryReviewService 3)، collections×2، retainedDepositService، inventoryMaterialReads، financialAnalysisService، activityService، collectionService، integrityCheckAssetsLoans/Continuity/Inventory×3، financialPulseService، correctionHistoryService، dailyFollowUpService، inventoryMaterialWaste/Writes×2، ownerEntitlementService، partyLedgerService، recurrenceService، scheduleService، actualTimeService، homeControlCenterService (قراءات عبر منافذ أخرى أحيانًا)…
- **الحارس:** orderCommitGuard (G-003) + deliveryReversalCommitGuard (D-031) — داخل المحوّلين، لا يُمسّان.
- **التصنيف:** `EXTRACT_NOW` (إكمال هجرة — الواجهة والمراسي موجودة؛ العمل = تحويل 31 مستهلكًا من المنفذ الكامل إلى `OrderLifecycleStore` أو `Pick` موضعي متعدد العائلات).
- **الحد الأدنى للإصلاح الجذري:** كل مستهلك أحادي العائلة يأخذ `OrderLifecycleStore`؛ كل قارئ متعدد العائلات يعرّف `Pick` موضعيًا يسرد طرقه بالضبط (نمط statementService)؛ `saveOrder` تظل في العضوية (سطح دعم اختبارات STR-618) بلا مستهلك إنتاج.
- **الاختبارات:** عقد القدرة موجود؛ تُضاف اختبارات تجميعية فقط إن لزم؛ typecheck يثبت الانسداد البنيوي.
- **حد الرجوع:** revert الشريحة — لا أثر بيانات (تغييرات أنواع وتوقيعات حقن فقط).

## R3-SC-02 — Financial Events Store (جديد)

- **المالك:** المفهوم `domain/financial-event`؛ الكاتب `application/finance/projectFinancialEventWrites` (4 طرق كتابة).
- **الطرق (5):** listFinancialEvents, getFinancialEvent, saveFinancialEvent, commitFinancialEventCorrection, commitFinancialEventReplacement.
- **المستهلكون (21):** الكاتب أعلاه؛ قرّاء: assetService (commitFinancialEventCorrection)، financialAnalysisService، recurringExpenseService، expenseBudgetService، statementService، correctionHistoryService، retainedDepositService، integrityCheckService/OffenderSummaries، profitToCashBridgeService، projectFinancialReads/PeriodReads/Insights، activityService، homeControlCenterService، inventoryMaterialWrites، loanService، receivedLoanService، ownerEntitlementService، partyLedgerService (أغلبهم list فقط).
- **الحارس:** لا حارس ملف مستقل — الكتابة المحروسة داخل المحوّلين (idempotency + CAS داخل transaction) — يوثّق في البطاقة أن الاستخراج type-only لا يمس الحماية.
- **التصنيف:** `EXTRACT_NOW`.
- **الإصلاح الأدنى:** `financialEventStore.ts` (Pick 5) + مراسي + عقد مطابقة (عضوية + سلوك: حفظ حتمي، تصحيح/استبدال محرسان، storage_stale بلا كتابة) + هجرة الكاتب والقرّاء الأحاديين؛ القرّاء متعددو العائلات `Pick`.
- **الاختبارات:** عقد جديد `financialEventCapability.contract.test.ts` (العدسة الضيقة على المحوّلين معًا).
- **حد الرجوع:** revert مستقل — أنواع فقط.

## R3-SC-03 — Supplier Purchase Store (جديد)

- **المالك:** المفهوم `domain/supplier-purchase`؛ الكاتب `supplierPurchaseService` (4).
- **الطرق (5):** listSupplierPurchases, getSupplierPurchase, saveSupplierPurchase, commitSupplierPurchase, commitSupplierPurchaseWithAttribution.
- **المستهلكون (14):** الكاتب؛ قرّاء: activityService، dueDatesService، integrityCheckInventory/OffenderSummaries/SupplierWallet، profitToCashBridgeService، projectFinancialReads، statementService، financialAnalysisService، correctionHistoryService، inventoryMaterialReads/Writes، partyLedgerService.
- **الحرّاس:** supplierScheduleCommitGuard (HIGH-001، عائلتا مورد+جدول في ملف واحد — STR-306 PRESERVE لا يُشطر) + supplierAttributionCommitGuard (G-002).
- **التصنيف:** `EXTRACT_NOW`. **قيود إضافية (S2-NF-4):** إضافة اختبار سالب مباشر لمسار supplierAttribution (الوحدة الوحيدة غير المباشرة اليوم) ضمن شريحة هذه القدرة.
- **الإصلاح الأدنى:** Pick 5 + مراسي + عقد (idempotency المورد، attribution الشفاء الذري، storage_stale) + هجرة.
- **حد الرجوع:** revert مستقل.

## R3-SC-04 — Direct Sale Store (جديد)

- **المالك:** `domain/direct-sale`؛ الكاتبان `directSaleService` (2) و`saleCollectionReversalService` (2).
- **الطرق (3):** listDirectSales, saveDirectSale, commitDirectSaleCollectionReversal.
- **المستهلكون (13):** الكاتبان؛ قرّاء: activityService، collectionService، profitToCashBridgeService، projectFinancialReads/PeriodReads، statementService، correctionHistoryService، homeControlCenterService، inventoryMaterialReads/Writes، partyLedgerService.
- **التصنيف:** `EXTRACT_NOW`. **قيد (S4-FC-5):** العكس مختبر Memory-only اليوم — عقد القدرة الجديد يغطي `commitDirectSaleCollectionReversal` على المحوّلين معًا (يسد الفجوة).
- **الإصلاح الأدنى:** Pick 3 + مراسي + عقد (عكس المجموعة المحرس، storage_stale) + هجرة.
- **حد الرجوع:** revert مستقل.

## R3-SC-05 — Asset Store (جديد)

- **المالك:** `domain/asset`؛ الكاتب `assetService` (4).
- **الطرق (4):** listAssets, getAsset, commitAssetRecord, commitAssetAcquisitionCorrection.
- **المستهلكون (4):** assetService، integrityCheckAssetsLoans، integrityCheckOffenderSummaries، correctionHistoryService.
- **التصنيف:** `EXTRACT_NOW` (ADR-015 أجّلها لـ«عدسة مطابقة بعد Wave-C» — هذه العدسة هي R3).
- **الإصلاح الأدنى:** Pick 4 + مراسي + عقد (commit محرس، تصحيح الاستحواذ الذري، storage_stale) + هجرة الكاتب والقرّاء.
- **حد الرجوع:** revert مستقل.

## R3-SC-06 — Cost Estimate Store (جديد)

- **المالك:** `domain/cost-estimate` (تقديرات الطلب)؛ المستهلك الوحيد `costEstimateService` (4).
- **الطرق (4):** listCostEstimates, getCostEstimate, saveCostEstimate, deleteCostEstimate.
- **التصنيف:** `EXTRACT_NOW` (بطاقة بسيطة: مستهلك واحد).
- **الإصلاح الأدنى:** Pick 4 + مراسي + عقد (حفظ/حذف حتمي) + هجرة الخدمة الوحيدة.
- **حد الرجوع:** revert مستقل.

## R3-SC-07 — Inventory/Materials Store (جديد)

- **المالك:** `domain/inventory-material`؛ عائلة الكتّاب `application/inventory/*` (7 وحدات: Activation, Lifecycle, Reads, Shortages, Waste, Writes, Service المنسق).
- **الطرق (8):** listMaterials, listInventoryMovements, getInventoryActivation, saveInventoryActivation, commitInventory, listInventoryShortages, commitInventoryWithShortage, commitInventoryWithEvents.
- **المستهلكون (17):** عائلة inventory (كلها)؛ قرّاء: integrityCheckInventory (3)، projectFinancialPeriodReads (3)، activityService، deliveryReviewService (2)، catalogService، integrityCheckAssetsLoans/OffenderSummaries، projectFinancialInsights، recurringWorkService، correctionHistoryService، supplierPurchaseService.
- **الحارس:** مفهوم «inventory commit guard» منطق داخل-المحوّل (STR-606/STR-306) — لا يُجسَّد ملفًا.
- **التصنيف:** `EXTRACT_NOW`.
- **الإصلاح الأدنى:** Pick 8 + مراسي + عقد (commitInventory الذري مع النقص/الأحداث، storage_stale) + هجرة عائلة الكتّاب والقرّاء الأحاديين.
- **حد الرجوع:** revert مستقل.

## R3-SC-08 — Schedule Store (جديد: جداول + تكرارات)

- **المالك:** `domain/schedule` + `domain/recurrence`؛ الكاتبان `scheduleService` (4+1) و`recurrenceService` (2+3+1).
- **الطرق (9):** listSchedules, getSchedule, saveSchedule, commitScheduleCreate, commitScheduleUpdate, listRecurrences, getRecurrence, saveRecurrence, commitRecurrence.
- **المستهلكون (3):** scheduleService، recurrenceService، homeControlCenterService (listSchedules فقط).
- **الحارس:** supplierScheduleCommitGuard (عائلة الجدول) — يبقى في ملفه المشترك (قيود S2-NF-3 موثقة).
- **التصنيف:** `EXTRACT_NOW` (قدرة واحدة للعائلتين المتجاورتين — MERGE داخلي بمنطق «store family» واحد؛ `saveSchedule`/`saveRecurrence` سطح دعم اختبارات STR-618 يبقى في العضوية).
- **الإصلاح الأدنى:** Pick 9 + مراسي + عقد (CAS الجدول، ذرية التكرار/الاستثناء، storage_stale) + هجرة الكاتبين والقارئ.
- **حد الرجوع:** revert مستقل.

## R3-SC-09 — Catalog Store (جديد)

- **المالك:** `domain/catalog`؛ الكاتب `catalogService` (13) + `templatePlannedCostService` (2 قراءة+حفظ قوالب).
- **الطرق (13):** listCatalogItems, getCatalogItem, saveCatalogItem, listMeasurementUnits, getMeasurementUnit, saveMeasurementUnit, listDirectConversions, getDirectConversion, saveDirectConversion, listCatalogTemplates, getCatalogTemplate, saveCatalogTemplate, commitCatalogTemplateRevision.
- **المستهلكون (8):** catalogService، templatePlannedCostService، projectFinancialInsights (3)، financialAnalysisService (3)، recurringWorkService (2)، inventoryMaterialReads/Writes (2)، deliveryReviewService (1).
- **التصنيف:** `EXTRACT_NOW` (كاتب واحد رئيسي؛ أبعاد الكتالوج الثلاثة items/units/conversions+templates عائلة متجر واحدة).
- **الإصلاح الأدنى:** Pick 13 + مراسي + عقد (مراجعة القالب المحروسة commitCatalogTemplateRevision، storage_stale) + هجرة.
- **حد الرجوع:** revert مستقل.

## R3-SC-10 — Actual Time Store (جديد)

- **المالك:** `domain/actual-time`؛ الكاتب `actualTimeService` (2).
- **الطرق (2):** listActualTimeRecords, saveActualTimeRecord.
- **المستهلكون (3):** actualTimeService، recurringWorkService (قراءة)، ownerEntitlementService (قراءة).
- **التصنيف:** `EXTRACT_NOW` (ADR-015 أجّلها لعدسة المطابقة — تُنفذ هنا).
- **الإصلاح الأدنى:** Pick 2 + مراسي + عقد (حفظ حتمي بلا حارس كتابة — توثيق صريح) + هجرة.
- **حد الرجوع:** revert مستقل.

## R3-SC-11 → R3-SC-15 — القدرات المكتملة (KEEP — لا عمل تنفيذي)

- **R3-SC-11 Owner Entitlement (14):** مكتملة (ownerEntitlementService على Omit؛ الكاتب الوحيد)؛ احتفاظ موثق لموقعَي projectFinancialService/projectFinancialReads (قرار Wave-F مسجل سجل الملكية §2 صف 48) — يراجعان عند شطر Wave F لاحقًا.
- **R3-SC-12 Expense Budgets (3):** مكتملة (المستهلك الوحيد مهاجر).
- **R3-SC-13 Loans + deposit classification (10):** مكتملة (3 مستهلكين)؛ احتفاظ integrityCheck موثق (صف 57).
- **R3-SC-14 Recurring Expense (10):** مكتملة (المستهلك الوحيد).
- **R3-SC-15 Allocation (4) + Short Cash (4):** مكتملتان باستقلال مثبت (كتّاب وحيدون: recurringWorkService/financialAnalysisService) — إثبات الاستقلال مسجل (قرار المالك: منفصلتان).
- **حدود النمو/مراجعة كل KEEP:** أي تغيير توقيع في الواجهة السلطوية يفشل المراسي فورًا؛ سجل النمو في FILE-SIZE-AND-RESPONSIBILITY-REGISTER؛ شرط الإزالة (لو تغيرت الملكية مستقبلًا): بطاقة جديدة بقرار مالك.

## R3-SC-16 — Backup/Snapshot/Transfer: R4_BOUNDARY (محمي)

- **الطرق (2):** readSnapshot, replaceSnapshot — مستهلكان حصريان: `localTransferService` + `guidedOpeningImportService` (EXE-014 النسخة المحققة قبل الاستبدال، عقد 39، المفاتيح الذهبية).
- **القرار:** `R4_BOUNDARY` — لا تُنشأ قدرة تعرض زوج اللقطة في R3 (أي قدرة كهذه تنتهك قاعدة الكاتب الوحيد PA-1 وتفتح باب استبدال بلا نسخة احتياطية). تعرّف النوع الضيق داخل بطاقة R4 عند فتحها بقرار مالك.
- **المحفوظات:** عائلات اللقطة المؤثرة (influentialSnapshotFamilies.ts)، عاديّة الحقول الاختيارية، عدم شمول formDrafts/localSecurity في اللقطة — كلها كما هي.

## R3-SC-17 — Drafts + Form Drafts: KEEP (استثناء موثق)

- **الطرق (9):** listDrafts/getDraft/saveDraft/deleteDraft + getFormDraft/saveFormDraft/deleteFormDraft/listFormDrafts/clearFormDrafts.
- **المستهلكون (4):** draftService، formDraftService، costService (saveDraft واحد)، dailyFollowUpService (واحد).
- **سبب KEEP:** سطح دعم اختبارات STR-618 (saveDraft/saveFormDraft بلا مستهلك إنتاج كامل) + بنية تحتية تطبيقية مستقرة (مسودات النماذج تُستبعد من اللقطة عمدًا)؛ الاستخراج يضيف نوعًا بلا خفض مخاطر تغيير (حارس غير موجود، اتصال محدود، توقيع ثابت منذ التأسيس). **حد النمو:** أي طريقة رابعة تُضاف للعائلة تعيد فتح البطاقة. **محفز المراجعة:** ربط المسودات ببيت تطبيقي مستقل أو دخولها اللقطة. **شرط الإزالة:** قرار مالك بعد إثبات حاجة مستهلك جديد.

## R3-SC-18 — Identity/Profile/Prefs/Security: KEEP (استثناء موثق)

- **الطرق (9):** getProfile/saveProfile/getOwnerProfile/saveOwnerProfile/getPreferences/savePreferences/getLocalSecurity/saveLocalSecurity/deleteLocalSecurity.
- **المستهلكون (9):** localLockService (3)، homeControlCenterService (2)، ownerProfileService (2)، updateLocalPreferences (2)، profileService (2)، preferenceService (1)، inventoryMaterialReads (1 getPreferences)، scheduleService (1)، actualTimeService (1).
- **سبب KEEP:** مجموعات قراءة مشتركة لبنية التطبيق (هوية/تفضيلات/قفل) لا مفاهيم أعمال؛ ملكية القفل محروسة بعقد الأمان المحلي وترتبط بجذر التركيب مباشرة؛ ADR-015 صنفها «تبقى خلف الـfacade by design». الاستخراج يضيف 3 أنواع لأطراف تُدار أساسًا في الجذر. **حد النمو:** عائلة تتجاوز 3 طرق لكل مفهوم تعيد الفتح. **محفز المراجعة:** نقل الهوية/التفضيلات لخدمة مزامنة مستقبلية. **شرط الإزالة:** قرار مالك.

## R3-SC-19 — Cash Continuity/Wallets: KEEP (استثناء موثق)

- **الطرق (3):** listCashWallets, listCashContinuityEntries, commitCashContinuity.
- **المستهلكون (17):** كتاب عبر القدرات (delivery، direct sale، supplier، owner withdrawal، عدّ الصندوق، العكوس…) + قرّاء تحليليون — سطح الكتابة النقدي المشترك للسيولة.
- **سبب KEEP:** قرار ADR-015 مسجل («cash liquidity خلف الـfacade by design»)؛ المجموعة هي قناة الكتابة النقدية العرضية المشتركة بين تسع قدرات — استخراجها ك«قدرة» يوهم ملكية واحدة لما هو أصلاً قناة سيولة مشتركة محروسة بـcashContinuityCommitGuard ومعنى storage_stale واحد؛ الحارس والمعنى محفوظان بالفعل في المحوّلين. الاستخراج type-only لن يغير أي سلوك لكنه يضيف نوعًا مستهلكًا 17 مرة بلا خفض مخاطر. **حد النمو:** طريقة رابعة للعائلة تعيد الفتح. **محفز المراجعة:** شطر السيولة لقدرات محافظ منفصلة. **شرط الإزالة:** بطاقة مالك عند تغيّر نموذج المحافظ.

---

## بطاقات المكتشفات المرافقة (من مراجعات S1–S5 — دُمجت هنا قبل التنفيذ)

- **R3-N1 (S2-NF-5):** ADR-015 يقول «Owner entitlement (15 طريقة)» والحي 14 — تصويب مؤرخ في سجل ADR-015 ضمن شريحة السجلات.
- **R3-N2 (S4-FC-1):** اختبارات القراءة القديمة (D11) عبر Memory فقط — تقوية اختيارية: جناح IndexedDB للبذرة القديمة. **القرار:** يُنفذ ضمن R3 (رخيص، يسد فجوة ثقة) — لا ينتظر.
- **R3-N3 (S2-NF-4/S4-NF-S4-4):** أربعة حرّاس بلا اختبار وحدة مباشر (expenseBudget/loan/receivedLoan/supplierAttribution) — كل شريحة قدرة تمس أحدها تضيف اختبارًا سالبًا مباشرًا (نمط derivationCoupling).
- **R3-N4 (S1-NF-B):** استيراد ميت `ammanDateOrNull` في projectFinancialEventWrites.ts:18 (موجود في الأساس) — يُنظف ضمن شريحة Financial Events (سطر واحد، بلا سلوك).
- **R3-N5 (S4-NF-S4-1):** `ci.yml` يذكر فرع R1 المتقاعد في محفزات push — قرار مالك (بند مالك، لا يُمس في R3).
- **R3-N6 (S3-NF-2):** transferSnapshotValidation عند 1192/1199 — قيد موثق: صفر أسطر تضاف في R3 كله (ملف R4).
- **R3-N7 (S2-NF-13):** تسمية مرسِ orderLifecycle (PrototypeLocalStoreFacadeSatisfies...) تخالف الست الأخرى — توحيد تجميلي ضمن شريحة Order Lifecycle.

**خريمة التنفيذ (متسلسل، شريحة واحدة لكل commit):** S0 هذه البطاقات → S1 Financial Events → S2 Supplier Purchases → S3 Direct Sales → S4 Assets → S5 Cost Estimates → S6 Inventory/Materials → S7 Schedules → S8 Catalog → S9 Actual Time → S10 Order-Lifecycle consumer migration (+R3-N7) → S11 القرّاء العابرون (Pick موضعي، حسب البيوت) → S12 السجلات (ADR-015 تصويب R3-N1، registry، WS-216/ARCH-007، تقرير R3، current-state، اللوق §147، worklog Entry 56) → S13 تدقيق عدائي نهائي → البوابة النهائية.
