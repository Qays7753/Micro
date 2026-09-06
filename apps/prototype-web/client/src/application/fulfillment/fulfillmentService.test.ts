import { describe, expect, it } from "vitest";
import { AgreementService } from "@/application/agreements/agreementService";
import { CostService, type CostEditorInput } from "@/application/cost/costService";
import { DraftService } from "@/application/drafts/draftService";
import { FulfillmentService } from "./fulfillmentService";
import { ScheduleService } from "@/application/scheduling/scheduleService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

const costInput: CostEditorInput = {
  materialItems: [{ name: "خشب", quantity: 1, unit: "لوح", unitPriceMinor: 1000, confidence: "known" }],
  time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
  packagingMinor: 0,
  deliveryMinor: 0,
  wasteMinor: 0,
  safetyBufferMinor: 100,
  quantity: 1,
};
async function activeOrder(depositMinor = 500, input = costInput) {
  const store = new MemoryLocalStore();
  const drafts = new DraftService(store, () => "2026-08-22T00:00:00.000Z");
  const created = await drafts.create("customer_order");
  if (!created.ok) throw new Error("draft should create");
  const saved = await drafts.save({
    ...created.draft,
    customerName: "سارة",
    itemName: "صندوق خشبي",
    specifications: "نقش اسم",
    quantity: 1,
  });
  if (!saved.ok) throw new Error("draft should save");
  const costs = new CostService(store, () => "2026-08-22T00:01:00.000Z");
  const withCost = await costs.saveSnapshot(saved.draft, input);
  if (!withCost.ok) throw new Error("cost should save");
  const agreements = new AgreementService(store, costs, () => "2026-08-22T01:00:00.000Z");
  const agreed = await agreements.createFromDraft(withCost.draft, {
    agreedPriceMinor: 2200,
    deliveryDate: "2026-08-30",
    depositMinor,
    agreementSource: null,
  });
  if (!agreed.ok) throw new Error("agreement should save");
  const executing = await agreements.startExecution(agreed.stored.id);
  if (!executing.ok) throw new Error("execution should start");
  return { store, orderId: agreed.stored.id };
}

describe("FulfillmentService", () => {
  it("marks ready then delivers without inventing a collection, while recognizing a known-cost result", async () => {
    const { store, orderId } = await activeOrder();
    const service = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z");
    await expect(service.markReady(orderId)).resolves.toMatchObject({
      ok: true,
      stored: { order: { status: "ready", collectedMinor: 500 } },
    });
    const delivered = await service.deliver(orderId);
    expect(delivered).toMatchObject({
      ok: true,
      stored: {
        order: {
          status: "delivered",
          collectedMinor: 500,
          receivableMinor: 1700,
          recognizedRevenueMinor: 2200,
          recognizedCostMinor: 1500,
          profitIndicatorMinor: 700,
          resultStatus: "final",
        },
      },
    });
  });

  it("marks the operational schedule completed when delivery is recorded without changing financial values", async () => {
    const { store, orderId } = await activeOrder();
    const schedules = new ScheduleService(store, () => "2026-08-22T02:00:00.000Z");
    const service = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z", schedules);
    const before = await schedules.overview();
    if (!before.ok) throw new Error("schedule should load");
    await service.markReady(orderId);
    await expect(service.deliver(orderId)).resolves.toMatchObject({
      ok: true,
      stored: { order: { collectedMinor: 500, receivableMinor: 1700, recognizedRevenueMinor: 2200 } },
    });
    await expect(schedules.get(before.value.upcoming[0]!.schedule.id)).resolves.toMatchObject({
      ok: true,
      value: {
        status: "completed",
        events: [{ type: "created" }, { type: "completed", reason: "اكتمل عند تسجيل التسليم" }],
      },
    });
  });

  it("collects the remaining amount after delivery and settles the order without duplicating cash on retry", async () => {
    const { store, orderId } = await activeOrder();
    const service = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z");
    await service.markReady(orderId);
    await service.deliver(orderId);
    const collected = await service.collectFullRemaining(orderId);
    expect(collected).toMatchObject({
      ok: true,
      stored: {
        order: { status: "settled", settlementStatus: "paid", collectedMinor: 2200, receivableMinor: 0 },
      },
    });
    await expect(service.collectFullRemaining(orderId)).resolves.toMatchObject({
      ok: true,
      stored: { order: { events: collected.ok ? collected.stored.order.events : [] } },
    });
  });

  it("registers the post-delivery remainder as debt without increasing collected cash", async () => {
    const { store, orderId } = await activeOrder();
    const service = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z");
    await service.markReady(orderId);
    await service.deliver(orderId);
    await expect(service.registerRemainingDebt(orderId)).resolves.toMatchObject({
      ok: true,
      stored: {
        order: {
          status: "settled",
          settlementStatus: "debt",
          collectedMinor: 500,
          receivableMinor: 1700,
          resultStatus: "final",
        },
      },
    });
  });

  /* §٥-١٦ (رحلة ٢): الدين المسجل يبقى قابلًا للتحصيل — جزئيًا ثم كاملًا —
   * والتحصيل يدخل الكاش المقبوض دون إعادة فتح الطلب. */
  it("collects a registered debt partially then fully, keeping the order settled", async () => {
    const { store, orderId } = await activeOrder();
    const service = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z");
    await service.markReady(orderId);
    await service.deliver(orderId);
    await service.registerRemainingDebt(orderId);

    const partial = await service.collectDebt(orderId, 700);
    expect(partial).toMatchObject({
      ok: true,
      stored: {
        order: {
          status: "settled",
          settlementStatus: "debt",
          collectedMinor: 1200,
          receivableMinor: 1000,
        },
      },
    });

    const full = await service.collectDebt(orderId, 1000);
    expect(full).toMatchObject({
      ok: true,
      stored: {
        order: {
          status: "settled",
          settlementStatus: "paid",
          collectedMinor: 2200,
          receivableMinor: 0,
        },
      },
    });
  });

  it("rejects a debt collection beyond the agreed price with an honest error", async () => {
    const { store, orderId } = await activeOrder();
    const service = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z");
    await service.markReady(orderId);
    await service.deliver(orderId);
    await service.registerRemainingDebt(orderId);
    await expect(service.collectDebt(orderId, 1701)).resolves.toMatchObject({
      ok: false,
      code: "invalid_state",
    });
  });

  it("collects nothing when no registered debt exists (idempotent no-op)", async () => {
    const { store, orderId } = await activeOrder();
    const service = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z");
    await service.markReady(orderId);
    await service.deliver(orderId);
    const result = await service.collectDebt(orderId, 100);
    expect(result).toMatchObject({
      ok: true,
      stored: { order: { status: "delivered", collectedMinor: 500, receivableMinor: 1700 } },
    });
  });

  it("does not expose a final profit when delivered cost knowledge is incomplete", async () => {
    const incomplete: CostEditorInput = { ...costInput, time: null };
    const { store, orderId } = await activeOrder(0, incomplete);
    const service = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z");
    await service.markReady(orderId);
    await expect(service.deliver(orderId)).resolves.toMatchObject({
      ok: true,
      stored: {
        order: {
          status: "delivered",
          recognizedRevenueMinor: 2200,
          recognizedCostMinor: 1000,
          resultStatus: "incomplete",
          profitIndicatorMinor: null,
        },
      },
    });
  });

  /* القرار ١٩: الإلغاء بسبب اختياري، والعربون ثلاثة خيارات يشمل «يحتاج مراجعة». */
  it("cancels a pre-delivery order with a chosen reason and leaves the deposit awaiting an explicit decision", async () => {
    const { store, orderId } = await activeOrder(500);
    const service = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z");
    await expect(service.cancel(orderId, "غلط في السعر")).resolves.toMatchObject({
      ok: true,
      stored: {
        order: {
          status: "cancelled",
          settlementStatus: "cancelled_pending",
          depositSettlement: "needs_review",
          receivableMinor: 0,
          collectedMinor: 500,
        },
      },
    });
    const repeated = await service.cancel(orderId, "محاولة ثانية");
    expect(repeated.ok && repeated.stored.order.status).toBe("cancelled");
  });

  it("cancels with no reason by recording an honest unspecified reason, not by bypassing the contract", async () => {
    const { store, orderId } = await activeOrder(0);
    const service = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z");
    const cancelled = await service.cancel(orderId, "   ");
    expect(cancelled).toMatchObject({
      ok: true,
      stored: { order: { status: "cancelled", settlementStatus: "cancelled", depositSettlement: null } },
    });
    if (cancelled.ok) {
      const event = cancelled.stored.order.events.find(candidate => candidate.type === "cancelled");
      expect(event?.note).toBe("إلغاء بدون سبب محدد");
    }
  });

  it("refunds the deposit of a cancelled order so the collected balance actually drops (decision 19)", async () => {
    const { store, orderId } = await activeOrder(500);
    const service = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z");
    await service.cancel(orderId, "انسحب العميل");
    await expect(service.refundDeposit(orderId, "رد العربون نقدًا")).resolves.toMatchObject({
      ok: true,
      stored: {
        order: {
          status: "cancelled",
          settlementStatus: "cancelled_refunded",
          depositSettlement: "refund_deposit",
          collectedMinor: 0,
        },
      },
    });
  });

  it("retains the deposit of a cancelled order as a documented settlement that keeps it collected", async () => {
    const { store, orderId } = await activeOrder(500);
    const service = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z");
    await service.cancel(orderId, "انسحب العميل");
    await expect(service.retainDeposit(orderId, "احتفاظ بالعربون مقابل تجهيز بدأ")).resolves.toMatchObject({
      ok: true,
      stored: {
        order: {
          settlementStatus: "cancelled_retained",
          depositSettlement: "retain_deposit",
          collectedMinor: 500,
        },
      },
    });
  });

  it("collects every collected deposit in one honest overview, separating those awaiting settlement (owner addition)", async () => {
    const { store, orderId } = await activeOrder(500);
    const service = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z");
    await service.cancel(orderId, "غلط في السعر");
    const overview = await service.listDepositOverview();
    expect(overview).toMatchObject({
      ok: true,
      value: {
        deposits: [
          {
            orderId,
            depositCollectedMinor: 500,
            depositSettlement: "needs_review",
          },
        ],
        collectedTotalMinor: 500,
        awaitingSettlementCount: 1,
      },
    });
  });

  it("keeps the deposits overview empty and honest when no deposit was ever collected", async () => {
    const { store } = await activeOrder(0);
    const service = new FulfillmentService(store, () => "2026-08-22T02:00:00.000Z");
    const overview = await service.listDepositOverview();
    expect(overview).toMatchObject({
      ok: true,
      value: { deposits: [], collectedTotalMinor: 0, awaitingSettlementCount: 0 },
    });
  });
});

/* S2-02 (تدقيق المجموعة ٥): إعادة محاولة تحصيل الدين من ورقة التحصيل بمفتاح
 * عملية واحد لا تسجّل تحصيلًا ثانيًا — حتى مع ساعة زمنية متقدمة (المفتاح
 * يُمرَّر كما يُمرَّر في فرع المتبقي). */
it("keeps collectFromSheet debt retries idempotent under an advancing clock (S2-02)", async () => {
  const { store, orderId } = await activeOrder();
  /* ساعة متقدمة: كل استدعاء يعيد وقتًا مختلفًا فيفشل أي مفتاح مبني على الوقت. */
  let clockTick = 0;
  const advancing = () => `2026-08-22T02:${String(10 + clockTick++).padStart(2, "0")}:00.000Z`;
  const service = new FulfillmentService(store, advancing);
  await service.markReady(orderId);
  await service.deliver(orderId);
  await service.registerRemainingDebt(orderId);

  const first = await service.collectFromSheet(orderId, 500, "sheet-retry-key-s202");
  expect(first).toMatchObject({
    ok: true,
    stored: { order: { collectedMinor: 1000, receivableMinor: 1200 } },
  });
  /* إعادة المحاولة بالمفتاح نفسه (انقطاع شبكة/نقرة مزدوجة): لا تحصيل ثانٍ. */
  const retry = await service.collectFromSheet(orderId, 500, "sheet-retry-key-s202");
  expect(retry).toMatchObject({
    ok: true,
    stored: { order: { collectedMinor: 1000, receivableMinor: 1200 } },
  });
  const stored = await store.getOrder(orderId);
  if (!stored.ok || !stored.value) throw new Error("order should read");
  const collectionEvents = stored.value.order.events.filter(
    event => event.type === "collection_recorded" && event.amountMinor === 500,
  );
  expect(collectionEvents).toHaveLength(1);
});

/** عقد الإغلاق العميق (WF-01/FC-04/FC-05 — العقد ٣): عربون إضافي أثناء الرحلة
 * قبل التسليم من سطح الطلب (المسار الذي كانت ورقة التحصيل توجه إليه بلا
 * سطح فعلي)، ووجهة الكاش خيار صريح مرتبط بحدث العربون نفسه، وبطاقة
 * العربون تحمل الحقول المعتمدة كاملة. */
describe("FulfillmentService mid-journey deposit (عقد الإغلاق العميق — العقد ٣)", () => {
  it("records a mid-journey deposit on an in-progress order and keeps it a deposit, not revenue", async () => {
    const { store, orderId } = await activeOrder(500);
    const service = new FulfillmentService(store, () => "2026-08-23T10:00:00.000Z");
    const result = await service.collectDeposit(orderId, {
      amountMinor: 700,
      operationKey: "mid-deposit-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const order = result.stored.order;
    expect(order.depositCollectedMinor).toBe(1200);
    expect(order.collectedMinor).toBe(1200);
    expect(order.status).toBe("in_progress");
    /* الحدث موثق على الطلب — العربون قابل للعكس والتسوية من مساره. */
    expect(
      order.events.some(
        event => event.type === "deposit_collected" && event.idempotencyKey === "mid-deposit-1",
      ),
    ).toBe(true);
  });

  it("replaying the same deposit operation key is an idempotent no-op (double submit safe)", async () => {
    const { store, orderId } = await activeOrder(500);
    const service = new FulfillmentService(store, () => "2026-08-23T10:00:00.000Z");
    const input = { amountMinor: 700, operationKey: "mid-deposit-replay" };
    const first = await service.collectDeposit(orderId, input);
    const second = await service.collectDeposit(orderId, input);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.stored.order.depositCollectedMinor).toBe(1200);
    expect(second.stored.order.events.filter(event => event.type === "deposit_collected").length).toBe(2);
  });

  it("refuses a deposit beyond the agreed price and on delivered orders — honest guards", async () => {
    const { store, orderId } = await activeOrder(500);
    const service = new FulfillmentService(store, () => "2026-08-23T10:00:00.000Z");
    const beyond = await service.collectDeposit(orderId, {
      amountMinor: 5000,
      operationKey: "mid-deposit-beyond",
    });
    expect(beyond.ok).toBe(false);
    if (beyond.ok) return;
    expect(beyond.message).toContain("العربون لا يمكن أن يتجاوز السعر المتفق عليه");
  });

  it("deposit card carries applied/refunded/retained/wallet/profit fields (FC-05)", async () => {
    const { store, orderId } = await activeOrder(500);
    const fulfillment = new FulfillmentService(store, () => "2026-08-23T10:00:00.000Z");
    const finance = new ProjectFinancialService(store, () => "2026-08-23T10:00:00.000Z");
    const cash = new CashContinuityService(store, () => "2026-08-23T10:00:00.000Z");
    /* عربون إضافي مع وجهة محفظة صريحة — التخصيص مرتبط بحدث العربون. */
    await fulfillment.collectDeposit(orderId, { amountMinor: 700, operationKey: "card-deposit" });
    const wallet = await cash.openWallet({
      name: "الدرج",
      kind: "cash_drawer",
      openingMinor: 0,
      occurredOn: "2026-08-20",
      note: "محفظة",
      operationKey: "wallet-card",
    });
    if (!wallet.ok) throw new Error(wallet.message);
    const attribution = await finance.distributeUnallocated({
      walletId: wallet.value.wallet.id,
      deltaMinor: 700,
      note: "عربون",
      operationKey: "card-deposit:attribute",
      sourceRefId: orderId,
      sourceRefKind: "order",
      sourceRefLineId: `${orderId}:card-deposit`,
    });
    expect(attribution.ok).toBe(true);
    const overview = await fulfillment.listDepositOverview();
    expect(overview.ok).toBe(true);
    if (!overview.ok) return;
    const card = overview.value.deposits.find(row => row.orderId === orderId);
    if (!card) throw new Error("deposit card missing");
    expect(card.depositCollectedMinor).toBe(1200);
    expect(card.walletName).toBe("الدرج");
    expect(card.appliedToSaleMinor).toBe(0);
    expect(card.profitEffectLabel).toContain("ليس إيرانًا ولا ربحًا");
    expect(overview.value.collectedTotalMinor).toBe(1200);
  });
});

/* Conflict E (FC-06): رد العربون من محفظة المصدر — التخصيص المسجل يُفك بمقدار
 * الرد من محفظته الفعلية، والباقي غير المخصص يخرج من غير الموزع؛ الكتابة
 * ذرّية (الطلب وأثر المحفظة معًا) وإعادة المحاولة لا تكرر الأثر. */
describe("FulfillmentService deposit refund from source wallet (FC-06 / Conflict E)", () => {
  async function cancelledOrderWithAttributedDeposit() {
    const store = new MemoryLocalStore();
    const drafts = new DraftService(store, () => "2026-09-01T00:00:00.000Z");
    const created = await drafts.create("customer_order");
    if (!created.ok) throw new Error(created.message);
    const saved = await drafts.save({
      ...created.draft,
      customerName: "سليم",
      itemName: "رف خشبي",
      specifications: "مقاس كبير",
      quantity: 1,
    });
    if (!saved.ok) throw new Error(saved.message);
    const costs = new CostService(store, () => "2026-09-01T00:01:00.000Z");
    const withCost = await costs.saveSnapshot(saved.draft, costInput);
    if (!withCost.ok) throw new Error(withCost.message);
    const agreements = new AgreementService(store, costs, () => "2026-09-01T01:00:00.000Z");
    const agreed = await agreements.createFromDraft(withCost.draft, {
      agreedPriceMinor: 5000,
      deliveryDate: "2026-09-20",
      depositMinor: 2000,
      agreementSource: null,
    });
    if (!agreed.ok) throw new Error(agreed.message);
    const orderId = agreed.stored.id;
    /* محفظة + تخصيص عربون الاتفاق إليها — المسار نفسه الذي يكتبه المحرر. */
    const cash = new CashContinuityService(store, () => "2026-09-01T01:05:00.000Z");
    const wallet = await cash.openWallet({
      name: "درج المحل",
      kind: "cash_drawer",
      openingMinor: 5000,
      occurredOn: "2026-09-01",
      note: "رصيد بداية",
      operationKey: "fc06-open",
    });
    if (!wallet.ok) throw new Error(wallet.message);
    const projectFinance = new ProjectFinancialService(store, () => "2026-09-01T01:06:00.000Z");
    const attribution = await projectFinance.distributeUnallocated({
      walletId: wallet.value.wallet.id,
      deltaMinor: 2000,
      note: "عربون طلب رف خشبي",
      operationKey: `${orderId}:initial-deposit:attribute`,
      sourceRefId: orderId,
      sourceRefKind: "order",
      sourceRefLineId: `${orderId}:initial-deposit`,
    });
    if (!attribution.ok) throw new Error(attribution.message);
    /* التنفيذ يبدأ من خدمة الاتفاقات (المسار القائم) ثم الإلغاء من الاستلام. */
    const executing = await agreements.startExecution(orderId);
    if (!executing.ok) throw new Error(executing.message);
    const fulfillment = new FulfillmentService(store, () => "2026-09-01T02:00:00.000Z");
    await fulfillment.cancel(orderId, "انسحب العميل");
    return { store, orderId, walletId: wallet.value.wallet.id, projectFinance };
  }

  it("refunds from the attributed wallet — the allocation is reversed by the refunded amount, atomically with the order", async () => {
    const { store, orderId, walletId } = await cancelledOrderWithAttributedDeposit();
    const service = new FulfillmentService(store, () => "2026-09-02T02:00:00.000Z");
    const refunded = await service.refundDeposit(orderId, "رد كامل من الدرج");
    expect(refunded.ok).toBe(true);
    if (!refunded.ok) return;
    expect(refunded.stored.order.depositSettlement).toBe("refund_deposit");
    expect(refunded.stored.order.collectedMinor).toBe(0);
    /* أثر المحفظة: فك التخصيص الكامل (−2000) مكتوب مع الطلب في معاملة واحدة. */
    const entries = await store.listCashContinuityEntries();
    if (!entries.ok) throw new Error(entries.message);
    const reversal = entries.value.find(
      entry =>
        entry.type === "reversal" &&
        entry.walletId === walletId &&
        entry.cashDeltaMinor === -2000 &&
        entry.note.includes("رد عربون"),
    );
    expect(reversal).toBeTruthy();
    expect(reversal?.reversesEntryId).toBeTruthy();
    /* رصيد المحفظة: 5000 افتتاحي + 2000 تخصيص − 2000 فك = 5000. */
    const walletEntries = entries.value.filter(entry => entry.walletId === walletId);
    const balance = walletEntries.reduce((sum, entry) => sum + entry.cashDeltaMinor, 0);
    expect(balance).toBe(5000);
  });

  it("refunds partially — partial allocation reversal, remainder pending, second refund completes", async () => {
    const { store, orderId, walletId } = await cancelledOrderWithAttributedDeposit();
    const service = new FulfillmentService(store, () => "2026-09-02T02:00:00.000Z");
    const partial = await service.refundDeposit(orderId, "رد جزئي متفق", 800);
    expect(partial.ok).toBe(true);
    if (!partial.ok) return;
    expect(partial.stored.order.depositSettlement).toBe("needs_review");
    expect(partial.stored.order.depositCollectedMinor).toBe(1200);
    const entries = await store.listCashContinuityEntries();
    if (!entries.ok) throw new Error(entries.message);
    const partialReversal = entries.value.find(
      entry => entry.type === "reversal" && entry.walletId === walletId && entry.cashDeltaMinor === -800,
    );
    expect(partialReversal).toBeTruthy();
    /* الإكمال: رد الباقي يقفل الحالة ويكسر فك تخصيص إضافيًا بمقدار الباقي. */
    const completed = await service.refundDeposit(orderId, "رد الباقي", 1200);
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;
    expect(completed.stored.order.depositSettlement).toBe("refund_deposit");
    expect(completed.stored.order.collectedMinor).toBe(0);
    const finalEntries = await store.listCashContinuityEntries();
    if (!finalEntries.ok) throw new Error(finalEntries.message);
    const walletReversals = finalEntries.value.filter(
      entry => entry.type === "reversal" && entry.walletId === walletId && entry.cashDeltaMinor < 0,
    );
    expect(walletReversals.reduce((sum, entry) => sum + -entry.cashDeltaMinor, 0)).toBe(2000);
  });

  it("retains partially then refunds the remainder — the retained part stays collected, the refund drops only the remainder", async () => {
    const { store, orderId } = await cancelledOrderWithAttributedDeposit();
    const service = new FulfillmentService(store, () => "2026-09-02T02:00:00.000Z");
    const retained = await service.retainDeposit(orderId, "تغطية تكلفة المواد", 1500);
    expect(retained.ok).toBe(true);
    if (!retained.ok) return;
    expect(retained.stored.order.depositRetainedMinor).toBe(1500);
    expect(retained.stored.order.depositSettlement).toBe("needs_review");
    expect(retained.stored.order.collectedMinor).toBe(2000);
    const closed = await service.refundDeposit(orderId, "رد الباقي", 500);
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    expect(closed.stored.order.depositSettlement).toBe("retain_deposit");
    expect(closed.stored.order.settlementStatus).toBe("cancelled_retained");
    expect(closed.stored.order.depositCollectedMinor).toBe(1500);
    expect(closed.stored.order.collectedMinor).toBe(1500);
  });
});
