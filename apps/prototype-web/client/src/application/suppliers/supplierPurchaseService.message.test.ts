import { describe, expect, it } from "vitest";
import { SupplierPurchaseService } from "./supplierPurchaseService";
import { formatMoneyWithUnit } from "@/application/formatting/formatters";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

/*
 * R2 (WS-216/ARCH-007 — M-07/D10، 2026-10-08): ذهبية رسالة التحقق المالية.
 * كانت القسمة الخام `${minor / 100} د.أ` تنتج «10.5» بلا منزلتين ولا فواصل؛
 * الآن المعيّن الكنوني formatMoneyWithUnit («10.50 د.أ» بالفواصل) — تغيير
 * نص رسالة مقصوم message-only (لا مستهلك تشغيلي يتفرع على النص — جرد
 * R2-MF-01 §7). هذا الاختبار يثبّت الصيغة الجديدة كعقد ذهبي.
 */

const FIXED_NOW = "2026-10-07T10:00:00.000Z";

async function seededPurchaseWithReceipt() {
  const store = new MemoryLocalStore();
  const service = new SupplierPurchaseService(store, () => FIXED_NOW);
  const created = await service.recordPurchase({
    supplierName: "مورد الاختبار",
    note: "اختبار الرسالة",
    purchasedOn: "2026-10-01",
    dueOn: null,
    totalMinor: 10000,
    initialPaidMinor: 0,
    idempotencyKey: "msg-test-create",
    materialId: null,
    expectedQuantityMilli: null,
  });
  if (!created.ok) return { store, service, created };
  /* إيصال استلام موثق للحركة: 1050 minor مستلمة فعلًا (المسار الذي يفحص
   * receivedValueMinor — حركات purchase_receipt لا الدفعات). */
  const snapshot = await store.readSnapshot();
  if (!snapshot.ok) return { store, service, created };
  await store.replaceSnapshot({
    ...snapshot.value,
    inventoryMovements: [
      ...snapshot.value.inventoryMovements,
      {
        id: "movement-msg-test",
        materialId: "material-msg-test",
        type: "purchase_receipt",
        occurredOn: "2026-10-02",
        recordedAt: FIXED_NOW,
        quantityDeltaMilli: 1000,
        valueDeltaMinor: 1050,
        note: "استلام موثق",
        reason: null,
        purchaseId: created.value.id,
        costKnowledge: "known",
        reversalOfId: null,
        reversesMovementId: null,
      },
    ],
  });
  return { store, service, created };
}

describe("R2 regression — supplier purchase money message uses the canonical formatter (M-07/D10)", () => {
  it("rejects a total below a documented received value with the canonical formatted amount", async () => {
    const { service, created } = await seededPurchaseWithReceipt();
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    /* استلام موثق بقيمة 1050 minor («10.50 د.أ» كنونيًا — كانت «10.5»). */
    const received = await service.recordPayment({
      purchaseId: created.value.id,
      amountMinor: 1050,
      occurredOn: "2026-10-02",
      note: "دفعة موثقة",
      idempotencyKey: "msg-test-payment",
      walletId: null,
    });
    expect(received.ok).toBe(true);
    const rejected = await service.editPurchase({
      purchaseId: created.value.id,
      supplierName: "مورد الاختبار",
      note: "إجمالي أدنى من المستلم",
      purchasedOn: "2026-10-01",
      dueOn: null,
      totalMinor: 500,
      initialPaidMinor: 0,
      reason: "محاولة خفض الإجمالي دون المستلم",
      idempotencyKey: "msg-test-edit",
    });
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) {
      expect(rejected.code).toBe("validation_error");
      expect(rejected.message).toContain(`(${formatMoneyWithUnit(1050)})`);
      expect(rejected.message).toContain("(10.50 د.أ)");
      expect(rejected.message).not.toContain("(10.5 د.أ)");
    }
  });
});
