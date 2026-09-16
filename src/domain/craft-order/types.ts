import type { Currency, MoneyMinor } from "../shared/index.js";

export type KnowledgeState = "known" | "estimated" | "partial" | "incomplete" | "stale" | "variable";

/* القرار ٢٢: كل نقص معرفة يحمل علامته — إلزامي (يمنع نتيجة صادقة) أو اختياري (يحسّن الدقة).
 * الحقل إضافي وغير كاسر: النسخ القديمة بلا حقل تُشتق فجواتها من مدخلاتها المحفوظة. */
export type KnowledgeGapId =
  | "no_cost_components"
  | "time_incomplete"
  | "stale_material_price"
  | "estimated_item"
  | "variable_cost_source";
export type KnowledgeGap = { id: KnowledgeGapId; mandatory: boolean };

export type ResultStatus = "final" | "estimated" | "incomplete" | "review_required";

/* ORD-003: مسؤولية النقل والتوصيل — خيار صريح واحد لكل طلب يحدد من يدفع
 * أجرة التوصيل ومن يدفع كلفة الناقل، مع أعلام احتواء تمنع الاحتساب المزدوج.
 * غياب الشروط كليًا (null أو حقل غير موجود) = لا شروط نقل مسجلة — سلوك
 * رجعي مطابق للطلبات القديمة تمامًا. */
export type DeliveryResponsibility =
  "project_pays" | "customer_pays_project" | "customer_pays_courier" | "shared";

export interface OrderDeliveryTerms {
  responsibility: DeliveryResponsibility;
  /* أجرة التوصيل محتواة أصلًا داخل سعر البيع — لا تُضاف مرة ثانية إلى قيمة الطلب. */
  feeIncludedInPrice: boolean;
  /* كلفة النقل محتواة أصلًا داخل تكلفة المنتج/المواد — لا تُطرح مرة ثانية من النتيجة. */
  costIncludedInProductCost: boolean;
  /* أجرة التوصيل التي يحتسبها المشروع على الزبون (يدفع الزبون للمشروع) —
   * null = غير مسجلة بعد؛ الصفر قيمة صريحة صحيحة. */
  feeChargedMinor: MoneyMinor | null;
  /* كلفة النقل التي دفعها المشروع للناقل — null = غير مسجلة بعد؛ الصفر صريح. */
  costPaidMinor: MoneyMinor | null;
  /* التكلفة المشتركة: حصة المشروع — null = غير مسجلة. */
  projectShareMinor: MoneyMinor | null;
  /* التكلفة المشتركة: حصة الزبون — null = غير مسجلة. */
  customerShareMinor: MoneyMinor | null;
}

export type DepositSettlementDecision = "refund_deposit" | "retain_deposit" | "needs_review";

type CostSource = "user_input" | "historical_price" | "estimate";
type CostConfidence = "known" | "estimated";

export interface MaterialCostItem {
  name: string;
  quantity: number;
  unit: string;
  unitPriceMinor: MoneyMinor;
  priceDate: string;
  source: CostSource;
  confidence: CostConfidence;
  /* المجموعة ٣ (عقد D2): ربط هوية المادة عند التكلفة — هوية فقط لا قيمة حية؛
   * أرقام البند مجمّدة في النسخة كما كانت لحظة الإنشاء. غياب الحقل = بند حر. */
  materialId?: string | null;
}

export interface TimeCost {
  minutes: number | null;
  hourlyRateMinor: MoneyMinor | null;
  confidence: CostConfidence;
}

export interface CostSnapshotInput {
  currency: Currency;
  materialItems: MaterialCostItem[];
  time: TimeCost | null;
  packagingMinor: MoneyMinor;
  deliveryMinor: MoneyMinor;
  wasteMinor: MoneyMinor;
  safetyBufferMinor: MoneyMinor;
  quantity: number;
  createdAt: string;
  source: "draft" | "price_approval" | "order_confirmation" | "revision";
  freshnessDays?: number | null;
}

export interface CostSnapshot {
  id: string;
  currency: Currency;
  materialCostMinor: MoneyMinor;
  timeCostMinor: MoneyMinor;
  packagingMinor: MoneyMinor;
  deliveryMinor: MoneyMinor;
  wasteMinor: MoneyMinor;
  plannedCostMinor: MoneyMinor;
  unitCostMinor: MoneyMinor;
  priceFloorMinor: MoneyMinor;
  quantity: number;
  knowledgeState: KnowledgeState;
  /** القرار ٢٢: القائمة الكاملة للنقص بعلامة إلزامي/اختياري؛ التعداد يبقى «أشدّ نقص». */
  knowledgeGaps?: readonly KnowledgeGap[];
  input: CostSnapshotInput;
  createdAt: string;
}

export type OrderStatus =
  | "draft"
  | "provisional_agreement"
  | "confirmed"
  | "in_progress"
  | "ready"
  | "delivered"
  | "settled"
  | "postponed"
  | "cancelled"
  | "needs_review";

export type SettlementStatus =
  | "unpaid"
  | "partially_paid"
  | "paid"
  | "debt"
  | "cancelled"
  | "cancelled_pending"
  | "cancelled_refunded"
  | "cancelled_retained";

export type OrderEventType =
  | "created"
  | "price_approved"
  | "status_changed"
  | "deposit_collected"
  | "deposit_refunded"
  | "deposit_retained"
  | "collection_recorded"
  | "debt_registered"
  | "specification_revised"
  | "cancelled"
  /* المجموعة ٢ (§10.5): تصحيح السعر بعد الاتفاق — علاقة موثقة لا إلغاء وإعادة إنشاء. */
  | "price_revised"
  /* المجموعة ٢ (§10.3): التراجع الموثق عن قبض مسجل — عكس أثر الكاش لا الإيراد. */
  | "collection_reversed"
  /* المجموعة ٣ (عقد D2): مواد استُهلكت فعليًا عند التسليم — توثيق في خط زمن الطلب
   * مع علاقة صريحة بحدث التسليم؛ الحركات نفسها سجل المخزون المرجعي. */
  | "delivery_consumed"
  /* المجموعة ٣ (عقد D2): عكس موثق لتسليم مكتمل — الإيراد والنتيجة تُحيَّد، الحركات
   * تُعكس مرآةً، الكاش المقبوض لا يُمس؛ الأصل باقٍ في الأحداث. */
  | "delivery_reversed"
  /* ORD-003: تسجيل/تعديل شروط النقل والتوصيل قبل التسليم — المسؤولية
   * والأعلام والمبالغ موثقة في خط زمن الطلب. */
  | "delivery_terms_recorded"
  /* المجموعة ٤ (عقد ٢٩): تصنيف صريح لمعنى العربون المحتفظ به — مال مالك أو
   * إيراد مشروع — بعد قرار الاحتفاظ؛ قرار قابل للعكس بتوثيق. */
  | "deposit_classified";

/* المجموعة ٤ (عقد ٢٩) + Conflict E: معنى العربون المحتفظ به بعد الإلغاء
 * والاحتفاظ. null (أو غياب الحقل للقديم) = قرار معلّق ظاهر بانتظار اختيار
 * المالك. «مختلط» = اكتمل المبلغ بجزئين: إيراد مشروع ومال مالك معًا. */
export type RetainedDepositMeaning = "owner" | "revenue" | "mixed";

export interface OrderEvent {
  id: string;
  type: OrderEventType;
  idempotencyKey: string;
  createdAt: string;
  note?: string;
  amountMinor?: MoneyMinor;
  fromStatus?: OrderStatus;
  toStatus?: OrderStatus;
  /** حاضرة في أحداث «تعديل السعر بعد الاتفاق» فقط: السعر قبل/بعد التصحيح. */
  fromPriceMinor?: MoneyMinor;
  toPriceMinor?: MoneyMinor;
  /** حاضرة في أحداث «التراجع عن قبض» فقط: معرّف حدث القبض المصدر — علاقة تدقيق صريحة. */
  reversesEventId?: string;
}

export interface CraftOrder {
  id: string;
  /* Conflict B: الجهة اختيارية — اسم فارغ = «زبون بلا اسم» (دين غير مسمّى
   * بتحذير ظاهر)؛ التسمية لاحقًا تعبئة باتجاه واحد من الطلب نفسه. */
  customerName: string;
  /* Conflict B: اسم طلب اختياري — تسمية ودّية للعرض فوق اسم العمل؛ اختياري
   * تمامًا والقديم بلاه يُقرأ فارغًا. */
  orderName?: string | null;
  itemName: string;
  specifications: string;
  quantity: number;
  currency: Currency;
  agreedPriceMinor: MoneyMinor;
  costSnapshot: CostSnapshot;
  costSnapshots: CostSnapshot[];
  status: OrderStatus;
  settlementStatus: SettlementStatus;
  depositCollectedMinor: MoneyMinor;
  depositSettlement: DepositSettlementDecision | null;
  /* المجموعة ٤ (عقد ٢٩): معنى العربون المحتفظ به بعد قرار الاحتفاظ —
   * مال مالك أو إيراد مشروع أو مختلط؛ null/غياب = معلق بانتظار القرار (الحالة الآمنة). */
  retainedMeaning?: RetainedDepositMeaning | null;
  /* Conflict E (تسوية جزئية): المحتفظ به حتى الآن والتصنيف المكتمل لكل معنى —
   * حقول اختيارية تجمعية؛ البيانات القديمة تُقرأ بتوافق رجعي. */
  depositRetainedMinor?: MoneyMinor;
  depositClassifiedOwnerMinor?: MoneyMinor;
  depositClassifiedRevenueMinor?: MoneyMinor;
  collectedMinor: MoneyMinor;
  receivableMinor: MoneyMinor;
  recognizedRevenueMinor: MoneyMinor;
  recognizedCostMinor: MoneyMinor;
  profitIndicatorMinor: MoneyMinor | null;
  resultStatus: ResultStatus;
  /* ORD-003: شروط النقل والتوصيل — اختيارية تمامًا؛ الطلبات القديمة بلا
   * الحقل تُقرأ «لا شروط نقل مسجلة» بلا أي أثر محاسبي جديد. */
  deliveryTerms?: OrderDeliveryTerms | null;
  nextAction: string;
  events: OrderEvent[];
  createdAt: string;
}

export interface CreateCraftOrderInput {
  id: string;
  customerName: string;
  orderName?: string | null;
  itemName: string;
  specifications: string;
  quantity: number;
  agreedPriceMinor: MoneyMinor;
  costSnapshot: CostSnapshot;
  createdAt: string;
}

export interface OrderTransitionInput {
  to: OrderStatus;
  idempotencyKey: string;
  createdAt: string;
  note?: string;
}

/* المجموعة ٢ (§10.5 — أمر التنفيذ): تعديل السعر المتفق عليه بعد الاتفاق، تصحيحًا
 * موثقًا داخل الطلب نفسه — لا إلغاء الطلب ولا إعادة إنشائه ولا مسح الاتفاق الأصلي. */
export interface ReviseAgreedPriceInput {
  newPriceMinor: MoneyMinor;
  reason: string;
  idempotencyKey: string;
  createdAt: string;
}

/* المجموعة ٢ (§10.3): التراجع الموثق عن قبضة مسجلة (تحصيل أو تحصيل دين) —
 * الكاش المقبوض يعود للعميل والمتبقي يعود دينًا مفتوحًا؛ الإيراد لا يتأثر. */
export interface ReverseCollectionInput {
  collectionEventId: string;
  amountMinor: MoneyMinor;
  reason: string;
  idempotencyKey: string;
  createdAt: string;
}

/* المجموعة ٣ (عقد D2): عكس التسليم المكتمل — تصحيح موثق لا إلغاء صامت. يبقى الأصل
 * في الأحداث، والإيراد المعروف والتكلفة المعروفة تُحيَّدان، والطلب ينتقل إلى
 * «يحتاج مراجعة» ليقرر المالك: إعادة تنفيذ أو إلغاء. الكاش المقبوض لا يتأثر. */
export interface ReverseDeliveryInput {
  reason: string;
  idempotencyKey: string;
  createdAt: string;
}

/* المجموعة ٣ (عقد D2): توثيق استهلاك مواد التسليم في خط زمن الطلب — البيان ملخص
 * بشري القراءة، والحركات المرجعية تحمل التفصيل والمعرفات. */
export interface DeliveryConsumptionNoteInput {
  note: string;
  reversesEventId: string;
  idempotencyKey: string;
  createdAt: string;
}

/* ORD-003: تسجيل شروط النقل والتوصيل قبل التسليم — تصحيح ما بعد التسليم
 * محمي (عكس التسليم هو الباب الموثق الوحيد). المبالغ اختيارية: null =
 * غير مسجلة، والصفر قيمة صريحة صحيحة. */
export interface RecordDeliveryTermsInput {
  responsibility: DeliveryResponsibility;
  feeIncludedInPrice: boolean;
  costIncludedInProductCost: boolean;
  feeChargedMinor: MoneyMinor | null;
  costPaidMinor: MoneyMinor | null;
  projectShareMinor: MoneyMinor | null;
  customerShareMinor: MoneyMinor | null;
  idempotencyKey: string;
  createdAt: string;
}

/* ORD-003: تفصيل نتيجة الطلب بمكوناتها — كل مبلغ يظهر مرة واحدة، والناقص
 * يبقى ناقصًا معلنًا لا صفرًا. null = المكون غير مسجل بعد. */
export interface OrderResultBreakdown {
  priceMinor: MoneyMinor;
  billableDeliveryFeeMinor: MoneyMinor | null;
  productCostMinor: MoneyMinor;
  projectDeliveryCostMinor: MoneyMinor | null;
  revenueMinor: MoneyMinor | null;
  costMinor: MoneyMinor | null;
  resultMinor: MoneyMinor | null;
  incompleteReasons: readonly string[];
}
