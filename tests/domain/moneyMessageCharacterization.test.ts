import { describe, expect, it } from "vitest";
import { persistedMoneyTextMinor } from "../../src/domain/shared/index.js";
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
 * **قلب مؤرخ (R2 — M-10/D11، 2026-10-08):** المالك ألغى استثناء التجميد
 * لموقعي الملاحظة المحفوظة ووافق على المنسّق الكنوني للمحفوظ
 * `persistedMoneyTextMinor` (منزلتان دائمًا، بلا تجميع) — الذهبيات أدناه
 * قُلبت واعيًا إلى الصيغة الكنونية للكتابات الجديدة؛ النصوص التاريخية
 * المخزونة تُقرأ كما خُزّنت (لا إعادة كتابة) — عقد القراءة القديمة يثبته
 * اختبار القراءة القديمة في application/cash/cashCountMessages.test.ts
 * ودورة التسليم في deliveryReviewService.test.ts. رسائل الرمي اللحظية
 * (غير المحفوظة) تبقى على اصطلاحها الأصلي مثبتة أدناه دون تغيير.
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

describe("R2 (M-10/D11, 2026-10-08) persisted deposit-classification notes — canonical persistedMoneyTextMinor for new writes", () => {
  it("pins the exact owner-classification note text including the embedded money amount", () => {
    const classified = classifyRetainedDeposit(
      cancelledRetained(),
      "owner",
      "العربون يعود لي",
      "money-message:classify",
      "2026-08-24T10:00:00Z",
    );
    const event = classified.events.find(event => event.type === "deposit_classified")!;
    expect(event.note).toBe(`مال مالك (${persistedMoneyTextMinor(5000)}) — العربون يعود لي`);
    /* حماية الطبقة المالية: القيمة الرقمية المحفوظة صحيحة جديدة بغض النظر عن النص. */
    expect(event.amountMinor).toBe(5000);
    expect(classified.depositClassifiedOwnerMinor).toBe(5000);
    expect(classified.depositClassifiedRevenueMinor).toBe(0);
  });

  it("pins the exact partial revenue-classification note (canonical persisted formatter forces two decimals)", () => {
    const classified = classifyRetainedDeposit(
      cancelledRetained(),
      "revenue",
      "جزء كإيراد",
      "money-message:classify-partial",
      "2026-08-24T10:00:00Z",
      2000,
    );
    const event = classified.events.find(event => event.type === "deposit_classified")!;
    expect(event.note).toBe(`إيراد مشروع (${persistedMoneyTextMinor(2000)}) — جزء كإيراد`);
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
    expect(events[1]!.note).toBe(`تصحيح إلى مال مالك (${persistedMoneyTextMinor(3000)}) — تصحيح بعد مراجعة`);
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
describe("R2 (M-10/D11) persistedMoneyTextMinor — the one canonical persisted money text", () => {
  it("renders the exact canonical vectors: two decimals always, no grouping, unit embedded", () => {
    expect(persistedMoneyTextMinor(0)).toBe("0.00 د.أ");
    expect(persistedMoneyTextMinor(1)).toBe("0.01 د.أ");
    expect(persistedMoneyTextMinor(10)).toBe("0.10 د.أ");
    expect(persistedMoneyTextMinor(99)).toBe("0.99 د.أ");
    expect(persistedMoneyTextMinor(100)).toBe("1.00 د.أ");
    expect(persistedMoneyTextMinor(1050)).toBe("10.50 د.أ");
    /* القيم الكبيرة: بلا فواصل تجميع إطلاقًا — عقد المحفوظ غير عقد العرض. */
    expect(persistedMoneyTextMinor(123456789)).toBe("1234567.89 د.أ");
    expect(persistedMoneyTextMinor(1250000)).toBe("12500.00 د.أ");
    expect(persistedMoneyTextMinor(123450)).not.toContain(",");
    /* السالب (فرق العدّ الناقص) بإشارة صريحة. */
    expect(persistedMoneyTextMinor(-3000)).toBe("-30.00 د.أ");
    expect(persistedMoneyTextMinor(-1)).toBe("-0.01 د.أ");
  });

  it("is pure integer serialization — locale/ICU-independent and deterministic", () => {
    /* الاستقلال عن المنطقة: نفس المدخل يعطي نفس الخرج مهما كانت بيئة التشغيل
     * (حساب صحيح + padStart فقط — لا Intl ولا Date داخل الدالة بتاتًا). */
    for (let run = 0; run < 3; run += 1) {
      expect(persistedMoneyTextMinor(2050)).toBe("20.50 د.أ");
      expect(persistedMoneyTextMinor(99999999999)).toBe("999999999.99 د.أ");
    }
  });

  it("fails closed on non-safe-integer input — no placeholder text can ever persist", () => {
    expect(() => persistedMoneyTextMinor(0.5)).toThrow();
    expect(() => persistedMoneyTextMinor(Number.NaN)).toThrow();
    expect(() => persistedMoneyTextMinor(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => persistedMoneyTextMinor(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });

  it("single-derivation rule: the persisted notes embed persistedMoneyTextMinor output, never a second format", () => {
    /* قاعدة الاشتقاق الواحد (M-10): ملاحظتا المجال تحملان خرج المنسّق الكنوني
     * بالنص الحرفي — لا قالب قسمة خام ولا منسّق عرض. */
    const classified = classifyRetainedDeposit(
      cancelledRetained(),
      "owner",
      "عربون يعود لي",
      "money-message:canonical",
      "2026-08-24T10:00:00Z",
    );
    const event = classified.events.find(item => item.type === "deposit_classified")!;
    expect(event.note).toContain(persistedMoneyTextMinor(event.amountMinor!));
    /* لا الصيغة الخام القديمة (بلا منزلتين) ولا أي تجميع. */
    expect(event.note).toContain("(50.00 د.أ)");
    expect(event.note).not.toContain("(50 د.أ)");
    expect(event.note).not.toContain(",");
    /* القيمة الرقمية الدائمة لم تتغير — النص اشتقاق فوقها فقط. */
    expect(event.amountMinor).toBe(5000);
  });
});
