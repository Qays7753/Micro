import { describe, expect, it } from "vitest";
import { evaluateWithdrawalWalletCoverage } from "./withdrawalWalletGuard";
import { OwnerEntitlementService } from "./ownerEntitlementService";
import { ProjectFinancialService } from "./projectFinancialService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import {
  createCashContinuityEntry,
  createCashWallet,
  type CashWallet,
} from "@micro-domain/cash-continuity/index.js";

/* G-006 (تدقيق الإدارة المالية المتدرجة ٢٠٢٦-٠٩-١٩): توحيد حرس سحب المالك —
 * سياسة كنونية واحدة لمساري الدفتر والحدث: تحقق المبلغ فوجود المحفظة فتغطية
 * الرصيد برسالة تعرض المتاح والمطلوب؛ رصيد لا يغطي = لا كتابة جزئية ولا حدث
 * ولا حركة؛ السحب ليس مصروفًا ولا يدخل نتيجة الفترة أبدًا. */

const now = () => "2026-09-20T09:00:00.000Z";

const wallet = (id: string, name: string): CashWallet =>
  createCashWallet({
    id,
    name,
    kind: "cash_drawer",
    createdAt: "2026-09-01T08:00:00.000Z",
    createdOperationKey: `open-${id}`,
  });

function entries(walletId: string, openingMinor: number) {
  return [
    createCashContinuityEntry({
      id: `opening-${walletId}`,
      walletId,
      type: "opening_balance",
      occurredOn: "2026-09-01",
      recordedAt: "2026-09-01T08:00:00.000Z",
      cashDeltaMinor: openingMinor,
      note: "افتتاح",
      operationKey: `opening-${walletId}`,
    }),
  ];
}

async function ledgerService(store: MemoryLocalStore) {
  const projectFinance = new ProjectFinancialService(store, () => now());
  const service = new OwnerEntitlementService(
    store,
    async () => ({ ok: true as const, value: { resultMinor: 0, status: "recorded_only" as const } }),
    () => now(),
  );
  void projectFinance;
  return service;
}

async function openSeededWallet(store: MemoryLocalStore, id: string, openingMinor: number) {
  const cash = new CashContinuityService(store, () => now());
  const opened = await cash.openWallet({
    name: `محفظة-${id}`,
    kind: "cash_drawer",
    openingMinor,
    occurredOn: "2026-09-01",
    note: "رصيد بداية",
    operationKey: `g006-open-${id}`,
  });
  if (!opened.ok) throw new Error(opened.message);
  const overview = await cash.overview();
  if (!overview.ok) throw new Error("overview failed");
  return overview.value.wallets.find(candidate => candidate.name === `محفظة-${id}`)!;
}

async function walletBalanceMinor(store: MemoryLocalStore, walletId: string) {
  const entriesResult = await store.listCashContinuityEntries();
  if (!entriesResult.ok) throw new Error(entriesResult.message);
  return entriesResult.value
    .filter(entry => entry.walletId === walletId)
    .reduce((sum, entry) => sum + entry.cashDeltaMinor, 0);
}

describe("G-006 — withdrawalWalletGuard (the one canonical policy)", () => {
  it("below balance passes; equal passes; above rejects with the available amount", () => {
    const rich = wallet("w-rich", "الصندوق");
    const opening = 5000;
    const below = evaluateWithdrawalWalletCoverage({
      walletId: rich.id,
      wallets: [rich],
      cashEntries: entries(rich.id, opening),
      amountMinor: 3000,
    });
    expect(below).toMatchObject({ ok: true, value: { walletBalanceMinor: 5000 } });
    const equal = evaluateWithdrawalWalletCoverage({
      walletId: rich.id,
      wallets: [rich],
      cashEntries: entries(rich.id, opening),
      amountMinor: 5000,
    });
    expect(equal).toMatchObject({ ok: true });
    const above = evaluateWithdrawalWalletCoverage({
      walletId: rich.id,
      wallets: [rich],
      cashEntries: entries(rich.id, opening),
      amountMinor: 5001,
    });
    expect(above).toMatchObject({ ok: false, availableMinor: 5000 });
    if (!above.ok) {
      expect(above.message).toContain("المتاح لديك");
      expect(above.message).toContain("المطلوب");
    }
  });

  it("zero balance wallet shows 0.00 honestly; invalid wallet is rejected; bad amounts are rejected", () => {
    const poor = wallet("w-poor", "الدرج الفارغ");
    const zero = evaluateWithdrawalWalletCoverage({
      walletId: poor.id,
      wallets: [poor],
      cashEntries: [],
      amountMinor: 100,
    });
    expect(zero).toMatchObject({ ok: false, availableMinor: 0 });
    if (!zero.ok) expect(zero.message).toContain("0.00");
    const invalid = evaluateWithdrawalWalletCoverage({
      walletId: "no-such-wallet",
      wallets: [poor],
      cashEntries: [],
      amountMinor: 100,
    });
    expect(invalid).toMatchObject({ ok: false });
    if (!invalid.ok) expect(invalid.message).toContain("محفظة كاش موجودة");
    for (const amountMinor of [0, -5, 2.5]) {
      const bad = evaluateWithdrawalWalletCoverage({
        walletId: poor.id,
        wallets: [poor],
        cashEntries: [],
        amountMinor,
      });
      expect(bad.ok).toBe(false);
    }
  });

  it("unallocated source (null wallet) is an explicit allowed policy — no invented limit", () => {
    const result = evaluateWithdrawalWalletCoverage({
      walletId: null,
      wallets: [],
      cashEntries: [],
      amountMinor: 999_999,
    });
    expect(result).toMatchObject({ ok: true });
  });
});

describe("G-006 — ledger path (OwnerEntitlementService.recordMovement)", () => {
  it("draw below balance succeeds and decreases the wallet exactly once", async () => {
    const store = new MemoryLocalStore();
    const w = await openSeededWallet(store, "ledger-1", 5000);
    const service = await ledgerService(store);
    const draw = await service.recordMovement({
      kind: "draw",
      amountMinor: 3000,
      walletId: w.id,
      occurredOn: "2026-09-20",
      note: "سحب جزئي",
      reason: "pre_entitlement_draw",
      idempotencyKey: "g006-ledger-below",
    });
    expect(draw.ok).toBe(true);
    expect(await walletBalanceMinor(store, w.id)).toBe(2000);
  });

  it("draw equal to balance succeeds and the wallet reaches zero", async () => {
    const store = new MemoryLocalStore();
    const w = await openSeededWallet(store, "ledger-2", 5000);
    const service = await ledgerService(store);
    const draw = await service.recordMovement({
      kind: "draw",
      amountMinor: 5000,
      walletId: w.id,
      occurredOn: "2026-09-20",
      note: "سحب كامل الرصيد",
      reason: "pre_entitlement_draw",
      idempotencyKey: "g006-ledger-equal",
    });
    expect(draw.ok).toBe(true);
    expect(await walletBalanceMinor(store, w.id)).toBe(0);
  });

  it("draw above balance is rejected with the available amount and writes nothing", async () => {
    const store = new MemoryLocalStore();
    const w = await openSeededWallet(store, "ledger-3", 5000);
    const service = await ledgerService(store);
    const draw = await service.recordMovement({
      kind: "draw",
      amountMinor: 6000,
      walletId: w.id,
      occurredOn: "2026-09-20",
      note: "سحب فوق الرصيد",
      reason: "pre_entitlement_draw",
      idempotencyKey: "g006-ledger-above",
    });
    expect(draw).toMatchObject({ ok: false, code: "validation_error" });
    if (!draw.ok) {
      expect(draw.message).toContain("المتاح لديك");
      expect(draw.message).toContain("50.00");
    }
    /* لا كتابة جزئية: لا حركة ولا أثر كاش. */
    const movements = await store.listOwnerMovements();
    if (!movements.ok) throw new Error(movements.message);
    expect(movements.value).toHaveLength(0);
    expect(await walletBalanceMinor(store, w.id)).toBe(5000);
    /* محفظة أخرى تكفي — القرار بيد المستخدم لا حجب صامت. */
    const other = await openSeededWallet(store, "ledger-3b", 9000);
    const retry = await service.recordMovement({
      kind: "draw",
      amountMinor: 6000,
      walletId: other.id,
      occurredOn: "2026-09-20",
      note: "سحب من محفظة أخرى",
      reason: "pre_entitlement_draw",
      idempotencyKey: "g006-ledger-above-retry",
    });
    expect(retry.ok).toBe(true);
    expect(await walletBalanceMinor(store, other.id)).toBe(3000);
    expect(await walletBalanceMinor(store, w.id)).toBe(5000);
  });

  it("retry with the same idempotency key is an honest reuse (single cash effect)", async () => {
    const store = new MemoryLocalStore();
    const w = await openSeededWallet(store, "ledger-4", 5000);
    const service = await ledgerService(store);
    const input = {
      kind: "draw" as const,
      amountMinor: 1000,
      walletId: w.id,
      occurredOn: "2026-09-20",
      note: "سحب",
      reason: "pre_entitlement_draw" as const,
      idempotencyKey: "g006-ledger-reuse",
    };
    const first = await service.recordMovement(input);
    expect(first.ok).toBe(true);
    const second = await service.recordMovement(input);
    expect(second).toMatchObject({ ok: true, reused: true });
    expect(await walletBalanceMinor(store, w.id)).toBe(4000);
    const movements = await store.listOwnerMovements();
    if (!movements.ok) throw new Error(movements.message);
    expect(movements.value).toHaveLength(1);
  });

  it("reversal restores the wallet balance", async () => {
    const store = new MemoryLocalStore();
    const w = await openSeededWallet(store, "ledger-5", 5000);
    const service = await ledgerService(store);
    const draw = await service.recordMovement({
      kind: "draw",
      amountMinor: 1200,
      walletId: w.id,
      occurredOn: "2026-09-20",
      note: "سحب مؤقت",
      reason: "pre_entitlement_draw",
      idempotencyKey: "g006-ledger-reversible",
    });
    if (!draw.ok) throw new Error(draw.message);
    expect(await walletBalanceMinor(store, w.id)).toBe(3800);
    const reversed = await service.reverseMovement({
      movementId: draw.value.movement.id,
      occurredOn: "2026-09-21",
      reason: "سجلت السحب بالخطأ",
      idempotencyKey: "g006-ledger-reverse",
    });
    expect(reversed.ok).toBe(true);
    expect(await walletBalanceMinor(store, w.id)).toBe(5000);
  });
});

describe("G-006 — event path (ProjectFinancialService.record)", () => {
  it("wallet-sourced withdrawal above balance: no event saved, honest message with the available amount", async () => {
    const store = new MemoryLocalStore();
    const w = await openSeededWallet(store, "event-1", 5000);
    const finance = new ProjectFinancialService(store, () => now());
    const result = await finance.record({
      type: "owner_withdrawal_cash",
      amountMinor: 6000,
      occurredOn: "2026-09-20",
      note: "سحب شخصي",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "g006-event-above",
      sourceWalletId: w.id,
    });
    expect(result).toMatchObject({ ok: false, code: "validation_error" });
    if (!result.ok) {
      expect(result.message).toContain("المتاح لديك");
      expect(result.message).toContain("50.00");
    }
    /* لا حدث ولا تخصيص — لا كتابة جزئية. */
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    expect(events.value).toHaveLength(0);
    expect(await walletBalanceMinor(store, w.id)).toBe(5000);
  });

  it("wallet-sourced withdrawal within balance: event plus allocation in the same decision", async () => {
    const store = new MemoryLocalStore();
    const w = await openSeededWallet(store, "event-2", 5000);
    const finance = new ProjectFinancialService(store, () => now());
    const result = await finance.record({
      type: "owner_withdrawal_cash",
      amountMinor: 2000,
      occurredOn: "2026-09-20",
      note: "سحب شخصي",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "g006-event-within",
      sourceWalletId: w.id,
    });
    expect(result.ok).toBe(true);
    /* المسار الموازي للتخصيص يبقى: الحدث ثم distributeUnallocated بالمفتاح
     * المشتق — التخصيص الواحد يمر كما في الواجهة. */
    if (result.ok) {
      const attribution = await finance.distributeUnallocated({
        walletId: w.id,
        deltaMinor: -2000,
        note: "تغطية سحب شخصي من رصيد المحفظة",
        sourceRefId: result.value.id,
        sourceRefKind: "owner_event",
        operationKey: "g006-event-within:attribute",
      });
      expect(attribution.ok).toBe(true);
    }
    expect(await walletBalanceMinor(store, w.id)).toBe(3000);
  });

  it("unallocated-source withdrawal still records (explicit allowed policy)", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, () => now());
    const result = await finance.record({
      type: "owner_withdrawal_cash",
      amountMinor: 2000,
      occurredOn: "2026-09-20",
      note: "سحب من غير الموزع",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "g006-event-unallocated",
      sourceWalletId: null,
    });
    expect(result.ok).toBe(true);
  });

  it("both withdrawal paths share the one guard: identical rejection message for the same facts", async () => {
    const store = new MemoryLocalStore();
    const w = await openSeededWallet(store, "event-3", 5000);
    const finance = new ProjectFinancialService(store, () => now());
    const ledger = await ledgerService(store);
    const eventResult = await finance.record({
      type: "owner_withdrawal_cash",
      amountMinor: 6000,
      occurredOn: "2026-09-20",
      note: "سحب",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "g006-equivalence-event",
      sourceWalletId: w.id,
    });
    const ledgerResult = await ledger.recordMovement({
      kind: "draw",
      amountMinor: 6000,
      walletId: w.id,
      occurredOn: "2026-09-20",
      note: "سحب",
      reason: "pre_entitlement_draw",
      idempotencyKey: "g006-equivalence-ledger",
    });
    expect(eventResult.ok).toBe(false);
    expect(ledgerResult.ok).toBe(false);
    if (!eventResult.ok && !ledgerResult.ok) expect(eventResult.message).toBe(ledgerResult.message);
  });

  it("withdrawal never enters period expenses or the period result (both paths)", async () => {
    const store = new MemoryLocalStore();
    const w = await openSeededWallet(store, "expense-1", 5000);
    const finance = new ProjectFinancialService(store, () => now());
    const ledger = await ledgerService(store);
    const before = await finance.readRecordedPeriodResult("2026-09-01", "2026-09-30");
    if (!before.ok) throw new Error(before.message);
    await ledger.recordMovement({
      kind: "draw",
      amountMinor: 1000,
      walletId: w.id,
      occurredOn: "2026-09-20",
      note: "سحب دفتر",
      reason: "pre_entitlement_draw",
      idempotencyKey: "g006-expense-ledger",
    });
    const eventResult = await finance.record({
      type: "owner_withdrawal_cash",
      amountMinor: 500,
      occurredOn: "2026-09-20",
      note: "سحب حدث",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "g006-expense-event",
      sourceWalletId: w.id,
    });
    expect(eventResult.ok).toBe(true);
    const after = await finance.readRecordedPeriodResult("2026-09-01", "2026-09-30");
    if (!after.ok) throw new Error(after.message);
    /* سحب المالك ليس مصروفًا تشغيليًا ولا يغير النتيجة — الفرق الوحيد
     * المسموح هو علم مصروفات محتمل تغيّر عدّ القيود لا قيمها. */
    expect(after.value.operatingExpenseMinor).toBe(before.value.operatingExpenseMinor);
    expect(after.value.resultMinor).toBe(before.value.resultMinor);
  });
});
