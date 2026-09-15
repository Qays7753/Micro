import { describe, expect, it } from "vitest";
import { PartyLedgerService } from "./partyLedgerService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { createDirectSale } from "@micro-domain/direct-sale/index.js";

/* FIN-002 (قرار المالك المعتمد ٢٠٢٦-٠٩-١٦): دفتر الناس يعرض كل دين مسمّى من
 * أول حركة — التكرار شارة لا شرط إخفاء، والمجاميع تطابق «لي عند العملاء»
 * في مالي للديون المسماة، والمطابقة المحافظة للأسماء (trim + فراغات) باقية. */

const now = () => "2026-09-16T09:00:00.000Z";

async function saveCreditSale(
  store: MemoryLocalStore,
  input: { id: string; customerName: string; revenueMinor: number; collectedMinor: number },
) {
  const saved = await store.saveDirectSale(
    createDirectSale({
      id: input.id,
      itemName: "قطعة",
      quantity: 1,
      revenueMinor: input.revenueMinor,
      collectedMinor: input.collectedMinor,
      collectionStatus: "partial_debt",
      catalogItemId: null,
      customerName: input.customerName,
      costMinor: null,
      occurredOn: "2026-09-16",
      recordedAt: now(),
      note: "بيع آجل لاختبار الدفتر",
      idempotencyKey: `${input.id}-key`,
    }),
  );
  if (!saved.ok) throw new Error(saved.message);
}

describe("PartyLedgerService visibility (FIN-002)", () => {
  it("shows a first-time named debt immediately — no two-record threshold", async () => {
    const store = new MemoryLocalStore();
    await saveCreditSale(store, {
      id: "fin002-first",
      customerName: "عميل-FIN002",
      revenueMinor: 1500,
      collectedMinor: 500,
    });
    const ledger = new PartyLedgerService(store);
    const result = await ledger.read();
    if (!result.ok) throw new Error(result.message);
    const party = result.value.parties.find(entry => entry.name === "عميل-FIN002");
    expect(party).toBeDefined();
    expect(party?.receivableMinor).toBe(1000);
    /* سجل مصدر واحد: ليس متكررًا — شارة لا شرط. */
    expect(party?.repeated).toBe(false);
    expect(result.value.totalReceivableMinor).toBe(1000);
  });

  it("aggregates two debts under the same exact normalized name and marks it repeated", async () => {
    const store = new MemoryLocalStore();
    await saveCreditSale(store, {
      id: "fin002-a1",
      customerName: "  عميل   FIN002 ",
      revenueMinor: 1500,
      collectedMinor: 500,
    });
    await saveCreditSale(store, {
      id: "fin002-a2",
      customerName: "عميل FIN002",
      revenueMinor: 800,
      collectedMinor: 0,
    });
    const ledger = new PartyLedgerService(store);
    const result = await ledger.read();
    if (!result.ok) throw new Error(result.message);
    const party = result.value.parties.find(entry => entry.name === "عميل FIN002");
    expect(party).toBeDefined();
    expect(party?.receivableMinor).toBe(1800);
    expect(party?.repeated).toBe(true);
  });

  it("keeps similar but different names separate — hyphen is not a space", async () => {
    const store = new MemoryLocalStore();
    await saveCreditSale(store, {
      id: "fin002-h",
      customerName: "عميل-FIN002",
      revenueMinor: 1500,
      collectedMinor: 500,
    });
    await saveCreditSale(store, {
      id: "fin002-s",
      customerName: "عميل FIN002",
      revenueMinor: 800,
      collectedMinor: 400,
    });
    const ledger = new PartyLedgerService(store);
    const result = await ledger.read();
    if (!result.ok) throw new Error(result.message);
    expect(result.value.parties).toHaveLength(2);
    const hyphen = result.value.parties.find(entry => entry.name === "عميل-FIN002");
    const space = result.value.parties.find(entry => entry.name === "عميل FIN002");
    expect(hyphen?.receivableMinor).toBe(1000);
    expect(space?.receivableMinor).toBe(400);
  });

  it("totals every named debt — matching the Finance receivable total exactly", async () => {
    const store = new MemoryLocalStore();
    await saveCreditSale(store, {
      id: "fin002-t1",
      customerName: "عميل-FIN002",
      revenueMinor: 1500,
      collectedMinor: 500,
    });
    await saveCreditSale(store, {
      id: "fin002-t2",
      customerName: "عميل FIN002",
      revenueMinor: 800,
      collectedMinor: 0,
    });
    await saveCreditSale(store, {
      id: "fin002-t3",
      customerName: "زبونثالث",
      revenueMinor: 700,
      collectedMinor: 300,
    });
    const ledger = new PartyLedgerService(store);
    const finance = new ProjectFinancialService(store, () => now());
    const [ledgerResult, positionResult] = await Promise.all([ledger.read(), finance.readPosition()]);
    if (!ledgerResult.ok || !positionResult.ok) throw new Error("reads should succeed");
    /* مجاميع الدفتر (كل الديون المسماة) = «لي عند العملاء» في مالي — لا تباين 18/22 بعد الآن. */
    expect(ledgerResult.value.totalReceivableMinor).toBe(positionResult.value.customerReceivablesMinor);
    expect(ledgerResult.value.totalReceivableMinor).toBe(2200);
  });
});
