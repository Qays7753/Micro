/** المجموعة ٢ (§9.1): دفتر المحفظة — الرصيد والصفوف ووصل المصدر والتراجعات. */
import { describe, expect, it } from "vitest";
import { WalletLedgerService } from "./walletLedgerService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import {
  createCashContinuityEntry,
  createCashWallet,
} from "@micro-domain/cash-continuity/index.js";

const now = () => "2026-09-02T10:00:00.000Z";

async function seedWallet(store: MemoryLocalStore) {
  const wallet = createCashWallet({
    id: "drawer-1",
    name: "درج المحل",
    kind: "cash_drawer",
    createdAt: "2026-09-01T08:00:00Z",
    createdOperationKey: "open-key",
  });
  const entries = [
    createCashContinuityEntry({
      id: "opening-1",
      walletId: wallet.id,
      type: "opening_balance",
      occurredOn: "2026-09-01",
      recordedAt: "2026-09-01T08:05:00Z",
      cashDeltaMinor: 5000,
      note: "رصيد بداية",
      operationKey: "open-key",
    }),
    createCashContinuityEntry({
      id: "allocation-1",
      walletId: wallet.id,
      type: "allocation",
      occurredOn: "2026-09-02",
      recordedAt: "2026-09-02T09:00:00Z",
      cashDeltaMinor: 1500,
      note: "تخصيص قبض بيع",
      operationKey: "alloc-1",
      sourceRefId: "sale-9",
      sourceRefKind: "sale",
    }),
    createCashContinuityEntry({
      id: "allocation-cover-1",
      walletId: wallet.id,
      type: "allocation",
      occurredOn: "2026-09-02",
      recordedAt: "2026-09-02T09:30:00Z",
      cashDeltaMinor: -700,
      note: "تغطية صرف",
      operationKey: "alloc-2",
    }),
    createCashContinuityEntry({
      id: "reversal-1",
      walletId: wallet.id,
      type: "reversal",
      occurredOn: "2026-09-02",
      recordedAt: "2026-09-02T10:00:00Z",
      cashDeltaMinor: -1500,
      note: "تراجع: تخصيص قبض بيع",
      reason: "سُجل مرتين",
      operationKey: "rev-1",
      reversesEntryId: "allocation-1",
    }),
  ];
  const committed = await store.commitCashContinuity(wallet, entries);
  if (!committed.ok) throw new Error("seed should commit");
  return wallet;
}

describe("WalletLedgerService — دفتر المحفظة (المجموعة ٢ §9.1)", () => {
  it("يعرض الرصيد والصفوف بالتسلسل الزمني الأحدث أولًا مع وصل المصدر", async () => {
    const store = new MemoryLocalStore();
    await seedWallet(store);
    const ledger = new WalletLedgerService(store);
    const result = await ledger.read("drawer-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { overview } = result;
    expect(overview.wallet.name).toBe("درج المحل");
    /* 5000 + 1500 − 700 − 1500 = 4300. */
    expect(overview.balanceMinor).toBe(4300);
    expect(overview.entryCount).toBe(4);
    /* الأحدث أولًا: التراجع، ثم التغطية، ثم التخصيص، ثم الافتتاح. */
    expect(overview.rows[0]?.kind).toBe("reversal");
    expect(overview.rows[1]?.kind).toBe("allocation_cover");
    expect(overview.rows[2]?.kind).toBe("allocation_in");
    expect(overview.rows[3]?.kind).toBe("opening");
    /* وصل المصدر يظهر حيث وُجد وبلا قيمة حيث لم يوجد. */
    expect(overview.rows[2]?.sourceHref).toBe("/direct-sales/sale-9");
    expect(overview.rows[2]?.sourceLabel).toContain("بيع مباشر");
    expect(overview.rows[1]?.sourceHref).toBeNull();
    /* القيد المرتد عنه لا يعرض تراجعًا ثانيًا؛ الافتتاح لا يُتراجع من الدفتر. */
    expect(overview.rows.find(row => row.id === "allocation-1")?.reversible).toBe(false);
    expect(overview.rows.find(row => row.id === "opening-1")?.reversible).toBe(false);
    /* التغطية قابلة للتراجع الموثق من دفتر المحفظة. */
    expect(overview.rows.find(row => row.id === "allocation-cover-1")?.reversible).toBe(true);
  });

  it("يرفض محفظة غير موجودة برسالة صادقة", async () => {
    const store = new MemoryLocalStore();
    const ledger = new WalletLedgerService(store);
    const result = await ledger.read("missing");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("لم تُعثر");
  });

  it("المحفظة المجهولة الافتتاح تُختم بصدق لا بصفر مختلق", async () => {
    const store = new MemoryLocalStore();
    const wallet = createCashWallet({
      id: "wallet-unknown",
      name: "محفظة بلا رصيد معروف",
      kind: "other",
      createdAt: "2026-09-01T08:00:00Z",
      createdOperationKey: "unknown-open-key",
      openingStatus: "unknown",
    });
    const committed = await store.commitCashContinuity(wallet, []);
    if (!committed.ok) throw new Error("should commit");
    const ledger = new WalletLedgerService(store);
    const result = await ledger.read("wallet-unknown");
    expect(result.ok && result.value.openingUnknown).toBe(true);
    expect(result.ok && result.value.balanceMinor).toBe(0);
  });
});
