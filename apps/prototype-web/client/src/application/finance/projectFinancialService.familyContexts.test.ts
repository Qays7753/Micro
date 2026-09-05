/** جولة الاستئناف (F-2): التصحيح العام عبر سجل الأحداث يجب أن يجتاز سياقات
 * العائلات المتخصصة (الأصل/القرض/العربون) كما يجتاز سياق المصروف — الاسترجاع
 * يعيد القيم الأصلية نسخة طبق الأصل، والتعديل يحمل السياق إلى البديل. قبل
 * الإصلاح كان createFinancialEvent يرفض الحدث لأن السياق لا يُمرَّر، فيفشل
 * الاسترجاع/التعديل بلا كتابة على عائلات المجموعة ٤ كاملة. */
import { describe, expect, it } from "vitest";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";

const now = () => "2026-09-05T07:00:00.000Z";

async function saveEvent(
  store: MemoryLocalStore,
  input: Parameters<typeof createFinancialEvent>[0],
) {
  const saved = await store.saveFinancialEvent(createFinancialEvent(input));
  if (!saved.ok) throw new Error("event should save");
  return saved.value;
}

describe("ProjectFinancialService — سياقات العائلات عبر التصحيح العام (F-2)", () => {
  it("restoreEvent يعيد حدث شراء أصل معكوسًا بنجاح وسياقه باقٍ حرفيًا", async () => {
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
    if (!reversed.ok) throw new Error(reversed.message);
    const restored = await finance.restoreEvent({
      sourceEventId: purchase.id,
      idempotencyKey: `restore:${purchase.id}`,
    });
    if (!restored.ok) throw new Error(restored.message);
    expect(restored.value.type).toBe("asset_purchase_cash");
    expect(restored.value.amountMinor).toBe(35000);
    expect(restored.value.assetContext).toEqual({ assetId: "asset-f2", name: "ماكينة خياطة" });
    expect(restored.value.cashDeltaMinor).toBe(-35000);
    /* الأصل المعكوس + الاسترجاع: صافي الكاش صفر — التاريخ محفوظ ولا محو. */
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    expect(events.value).toHaveLength(3);
  });

  it("restoreEvent يعيد سداد قرض معكوسًا بسياق القرض والشفيع كما هو", async () => {
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
    const reversed = await finance.reverse({
      sourceEventId: repayment.id,
      occurredOn: "2026-09-05",
      reason: "سُجّل مرتين بالخطأ",
      idempotencyKey: "f2-repay-reverse-key",
    });
    if (!reversed.ok) throw new Error(reversed.message);
    const restored = await finance.restoreEvent({
      sourceEventId: repayment.id,
      idempotencyKey: `restore:${repayment.id}`,
    });
    if (!restored.ok) throw new Error(restored.message);
    expect(restored.value.loanContext).toEqual({ loanId: "loan-f2", borrower: "سامي" });
    expect(restored.value.counterparty).toBe("سامي");
  });

  it("editEvent يمرر سياق الأصل إلى البديل والتراجع معًا", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const purchase = await saveEvent(store, {
      id: "f2-edit-purchase",
      type: "asset_purchase_cash",
      amountMinor: 20000,
      occurredOn: "2026-09-04",
      recordedAt: now(),
      idempotencyKey: "f2-edit-key",
      note: "شراء أولي",
      counterparty: null,
      relatedEventId: null,
      assetContext: { assetId: "asset-edit-f2", name: "كمبيوتر" },
    });
    const edited = await finance.editEvent({
      sourceEventId: purchase.id,
      amountMinor: 24000,
      occurredOn: "2026-09-04",
      note: "شراء مصحح — الشحن داخل السعر",
      counterparty: null,
      reason: "المبلغ الصحيح يشمل الشحن",
      idempotencyKey: "f2-edit-replacement-key",
    });
    if (!edited.ok) throw new Error(edited.message);
    expect(edited.value.assetContext).toEqual({ assetId: "asset-edit-f2", name: "كمبيوتر" });
    expect(edited.value.amountMinor).toBe(24000);
    expect(edited.value.cashDeltaMinor).toBe(-24000);
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    const reversal = events.value.find(
      event => event.correctionType === "reverse" && event.correctionOfEventId === purchase.id,
    );
    expect(reversal?.assetContext).toEqual({ assetId: "asset-edit-f2", name: "كمبيوتر" });
  });

  it("record يكتب حدث عربون مصنّف إيرادًا بسياق القرار مباشرة", async () => {
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
