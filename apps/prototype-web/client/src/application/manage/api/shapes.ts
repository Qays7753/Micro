/** فترة §8 (C-06): أسبوع/شهر/سنة/منذ البداية. */
export type ManagePeriod = "week" | "month" | "year" | "since_start";

/**
 * M5.7 (قسمة السطح من reads.ts — كل ملف أسطح مانج تحت شريط المراجعة 400):
 * أشكال استجابات قراءات مانج-في₂ — الأنواع وحدها؛ الدوال في reads.ts
 * وكل الواردات القائمة تعمل عبر إعادة تصديرها هناك.
 */

/** رقم مالي من الخادم: الفلس الخام + النصان الجاهزان (T54/R-20/R-22). */
export interface Figure {
  fils: number;
  /** صيغة التقرير: ٣ منازل دائمًا («75.000 د»). */
  text: string;
  /** صيغة اللوحة و«مشروعي الآن»: صحيح بلا كسور («75 د»). */
  textDashboard: string;
}

/** رقم غير معروف (صندوق فعّال بافتتاح مجهول — §8): يُعرض بمفتاح
 *  l.unknown_balance من الكتالوج، لا بقيمة جزئية أبدًا. */
export interface UnknownFigure {
  fils: null;
  labelKey: "l.unknown_balance";
}

/** استجابة موديول القراءة الواحد — الشكل الحرفي من readModel.ts (M2.11+). */
export interface ManageFiguresResponse {
  period: { kind: ManagePeriod; from: string; to: string; label: string; labelText: string };
  boxes: Array<{
    id: string;
    kind: string;
    status: string;
    openingStatus: string;
    balanceFils: number | null;
    balanceLabelKey?: "l.unknown_balance";
    text?: string;
    textDashboard?: string;
  }>;
  totalBalance: Figure | UnknownFigure;
  receivables: Figure;
  payables: Figure;
  payablesPrepayments: Figure;
  whatYouHave: Figure | UnknownFigure;
  whatYouOwe: Figure;
  whatYouOweBreakdown: Array<{ kind: string; fils: number; text: string }>;
  sales: Figure;
  returnsAndDiscounts: Figure;
  netSales: Figure;
  netProfit: Figure;
  expenses: Figure;
  equipment: Figure;
  personalWithdrawals: Figure;
  ownerDeposits: Figure;
  /** §8 النسبة لكل 10 دنانير — شكل الدومين الحرفي من موديول القراءة: نسبة
   *  بنصها، أو خسارة (S-LOSS بدل الجملة)، أو مخفية (صافي مبيعات ≤ 0). */
  perTenRatio:
    | { kind: "ratio"; tenths: number; text: string }
    | { kind: "loss"; labelKey: "S-LOSS" }
    | { kind: "hidden"; labelKey: "c.withdrawals_only" };
  biggestExpense: { category: string; fils: number; text: string } | null;
  expensesByCategory: Array<{ category: string; fils: number; text: string }>;
  materialsAlert: boolean;
  unexplained: { fils: number; shown: boolean; text: string };
  netWorth: Figure | UnknownFigure;
  /** مصادر صافي القيمة (§8 — P-33): كل مصدر بفلسه الخام ونصه الجاهز
   *  (٣ منازل — تقرير). الافتتاح والمجموع null مع رصيد مجهول (§8.2)،
   *  وباقي المصادر معروفة لأن قيودها كلها محسوبة. */
  netWorthSources: {
    openingFils: number | null;
    openingText: string | null;
    ownerDepositsFils: number;
    ownerDepositsText: string;
    ownerWithdrawalsFils: number;
    ownerWithdrawalsText: string;
    netProfitSinceStartFils: number;
    netProfitSinceStartText: string;
    unexplainedFils: number;
    unexplainedText: string;
    totalFils: number | null;
    totalText: string | null;
  };
  overdueReceivables: Array<{
    lineId: string;
    counterpartyName: string | null;
    outstandingFils: number;
    originOn: string;
    text: string;
  }>;
  balanceLines: Array<{
    id: string;
    direction: string;
    kind: string;
    counterpartyName: string | null;
    originOn: string;
    outstandingFils: number;
    overdue: boolean;
    text: string;
  }>;
  salesList: Array<{
    id: string;
    status: string;
    customerName: string | null;
    registeredOn: string;
    plannedDeliveryOn: string;
    deliveredOn: string | null;
    tracked: boolean;
    hiddenFromTracker: boolean;
    finalPriceFils: number | null;
    prepaymentFils: number;
    netSaleRevenueFils: number;
    expectedProfitFils: number | null;
    fullAmountFils: number | null;
    paid: { paidFils: number; ofFils: number | null };
  }>;
  openSales: Array<{
    id: string;
    status: string;
    customerName: string | null;
    plannedDeliveryOn: string;
    tracked: boolean;
    hiddenFromTracker: boolean;
    finalPriceFils: number | null;
    prepaymentFils: number;
    fullAmountFils: number | null;
  }>;
  topSellers: Array<{
    productId: string;
    name: string;
    valueFils: number;
    quantityText: string;
    unitLabel: string | null;
  }>;
  topProfit: Array<{ productId: string; name: string; profitFils: number; perUnitText: string }>;
  bars: Array<{ label: string; from: string; to: string; netProfitFils: number; incomplete: boolean }>;
  flags: { newUser: boolean; incompletePeriod: boolean; unknownBalance: boolean };
}

/** حالة المشروع (M5.2 — P-10/P-11): الاسم + الانقطاع المفتوح بأيامه. */
export interface ProjectStateResponse {
  projectId: string;
  name: string;
  openAbsence: {
    startedOn: string;
    endedOn: string;
    /** الأيام منذ آخر تسجيل — محسوبة في الخادم (نص العرض عند العميل). */
    daysSinceLastRecord: number;
  } | null;
}

/** سجل المطابقة (M4.5): صفوف §3.10 + علامة R-8 المستحقة. */
export interface ReconciliationLogResponse {
  due: boolean;
  reconciliations: Array<{
    id: string;
    performedOn: string;
    context: string;
    boxes: Array<{ boxId: string; kind: string; recordedFils: number; countedFils: number }>;
  }>;
}

/** صف C-09 (M5.2): حقول عرض الطلب + أرقام §8.2 الخام من موديول القراءة. */
export interface SaleRow {
  id: string;
  status: string;
  customerName: string | null;
  firstLineDescription: string;
  plannedDeliveryOn: string;
  deliveredOn: string | null;
  tracked: boolean;
  hiddenFromTracker: boolean;
  paidFils: number;
  ofFils: number | null;
  fullAmountFils: number | null;
}

/** تفاصيل الطلب (M5.3 — P-21): الطلب وبنوده وتوصيله وسجله المالي. */
export interface SaleDetailsResponse {
  sale: {
    id: string;
    status: string;
    customerName: string | null;
    registeredOn: string;
    plannedDeliveryOn: string;
    deliveredOn: string | null;
    finalPriceFils: number | null;
    finalPriceText: string | null;
    tracked: boolean;
    hiddenFromTracker: boolean;
    note: string | null;
    prepaymentFils: number;
    expectedProfitFils: number | null;
    netSaleRevenueFils: number;
    fullAmountFils: number | null;
    paidFils: number;
    paidOfFils: number | null;
    customerRefundDueFils: number | null;
    customerRefundDueText: string | null;
    /** P-21 §4: «آخر تعديل» — بتاريخ عمّان من الخادم؛ null إذا لم يُعدّل قط. */
    lastEditOn: string | null;
  };
  /** P-21 «الحالات»: صفوف السجل تعرض الصندوق مع صندوقين فقط (C-10). */
  boxesCount: number;
  lines: Array<{
    id: string;
    productId: string | null;
    description: string;
    quantityMilli: number;
    unitPriceFils: number | null;
    unitLabel: string | null;
  }>;
  deliveryCosts: Array<{
    operationId: string;
    amountFils: number;
    amountText: string;
    source: string;
    effectiveOn: string;
  }>;
  history: Array<{
    operationId: string;
    kind: string;
    effectiveOn: string;
    amountFils: number | null;
    amountText: string | null;
    status: string;
    corrected: boolean;
    boxKind: string | null;
    category: string | null;
  }>;
}

/** منتج (M5.3 — P-22/P-23): السطر والسعر والتكلفة §3.3 ومكوّناته
 *  (P-23 معبّاة — الحفظ بلا مكوّنات يمسحها جملة، عقد الخادم). */
export interface ProductItem {
  productId: string;
  name: string;
  unitLabel: string | null;
  unitPriceFils: number;
  unitCostFils: number | null;
  archived: boolean;
  components: Array<{ name: string; costFils: number }>;
}

/** صف حركة C-10 (M5.4 — P-30 §10): آخر 5 حركات بنصوص الخادم. */
export interface ActivityRow {
  operationId: string;
  kind: string;
  effectiveOn: string;
  name: string | null;
  amountText: string | null;
  deliveryCostText: string | null;
  boxKind: string | null;
  corrected: boolean;
  cancelled: boolean;
  saleId: string | null;
  saleStatus: string | null;
  /** تسمية ج-١ الشرطية (اتجاه السابق/مصدر الإيداع/نوع السحب) من payload. */
  variant: string | null;
  /** تصنيف المصروف (§10.2 — تسمية صف المصروف). */
  category: string | null;
}

/** صف مجمّع R-28 (M5.6 — P-41): أجزاؤه ومبلغه حسب القاعدة. */
export interface ActivityCompoundRow {
  compound: true;
  groupId: string;
  labelKey: "op.sale" | "op.deliver";
  effectiveOn: string;
  name: string | null;
  amountText: string | null;
  saleId: string;
  saleStatus: string | null;
  corrected: boolean;
  cancelled: boolean;
  members: Array<{
    operationId: string;
    kind: string;
    amountText: string | null;
    corrected: boolean;
    cancelled: boolean;
  }>;
}

/** فلاتر السجل (P-41): بحث بالاسم + مجموعة ج-١ + الفترة. */
export interface ActivityLogFilters {
  search?: string;
  type?:
    | "all"
    | "rep.opening"
    | "op.sale"
    | "op.collect"
    | "op.pay"
    | "op.expense"
    | "op.deposit"
    | "op.withdraw"
    | "op.transfer"
    | "op.reconcile";
  period?: ManagePeriod;
}

/** نسخة الحركة (M5.6 — P-42/P-43). */
export interface OperationVersion {
  operationId: string;
  kind: string;
  effectiveOn: string;
  amountText: string | null;
  deliveryCostText: string | null;
  boxKind: string | null;
  personalMoney: boolean;
  name: string | null;
  category: string | null;
  note: string | null;
  saleId: string | null;
  saleStatus: string | null;
  corrected: boolean;
  cancelled: boolean;
  variant: string | null;
}

/** خط رصيد وحركاته (M5.6 — P-45). */
export interface BalanceLineDetails {
  line: {
    id: string;
    direction: string;
    kind: string;
    counterpartyName: string | null;
    originOn: string;
    outstandingFils: number;
    outstandingText: string;
    overdue: boolean;
    saleId: string | null;
  };
  movements: ActivityRow[];
}

/** فرق مطابقة صندوق (M5.7 — P-50). */
export interface ReconcileBoxDiff {
  boxId: string;
  kind: "cash" | "account";
  recordedFils: number | null;
  recordedText: string | null;
  countedFils: number;
  countedText: string;
  deltaFils: number;
  deltaText: string;
}

/** استجابة فروق المطابقة (M5.7 — P-50/P-51). */
export interface ReconcileDiffResponse {
  boxes: ReconcileBoxDiff[];
  allZero: boolean;
  transferProposal: { fromBox: string; toBox: string; amountFils: number; amountText: string } | null;
}
