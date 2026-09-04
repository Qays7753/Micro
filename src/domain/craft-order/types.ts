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
  /* المجموعة ٤ (عقد ٢٩): تصنيف صريح لمعنى العربون المحتفظ به — مال مالك أو
   * إيراد مشروع — بعد قرار الاحتفاظ؛ قرار قابل للعكس بتوثيق. */
  | "deposit_classified";

/* المجموعة ٤ (عقد ٢٩): معنى العربون المحتفظ به بعد الإلغاء والاحتفاظ.
 * null (أو غياب الحقل للقديم) = قرار معلّق ظاهر بانتظار اختيار المالك. */
export type RetainedDepositMeaning = "owner" | "revenue";

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
  customerName: string;
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
   * مال مالك أو إيراد مشروع؛ null/غياب = معلق بانتظار القرار (الحالة الآمنة). */
  retainedMeaning?: RetainedDepositMeaning | null;
  collectedMinor: MoneyMinor;
  receivableMinor: MoneyMinor;
  recognizedRevenueMinor: MoneyMinor;
  recognizedCostMinor: MoneyMinor;
  profitIndicatorMinor: MoneyMinor | null;
  resultStatus: ResultStatus;
  nextAction: string;
  events: OrderEvent[];
  createdAt: string;
}

export interface CreateCraftOrderInput {
  id: string;
  customerName: string;
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
