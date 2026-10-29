import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import type { PrototypeLocalStore } from "@/storage/local/types";
import { ProjectFinancialService } from "./projectFinancialService";
import { LocalTransferService } from "@/application/transfers/localTransferService";
import { syncSha256Hex } from "@/lib/syncSha256";
import { ExpenseBudgetService } from "@/application/budgets/expenseBudgetService";
import { summarizeFinancialEvents } from "@micro-domain/financial-event/index.js";
import type { OperatingExpenseContext } from "@micro-domain/financial-event/index.js";

/* S06 (CONS-DEC04 المعتمدة / SDF-064 — عقدا ٠٦/٠٨/٤٢): الفاتورة المشتركة
 * التي دفعها المشروع فوق حصته — نية واحدة بمعاينة واحدة تنتج حدثين عبر
 * الكاتب الكنوني: مصروف الحصة وسحب المالك بالفارق المؤكد شخصيًا. ودفع
 * الحصة فقط لا يضيف سحبًا ولا دينًا. وSDF-062: المنصرف المؤهل عند قارئ
 * الميزانية هو مصروف التشغيل المسجل (10 لا 3 ولا 110) بنفس معرفة القارئ
 * الكنوني ونطاقه. الإثبات على المهايئين معًا. */

const NOW = "2026-10-29T08:00:00.000Z";
const DATABASE_NAME = "micro-prototype-local";

const sharedContext: OperatingExpenseContext = {
  relationship: "shared",
  behavior: "variable",
  purpose: "project_general",
  knowledge: "known",
  sharedProjectShare: { basis: "agreed_fixed_share", note: null },
};

function clearDatabase(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

type StoreFactory = () => Promise<PrototypeLocalStore> | PrototypeLocalStore;

const adapters: ReadonlyArray<{ readonly label: string; readonly make: StoreFactory }> = [
  { label: "Memory", make: () => new MemoryLocalStore() },
  {
    label: "IndexedDB",
    make: async () => {
      await clearDatabase();
      return new IndexedDbLocalStore();
    },
  },
];

for (const adapter of adapters) {
  describe(`SDF-064 — الفاتورة المشتركة فوق الحصة (${adapter.label})`, () => {
    afterEach(async () => {
      if (adapter.label === "IndexedDB") await clearDatabase();
    });

    it("فاتورة 60 دفعها المشروع وحصته 30 ← نقد −60 ومصروف 30 وسحب شخصي 30 بنية واحدة", async () => {
      const store = await adapter.make();
      const service = new ProjectFinancialService(store, () => NOW);
      const bill = await service.recordSharedBill({
        type: "operating_expense_cash",
        amountMinor: 3_000,
        occurredOn: "2026-10-20",
        note: "فاتورة كهرباء البيت والمحل",
        counterparty: "شركة الكهرباء",
        relatedEventId: null,
        expenseContext: sharedContext,
        sharedExpense: { mode: "fixed", amountMinor: 3_000, paidAmountMinor: 6_000 },
        idempotencyKey: "bill-60-30",
      });
      if (!bill.ok) throw new Error(bill.message);
      expect(bill.value.expense.type).toBe("operating_expense_cash");
      expect(bill.value.expense.amountMinor).toBe(3_000);
      expect(bill.value.expense.expenseContext?.sharedProjectShare?.paidAmountMinor).toBe(6_000);
      expect(bill.value.ownerPart).not.toBeNull();
      expect(bill.value.ownerPart?.type).toBe("owner_withdrawal_cash");
      expect(bill.value.ownerPart?.amountMinor).toBe(3_000);
      expect(bill.value.ownerPart?.idempotencyKey).toBe("bill-60-30:owner-part");
      expect(bill.value.ownerPart?.note).toContain("الجزء الشخصي من فاتورة مشتركة");

      /* الأثر الكلي الصادق: نقد −60، مصروف +30، مال المالك −30 — مرة واحدة. */
      const events = await store.listFinancialEvents();
      if (!events.ok) throw new Error(events.message);
      expect(events.value).toHaveLength(2);
      const totals = summarizeFinancialEvents(events.value);
      expect(totals.cashMinor).toBe(-6_000);
      expect(totals.operatingExpenseMinor).toBe(3_000);
      expect(totals.ownerCapitalMinor).toBe(-3_000);
      expect(totals.payableMinor).toBe(0);
    });

    it("دفع المشروع حصته فقط (30) ← لا سحب إضافي ولا دين (المسار العادي محفوظ)", async () => {
      const store = await adapter.make();
      const service = new ProjectFinancialService(store, () => NOW);
      const result = await service.record({
        type: "operating_expense_cash",
        amountMinor: 3_000,
        occurredOn: "2026-10-20",
        note: "حصة المحل من فاتورة الكهرباء",
        counterparty: null,
        relatedEventId: null,
        expenseContext: sharedContext,
        sharedExpense: { mode: "fixed", amountMinor: 3_000 },
        idempotencyKey: "share-only-30",
      });
      if (!result.ok) throw new Error(result.message);
      const events = await store.listFinancialEvents();
      if (!events.ok) throw new Error(events.message);
      expect(events.value).toHaveLength(1);
      const totals = summarizeFinancialEvents(events.value);
      expect(totals.cashMinor).toBe(-3_000);
      expect(totals.operatingExpenseMinor).toBe(3_000);
      expect(totals.ownerCapitalMinor).toBe(0);
    });

    it("إعادة النية نفسها تعيد الحدثين القائمين — لا مضاعفة أثر عند السباق أو الإعادة", async () => {
      const store = await adapter.make();
      const service = new ProjectFinancialService(store, () => NOW);
      const input = {
        type: "operating_expense_cash" as const,
        amountMinor: 3_000,
        occurredOn: "2026-10-20",
        note: "فاتورة إنترنت البيت والمحل",
        counterparty: null,
        relatedEventId: null,
        expenseContext: sharedContext,
        sharedExpense: { mode: "fixed" as const, amountMinor: 3_000, paidAmountMinor: 6_000 },
        idempotencyKey: "bill-replay",
      };
      const first = await service.recordSharedBill(input);
      if (!first.ok) throw new Error(first.message);
      const second = await service.recordSharedBill(input);
      if (!second.ok) throw new Error(second.message);
      expect(second.value.expense.id).toBe(first.value.expense.id);
      expect(second.value.ownerPart?.id).toBe(first.value.ownerPart?.id);
      const events = await store.listFinancialEvents();
      if (!events.ok) throw new Error(events.message);
      expect(events.value).toHaveLength(2);
      const totals = summarizeFinancialEvents(events.value);
      expect(totals.cashMinor).toBe(-6_000);
      expect(totals.operatingExpenseMinor).toBe(3_000);
    });

    it("فشل السحب بعد ثبوت المصروف نتيجة جزئية صادقة — المصروف باقٍ والفارق بمفتاحه", async () => {
      const store = await adapter.make();
      const service = new ProjectFinancialService(store, () => NOW);
      /* محفظة رصيدها لا يغطي السحب: حارس G-006 يرفض السحب وحده. */
      const wallet = {
        id: "wallet-thin",
        name: "محفظة صغيرة",
        kind: "cash_drawer" as const,
        createdAt: NOW,
        createdOperationKey: "wallet-thin-key",
        openingStatus: "known" as const,
      };
      const opening = await store.commitCashContinuity(wallet, [
        {
          id: "opening-1",
          walletId: "wallet-thin",
          type: "opening_balance",
          occurredOn: "2026-10-01",
          recordedAt: NOW,
          cashDeltaMinor: 2_000,
          note: "رصيد افتتاحي",
          reason: null,
          operationKey: "opening-1-key",
          transferId: null,
          reversesEntryId: null,
        },
      ]);
      if (!opening.ok) throw new Error(opening.message);

      const bill = await service.recordSharedBill({
        type: "operating_expense_cash",
        amountMinor: 3_000,
        occurredOn: "2026-10-20",
        note: "فاتورة كبيرة",
        counterparty: null,
        relatedEventId: null,
        expenseContext: sharedContext,
        sharedExpense: { mode: "fixed", amountMinor: 3_000, paidAmountMinor: 9_000 },
        idempotencyKey: "bill-partial",
        sourceWalletId: "wallet-thin",
      });
      if (!bill.ok) throw new Error(bill.message);
      /* المصروف ثابت والسحب فشل بحارس التغطية — نتيجة جزئية لا فشل كامل كاذب. */
      expect(bill.value.ownerPart).toBeNull();
      expect(bill.value.ownerPartFailure).toContain("رصيد");
      const events = await store.listFinancialEvents();
      if (!events.ok) throw new Error(events.message);
      expect(events.value.filter(event => event.type === "operating_expense_cash")).toHaveLength(1);
      expect(events.value.filter(event => event.type === "owner_withdrawal_cash")).toHaveLength(0);

      /* الإعادة بعد تعزيز الرصيد تكمل السحب وحده بالمفتاح نفسه. */
      const topUp = await store.commitCashContinuity(wallet, [
        {
          id: "topup-1",
          walletId: "wallet-thin",
          type: "cash_adjustment",
          occurredOn: "2026-10-21",
          recordedAt: NOW,
          cashDeltaMinor: 20_000,
          note: "إيداع نقدي",
          reason: "تعزيز الرصيد للاختبار",
          operationKey: "topup-1-key",
          transferId: null,
          reversesEntryId: null,
        },
      ]);
      if (!topUp.ok) throw new Error(topUp.message);
      const retried = await service.recordSharedBill({
        type: "operating_expense_cash",
        amountMinor: 3_000,
        occurredOn: "2026-10-20",
        note: "فاتورة كبيرة",
        counterparty: null,
        relatedEventId: null,
        expenseContext: sharedContext,
        sharedExpense: { mode: "fixed", amountMinor: 3_000, paidAmountMinor: 9_000 },
        idempotencyKey: "bill-partial",
        sourceWalletId: "wallet-thin",
      });
      if (!retried.ok) throw new Error(retried.message);
      expect(retried.value.ownerPart).not.toBeNull();
      expect(retried.value.ownerPart?.amountMinor).toBe(6_000);
      const eventsAfter = await store.listFinancialEvents();
      if (!eventsAfter.ok) throw new Error(eventsAfter.message);
      /* مصروف واحد لا اثنان — الإعادة استخدمت القائم وأكملت السحب وحده. */
      expect(eventsAfter.value.filter(event => event.type === "operating_expense_cash")).toHaveLength(1);
      expect(eventsAfter.value.filter(event => event.type === "owner_withdrawal_cash")).toHaveLength(1);
    });

    it("المدفوع الأقل من الحصة يرفض قبل أي كتابة — لا دفع جزئي بلا عقد", async () => {
      const store = await adapter.make();
      const service = new ProjectFinancialService(store, () => NOW);
      const result = await service.recordSharedBill({
        type: "operating_expense_cash",
        amountMinor: 3_000,
        occurredOn: "2026-10-20",
        note: "أقل من الحصة",
        counterparty: null,
        relatedEventId: null,
        expenseContext: sharedContext,
        sharedExpense: { mode: "fixed", amountMinor: 3_000, paidAmountMinor: 2_000 },
        idempotencyKey: "bill-below",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain("لا يمكن أن يقل عن حصة المشروع");
      const events = await store.listFinancialEvents();
      if (!events.ok) throw new Error(events.message);
      expect(events.value).toHaveLength(0);
    });
  });
}

describe("S06 (R1-F03) — باب النقل يتحقق من شكل المدفوع فعليًا (CONS-DEC04)", () => {
  it("حدث فاتورة مشتركة بمدفوع فعليًا يعبر الدورة الكاملة كما هو، والمعطوب يُرفض قبل المعاينة", async () => {
    const source = new MemoryLocalStore();
    const service = new ProjectFinancialService(source, () => NOW);
    const bill = await service.recordSharedBill({
      type: "operating_expense_cash",
      amountMinor: 3_000,
      occurredOn: "2026-10-20",
      note: "فاتورة البيت والمحل",
      counterparty: null,
      relatedEventId: null,
      expenseContext: sharedContext,
      sharedExpense: { mode: "fixed", amountMinor: 3_000, paidAmountMinor: 6_000 },
      idempotencyKey: "wire-paid",
    });
    if (!bill.ok) throw new Error(bill.message);
    const verified = await new LocalTransferService(source, () => NOW).createVerifiedExport();
    if (!verified.ok) throw new Error(verified.message);
    const file = verified.value.file as unknown as Record<string, unknown>;

    /* القيمة الصحيحة تعبر التصدير الموثق والاستيراد كما هي. */
    const target = new MemoryLocalStore();
    const targetService = new LocalTransferService(target, () => NOW);
    const restored = await targetService.prepareRestore(JSON.stringify(file));
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error(restored.message);
    const applied = await targetService.confirmImport(restored.value);
    if (!applied.ok) throw new Error(applied.message);
    const events = await target.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    const expense = events.value.find(event => event.type === "operating_expense_cash");
    expect(expense?.expenseContext?.sharedProjectShare?.paidAmountMinor).toBe(6_000);
    const withdrawal = events.value.find(event => event.type === "owner_withdrawal_cash");
    expect(withdrawal?.amountMinor).toBe(3_000);

    /* القيمة المعطوبة (نص/سالب/كسري) تُرفض عند الباب قبل أي معاينة أو كتابة. */
    for (const bad of ["ستون", -6_000, 6.5]) {
      const tampered = JSON.parse(JSON.stringify(file)) as {
        data: {
          financialEvents: { expenseContext?: { sharedProjectShare?: { paidAmountMinor?: unknown } } }[];
        };
        integrity: { digest: string };
      };
      tampered.data.financialEvents[0]!.expenseContext!.sharedProjectShare!.paidAmountMinor = bad;
      tampered.integrity.digest = syncSha256Hex(JSON.stringify(tampered.data));
      const prepared = targetService.prepareImport(JSON.stringify(tampered));
      expect(prepared.ok).toBe(false);
    }
  });
});

describe("SDF-062 — المنصرف المؤهل عند الميزانية وقارئ الفترة (Memory)", () => {
  it("ميزانية مع مصروف 10 سُدد منه 3 وأصل 100 ← المنصرف المؤهل 10 لا 3 ولا 110", async () => {
    const store = new MemoryLocalStore();
    const finance = new ProjectFinancialService(store, () => NOW);
    /* مصروف مستحق 10 (سُجل مصروف التشغيل كاملًا مرة واحدة). */
    const payable = await finance.record({
      type: "operating_expense_payable",
      amountMinor: 1_000,
      occurredOn: "2026-10-05",
      note: "فاتورة مستحقة",
      counterparty: null,
      relatedEventId: null,
      expenseContext: {
        relationship: "project",
        behavior: "variable",
        purpose: "project_general",
        knowledge: "known",
      },
      idempotencyKey: "sdf062-payable",
    });
    if (!payable.ok) throw new Error(payable.message);
    /* تسديد 3 — يخفض الكاش والذمة دون مصروف جديد. */
    const settlement = await finance.record({
      type: "payable_settlement_cash",
      amountMinor: 300,
      occurredOn: "2026-10-10",
      note: "سداد جزئي",
      counterparty: null,
      relatedEventId: payable.value.id,
      expenseContext: null,
      idempotencyKey: "sdf062-settle",
    });
    if (!settlement.ok) throw new Error(settlement.message);
    /* أصل 100 — ليس مصروف تشغيل ولا يدخل المنصرف المؤهل. */
    const asset = await finance.record({
      type: "asset_purchase_cash",
      amountMinor: 10_000,
      occurredOn: "2026-10-12",
      note: "ماكينة خياطة",
      counterparty: null,
      relatedEventId: null,
      expenseContext: null,
      assetContext: { assetId: "asset-sdf062", name: "ماكينة خياطة" },
      idempotencyKey: "sdf062-asset",
    });
    if (!asset.ok) throw new Error(asset.message);

    /* ميزانية مصروف عام على الشهر نفسه. */
    const budgets = new ExpenseBudgetService(store, () => NOW);
    const created = await budgets.createBudget({
      periodKey: "2026-10",
      scope: { kind: "general_expense" },
      amountMinor: 5_000,
      knowledge: "known",
      operationKey: "sdf062-budget",
    });
    if (!created.ok) throw new Error(created.message);
    const statuses = await budgets.readBudgetStatuses({ from: "2026-10", to: "2026-10" });
    if (!statuses.ok) throw new Error(statuses.message);
    expect(statuses.value.lines).toHaveLength(1);
    /* المنصرف المؤهل 10: لا 3 (السداد ليس مصروفًا جديدًا) ولا 110 (الأصل ليس
     * مصروف تشغيل). */
    expect(statuses.value.lines[0]?.spentMinor).toBe(1_000);

    /* نفس معرفة ونطاق المصروف عند قارئ الفترة الكنوني (013). */
    const period = await finance.readRecordedPeriodResult("2026-10-01", "2026-10-31");
    if (!period.ok) throw new Error(period.message);
    expect(period.value.recordedOperatingExpenseMinor).toBe(1_000);
  });
});
