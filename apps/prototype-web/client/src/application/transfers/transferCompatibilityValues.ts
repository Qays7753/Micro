/**
 * Wave 4D (ARCH-002/WS-212 — بطاقة RC-8): سجل قيم التوافق التاريخي لمدققات
 * النقل — البيت الوحيد للقيم التي تقبلها المدققات **فوق** اتحادات المجال/التخزين
 * الحالية. كل قيمة هنا موثقة بسببها وإصداراتها الداعمة والاختبارات التي تثبتها؛
 * أي قيمة توافقية جديدة بلا صف هنا = خلل يرفضه الاختبار المرافق.
 *
 * القاعدة الحاكمة (عقد 39 + سجل الملكية §4):
 *  - القيم الحية مصدرها اتحادات المجال/التخزين؛ ما له قائمة تشغيلية مجالية
 *    (materialUnits، unitDimensions، قوائم المصروف المتكرر والميزانيات)
 *    تستهلكه المدققات من مصدره مباشرة — لا نسخ يدوية.
 *  - القيم التاريخية التوافقية تعيش هنا وحدها، موسومة ومسببة، ولا تُدمج مع
 *    القيم الحية أبدًا في اتحاد واحد.
 *  - غارد الدريفت (Wave 3B) يبقى الـoracle الدائم في الاتجاه الآخر: كل قيمة
 *    حالية يجب أن تقبلها المدققة المقابلة.
 *  - ترتيب الرفض ورسائل الأخطاء وقبول الملفات التاريخية كما هو حرفيًا —
 *    هذا السجل يوثق القيم ولا يغير سلوكًا.
 */
import type { AgreementSource } from "@/storage/local/types";

/**
 * مصادر اتفاق تاريخية: قيم مسجلة قبل تضييق مفردة مصدر الاتفاق إلى الاتحاد
 * الحالي (AgreementSource — خمس قيم). السجلات القائمة تحتملها قيمها المحفوظة،
 * والتصدير الحالي قد يحملها على سجلات قديمة، فرفضها يكسر ملفات النظام نفسه.
 *
 * مدعومة في: كل أزواج التصدير المقبولة (المصدر القابل للتنفيذ:
 * ACCEPTED_PAIRS في localTransferService.releasedPairs.test.ts) — عقد 39.
 * تُثبتها: transferFamilyValidators.characterization.test.ts (طاقم القبول)،
 * localTransferService.test.ts (دورات كاملة بقيم تاريخية)، والذهبيات
 * (current-pair + historical-8-17-faithful تحملان «conversation»).
 */
export const LEGACY_AGREEMENT_SOURCES = ["conversation", "call", "in_person"] as const;

export type LegacyAgreementSource = (typeof LEGACY_AGREEMENT_SOURCES)[number];

/**
 * طاقم قبول مصدر الاتفاق الكامل كما تستهلكه المدققة: الاتحاد الحالي (خمس
 * قيم) ∪ القيم التوافقية التاريخية. المدققة تستهلك هذا الطاقم من هنا —
 * المصدر واحد مسمى لا نسختين.
 */
export const AGREEMENT_SOURCE_ACCEPTANCE = [
  "instagram",
  "whatsapp",
  "referral",
  "walk_in",
  "other",
  ...LEGACY_AGREEMENT_SOURCES,
] as const;

/**
 * إثبات نوعي أن القيم التاريخية خارج الاتحاد الحالي فعلًا: لو دخلت قيمة
 * منها يومًا في AgreementSource الحالي يكسر هذا الاستبعاد فحص الأنواع، وعندها
 * تُنقل القيمة إلى الاتحاد الحالي ويُحذف صفها هنا مع تحديث اختباراتها — لا
 * تبقى مزدوجة السكن.
 */
export type LegacySourcesOutsideCurrentUnion = Exclude<LegacyAgreementSource, AgreementSource>;

/**
 * السجل القابل للتنفيذ: كل عائلة لها قيم توافقية فوق الاتحاد الحالي لها صف
 * واحد هنا (القيم، الجهة، السبب، الإصدارات، الاختبارات المثبتة). الاختبار
 * المرافق (transferCompatibilityRegistry.test.ts) يفرض:
 *  (1) كل قيمة مسجلة تقبلها المدققة المقابلة،
 *  (2) طاقم قبول العائلة = الاتحاد الحالي ∪ القيم المسجلة حصرًا،
 *  (3) لا عائلة بقيم توافقية بلا صف هنا.
 */
export const TRANSFER_HISTORICAL_COMPATIBILITY = [
  {
    family: "agreementSource",
    acceptedBy: "isAgreementSource",
    field: "StoredCraftOrder.agreementSource (عائلة craftOrder في الاستيراد)",
    values: LEGACY_AGREEMENT_SOURCES,
    currentAuthority: "@/storage/local/types.ts — AgreementSource (5 قيم حالية)",
    reason:
      "مصادر اتفاق سابقة لتضييق المفردة؛ سجلات قائمة تحملها والتصدير الحالي قد يصدّرها على تلك السجلات — رفضها يكسر ملفات النظام نفسه",
    supportedVersions: "كل الأزواج المقبولة (ACCEPTED_PAIRS) — عقد 39",
    pinnedBy: [
      "transferFamilyValidators.characterization.test.ts",
      "localTransferService.test.ts",
      "docs/fixtures/export-goldens/current-pair.golden.json",
      "docs/fixtures/export-goldens/historical-8-17-faithful.golden.json",
    ],
  },
] as const;

/**
 * خريطة مصادر القبول (توثيق تنقّل — تُقرأ مع سجل الملكية §4): لكل عائلة
 * قيم في المدققات، مصدر سلطتها. أنواع المصادر الثلاثة المشروعة:
 *  - DOMAIN_RUNTIME_LIST: قائمة تشغيلية مجالية — المدققة تستهلكها من المصدر.
 *  - GUARDED_UNION: اتحاد نوعي فقط — القيم الحرفية في المدققة تحرسها مراسي
 *    دريفت Wave 3B (طبقتا تشغيل وأنواع) أو توثق هنا حين خارج طاقم المراسي.
 *  - HISTORICAL_REGISTRY: قيم توافقية — تعيش في هذا الملف حصرًا.
 */
export const TRANSFER_ACCEPTANCE_SOURCES = {
  materialUnit: "DOMAIN_RUNTIME_LIST — materialUnits (domain/inventory-material)",
  unitDimension:
    "GUARDED_UNION — unitDimensions (domain/catalog)؛ التفويض التشغيلي مؤجل (D-034 هامش الحزمة) — الطاقم مطابق حرفيًا ومحروس",
  recurringSeriesStatus:
    "GUARDED_UNION — recurringExpenseSeriesStatuses (domain/recurring-expense)؛ تفويض مؤجل (D-034) — مطابق حرفيًا ومحروس",
  recurringOccurrenceStatus:
    "DOMAIN_RUNTIME_LIST — recurringExpenseOccurrenceStatuses (domain/recurring-expense)",
  recurringMonthEndPolicy:
    "DOMAIN_RUNTIME_LIST — recurringExpenseMonthEndPolicies (domain/recurring-expense)",
  recurringAmountMode:
    "GUARDED_UNION — recurringExpenseAmountModes (domain/recurring-expense)؛ تفويض مؤجل (D-034) — مطابق حرفيًا ومحروس",
  expenseBudgetStatus: "DOMAIN_RUNTIME_LIST — expenseBudgetStatuses (domain/budget)",
  expenseBudgetKnowledge: "DOMAIN_RUNTIME_LIST — expenseBudgetKnowledgeLevels (domain/budget)",
  catalogItemKind: "DOMAIN_RUNTIME_LIST — catalogItemKinds (domain/catalog)",
  agreementSource: "HISTORICAL_REGISTRY — 5 حالية (AgreementSource) + LEGACY_AGREEMENT_SOURCES (هذا الملف)",
  knowledgeState: "GUARDED_UNION — KnowledgeState (domain/craft-order؛ مراسي الدريفت)",
  resultStatus: "GUARDED_UNION — ResultStatus (domain/craft-order؛ مراسي الدريفت)",
  orderStatus: "GUARDED_UNION — OrderStatus (domain/craft-order؛ مراسي الدريفت)",
  settlementStatus: "GUARDED_UNION — SettlementStatus (domain/craft-order؛ مراسي الدريفت)",
  financialEventType: "GUARDED_UNION — FinancialEventType (domain/financial-event؛ مراسي الدريفت)",
  cashWalletKind: "GUARDED_UNION — CashWalletKind (domain/cash-continuity؛ مراسي الدريفت)",
  cashEntryType: "GUARDED_UNION — CashContinuityEntryType (domain/cash-continuity؛ مراسي الدريفت)",
  scheduleStatus: "GUARDED_UNION — ScheduleStatus (storage/local/types.ts — سجل تشغيلي محلي)",
  inventoryMovementType: "GUARDED_UNION — InventoryMovementType (domain/inventory-material)",
  yieldReadiness: "GUARDED_UNION — قيم جاهزية حصاد القالب (domain/catalog — type-only)",
  shortCashDeclaration: "GUARDED_UNION — kind/direction/knowledge (domain/financial-analysis — type-only)",
  expenseContext:
    "GUARDED_UNION — relationship/behavior/purpose/knowledge (domain/financial-event — type-only)",
} as const;
