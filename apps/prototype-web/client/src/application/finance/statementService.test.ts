/** المجموعة ٢ (§9.2 — اختبارات الكشف): الفصل بين الكاش والنتيجة والأمانات والذمم،
 * وحدود الفترة، ووصل المصادر، وأثر التصحيحات مرة واحدة لا مرتين. */
import { describe, expect, it } from "vitest";
import { StatementService } from "./statementService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";
import { createDirectSale } from "@micro-domain/direct-sale/index.js";
import { createSupplierPurchase } from "@micro-domain/supplier-purchase/index.js";

const now = () => "2026-09-02T10:00:00.000Z";

async function saveEvent(
  store: MemoryLocalStore,
  input: Parameters<typeof createFinancialEvent>[0],
) {
  const saved = await store.saveFinancialEvent(createFinancialEvent(input));
  if (!saved.ok) throw new Error("event should save");
  return saved.value;
}

describe("StatementService — كشف الفترة (المجموعة ٢ §9.2)", () => {
  it("يفصل الكاش عن النتيجة: القبض والأمانات في الكاش لا في النتيجة", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const statement = new StatementService(store, finance);
    await saveEvent(store, {
      id: "ev-amanah",
      type: "amanah_held_cash",
      amountMinor: 5000,
      occurredOn: "2026-09-01",
      recordedAt: now(),
      idempotencyKey: "ev-amanah-key",
      note: "أمانة جارها",
      counterparty: "هدى",
      relatedEventId: null,
    });
    await saveEvent(store, {
      id: "ev-expense",
      type: "operating_expense_cash",
      amountMinor: 1500,
      occurredOn: "2026-09-02",
      recordedAt: now(),
      idempotencyKey: "ev-expense-key",
      note: "أكياس",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "unknown",
        purpose: "project_general",
        knowledge: "known",
        sharedProjectShare: null,
      },
    });
    await saveEvent(store, {
      id: "ev-invest",
      type: "owner_investment_cash",
      amountMinor: 3000,
      occurredOn: "2026-09-01",
      recordedAt: now(),
      idempotencyKey: "ev-invest-key",
      note: "أضفت مالًا",
      counterparty: null,
      relatedEventId: null,
    });
    const reading = await statement.read("2026-09-01", "2026-09-07");
    expect(reading.ok).toBe(true);
    if (!reading.ok) return;
    const { blocks, result, cashNetMinor } = reading.value;
    /* كاش داخل: أمانة 5000 + مال مالك 3000. */
    const amanahLine = blocks.cashIn.find(line => line.id === "amanah-held");
    const ownerLine = blocks.cashIn.find(line => line.id === "owner-investment");
    expect(amanahLine?.amountMinor).toBe(5000);
    expect(amanahLine?.qualifier).toContain("مش ربحك");
    expect(ownerLine?.qualifier).toContain("ليس إيرادًا");
    /* كاش خارج: مصروف 1500. */
    expect(blocks.cashOut.find(line => line.id === "expenses-paid")?.amountMinor).toBe(-1500);
    expect(cashNetMinor).toBe(5000 + 3000 - 1500);
    /* النتيجة: مصروف موزع فقط — لا إيراد طلبات في الفترة. */
    expect(result.resultMinor).toBe(-1500);
    /* الأمانات ليست في النتيجة ولا في مال المالك. */
    expect(blocks.owner.investedMinor).toBe(3000);
    expect(blocks.amanah.heldNowMinor).toBe(5000);
    expect(blocks.amanah.trustLine).toContain("مش ربحك");
  });

  it("حدود الفترة تُحترم: حركة خارج النطاق لا تدخل الكشف", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const statement = new StatementService(store, finance);
    await saveEvent(store, {
      id: "ev-in",
      type: "operating_expense_cash",
      amountMinor: 2000,
      occurredOn: "2026-09-10",
      recordedAt: now(),
      idempotencyKey: "ev-in-key",
      note: "خارج النطاق",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "unknown",
        purpose: "project_general",
        knowledge: "known",
        sharedProjectShare: null,
      },
    });
    const reading = await statement.read("2026-09-01", "2026-09-07");
    expect(reading.ok).toBe(true);
    if (reading.ok) {
      expect(reading.value.blocks.cashOut).toHaveLength(0);
      expect(reading.value.cashNetMinor).toBe(0);
    }
  });

  it("تصحيح داخل الفترة يُعرض مرة واحدة في كتلة التصحيحات لا مع عائلته", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const statement = new StatementService(store, finance);
    const original = await saveEvent(store, {
      id: "ev-exp-2",
      type: "operating_expense_cash",
      amountMinor: 4000,
      occurredOn: "2026-09-02",
      recordedAt: now(),
      idempotencyKey: "ev-exp-2-key",
      note: "مصروف يُصحح",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "unknown",
        purpose: "project_general",
        knowledge: "known",
        sharedProjectShare: null,
      },
    });
    const reversal = await finance.reverse({
      sourceEventId: original.id,
      occurredOn: "2026-09-03",
      reason: "سُجل مرتين",
      idempotencyKey: "rev-exp-2",
    });
    expect(reversal.ok).toBe(true);
    const reading = await statement.read("2026-09-01", "2026-09-07");
    expect(reading.ok).toBe(true);
    if (reading.ok) {
      /* عائلة المصروفات تستبعد حدث التراجع — صافي الكاش من المصروفات صفر لعدم بقاء مصروف أصلي. */
      const expenseLine = reading.value.blocks.cashOut.find(line => line.id === "expenses-paid");
      /* الأصل وصل في الفترة لكن التراجع أيضًا في الفترة — النتيجة الصافية صفر. */
      expect(reading.value.result.resultMinor).toBe(0);
      expect(expenseLine ?? null).toBeNull();
    }
  });

  it("قبض البيع المباشر يدخل الكاش بتاريخ البيع ودفع المورد يدخل الخرج بتاريخه", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const statement = new StatementService(store, finance);
    const saleSaved = await store.saveDirectSale(
      createDirectSale({
        id: "sale-st-1",
        itemName: "شوكولا",
        quantity: 1,
        revenueMinor: 2500,
        collectedMinor: 2500,
        catalogItemId: null,
        customerName: null,
        costMinor: 900,
        occurredOn: "2026-09-02",
        recordedAt: now(),
        note: "بيع نقدي",
        idempotencyKey: "sale-st-1-key",
      }),
    );
    expect(saleSaved.ok).toBe(true);
    const purchaseSaved = await store.saveSupplierPurchase(
      createSupplierPurchase({
        id: "purchase-st-1",
        supplierName: "مورد الكاكاو",
        note: "كاكاو",
        purchasedOn: "2026-09-02",
        dueOn: null,
        totalMinor: 1800,
        initialPaidMinor: 1000,
        recordedAt: now(),
        idempotencyKey: "purchase-st-1-key",
      }),
    );
    expect(purchaseSaved.ok).toBe(true);
    const reading = await statement.read("2026-09-01", "2026-09-07");
    expect(reading.ok).toBe(true);
    if (reading.ok) {
      const salesCash = reading.value.blocks.cashIn.find(line => line.id === "direct-sales-cash");
      expect(salesCash?.amountMinor).toBe(2500);
      expect(salesCash?.qualifier).toContain("بتاريخ البيع");
      expect(salesCash?.sources[0]?.href).toBe("/direct-sales/sale-st-1");
      const supplierOut = reading.value.blocks.cashOut.find(line => line.id === "supplier-payments");
      expect(supplierOut?.amountMinor).toBe(-1000);
      expect(supplierOut?.qualifier).toContain("ليس مصروفًا حتى الاستهلاك");
      /* الكاش الصافي: 2500 − 1000 = 1500. */
      expect(reading.value.cashNetMinor).toBe(1500);
      /* النتيجة تشمل إيراد البيع وتكلفته المعروفة. */
      expect(reading.value.result.directSaleRevenueMinor).toBe(2500);
      expect(reading.value.result.directSaleCostKnownMinor).toBe(900);
    }
  });

  it("نطاق غير صالح يُرفض برسالة صريحة لا بأصفار", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const statement = new StatementService(store, finance);
    const reading = await statement.read("2026-09-07", "2026-09-01");
    expect(reading.ok).toBe(false);
    if (!reading.ok) expect(reading.message).toContain("يبدأ قبل نهايته");
  });

  it("G5-S7: تراجع الدفعة داخل الفترة يسترد الكاش في «دفع للموردين» — لا تضخم خرج", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const statement = new StatementService(store, finance);
    const purchaseSaved = await store.saveSupplierPurchase(
      createSupplierPurchase({
        id: "purchase-rev-st",
        supplierName: "مورد الأقمشة",
        note: "قماش",
        purchasedOn: "2026-09-02",
        dueOn: null,
        totalMinor: 5000,
        initialPaidMinor: 2000,
        recordedAt: now(),
        idempotencyKey: "purchase-rev-st-key",
      }),
    );
    expect(purchaseSaved.ok).toBe(true);
    /* دفعة لاحقة 10.00 داخل الفترة + تراجع موثق عنها بنفس الفترة. */
    const withPaymentAndReversal: typeof purchaseSaved extends { ok: true; value: infer V } ? V : never = {
      ...purchaseSaved.value,
      paidMinor: 2000,
      payableMinor: 3000,
      payments: [
        ...purchaseSaved.value.payments,
        {
          id: "purchase-rev-st:pay-1",
          amountMinor: 1000,
          occurredOn: "2026-09-03",
          recordedAt: now(),
          idempotencyKey: "pay-1-key",
          note: "دفعة ثانية",
        },
      ],
      paymentReversals: [
        {
          id: "purchase-rev-st:rev-1",
          paymentId: "purchase-rev-st:pay-1",
          amountMinor: 1000,
          reason: "دُفعت مرتين بالخطأ",
          occurredOn: "2026-09-03",
          recordedAt: now(),
          idempotencyKey: "rev-1-key",
        },
      ],
      updatedAt: now(),
    };
    const updated = await store.saveSupplierPurchase(withPaymentAndReversal);
    expect(updated.ok).toBe(true);
    const reading = await statement.read("2026-09-01", "2026-09-07");
    expect(reading.ok).toBe(true);
    if (reading.ok) {
      const supplierOut = reading.value.blocks.cashOut.find(line => line.id === "supplier-payments");
      /* الشراء الابتدائي 20.00 + دفعة 10.00 − تراجع 10.00 = 20.00 خرج صافٍ. */
      expect(supplierOut?.amountMinor).toBe(-2000);
      const reversalSource = supplierOut?.sources.find(source => source.label.includes("تراجع عن دفعة"));
      expect(reversalSource?.amountMinor).toBe(-1000);
      expect(reversalSource?.href).toBe("/suppliers/purchase/purchase-rev-st");
      const payments = reading.value.blocks.receivablesPayables.supplierPaymentsInPeriodMinor;
      expect(payments).toBe(0);
    }
  });

  it("G5-S7: تراجع خارج الفترة لا يمس كشف الفترة الحالية", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const statement = new StatementService(store, finance);
    const purchaseSaved = await store.saveSupplierPurchase(
      createSupplierPurchase({
        id: "purchase-rev-st2",
        supplierName: "مورد الخشب",
        note: "خشب",
        purchasedOn: "2026-08-20",
        dueOn: null,
        totalMinor: 4000,
        initialPaidMinor: 4000,
        recordedAt: now(),
        idempotencyKey: "purchase-rev-st2-key",
      }),
    );
    const withReversalNextPeriod = {
      ...purchaseSaved.value,
      paidMinor: 3000,
      payableMinor: 1000,
      paymentReversals: [
        {
          id: "purchase-rev-st2:rev-1",
          paymentId: "purchase-rev-st2:initial",
          amountMinor: 1000,
          reason: "تصحيح لاحق",
          occurredOn: "2026-09-10",
          recordedAt: now(),
          idempotencyKey: "rev-2-key",
        },
      ],
      updatedAt: now(),
    } as typeof purchaseSaved.value;
    const updated = await store.saveSupplierPurchase(withReversalNextPeriod);
    expect(updated.ok).toBe(true);
    const reading = await statement.read("2026-09-01", "2026-09-07");
    expect(reading.ok).toBe(true);
    if (reading.ok) {
      /* الشراء نفسه بتاريخ 2026-08-20 خارج الفترة؛ والتراجع بتاريخ 2026-09-10 خارجها —
       * لا سطر موردين في الكشف إطلاقًا. */
      const supplierOut = reading.value.blocks.cashOut.find(line => line.id === "supplier-payments");
      expect(supplierOut).toBeUndefined();
    }
  });
});
