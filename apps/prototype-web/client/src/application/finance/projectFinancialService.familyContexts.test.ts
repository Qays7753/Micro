/** جولة الاستئناف (F-2) ثم EXE-013 (AUD-NEW-15): سياقات العائلات
 * المتخصصة (الأصل/القرض/العربون). قبل الموجة الثانية كان التصحيح العام
 * يجتازها بسياقها؛ قرار المالك في EXE-013 قلب الاتجاه: المسار العام
 * (إلغاء/تعديل/حذف) يرفض أحداث العائلات ويوجه لسطحها القانوني، لأنه يترك
 * سجل العائلة مخالفًا لمجموع أحداثها. الاسترجاع (restoreEvent) يبقى متاحًا
 * للبيانات التاريخية المعكوسة سابقًا — يعيد تسجيل القيم الأصلية حرفيًا. */
import { describe, expect, it } from "vitest";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { createFinancialEvent, createFinancialReversal } from "@micro-domain/financial-event/index.js";

const now = () => "2026-09-05T07:00:00.000Z";

async function saveEvent(store: MemoryLocalStore, input: Parameters<typeof createFinancialEvent>[0]) {
  const saved = await store.saveFinancialEvent(createFinancialEvent(input));
  if (!saved.ok) throw new Error("event should save");
  return saved.value;
}

describe("ProjectFinancialService — سياقات العائلات عبر التصحيح العام (F-2 → EXE-013)", () => {
  it("المسار العام يرفض عكس حدث أصل ويوجه لصفحة الأصل بلا أي كتابة", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const purchase = await saveEvent(store, {
      id: "f2-asset-purchase",
      type: "asset_purchase_cash",
      amountMinor: 35000,
      occurredOn: "2026-09-04",
      recordedAt: now(),
      idempotencyKey: "f2-purchase-key",
      note: "شراء أصل",
      counterparty: null,
      relatedEventId: null,
      assetContext: { assetId: "asset-f2", name: "ماكينة خياطة" },
    });
    const reversed = await finance.reverse({
      sourceEventId: purchase.id,
      occurredOn: "2026-09-05",
      reason: "خطأ في الإدخال",
      idempotencyKey: "f2-reverse-key",
    });
    expect(reversed.ok).toBe(false);
    if (reversed.ok) return;
    expect(reversed.message).toContain("صفحة الأصل");
    /* لم يتغير السجل: الحدث الأصلي وحده موجود. */
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    expect(events.value).toHaveLength(1);
    expect(events.value[0]?.id).toBe(purchase.id);
  });

  it("المسار العام يرفض تعديل حدث قرض ويوجه لصفحة القرض بلا أي كتابة", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const repayment = await saveEvent(store, {
      id: "f2-loan-repay",
      type: "loan_repayment_cash",
      amountMinor: 5000,
      occurredOn: "2026-09-04",
      recordedAt: now(),
      idempotencyKey: "f2-repay-key",
      note: "سداد قرض",
      counterparty: "سامي",
      relatedEventId: null,
      loanContext: { loanId: "loan-f2", borrower: "سامي" },
    });
    const edited = await finance.editEvent({
      sourceEventId: repayment.id,
      amountMinor: 4000,
      occurredOn: "2026-09-04",
      note: "سداد مصحح",
      counterparty: "سامي",
      reason: "المبلغ الصحيح أقل",
      idempotencyKey: "f2-edit-replacement-key",
    });
    expect(edited.ok).toBe(false);
    if (edited.ok) return;
    expect(edited.message).toContain("صفحة القرض");
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    expect(events.value).toHaveLength(1);
  });

  it("الحذف العام (deleteEvent) مرفوض كذلك لأحداث الأصل — نفس الحرس", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const purchase = await saveEvent(store, {
      id: "f2-delete-purchase",
      type: "asset_purchase_cash",
      amountMinor: 9000,
      occurredOn: "2026-09-04",
      recordedAt: now(),
      idempotencyKey: "f2-delete-key",
      note: "شراء أصل للحذف",
      counterparty: null,
      relatedEventId: null,
      assetContext: { assetId: "asset-delete-f2", name: "طاولة" },
    });
    const deleted = await finance.deleteEvent({
      sourceEventId: purchase.id,
      reason: "حذف",
      idempotencyKey: "f2-delete-attempt",
    });
    expect(deleted.ok).toBe(false);
    if (deleted.ok) return;
    expect(deleted.message).toContain("صفحة الأصل");
  });

  it("restoreEvent يعيد حدث أصل معكوسًا تاريخيًا (قبل الحرس) بسياقه حرفيًا", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const purchase = await saveEvent(store, {
      id: "f2-legacy-asset",
      type: "asset_purchase_cash",
      amountMinor: 35000,
      occurredOn: "2026-09-04",
      recordedAt: now(),
      idempotencyKey: "f2-legacy-key",
      note: "شراء أصل تاريخي",
      counterparty: null,
      relatedEventId: null,
      assetContext: { assetId: "asset-legacy-f2", name: "ماكينة خياطة" },
    });
    /* بيانات تاريخية: عكس وقع قبل الحرس — نبني قيد العكس بآلة الدومين نفسها
     * (createFinancialReversal) كما خلفته المسارات القديمة، ثم الاسترجاع
     * يعيد القيم الأصلية بسياقها. */
    const legacyReversal = createFinancialReversal({
      id: "f2-legacy-reversal",
      sourceEvent: purchase,
      occurredOn: "2026-09-05",
      recordedAt: now(),
      idempotencyKey: "f2-legacy-reversal-key",
      reason: "خطأ قديم قبل الحرس",
    });
    const savedReversal = await store.saveFinancialEvent(legacyReversal);
    if (!savedReversal.ok) throw new Error("legacy reversal should save");
    const restored = await finance.restoreEvent({
      sourceEventId: purchase.id,
      idempotencyKey: `restore:${purchase.id}`,
    });
    if (!restored.ok) throw new Error(restored.message);
    expect(restored.value.type).toBe("asset_purchase_cash");
    expect(restored.value.amountMinor).toBe(35000);
    expect(restored.value.assetContext).toEqual({ assetId: "asset-legacy-f2", name: "ماكينة خياطة" });
    expect(restored.value.cashDeltaMinor).toBe(-35000);
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    expect(events.value).toHaveLength(3);
  });

  it("record يكتب حدث عربون مصنّف إيرادًا بسياق القرار مباشرة (بلا حرس — التسجيل ليس تصحيحًا)", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const classified = await finance.record({
      type: "deposit_retained_revenue",
      amountMinor: 1000,
      occurredOn: "2026-09-05",
      note: "عربون بقي بعد إلغاء الطلب",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "f2-deposit-key",
      depositContext: { orderId: "order-f2" },
    });
    if (!classified.ok) throw new Error(classified.message);
    expect(classified.value.depositContext).toEqual({ orderId: "order-f2" });
    expect(classified.value.revenueDeltaMinor).toBe(1000);
  });
});
