type G5Status = "available" | "incomplete" | "invalid" | "needs_review";
export type G5Knowledge = "known" | "estimated" | "needs_review";
type G5Direction = "collection" | "commitment";
type ShortCashDeclarationKind = "declaration" | "reversal";
type G5QuantityIssue = "needs_conversion" | "invalid";

export type ShortCashDeclaration = {
  id: string;
  kind: ShortCashDeclarationKind;
  direction: G5Direction;
  amountMinor: number;
  dueOn: string;
  source: string;
  knowledge: G5Knowledge;
  note: string;
  relatedOrderId: string | null;
  relatedEventId: string | null;
  idempotencyKey: string;
  reversalOfId: string | null;
  createdAt: string;
};

export type CreateShortCashDeclarationInput = {
  id: string;
  direction: G5Direction;
  amountMinor: number;
  dueOn: string;
  source: string;
  knowledge: G5Knowledge;
  note: string;
  relatedOrderId?: string | null;
  relatedEventId?: string | null;
  idempotencyKey: string;
  createdAt: string;
};

export type CreateShortCashReversalInput = {
  id: string;
  original: ShortCashDeclaration;
  idempotencyKey: string;
  createdAt: string;
  note: string;
};

export type G5OrderInput = {
  id: string;
  itemName: string;
  deliveredOn: string;
  resultStatus: "final" | "estimated" | "incomplete" | "review_required";
  quantityMilli: number | null;
  unitKey: string | null;
  unitLabel: string | null;
  quantityIssue?: G5QuantityIssue | null;
  recognizedRevenueMinor: number;
  recognizedCostMinor: number;
};

export type G5ExpenseInput = {
  id: string;
  amountMinor: number;
  behavior: "fixed" | "variable" | "mixed" | "unknown";
  relationship: "project" | "shared";
  knowledge: G5Knowledge;
  sharedProjectShareBasis:
    "agreed_fixed_share" | "agreed_percentage" | "owner_estimate" | "needs_review" | null;
  directlyLinked: boolean;
  source: string;
};

export type G5MixItem = {
  itemName: string;
  orderCount: number;
  quantityMilli: number | null;
  unitKey: string | null;
  unitLabel: string | null;
  revenueMinor: number;
  variableCostMinor: number;
  /* F-011 (W2-B): قيمة الصف هامش مباشر (إيراد − تكلفة متغيرة مباشرة)؛
   * الاسم يبقى متوافقًا مع العرض الحالي حتى موجة UI. */
  contributionMarginMinor: number;
};

/* F-011 (W2-B): «هامش المساهمة» السابق هو فعليًا هامش مباشر — المصاريف
 * المتغيرة المربوطة وحدها ترقّيه لمساهمة حقيقية، وهي في الإنتاج غير مربوطة
 * (directlyLinked=false دائمًا) فتعلن فجوة تصنيف ولا تُوزّع تلقائيًا.
 * الحقلان directMarginMinor وcontributionMarginMinor قيمتان متطابقتان:
 * الأول الاسم الصادق، والثاني متوافق مع أسطح العرض القائمة. */
export type DirectMarginResult = {
  status: G5Status;
  from: string;
  to: string;
  totalRevenueMinor: number;
  totalVariableCostMinor: number;
  directMarginMinor: number;
  /** Compat display field (G5DecisionPanel) — identical to directMarginMinor. */
  contributionMarginMinor: number;
  contributionMarginPerUnitMinor: number | null;
  /** Which basis the margin actually uses — the linked-variable path must be
   * explicitly wired before "contribution" becomes an honest name (F-011). */
  marginBasis: "direct_costs_only" | "with_linked_variable";
  linkedVariableExpenseMinor: number;
  unlinkedVariableExpenseCount: number;
  /* REM-007 (المرحلة ب — 2026-09-29): فجوة تصنيف المصاريف المؤثرة (متغيرة
   * غير مرتبطة/مختلطة/مجهولة/مشتركة بلا أساس) — واقعة مجمعّة معلنة تُتيح
   * للقارئات التمييز بين نقص توحيد الوحدات (يُسقط الوحدات وحده) ونقص
   * المجمعات (يسقط كل الأرقام) — عقد ١٧ §٦.١؛ اختيارية: غيابها (القراءات
   * المرفوضة المبكرة) يعني لا فجوة معلنة. */
  classificationGap?: boolean;
  totalQuantityMilli: number | null;
  quantityUnitKey: string | null;
  quantityUnitLabel: string | null;
  fixedExpenseMinor: number;
  finalOrderCount: number;
  excludedOrderCount: number;
  mix: readonly G5MixItem[];
  sources: readonly string[];
  excluded: readonly string[];
  assumptions: readonly string[];
  reasons: readonly string[];
  nextAction: string;
};

/* REM-007 (المرحلة ب — قرار المالك 2026-09-29، TARGET_OPERATING_RESULT):
 * حالة موقع الفترة من التعادل التشغيلي — دالة إشارة نتيجة التشغيل المسجلة
 * (الهامش − الثابتة المؤهلة): سالبة تحت التعادل، صفر عنده، موجبة فوقه. */
export type BreakEvenState = "below" | "at" | "above";

/* REM-007 (المرحلة ب): قراءة النتيجة التشغيلية المستهدفة — نفس أساس التعادل
 * نفسه مع إضافة الهدف إلى بسط الثابتة؛ الهدف صفر يطابق التعادل العادي
 * بالبناء. الوحدات null عند غياب وحدة موحدة/مزيج معلن، والمبيعات null عند
 * نقص المجمعات — كل null بسبب صريح داخل reasons. */
export type TargetOperatingResultReading = {
  targetOperatingResultMinor: number;
  targetUnits: number | null;
  targetSalesValueMinor: number | null;
  reasons: readonly string[];
  nextAction: string;
};

export type BreakEvenResult = DirectMarginResult & {
  breakEvenUnits: number | null;
};

/* REM-007 (المرحلة ب — قرار المالك 2026-09-29): القراءة الكاملة للتعادل
 * التشغيلي = أساس التعادل (المجال النقي في الحزمة الرئيسية) + طبقة
 * التشغيل (نتيجة التشغيل/الحالة/المتبقي/الفائض/المبيعات/النسبة/الهدف)
 * تُركّب من وحدة التعادل التشغيلي فوق الأساس نفسه — قراءة واحدة بلا
 * معادلة موازية، وتُستهلك عبر الخدمات (نمط التحميل الخامل المعتمد في
 * البرنامج احترامًا لسقف D-034 — بطاقة الإصلاح §٩). */
export type OperatingBreakEvenResult = BreakEvenResult & {
  /* نتيجة التشغيل الفعلية = الهامش − التكاليف الثابتة المؤهلة؛ null عندما
   * لا تكتمل المجمعات (فجوة تصنيف أو طلب مستبعد أو قراءة غير صالحة) —
   * لا رقم جزئي مضلل. */
  operatingResultMinor: number | null;
  breakEvenState: BreakEvenState | null;
  /* موجب عندما تكون الفترة تحت التعادل؛ صفر عند التعادل وفوقه. */
  remainingToBreakEvenMinor: number | null;
  /* موجب فقط عندما تكون الفترة فوق التعادل — null خلاف ذلك (حيث لا ينطبق). */
  amountAboveBreakEvenMinor: number | null;
  /* أول قيمة صحيحة بالوحدة الصغرى عند التعادل أو فوقه، من النسبة المجمعّة
   * الدقيقة (ثابتة × إيراد ÷ هامش) بلا تقريب مزدوج — متاحة عند اكتمال
   * المجمعات حتى لو فشل توحيد الوحدات (عقد ١٧ §٦.١). */
  breakEvenSalesValueMinor: number | null;
  /* نسبة هامش المساهمة للعرض: أجزاء من عشرة آلاف، تقريب نصف-أعلى معلن —
   * الاشتقاق الكنوني للمبيعات يقسم المجمعات مباشرة لا هذه النسبة. */
  contributionMarginRatioPermyriad: number | null;
  /* قراءة الهدف — null ما لم يُمرر هدف صريح. */
  targetOperatingResult: TargetOperatingResultReading | null;
};

export type ShortCashBalanceItem = {
  id: string;
  direction: G5Direction;
  amountMinor: number;
  dueOn: string | null;
  source: string;
};

export type ShortCashInput = {
  from: string;
  to: string;
  recordedCashMinor: number;
  receivables: readonly ShortCashBalanceItem[];
  payables: readonly ShortCashBalanceItem[];
  declarations: readonly ShortCashDeclaration[];
};

export type ShortCashResult = {
  status: G5Status;
  from: string;
  to: string;
  recordedCashMinor: number;
  declaredCollectionsMinor: number;
  declaredCommitmentsMinor: number;
  undatedReceivablesMinor: number;
  undatedPayablesMinor: number;
  projectedCashMinor: number | null;
  activeDeclarationCount: number;
  sources: readonly string[];
  assumptions: readonly string[];
  reasons: readonly string[];
  nextAction: string;
};
