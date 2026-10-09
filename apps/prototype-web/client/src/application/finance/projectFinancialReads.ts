/* Wave F (ADR-013 عنقود ٣ — تقسيم مسؤولية داخلي، 2026-10-04): قراءات الأساس
 * للقارئ الكنوني — المركز وقوائم الأحداث والالتزامات القابلة للتسديد — انتقلت
 * حرفيًا من projectFinancialService.ts إلى هذا البيت الشقيق في المالية نفسها؛
 * الخدمة (القارئ الكنوني — عقد ٤٠ §8) تبقى الواجهة والهوية، وتفوّض هنا.
 * لا صيغة ولا تقريب ولا تصنيف تحرّك — نقل نصّي فقط. */
/* PC-4 read-model (R5/S4، 2026-10-09): المدخلات = عدسات list* للقراءة فقط عبر
 * عدسة القارئ الكنوني؛ الاشتقاق ملك عائلة القارئ الكنوني (عقد المنسّق) بإعادة
 * حساب عند كل قراءة بلا ذاكرة؛ الإبطال بنيويًا غير لازم (لا حالة مشتقة مخزنة)؛
 * القديم = فشل التخزين يُطوى في storage_error. القارئ لا يكتب (حارس R5/S3). */

import {
  activeSettlementsMinor,
  reversedEventIds,
  summarizeFinancialEvents,
  type FinancialEvent,
} from "@micro-domain/financial-event/index.js";
import { summarizeLocalCraftOrders } from "@/application/financial-pulse/financialPulseService";
import type { OwnerMovement } from "@micro-domain/owner-entitlement/index.js";
import {
  FINANCIAL_EVENTS_READ_FAILED_MESSAGE,
  STORAGE_ERROR,
  storageFailure,
} from "@/application/resultCodes";
import type { PrototypeLocalStore } from "@/storage/local/types";

/** R3 (بطاقة R3-SC-01/11): عدسة الخدمة — قراءات المركز الكنوني السبع بالضبط. */
export type ProjectFinancialReadsStore = Pick<
  PrototypeLocalStore,
  | "listOrders"
  | "listDirectSales"
  | "listFinancialEvents"
  | "listSupplierPurchases"
  | "listCashWallets"
  | "listCashContinuityEntries"
  | "listOwnerMovements"
>;
import type {
  FinanceResult,
  ProjectFinancialEvidence,
  ProjectFinancialPosition,
  SettleablePayable,
} from "./projectFinancialTypes";

export async function readPosition(
  store: ProjectFinancialReadsStore,
): Promise<FinanceResult<ProjectFinancialPosition>> {
  const [
    ordersResult,
    eventsResult,
    purchasesResult,
    walletsResult,
    continuityResult,
    ownerMovementsResult,
    directSalesResult,
  ] = await Promise.all([
    store.listOrders(),
    store.listFinancialEvents(),
    store.listSupplierPurchases(),
    store.listCashWallets(),
    store.listCashContinuityEntries(),
    store.listOwnerMovements(),
    store.listDirectSales(),
  ]);
  if (
    !ordersResult.ok ||
    !eventsResult.ok ||
    !purchasesResult.ok ||
    !walletsResult.ok ||
    !continuityResult.ok ||
    !ownerMovementsResult.ok ||
    !directSalesResult.ok
  )
    return storageFailure("تعذر قراءة السجلات المالية المحلية.");
  const orderPulse = summarizeLocalCraftOrders(ordersResult.value);
  const project = summarizeFinancialEvents(eventsResult.value);
  /* §٥-١٣ (المرحلة أ): تحصيل البيع المباشر كاش كأي تحصيل — يدخل الكاش غير الموزع
   * نظير تحصيلات الطلبات. البيع الملغى لا يُحتسب: نقضُه ينقض قبضه. */
  const activeDirectSales = directSalesResult.value.filter(sale => (sale.status ?? "active") === "active");
  const directSalesCashMinor = activeDirectSales.reduce((sum, sale) => sum + sale.collectedMinor, 0);
  /* X-06 (و٤): ما قرّره المالك دَينًا من فرق البيع المباشر يظهر في «لي عند العملاء» —
   * المال المستحق لا يُخفى. و«يحتاج مراجعة» فرق لم يُقرَّر بعد فلا يدخل الذمم. */
  const directSalesReceivablesMinor = activeDirectSales
    .filter(sale => sale.collectionStatus === "partial_debt")
    .reduce((sum, sale) => sum + (sale.revenueMinor - sale.collectedMinor), 0);
  const supplierMaterialPayablesMinor = purchasesResult.value.reduce(
    (sum, purchase) => sum + purchase.payableMinor,
    0,
  );
  const supplierPurchaseCashPaidMinor = purchasesResult.value.reduce(
    (sum, purchase) => sum + purchase.paidMinor,
    0,
  );
  /* PA-002: «تخصيص» صريح ينقل القيمة من غير الموزع إلى محفظة — الإجمالي لا يتغير.
   * (إصلاح تكاملي — مجموعة ٤): التخصيص المُتراجَع يُستبعد من المجموع — التراجع عن
   * تخصيصٍ يجب أن يعيد قيمته إلى «غير الموزع» لا أن تختفي من الإجمالي المسجل
   * (حارس «التخصيص لا يغيّر الإجمالي» يشمل التراجع عنه). */
  const reversedEntryIds = new Set(
    continuityResult.value
      .filter(entry => entry.type === "reversal" && entry.reversesEntryId)
      .map(entry => entry.reversesEntryId as string),
  );
  const allocatedToWalletsMinor = continuityResult.value
    .filter(entry => entry.type === "allocation" && !reversedEntryIds.has(entry.id))
    .reduce((sum, entry) => sum + entry.cashDeltaMinor, 0);
  const unallocatedCashMinor =
    orderPulse.registeredCollectionsMinor +
    project.cashMinor -
    supplierPurchaseCashPaidMinor +
    directSalesCashMinor -
    allocatedToWalletsMinor;
  const walletCashMinor = continuityResult.value.reduce((sum, entry) => sum + entry.cashDeltaMinor, 0);
  const ownerCapitalFromMovementsMinor = ownerMovementsResult.value.reduce(
    (sum: number, movement: OwnerMovement) => sum + movement.ownerCapitalDeltaMinor,
    0,
  );
  /* المجموعة ٤ (عقد ٢٩): العربونات المحتفظة بلا قرار — كاش محتفظ به بلا معنى
   * بعد؛ ظاهرة هنا حتى يختار المالك، لا مدفونة في المجموعات. */
  const pendingRetainedDepositsMinor = ordersResult.value
    .filter(
      stored =>
        stored.order.status === "cancelled" &&
        stored.order.depositSettlement === "retain_deposit" &&
        (stored.order.retainedMeaning ?? null) === null,
    )
    .reduce((sum, stored) => sum + stored.order.depositCollectedMinor, 0);
  /* FIN-001 (قرار المالك ٢٠٢٦-٠٩-١٦): دليل كل مقياس يُحسب مع القيمة نفسها —
   * نفس منطق الرئيسية (homeControlCenterService) مصدرًا واحدًا: الطلب/الحدث/
   * الشراء/المحفظة/البيع المباشر أدلة تسجيل، والصفر المحسوب فوق سجلات قائمة
   * يبقى صفرًا موثقًا (0.00) لا «غير مسجل». */
  const hasOrders = ordersResult.value.length > 0;
  const hasActiveDirectSales = activeDirectSales.length > 0;
  const hasWallets = walletsResult.value.length > 0;
  const hasPurchases = purchasesResult.value.length > 0;
  const customerReceivablesMinorValue = orderPulse.registeredDebtMinor + directSalesReceivablesMinor;
  const hasCashEvidence =
    project.eventCount > 0 ||
    orderPulse.registeredCollectionsMinor !== 0 ||
    hasPurchases ||
    hasWallets ||
    hasActiveDirectSales;
  const hasUnallocatedEvidence =
    project.eventCount > 0 ||
    orderPulse.registeredCollectionsMinor !== 0 ||
    hasPurchases ||
    hasActiveDirectSales ||
    allocatedToWalletsMinor !== 0;
  const evidence: ProjectFinancialEvidence = {
    cash: hasCashEvidence ? "recorded" : "not_recorded",
    customerReceivables:
      hasOrders ||
      orderPulse.registeredCollectionsMinor !== 0 ||
      customerReceivablesMinorValue !== 0 ||
      hasActiveDirectSales
        ? "recorded"
        : "not_recorded",
    supplierPayables:
      hasPurchases ||
      eventsResult.value.some(
        event => event.type === "operating_expense_payable" || event.type === "payable_settlement_cash",
      )
        ? "recorded"
        : "not_recorded",
    ownerCapital:
      eventsResult.value.some(
        event => event.type === "owner_investment_cash" || event.type === "owner_withdrawal_cash",
      ) || ownerMovementsResult.value.length > 0
        ? "recorded"
        : "not_recorded",
    walletCash: hasWallets ? "recorded" : "not_recorded",
    unallocatedCash: hasUnallocatedEvidence ? "recorded" : "not_recorded",
    operatingExpenses: eventsResult.value.some(event => event.operatingExpenseDeltaMinor !== 0)
      ? "recorded"
      : "not_recorded",
    borrowedLoans: eventsResult.value.some(
      event => event.type === "loan_received_cash" || event.type === "loan_received_repayment_cash",
    )
      ? "recorded"
      : "not_recorded",
  };
  return {
    ok: true,
    value: {
      recordedCashMinor: unallocatedCashMinor + walletCashMinor,
      customerReceivablesMinor: customerReceivablesMinorValue,
      supplierPayablesMinor: project.payableMinor + supplierMaterialPayablesMinor,
      ownerCapitalRecordedMinor: project.ownerCapitalMinor + ownerCapitalFromMovementsMinor,
      operatingExpensesRecordedMinor: project.operatingExpenseMinor,
      orderCollectionsMinor: orderPulse.registeredCollectionsMinor,
      projectEventCount: project.eventCount,
      supplierPurchaseCount: purchasesResult.value.length,
      supplierMaterialPayablesMinor,
      operatingPayablesMinor: project.payableMinor,
      walletCashMinor,
      unallocatedCashMinor,
      cashWalletCount: walletsResult.value.length,
      amanahHeldMinor: project.amanahMinor,
      allocatedToWalletsMinor,
      assetBookValueMinor: project.assetMinor,
      loansOutstandingMinor: project.loanMinor,
      borrowedLoansOutstandingMinor: project.loanPayableMinor,
      pendingRetainedDepositsMinor,
      evidence,
    },
  };
}

export async function listEvents(
  store: ProjectFinancialReadsStore,
): Promise<FinanceResult<readonly FinancialEvent[]>> {
  const result = await store.listFinancialEvents();
  return result.ok ? { ok: true, value: result.value } : storageFailure(FINANCIAL_EVENTS_READ_FAILED_MESSAGE);
}

export async function listSettleablePayables(
  store: ProjectFinancialReadsStore,
): Promise<FinanceResult<readonly SettleablePayable[]>> {
  const events = await store.listFinancialEvents();
  if (!events.ok) return storageFailure(FINANCIAL_EVENTS_READ_FAILED_MESSAGE);
  const reversedIds = reversedEventIds(events.value);
  return {
    ok: true,
    value: events.value
      .filter(
        event =>
          event.type === "operating_expense_payable" &&
          event.payableDeltaMinor > 0 &&
          !reversedIds.has(event.id),
      )
      .map(event => ({
        event,
        remainingMinor: event.amountMinor - activeSettlementsMinor(events.value, event.id),
      }))
      .filter(payable => payable.remainingMinor > 0),
  };
}
