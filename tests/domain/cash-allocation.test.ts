import { describe, expect, it } from "vitest";
import {
  createCashContinuityEntry,
  createCashWallet,
  summarizeCashContinuity,
} from "../../src/domain/cash-continuity/index.js";

/* عقد التخصيص (PA-002): توزيع صريح من الكاش غير الموزع إلى محفظة أو تغطية صرف منها.
 * الإجمالي المسجل لا يتغير — تنتقل القيمة بين «غير الموزع» والمحفظة فقط. */
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
