# خريطة الاختبارات والتوثيق — سجل G2 (STR-619)

**الإصدار:** v1.0 (Wave G2 — 2026-10-04)
**الغرض:** إغلاق فجوات موجة Q الموثقة في STR-619: خريطة صفحة→اختبار **مولّدة**، وربط العقود→الرقابة، واصطلاح موضع الاختبارات، وصفوف الملكية الناقصة — بقبول واحد: **صفر وحدة مقبولة بلا دليل تغطية أو سبب موثق.**
**مصدر الأدلة المولّد:** `docs/architecture/refactoring/generated/test-map.json` — يولّده `scripts/generate-test-map.mjs` من الشجرة الحية (استيرادات الاختبارات الفعلية + مسارات MicroRouter المسجلة + استشهادات أسماء العقود)، ودبوس الانجراف `scripts/generate-test-map.test.mjs` يثبت أن الأدلة الملتزمة تطابق الشجرة دائمًا (يعيد التوليد ويقارن).
**إعادة التوليد:** `node scripts/generate-test-map.mjs` (كتابة) / `node scripts/generate-test-map.mjs --check` (فحص الانجراف بلا كتابة). أي تغيير هيكلي يمس الصفحات أو الاختبارات أو العقود يجب أن يرافقها إعادة توليد نفس-الـPR.

---

## 1. اصطلاح موضع الاختبارات (المواضع الثلاثة الموثقة)

| الموضع | النطاق | العدد الحالي | الدور |
|---|---|---|---|
| `tests/domain/*.test.ts` | منطق المجال الخالص | 34 | **الموضع الكنوني** لاختبارات المجال (جناح الجذر) |
| `apps/prototype-web/client/src/**` (مجاور للوحدة) | وحدات التطبيق والواجهة والحراس العقدية | 298 | الموضع الكنوني لاختبارات التطبيق (جناح التطبيق — وملفان إضافيان في `apps/prototype-web/scripts` يكملان الجناح إلى 300) |
| `tests/*.test.ts` (جذر tests/) | استثناء تاريخي موثق | 1 | `owner-entitlement.test.ts` فقط — بقي من تقسيم سابق للجناحين |
| `src/domain/**` (داخل مصدر المجال) | استثناء تاريخي موثق | 1 | `direct-sale/policies.test.ts` فقط — مجاور قديم |

*(تصحيح مؤرخ 2026-10-07 — R1/TG-01 [R1-D1/M5]، من ← إلى: كان الجدول 33/343؛ الحي بالمولد `generated/test-map.json` عند رأس R1: **34** ملف مجال + **298** مجاورًا داخل client/src (المصدر: `domainTestLocations` في الـJSON المولد + عدّ ملفات الاختبار في الجناحين؛ `generate-test-map.mjs --check` = بلا انجراف).)*

**القاعدة:** اختبارات المجال الجديدة تُكتب في `tests/domain/`؛ واختبارات التطبيق مجاورة لوحدتها تحت `client/src`. لا يُضاف استثناء موضع جديد بلا صف سجل مؤرخ هنا. الاستثناءان الحاليان مسجّلان ولا يُقلَدان: عند أي لمسة تالية لملفيهما يُقيَّم نقلهما إلى موضعهما الكنوني بنمط النقل الميكانيكي المعتاد (شرط المستهلكين + أسس الحراس نفس-الـPR).

## 2. خريطة صفحة→اختبار (مولّدة — الحالة الحية)

الخريطة الكاملة (60 صفحة → أدلتها) في الـJSON المولّد؛ ملخص الحالة:

| صنف الدليل | العدد | المعنى |
|---|---|---|
| `direct` — اختبار يستورد الصفحة مباشرة | **55** | تغطية سلوكية مباشرة للصفحة |
| `named-reference` — اختبار رقابي يذكر الصفحة بالاسم | **5** | سيطرة معمارية/رحلة تذكر الصفحة (انظر الجدول أدناه) |
| بلا دليل | **0** | — |

*(تصحيح مؤرخ 2026-10-07 — R1/TG-01 [R1-D1]، من ← إلى: كان الملخص 49 مباشرًا + 5 اسميًا + 6 مساريًا؛ الصفحات الست المسارية سابقاً صارت **direct** بعد إضافة رحلات `SmokeOnlyPagesJourneys.dom.test.tsx` (W7) التي تستوردها مباشرة — المصدر: `generated/test-map.json` عند رأس R1، `generate-test-map.mjs --check` بلا انجراف. الجدول التفصيلي أدناه يعرض الحالة الحية؛ صفوف الصفحات الست المذكورة انتقلت إلى صنف direct بدليل الرحلات المذكورة.)*

**الصفحات غير المباشرة وأدلتها وسببها الموثق** (التغطية السلوكية الكاملة لكل صفحة عملُ مسار الواجهة Wave T ببوابة مالك — هذا البرنامج البنيوي يثبت الأدلة الرقابية المتاحة اليوم لا يدّعي تغطية سلوكية غير موجودة):

| الصفحة | صنف الدليل | الأدلة | السبب الموثق |
|---|---|---|---|
| `pages/AgreementEditor.tsx` | named | `moneyLayerGuard.contract.test.ts` (مدخل في سطح F-049 المجمّد) | سيطرة طبقة المال (REM-005)؛ السلوك لمسار T |
| `pages/CashAdjustmentEditor.tsx` | named | `moneyLayerGuard.contract.test.ts` | كما فوق |
| `pages/CashOpeningLaterEditor.tsx` | named | `StateRecovery.w44.dom.test.tsx` | رحلة استرجاع الحالة تصل الصفحة |
| `pages/CashWallets.tsx` | named | `StateRecovery.w44`، `localTransferService.capabilitiesRoundTrip`، `guidedOpeningImportService.g82`، `IndexedDbLocalStore.open-count` | رحلات وبيّنات قدرة تذكر السطح |
| `pages/NotFound.tsx` | named | `Nav003.exe016.dom.test.tsx` | رقابة ملاحة exe016 |
| `pages/CashReversalEditor.tsx` | direct *(كانت route — انظر التصحيح المؤرخ أعلاه)* | `SmokeOnlyPagesJourneys.dom.test.tsx` (+ رقابة المسارات `routeClassifier`/`routeKnowledgeSync`) | رحلة سلوكية مباشرة (W7) + `/cash/entry/:id/reverse` |
| `pages/CashWalletEditor.tsx` | direct *(كانت route)* | `SmokeOnlyPagesJourneys.dom.test.tsx` (+ `Foundation.ui`) | رحلة سلوكية مباشرة (W7) + `/cash/wallet/new` |
| `pages/G5DeclarationEditor.tsx` | direct *(كانت route)* | `SmokeOnlyPagesJourneys.dom.test.tsx` (+ رقابة المسارات) | رحلة سلوكية مباشرة (W7) + `/finance/g5/declaration` |
| `pages/InventoryReversalEditor.tsx` | direct *(كانت route)* | `SmokeOnlyPagesJourneys.dom.test.tsx` (+ `G004CapabilityDeepLinks`، `InventoryAdjustExe012`) | رحلة سلوكية مباشرة (W7) + `/inventory/movement/:id/reverse` |
| `pages/ReceivedLoanDetail.tsx` | direct *(كانت route)* | `SmokeOnlyPagesJourneys.dom.test.tsx` (+ `ReceivedLoanEditor.w178`) | رحلة سلوكية مباشرة (W7) + `/loans/received/:id` |
| `pages/SharePreview.tsx` | direct *(كانت route)* | `SmokeOnlyPagesJourneys.dom.test.tsx` (+ `OrderShare.exe015`، `WorkShare.w43`) | رحلة سلوكية مباشرة (W7) + `/share/preview` |

## 3. ربط العقود→الرقابة (49 عقدًا)

ثلاث حالات: **حرفي** (اختبار/حارس يستشهد ملف العقد بالاسم — أقوى رابطة)، **مفهومي** (اختبارات المفهوم التي تثبت سلوكه — الخريطة المُنسّقة في `CONTROL_LINKS` داخل المولّد)، و**سبب موثق** (لا سطح تنفيذي محلي بعد). القائمة الكاملة بالملفات في الـJSON المولّد.

| العقد | الحالة | أدلة/سبب |
|---|---|---|
| 02 دورة الطلب | حرفي | `Wave4ContractOracles.contract.test.ts` |
| 05 سياسات P0 | حرفي | `FinalLogicOwnerDecisions` + `Wave4ContractOracles` |
| 26 التنقل والوصلات العميقة | حرفي | `Wave42Package5.contract.test.ts` |
| 39 مظروف النسخ | حرفي | `group6Docs.test.ts` |
| 40 خريطة الملكية | حرفي | `Wave42Package5` + `group6Docs` + `ownershipBoundaries.exe017` |
| 01 النتيجة المالية | مفهومي | periodComparison/periodResultCanonical/statement (+5 في الـJSON) |
| 03 نسخة التكلفة | مفهومي | costService/costEstimateService |
| 06 الحدث المالي | مفهومي | `tests/domain/financial-event.test.ts` |
| 07 الموعد والقدرة | مفهومي | capacityDecision* + scheduleService |
| 08 تصنيف المصروف | مفهومي | EventsLayer.familyGuard + expenseCategory* |
| 09 المورد والشراء | مفهومي | supplier-purchase* + SupplierPurchaseEditor.ui |
| 10 استمرارية السجل | مفهومي | cashContinuity* (+1) |
| 11 مواد المخزون والهدر | مفهومي | inventoryMaterial* + inventory-material + waste-context |
| 12 مؤشرات G5 | مفهومي | operatingBreakEvenModel + financialPulse (+1) |
| 13 المادة المنفذة/المخطط | مفهومي | CatalogPlannedCost + templatePlannedCost (+1) |
| 14 سياسة نتيجة الفترة | مفهومي | allocationPolicyCapability.contract |
| 15 مرجع الكتالوج | مفهومي | CatalogCoreStorage + domain/catalog |
| 16 وضع التشغيل الاختياري | مفهومي | Set003* + actual-time (+2) |
| 17 هامش المساهمة/التعادل/السيولة | مفهومي | operatingBreakEvenModel + shortCashHorizon (+3) |
| 18-G6A التقويم الشهري المشتق | مفهومي | supplierSchedule* (+2) |
| 19-G6B تكرار المواعيد | مفهومي | supplierSchedule* + recurrence (+1) |
| 20-G7A مصدر الاتفاق والمتابعة | مفهومي | agreementContextService + agreementPrice (+3) |
| 21 الاستيراد الافتتاحي الموجه | مفهومي | guidedOpeningImportService* |
| 22 Pilot قيد التشغيل | مفهومي | Set003Capabilities + capacityDecision (+1) |
| 23-C1 تصحيح الأحداث العامة | مفهومي | EventsLayer.familyGuard + correctionHistory (+2) |
| 27 الإدخال المالي الموجه | مفهومي | guidedOpeningImportService* (+1) |
| 28 المخزون الانتقائي | مفهومي | inventoryMaterial* + inventory-material |
| 29 التمويل العميق | مفهومي | G4Loans + assetService (+11) |
| 30 القارئ الموحد للنشاط | مفهومي | EventsLayer.familyGuard + activityService |
| 31 عمق النتيجة | مفهومي | StatementPeriod.w173 + statementService |
| 32 تقرير Markdown | مفهومي | statementMarkdownService |
| 33 المشاركة اليدوية | مفهومي | OrderShare.exe015 |
| 34 سجل التصحيحات | مفهومي | correctionHistoryService |
| 35 فحوص الاستمرارية MIC | مفهومي | IntegrityReadable + ToolsIntegrity (+1) |
| 36 المسودة النصية | مفهومي | draftService + formDraftService (+1) |
| 37 القفل المحلي | مفهومي | Settings.lockGate + localLockService |
| 38 تحديث PWA الآمن | مفهومي | DevicePwa + UnsavedChangesGuard.dirtyBridge (+3) |
| 41 تذكير المصروف المتكرر | مفهومي | RecurringExpenseSurfaces + recurringExpenseService (+5) |
| 42 الميزانيات والأهداف | مفهومي | expenseBudgetService.3c + localTransferService.expenseBudget (+3) |
| 43 إهلاك الأصول | مفهومي | G4Assets + assetService (+3) |
| 04 المزامنة المحدودة | **سبب موثق** | عقد منصة مستقبلية (مسار U/W) — لا سطحًا تنفيذيًا محليًا بعد؛ سلطة المنتج مثبتة في فهرس الوثائق |
| 18-N هوية الشبكة ومساحات العمل | **سبب موثق** | كما فوق (N-01/N-02) |
| 19-N Attention والإشعار وحدود Manage | **سبب موثق** | كما فوق (N-03/N-04) |
| 20-M احتياج Market والرد والمراجعة | **سبب موثق** | كما فوق (M) |
| 21-D طلب Delivery والعرض والخصوصية | **سبب موثق** | كما فوق (D-01/D-02) |
| 22-N Moderation والموافقة والتدقيق | **سبب موثق** | كما فوق (A-01) |
| 23-N دورة بيانات الشبكة والاستعادة | **سبب موثق** | كما فوق (N-05) |
| 24-N تصنيف بيانات الشبكة وقاموس الحقول | **سبب موثق** | كما فوق (N-06) |
| 25-N تمثيل مبالغ الشبكة | **سبب موثق** | كما فوق (N-07) |

**قاعدة الروابط المفهومية:** خرائط `CONTROL_LINKS` في المولّد مُنسّقة يدويًا لكل عقد على مفهومه، ويُعاد التحقق منها آليًا عند كل توليد (نمط بلا مطابقة = فشل القبول لا فجوة صامتة). ترقية رابطة مفهومية إلى حرفية (استشهاد اسم الملف في الاختبار) تحدث كلما لُمست مجموعة الاختبارات المعنية — ولا تنزل درجة أبدًا.

## 4. صفوف الملكية الناقصة (STR-619) وبيوت application غير المالية

أُضيفت في `OWNERSHIP-AND-TRUTH-REGISTRY.md` §3-م: صفا `financialPulseService` و`capacityDecisionService` (المفقودان في المسح المعادي) + جدول إكمال يغطي بيوت application غير المالية بدلالة مالك المفهوم وأدلة الاختبار المباشرة — انظر القسم هناك.

## 5. توسيع نطاق حارس فهرس الوثائق

كان الحارس يغطي 4 مجلدات (contracts/architecture/decisions/research)؛ صار يغطي **12** بإضافة `expansion` و`implementation` و`inventory` و`product-audit` و`product` و`quality` و`reference` و`scenarios` — كل ملف `.md` سلطوي فيها يجب أن يُذكر في `docs/00-document-index.md`. **استثناء موثق:** `docs/operations/**` يُحكم بنظام تحكم العمليات الخاص به (JSON المصدر + العارضات المولدة + `validate.py`) لا بفهرس الوثائق — ملفاته المحورية (current-state وREADME والقوالب) تبقى في `REQUIRED_CANONICAL` للحارس نفسه؛ و`docs/fixtures/` لا يحوي ملفات md.
