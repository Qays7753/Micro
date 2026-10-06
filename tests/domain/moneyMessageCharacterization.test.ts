import { describe, expect, it } from "vitest";
import { addLoanRepayment, createLoanRecord } from "../../src/domain/loan/index.js";
import { addReceivedLoanRepayment, createReceivedLoanRecord } from "../../src/domain/received-loan/index.js";
import {
  calculateCostSnapshot,
  cancelOrder,
  classifyRetainedDeposit,
  collectDeposit,
  createCraftOrder,
  describeSettlementConflict,
  reclassifyRetainedDeposit,
  reverseActiveDeposit,
  settleDepositRefund,
  settleDepositRetain,
  type CraftOrder,
} from "../../src/domain/craft-order/index.js";

/**
 * W2 (برنامج الإكمال ما بعد المسح — 2026-10-05): توصيف نصوص رسائل المال في المجال.
 *
 * الغاية: تثبيت النص الحرفي لمواقع تضمين المال داخل رسائل المجال العربية حتى لا
 * يتغير أي منها بصمت. هذه المواقع «عرض مشتق» لا «قاعدة دلالية»: القيم الرقمية
 * (minor الصحيحة) هي الحقيقة، والنصوص مشتقة منها. الموقعان الملتصقان بحقل
 * `note` (تصنيف العربون وتصحيحه) **نص مخزّن تاريخي** — تجميده هنا يعني أن أي
 * تغيير مستقبلي عليه قرار مالك صريح (قرار المالك رقم 2 في عقد التنفيذ)، لا
 * إعادة صياغة صامتة تُنشئ اصطلاحًا ثالثًا للسجلات القائمة.
 *
 * جرد المواقع (15 تضمينًا في 14 سطرًا عبر 5 ملفات — راجع سجل الملكية §7):
 * - مخزّن (2): policies.ts note التصنيف والتصحيح — يُثبَّت هنا حرفيًا.
 * - رسائل فقط: تجاوزات التسوية/العكس/التصنيف، تجاوز دفعة القرض (صادر ومستلم)،
 *   تعارض التحصيل المفصل — تُثبَّت هنا حرفيًا.
 * - معدلات التوزيع (recurring-margin): مثبتة حرفيًا مسبقًا في
 *   `complex-six.characterization.test.ts` (و٩) — لا تكرار هنا.
 */

const snapshot = calculateCostSnapshot("cost-money-message", {
  currency: "JOD",
  materialItems: [
    {
      name: "قماش",
      quantity: 1,
      unit: "متر",
      unitPriceMinor: 500,
      priceDate: "2026-08-21",
      source: "user_input",
      confidence: "known",
    },
  ],
  time: null,
  packagingMinor: 0,
  deliveryMinor: 0,
  wasteMinor: 0,
  safetyBufferMinor: 0,
  quantity: 1,
  createdAt: "2026-08-21T09:00:00Z",
  source: "price_approval",
});

function orderWithCollectedDeposit(depositMinor = 5000): CraftOrder {
  let order: CraftOrder = createCraftOrder({
    id: "order-money-message",
    customerName: "ليلى",
    itemName: "فستان",
    specifications: "قياس مخصص",
    quantity: 1,
    agreedPriceMinor: 10000,
    costSnapshot: snapshot,
    createdAt: "2026-08-21T10:00:00Z",
  });
  return collectDeposit(order, depositMinor, "money-message:dep", "2026-08-21T10:01:00Z");
}

function cancelledOrder(): CraftOrder {
  return cancelOrder(
    orderWithCollectedDeposit(),
    "إلغاء متفق",
    "money-message:cancel",
    "2026-08-22T10:00:00Z",
  );
}

function cancelledRetained(): CraftOrder {
  return settleDepositRetain(
    cancelledOrder(),
    5000,
    "احتفاظ",
    "money-message:retain",
    "2026-08-23T10:00:00Z",
  );
}

describe("W2 money-message characterization — persisted deposit-classification notes (frozen historical text)", () => {
  it("pins the exact owner-classification note text including the embedded money amount", () => {
    const classified = classifyRetainedDeposit(
      cancelledRetained(),
      "owner",
      "العربون يعود لي",
      "money-message:classify",
      "2026-08-24T10:00:00Z",
    );
    const event = classified.events.find(event => event.type === "deposit_classified")!;
    expect(event.note).toBe("مال مالك (50 د.أ) — العربون يعود لي");
    /* حماية الطبقة المالية: القيمة الرقمية المحفوظة صحيحة جديدة بغض النظر عن النص. */
    expect(event.amountMinor).toBe(5000);
    expect(classified.depositClassifiedOwnerMinor).toBe(5000);
    expect(classified.depositClassifiedRevenueMinor).toBe(0);
  });

  it("pins the exact partial revenue-classification note (fractional minor renders without forced decimals)", () => {
    const classified = classifyRetainedDeposit(
      cancelledRetained(),
      "revenue",
      "جزء كإيراد",
      "money-message:classify-partial",
      "2026-08-24T10:00:00Z",
      2000,
    );
    const event = classified.events.find(event => event.type === "deposit_classified")!;
    expect(event.note).toBe("إيراد مشروع (20 د.أ) — جزء كإيراد");
    expect(event.amountMinor).toBe(2000);
    expect(classified.depositClassifiedRevenueMinor).toBe(2000);
  });

  it("pins the exact reclassification (correction) note text", () => {
    const first = classifyRetainedDeposit(
      cancelledRetained(),
      "revenue",
      "تصنيف أولي",
      "money-message:classify-first",
      "2026-08-24T10:00:00Z",
      5000,
    );
    const corrected = reclassifyRetainedDeposit(first, {
      fromMeaning: "revenue",
      fromAmountMinor: 5000,
      toMeaning: "owner",
      toAmountMinor: 3000,
      reason: "تصحيح بعد مراجعة",
      idempotencyKey: "money-message:reclassify",
      createdAt: "2026-08-25T10:00:00Z",
    });
    const events = corrected.events.filter(event => event.type === "deposit_classified");
    expect(events).toHaveLength(2);
    expect(events[1]!.note).toBe("تصحيح إلى مال مالك (30 د.أ) — تصحيح بعد مراجعة");
    expect(events[1]!.amountMinor).toBe(3000);
    expect(corrected.depositClassifiedOwnerMinor).toBe(3000);
    expect(corrected.depositClassifiedRevenueMinor).toBe(0);
  });
});

describe("W2 money-message characterization — message-only error texts (derived views, not semantics)", () => {
  it("pins the settlement-overflow message (pending remainder embedded)", () => {
    expect(() =>
      settleDepositRefund(cancelledOrder(), 6000, "زيادة", "money-message:refund", "2026-08-23T10:00:00Z"),
    ).toThrow("مبلغ التسوية يتجاوز المتبقي غير المحسوم من العربون (50 د.أ).");
  });

  it("pins the reversal-overflow message (standing deposit embedded)", () => {
    expect(() =>
      reverseActiveDeposit(
        orderWithCollectedDeposit(),
        6000,
        "زيادة",
        "money-message:reverse",
        "2026-08-24T10:00:00Z",
      ),
    ).toThrow("مبلغ العكس يتجاوز العربون القائم بعد العكوس السابقة (50 د.أ).");
  });

  it("pins the classification-overflow message (unclassified remainder embedded)", () => {
    expect(() =>
      classifyRetainedDeposit(
        cancelledRetained(),
        "owner",
        "زيادة",
        "money-message:classify-over",
        "2026-08-24T10:00:00Z",
        6000,
      ),
    ).toThrow("مبلغ التصنيف يتجاوز المحتفظ به غير المصنَّف (50 د.أ).");
  });
});

describe("W2 money-message characterization — loan and conflict texts (derived views, not semantics)", () => {
  it("pins the outgoing-loan repayment-overflow message (outstanding and entered embedded)", () => {
    const loan = createLoanRecord({
      id: "loan-money-message",
      borrowerName: "أحمد",
      principalMinor: 15000,
      loanDate: "2026-07-01",
      principalEventId: "event-loan",
      operationKey: "loan-money-message:create",
      createdAt: "2026-07-01T08:00:00.000Z",
    });
    expect(() =>
      addLoanRepayment(
        loan,
        { repaymentId: "rep-1", amountMinor: 20000, date: "2026-08-01", eventId: "event-rep-1" },
        "2026-08-01T08:00:00.000Z",
      ),
    ).toThrow("مبلغ الدفعة يتجاوز المتبقي من القرض — المتبقي 150 د.أ والمُدخل 200 د.أ.");
  });

  it("pins the received-loan repayment-overflow message (same convention, separate ownership home)", () => {
    const loan = createReceivedLoanRecord({
      id: "received-loan-money-message",
      lenderName: "سارة",
      lenderType: "person",
      principalMinor: 8000,
      receivedOn: "2026-07-01",
      dueOn: null,
      note: null,
      principalEventId: "event-received-loan",
      operationKey: "received-loan-money-message:create",
      createdAt: "2026-07-01T08:00:00.000Z",
    });
    expect(() =>
      addReceivedLoanRepayment(
        loan,
        { repaymentId: "rep-1", amountMinor: 9000, date: "2026-08-01", eventId: "event-rep-1" },
        "2026-08-01T08:00:00.000Z",
      ),
    ).toThrow("مبلغ الدفعة يتجاوز المتبقي من القرض — المتبقي 80 د.أ والمُدخل 90 د.أ.");
  });

  it("pins the settlement-conflict description (four embedded amounts in one derived diagnostic text)", () => {
    const order = orderWithCollectedDeposit(4000);
    const text = describeSettlementConflict(order);
    expect(text).toBe(
      "تعارض تاريخي في سجل هذا الدين: المتبقي المسجل 60 د.أ " +
        "لا يطابق أساس قيمة الطلب القابلة للتحصيل 100 د.أ " +
        "بعد المقبوض 40 د.أ (الفرق 0 د.أ) — " +
        "التحصيل العادي موقوف لهذا السجل حتى تصحيح موثق بقرار المالك؛ " +
        "الأحداث الأصلية محفوظة كما هي ولا يُحوّل السجل تلقائيًا إلى مراجعة.",
    );
  });
});

describe("W2 money-layer protection — messages are derived views; numbers stay authoritative", () => {
  it("the embedded display number always equals minor/100 (single derivation rule, no second arithmetic)", () => {
    /* القاعدة: كل رقم يظهر في نصوص المجال هو minor/100 حرفيًا — لا تقريب ولا
     * تحويل آخر. أي انحراف مستقبلي عن هذه القاعدة يكسر هذا التوكّد أولًا. */
    try {
      settleDepositRefund(cancelledOrder(), 5001, "كسر", "rule:refund", "2026-08-23T10:00:00Z");
      expect.unreachable("refund beyond pending must throw");
    } catch (error) {
      expect((error as Error).message).toBe(
        `مبلغ التسوية يتجاوز المتبقي غير المحسوم من العربون (${5000 / 100} د.أ).`,
      );
    }
  });

  it("message composition never mutates numeric state (order totals identical with and without messages)", () => {
    const retained = cancelledRetained();
    const classified = classifyRetainedDeposit(
      retained,
      "owner",
      "وصف",
      "rule:classify",
      "2026-08-24T10:00:00Z",
    );
    /* القيم الرقمية بعد التصنيف مطابقة تمامًا لقيمها قبل أي نص — النص عرض فقط. */
    expect(classified.agreedPriceMinor).toBe(retained.agreedPriceMinor);
    expect(classified.events).toHaveLength(retained.events.length + 1);
    expect(classified.retainedMeaning).toBe("owner");
    expect(retained.retainedMeaning ?? null).toBeNull();
  });
});
