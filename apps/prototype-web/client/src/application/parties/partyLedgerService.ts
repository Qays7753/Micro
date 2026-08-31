/**
 * Lightweight Party Ledger (PA-010 + owner principle 5.3): name-level aggregation over existing
 * records — no CRM entity, no new stores. Reads orders, direct sales, purchases, and payables,
 * groups them by trimmed party name, and reports both directions with movement detail.
 */
import { activeSettlementsMinor, reversedEventIds } from "@micro-domain/financial-event/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import type { PrototypeLocalStore, StoredCraftOrder } from "@/storage/local/types";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";

export type PartyLedgerResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: "storage_error"; message: string };

export type PartyMovementKind =
  | "order_debt"
  | "order_collection"
  | "direct_sale_debt"
  | "direct_sale_collected"
  | "purchase_payable"
  | "purchase_payment"
  | "payable_event"
  | "settlement";

export type PartyMovement = {
  id: string;
  kind: PartyMovementKind;
  label: string;
  occurredOn: string;
  /** موجب = لك عند الطرف؛ سالب = عليك للطرف. */
  amountMinor: number;
  href: string;
};

export type PartyEntry = {
  name: string;
  /** لك عند الطرف (دين/تحصيل) — المتبقي الحالي. */
  receivableMinor: number;
  /** عليك للطرف (ذمم دائنة) — المتبقي الحالي. */
  payableMinor: number;
  movements: readonly PartyMovement[];
};

type MutablePartyEntry = Omit<PartyEntry, "movements"> & { movements: PartyMovement[] };

export type PartyLedgerOverview = {
  parties: readonly PartyEntry[];
  totalReceivableMinor: number;
  totalPayableMinor: number;
  receivablePartyCount: number;
  payablePartyCount: number;
};

const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ");

export class PartyLedgerService {
  constructor(private readonly store: PrototypeLocalStore) {}

  async read(): Promise<PartyLedgerResult<PartyLedgerOverview>> {
    const [orders, sales, purchases, events] = await Promise.all([
      this.store.listOrders(),
      this.store.listDirectSales(),
      this.store.listSupplierPurchases(),
      this.store.listFinancialEvents(),
    ]);
    if (!orders.ok || !sales.ok || !purchases.ok || !events.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة سجلات الأطراف المحلية." };

    const parties = new Map<string, MutablePartyEntry>();
    const party = (name: string): MutablePartyEntry => {
      const key = normalizeName(name);
      if (!key) throw new Error("اسم الطرف فارغ.");
      let entry = parties.get(key);
      if (!entry) {
        entry = { name: key, receivableMinor: 0, payableMinor: 0, movements: [] };
        parties.set(key, entry);
      }
      return entry;
    };

    /* ١) الطلبات الحرفية: الدين المسجل والتحصيلات باسم العميل. */
    for (const stored of orders.value as readonly StoredCraftOrder[]) {
      const customerName = stored.order.customerName;
      if (!customerName?.trim()) continue;
      const entry = party(customerName);
      if (stored.order.settlementStatus === "debt" && stored.order.receivableMinor > 0) {
        entry.receivableMinor += stored.order.receivableMinor;
        entry.movements.push({
          id: `order-debt:${stored.id}`,
          kind: "order_debt",
          label: `دين طلب: ${stored.order.itemName || "طلب"}`,
          occurredOn: stored.updatedAt.slice(0, 10),
          amountMinor: stored.order.receivableMinor,
          href: `/orders/${stored.id}`,
        });
      }
      if (stored.order.collectedMinor > 0) {
        entry.movements.push({
          id: `order-collected:${stored.id}`,
          kind: "order_collection",
          label: `تحصيلات طلب: ${stored.order.itemName || "طلب"}`,
          occurredOn: stored.updatedAt.slice(0, 10),
          amountMinor: stored.order.collectedMinor,
          href: `/orders/${stored.id}`,
        });
      }
    }

    /* ٢) البيع المباشر: الديون المعلنة والقبض المحصل — D-001: الزبون حقل مستقل
     * (customerName)، والملاحظة القديمة مصدر احتياطي للسجلات التي سبق الحقل فقط. */
    for (const sale of sales.value as readonly DirectSale[]) {
      if ((sale.status ?? "active") !== "active") continue;
      const name =
        sale.customerName?.trim() || (sale.note?.trim() ? extractPartyFromNote(sale.note) : null);
      if (!name) continue;
      const entry = party(name);
      if (sale.collectionStatus === "partial_debt") {
        entry.receivableMinor += sale.revenueMinor - sale.collectedMinor;
        entry.movements.push({
          id: `sale-debt:${sale.id}`,
          kind: "direct_sale_debt",
          label: `دين بيع مباشر: ${sale.itemName || "بيع"}`,
          occurredOn: sale.occurredOn,
          amountMinor: sale.revenueMinor - sale.collectedMinor,
          href: `/direct-sales/${sale.id}`,
        });
      }
    }

    /* ٣) مشتريات الموردين: الذمم والدفعات باسم المورد. */
    for (const purchase of purchases.value) {
      const entry = party(purchase.supplierName);
      entry.payableMinor += purchase.payableMinor;
      if (purchase.payableMinor > 0)
        entry.movements.push({
          id: `purchase-payable:${purchase.id}`,
          kind: "purchase_payable",
          label: `ذمة شراء: ${purchase.note || "مواد"}`,
          occurredOn: purchase.purchasedOn,
          amountMinor: -purchase.payableMinor,
          href: `/suppliers/purchase/${purchase.id}`,
        });
      const paidAfterInitial = purchase.paidMinor - (purchase.payments[0]?.amountMinor ?? 0);
      if (paidAfterInitial > 0)
        entry.movements.push({
          id: `purchase-paid:${purchase.id}`,
          kind: "purchase_payment",
          label: `دفعات سُددت: ${purchase.note || "مواد"}`,
          occurredOn: purchase.updatedAt,
          amountMinor: paidAfterInitial,
          href: `/suppliers/purchase/${purchase.id}`,
        });
    }

    /* ٤) أحداث الذمم: التزامات الموظفين/الجهات باسم الجهة (counterparty). */
    const reversedIds = reversedEventIds(events.value as readonly FinancialEvent[]);
    for (const event of events.value as readonly FinancialEvent[]) {
      if (!event.counterparty?.trim()) continue;
      if (event.correctionType === "reverse" || reversedIds.has(event.id)) continue;
      const entry = party(event.counterparty);
      if (event.type === "operating_expense_payable" && event.payableDeltaMinor > 0) {
        const remaining = event.amountMinor - activeSettlementsMinor(events.value, event.id);
        if (remaining > 0) {
          entry.payableMinor += remaining;
          entry.movements.push({
            id: `payable:${event.id}`,
            kind: "payable_event",
            label: `التزام: ${event.note}`,
            occurredOn: event.occurredOn,
            amountMinor: -remaining,
            href: "/finance",
          });
        }
      }
    }

    const list: readonly PartyEntry[] = Array.from(parties.values())
      .map(entry => ({
        ...entry,
        movements: entry.movements
          .slice()
          .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)),
      }))
      .filter(entry => entry.movements.length > 0 || entry.receivableMinor !== 0 || entry.payableMinor !== 0)
      .sort(
        (a, b) =>
          Math.abs(b.receivableMinor) + Math.abs(b.payableMinor) -
          (Math.abs(a.receivableMinor) + Math.abs(a.payableMinor)),
      );

    return {
      ok: true,
      value: {
        parties: list,
        totalReceivableMinor: list.reduce((sum, entry) => sum + entry.receivableMinor, 0),
        totalPayableMinor: list.reduce((sum, entry) => sum + entry.payableMinor, 0),
        receivablePartyCount: list.filter(entry => entry.receivableMinor > 0).length,
        payablePartyCount: list.filter(entry => entry.payableMinor > 0).length,
      },
    };
  }
}

/* استخراج اسم الطرف من ملاحظة البيع المباشر بصيغة «عميل: اسم» أو «لـ اسم» — للسجلات
 * القديمة فقط (قبل حقل customerName): الاسم ينتهي عند شرطة الوصف « — ...» إن وجدت،
 * فلا يظهر الوصف جزءًا من اسم الشخص. لا يُعاد كتابة أي سجل مخزّن. */
function extractPartyFromNote(note: string): string | null {
  const nameBeforeDescriptor = (raw: string): string | null => {
    const beforeDash = raw.split("—")[0]?.trim();
    return beforeDash || null;
  };
  const colonMatch = note.match(/^(?:عميل|لـ|للعميل)\s*:\s*(.+)$/u);
  if (colonMatch?.[1]) {
    const name = nameBeforeDescriptor(colonMatch[1]);
    if (name) return name;
  }
  const prefixed = note.match(/^(?:لـ|للعميل)\s+(.+)$/u);
  if (prefixed?.[1]) {
    const name = nameBeforeDescriptor(prefixed[1]);
    if (name) return name;
  }
  return null;
}
