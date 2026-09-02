import { describe, expect, it } from "vitest";
import {
  createSupplierPurchase,
  recordSupplierPurchasePayment,
  reverseSupplierPurchasePayment,
  updateSupplierPurchase,
  type SupplierPurchase,
} from "../../src/domain/supplier-purchase/index.js";

function makePurchase(): SupplierPurchase {
  return createSupplierPurchase({
    id: "purchase-1",
    supplierName: "محل الأقمشة",
    note: "قماش قطني",
    purchasedOn: "2026-09-01",
    dueOn: "2026-09-20",
    totalMinor: 5000,
    initialPaidMinor: 2000,
    recordedAt: "2026-09-01T09:00:00Z",
    idempotencyKey: "purchase-key-1",
  });
}

/* مدخلات تعديل الشراء — أساس واحد والاختبار يعلن فرقه فقط؛ لا تكرار حرفي
 * يخفي حقلًا نسيه تصحيح لاحق. */
function editInput(overrides: Partial<Parameters<typeof updateSupplierPurchase>[1]> = {}) {
  return {
    supplierName: "محل الأقمشة",
    note: "قماش",
    purchasedOn: "2026-09-01",
    totalMinor: 5000,
    initialPaidMinor: 2000,
    recordedAt: "2026-09-02T09:00:00Z",
    idempotencyKey: "edit-base",
    reason: "سبب",
    ...overrides,
  };
}

/* مدخلات تراجع الدفعة — الأساس نفسه لكل استدعاءات الحماية والتكرار. */
function reversalInput(overrides: Partial<Parameters<typeof reverseSupplierPurchasePayment>[1]> = {}) {
  return {
    id: "reversal-base",
    paymentId: "payment-1",
    reason: "سبب",
    occurredOn: "2026-09-12",
    recordedAt: "2026-09-12T09:00:00Z",
    idempotencyKey: "reversal-key-base",
    ...overrides,
  };
}

function purchaseWithPayment(): SupplierPurchase {
  return recordSupplierPurchasePayment(makePurchase(), {
    id: "payment-1",
    amountMinor: 1500,
    occurredOn: "2026-09-10",
    recordedAt: "2026-09-10T09:00:00Z",
    idempotencyKey: "payment-key-1",
    note: "دفعة ثانية",
  });
}

describe("updateSupplierPurchase — تعديل موثق للشراء (المجموعة ٢ §10.4)", () => {
  it("يصحح الإجمالي والدفع الأولي ويحفظ القيم قبل التصحيح في مراجعة", () => {
    const purchase = makePurchase();
    const updated = updateSupplierPurchase(
      purchase,
      editInput({
        note: "قماش قطني — تصحيح الفاتورة",
        dueOn: "2026-09-25",
        totalMinor: 6000,
        initialPaidMinor: 2500,
        idempotencyKey: "edit-1",
        reason: "فاتورة مصححة من المورد",
      }),
    );
    expect(updated.totalMinor).toBe(6000);
    expect(updated.paidMinor).toBe(2500);
    expect(updated.payableMinor).toBe(3500);
    expect(updated.status).toBe("partially_paid");
    expect(updated.revisions).toHaveLength(1);
    expect(updated.revisions?.[0]?.beforeTotalMinor).toBe(5000);
    expect(updated.revisions?.[0]?.beforeInitialPaidMinor).toBe(2000);
    expect(updated.revisions?.[0]?.reason).toBe("فاتورة مصححة من المورد");
    /* الدفعة الأولية تبقى واحدة بمقدار الدفع الجديد */
    expect(updated.payments.find(payment => payment.id === "purchase-1:initial")?.amountMinor).toBe(2500);
  });

  it("يدفع أولي صفر في التعديل يحذف الدفعة الأولية لا غيرها", () => {
    const purchase = makePurchase();
    const updated = updateSupplierPurchase(
      purchase,
      editInput({
        initialPaidMinor: 0,
        idempotencyKey: "edit-2",
        reason: "الدفع كان من حساب شخصي",
      }),
    );
    expect(updated.payments.find(payment => payment.id === "purchase-1:initial")).toBeUndefined();
    expect(updated.paidMinor).toBe(0);
    expect(updated.status).toBe("unpaid");
  });
});

/* حمايات التعديل — الرفض لا يكتب شيئًا والمفتاح المكرر يعيد الأصل. */
describe("updateSupplierPurchase — الحمايات والتكرار (المجموعة ٢ §10.4)", () => {
  it("يرفض إجماليًا أقل من الدفعات المسجلة عليه", () => {
    const purchase = recordSupplierPurchasePayment(makePurchase(), {
      id: "payment-x",
      amountMinor: 3000,
      occurredOn: "2026-09-10",
      recordedAt: "2026-09-10T09:00:00Z",
      idempotencyKey: "payment-key-x",
      note: "دفعة كبيرة",
    });
    expect(() =>
      updateSupplierPurchase(
        purchase,
        editInput({
          totalMinor: 4000,
          idempotencyKey: "edit-3",
          reason: "خطأ",
        }),
      ),
    ).toThrow("أقل من الدفعات المسجلة");
  });
});

describe("updateSupplierPurchase — بلا سبب أو بمفتاح مكرر (المجموعة ٢ §10.4)", () => {
  it("يرفض التعديل بلا سبب وبمفتاح مكرر يعيد الأصل", () => {
    const purchase = makePurchase();
    expect(() =>
      updateSupplierPurchase(purchase, editInput({ idempotencyKey: "edit-4", reason: "" })),
    ).toThrow("أكمل السبب");
    const once = updateSupplierPurchase(
      purchase,
      editInput({ totalMinor: 5500, idempotencyKey: "edit-5", reason: "سبب" }),
    );
    const twice = updateSupplierPurchase(
      once,
      editInput({
        totalMinor: 5500,
        recordedAt: "2026-09-02T10:00:00Z",
        idempotencyKey: "edit-5",
        reason: "سبب",
      }),
    );
    expect(twice).toBe(once);
  });
});

describe("reverseSupplierPurchasePayment — تراجع موثق عن دفعة (المجموعة ٢ §10.4)", () => {
  it("يستعيد المتبقي للمورد ويحفظ الدفعة الأصلية وعلاقة التراجع", () => {
    const purchase = purchaseWithPayment();
    expect(purchase.payableMinor).toBe(1500);
    const reversed = reverseSupplierPurchasePayment(
      purchase,
      reversalInput({
        id: "reversal-1",
        reason: "رجعت الدفعة للمورد خطأً بالتحويل",
        idempotencyKey: "reversal-key-1",
      }),
    );
    expect(reversed.paidMinor).toBe(2000);
    expect(reversed.payableMinor).toBe(3000);
    expect(reversed.status).toBe("partially_paid");
    /* الدفعة الأصلية باقية والتراجع يشير إليها */
    expect(reversed.payments.find(payment => payment.id === "payment-1")).toBeDefined();
    expect(reversed.paymentReversals?.[0]?.paymentId).toBe("payment-1");
    expect(reversed.paymentReversals?.[0]?.amountMinor).toBe(1500);
  });
});

/* حمايات التراجع عن الدفعات — الرفض بلا كتابة والتكرار لا يضاعف الأثر. */
describe("reverseSupplierPurchasePayment — الحمايات والتكرار (المجموعة ٢ §10.4)", () => {
  it("يرفض التراجع عن الدفعة الأولية والدفعة المرتدة سابقًا", () => {
    const purchase = purchaseWithPayment();
    expect(() =>
      reverseSupplierPurchasePayment(
        purchase,
        reversalInput({
          id: "reversal-2",
          paymentId: "purchase-1:initial",
          idempotencyKey: "reversal-key-2",
        }),
      ),
    ).toThrow("بتعديل الشراء نفسه");
    const reversed = reverseSupplierPurchasePayment(
      purchase,
      reversalInput({ id: "reversal-3", idempotencyKey: "reversal-key-3" }),
    );
    expect(() =>
      reverseSupplierPurchasePayment(
        reversed,
        reversalInput({
          id: "reversal-4",
          reason: "سبب ثانٍ",
          occurredOn: "2026-09-13",
          recordedAt: "2026-09-13T09:00:00Z",
          idempotencyKey: "reversal-key-4",
        }),
      ),
    ).toThrow("لا يُنشأ تراجع ثانٍ");
  });

  it("idempotent: نفس المفتاح يعيد السجل دون تغيير، والسبب إلزامي", () => {
    const purchase = purchaseWithPayment();
    expect(() =>
      reverseSupplierPurchasePayment(
        purchase,
        reversalInput({ id: "reversal-5", reason: "", idempotencyKey: "reversal-key-5" }),
      ),
    ).toThrow("أكمل السبب");
    const once = reverseSupplierPurchasePayment(
      purchase,
      reversalInput({ id: "reversal-6", idempotencyKey: "reversal-key-6" }),
    );
    /* مفتاح مكرر: يعيد السجل الحالي دون تغيير — لا تراجع ثانٍ ولا مضاعفة أثر */
    const twice = reverseSupplierPurchasePayment(
      once,
      reversalInput({
        id: "reversal-7",
        reason: "سبب ثانٍ",
        idempotencyKey: "reversal-key-6",
      }),
    );
    expect(twice).toBe(once);
    expect(twice.paymentReversals).toHaveLength(1);
  });
});

/* S2-01 (تدقيق المجموعة ٥): الدفعة بعد التراجع تحترم التراجع — لا يُبعث أثر
 * دفعة مُتراجَع عنها، والمتبقي يُحسب من المدفوع الفعلي لا من مجموع الدفعات. */
describe("recordSupplierPurchasePayment بعد تراجع موثق (S2-01)", () => {
  it("دفعة جديدة بعد التراجع تطرح أثر التراجع — المدفوع والمتبقي صادقان", () => {
    const purchase = purchaseWithPayment();
    /* تراجع موثق عن الدفعة الثانية (1500) — المدفوع يعود إلى الدفع الأولي 2000. */
    const afterReversal = reverseSupplierPurchasePayment(
      purchase,
      reversalInput({ paymentId: "payment-1", idempotencyKey: "reversal-s201" }),
    );
    expect(afterReversal.paidMinor).toBe(2000);
    expect(afterReversal.payableMinor).toBe(3000);
    /* دفعة جديدة 1500: المدفوع الفعلي 3500 لا 5000 (لا يُبعث أثر التراجع). */
    const afterNewPayment = recordSupplierPurchasePayment(afterReversal, {
      id: "payment-2",
      amountMinor: 1500,
      occurredOn: "2026-09-14",
      recordedAt: "2026-09-14T09:00:00Z",
      idempotencyKey: "payment-key-2",
      note: "دفعة بديلة",
    });
    expect(afterNewPayment.payments).toHaveLength(3);
    expect(afterNewPayment.paidMinor).toBe(3500);
    expect(afterNewPayment.payableMinor).toBe(1500);
    expect(afterNewPayment.status).toBe("partially_paid");
  });

  it("يرفض دفعة تتجاوز المتبقي الفعلي بعد التراجع (لا المتبقي المخزن وحده)", () => {
    const purchase = purchaseWithPayment();
    const afterReversal = reverseSupplierPurchasePayment(
      purchase,
      reversalInput({ paymentId: "payment-1", idempotencyKey: "reversal-s201b" }),
    );
    /* المتبقي الفعلي 3000 — دفعة 3500 يجب أن تُرفض رغم أن مجموع الدفعات كان 3500. */
    expect(() =>
      recordSupplierPurchasePayment(afterReversal, {
        id: "payment-3",
        amountMinor: 3500,
        occurredOn: "2026-09-14",
        recordedAt: "2026-09-14T09:00:00Z",
        idempotencyKey: "payment-key-3",
        note: "دفعة كبيرة",
      }),
    ).toThrow("الدفعة لا يمكن أن تتجاوز المتبقي المسجل على الشراء.");
  });
});
