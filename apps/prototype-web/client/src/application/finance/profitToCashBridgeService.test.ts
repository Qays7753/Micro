import { describe, expect, it } from "vitest";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ProfitToCashBridgeService } from "./profitToCashBridgeService";
import {
  calculateCostSnapshot,
  collectDeposit,
  collectRemaining,
  createCraftOrder,
  transitionOrder,
  type CraftOrder,
} from "@micro-domain/craft-order/index.js";
import { createDirectSale } from "@micro-domain/direct-sale/index.js";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";
import { createCashContinuityEntry, createCashWallet } from "@micro-domain/cash-continuity/index.js";
import { createOwnerMovement } from "@micro-domain/owner-entitlement/index.js";
import { createSupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import type { StoredCraftOrder, StorageResult } from "@/storage/local/types";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";

/* FIN-003 (WS-173 — Wave 1): جسر النتيجة المسجلة إلى تغير الكاش المسجل —
 * «لماذا يختلف ربحي المسجل عن تغير الكاش؟» البذرة حية (MemoryLocalStore +
 * مصانع الدومين الحقيقية) كما في اختبارات كشف الفترة ومقارنة الفترتين، وكل
 * رقم متوقع محسوب يدويًا بالقرش في تعليقات كل اختبار. القراءة لا تكتب سجلًا
 * واحدًا (مطابقة لقطة كاملة قبل/بعد). */

const now = () => "2026-10-05T09:00:00.000Z";

function knownSnapshot(id: string, timeRateMinor: number) {
  return calculateCostSnapshot(`${id}-cost`, {
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: timeRateMinor, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: "2026-08-01T09:00:00.000Z",
    freshnessDays: null,
  });
}

async function saveEvent(store: MemoryLocalStore, input: Parameters<typeof createFinancialEvent>[0]) {
  const saved = await store.saveFinancialEvent(createFinancialEvent(input));
  if (!saved.ok) throw new Error("event should save");
  return saved.value;
}

/** طلب نهائي مسلّم بعربون قبل التسليم وتحصيل متبقٍ بعده — تواريخ القبض لحظات
 * UTC كاملة لأن حدّ الفترة يُشتق منها بتوقيت عمّان (UTC+3 طول العام). */
async function saveCollectedOrder(
  store: MemoryLocalStore,
  input: {
    id: string;
    priceMinor: number;
    timeRateMinor?: number;
    createdOn: string;
    depositMinor: number;
    depositAt: string;
    deliveredOn: string;
    remainingMinor: number | null;
    remainingAt: string | null;
  },
): Promise<void> {
  let order: CraftOrder = createCraftOrder({
    id: input.id,
    customerName: "عميلة",
    itemName: "قطعة",
    specifications: "جسر النتيجة إلى الكاش",
    quantity: 1,
    agreedPriceMinor: input.priceMinor,
    costSnapshot: knownSnapshot(input.id, input.timeRateMinor ?? 500),
    createdAt: `${input.createdOn}T08:00:00.000Z`,
  });
  if (input.depositMinor > 0)
    order = collectDeposit(order, input.depositMinor, `${input.id}-deposit`, input.depositAt);
  for (const [to, stamp] of [
    ["provisional_agreement", `${input.createdOn}T08:30:00.000Z`],
    ["confirmed", `${input.createdOn}T09:00:00.000Z`],
    ["in_progress", `${input.deliveredOn}T09:30:00.000Z`],
    ["ready", `${input.deliveredOn}T09:45:00.000Z`],
    ["delivered", `${input.deliveredOn}T10:00:00.000Z`],
  ] as const)
    order = transitionOrder(order, { to, idempotencyKey: `${input.id}-${to}`, createdAt: stamp });
  if (input.remainingMinor !== null && input.remainingAt !== null)
    order = collectRemaining(order, input.remainingMinor, `${input.id}-remaining`, input.remainingAt);
  const stored: StoredCraftOrder = {
    id: order.id,
    order,
    deliveryDate: input.deliveredOn,
    agreementSource: "test",
    createdAt: order.createdAt,
    updatedAt: input.remainingAt ?? `${input.deliveredOn}T10:00:00.000Z`,
  };
  const saved = await store.saveOrder(stored);
  if (!saved.ok) throw new Error("order should save");
}

/** عالم آب 2026 متماسك كل رقم فيه محسوب يدويًا:
 *
 *  القبض (الكاش المقيس بالقرش):
 *    قبض الطلبات      +10,000 = عربون 2,000 (2026-08-03) + متبقٍ 8,000 (2026-08-12)
 *    قبض بيع مباشر    + 5,000 (بيع 2026-08-15 نقدي)
 *    أحداث مالية      −32,300 = مصروف نقدي −300 + استثمار مالك +20,000
 *                                    + سحب مالك −5,000 + شراء أصل −40,000
 *                                    + قرض صادر −12,000 + سداد قرض +5,000
 *                                    + أمانة قُبضت +4,000 + أمانة سُلّمت −4,000
 *    دفع موردين       − 1,000 (دفعة شراء 2026-08-14 من إجمالي 3,000)
 *    استمرارية الكاش  −   500 = سحب مالك من دفتر المحفظة −1,000 + تسوية عدّ +500
 *    ────────────────────────
 *    المقيس           −18,800
 *  (تسديد ذمم 1,500 بتاريخ 2026-09-05 خارج الفترة؛ إهلاك 800 بتاريخ
 *   2026-07-15 خارج الفترة ولا كاش له أصلًا — بند غير نقدي.)
 *
 *  النتيجة المسجلة (القارئ الكنوني):
 *    10,000 (إيراد طلب) + 5,000 (إيراد بيع مباشر)
 *    − 500 (تكلفة مباشرة مستخدمة) − 2,000 (تكلفة بيع مباشر معروفة)
 *    − 1,800 (مصروف تشغيلي: 300 نقدي + 1,500 مستحق مشترك موزّع) = 10,700 */
async function seedCleanAugustWorld(store: MemoryLocalStore): Promise<void> {
  /* ١) طلب نهائي مسلّم: عربون قبل التسليم ومتبقٍ بعده — القبض كله داخل آب. */
  await saveCollectedOrder(store, {
    id: "aug-order",
    priceMinor: 10_000,
    createdOn: "2026-08-01",
    depositMinor: 2_000,
    depositAt: "2026-08-03T09:00:00.000Z",
    deliveredOn: "2026-08-10",
    remainingMinor: 8_000,
    remainingAt: "2026-08-12T09:00:00.000Z",
  });
  /* ٢) بيع مباشر نقدي بتكلفة معروفة (F-005: الإيراد بتاريخ البيع). */
  const savedSale = await store.saveDirectSale(
    createDirectSale({
      id: "aug-sale",
      itemName: "قطعة",
      quantity: 1,
      revenueMinor: 5_000,
      collectedMinor: 5_000,
      catalogItemId: null,
      customerName: null,
      costMinor: 2_000,
      occurredOn: "2026-08-15",
      recordedAt: now(),
      note: "بيع مباشر نقدي لاختبار الجسر",
      idempotencyKey: "bridge-aug-sale",
    }),
  );
  if (!savedSale.ok) throw new Error("direct sale should save");
  /* ٣) مصروف تشغيلي مدفوع نقدي (مشروع، معروف، مصنّف). */
  await saveEvent(store, {
    id: "bridge-ev-expense-cash",
    type: "operating_expense_cash",
    amountMinor: 300,
    occurredOn: "2026-08-18",
    recordedAt: now(),
    idempotencyKey: "bridge-expense-cash",
    note: "توصيل قطع",
    counterparty: null,
    relatedEventId: null,
    expenseContext: {
      relationship: "project",
      behavior: "variable",
      purpose: "project_general",
      knowledge: "known",
    },
  });
  /* ٤) مصروف مشترك مستحق داخل الفترة وتسديده لاحقًا خارجها (2026-09-05). */
  const sharedPayable = await saveEvent(store, {
    id: "bridge-ev-expense-payable",
    type: "operating_expense_payable",
    amountMinor: 1_500,
    occurredOn: "2026-08-20",
    recordedAt: now(),
    idempotencyKey: "bridge-expense-payable",
    note: "كهرباء — حصة مشروع متفق عليها",
    counterparty: "شركة كهرباء",
    relatedEventId: null,
    expenseContext: {
      relationship: "shared",
      behavior: "fixed",
      purpose: "period",
      knowledge: "known",
      sharedProjectShare: { basis: "agreed_fixed_share", note: "حصة ثابتة", allocation: "allocated" },
    },
  });
  await saveEvent(store, {
    id: "bridge-ev-payable-settlement",
    type: "payable_settlement_cash",
    amountMinor: 1_500,
    occurredOn: "2026-09-05",
    recordedAt: now(),
    idempotencyKey: "bridge-payable-settlement",
    note: "تسديد كهرباء آب",
    counterparty: "شركة كهرباء",
    relatedEventId: sharedPayable.id,
  });
  /* ٥) استثمار مالك وسحب مالك — أحداث مالية بتاريخها. */
  await saveEvent(store, {
    id: "bridge-ev-owner-investment",
    type: "owner_investment_cash",
    amountMinor: 20_000,
    occurredOn: "2026-08-01",
    recordedAt: now(),
    idempotencyKey: "bridge-owner-investment",
    note: "أضفت مالًا للمشروع",
    counterparty: null,
    relatedEventId: null,
  });
  await saveEvent(store, {
    id: "bridge-ev-owner-withdrawal",
    type: "owner_withdrawal_cash",
    amountMinor: 5_000,
    occurredOn: "2026-08-25",
    recordedAt: now(),
    idempotencyKey: "bridge-owner-withdrawal",
    note: "سحبت لنفسي",
    counterparty: null,
    relatedEventId: null,
  });
  /* ٦) شراء أصل نقدي داخل آب + إهلاك مسجّل في تموز (خارج الفترة): الإهلاك داخل
   * الفترة يجعل القارئ الكنوني يوسم الفترة «إهلاك مسجّل» فتصير incomplete —
   * تلك الحالة مفروضة باختبار الإضافة غير النقدية أدناه بعالمها الخاص. */
  await saveEvent(store, {
    id: "bridge-ev-asset-purchase",
    type: "asset_purchase_cash",
    amountMinor: 40_000,
    occurredOn: "2026-08-05",
    recordedAt: now(),
    idempotencyKey: "bridge-asset-purchase",
    note: "مكينة خياطة",
    counterparty: null,
    relatedEventId: null,
    assetContext: { assetId: "bridge-asset-machine", name: "مكينة خياطة" },
  });
  await saveEvent(store, {
    id: "bridge-ev-depreciation-july",
    type: "asset_depreciation",
    amountMinor: 800,
    occurredOn: "2026-07-15",
    recordedAt: now(),
    idempotencyKey: "bridge-depreciation-july",
    note: "إهلاك مكينة — تموز",
    counterparty: null,
    relatedEventId: null,
    assetContext: { assetId: "bridge-asset-machine", name: "مكينة خياطة" },
  });
  /* ٧) قرض صادر وسداد جزئي. */
  await saveEvent(store, {
    id: "bridge-ev-loan-outgoing",
    type: "loan_outgoing_cash",
    amountMinor: 12_000,
    occurredOn: "2026-08-08",
    recordedAt: now(),
    idempotencyKey: "bridge-loan-outgoing",
    note: "أعطيت أخي قرضًا",
    counterparty: null,
    relatedEventId: null,
    loanContext: { loanId: "bridge-loan-1", borrower: "سامي" },
  });
  await saveEvent(store, {
    id: "bridge-ev-loan-repayment",
    type: "loan_repayment_cash",
    amountMinor: 5_000,
    occurredOn: "2026-08-20",
    recordedAt: now(),
    idempotencyKey: "bridge-loan-repayment",
    note: "سداد جزء من القرض",
    counterparty: null,
    relatedEventId: null,
    loanContext: { loanId: "bridge-loan-1", borrower: "سامي" },
  });
  /* ٨) أمانة قُبضت ثم سُلّمت — ليست ربحًا ولا ملكًا. */
  await saveEvent(store, {
    id: "bridge-ev-amanah-held",
    type: "amanah_held_cash",
    amountMinor: 4_000,
    occurredOn: "2026-08-06",
    recordedAt: now(),
    idempotencyKey: "bridge-amanah-held",
    note: "أمانة جارها",
    counterparty: "هدى",
    relatedEventId: null,
  });
  await saveEvent(store, {
    id: "bridge-ev-amanah-released",
    type: "amanah_released_cash",
    amountMinor: 4_000,
    occurredOn: "2026-08-27",
    recordedAt: now(),
    idempotencyKey: "bridge-amanah-released",
    note: "سُلّمت الأمانة",
    counterparty: "هدى",
    relatedEventId: null,
  });
  /* ٩) شراء مورد بإجمالي 3,000 ودفعة 1,000 عند التسجيل (2026-08-14). */
  const savedPurchase = await store.saveSupplierPurchase(
    createSupplierPurchase({
      id: "bridge-purchase",
      supplierName: "مورد الخيط",
      note: "خيط وحرير",
      purchasedOn: "2026-08-14",
      dueOn: null,
      totalMinor: 3_000,
      initialPaidMinor: 1_000,
      recordedAt: now(),
      idempotencyKey: "bridge-purchase-key",
    }),
  );
  if (!savedPurchase.ok) throw new Error("supplier purchase should save");
  /* ١٠) محفظة + تسوية عدّ مستقلة + حركة سحب مالك بمسار دفتر المحفظة —
   * نفس ما يكتبه OwnerEntitlementService.recordMovement حرفيًا (تسوية كاش
   * بمفتاح owner-movement:… يفسّرها بند تدفقات المالك لا بند التسويات). */
  const wallet = createCashWallet({
    id: "bridge-drawer",
    name: "درج الكاش",
    kind: "cash_drawer",
    createdAt: "2026-08-01T08:00:00.000Z",
    createdOperationKey: "bridge-drawer-open",
  });
  const adjustment = createCashContinuityEntry({
    id: "bridge-adjustment",
    walletId: wallet.id,
    type: "cash_adjustment",
    occurredOn: "2026-08-30",
    recordedAt: "2026-08-30T18:00:00.000Z",
    cashDeltaMinor: 500,
    note: "تسوية عدّ",
    reason: "فائض عدّ في الدرج",
    operationKey: "bridge-adjustment-op",
  });
  const committedAdjustment = await store.commitCashContinuity(wallet, [adjustment]);
  if (!committedAdjustment.ok) throw new Error("cash adjustment should commit");
  const drawMovement = createOwnerMovement({
    id: "bridge-owner-draw",
    kind: "draw",
    amountMinor: 1_000,
    walletId: wallet.id,
    occurredOn: "2026-08-28",
    recordedAt: "2026-08-28T15:00:00.000Z",
    reason: "owner_draw",
    note: "سحب شخصي من الدرج",
    idempotencyKey: "bridge-owner-draw-key",
  });
  const drawCash = createCashContinuityEntry({
    id: "bridge-owner-draw-cash",
    walletId: wallet.id,
    type: "cash_adjustment",
    occurredOn: "2026-08-28",
    recordedAt: "2026-08-28T15:00:00.000Z",
    cashDeltaMinor: drawMovement.cashDeltaMinor,
    note: "سحب شخصي من الدرج",
    reason: "حركة مالك: owner_draw",
    operationKey: `owner-movement:${drawMovement.idempotencyKey}`,
  });
  const committedDraw = await store.commitOwnerMovement(drawMovement, drawCash);
  if (!committedDraw.ok) throw new Error("owner movement should commit");
}

describe("ProfitToCashBridgeService — التوازن النظيف من النتيجة إلى الكاش", () => {
  it("يتوازن على بيئة آب متماسكة: كل بند بمصدره والباقي صفر", async () => {
    const store = new MemoryLocalStore();
    await seedCleanAugustWorld(store);
    const bridge = new ProfitToCashBridgeService(store, now);
    const reading = await bridge.readProfitToCashBridge({ from: "2026-08-01", to: "2026-08-31" });
    if (!reading.ok) throw new Error("bridge should read");
    const value = reading.value;
    const line = (id: string) => value.lines.find(item => item.id === id);
    /* الكاش المقيس محسوب يدويًا أعلاه: −18,800 = قبض 15,000 − أحداث 32,300
     * − موردين 1,000 − استمرارية 500. والنتيجة المسجلة 10,700. */
    expect(value.status).toBe("recorded_only");
    expect(value.reasons).toEqual([]);
    expect(value.resultMinor).toBe(10_700);
    expect(value.recordedCashDeltaMinor).toBe(-18_800);
    expect(value.bridgedTotalMinor).toBe(-18_800);
    expect(value.bridgedTotalMinor).toBe(value.recordedCashDeltaMinor);
    expect(value.remainderMinor).toBe(0);
    expect(line("remainder")).toBeUndefined();
    /* البنود: النتيجة نقطة البداية، والإهلاك خارج الفترة لا يتسرب لآب. */
    expect(line("period_result")?.amountMinor).toBe(10_700);
    expect(line("addback_depreciation")?.amountMinor).toBe(0);
    expect(line("receivables_timing")?.amountMinor).toBe(0);
    /* توقيت المواد: تكلفة دخلت النتيجة (500 + 2,000) مقابل مشتريات 3,000. */
    expect(line("materials_timing")?.amountMinor).toBe(-500);
    /* ذمم دائنة: مستحق جديد 1,500 + ذمم موردين 3,000 − دفع 1,000. */
    expect(line("operating_payables")?.amountMinor).toBe(3_500);
    expect(line("unallocated_shared_paid")?.amountMinor).toBe(0);
    /* تدفقات المالك: أحداث (20,000 − 5,000) + حركة الدفتر (−1,000). */
    expect(line("owner_flows")?.amountMinor).toBe(14_000);
    expect(line("asset_flows")?.amountMinor).toBe(-40_000);
    expect(line("loan_flows")?.amountMinor).toBe(-7_000);
    expect(line("amanah_flows")?.amountMinor).toBe(0);
    /* تسويات الكاش: تسوية العدّ وحدها — سحب المالك يُفسَّر في بند المالك. */
    expect(line("cash_adjustments")?.amountMinor).toBe(500);
    /* كل سطر يحمل مصدره المعلن. */
    for (const item of value.lines) expect(item.source.trim().length).toBeGreaterThan(0);
  });

  it("يقرأ الجسر دون كتابة سجل واحد — مطابقة لقطة كاملة قبل/بعد", async () => {
    const store = new MemoryLocalStore();
    await seedCleanAugustWorld(store);
    const bridge = new ProfitToCashBridgeService(store, now);
    const before = await store.readSnapshot();
    const reading = await bridge.readProfitToCashBridge({ from: "2026-08-01", to: "2026-08-31" });
    expect(reading.ok).toBe(true);
    const after = await store.readSnapshot();
    expect(after.ok && before.ok ? after.value : after).toEqual(before.ok ? before.value : before);
  });
});

describe("ProfitToCashBridgeService — البنود غير النقدية داخل النتيجة", () => {
  it("الإهلاك داخل الفترة يُضاف كما هو والكاش المقيس لا يتأثر به إطلاقًا", async () => {
    /* عالمان توأم: طلب مسلّم مقبوض كاملًا (3,000) وشراء أصل نقدي (−10,000)،
     * يختلفان بحدث إهلاك واحد 600 داخل آب. المقيس في الحالين −7,000 بالضبط
     * (الإهلاك بند غير نقدي)، والنتيجة تنخفض بمقداره ويُعاد إضافته بندًا. */
    const seed = async (store: MemoryLocalStore, depreciationInPeriod: boolean) => {
      await saveCollectedOrder(store, {
        id: "addback-order",
        priceMinor: 3_000,
        createdOn: "2026-08-01",
        depositMinor: 1_000,
        depositAt: "2026-08-02T09:00:00.000Z",
        deliveredOn: "2026-08-10",
        remainingMinor: 2_000,
        remainingAt: "2026-08-12T09:00:00.000Z",
      });
      await saveEvent(store, {
        id: "addback-ev-asset-purchase",
        type: "asset_purchase_cash",
        amountMinor: 10_000,
        occurredOn: "2026-08-05",
        recordedAt: now(),
        idempotencyKey: "addback-asset-purchase",
        note: "مكينة تطريز",
        counterparty: null,
        relatedEventId: null,
        assetContext: { assetId: "addback-asset", name: "مكينة تطريز" },
      });
      if (depreciationInPeriod)
        await saveEvent(store, {
          id: "addback-ev-depreciation",
          type: "asset_depreciation",
          amountMinor: 600,
          occurredOn: "2026-08-25",
          recordedAt: now(),
          idempotencyKey: "addback-depreciation",
          note: "إهلاك آب",
          counterparty: null,
          relatedEventId: null,
          assetContext: { assetId: "addback-asset", name: "مكينة تطريز" },
        });
    };
    const read = async (store: MemoryLocalStore) => {
      const reading = await new ProfitToCashBridgeService(store, now).readProfitToCashBridge({
        from: "2026-08-01",
        to: "2026-08-31",
      });
      if (!reading.ok) throw new Error("bridge should read");
      return reading.value;
    };
    const plainStore = new MemoryLocalStore();
    await seed(plainStore, false);
    const depreciationStore = new MemoryLocalStore();
    await seed(depreciationStore, true);
    const plain = await read(plainStore);
    const depreciation = await read(depreciationStore);
    /* الكاش المقيس نفسه في الحالين — الإهلاك لا يمس الكاش. */
    expect(plain.recordedCashDeltaMinor).toBe(-7_000);
    expect(depreciation.recordedCashDeltaMinor).toBe(-7_000);
    /* النتيجة تنخفض بمقدار الإهلاك بالضبط (3,000 − 500 − 600 = 1,900). */
    expect(plain.resultMinor).toBe(2_500);
    expect(depreciation.resultMinor).toBe(1_900);
    const plainLine = plain.lines.find(item => item.id === "addback_depreciation");
    const depreciationLine = depreciation.lines.find(item => item.id === "addback_depreciation");
    expect(plainLine?.amountMinor).toBe(0);
    expect(depreciationLine?.amountMinor).toBe(600);
    /* الجسر متوازن في الحالتين — الإضافة تعيد الإهلاك إلى طريق الكاش. */
    expect(plain.remainderMinor).toBe(0);
    expect(depreciation.remainderMinor).toBe(0);
    expect(depreciation.bridgedTotalMinor).toBe(-7_000);
    /* صدق الحالة: القارئ الكنوني يوسم الإهلاك بندًا مستقلًا فتُوسم الفترة
     * «ناقصة» (إهلاك مسجّل) مع بقاء التوازن قائمًا — لا يُخفى الوسم. */
    expect(plain.status).toBe("recorded_only");
    expect(depreciation.status).toBe("incomplete");
    expect(depreciation.reasons).toContain("إهلاك مسجّل");
  });
});

describe("ProfitToCashBridgeService — توقيت الذمم (قصة الجسر)", () => {
  it("إيراد معترف به الآن وقبض لاحق بعد نهاية الفترة: الفرق في توقيت الذمم لا فرقًا مخفيًا", async () => {
    const store = new MemoryLocalStore();
    await saveCollectedOrder(store, {
      id: "timing-order",
      priceMinor: 6_000,
      createdOn: "2026-08-01",
      depositMinor: 1_000,
      depositAt: "2026-08-05T09:00:00.000Z",
      deliveredOn: "2026-08-20",
      remainingMinor: 5_000,
      remainingAt: "2026-09-10T09:00:00.000Z",
    });
    const bridge = new ProfitToCashBridgeService(store, now);
    const reading = await bridge.readProfitToCashBridge({ from: "2026-08-01", to: "2026-08-31" });
    if (!reading.ok) throw new Error("bridge should read");
    const value = reading.value;
    const line = (id: string) => value.lines.find(item => item.id === id);
    /* النتيجة 6,000 − 500 = 5,500؛ الكاش المقيس عربون 1,000 فقط — المتبقي
     * 5,000 قُبض 2026-09-10 خارج الفترة فلا يدخل كاش آب ولا يضيع من الجسر. */
    expect(value.resultMinor).toBe(5_500);
    expect(value.recordedCashDeltaMinor).toBe(1_000);
    expect(value.resultMinor).not.toBe(value.recordedCashDeltaMinor);
    expect(line("receivables_timing")?.amountMinor).toBe(-5_000);
    expect(line("materials_timing")?.amountMinor).toBe(500);
    /* التوازن قائم: 5,500 − 5,000 + 500 = 1,000 = المقيس. */
    expect(value.remainderMinor).toBe(0);
    expect(value.bridgedTotalMinor).toBe(1_000);
    expect(value.bridgedTotalMinor).toBe(value.recordedCashDeltaMinor);
    expect(value.status).toBe("recorded_only");
  });
});

describe("ProfitToCashBridgeService — الفرق غير المطابق (لا تصفير صامت)", () => {
  it("تراجع محفظة يتيم الأصل يظهر سطر «فرق غير مطابق» وحالة incomplete", async () => {
    const store = new MemoryLocalStore();
    /* عالم متوازن صغير: طلب مسلّم مقبوض كاملًا (3,000) بتكلفة 500. */
    await saveCollectedOrder(store, {
      id: "remainder-order",
      priceMinor: 3_000,
      createdOn: "2026-08-01",
      depositMinor: 1_000,
      depositAt: "2026-08-02T09:00:00.000Z",
      deliveredOn: "2026-08-10",
      remainingMinor: 2_000,
      remainingAt: "2026-08-12T09:00:00.000Z",
    });
    /* تراجع محفظة يشير لافتتاح غير موجود في أي سجل: الكاش تحرك فعلًا
     * (−7,000) ولا يعرف الجسر عائلته — يُقاس ويظهر فرقًا غير مطابق. */
    const wallet = createCashWallet({
      id: "remainder-drawer",
      name: "درج",
      kind: "cash_drawer",
      createdAt: "2026-08-01T08:00:00.000Z",
      createdOperationKey: "remainder-drawer-open",
    });
    const orphanReversal = createCashContinuityEntry({
      id: "bridge-orphan-reversal",
      walletId: wallet.id,
      type: "reversal",
      occurredOn: "2026-08-15",
      recordedAt: "2026-08-15T19:00:00.000Z",
      cashDeltaMinor: -7_000,
      note: "تراجع عن افتتاح لم يعد موجودًا",
      reason: "تصحيح مفتعل للاختبار",
      operationKey: "bridge-orphan-reversal-op",
      reversesEntryId: "ghost-opening-id-that-never-existed",
    });
    const committed = await store.commitCashContinuity(wallet, [orphanReversal]);
    if (!committed.ok) throw new Error("orphan reversal should commit");
    const bridge = new ProfitToCashBridgeService(store, now);
    const reading = await bridge.readProfitToCashBridge({ from: "2026-08-01", to: "2026-08-31" });
    if (!reading.ok) throw new Error("bridge should read");
    const value = reading.value;
    /* المقيس 3,000 − 7,000 = −4,000؛ البنود تفسّر 3,000 فقط
     * (نتيجة 2,500 + مواد 500) — الباقي −7,000 يظهر كما هو. */
    expect(value.recordedCashDeltaMinor).toBe(-4_000);
    expect(value.bridgedTotalMinor).toBe(3_000);
    expect(value.remainderMinor).not.toBe(0);
    expect(value.remainderMinor).toBe(-7_000);
    const remainderLine = value.lines.find(item => item.id === "remainder");
    expect(remainderLine).toBeDefined();
    expect(remainderLine?.amountMinor).toBe(-7_000);
    expect(remainderLine?.label).toContain("فرق غير مطابق");
    expect(value.status).toBe("incomplete");
    expect(value.reasons.some(reason => reason.includes("فرق غير مطابق"))).toBe(true);
    expect(value.reasons.some(reason => reason.includes("تراجع محفظة بلا حركة أصل معروفة"))).toBe(true);
  });
});

describe("ProfitToCashBridgeService — النطاق غير الصالح", () => {
  it("من يبدأ بعد نهايته: حالة invalid وكل الأرقام null ولا بنود", async () => {
    const store = new MemoryLocalStore();
    await seedCleanAugustWorld(store);
    const bridge = new ProfitToCashBridgeService(store, now);
    const reading = await bridge.readProfitToCashBridge({ from: "2026-08-31", to: "2026-08-01" });
    if (!reading.ok) throw new Error("bridge should read");
    const value = reading.value;
    expect(value.status).toBe("invalid");
    expect(value.from).toBe("2026-08-31");
    expect(value.to).toBe("2026-08-01");
    expect(value.resultMinor).toBeNull();
    expect(value.recordedCashDeltaMinor).toBeNull();
    expect(value.bridgedTotalMinor).toBeNull();
    expect(value.remainderMinor).toBeNull();
    expect(value.lines).toEqual([]);
    expect(value.reasons).toContain("فترة غير صالحة");
  });
});

describe("ProfitToCashBridgeService — حدّ اليوم بتوقيت عمّان", () => {
  it("قبضة فجر 2026-08-01 (22:30Z) تنتمي لآب وقبضة 21:30Z ليلة 31 آب لا تنتمي", async () => {
    const store = new MemoryLocalStore();
    /* الطلب الأول: عربونه 1,000 قُبض 2026-07-31T22:30:00.000Z = 01:30 فجر
     * الأحد 2026-08-01 بتوقيت عمّان (UTC+3 طول العام) — داخل آب رغم تاريخ
     * UTC السابق. */
    await saveCollectedOrder(store, {
      id: "boundary-order-early",
      priceMinor: 3_000,
      createdOn: "2026-07-31",
      depositMinor: 1_000,
      depositAt: "2026-07-31T22:30:00.000Z",
      deliveredOn: "2026-08-05",
      remainingMinor: 2_000,
      remainingAt: "2026-08-06T10:00:00.000Z",
    });
    /* الطلب الثاني: متبقيه 1,500 قُبض 2026-08-31T21:30:00.000Z = 00:30 فجر
     * 2026-09-01 بتوقيت عمّان — خارج آب رغم تاريخ UTC داخلها. */
    await saveCollectedOrder(store, {
      id: "boundary-order-late",
      priceMinor: 2_000,
      createdOn: "2026-08-01",
      depositMinor: 500,
      depositAt: "2026-08-10T09:00:00.000Z",
      deliveredOn: "2026-08-20",
      remainingMinor: 1_500,
      remainingAt: "2026-08-31T21:30:00.000Z",
    });
    const bridge = new ProfitToCashBridgeService(store, now);
    const reading = await bridge.readProfitToCashBridge({ from: "2026-08-01", to: "2026-08-31" });
    if (!reading.ok) throw new Error("bridge should read");
    const value = reading.value;
    /* المقيس 3,500 = 1,000 (فجر آب) + 2,000 (2026-08-06) + 500 (2026-08-10):
     * لو قُطعت قبضة الفجر (بUTC) لكانت 2,500؛ ولو أُدخلت قبضة 21:30Z
     * الأخيرة لكانت 5,000 — 3,500 تثبت الحدّين معًا بتوقيت عمّان. */
    expect(value.recordedCashDeltaMinor).toBe(3_500);
    /* النتيجة: إيراد 5,000 − تكلفة 1,000 = 4,000؛ والتوازن قائم:
     * 4,000 + (توقيت ذمم −1,500) + (مواد +1,000) = 3,500. */
    expect(value.resultMinor).toBe(4_000);
    expect(value.remainderMinor).toBe(0);
    expect(value.bridgedTotalMinor).toBe(3_500);
    expect(value.bridgedTotalMinor).toBe(value.recordedCashDeltaMinor);
    expect(value.status).toBe("recorded_only");
  });
});

describe("ProfitToCashBridgeService — مسار فشل التخزين", () => {
  it("فشل قراءة الأحداث المالية يعيد storage_error لا أرقامًا مختلقة", async () => {
    class FailingEventsStore extends MemoryLocalStore {
      override async listFinancialEvents(): Promise<StorageResult<readonly FinancialEvent[]>> {
        return { ok: false as const, code: "storage_error" as const, message: "فشل قراءة مفتعل للاختبار" };
      }
    }
    const store = new FailingEventsStore();
    await seedCleanAugustWorld(store);
    const bridge = new ProfitToCashBridgeService(store, now);
    const reading = await bridge.readProfitToCashBridge({ from: "2026-08-01", to: "2026-08-31" });
    expect(reading.ok).toBe(false);
    if (reading.ok) return;
    expect(reading.code).toBe("storage_error");
  });
});
