import { describe, expect, it } from "vitest";
import {
  createCashContinuityEntry,
  type CreateCashEntryInput,
} from "../../src/domain/cash-continuity/index.js";

function baseInput(overrides: Partial<CreateCashEntryInput> = {}): CreateCashEntryInput {
  return {
    id: "entry-1",
    walletId: "wallet-1",
    type: "allocation",
    occurredOn: "2026-09-02",
    recordedAt: "2026-09-02T09:00:00Z",
    cashDeltaMinor: 2500,
    note: "تخصيص كاش غير موزع إلى محفظة",
    operationKey: "op-1",
    ...overrides,
  };
}

describe("مصدر التخصيص في سجل المحفظة (المجموعة ٢ §9.1)", () => {
  it("يقبل مصدرًا معلومًا مع نوعه في حركة التخصيص", () => {
    const entry = createCashContinuityEntry(baseInput({ sourceRefId: "sale-1", sourceRefKind: "sale" }));
    expect(entry.sourceRefId).toBe("sale-1");
    expect(entry.sourceRefKind).toBe("sale");
  });

  it("يبقى الحقل غائبًا عند عدم إرسال مصدر — السجلات القديمة تُقرأ كما هي", () => {
    const entry = createCashContinuityEntry(baseInput());
    expect("sourceRefId" in entry).toBe(false);
    expect("sourceRefKind" in entry).toBe(false);
  });

  it("يرفض المصدر في غير حركات التخصيص", () => {
    expect(() =>
      createCashContinuityEntry(
        baseInput({
          type: "cash_adjustment",
          reason: "تسوية",
          sourceRefId: "sale-1",
          sourceRefKind: "sale",
        }),
      ),
    ).toThrow("ربط المصدر يخص حركات التخصيص فقط");
  });

  it("يرفض معرف مصدر بلا نوع ونوعًا بلا معرف", () => {
    expect(() => createCashContinuityEntry(baseInput({ sourceRefId: "sale-1" }))).toThrow(
      "يتطلب نوع السجل المصدر",
    );
    expect(() => createCashContinuityEntry(baseInput({ sourceRefKind: "sale" }))).toThrow(
      "نوع المصدر بلا سجل مصدر",
    );
  });
});
