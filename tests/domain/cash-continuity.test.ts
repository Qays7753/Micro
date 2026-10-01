import { describe, expect, it } from "vitest";
import {
  createCashContinuityEntry,
  createCashWallet,
  summarizeCashContinuity,
  type CreateCashEntryInput,
} from "../../src/domain/cash-continuity/index.js";

describe("cash continuity domain", () => {
  it("keeps an opening balance separate from transfers and requires explicit correction evidence", () => {
    const wallet = createCashWallet({
      id: "drawer",
      name: "درج",
      kind: "cash_drawer",
      createdAt: "2026-08-23T09:00:00.000Z",
      createdOperationKey: "wallet-1",
    });
    const opening = createCashContinuityEntry({
      id: "opening",
      walletId: wallet.id,
      type: "opening_balance",
      occurredOn: "2026-08-01",
      recordedAt: "2026-08-23T09:00:00.000Z",
      cashDeltaMinor: 10000,
      note: "رصيد البداية",
      operationKey: "opening-1",
    });
    const adjustment = createCashContinuityEntry({
      id: "adjustment",
      walletId: wallet.id,
      type: "cash_adjustment",
      occurredOn: "2026-08-02",
      recordedAt: "2026-08-23T09:00:00.000Z",
      cashDeltaMinor: -500,
      note: "فرق جرد",
      reason: "سجلت مبلغًا زائدًا",
      operationKey: "adjustment-1",
    });
    expect(summarizeCashContinuity([opening, adjustment])).toBe(9500);
    expect(() =>
      createCashContinuityEntry({
        id: "bad",
        walletId: wallet.id,
        type: "opening_balance",
        occurredOn: "2026-08-01",
        recordedAt: "2026-08-23T09:00:00.000Z",
        cashDeltaMinor: -1,
        note: "خطأ",
        operationKey: "bad-opening",
      }),
    ).toThrow("رصيد الافتتاح لا يمكن أن يكون سالبًا.");
    expect(() =>
      createCashContinuityEntry({
        id: "bad-adjustment",
        walletId: wallet.id,
        type: "cash_adjustment",
        occurredOn: "2026-08-02",
        recordedAt: "2026-08-23T09:00:00.000Z",
        cashDeltaMinor: 1,
        note: "فرق",
        operationKey: "bad-adjustment",
      }),
    ).toThrow("تسوية الكاش تتطلب سببًا موثقًا.");
  });
});

/* --- مدموج من cash-allocation.test.ts وcash-continuity-source-ref.test.ts (2026-10-02، WS-208/موجة C):
 *     المحتوى حرفي بلا تعديل — الأصول في تاريخ git. --- */

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

describe("cash continuity allocation entries", () => {
  const base = {
    id: "entry-1",
    walletId: "wallet-1",
    occurredOn: "2026-08-31",
    recordedAt: "2026-08-31T10:00:00.000Z",
    note: "تخصيص قبض بيع",
    operationKey: "op-1",
  };
  it("creates a positive allocation from unallocated cash into a wallet", () => {
    const entry = createCashContinuityEntry({ ...base, type: "allocation", cashDeltaMinor: 3500 });
    expect(entry.type).toBe("allocation");
    expect(entry.cashDeltaMinor).toBe(3500);
    expect(entry.transferId).toBeNull();
    expect(entry.reversesEntryId).toBeNull();
  });
  it("creates a negative allocation covering an attributed payment from a wallet", () => {
    const entry = createCashContinuityEntry({ ...base, type: "allocation", cashDeltaMinor: -2000 });
    expect(entry.cashDeltaMinor).toBe(-2000);
  });
  it("rejects an allocation disguised as a transfer or a reversal", () => {
    expect(() =>
      createCashContinuityEntry({
        ...base,
        type: "allocation",
        cashDeltaMinor: 100,
        transferId: "transfer-1",
      }),
    ).toThrowError("حركة التخصيص ليست تحويلًا بين محفظتين.");
    expect(() =>
      createCashContinuityEntry({
        ...base,
        type: "allocation",
        cashDeltaMinor: 100,
        reversesEntryId: "entry-0",
      }),
    ).toThrowError("حركة التخصيص ليست تراجعًا.");
  });
});

describe("cash continuity wallet opening status", () => {
  it("keeps wallet opening status optional and preserves it through the factory", () => {
    const wallet = createCashWallet({
      id: "wallet-1",
      name: "الدرج",
      kind: "cash_drawer",
      createdAt: "2026-08-31T09:00:00.000Z",
      createdOperationKey: "op-wallet",
    });
    expect(wallet.openingStatus).toBeUndefined();
  });
  it("stamps an unknown opening wallet explicitly instead of defaulting to zero", () => {
    const wallet = createCashWallet({
      id: "wallet-2",
      name: "الدرج",
      kind: "cash_drawer",
      createdAt: "2026-08-31T09:00:00.000Z",
      createdOperationKey: "op-wallet-2",
      openingStatus: "unknown",
    });
    expect(wallet.openingStatus).toBe("unknown");
  });
  it("counts allocation entries inside the wallet balance summary", () => {
    const base = {
      id: "entry-1",
      walletId: "wallet-1",
      occurredOn: "2026-08-31",
      recordedAt: "2026-08-31T10:00:00.000Z",
      note: "تخصيص",
      operationKey: "op-1",
    };
    const entries = [
      createCashContinuityEntry({ ...base, type: "allocation", cashDeltaMinor: 3500 }),
      createCashContinuityEntry({
        ...base,
        id: "entry-2",
        type: "allocation",
        cashDeltaMinor: -2000,
        operationKey: "op-2",
      }),
    ];
    expect(summarizeCashContinuity(entries)).toBe(1500);
  });
});

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

describe("سطر المصدر في حركة التخصيص (المجموعة ٦ — S2-04أ)", () => {
  it("يقبل سطر المصدر مع المصدر نفسه في حركة التخصيص", () => {
    const entry = createCashContinuityEntry(
      baseInput({ sourceRefId: "order-1", sourceRefKind: "order", sourceRefLineId: "order-1:sheet-1" }),
    );
    expect(entry.sourceRefLineId).toBe("order-1:sheet-1");
  });

  it("يبقى سطر المصدر غائبًا عند عدم إرساله — السجلات القديمة تُقرأ كما هي", () => {
    const entry = createCashContinuityEntry(baseInput({ sourceRefId: "order-1", sourceRefKind: "order" }));
    expect("sourceRefLineId" in entry).toBe(false);
  });

  it("يرفض سطر المصدر في غير حركات التخصيص", () => {
    /* مع المصدر نفسه: حارس «ربط المصدر» يسبق حارس سطر المصدر — والرفض مضمون. */
    expect(() =>
      createCashContinuityEntry(
        baseInput({
          type: "cash_adjustment",
          reason: "تسوية",
          sourceRefId: "order-1",
          sourceRefKind: "order",
          sourceRefLineId: "order-1:sheet-1",
        }),
      ),
    ).toThrow("حركات التخصيص فقط");
    /* وبمصدر كامل لكن حركة غير تخصيص مع سطر فقط: نفس العائلة تُرفض. */
    expect(() =>
      createCashContinuityEntry(
        baseInput({
          type: "cash_adjustment",
          reason: "تسوية",
          sourceRefId: "order-1",
          sourceRefKind: "order",
          sourceRefLineId: "order-1:sheet-1",
        }),
      ),
    ).toThrow();
  });

  it("يرفض سطر مصدر بلا سجل مصدر", () => {
    expect(() => createCashContinuityEntry(baseInput({ sourceRefLineId: "order-1:sheet-1" }))).toThrow(
      "ربط سطر المصدر يتطلب سجل المصدر نفسه",
    );
  });
});
