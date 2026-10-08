import { describe, expect, it } from "vitest";
import { resolveSupplierPaymentAttribution } from "./supplierAttributionCommitGuard";
import {
  createSupplierPurchase,
  recordSupplierPurchasePayment,
} from "@micro-domain/supplier-purchase/index.js";
import type { CashContinuityEntry } from "@micro-domain/cash-continuity/index.js";

/* R4-A3 (إغلاق R3-N3 — التزام موثق في بطاقات R3): اختبار وحدة مباشر لحارس
 * تخصيص دفعة المورد (G-002). الحارس نقي مشترك بين المحوّلين يُحل داخل معاملة
 * الالتزام الواحدة — الاختبار يثبت قراراته الثلاثة من الحقيقة المخزّنة:
 * existing (القيد موجود بمفتاحه يُعاد كما هو)، write (الناقص يُشتق من الدفعة
 * المخزّنة: المحفظة والمبلغ والتاريخ والمصدر)، skip (لا محفظة أو لا دفعة
 * أو لا تخصيص أصلًا) — فلا تكرار خصم بمفتاحين ولا دفعة بلا قيد تغطية. */

const AT = "2026-10-08T08:00:00.000Z";

function makePurchase(withInitialPayment: boolean) {
  return createSupplierPurchase({
    id: "purchase-1",
    supplierName: "مورد الأقمشة",
    note: "شراء شهري",
    purchasedOn: "2026-09-01",
    dueOn: null,
    totalMinor: 50_000,
    initialPaidMinor: withInitialPayment ? 20_000 : 0,
    initialPaymentWalletId: withInitialPayment ? "wallet-1" : null,
    idempotencyKey: "op-purchase-1",
    recordedAt: AT,
    materialId: null,
    expectedQuantityMilli: null,
  });
}

function attributionEntry(overrides: Partial<CashContinuityEntry> = {}): CashContinuityEntry {
  return {
    id: "cash-1",
    walletId: "wallet-1",
    type: "allocation",
    occurredOn: "2026-09-01",
    recordedAt: AT,
    cashDeltaMinor: -20_000,
    note: "تغطية دفعة مورد",
    reason: null,
    operationKey: "op-purchase-1:initial",
    transferId: null,
    reversesEntryId: null,
    sourceRefId: "purchase-1",
    sourceRefKind: "supplier_purchase",
    ...overrides,
  };
}

describe("R4-A3 — حل تخصيص دفعة المورد داخل معاملة الالتزام (resolveSupplierPaymentAttribution)", () => {
  it("لا تخصيص أصلًا (attribution null) = تخطٍّ صادق — الدفعة تبقى في غير الموزع", () => {
    const purchase = makePurchase(true);
    const result = resolveSupplierPaymentAttribution({
      kind: "create",
      idempotencyKey: "op-purchase-1",
      attribution: null,
      purchase,
      storedEntries: [],
    });
    expect(result).toEqual({ action: "skip" });
  });

  it("القيد موجود بمفتاحه = إعادة كما هو (اكتمال إعادة الإرسال — لا خصم ثانٍ)", () => {
    const purchase = makePurchase(true);
    const existing = attributionEntry();
    const fresh = attributionEntry({ id: "cash-fresh" });
    const result = resolveSupplierPaymentAttribution({
      kind: "create",
      idempotencyKey: "op-purchase-1",
      attribution: fresh,
      purchase,
      storedEntries: [existing],
    });
    expect(result).toEqual({ action: "existing", entry: existing });
  });

  it("الناقص يُشتق من الدفعة الأولية المخزّنة (create): المبلغ والمحفظة والتاريخ والمصدر حرفيًا", () => {
    const purchase = makePurchase(true);
    const candidate = attributionEntry({
      walletId: "wallet-wrong",
      cashDeltaMinor: -1,
      occurredOn: "2000-01-01",
    });
    const result = resolveSupplierPaymentAttribution({
      kind: "create",
      idempotencyKey: "op-purchase-1",
      attribution: candidate,
      purchase,
      storedEntries: [],
    });
    expect(result).toEqual({
      action: "write",
      entry: {
        ...candidate,
        walletId: "wallet-1",
        cashDeltaMinor: -20_000,
        occurredOn: "2026-09-01",
        sourceRefId: "purchase-1",
        sourceRefKind: "supplier_purchase",
      },
    });
  });

  it("دفعة لاحقة (payment): الاشتقاق من الدفعة ذات مفتاح الحتمية لا من الأولية", () => {
    const purchase = makePurchase(false);
    const withLater = recordSupplierPurchasePayment(purchase, {
      id: "payment-later",
      amountMinor: 10_000,
      occurredOn: "2026-09-10",
      recordedAt: AT,
      idempotencyKey: "op-purchase-1:pay-2",
      note: "دفعة لاحقة",
      walletId: "wallet-2",
    });
    const candidate = attributionEntry({ operationKey: "op-purchase-1:pay-2" });
    const result = resolveSupplierPaymentAttribution({
      kind: "payment",
      idempotencyKey: "op-purchase-1:pay-2",
      attribution: candidate,
      purchase: withLater,
      storedEntries: [],
    });
    expect(result).toEqual({
      action: "write",
      entry: {
        ...candidate,
        walletId: "wallet-2",
        cashDeltaMinor: -10_000,
        occurredOn: "2026-09-10",
        sourceRefId: "purchase-1",
        sourceRefKind: "supplier_purchase",
      },
    });
  });

  it("الدفعة المرجعية غير موجودة (مسار مكسور) = تخطٍّ لا اشتقاق مخترع", () => {
    const purchase = makePurchase(false);
    const candidate = attributionEntry();
    const result = resolveSupplierPaymentAttribution({
      kind: "create",
      idempotencyKey: "op-purchase-1",
      attribution: candidate,
      purchase,
      storedEntries: [],
    });
    expect(result).toEqual({ action: "skip" });
  });

  it("الدفعة بلا محفظة = تخطٍّ صادق (تبقى في غير الموزع، لا سياسة تُخترع)", () => {
    const purchase = makePurchase(true);
    const bare = { ...purchase, payments: purchase.payments.map(p => ({ ...p, walletId: null })) };
    const candidate = attributionEntry();
    const result = resolveSupplierPaymentAttribution({
      kind: "create",
      idempotencyKey: "op-purchase-1",
      attribution: candidate,
      purchase: bare,
      storedEntries: [],
    });
    expect(result).toEqual({ action: "skip" });
  });
});
