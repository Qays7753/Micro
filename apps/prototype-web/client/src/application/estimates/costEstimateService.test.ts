import { describe, expect, it } from "vitest";
import { CostEstimateService } from "./costEstimateService";
import { PartyDirectoryService } from "@/application/parties/partyLedgerService";
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

  /* المجموعة ٣ (Scope B — §8.1): تعديل التقدير — نفس السجل يتجدد ولا يتكرر، ولا أثر مالي. */
  it("updates an existing estimate in place — recalculates totals, keeps id, no duplicate, no financial effect", async () => {
    const store = new MemoryLocalStore();
    const estimates = new CostEstimateService(store, now);
    const finance = new ProjectFinancialService(store, now);
    const saved = await estimates.save(input);
    if (!saved.ok) throw new Error(saved.message);
    const before = await finance.readPosition();
    if (!before.ok) throw new Error(before.message);

    const updated = await estimates.update(saved.value.id, {
      ...input,
      title: "كيكة مناسبة معدلة",
      materialItems: [
        { name: "دقيق", quantity: 3, unit: "كيلو", unitPriceMinor: 1200, confidence: "known" as const },
      ],
      time: null,
      packagingMinor: 0,
      safetyBufferMinor: 500,
    });
    if (!updated.ok) throw new Error(updated.message);
    /* نفس السجل: المعرف ثابت والعدد لم يتضاعف. */
    expect(updated.value.id).toBe(saved.value.id);
    expect(updated.value.title).toBe("كيكة مناسبة معدلة");
    expect(updated.value.createdAt).toBe(saved.value.createdAt);
    /* المواد 3×1200 = 3600؛ الوقت غير معروف الآن — الحساب يتجدد بصدق. */
    expect(updated.value.plannedCostMinor).toBe(3600);
    expect(updated.value.priceFloorMinor).toBe(3600 + 500);
    const list = await estimates.list();
    if (!list.ok) throw new Error(list.message);
    expect(list.value).toHaveLength(1);
    /* الحكم الحاسم: التعديل لم يُنشئ حدثًا ماليًا ولا حركة كاش. */
    const after = await finance.readPosition();
    if (!after.ok) throw new Error(after.message);
    expect(after.value).toEqual(before.value);
  });

  it("refuses to update a missing estimate honestly", async () => {
    const store = new MemoryLocalStore();
    const estimates = new CostEstimateService(store, now);
    const missing = await estimates.update("estimate-gone", input);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.code).toBe("validation_error");
  });
});

/* S05 (DOC-014 / UNIT-037): تقاعد قراءة التجميع بالاسم — دفتر الناس القديم
 * صار «العملاء والموردون»: دليل هويات محفوظة وحساب من المصادر المرتبطة
 * بمعرف الطرف المؤكد حصرًا (SDF-009 يمنع دمج الاسم المتشابه؛ B-DUP يمنع
 * قائمة ديون مجهولة منافسة). الحدود الموثقة: التزامات المصروف باسم جهة
 * تبقى عند مصدرها (UNIT-015) ولا تدخل حساب طرف هنا. */
describe("party directory (S05) — saved identities only, source-anchored accounts", () => {
  it("returns an honest empty directory for a fresh project", async () => {
    const store = new MemoryLocalStore();
    const directory = new PartyDirectoryService(store, now);
    const reading = await directory.read();
    if (!reading.ok) throw new Error(reading.message);
    expect(reading.value.parties).toHaveLength(0);
    expect(reading.value.archivedParties).toHaveLength(0);
  });

  it("payable-event counterparties and note-named sales never enter a saved party account", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    await finance.record({
      type: "operating_expense_payable",
      amountMinor: 12000,
      occurredOn: "2026-08-25",
      note: "فاتورة كهرباء",
      counterparty: "شركة الكهرباء",
      relatedEventId: null,
      idempotencyKey: "payable-boundary-1",
      expenseContext: {
        relationship: "project",
        behavior: "fixed",
        purpose: "period",
        knowledge: "known",
        sharedProjectShare: null,
      },
    });
    const sale = await import("@micro-domain/direct-sale/index.js").then(module =>
      module.createDirectSale({
        id: "sale-boundary-1",
        itemName: "بيعة سريعة",
        quantity: 1,
        revenueMinor: 10000,
        collectedMinor: 4000,
        collectionStatus: "partial_debt",
        catalogItemId: null,
        customerName: "خالد",
        customerPartyId: null,
        costMinor: null,
        occurredOn: "2026-08-26",
        note: "بيع آجل",
        idempotencyKey: "sale-boundary-1",
        recordedAt: now(),
      }),
    );
    const saved = await store.saveDirectSale(sale);
    if (!saved.ok) throw new Error(saved.message);
    const directory = new PartyDirectoryService(store, now);
    const savedParty = await directory.save({ label: "خالد", phone: null, note: null, operationKey: "op-1" });
    if (!savedParty.ok) throw new Error(savedParty.message);
    const reading = await directory.read();
    if (!reading.ok) throw new Error(reading.message);
    const khaled = reading.value.parties.find(entry => entry.party.label === "خالد");
    /* الاسم المشترك لا يستولي على السجل غير المرتبط (SDF-028) والتزام
     * المصروف باسم الجهة لا يدخل حساب الطرف (حد UNIT-015 الموثق). */
    expect(khaled?.receivableMinor).toBe(0);
    expect(khaled?.payableMinor).toBe(0);
    expect(khaled?.movements).toHaveLength(0);
    expect(reading.value.parties).toHaveLength(1);
  });
});
