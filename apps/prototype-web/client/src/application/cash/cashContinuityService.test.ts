import { describe, expect, it } from "vitest";
import { CashContinuityService } from "./cashContinuityService";
import { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

const now = () => "2026-08-23T09:00:00.000Z";
describe("CashContinuityService", () => {
  it("records declared opening cash without treating it as owner capital, expense, or period result", async () => {
    const store = new MemoryLocalStore();
    const cash = new CashContinuityService(store, now);
    const finance = new ProjectFinancialService(store, now);
    const opened = await cash.openWallet({
      name: "درج",
      kind: "cash_drawer",
      openingMinor: 10000,
      occurredOn: "2026-08-01",
      note: "رصيد بداية معلن",
      operationKey: "open-drawer",
    });
    if (!opened.ok) throw new Error("opening should save");
    await expect(
      cash.openWallet({
        name: "درج مكرر",
        kind: "cash_drawer",
        openingMinor: 10000,
        occurredOn: "2026-08-01",
        note: "مكرر",
        operationKey: "open-drawer",
      }),
    ).resolves.toMatchObject({ ok: true, reused: true, value: { wallet: { id: opened.value.wallet.id } } });
    await expect(finance.readPosition()).resolves.toMatchObject({
      ok: true,
      value: {
        recordedCashMinor: 10000,
        walletCashMinor: 10000,
        unallocatedCashMinor: 0,
        ownerCapitalRecordedMinor: 0,
        operatingExpensesRecordedMinor: 0,
      },
    });
    await expect(finance.readRecordedPeriodResult("2026-08-01", "2026-08-31")).resolves.toMatchObject({
      ok: true,
      value: { resultMinor: 0, recordedOperatingExpenseMinor: 0 },
    });
  });

  it("transfers cash between wallets and reverses an adjustment without duplicating the effect", async () => {
    const store = new MemoryLocalStore();
    const cash = new CashContinuityService(store, now);
    const finance = new ProjectFinancialService(store, now);
    const drawer = await cash.openWallet({
      name: "درج",
      kind: "cash_drawer",
      openingMinor: 10000,
      occurredOn: "2026-08-01",
      note: "بداية",
      operationKey: "drawer",
    });
    const bank = await cash.openWallet({
      name: "البنك",
      kind: "bank_account",
      openingMinor: 0,
      occurredOn: "2026-08-01",
      note: "بداية",
      operationKey: "bank",
    });
    if (!drawer.ok || !bank.ok) throw new Error("wallets should save");
    await expect(
      cash.transfer({
        fromWalletId: drawer.value.wallet.id,
        toWalletId: bank.value.wallet.id,
        amountMinor: 3000,
        occurredOn: "2026-08-04",
        note: "إيداع",
        operationKey: "transfer-1",
      }),
    ).resolves.toMatchObject({ ok: true, value: [{ cashDeltaMinor: -3000 }, { cashDeltaMinor: 3000 }] });
    const adjusted = await cash.adjust({
      walletId: drawer.value.wallet.id,
      deltaMinor: -500,
      occurredOn: "2026-08-05",
      note: "فرق جرد",
      reason: "عد نقدي",
      operationKey: "adjustment-1",
    });
    if (!adjusted.ok) throw new Error("adjustment should save");
    await expect(cash.overview()).resolves.toMatchObject({
      ok: true,
      value: {
        totalWalletCashMinor: 9500,
        wallets: [
          { name: "درج", balanceMinor: 6500 },
          { name: "البنك", balanceMinor: 3000 },
        ],
      },
    });
    await expect(
      cash.reverse({
        entryId: adjusted.value.id,
        occurredOn: "2026-08-06",
        reason: "ثبت العد الأول",
        operationKey: "reverse-adjustment-1",
      }),
    ).resolves.toMatchObject({ ok: true, value: [{ cashDeltaMinor: 500 }] });
    await expect(
      cash.reverse({
        entryId: adjusted.value.id,
        occurredOn: "2026-08-06",
        reason: "إعادة",
        operationKey: "reverse-adjustment-1",
      }),
    ).resolves.toMatchObject({ ok: true, reused: true });
    await expect(
      cash.reverse({
        entryId: adjusted.value.id,
        occurredOn: "2026-08-06",
        reason: "محاولة ثانية",
        operationKey: "reverse-adjustment-2",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
    await expect(finance.readPosition()).resolves.toMatchObject({
      ok: true,
      value: {
        recordedCashMinor: 10000,
        walletCashMinor: 10000,
        ownerCapitalRecordedMinor: 0,
        operatingExpensesRecordedMinor: 0,
      },
    });
  });

  it("rejects a negative transfer amount that would silently reverse the transfer direction", async () => {
    const store = new MemoryLocalStore();
    const cash = new CashContinuityService(store, now);
    const drawer = await cash.openWallet({
      name: "درج",
      kind: "cash_drawer",
      openingMinor: 10000,
      occurredOn: "2026-08-01",
      note: "بداية",
      operationKey: "drawer",
    });
    const bank = await cash.openWallet({
      name: "البنك",
      kind: "bank_account",
      openingMinor: 0,
      occurredOn: "2026-08-01",
      note: "بداية",
      operationKey: "bank",
    });
    if (!drawer.ok || !bank.ok) throw new Error("wallets should save");
    await expect(
      cash.transfer({
        fromWalletId: drawer.value.wallet.id,
        toWalletId: bank.value.wallet.id,
        amountMinor: -3000,
        occurredOn: "2026-08-04",
        note: "سالب",
        operationKey: "transfer-negative",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
    await expect(cash.overview()).resolves.toMatchObject({
      ok: true,
      value: { totalWalletCashMinor: 10000 },
    });
  });

  /* D-004: طريق إكمال الرصيد المجهول — حدث موثق لاحقًا يرفع الختم دون إعادة كتابة السجل. */
  it("lifts the unknown-opening stamp via a later documented opening without rewriting prior entries", async () => {
    const store = new MemoryLocalStore();
    const cash = new CashContinuityService(store, now);
    const finance = new ProjectFinancialService(store, now);
    const opened = await cash.openWallet({
      name: "درج مجهول البداية",
      kind: "cash_drawer",
      openingMinor: 0,
      occurredOn: "2026-08-01",
      note: "أنشأت المكان ولا أعرف رصيده",
      operationKey: "d004-open-unknown",
      openingStatus: "unknown",
    });
    if (!opened.ok) throw new Error("wallet should save");
    /* الحالة المجهولة معروضة كمجهولة لا صفرًا. */
    const before = await cash.overview();
    if (!before.ok) throw new Error("overview should read");
    expect(before.value.wallets[0]).toMatchObject({ openingUnknown: true });
    expect(before.value.unknownOpeningCount).toBe(1);
    expect(before.value.totalWalletCashMinor).toBe(0);
    /* الرصيد الموثق لاحقًا بتاريخه وسببه. */
    const documented = await cash.recordOpeningBalanceLater({
      walletId: opened.value.wallet.id,
      amountMinor: 4500,
      occurredOn: "2026-08-20",
      note: "عدّت الدرج صباح ٢٠ أب",
      operationKey: "d004-later-opening",
    });
    expect(documented).toMatchObject({
      ok: true,
      value: { type: "opening_balance", cashDeltaMinor: 4500, occurredOn: "2026-08-20" },
    });
    /* الختم رُفع والرصيد الآن يشمل الافتتاح الموثق. */
    const after = await cash.overview();
    if (!after.ok) throw new Error("overview should read again");
    expect(after.value.wallets[0]).toMatchObject({ openingUnknown: false, balanceMinor: 4500 });
    expect(after.value.unknownOpeningCount).toBe(0);
    expect(after.value.totalWalletCashMinor).toBe(4500);
    /* الكاش ارتفع دون ربح ولا رأس مال. */
    await expect(finance.readPosition()).resolves.toMatchObject({
      ok: true,
      value: {
        recordedCashMinor: 4500,
        walletCashMinor: 4500,
        ownerCapitalRecordedMinor: 0,
        operatingExpensesRecordedMinor: 0,
      },
    });
    await expect(finance.readRecordedPeriodResult("2026-08-01", "2026-08-31")).resolves.toMatchObject({
      ok: true,
      value: { resultMinor: 0 },
    });
    /* لا افتتاح ثانٍ لمحفظة اكتملت معرفتها. */
    await expect(
      cash.recordOpeningBalanceLater({
        walletId: opened.value.wallet.id,
        amountMinor: 100,
        occurredOn: "2026-08-25",
        note: "محاولة ثانية",
        operationKey: "d004-second-opening",
      }),
    ).resolves.toMatchObject({ ok: false, code: "validation_error" });
  });
});
