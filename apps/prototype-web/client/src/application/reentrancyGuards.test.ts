/** حتمية الإرسال المتزامن (إصلاح P0 — إعادة الدخول): نداءان متزامنان بمفتاح
 * حتمية واحد (نبضة مزدوجة، أو «احفظ واستمر» أثناء حفظ جارٍ) لا يخزّنان السجل
 * مرتين ولا يقرضان المحفظة مرتين. الفحص خارج المعاملة كان يمرّر الاثنين معًا —
 * الآن المفتاح يُفحص داخل الكتابة نفسها (نفس عقد commitOrderDelivery). */
import { describe, expect, it } from "vitest";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { FulfillmentService } from "@/application/fulfillment/fulfillmentService";
import { DirectSaleService } from "@/application/direct-sales/directSaleService";
import { CollectionService } from "@/application/collections/collectionService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

const now = () => "2026-09-05T09:00:00.000Z";

function makeServices(store: MemoryLocalStore) {
  const projectFinance = new ProjectFinancialService(store, now);
  const fulfillment = new FulfillmentService(store, now);
  const directSales = new DirectSaleService(store, now);
  const collections = new CollectionService(store, fulfillment, directSales, projectFinance, now);
  return { projectFinance, fulfillment, directSales, collections };
}

describe("re-entry idempotency guards (P0)", () => {
  it("concurrent direct-sale record with one key stores exactly one sale", async () => {
    const store = new MemoryLocalStore();
    const { directSales } = makeServices(store);
    const input = {
      itemName: "بيع متزامن",
      quantity: 1,
      revenueMinor: 2000,
      costMinor: null,
      occurredOn: "2026-09-05",
      note: "اختبار الإرسال المزدوج",
      idempotencyKey: "concurrent-sale-1",
    };
    const [first, second] = await Promise.all([directSales.record(input), directSales.record(input)]);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    /* كلا النداءين ينجح لكن السجل واحد — والثاني يعاد كما هو لا نسخة جديدة. */
    expect(second.value.id).toBe(first.value.id);
    const list = await store.listDirectSales();
    expect(list.ok && list.value.length).toBe(1);
    expect(list.ok && list.value[0]!.revenueMinor).toBe(2000);
  });

  it("concurrent financial-event record with one key stores exactly one event", async () => {
    const store = new MemoryLocalStore();
    const { projectFinance } = makeServices(store);
    const input = {
      type: "operating_expense_cash" as const,
      amountMinor: 1500,
      occurredOn: "2026-09-05",
      note: "مصروف متزامن",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "project" as const,
        behavior: "unknown" as const,
        purpose: "project_general" as const,
        knowledge: "known" as const,
        sharedProjectShare: null,
        categoryLabel: null,
      },
      idempotencyKey: "concurrent-expense-1",
    };
    const [first, second] = await Promise.all([
      projectFinance.record(input),
      projectFinance.record(input),
    ]);
    if (!first.ok || !second.ok)
      throw new Error(`record failed: ${first.ok ? "" : first.message} | ${second.ok ? "" : second.message}`);
    expect(first.ok && second.ok).toBe(true);
    const events = await store.listFinancialEvents();
    expect(events.ok && events.value.length).toBe(1);
    expect(events.ok && events.value[0]!.amountMinor).toBe(1500);
  });

  it("concurrent wallet attribution with one operation key credits the wallet once", async () => {
    const store = new MemoryLocalStore();
    const { projectFinance } = makeServices(store);
    const cash = new CashContinuityService(store, now);
    await projectFinance.record({
      type: "owner_investment_cash",
      amountMinor: 10000,
      occurredOn: "2026-09-04",
      note: "استثمار",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "inv-reentry",
    });
    const wallet = await cash.openWallet({
      name: "الدرج",
      kind: "cash_drawer",
      openingMinor: 0,
      occurredOn: "2026-09-04",
      note: "محفظة",
      operationKey: "wallet-reentry",
    });
    if (!wallet.ok) throw new Error(wallet.message);
    const input = {
      walletId: wallet.value.wallet.id,
      deltaMinor: 4000,
      note: "تخصيص متزامن",
      operationKey: "concurrent-attribute-1" as string | undefined,
    };
    const [first, second] = await Promise.all([
      projectFinance.distributeUnallocated(input),
      projectFinance.distributeUnallocated(input),
    ]);
    expect(first.ok && second.ok).toBe(true);
    const position = await projectFinance.readPosition();
    if (!position.ok) throw new Error(position.message);
    /* القيد واحد: المحفظة 4000 لا 8000، وغير الموزع 6000 لا سالب. */
    expect(position.value.walletCashMinor).toBe(4000);
    expect(position.value.unallocatedCashMinor).toBe(6000);
    const entries = await store.listCashContinuityEntries();
    const allocations =
      entries.ok
        ? entries.value.filter(entry => entry.operationKey === "concurrent-attribute-1")
        : [];
    expect(allocations.length).toBe(1);
  });

  it("concurrent full-sheet collection with one key collects once and attributes once", async () => {
    const store = new MemoryLocalStore();
    const { projectFinance, directSales, collections } = makeServices(store);
    const cash = new CashContinuityService(store, now);
    const sale = await directSales.record({
      itemName: "بيع آجل متزامن",
      quantity: 1,
      revenueMinor: 8000,
      collectedMinor: 0,
      collectionStatus: "partial_debt" as const,
      customerName: "سامر",
      costMinor: null,
      occurredOn: "2026-09-04",
      note: "بيع آجل",
      idempotencyKey: "credit-sale-reentry",
    });
    if (!sale.ok) throw new Error(sale.message);
    const wallet = await cash.openWallet({
      name: "الدرج",
      kind: "cash_drawer",
      openingMinor: 0,
      occurredOn: "2026-09-04",
      note: "محفظة",
      operationKey: "wallet-sheet-reentry",
    });
    if (!wallet.ok) throw new Error(wallet.message);
    const input = {
      sourceKind: "direct_sale" as const,
      sourceId: sale.value.id,
      amountMinor: 3000,
      walletId: wallet.value.wallet.id,
      note: null,
      idempotencyKey: "concurrent-collect-1",
    };
    const [first, second] = await Promise.all([collections.collect(input), collections.collect(input)]);
    expect(first.ok && second.ok).toBe(true);
    /* البيع نفسه: المقبوض 3000 لا 6000 — التحديث الأخير من الأساس نفسه. */
    const after = await directSales.get(sale.value.id);
    if (!after.ok || !after.value) throw new Error(after.ok ? "missing sale" : after.message);
    expect(after.value.collectedMinor).toBe(3000);
    expect(after.value.collectionStatus).toBe("partial_debt");
    /* التخصيص واحد: المحفظة 3000 لا 6000، وغير الموزع لا يصبح سالبًا. */
    const position = await projectFinance.readPosition();
    if (!position.ok) throw new Error(position.message);
    expect(position.value.walletCashMinor).toBe(3000);
    expect(position.value.unallocatedCashMinor).toBe(0);
    const entries = await store.listCashContinuityEntries();
    const allocations =
      entries.ok
        ? entries.value.filter(entry => entry.operationKey === "concurrent-collect-1:attribute")
        : [];
    expect(allocations.length).toBe(1);
  });
});
