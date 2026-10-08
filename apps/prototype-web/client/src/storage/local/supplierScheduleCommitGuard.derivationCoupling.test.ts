import { describe, expect, it } from "vitest";
import { validateSupplierPurchaseCommit } from "./supplierScheduleCommitGuard";
import {
  createSupplierPurchase,
  recordSupplierPurchasePayment,
} from "@micro-domain/supplier-purchase/index.js";
import type { SupplierPurchase } from "@micro-domain/supplier-purchase/index.js";

/*
 * R2 (WS-216/ARCH-007 — بطاقة R2-MF-05): اختبار الاقتران السالب لمرآة حارس
 * التزام شراء المورد — العنصر الذي كانت تفتقده تغطية المرآة.
 *
 * المرآة (supplierScheduleCommitGuard) تعيد داخل معاملة الكتابة اشتقاق
 * `paidMinor`/`payableMinor`/`status` من الدفعات والتراجعات الفعلية — نفس
 * معيّنات المجال (supplier-purchase/policies.ts) — وترفض أي سجل «علاقته
 * الهيكلية سليمة لكن اشتقاقه ملوّث» بـ STALE_MESSAGE الذي تخططه طبقة
 * المخزن إلى code=storage_stale. تغطية adapterConformance كانت تبني السجلات
 * بدوال المجال نفسها (اقتران بنيوي إيجابي فقط)؛ هذا الملف يغذي الحارس
 * اشتقاقات ملوّثة عمدًا فيثبت الجانب السالب بالاسم:
 *
 * سجلًا اشتقاقه سليم (من دوال المجال) يُقبل؛ وكل انحراف بواحد في أي حقل
 * مشتق يُرفض حتى لو تطابقت العلاقة الهيكلية (الدفعة الواحدة الجديدة
 * بمفتاح العملية نفسه).
 */

const TS = "2026-10-07T09:00:00.000Z";

function basePurchase(): SupplierPurchase {
  return createSupplierPurchase({
    id: "sp-coupling",
    supplierName: "مورد الاقتران",
    note: "اختبار اقتران سالب",
    purchasedOn: "2026-10-01",
    totalMinor: 10000,
    initialPaidMinor: 0,
    recordedAt: TS,
    idempotencyKey: "sp-coupling-create-key",
  });
}

function withPayment(base: SupplierPurchase): SupplierPurchase {
  return recordSupplierPurchasePayment(base, {
    id: "sp-coupling:pay-1",
    amountMinor: 4000,
    occurredOn: "2026-10-02",
    recordedAt: TS,
    idempotencyKey: "sp-coupling-pay-1-key",
    note: "دفعة الاقتران",
  });
}

describe("supplier commit guard — derivation coupling (R2-MF-05 negative coupling test)", () => {
  it("accepts a domain-derived payment commit (structural + derivation both consistent)", () => {
    const stored = basePurchase();
    const next = withPayment(stored);
    /* الدفعة الواحدة الجديدة بمفتاح العملية نفسه وكل الدفعات القائمة كما هي. */
    const result = validateSupplierPurchaseCommit(stored, {
      kind: "payment",
      purchase: next,
      idempotencyKey: "sp-coupling-pay-1-key",
    });
    expect(result).toEqual({ ok: true, reused: false });
  });

  it("reuses the same idempotency key instead of double-writing", () => {
    const stored = withPayment(basePurchase());
    const result = validateSupplierPurchaseCommit(stored, {
      kind: "payment",
      purchase: stored,
      idempotencyKey: "sp-coupling-pay-1-key",
    });
    expect(result).toEqual({ ok: true, reused: true });
  });

  it("rejects a corrupted paidMinor (off by one) even with a perfect structural relation", () => {
    const stored = basePurchase();
    const honest = withPayment(stored); /* paidMinor: 4000, payableMinor: 6000, status: partially_paid */
    const corrupted: SupplierPurchase = { ...honest, paidMinor: 4001 };
    const result = validateSupplierPurchaseCommit(stored, {
      kind: "payment",
      purchase: corrupted,
      idempotencyKey: "sp-coupling-pay-1-key",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("لم يُسجَّل شيء");
  });

  it("rejects a corrupted payableMinor inconsistent with totalMinor − paidMinor", () => {
    const stored = basePurchase();
    const honest = withPayment(stored);
    const corrupted: SupplierPurchase = { ...honest, payableMinor: 9999 };
    const result = validateSupplierPurchaseCommit(stored, {
      kind: "payment",
      purchase: corrupted,
      idempotencyKey: "sp-coupling-pay-1-key",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a corrupted status that disagrees with the paid/total state machine", () => {
    const stored = basePurchase();
    const honest = withPayment(stored); /* 4000/10000 => partially_paid */
    const corruptedStatus: SupplierPurchase = { ...honest, status: "paid" };
    const corruptedUnpaid: SupplierPurchase = { ...honest, status: "unpaid" };
    for (const purchase of [corruptedStatus, corruptedUnpaid]) {
      const result = validateSupplierPurchaseCommit(stored, {
        kind: "payment",
        purchase,
        idempotencyKey: "sp-coupling-pay-1-key",
      });
      expect(result.ok).toBe(false);
    }
  });

  it("rejects a corrupted derivation on the revision path too (fail-closed is kind-agnostic)", () => {
    const stored = withPayment(basePurchase());
    /* مراجعة تُبقي العلاقة الهيكلية (لا دفعات جديدة) لكنها تلوّث الاشتقاق. */
    const corrupted: SupplierPurchase = { ...stored, paidMinor: stored.paidMinor + 1 };
    const result = validateSupplierPurchaseCommit(stored, {
      kind: "revision",
      purchase: corrupted,
      idempotencyKey: "sp-coupling-rev-key",
    });
    expect(result.ok).toBe(false);
  });
});
