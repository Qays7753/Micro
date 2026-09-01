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

describe("updateSupplierPurchase — تعديل موثق للشراء (المجموعة ٢ §10.4)", () => {
  it("يصحح الإجمالي والدفع الأولي ويحفظ القيم قبل التصحيح في مراجعة", () => {
    const purchase = makePurchase();
    const updated = updateSupplierPurchase(purchase, {
      supplierName: "محل الأقمشة",
      note: "قماش قطني — تصحيح الفاتورة",
      purchasedOn: "2026-09-01",
      dueOn: "2026-09-25",
      totalMinor: 6000,
      initialPaidMinor: 2500,
      recordedAt: "2026-09-02T09:00:00Z",
      idempotencyKey: "edit-1",
      reason: "فاتورة مصححة من المورد",
    });
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
    const updated = updateSupplierPurchase(purchase, {
      supplierName: "محل الأقمشة",
      note: "قماش",
      purchasedOn: "2026-09-01",
      totalMinor: 5000,
      initialPaidMinor: 0,
      recordedAt: "2026-09-02T09:00:00Z",
      idempotencyKey: "edit-2",
      reason: "الدفع كان من حساب شخصي",
    });
    expect(updated.payments.find(payment => payment.id === "purchase-1:initial")).toBeUndefined();
    expect(updated.paidMinor).toBe(0);
    expect(updated.status).toBe("unpaid");
  });

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
      updateSupplierPurchase(purchase, {
        supplierName: "محل الأقمشة",
        note: "قماش",
        purchasedOn: "2026-09-01",
        totalMinor: 4000,
        initialPaidMinor: 2000,
        recordedAt: "2026-09-02T09:00:00Z",
        idempotencyKey: "edit-3",
        reason: "خطأ",
      }),
    ).toThrow("أقل من الدفعات المسجلة");
  });

  it("يرفض التعديل بلا سبب وبمفتاح مكرر يعيد الأصل", () => {
    const purchase = makePurchase();
    expect(() =>
      updateSupplierPurchase(purchase, {
        supplierName: "محل الأقمشة",
        note: "قماش",
        purchasedOn: "2026-09-01",
        totalMinor: 5000,
        initialPaidMinor: 2000,
        recordedAt: "2026-09-02T09:00:00Z",
        idempotencyKey: "edit-4",
        reason: "",
      }),
    ).toThrow("أكمل السبب");
    const once = updateSupplierPurchase(purchase, {
      supplierName: "محل الأقمشة",
      note: "قماش",
      purchasedOn: "2026-09-01",
      totalMinor: 5500,
      initialPaidMinor: 2000,
      recordedAt: "2026-09-02T09:00:00Z",
      idempotencyKey: "edit-5",
      reason: "سبب",
    });
    const twice = updateSupplierPurchase(once, {
      supplierName: "محل الأقمشة",
      note: "قماش",
      purchasedOn: "2026-09-01",
      totalMinor: 5500,
      initialPaidMinor: 2000,
      recordedAt: "2026-09-02T10:00:00Z",
      idempotencyKey: "edit-5",
      reason: "سبب",
    });
    expect(twice).toBe(once);
  });
});

describe("reverseSupplierPurchasePayment — تراجع موثق عن دفعة (المجموعة ٢ §10.4)", () => {
  function purchaseWithPayment(): SupplierPurchase {
    const purchase = makePurchase();
    return recordSupplierPurchasePayment(purchase, {
      id: "payment-1",
      amountMinor: 1500,
      occurredOn: "2026-09-10",
      recordedAt: "2026-09-10T09:00:00Z",
      idempotencyKey: "payment-key-1",
      note: "دفعة ثانية",
    });
  }

  it("يستعيد المتبقي للمورد ويحفظ الدفعة الأصلية وعلاقة التراجع", () => {
    const purchase = purchaseWithPayment();
    expect(purchase.payableMinor).toBe(1500);
    const reversed = reverseSupplierPurchasePayment(purchase, {
      id: "reversal-1",
      paymentId: "payment-1",
      reason: "رجعت الدفعة للمورد خطأً بالتحويل",
      occurredOn: "2026-09-12",
      recordedAt: "2026-09-12T09:00:00Z",
      idempotencyKey: "reversal-key-1",
    });
    expect(reversed.paidMinor).toBe(2000);
    expect(reversed.payableMinor).toBe(3000);
    expect(reversed.status).toBe("partially_paid");
    /* الدفعة الأصلية باقية والتراجع يشير إليها */
    expect(reversed.payments.find(payment => payment.id === "payment-1")).toBeDefined();
    expect(reversed.paymentReversals?.[0]?.paymentId).toBe("payment-1");
    expect(reversed.paymentReversals?.[0]?.amountMinor).toBe(1500);
  });

  it("يرفض التراجع عن الدفعة الأولية والدفعة المرتدة سابقًا", () => {
    const purchase = purchaseWithPayment();
    expect(() =>
      reverseSupplierPurchasePayment(purchase, {
        id: "reversal-2",
        paymentId: "purchase-1:initial",
        reason: "سبب",
        occurredOn: "2026-09-12",
        recordedAt: "2026-09-12T09:00:00Z",
        idempotencyKey: "reversal-key-2",
      }),
    ).toThrow("بتعديل الشراء نفسه");
    const reversed = reverseSupplierPurchasePayment(purchase, {
      id: "reversal-3",
      paymentId: "payment-1",
      reason: "سبب",
      occurredOn: "2026-09-12",
      recordedAt: "2026-09-12T09:00:00Z",
      idempotencyKey: "reversal-key-3",
    });
    expect(() =>
      reverseSupplierPurchasePayment(reversed, {
        id: "reversal-4",
        paymentId: "payment-1",
        reason: "سبب ثانٍ",
        occurredOn: "2026-09-13",
        recordedAt: "2026-09-13T09:00:00Z",
        idempotencyKey: "reversal-key-4",
      }),
    ).toThrow("لا يُنشأ تراجع ثانٍ");
  });

  it("idempotent: نفس المفتاح يعيد السجل دون تغيير، والسبب إلزامي", () => {
    const purchase = purchaseWithPayment();
    expect(() =>
      reverseSupplierPurchasePayment(purchase, {
        id: "reversal-5",
        paymentId: "payment-1",
        reason: "",
        occurredOn: "2026-09-12",
        recordedAt: "2026-09-12T09:00:00Z",
        idempotencyKey: "reversal-key-5",
      }),
    ).toThrow("أكمل السبب");
    const once = reverseSupplierPurchasePayment(purchase, {
      id: "reversal-6",
      paymentId: "payment-1",
      reason: "سبب",
      occurredOn: "2026-09-12",
      recordedAt: "2026-09-12T09:00:00Z",
      idempotencyKey: "reversal-key-6",
    });
    /* مفتاح مكرر: يعيد السجل الحالي دون تغيير — لا تراجع ثانٍ ولا مضاعفة أثر */
    const twice = reverseSupplierPurchasePayment(once, {
      id: "reversal-7",
      paymentId: "payment-1",
      reason: "سبب ثانٍ",
      occurredOn: "2026-09-12",
      recordedAt: "2026-09-12T09:00:00Z",
      idempotencyKey: "reversal-key-6",
    });
    expect(twice).toBe(once);
    expect(twice.paymentReversals).toHaveLength(1);
  });
});
