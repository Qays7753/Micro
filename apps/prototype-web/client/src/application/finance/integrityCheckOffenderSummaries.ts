/* Wave 4.3 — P-4.3-3 (D9): إثراء قراءة فقط لنتائج الفحص — يحوّل معرّفات
 * السجلات المتأثرة إلى ملخصات مقروءة (اسم/تاريخ/مبلغ/رابط) من المخزن نفسه؛
 * لا فحص يتغير ولا عدد ولا منطق — فقط أصدق عرض للنتيجة نفسها.
 * انتقلت حرفيًا من integrityCheckService.ts في Wave F (ADR-013 — تقسيم
 * مسؤولية داخلي). */
import { localDateInAmman as ammanDate } from "@micro-domain/shared/index.js";
import type { PrototypeLocalStore } from "@/storage/local/types";

/** R3 (بطاقة R3-SC-01/11): عدسة الخدمة — قراءات الملخصات السبع بالضبط. */
export type IntegrityCheckOffenderSummariesStore = Pick<
  PrototypeLocalStore,
  | "listOrders"
  | "listFinancialEvents"
  | "listSupplierPurchases"
  | "listCashWallets"
  | "listMaterials"
  | "listAssets"
  | "listLoans"
>;
import type { IntegrityCheckResult, IntegrityOffenderSummary } from "./integrityCheckModel";

/* حل المعرّفات الخام إلى ملخصات مقروءة — قراءات إضافية تحدث فقط حين
 * توجد متأثرون فعلًا؛ الفشل في الإثراء لا يفشل الفحص (المعرّف الخام يبقى). */
export async function attachOffenderSummaries(
  checks: IntegrityCheckResult[],
  store: IntegrityCheckOffenderSummariesStore,
): Promise<void> {
  const wanted = new Set<string>();
  for (const check of checks) for (const id of check.offenderSampleIds ?? []) wanted.add(id);
  if (wanted.size === 0) return;
  const [events, orders, wallets, purchases, assets, loans, materials] = await Promise.all([
    store.listFinancialEvents(),
    store.listOrders(),
    store.listCashWallets(),
    store.listSupplierPurchases(),
    store.listAssets(),
    store.listLoans(),
    store.listMaterials(),
  ]);
  const summaries = new Map<string, IntegrityOffenderSummary>();
  if (events.ok)
    for (const event of events.value)
      if (wanted.has(event.id))
        summaries.set(event.id, {
          id: event.id,
          kind: "financial_event",
          name: null,
          eventType: event.type,
          dateLocal: event.occurredOn,
          amountMinor: event.amountMinor,
          href: `/finance?layer=events&event=${encodeURIComponent(event.id)}`,
        });
  if (orders.ok)
    for (const stored of orders.value)
      if (wanted.has(stored.id))
        summaries.set(stored.id, {
          id: stored.id,
          kind: "craft_order",
          name: stored.order.itemName || stored.order.customerName || null,
          dateLocal: ammanDate(stored.order.createdAt),
          amountMinor: stored.order.agreedPriceMinor,
          href: `/orders/${encodeURIComponent(stored.id)}`,
        });
  if (wallets.ok)
    for (const wallet of wallets.value)
      if (wanted.has(wallet.id))
        summaries.set(wallet.id, {
          id: wallet.id,
          kind: "cash_wallet",
          name: wallet.name,
          dateLocal: ammanDate(wallet.createdAt),
          amountMinor: null,
          href: `/cash/wallet/${encodeURIComponent(wallet.id)}`,
        });
  if (purchases.ok)
    for (const purchase of purchases.value)
      if (wanted.has(purchase.id))
        summaries.set(purchase.id, {
          id: purchase.id,
          kind: "supplier_purchase",
          name: purchase.supplierName,
          dateLocal: purchase.purchasedOn,
          amountMinor: purchase.totalMinor,
          href: `/suppliers/purchase/${encodeURIComponent(purchase.id)}`,
        });
  if (assets.ok)
    for (const asset of assets.value)
      if (wanted.has(asset.id))
        summaries.set(asset.id, {
          id: asset.id,
          kind: "asset",
          name: asset.name,
          dateLocal: asset.purchaseDate,
          amountMinor: asset.acquisitionAmountMinor,
          href: `/assets/${encodeURIComponent(asset.id)}`,
        });
  if (loans.ok)
    for (const loan of loans.value)
      if (wanted.has(loan.id))
        summaries.set(loan.id, {
          id: loan.id,
          kind: "loan",
          name: loan.borrowerName,
          dateLocal: loan.loanDate,
          amountMinor: loan.principalMinor,
          href: `/loans/${encodeURIComponent(loan.id)}`,
        });
  if (materials.ok)
    for (const material of materials.value)
      if (wanted.has(material.id))
        summaries.set(material.id, {
          id: material.id,
          kind: "material",
          name: material.name,
          dateLocal: null,
          amountMinor: null,
          href: "/inventory",
        });
  for (const check of checks) {
    const sample = (check.offenderSampleIds ?? [])
      .map(id => summaries.get(id))
      .filter((summary): summary is IntegrityOffenderSummary => summary !== undefined);
    if (sample.length > 0) check.offenderSample = sample;
  }
}
