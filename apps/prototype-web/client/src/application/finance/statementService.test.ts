/** المجموعة ٢ (§9.2 — اختبارات الكشف): الفصل بين الكاش والنتيجة والأمانات والذمم،
 * وحدود الفترة، ووصل المصادر، وأثر التصحيحات مرة واحدة لا مرتين. */
import { describe, expect, it } from "vitest";
import { StatementService } from "./statementService";
import { OwnerEntitlementService } from "./ownerEntitlementService";
import { createCashContinuityEntry, createCashWallet } from "@micro-domain/cash-continuity/index.js";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";
import { createDirectSale } from "@micro-domain/direct-sale/index.js";
import { createSupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import {
  calculateCostSnapshot,
  collectDeposit,
  collectRemaining,
  createCraftOrder,
  reverseOrderCollection,
  transitionOrder,
} from "@micro-domain/craft-order/index.js";

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

describe("StatementService — تراجعات القبض ورد العربون (G6-F1-3)", () => {
  it("تراجع قبضة داخل الفترة يُخصم من «قبض الطلبات» فيصافي الكشف يطابق الكاش المسجل", async () => {
    const store = new MemoryLocalStore();
    const clock = () => "2026-09-02T10:00:00.000Z";
    const finance = new ProjectFinancialService(store, clock);
    const statement = new StatementService(store, finance);
    /* طلب مسلّم: عربون 2000 بتاريخ 2026-09-01 ثم قبضة 3000 بتاريخ 2026-09-02
     * ثم تراجع موثق عن القبضة كاملة بتاريخ 2026-09-03. */
    const cost = calculateCostSnapshot("st-1-cost", {
      currency: "JOD",
      materialItems: [],
      time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-08-20T09:00:00.000Z",
      freshnessDays: null,
    });
    let order = createCraftOrder({
      id: "order-st-1",
      customerName: "سعيد",
      itemName: "شغلة مطرزة",
      specifications: "اختبار",
      quantity: 1,
      agreedPriceMinor: 10000,
      costSnapshot: cost,
      createdAt: "2026-08-20T09:00:00.000Z",
    });
    order = collectDeposit(order, 2000, "st-dep", "2026-09-01T09:00:00.000Z");
    for (const [to, stamp] of [
      ["provisional_agreement", "2026-09-01T10:00:00.000Z"],
      ["confirmed", "2026-09-01T11:00:00.000Z"],
      ["in_progress", "2026-09-01T12:00:00.000Z"],
      ["ready", "2026-09-01T13:00:00.000Z"],
      ["delivered", "2026-09-01T14:00:00.000Z"],
    ] as const)
      order = transitionOrder(order, { to, idempotencyKey: `st-${to}`, createdAt: stamp });
    order = collectRemaining(order, 3000, "st-collect", "2026-09-02T09:00:00.000Z");
    order = reverseOrderCollection(order, {
      collectionEventId: "order-st-1:st-collect",
      amountMinor: 3000,
      reason: "رجّعت المبلغ",
      idempotencyKey: "st-reverse",
      createdAt: "2026-09-03T09:00:00.000Z",
    });
    await store.saveOrder({
      id: "order-st-1",
      order,
      catalogItemId: null,
      deliveryDate: "2026-09-01",
      agreementSource: "walk_in",
      createdAt: "2026-08-20T09:00:00.000Z",
      updatedAt: "2026-09-03T09:00:00.000Z",
    });
    const reading = await statement.read("2026-09-01", "2026-09-07");
    expect(reading.ok).toBe(true);
    if (!reading.ok) return;
    const orderLine = reading.value.blocks.cashIn.find(line => line.id === "order-collections");
    /* العربون 2000 دخل، والقبضة 3000 دخلت ثم خرجت بالتراجع — الصافي 2000. */
    expect(orderLine?.amountMinor).toBe(2000);
    expect(
      orderLine?.sources.some(source => source.amountMinor === -3000 && source.label.includes("تراجع عن قبضة")),
    ).toBe(true);
    /* صافي الكاش: 2000 فقط — بلا خصم التراجع كان سيتضخم إلى 5000 (G6-F1-3). */
    expect(reading.value.cashNetMinor).toBe(2000);
  });

  it("تراجع قبضة بفترة لاحقة يخصم من فترة التراجع لا من فترة القبضة", async () => {
    const store = new MemoryLocalStore();
    const clock = () => "2026-09-02T10:00:00.000Z";
    const finance = new ProjectFinancialService(store, clock);
    const statement = new StatementService(store, finance);
    const cost = calculateCostSnapshot("st-2-cost", {
      currency: "JOD",
      materialItems: [],
      time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
      packagingMinor: 0,
      deliveryMinor: 0,
      wasteMinor: 0,
      safetyBufferMinor: 0,
      quantity: 1,
      createdAt: "2026-08-01T09:00:00.000Z",
      freshnessDays: null,
    });
    let order = createCraftOrder({
      id: "order-st-2",
      customerName: "سعيد",
      itemName: "شغلة مطرزة",
      specifications: "اختبار",
      quantity: 1,
      agreedPriceMinor: 10000,
      costSnapshot: cost,
      createdAt: "2026-08-01T09:00:00.000Z",
    });
    order = collectDeposit(order, 2000, "st2-dep", "2026-09-01T09:00:00.000Z");
    for (const [to, stamp] of [
      ["provisional_agreement", "2026-09-01T10:00:00.000Z"],
      ["confirmed", "2026-09-01T11:00:00.000Z"],
      ["in_progress", "2026-09-01T12:00:00.000Z"],
      ["ready", "2026-09-01T13:00:00.000Z"],
      ["delivered", "2026-09-01T14:00:00.000Z"],
    ] as const)
      order = transitionOrder(order, { to, idempotencyKey: `st2-${to}`, createdAt: stamp });
    order = collectRemaining(order, 3000, "st2-collect", "2026-09-02T09:00:00.000Z");
    await store.saveOrder({
      id: "order-st-2",
      order,
      catalogItemId: null,
      deliveryDate: "2026-09-01",
      agreementSource: "walk_in",
      createdAt: "2026-08-01T09:00:00.000Z",
      updatedAt: "2026-09-02T09:00:00.000Z",
    });
    /* الفترة الأولى (قبل التراجع): القبض كامل. */
    const first = await statement.read("2026-09-01", "2026-09-07");
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.value.blocks.cashIn.find(line => line.id === "order-collections")?.amountMinor).toBe(5000);
    }
    /* تراجع في 2026-09-10: يظهر في فترة التراجع (خارج الفترة الأولى). */
    const stored = (await store.getOrder("order-st-2")).value!;
    const reversed = reverseOrderCollection(stored.order, {
      collectionEventId: "order-st-2:st2-collect",
      amountMinor: 3000,
      reason: "رجّعت لاحقًا",
      idempotencyKey: "st2-reverse",
      createdAt: "2026-09-10T09:00:00.000Z",
    });
    await store.saveOrder({ ...stored, order: reversed, updatedAt: "2026-09-10T09:00:00.000Z" });
    const secondPeriod = await statement.read("2026-09-08", "2026-09-14");
    expect(secondPeriod.ok).toBe(true);
    if (secondPeriod.ok) {
      expect(secondPeriod.value.blocks.cashIn.find(line => line.id === "order-collections")?.amountMinor).toBe(
        -3000,
      );
      expect(secondPeriod.value.cashNetMinor).toBe(-3000);
    }
    /* فترة القبضة الأصلية لم تُعد كتابتها (تاريخ مسجل لا يتغير). */
    const reread = await statement.read("2026-09-01", "2026-09-07");
    expect(reread.ok).toBe(true);
    if (reread.ok) {
      expect(reread.value.blocks.cashIn.find(line => line.id === "order-collections")?.amountMinor).toBe(5000);
    }
  });
});



describe("StatementService — G6-U2-2: ledger owner movements in the owner block", () => {
  it("سحب مالك بمسار المحفظة يدخل كتلة المالك بسطر مصدره دفتر المحفظة", async () => {
    const store = new MemoryLocalStore();
    const clock = () => "2026-09-02T10:00:00.000Z";
    const finance = new ProjectFinancialService(store, clock);
    const statement = new StatementService(store, finance);
    /* محفظة + حركة سحب مالك بمسار الدفتر (right: kind draw, cash from wallet). */
    const wallet = createCashWallet({
      id: "g6-ow-wallet",
      name: "درج",
      kind: "cash_drawer",
      createdAt: "2026-09-01T09:00:00.000Z",
      createdOperationKey: "g6-ow-open",
    });
    const opening = createCashContinuityEntry({
      id: "g6-ow-opening",
      walletId: wallet.id,
      type: "opening_balance",
      occurredOn: "2026-09-01",
      recordedAt: "2026-09-01T09:00:00.000Z",
      cashDeltaMinor: 10000,
      note: "رصيد بداية",
      operationKey: "g6-ow-open",
    });
    const committed = await store.commitCashContinuity(wallet, [opening]);
    expect(committed.ok).toBe(true);
    const ownerEntitlement = new OwnerEntitlementService(
      store,
      async () => ({ ok: true as const, value: { resultMinor: 0, status: "recorded_only" as const } }),
      clock,
    );
    const draw = await ownerEntitlement.recordMovement({
      kind: "draw",
      amountMinor: 2500,
      walletId: "g6-ow-wallet",
      occurredOn: "2026-09-02",
      note: "سحبت لنفسي من الدرج",
      reason: "pre_entitlement_draw",
      idempotencyKey: "g6-ow-draw",
    });
    expect(draw.ok).toBe(true);

    const reading = await statement.read("2026-09-01", "2026-09-07");
    expect(reading.ok).toBe(true);
    if (!reading.ok) return;
    /* الكتلة تشمل سحب مسار المحفظة — لم يعد مخفيًا عن ملخص المالك. */
    expect(reading.value.blocks.owner.withdrawnMinor).toBe(2500);
    expect(reading.value.blocks.owner.investedMinor).toBe(0);
    expect(
      reading.value.blocks.owner.sources.some(
        source => source.label.includes("سحب مالك") && source.amountMinor === 2500,
      ),
    ).toBe(true);
  });
});

/* المجموعة ٤ (تصحيح مراجعة 4-c): الكشف يشمل حركات الكاش الجديدة — شراء أصل
 * نقدي وتخلص وقرض صادر وسداده — بعائلات صريحة ومصادر موصولة للأصل/القرض،
 * ولا يختفي منها شيء بعد اليوم في صافي الكاش. */
describe("StatementService — سطور الكاش للمجموعة ٤ (الأصول والقروض)", () => {
  it("شراء الأصل والقرض الصادر في الخرج، والتخلص والسداد في الدخل، والمصادر موصولة", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const statement = new StatementService(store, finance);
    await saveEvent(store, {
      id: "g4-st-purchase",
      type: "asset_purchase_cash",
      amountMinor: 40000,
      occurredOn: "2026-09-01",
      recordedAt: now(),
      idempotencyKey: "g4-st-purchase-key",
      note: "مكينة خياطة",
      counterparty: null,
      relatedEventId: null,
      assetContext: { assetId: "asset-1", name: "مكينة خياطة" },
    });
    await saveEvent(store, {
      id: "g4-st-disposal",
      type: "asset_disposal_cash",
      amountMinor: 9000,
      occurredOn: "2026-09-02",
      recordedAt: now(),
      idempotencyKey: "g4-st-disposal-key",
      note: "بعت المكينة القديمة",
      counterparty: null,
      relatedEventId: null,
      assetContext: { assetId: "asset-2", name: "مكينة قديمة", bookValueMinor: 7000 },
    });
    await saveEvent(store, {
      id: "g4-st-loan",
      type: "loan_outgoing_cash",
      amountMinor: 12000,
      occurredOn: "2026-09-02",
      recordedAt: now(),
      idempotencyKey: "g4-st-loan-key",
      note: "أعطيت أخي قرضًا",
      counterparty: null,
      relatedEventId: null,
      loanContext: { loanId: "loan-1", borrower: "سامي" },
    });
    await saveEvent(store, {
      id: "g4-st-repay",
      type: "loan_repayment_cash",
      amountMinor: 5000,
      occurredOn: "2026-09-03",
      recordedAt: now(),
      idempotencyKey: "g4-st-repay-key",
      note: "سداد جزء من القرض",
      counterparty: null,
      relatedEventId: null,
      loanContext: { loanId: "loan-1", borrower: "سامي" },
    });
    const reading = await statement.read("2026-09-01", "2026-09-07");
    expect(reading.ok).toBe(true);
    if (!reading.ok) return;
    const { blocks, cashNetMinor } = reading.value;
    expect(blocks.cashOut.find(line => line.id === "asset-purchase-cash")?.amountMinor).toBe(-40000);
    expect(blocks.cashOut.find(line => line.id === "loan-given-cash")?.amountMinor).toBe(-12000);
    expect(blocks.cashIn.find(line => line.id === "asset-disposal-cash")?.amountMinor).toBe(9000);
    expect(blocks.cashIn.find(line => line.id === "loan-repaid-cash")?.amountMinor).toBe(5000);
    expect(cashNetMinor).toBe(9000 + 5000 - 40000 - 12000);
    /* المصادر توصل لصفحة الأصل/القرض لا لحدث مبهَم. */
    const purchaseLine = blocks.cashOut.find(line => line.id === "asset-purchase-cash");
    expect(purchaseLine?.sources[0]?.href).toBe("/assets/asset-1");
    const loanLine = blocks.cashIn.find(line => line.id === "loan-repaid-cash");
    expect(loanLine?.sources[0]?.href).toBe("/loans/loan-1");
    /* الأهلية الصريحة: شراء الأصل ليس مصروفًا والقرض ليس سحبًا والسداد ليس إيرادًا. */
    expect(purchaseLine?.qualifier).toContain("ليس مصروفًا");
    expect(blocks.cashOut.find(line => line.id === "loan-given-cash")?.qualifier).toContain(
      "ليس مصروفًا ولا سحبًا",
    );
    expect(loanLine?.qualifier).toContain("ليس إيرادًا");
  });

  it("التراجع عن قرض صادر داخل الفترة يظهر مرة واحدة في كتلة التصحيحات بعائلة صريحة", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const statement = new StatementService(store, finance);
    const original = await saveEvent(store, {
      id: "g4-stc-loan",
      type: "loan_outgoing_cash",
      amountMinor: 8000,
      occurredOn: "2026-09-01",
      recordedAt: now(),
      idempotencyKey: "g4-stc-loan-key",
      note: "قرض لجار",
      counterparty: null,
      relatedEventId: null,
      loanContext: { loanId: "loan-2", borrower: "أحمد" },
    });
    const reversal = await finance.reverse({
      sourceEventId: original.id,
      occurredOn: "2026-09-03",
      reason: "سُجّل بالخطأ",
      idempotencyKey: "g4-stc-reverse",
    });
    expect(reversal.ok).toBe(true);
    const reading = await statement.read("2026-09-01", "2026-09-07");
    expect(reading.ok).toBe(true);
    if (!reading.ok) return;
    const { blocks, cashNetMinor } = reading.value;
    /* الأصل والتراجع معًا داخل الفترة: الصافي صفر ولا تكرار في عائلة الخرج. */
    expect(blocks.cashOut.find(line => line.id === "loan-given-cash")).toBeUndefined();
    const correction = blocks.corrections.lines.find(
      line => line.familyLabel === "قرض أعطيته" && line.reason === "سُجّل بالخطأ",
    );
    expect(correction).toBeDefined();
    expect(correction?.netEffectMinor).toBe(0);
    expect(cashNetMinor).toBe(0);
  });
});
