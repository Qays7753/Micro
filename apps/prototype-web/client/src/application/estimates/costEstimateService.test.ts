import { describe, expect, it } from "vitest";
import { CostEstimateService } from "./costEstimateService";
import { PartyLedgerService } from "@/application/parties/partyLedgerService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

const now = () => "2026-08-30T09:00:00.000Z";

/* عقد التقدير المستقل (PA-006 + مبدأ «أدواتي» ٥.٤): أداة تفكير بلا أثر مالي إطلاقًا. */
describe("standalone cost estimates", () => {
  const input = {
    title: "كيكة مناسبة",
    materialItems: [
      { name: "دقيق", quantity: 2, unit: "كيلو", unitPriceMinor: 1200, confidence: "known" as const },
      { name: "سكر", quantity: 1, unit: "كيلو", unitPriceMinor: 900, confidence: "estimated" as const },
    ],
    time: { minutes: 90, hourlyRateMinor: 3000, confidence: "known" as const },
    packagingMinor: 500,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 1000,
    quantity: 1,
    note: null,
  };

  it("previews a protection price without touching any store", () => {
    const store = new MemoryLocalStore();
    const estimates = new CostEstimateService(store, now);
    const preview = estimates.preview(input);
    if (!preview.ok) throw new Error(preview.message);
    /* المواد 2×1200 + 1×900 = 3300؛ الوقت 90 دقيقة × 500/دقيقة = 4500؛ تغليف 500. */
    expect(preview.value.plannedCostMinor).toBe(8300);
    expect(preview.value.unitCostMinor).toBe(8300);
    expect(preview.value.priceFloorMinor).toBe(9300);
    expect(preview.value.knowledgeState).toBe("estimated");
  });

  it("saves and lists an estimate while the financial position stays untouched", async () => {
    const store = new MemoryLocalStore();
    const estimates = new CostEstimateService(store, now);
    const finance = new ProjectFinancialService(store, now);
    const before = await finance.readPosition();
    if (!before.ok) throw new Error(before.message);
    const saved = await estimates.save(input);
    if (!saved.ok) throw new Error(saved.message);
    expect(saved.value.title).toBe("كيكة مناسبة");
    expect(saved.value.priceFloorMinor).toBe(9300);
    const list = await estimates.list();
    if (!list.ok) throw new Error(list.message);
    expect(list.value).toHaveLength(1);
    const after = await finance.readPosition();
    if (!after.ok) throw new Error(after.message);
    /* الحكم الحاسم: حفظ التقدير لم يُنشئ حدثًا ماليًا ولا حركة مخزون ولا طلبًا. */
    expect(after.value).toEqual(before.value);
    expect(after.value.projectEventCount).toBe(0);
  });

  it("removes an estimate freely — it is a thinking tool, not a financial record", async () => {
    const store = new MemoryLocalStore();
    const estimates = new CostEstimateService(store, now);
    const saved = await estimates.save(input);
    if (!saved.ok) throw new Error(saved.message);
    const removed = await estimates.remove(saved.value.id);
    if (!removed.ok) throw new Error(removed.message);
    const list = await estimates.list();
    if (!list.ok) throw new Error(list.message);
    expect(list.value).toHaveLength(0);
  });
});

/* دفتر الناس (مبدأ المالك ٥.٣): تجميع بالاسم من السجلات القائمة — بلا كيان CRM جديد. */
describe("lightweight party ledger", () => {
  it("aggregates supplier payables and payable events by name with movement detail", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    await finance.record({
      type: "operating_expense_payable",
      amountMinor: 12000,
      occurredOn: "2026-08-25",
      note: "فاتورة كهرباء",
      counterparty: "شركة الكهرباء",
      relatedEventId: null,
      idempotencyKey: "payable-ledger-1",
      expenseContext: {
        relationship: "project",
        behavior: "fixed",
        purpose: "period",
        knowledge: "known",
        sharedProjectShare: null,
      },
    });
    const ledger = new PartyLedgerService(store);
    const reading = await ledger.read();
    if (!reading.ok) throw new Error(reading.message);
    const party = reading.value.parties.find(entry => entry.name === "شركة الكهرباء");
    expect(party).toBeDefined();
    expect(party?.payableMinor).toBe(12000);
    expect(party?.receivableMinor).toBe(0);
    expect(party?.movements).toHaveLength(1);
    expect(party?.movements[0]?.href).toBe("/finance");
    expect(reading.value.totalPayableMinor).toBe(12000);
  });

  it("aggregates direct-sale credit debts by the customer named in the note", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const sale = await import("@micro-domain/direct-sale/index.js").then(module =>
      module.createDirectSale({
        id: "sale-ledger-1",
        itemName: "بيعة سريعة",
        quantity: 1,
        revenueMinor: 10000,
        collectedMinor: 4000,
        collectionStatus: "partial_debt",
        costMinor: null,
        occurredOn: "2026-08-26",
        note: "عميل: خالد",
        idempotencyKey: "sale-ledger-1",
        recordedAt: now(),
      }),
    );
    const saved = await store.saveDirectSale(sale);
    if (!saved.ok) throw new Error(saved.message);
    const ledger = new PartyLedgerService(store);
    const reading = await ledger.read();
    if (!reading.ok) throw new Error(reading.message);
    const khaled = reading.value.parties.find(entry => entry.name === "خالد");
    expect(khaled?.receivableMinor).toBe(6000);
    expect(reading.value.totalReceivableMinor).toBe(6000);
  });

  it("returns an honest empty ledger for a fresh project", async () => {
    const store = new MemoryLocalStore();
    const ledger = new PartyLedgerService(store);
    const reading = await ledger.read();
    if (!reading.ok) throw new Error(reading.message);
    expect(reading.value.parties).toHaveLength(0);
    expect(reading.value.totalReceivableMinor).toBe(0);
    expect(reading.value.totalPayableMinor).toBe(0);
  });
});
