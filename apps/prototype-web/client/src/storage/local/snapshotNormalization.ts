/** S02-A (SH-03): تطبيع اللقطة قبل الاستبدال — نفس القواعد الحرفية التي
 * كانت مضمّنة في المحوّلين (الغياب الآمن: قائمة فارغة للعائلات، null للسجلات
 * المفردة)؛ استخراجها إلى مصدر واحد شرط صحة العقد الجديد: بصمة المآل
 * تُحسب فوق الشكل المخزَّن نفسه عند المحوّلين معًا. هذا الملف صغير عمدًا
 * ويُستورد من المحوّلين (كومة الإقلاع) — لا يُضاف إليه غير التطبيع أبدًا.
 */
import type { LocalStoreSnapshot } from "./types";

export function normalizeSnapshotForReplacement(snapshot: LocalStoreSnapshot): LocalStoreSnapshot {
  return {
    ...snapshot,
    ownerProfile: snapshot.ownerProfile ?? null,
    schedules: snapshot.schedules ?? [],
    directSales: snapshot.directSales ?? [],
    recurrences: snapshot.recurrences ?? [],
    financialEvents: snapshot.financialEvents ?? [],
    supplierPurchases: snapshot.supplierPurchases ?? [],
    cashWallets: snapshot.cashWallets ?? [],
    cashContinuityEntries: snapshot.cashContinuityEntries ?? [],
    materials: snapshot.materials ?? [],
    inventoryMovements: snapshot.inventoryMovements ?? [],
    inventoryShortages: snapshot.inventoryShortages ?? [],
    inventoryActivation: snapshot.inventoryActivation ?? null,
    catalogItems: snapshot.catalogItems ?? [],
    measurementUnits: snapshot.measurementUnits ?? [],
    directConversions: snapshot.directConversions ?? [],
    catalogTemplates: snapshot.catalogTemplates ?? [],
    actualTimeRecords: snapshot.actualTimeRecords ?? [],
    shortCashDeclarations: snapshot.shortCashDeclarations ?? [],
    ownerEntitlementPolicies: snapshot.ownerEntitlementPolicies ?? [],
    ownerEntitlementRecords: snapshot.ownerEntitlementRecords ?? [],
    ownerEntitlementOpeningBalances: snapshot.ownerEntitlementOpeningBalances ?? [],
    ownerMovements: snapshot.ownerMovements ?? [],
    allocationPolicies: snapshot.allocationPolicies ?? [],
    costEstimates: snapshot.costEstimates ?? [],
    assets: snapshot.assets ?? [],
    loans: snapshot.loans ?? [],
    receivedLoans: snapshot.receivedLoans ?? [],
    /* S04 (DOC-013 / UNIT-025): رصد الأرصدة — الغياب في اللقطة القديمة = قائمة فارغة بلا اختراع قياس. */
    balanceObservations: snapshot.balanceObservations ?? [],
    /* S05 (DOC-014 / UNIT-037): الأطراف المحفوظة — الغياب في اللقطة القديمة =
     * قائمة فارغة بلا اختراع هوية. */
    counterparties: snapshot.counterparties ?? [],
    recurringExpenseSeries: snapshot.recurringExpenseSeries ?? [],
    recurringExpenseRevisions: snapshot.recurringExpenseRevisions ?? [],
    recurringExpenseOccurrences: snapshot.recurringExpenseOccurrences ?? [],
    expenseBudgets: snapshot.expenseBudgets ?? [],
  };
}
