/** Local financial pulse: aggregates only named CraftOrder fields and never claims project cash, profit, or a Ledger. */
import type { PrototypeLocalStore, StoredCraftOrder } from "@/storage/local/types";

export type LocalFinancialPulse = {
  source: "local_craft_orders";
  currency: "JOD";
  totalOrderCount: number;
  activeOrderCount: number;
  deliveredOrSettledOrderCount: number;
  registeredCollectionsMinor: number;
  registeredDebtMinor: number;
  finalResultOrderCount: number;
  recognizedRevenueFromFinalOrdersMinor: number;
  recognizedCostFromFinalOrdersMinor: number;
  resultsAwaitingKnowledgeCount: number;
};

export type FinancialPulseResult =
  | { ok: true; pulse: LocalFinancialPulse; orders: readonly StoredCraftOrder[] }
  | { ok: false; code: "storage_error"; message: string };

const zeroPulse = (): LocalFinancialPulse => ({
  source: "local_craft_orders",
  currency: "JOD",
  totalOrderCount: 0,
  activeOrderCount: 0,
  deliveredOrSettledOrderCount: 0,
  registeredCollectionsMinor: 0,
  registeredDebtMinor: 0,
  finalResultOrderCount: 0,
  recognizedRevenueFromFinalOrdersMinor: 0,
  recognizedCostFromFinalOrdersMinor: 0,
  resultsAwaitingKnowledgeCount: 0,
});

export function summarizeLocalCraftOrders(orders: readonly StoredCraftOrder[]): LocalFinancialPulse {
  return orders.reduce<LocalFinancialPulse>((pulse, stored) => {
    const { order } = stored;
    const isDeliveredOrSettled = order.status === "delivered" || order.status === "settled";
    const hasFinalResult = order.resultStatus === "final";
    return {
      ...pulse,
      totalOrderCount: pulse.totalOrderCount + 1,
      activeOrderCount:
        order.status === "settled" || order.status === "cancelled"
          ? pulse.activeOrderCount
          : pulse.activeOrderCount + 1,
      deliveredOrSettledOrderCount: isDeliveredOrSettled
        ? pulse.deliveredOrSettledOrderCount + 1
        : pulse.deliveredOrSettledOrderCount,
      registeredCollectionsMinor: pulse.registeredCollectionsMinor + order.collectedMinor,
      registeredDebtMinor:
        order.settlementStatus === "debt"
          ? pulse.registeredDebtMinor + order.receivableMinor
          : pulse.registeredDebtMinor,
      finalResultOrderCount: hasFinalResult ? pulse.finalResultOrderCount + 1 : pulse.finalResultOrderCount,
      recognizedRevenueFromFinalOrdersMinor: hasFinalResult
        ? pulse.recognizedRevenueFromFinalOrdersMinor + order.recognizedRevenueMinor
        : pulse.recognizedRevenueFromFinalOrdersMinor,
      recognizedCostFromFinalOrdersMinor: hasFinalResult
        ? pulse.recognizedCostFromFinalOrdersMinor + order.recognizedCostMinor
        : pulse.recognizedCostFromFinalOrdersMinor,
      resultsAwaitingKnowledgeCount:
        isDeliveredOrSettled && !hasFinalResult
          ? pulse.resultsAwaitingKnowledgeCount + 1
          : pulse.resultsAwaitingKnowledgeCount,
    };
  }, zeroPulse());
}

export class FinancialPulseService {
  constructor(private readonly store: PrototypeLocalStore) {}

  async read(): Promise<FinancialPulseResult> {
    const result = await this.store.listOrders();
    if (!result.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة صورة الطلبات المحلية." };
    return { ok: true, pulse: summarizeLocalCraftOrders(result.value), orders: result.value };
  }
}
