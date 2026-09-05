/** المجموعة ٥ (عقد ٣٣ — اختبار المشاركة اليدوية): نصوص من السجل بلا تفاصيل
 * خاصة (لا هامش ولا تكلفة)، وتطبيع رقم أردني، وكشف موجز صادق (غير متاح
 * عندما تمنع النتيجةَ بياناتٌ ناقصة). */
import { describe, expect, it } from "vitest";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import {
  collectionShareDraft,
  deliveryShareDraft,
  normalizeJordanianPhone,
  orderShareDraft,
  reminderShareDraft,
  statementShareDraft,
} from "./shareMessageService";

const NOW = "2026-09-05T09:00:00.000Z";

function buildStored() {
  const cost = calculateCostSnapshot("cost-1", {
    currency: "JOD",
    materialItems: [],
    time: { minutes: 30, hourlyRateMinor: 300, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: NOW,
    freshnessDays: null,
  });
  const order = {
    ...createCraftOrder({
      id: "order-1",
      customerName: "أم خالد",
      itemName: "شماغ مطرّز",
      specifications: "خيط أبيض",
      quantity: 1,
      agreedPriceMinor: 15000,
      costSnapshot: cost,
      createdAt: NOW,
    }),
    depositCollectedMinor: 3000,
    collectedMinor: 5000,
    receivableMinor: 10000,
    status: "in_progress" as const,
    settlementStatus: "partial" as const,
  };
  return {
    id: "order-1",
    order,
    catalogItemId: null,
    deliveryDate: "2026-09-10",
    agreementSource: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe("share message service (المجموعة ٥ — عقد ٣٣)", () => {
  it("order draft: price, deposit, remaining, delivery date — no cost or margin leaks", () => {
    const draft = orderShareDraft(buildStored());
    expect(draft.body).toContain("150.00 د.أ");
    expect(draft.body).toContain("30.00 د.أ");
    expect(draft.body).toContain("10/09/2026");
    expect(draft.body).not.toContain("هامش");
    expect(draft.body).not.toContain("ربح");
    /* التكلفة الجاهزة موجودة في السجل ولا تظهر في نص الزبون أبدًا. */
    expect(draft.body).not.toContain("3.30");
  });

  it("collection and reminder drafts state amounts and remaining only", () => {
    const stored = buildStored();
    const collection = collectionShareDraft(stored, 2000, "2026-09-01");
    expect(collection.body).toContain("20.00 د.أ");
    expect(collection.body).toContain("100.00 د.أ");
    const reminder = reminderShareDraft(stored, 10000, "2026-09-15");
    expect(reminder.body).toContain("100.00 د.أ");
    expect(reminder.body).toContain("15/09/2026");
  });

  it("delivery draft tells the truth: remaining due or fully settled", () => {
    const stored = buildStored();
    const withDue = deliveryShareDraft(stored);
    expect(withDue.body).toContain("100.00 د.أ");
    const settled = {
      ...stored,
      order: { ...stored.order, receivableMinor: 0 },
    };
    const closed = deliveryShareDraft(settled);
    expect(closed.body).toContain("حُسم كامل المبلغ");
  });

  it("statement draft: unavailable result stays «غير متاحة» — never a fake profit", () => {
    const unavailable = statementShareDraft({ from: "2026-09-01", to: "2026-09-05", cashNetMinor: 12000, resultMinor: null });
    expect(unavailable.body).toContain("غير متاحة");
    expect(unavailable.body).toContain("120.00 د.أ");
    const available = statementShareDraft({ from: "2026-09-01", to: "2026-09-05", cashNetMinor: 12000, resultMinor: 3000 });
    expect(available.body).toContain("30.00 د.أ");
  });

  it("normalizes Jordanian phone formats safely; foreign numbers pass through", () => {
    expect(normalizeJordanianPhone("0791234567")).toBe("+962791234567");
    expect(normalizeJordanianPhone("798765432")).toBe("+962798765432");
    expect(normalizeJordanianPhone("+962771234567")).toBe("+962771234567");
    expect(normalizeJordanianPhone("962791234567")).toBe("+962791234567");
    expect(normalizeJordanianPhone("+14155550123")).toBe("+14155550123");
  });
});
