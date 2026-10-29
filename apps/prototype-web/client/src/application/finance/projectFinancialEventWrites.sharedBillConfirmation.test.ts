import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import type { PrototypeLocalStore } from "@/storage/local/types";
import { ProjectFinancialService } from "./projectFinancialService";
import { RecurringExpenseService } from "@/application/recurring/recurringExpenseService";
import { summarizeFinancialEvents } from "@micro-domain/financial-event/index.js";
import type { OperatingExpenseContext } from "@micro-domain/financial-event/index.js";
import type { RecurringExpenseOccurrence } from "@micro-domain/recurring-expense/index.js";

/* S07 (S06-MR-001 — أمر S07 §«Confirmed S06 review finding»): التأكيد
 * الصريح «من تحمّل الباقي» للفاتورة المشتركة يجب أن يظل مرتبطًا بالقيمة
 * المالية المشتقة الكنونية التي أُعطي فوقها. هذه الانحدارات الدائمة تثبت
 * على المهايئين معًا: (١) النية المؤكدة غير المتغيرة تنجح وإعادتها
 * idempotent؛ (٢) تغيير حصة المشروع يبطل التأكيد؛ (٣) تغيير المدفوع/
 * الجزء المشتق يبطل التأكيد؛ (٤) تجاوز الواجهة لا يستطيع كتابة قيمة
 * متغيرة غير مؤكدة (بلا تأكيد/بتأكيد قديم/عبر المسار العام أو تأكيد
 * دورة التكرار)؛ (٥) المسار بلا جزء شخصي يبقى بلا تأكيد مفروض. */

const NOW = "2026-10-30T08:00:00.000Z";
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
  describe(`S06-MR-001 — تأكيد الجزء الشخصي مرتبط بالقيمة الكنونية (${adapter.label})`, () => {
    afterEach(async () => {
      if (adapter.label === "IndexedDB") await clearDatabase();
    });

    it("النية المؤكدة غير المتغيرة تنجح، وإعادتها بالمفتاح نفسه idempotent", async () => {
      const store = await adapter.make();
      const service = new ProjectFinancialService(store, () => NOW);
      const intent = {
        type: "operating_expense_cash" as const,
        amountMinor: 3_000,
        occurredOn: "2026-10-20",
        note: "فاتورة البيت والمحل",
        counterparty: null,
        relatedEventId: null,
        expenseContext: sharedContext,
        sharedExpense: { mode: "fixed" as const, amountMinor: 3_000, paidAmountMinor: 6_000 },
        ownerPartConfirmation: { shareAmountMinor: 3_000, paidAmountMinor: 6_000 },
        idempotencyKey: "mr1-unchanged",
      };
      const first = await service.recordSharedBill(intent);
      if (!first.ok) throw new Error(first.message);
      expect(first.value.ownerPart?.amountMinor).toBe(3_000);
      const second = await service.recordSharedBill(intent);
      if (!second.ok) throw new Error(second.message);
      expect(second.value.ownerPart?.id).toBe(first.value.ownerPart?.id);
      const events = await store.listFinancialEvents();
      if (!events.ok) throw new Error(events.message);
      expect(events.value).toHaveLength(2);
    });

    it("تغيير حصة المشروع بعد التأكيد يبطل التأكيد — لا كتابة بجمهور قديم", async () => {
      const store = await adapter.make();
      const service = new ProjectFinancialService(store, () => NOW);
      /* التأكيد أُعطي فوق (حصة 30، مدفوع 60) ثم صار الواقع (حصة 20، مدفوع 60)
       * — أي جزء شخصي أكبر (40 لا 30): التأكيد القديم لا يجوز أن يوثّقه. */
      const stale = await service.recordSharedBill({
        type: "operating_expense_cash",
        amountMinor: 2_000,
        occurredOn: "2026-10-20",
        note: "فاتورة تغيّرت حصتها",
        counterparty: null,
        relatedEventId: null,
        expenseContext: sharedContext,
        sharedExpense: { mode: "fixed", amountMinor: 2_000, paidAmountMinor: 6_000 },
        ownerPartConfirmation: { shareAmountMinor: 3_000, paidAmountMinor: 6_000 },
        idempotencyKey: "mr1-share-changed",
      });
      expect(stale.ok).toBe(false);
      if (!stale.ok) expect(stale.message).toContain("لا يطابق المبالغ الحالية");
      const events = await store.listFinancialEvents();
      if (!events.ok) throw new Error(events.message);
      expect(events.value).toHaveLength(0);
    });

    it("تغيير المدفوع/الجزء المشتق بعد التأكيد يبطل التأكيد — ولا كتابة بلا تأكيد أصلًا", async () => {
      const store = await adapter.make();
      const service = new ProjectFinancialService(store, () => NOW);
      /* المدفوع تغيّر 60 → 90 فوق الحصة نفسها: التأكيد القديم (30/60) لا
       * يوثّق سحبًا بقيمة جديدة (60). */
      const stalePaid = await service.recordSharedBill({
        type: "operating_expense_cash",
        amountMinor: 3_000,
        occurredOn: "2026-10-20",
        note: "فاتورة تغيّر مدفوعها",
        counterparty: null,
        relatedEventId: null,
        expenseContext: sharedContext,
        sharedExpense: { mode: "fixed", amountMinor: 3_000, paidAmountMinor: 9_000 },
        ownerPartConfirmation: { shareAmountMinor: 3_000, paidAmountMinor: 6_000 },
        idempotencyKey: "mr1-paid-changed",
      });
      expect(stalePaid.ok).toBe(false);
      /* وبلا تأكيد إطلاقًا (تجاوز الواجهة): الرفض قبل أي كتابة. */
      const noConfirmation = await service.recordSharedBill({
        type: "operating_expense_cash",
        amountMinor: 3_000,
        occurredOn: "2026-10-20",
        note: "فاتورة بلا تأكيد",
        counterparty: null,
        relatedEventId: null,
        expenseContext: sharedContext,
        sharedExpense: { mode: "fixed", amountMinor: 3_000, paidAmountMinor: 6_000 },
        idempotencyKey: "mr1-no-confirmation",
      });
      expect(noConfirmation.ok).toBe(false);
      if (!noConfirmation.ok) expect(noConfirmation.message).toContain("لم يُسجل شيء");
      const events = await store.listFinancialEvents();
      if (!events.ok) throw new Error(events.message);
      expect(events.value).toHaveLength(0);
    });

    it("تجاوز الواجهة بالمسار العام لا يكتب نية مدفوع فوق الحصة — يوجه لمسار الفاتورة المشتركة", async () => {
      const store = await adapter.make();
      const service = new ProjectFinancialService(store, () => NOW);
      const plain = await service.record({
        type: "operating_expense_cash",
        amountMinor: 3_000,
        occurredOn: "2026-10-20",
        note: "محاولة كتابة فوق الحصة بالمسار العام",
        counterparty: null,
        relatedEventId: null,
        expenseContext: sharedContext,
        sharedExpense: { mode: "fixed", amountMinor: 3_000, paidAmountMinor: 6_000 },
        idempotencyKey: "mr1-plain-bypass",
      });
      expect(plain.ok).toBe(false);
      if (!plain.ok) expect(plain.message).toContain("مسار الفاتورة المشتركة");
      const events = await store.listFinancialEvents();
      if (!events.ok) throw new Error(events.message);
      expect(events.value).toHaveLength(0);
    });

    it("المسار بلا جزء شخصي (دفع الحصة فقط) يبقى بلا تأكيد مفروض — المسار العادي محفوظ", async () => {
      const store = await adapter.make();
      const service = new ProjectFinancialService(store, () => NOW);
      const result = await service.record({
        type: "operating_expense_cash",
        amountMinor: 3_000,
        occurredOn: "2026-10-20",
        note: "حصة المحل فقط",
        counterparty: null,
        relatedEventId: null,
        expenseContext: sharedContext,
        sharedExpense: { mode: "fixed", amountMinor: 3_000 },
        idempotencyKey: "mr1-share-only",
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

    it("تأكيد دورة التكرار لا يحمل فرع المدفوع فوق الحصة — حرس منع التجاوز عند كاتبه", async () => {
      const store = await adapter.make();
      const service = new RecurringExpenseService(store, () => NOW);
      const setup = await service.setupFromExpense({
        seriesId: "recurring-mr1-guard-1",
        title: "اشتراك إنترنت",
        nextReminderDate: "2026-11-20",
        suggestedAmountMinor: 3_000,
        suggestedWalletId: null,
        categoryLabel: null,
      });
      if (!setup.ok) throw new Error(setup.message);
      const detail = await service.readDetail("recurring-mr1-guard-1");
      if (!detail.ok) throw new Error(detail.message);
      const reading = detail.value.occurrences[0];
      const occurrence: RecurringExpenseOccurrence = reading.occurrence;
      const confirmed = await service.confirm(occurrence.id, {
        type: "operating_expense_cash",
        amountMinor: 3_000,
        occurredOn: "2026-11-05",
        note: "فاتورة مشتركة عبر دورة التكرار",
        counterparty: null,
        expenseContext: sharedContext,
        sharedExpense: { mode: "fixed", amountMinor: 3_000, paidAmountMinor: 6_000 },
        walletId: null,
      });
      expect(confirmed.ok).toBe(false);
      if (!confirmed.ok) expect(confirmed.message).toContain("مسار الفاتورة المشتركة");
      const events = await store.listFinancialEvents();
      if (!events.ok) throw new Error(events.message);
      expect(events.value).toHaveLength(0);
    });
  });
}
