/**
 * S10 (UNIT-030/031/032 + SH-14 — أمر b56967d8): عائلة «التخطيط» النقية —
 * حسابات أدوات التخطيط الخمس بلا أي تخزين أو واجهة.
 *
 * الملكية والحدود:
 *  - T01 (التكلفة والتسعير) يستهلك نواة S09/SH-13 الواحدة
 *    (`calculateCostSnapshot` عبر أساس المجموعات) من `@micro-domain/craft-order`
 *    بسطحها العام فقط — لا محرك حساب ثانٍ ولا تعديل لملفات S09.
 *  - T02–T05 حسابات تخطيطية نقية جديدة لا تقرأ أرصدة المشروع ولا تكتب أي
 *    سجل؛ نتائجها تقديرية بحدودها ومدخلاتها (عقد UNIT-030 B1–B5).
 *  - كل المبالغ بوحدات minor الآمنة (أعداد صحيحة) والنسب بأعداد صحيحة
 *    بمقياس معلن (percentCenti = نسبة×100) — لا فواصل عائمة في المال.
 *  - المجهول ≠ الصفر: مدخل فارغ/غير معروف يظل غير محدد، والمقام صفر أو
 *    المساهمة غير الموجبة نتيجة «غير قابلة للحساب» صادقة لا صفر ولا نسبة.
 */

/** وضع تكلفة المجموعة: تفصيل مكونات الوحدة أو إجمالي معلوم للكمية كاملة — أحدهما فعال حصرًا. */
export type PlanningGroupCostMode = "details" | "total";

/** مكوّن الوحدة الواحدة من مجموعة بوضع التفصيل — نفس عقد بند التكلفة القائم. */
export type PlanningUnitComponent = {
  name: string;
  quantity: number;
  unit: string;
  unitPriceMinor: number;
  confidence: "known" | "estimated";
  materialId?: string | null;
};

/** مجموعة منتج/خدمة واحدة في حساب T01 — التكرار يطبق مرة واحدة على أساس الوحدة. */
export type PlanningGroup = {
  id: string;
  label: string;
  offeringType: "product" | "service";
  repeatQuantity: number;
  costMode: PlanningGroupCostMode;
  /** وضع التفصيل: مكونات الوحدة الواحدة (فارغ في وضع الإجمالي). */
  unitComponents: readonly PlanningUnitComponent[];
  /** وضع الإجمالي: التكلفة الدقيقة للكمية كاملة (null = لم تُدخل بعد). */
  totalCostMinor: number | null;
  /** سعر بيع الوحدة الذي يدخله المستخدم بحرية (null = لم يُحدد بعد؛ 0 مقصود صحيح). */
  sellingPriceMinor: number | null;
};

/** صف إيراد/مصروف إضافي على نطاق الحساب كله — مبلغ لازم ووصف اختياري. */
export type PlanningExtraRow = {
  id: string;
  amountMinor: number;
  description: string | null;
};

/** وقت المالك للتسعير — تقدير تسعيري فقط لا يخلق أجرًا ولا مصروفًا ولا استحقاقًا.
 * نفس عقد وقت النواة: القيم null = وقت غير مكتمل (معرفة ناقصة صادقة لا صفرًا). */
export type PlanningTimeInput = {
  minutes: number | null;
  hourlyRateMinor: number | null;
  confidence: "known" | "estimated";
} | null;

/** خصم اختياري واحد على قيمة المنتجات قبل الإيرادات الإضافية — مبلغ أو نسبة، لا الاثنان. */
export type PlanningDiscount =
  { mode: "amount"; amountMinor: number } | { mode: "percent"; percentCenti: number };

/** عمولة اختيارية بأساس صريح يختاره المستخدم — تُحتسب تكلفة مرة واحدة ولا تتكرر ضمن المصاريف الإضافية. */
export type PlanningCommission =
  | { mode: "amount"; amountMinor: number }
  | { mode: "percent"; percentCenti: number; basis: "products_after_discount" | "order_total" };

/** مدخل حساب T01 — التخطيط المستقل بلا طلب ولا مصروف فعلي. */
export type PlanningCalculationInput = {
  title: string;
  groups: readonly PlanningGroup[];
  time: PlanningTimeInput;
  packagingMinor: number;
  wasteMinor: number;
  /** تكلفة توصيل على المشروع — مرة واحدة للحساب كله. */
  deliveryMinor: number;
  otherRevenues: readonly PlanningExtraRow[];
  otherExpenses: readonly PlanningExtraRow[];
  discount: PlanningDiscount | null;
  commission: PlanningCommission | null;
  createdAt: string;
};

/** نتيجة مجموعة واحدة — التكلفة الدقيقة بمصدرها لا معاد بناؤها من حصة وحدة معروضة. */
export type PlanningGroupResult = {
  groupId: string;
  repeatQuantity: number;
  /** تكلفة المجموعة الدقيقة: التفصيل يضرب أساس الوحدة في التكرار قبل التقريب، والإجمالي أصله المحفوظ. */
  groupCostMinor: number;
  /** قيمة بيع المجموعة (null ما دام سعر الوحدة غير محدد). */
  groupSellingMinor: number | null;
  /** ربح المجموعة قبل المصاريف المشتركة (null ما دام السعر غير محدد). */
  groupProfitMinor: number | null;
};

/** نتيجة حساب T01 — مجاميع دقيقة بوحدات minor ونسب مئوية بمقياس percentCenti (نسبة×100). */
export type PlanningCalculationResult = {
  /** تكلفة المنتجات CP — من النواة الواحدة بعد التوسيع. */
  productsCostMinor: number;
  /** قيمة المنتجات بعد الخصم (null ما دام أي سعر غير محدد؛ = SP قبل خصم إن لا خصم). */
  productsSellingMinor: number | null;
  /** قيمة البيع الكاملة SP قبل الخصم. */
  sellingTotalMinor: number | null;
  discountMinor: number;
  commissionMinor: number;
  extrasRevenueMinor: number;
  extrasExpenseMinor: number;
  deliveryMinor: number;
  /** الإجمالي المتوقع T = (SP − الخصم) + الإيرادات الإضافية. */
  expectedTotalMinor: number | null;
  /** إجمالي تكلفة التسعير CT = (CP + وقت + تغليف + توصيل + هدر من النواة) + العمولة + المصاريف الإضافية. */
  pricingCostMinor: number;
  /** الربح المتوقع G = T − CT (null ما دام T غير محدد؛ سالب = خسارة متوقعة معلنة). */
  expectedProfitMinor: number | null;
  /** هامش الربح من سعر البيع = G÷T — percentCenti (null عند T غير المحدد أو ≤0). */
  marginPercentCenti: number | null;
  /** تكلفة الوحدة المتوقعة من النواة (عرض؛ الأصل يبقى المجموع الدقيق). */
  unitCostMinor: number;
  knowledgeState: "known" | "estimated" | "partial" | "incomplete" | "stale" | "variable";
  knowledgeGaps: readonly { id: string; mandatory: boolean }[];
  /** مكونات مسماة بلا سعر — «غير محدد بعد» مستبعدة من الحساب لا صفر. */
  excludedComponentNames: readonly string[];
  groupResults: readonly PlanningGroupResult[];
};

/** هدف اقتراح السعر الاختياري — مبلغ فوق التكلفة أو نسبة بمقام معلن. */
export type PricingAim =
  | { kind: "amount"; amountMinor: number }
  | { kind: "margin"; marginPercentCenti: number }
  | { kind: "markup"; markupPercentCenti: number };

/** T02 — قيمة ساعة العمل التقديرية. */
export type HourValueInput = {
  monthlyCompensationMinor: number;
  workDaysPerMonth: number;
  productiveHoursPerDay: number;
};

export type HourValueResult = {
  /** الساعات الشهرية المنتجة = الأيام × ساعات اليوم (دقة أجزاء الألف داخليًا). */
  monthlyHours: number;
  /** قيمة الساعة التقديرية بوحدات minor — المقابل 0 يعطي 0 مع تفسير، لا مجهولًا. */
  hourValueMinor: number;
};

/** T03 — كمية البيع المطلوبة لتغطية مصاريف فترة أو لتحقيق هدف. */
export type SalesQuantityInput = {
  periodLabel: string;
  unitSellingPriceMinor: number;
  unitVariableCostMinor: number;
  fixedExpensesMinor: number;
  targetProfitMinor: number | null;
};

export type SalesQuantityResult =
  | {
      computable: true;
      /** مساهمة الوحدة = السعر − التكلفة المتغيرة (موجبة). */
      unitContributionMinor: number;
      /** كمية التغطية مقربة لأعلى للوحدة غير القابلة للتجزئة (0 عند مصاريف ثابتة 0). */
      coverageQuantity: number;
      /** كمية الهدف مقربة لأعلى (null إن لم يُفعل الربح المستهدف). */
      targetQuantity: number | null;
      /** true إذا كان التقريب لأعلى فعلًا (لعرض «قُرّبت لأعلى» بصدق). */
      coverageRoundedUp: boolean;
      targetRoundedUp: boolean;
    }
  | { computable: false; reason: "non_positive_contribution" };

/** T04 — نصيب المشروع التقديري من فاتورة مشتركة بأساس صريح. */
export type InvoiceShareInput =
  | { method: "percent"; billTotalMinor: number; percentCenti: number }
  | { method: "usage"; billTotalMinor: number; projectUsage: number; totalUsage: number };

/** أساس الحساب الظاهر بجانب النتيجة — لا ناتج بلا أساس (بيانات بنيوية؛ العرض للتطبيق). */
export type InvoiceShareBasis =
  | { kind: "percent"; billTotalMinor: number; percentCenti: number }
  | { kind: "usage"; billTotalMinor: number; projectUsage: number; totalUsage: number };

export type InvoiceShareResult = {
  shareMinor: number;
  /** ما تبقى من الفاتورة خارج حصة المشروع (عرض ثانوي صادق). */
  remainingMinor: number;
  basis: InvoiceShareBasis;
};

/** T05 — فحص الفكرة الأولي: خمسة أسئلة، والناتج ثلاثة أقسام بلا درجة ولا حكم. */
export type IdeaReviewAnswers = {
  whatToSell: string | null;
  whoBuys: string | null;
  costAndPrice: string | null;
  firstCustomerReach: string | null;
  whatToVerify: string | null;
};

export type IdeaReviewResult = {
  /** ما حدده المستخدم — إجابات كما كتبها بلا اختراع. */
  defined: readonly { question: string; answer: string }[];
  /** ما يحتاج توضيحًا — الأسئلة بلا إجابة بعد. */
  needsClarification: readonly string[];
  /** خطوة التحقق الصغيرة التالية وفق الناقص — فعل واحد قابل للتنفيذ لا توصية عامة. */
  nextStep: string;
};
