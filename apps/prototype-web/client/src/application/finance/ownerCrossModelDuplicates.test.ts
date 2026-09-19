/** EXE-009 (OWN-001): حارس التكرار التقاطعي بين نموذجي مال المالك.
 *
 * النموذجان التاريخيان (حدث مالي عام × حركة دفتر مالك) يعيشان في مخزنين
 * مختلفين — فالعملية نفسها كانت تُسجل مرتين بصمت (استثمار حدث + إرجاع حركة
 * بنفس المبلغ والتاريخ) فيتضاعف رأس المال والكاش. هذا الملف يثبت:
 * ١) الحارس يجد المكافئة في النموذج الآخر قبل الكتابة (كلا الاتجاهين).
 * ٢) المطابقة على (الاتجاه، المبلغ، التاريخ) — لا إنذارات كاذبة عند الاختلاف.
 * ٣) التراجع الموثق يزيل التطابق.
 * ٤) الدفتر الموحد يعلم الصفوف المتطابقة ويعلن عددها.
 */
import { describe, expect, it } from "vitest";
import { createCashContinuityEntry, createCashWallet } from "@micro-domain/cash-continuity/index.js";
import { createFinancialEvent, createFinancialReversal } from "@micro-domain/financial-event/index.js";
import { OwnerEntitlementService } from "./ownerEntitlementService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

const wallet = createCashWallet({
  id: "wallet-guard",
  name: "درج الحارس",
  kind: "cash_drawer",
  createdAt: "2026-09-01T08:00:00.000Z",
  createdOperationKey: "guard-wallet",
});

async function setup() {
  const store = new MemoryLocalStore();
  /* G-006: رصيد افتتاحي يغطي السحب — السحب فوق الرصيد يُرفض بالحرس الكنوني. */
  await store.commitCashContinuity(wallet, [
    createCashContinuityEntry({
      id: "wallet-guard-opening",
      walletId: wallet.id,
      type: "opening_balance",
      occurredOn: "2026-09-01",
      recordedAt: "2026-09-01T08:00:00.000Z",
      cashDeltaMinor: 100_000,
      note: "افتتاح لاختبار التكرار",
      operationKey: "wallet-guard-opening",
    }),
  ]);
  const service = new OwnerEntitlementService(
    store,
    async () => ({ ok: true as const, value: { resultMinor: 0, status: "recorded_only" as const } }),
    () => "2026-09-16T08:00:00.000Z",
  );
  return { store, service };
}

async function seedInvestmentEvent(
  store: MemoryLocalStore,
  id: string,
  amountMinor: number,
  occurredOn: string,
) {
  const saved = await store.saveFinancialEvent(
    createFinancialEvent({
      id,
      type: "owner_investment_cash",
      amountMinor,
      occurredOn,
      recordedAt: `${occurredOn}T08:00:00.000Z`,
      idempotencyKey: `${id}-key`,
      note: "استثمار حدث عام",
      counterparty: null,
      relatedEventId: null,
    }),
  );
  if (!saved.ok) throw new Error("seed investment event failed");
}

async function seedWithdrawalEvent(
  store: MemoryLocalStore,
  id: string,
  amountMinor: number,
  occurredOn: string,
) {
  const saved = await store.saveFinancialEvent(
    createFinancialEvent({
      id,
      type: "owner_withdrawal_cash",
      amountMinor,
      occurredOn,
      recordedAt: `${occurredOn}T08:00:00.000Z`,
      idempotencyKey: `${id}-key`,
      note: "سحب حدث عام",
      counterparty: null,
      relatedEventId: null,
    }),
  );
  if (!saved.ok) throw new Error("seed withdrawal event failed");
}

describe("EXE-009 — cross-model duplicate guard (OWN-001)", () => {
  it("writing a movement finds a matching investment event (same amount, same day)", async () => {
    const { store, service } = await setup();
    await seedInvestmentEvent(store, "inv-1", 10000, "2026-09-10");
    const duplicate = await service.findCrossModelOwnerDuplicate({
      direction: "injection",
      amountMinor: 10000,
      occurredOn: "2026-09-10",
      writing: "movement",
    });
    expect(duplicate.ok).toBe(true);
    expect(duplicate.ok && duplicate.value?.eventIds).toEqual(["inv-1"]);
    expect(duplicate.ok && duplicate.value?.movementIds).toEqual([]);
  });

  it("writing an event finds a matching draw movement (same amount, same day)", async () => {
    const { service } = await setup();
    const draw = await service.recordMovement({
      kind: "draw",
      amountMinor: 2500,
      walletId: wallet.id,
      occurredOn: "2026-09-11",
      reason: "pre_entitlement_draw",
      note: "سحب حركة دفتر",
      idempotencyKey: "draw-guard-1",
    });
    expect(draw.ok).toBe(true);
    const duplicate = await service.findCrossModelOwnerDuplicate({
      direction: "withdrawal",
      amountMinor: 2500,
      occurredOn: "2026-09-11",
      writing: "event",
    });
    expect(duplicate.ok).toBe(true);
    expect(duplicate.ok && duplicate.value?.movementIds.length).toBe(1);
    expect(duplicate.ok && duplicate.value?.eventIds).toEqual([]);
  });

  it("no false positives: different amount, different day, or opposite direction all pass", async () => {
    const { store, service } = await setup();
    await seedInvestmentEvent(store, "inv-2", 10000, "2026-09-10");
    for (const input of [
      { direction: "injection" as const, amountMinor: 10000, occurredOn: "2026-09-11" },
      { direction: "injection" as const, amountMinor: 9999, occurredOn: "2026-09-10" },
      { direction: "withdrawal" as const, amountMinor: 10000, occurredOn: "2026-09-10" },
    ]) {
      const duplicate = await service.findCrossModelOwnerDuplicate({ ...input, writing: "movement" });
      expect(duplicate.ok && duplicate.value).toBeNull();
    }
  });

  it("a documented reversal removes the cross-model match", async () => {
    const { store, service } = await setup();
    await seedWithdrawalEvent(store, "wd-1", 3000, "2026-09-12");
    const before = await service.findCrossModelOwnerDuplicate({
      direction: "withdrawal",
      amountMinor: 3000,
      occurredOn: "2026-09-12",
      writing: "movement",
    });
    expect(before.ok && before.value).not.toBeNull();
    /* تراجع موثق عن الحدث — مرآة كاملة عبر آلية السجل العام نفسها. */
    const original = (await store.listFinancialEvents()).value.find(event => event.id === "wd-1");
    if (!original) throw new Error("seeded withdrawal event missing");
    const reversal = await store.saveFinancialEvent(
      createFinancialReversal({
        id: "wd-1-reversal",
        idempotencyKey: "wd-1-reversal-key",
        reason: "سحب مسجل خطأ من النموذجين — تراجع موثق",
        occurredOn: "2026-09-13",
        recordedAt: "2026-09-13T08:00:00.000Z",
        sourceEvent: original,
      }),
    );
    expect(reversal.ok).toBe(true);
    const after = await service.findCrossModelOwnerDuplicate({
      direction: "withdrawal",
      amountMinor: 3000,
      occurredOn: "2026-09-12",
      writing: "movement",
    });
    expect(after.ok && after.value).toBeNull();
  });

  it("the unified ledger flags duplicate rows and reports the pair count", async () => {
    const { store, service } = await setup();
    await seedInvestmentEvent(store, "inv-3", 7000, "2026-09-14");
    const capitalReturn = await service.recordMovement({
      kind: "return",
      amountMinor: 7000,
      walletId: wallet.id,
      occurredOn: "2026-09-14",
      reason: "new_capital_investment",
      note: "إدخال رأس مال من الدفتر",
      idempotencyKey: "return-guard-1",
    });
    expect(capitalReturn.ok).toBe(true);
    const overview = await service.readOwnerMoneyOverview();
    expect(overview.ok).toBe(true);
    if (!overview.ok) return;
    expect(overview.value.crossModelDuplicatePairCount).toBe(1);
    const flagged = overview.value.rows.filter(row => row.crossModelDuplicate);
    expect(flagged).toHaveLength(2);
    expect(flagged.map(row => row.source).sort()).toEqual(["event", "ledger"]);
  });

  it("no duplicates in a clean ledger — pair count zero and no flagged rows", async () => {
    const { store, service } = await setup();
    await seedInvestmentEvent(store, "inv-4", 5000, "2026-09-15");
    const overview = await service.readOwnerMoneyOverview();
    expect(overview.ok && overview.value.crossModelDuplicatePairCount).toBe(0);
    expect(overview.ok && overview.value.rows.every(row => !row.crossModelDuplicate)).toBe(true);
  });
});
