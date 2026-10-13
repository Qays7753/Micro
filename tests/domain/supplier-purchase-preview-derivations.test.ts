/**
 * R10-B4/F-021 (2026-10-12) — معاينات نواة المدفوع/المستحق لشراء المورد:
 * اشتقاقا القراءة الصرفة (`previewSupplierPurchaseEdit` و
 * `previewSupplierPurchasePaymentReversal`) يتبعان حرفيًا نواة مسارات
 * الكتابة (`paidAfterEditFor` و `effectivePaid`) — هذه الاختبارات تُثبت
 * التكافؤ: المعاينة قبل الكتابة تساوي السجل المكتوب بعدها تمامًا، ولا
 * تنسخ الصيغة أبدًا (تستورد الدومين لا تعيد حسابه).
 */
import { describe, expect, it } from "vitest";
import {
  createSupplierPurchase,
  previewSupplierPurchaseEdit,
  previewSupplierPurchasePaymentReversal,
  recordSupplierPurchasePayment,
  reverseSupplierPurchasePayment,
  updateSupplierPurchase,
  type SupplierPurchase,
} from "../../src/domain/supplier-purchase/index.js";

const NOW = "2026-10-12T09:00:00.000Z";

function makePurchase(): SupplierPurchase {
  return createSupplierPurchase({
    id: "purchase-preview",
    supplierName: "محل الأقمشة",
    note: "قماش قطني",
    purchasedOn: "2026-10-01",
    dueOn: "2026-10-20",
    totalMinor: 5000,
    initialPaidMinor: 2000,
    recordedAt: NOW,
    idempotencyKey: "purchase-key-preview",
  });
}

function purchaseWithLaterPayment(): SupplierPurchase {
  return recordSupplierPurchasePayment(makePurchase(), {
    id: "payment-preview-1",
    amountMinor: 1500,
    occurredOn: "2026-10-10",
    recordedAt: NOW,
    idempotencyKey: "payment-key-preview-1",
    note: "دفعة لاحقة",
  });
}

describe("R10-B4/F-021 — previewSupplierPurchaseEdit", () => {
  it("equals the written record: preview before update == paid/payable after update", () => {
    const purchase = purchaseWithLaterPayment();
    const preview = previewSupplierPurchaseEdit(purchase, {
      totalMinor: 6000,
      initialPaidMinor: 2500,
    });
    const written = updateSupplierPurchase(purchase, {
      supplierName: purchase.supplierName,
      note: purchase.note,
      purchasedOn: purchase.purchasedOn,
      dueOn: purchase.dueOn,
      totalMinor: 6000,
      initialPaidMinor: 2500,
      recordedAt: NOW,
      idempotencyKey: "edit-preview-key",
      reason: "تعديل لاختبار المعاينة",
    });
    expect(preview.paidAfterMinor).toBe(written.paidMinor);
    expect(preview.payableAfterMinor).toBe(written.payableMinor);
    /* النواة الحرفية: 2500 أولية + 1500 لاحقة − 0 تراجعات = 4000. */
    expect(preview.paidAfterMinor).toBe(4000);
    expect(preview.payableAfterMinor).toBe(2000);
  });

  it("accounts for later reversals exactly like the write path", () => {
    const purchase = purchaseWithLaterPayment();
    const reversed = reverseSupplierPurchasePayment(purchase, {
      id: "reversal-preview-1",
      paymentId: "payment-preview-1",
      reason: "خطأ في الدفعة",
      occurredOn: "2026-10-11",
      recordedAt: NOW,
      idempotencyKey: "reversal-key-preview-1",
    });
    const preview = previewSupplierPurchaseEdit(reversed, {
      totalMinor: 5000,
      initialPaidMinor: 2000,
    });
    const written = updateSupplierPurchase(reversed, {
      supplierName: reversed.supplierName,
      note: reversed.note,
      purchasedOn: reversed.purchasedOn,
      dueOn: reversed.dueOn,
      totalMinor: 5000,
      initialPaidMinor: 2000,
      recordedAt: NOW,
      idempotencyKey: "edit-preview-key-2",
      reason: "تعديل بعد تراجع",
    });
    expect(preview.paidAfterMinor).toBe(written.paidMinor);
    expect(preview.payableAfterMinor).toBe(written.payableMinor);
    /* 2000 أولية + 1500 لاحقة − 1500 تراجع = 2000. */
    expect(preview.paidAfterMinor).toBe(2000);
  });

  it("is a pure read: the purchase record is not mutated", () => {
    const purchase = makePurchase();
    const before = JSON.stringify(purchase);
    previewSupplierPurchaseEdit(purchase, { totalMinor: 9999, initialPaidMinor: 1 });
    expect(JSON.stringify(purchase)).toBe(before);
  });
});

describe("R10-B4/F-021 — previewSupplierPurchasePaymentReversal", () => {
  it("equals the written record: preview before reversal == paid/payable after reversal", () => {
    const purchase = purchaseWithLaterPayment();
    const payment = purchase.payments.find(candidate => candidate.id === "payment-preview-1");
    if (!payment) throw new Error("test fixture: later payment missing");
    const preview = previewSupplierPurchasePaymentReversal(purchase, payment);
    const written = reverseSupplierPurchasePayment(purchase, {
      id: "reversal-preview-2",
      paymentId: payment.id,
      reason: "اختبار معاينة التراجع",
      occurredOn: "2026-10-11",
      recordedAt: NOW,
      idempotencyKey: "reversal-key-preview-2",
    });
    expect(preview.paidAfterMinor).toBe(written.paidMinor);
    expect(preview.payableAfterMinor).toBe(written.payableMinor);
    /* 2000 + 1500 − 1500 = 2000 مدفوعًا؛ والمستحق 5000 − 2000 = 3000. */
    expect(preview.paidAfterMinor).toBe(2000);
    expect(preview.payableAfterMinor).toBe(3000);
  });

  it("is a pure read: the purchase record is not mutated", () => {
    const purchase = purchaseWithLaterPayment();
    const payment = purchase.payments.find(candidate => candidate.id === "payment-preview-1");
    if (!payment) throw new Error("test fixture: later payment missing");
    const before = JSON.stringify(purchase);
    previewSupplierPurchasePaymentReversal(purchase, payment);
    expect(JSON.stringify(purchase)).toBe(before);
  });
});
