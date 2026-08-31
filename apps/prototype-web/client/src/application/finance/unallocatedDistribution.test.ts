import { describe, expect, it } from "vitest";
import { ProjectFinancialService } from "./projectFinancialService";
import { CashContinuityService } from "@/application/cash/cashContinuityService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

const now = () => "2026-08-30T09:00:00.000Z";

/* عقد التوزيع الصريح (PA-002 + مبدأ المالك ٥.٢): الكاش غير الموزع يجد طريقه إلى
 * المحافظ بتخصيص معلن — الإجمالي المسجل لا يتغير، والحرس يمنع الاختراع والسلب الصامت. */
describe("unallocated cash distribution", () => {
  it("moves unallocated cash into a wallet without changing the recorded total", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const cash = new CashContinuityService(store, now);
    await finance.record({
      type: "owner_investment_cash",
      amountMinor: 100000,
      occurredOn: "2026-08-28",
      note: "استثمار نقدي",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "inv-1",
    });
    const wallet = await cash.openWallet({
      name: "الدرج",
      kind: "cash_drawer",
      openingMinor: 0,
      occurredOn: "2026-08-28",
      note: "محفظة الدرج",
      operationKey: "wallet-1",
    });
    if (!wallet.ok) throw new Error(wallet.message);
    const before = await finance.readPosition();
    if (!before.ok) throw new Error(before.message);
    expect(before.value.unallocatedCashMinor).toBe(100000);
    const result = await finance.distributeUnallocated({
      walletId: wallet.value.wallet.id,
      deltaMinor: 40000,
      note: "توزيع قبضات الأسبوع",
    });
    if (!result.ok) throw new Error(result.message);
    expect(result.value.unallocatedAfterMinor).toBe(60000);
    const after = await finance.readPosition();
    if (!after.ok) throw new Error(after.message);
    expect(after.value.unallocatedCashMinor).toBe(60000);
    expect(after.value.walletCashMinor).toBe(40000);
    /* الحكم الحاسم: الإجمالي المسجل لم يتغير — تخصيص لا إثراء. */
    expect(after.value.recordedCashMinor).toBe(before.value.recordedCashMinor);
  });

  it("covers an attributed payment from a wallet with a negative allocation", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const cash = new CashContinuityService(store, now);
    await finance.record({
      type: "owner_investment_cash",
      amountMinor: 50000,
      occurredOn: "2026-08-28",
      note: "استثمار",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "inv-2",
    });
    const wallet = await cash.openWallet({
      name: "الدرج",
      kind: "cash_drawer",
      openingMinor: 0,
      occurredOn: "2026-08-28",
      note: "محفظة",
      operationKey: "wallet-2",
    });
    if (!wallet.ok) throw new Error(wallet.message);
    await finance.distributeUnallocated({
      walletId: wallet.value.wallet.id,
      deltaMinor: 50000,
      note: "توزيع كامل",
    });
    const result = await finance.distributeUnallocated({
      walletId: wallet.value.wallet.id,
      deltaMinor: -20000,
      note: "تغطية مصروف",
    });
    if (!result.ok) throw new Error(result.message);
    expect(result.value.walletBalanceAfterMinor).toBe(30000);
    const position = await finance.readPosition();
    if (!position.ok) throw new Error(position.message);
    expect(position.value.unallocatedCashMinor).toBe(20000);
    expect(position.value.recordedCashMinor).toBe(50000);
  });

  it("rejects allocating more than the available unallocated cash", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const cash = new CashContinuityService(store, now);
    await finance.record({
      type: "owner_investment_cash",
      amountMinor: 10000,
      occurredOn: "2026-08-28",
      note: "استثمار",
      counterparty: null,
      relatedEventId: null,
      idempotencyKey: "inv-3",
    });
    const wallet = await cash.openWallet({
      name: "الدرج",
      kind: "cash_drawer",
      openingMinor: 0,
      occurredOn: "2026-08-28",
      note: "محفظة",
      operationKey: "wallet-3",
    });
    if (!wallet.ok) throw new Error(wallet.message);
    const result = await finance.distributeUnallocated({
      walletId: wallet.value.wallet.id,
      deltaMinor: 20000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("أكبر من الكاش غير الموزع");
  });

  it("rejects a negative allocation that would drain the wallet below zero", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const cash = new CashContinuityService(store, now);
    const wallet = await cash.openWallet({
      name: "الدرج",
      kind: "cash_drawer",
      openingMinor: 5000,
      occurredOn: "2026-08-28",
      note: "محفظة",
      operationKey: "wallet-4",
    });
    if (!wallet.ok) throw new Error(wallet.message);
    const result = await finance.distributeUnallocated({
      walletId: wallet.value.wallet.id,
      deltaMinor: -6000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("لا يغطي");
  });
});

/* عقد التعديل والحذف البسيطين (مبدأ المالك ٥.٦): تعديل موثق ذرّي، وحذف بأثر،
 * وتراجع عن الحذف يعيد القيم دون لمس الماضي. */
describe("simple financial event edit and delete", () => {
  async function seededStore() {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    const recorded = await finance.record({
      type: "operating_expense_cash",
      amountMinor: 3000,
      occurredOn: "2026-08-28",
      note: "دفعت توصيل",
      counterparty: "مندوب",
      relatedEventId: null,
      idempotencyKey: "exp-1",
      expenseContext: {
        relationship: "project",
        behavior: "unknown",
        purpose: "project_general",
        knowledge: "known",
        sharedProjectShare: null,
      },
    });
    if (!recorded.ok) throw new Error(recorded.message);
    return { store, finance, source: recorded.value };
  }

  it("edits an event atomically: the original effect is reversed and the replacement applies", async () => {
    const { store, finance, source } = await seededStore();
    const result = await finance.editEvent({
      sourceEventId: source.id,
      amountMinor: 4500,
      occurredOn: "2026-08-28",
      note: "دفعت توصيل — التصحيح",
      counterparty: "مندوب",
      idempotencyKey: "edit-1",
    });
    if (!result.ok) throw new Error(result.message);
    expect(result.value.amountMinor).toBe(4500);
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    /* السجل يبقى ثلاثيًا: الأصل + التراجع + البديل. */
    expect(events.value).toHaveLength(3);
    const reversal = events.value.find(event => event.correctionType === "reverse");
    expect(reversal?.correctionOfEventId).toBe(source.id);
    /* صافي الأثر = البديل وحده (4500 مصروف). */
    const totals = events.value.reduce(
      (sums, event) => ({
        cash: sums.cash + event.cashDeltaMinor,
        expense: sums.expense + event.operatingExpenseDeltaMinor,
      }),
      { cash: 0, expense: 0 },
    );
    expect(totals.cash).toBe(-4500);
    expect(totals.expense).toBe(4500);
  });

  it("deletes an event as a documented reversal and restores it via undo", async () => {
    const { finance, source } = await seededStore();
    const deleted = await finance.deleteEvent({
      sourceEventId: source.id,
      idempotencyKey: "delete-1",
    });
    if (!deleted.ok) throw new Error(deleted.message);
    let position = await finance.readPosition();
    if (!position.ok) throw new Error(position.message);
    expect(position.value.operatingExpensesRecordedMinor).toBe(0);
    expect(position.value.recordedCashMinor).toBe(0);
    /* التراجع عن الحذف يعيد القيم الأصلية كحدث جديد. */
    const restored = await finance.restoreEvent({
      sourceEventId: source.id,
      idempotencyKey: "restore-1",
    });
    if (!restored.ok) throw new Error(restored.message);
    position = await finance.readPosition();
    if (!position.ok) throw new Error(position.message);
    expect(position.value.operatingExpensesRecordedMinor).toBe(3000);
    expect(position.value.recordedCashMinor).toBe(-3000);
  });

  it("rejects editing an already-edited event instead of stacking corrections", async () => {
    const { finance, source } = await seededStore();
    const first = await finance.editEvent({
      sourceEventId: source.id,
      amountMinor: 4500,
      occurredOn: "2026-08-28",
      note: "تصحيح أول",
      counterparty: null,
      idempotencyKey: "edit-2",
    });
    if (!first.ok) throw new Error(first.message);
    const second = await finance.editEvent({
      sourceEventId: source.id,
      amountMinor: 6000,
      occurredOn: "2026-08-28",
      note: "تصحيح ثان",
      counterparty: null,
      idempotencyKey: "edit-3",
    });
    expect(second.ok).toBe(false);
  });
});

/* PA-007: رصيد افتتاحي موثق لاحقًا لمحفظة قائمة — يرفع ختم المجهول بلا ازدواج. */
describe("opening balance entered later", () => {
  it("records a later documented opening and clears the unknown stamp atomically", async () => {
    const store = new MemoryLocalStore();
    const cash = new CashContinuityService(store, now);
    const wallet = await cash.openWallet({
      name: "الدرج",
      kind: "cash_drawer",
      openingMinor: 0,
      occurredOn: "2026-08-28",
      note: "محفظة",
      operationKey: "wallet-unknown",
      openingStatus: "unknown",
    });
    if (!wallet.ok) throw new Error(wallet.message);
    let overview = await cash.overview();
    if (!overview.ok) throw new Error(overview.message);
    expect(overview.value.unknownOpeningCount).toBe(1);
    const later = await cash.recordOpeningBalanceLater({
      walletId: wallet.value.wallet.id,
      amountMinor: 7500,
      occurredOn: "2026-08-20",
      note: "رصيد عرفته بعد جرد",
      operationKey: "opening-later-1",
    });
    if (!later.ok) throw new Error(later.message);
    overview = await cash.overview();
    if (!overview.ok) throw new Error(overview.message);
    expect(overview.value.unknownOpeningCount).toBe(0);
    expect(overview.value.wallets[0]?.balanceMinor).toBe(7500);
  });

  it("refuses a second opening balance for the same wallet", async () => {
    const store = new MemoryLocalStore();
    const cash = new CashContinuityService(store, now);
    const wallet = await cash.openWallet({
      name: "الدرج",
      kind: "cash_drawer",
      openingMinor: 1000,
      occurredOn: "2026-08-28",
      note: "محفظة",
      operationKey: "wallet-known",
    });
    if (!wallet.ok) throw new Error(wallet.message);
    const second = await cash.recordOpeningBalanceLater({
      walletId: wallet.value.wallet.id,
      amountMinor: 500,
      occurredOn: "2026-08-28",
      note: "محاولة ازدواج",
      operationKey: "opening-later-2",
    });
    expect(second.ok).toBe(false);
  });
});

/* المبدأ ١٣: الأمانات تدخل الكاش ولا تدخل الربح — وتظهر في الموقف كرصيد أمين مستقل. */
describe("amanah position facts", () => {
  it("reports held amanah as cash that is neither revenue nor owner capital", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, now);
    await finance.record({
      type: "amanah_held_cash",
      amountMinor: 30000,
      occurredOn: "2026-08-28",
      note: "أمانة مندوب توصيل",
      counterparty: "ليث",
      relatedEventId: null,
      idempotencyKey: "amanah-1",
    });
    const position = await finance.readPosition();
    if (!position.ok) throw new Error(position.message);
    expect(position.value.amanahHeldMinor).toBe(30000);
    expect(position.value.recordedCashMinor).toBe(30000);
    expect(position.value.operatingExpensesRecordedMinor).toBe(0);
    expect(position.value.ownerCapitalRecordedMinor).toBe(0);
    expect(position.value.supplierPayablesMinor).toBe(0);
  });
});
