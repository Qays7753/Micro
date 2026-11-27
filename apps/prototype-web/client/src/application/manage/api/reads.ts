/**
 * M5.1 (Manage v2 phase 5 — IMPACT §12 «Client API»): عميل قراءات مانج-في₂ —
 * نداءات GET لموديولات القراءة الخادمية (§8 الأشكال، المنتجات، سجل
 * المطابقة). العميل يستهلك الاستجابة كما هي: كل رقم مالي يصل نصًا جاهزًا.
 */
import { apiFetch } from "@/application/network";

/** فترة §8 (C-06): أسبوع/شهر/سنة/منذ البداية. */
export type ManagePeriod = "week" | "month" | "year" | "since_start";

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
  perTenRatio: { perTenText: string; shown: boolean } | { perTen: string | null };
  biggestExpense: { category: string; fils: number; text: string } | null;
  expensesByCategory: Array<{ category: string; fils: number; text: string }>;
  materialsAlert: boolean;
  unexplained: { fils: number; shown: boolean; text: string };
  netWorth: Figure | UnknownFigure;
  netWorthSources: {
    openingFils: number;
    ownerDepositsFils: number;
    ownerWithdrawalsFils: number;
    netProfitSinceStartFils: number;
    unexplainedFils: number;
    totalFils: number;
  } | null;
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
  topSellers: Array<{ productId: string; name: string; valueFils: number; quantityText: string }>;
  topProfit: Array<{ productId: string; name: string; profitFils: number; perUnitText: string }>;
  bars: Array<{ label: string; from: string; to: string; netProfitFils: number; incomplete: boolean }>;
  flags: { newUser: boolean; incompletePeriod: boolean; unknownBalance: boolean };
}

/** M5.1 — موديول القراءة الواحد (§8/§8.2): كل رقم معروض مصدره هنا. */
export function fetchManageFigures(period: ManagePeriod = "month"): Promise<ManageFiguresResponse> {
  return apiFetch<ManageFiguresResponse>(`/api/manage-v2/figures?period=${period}`);
}
