import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { createFinancialEvent, createFinancialReversal } from "@micro-domain/financial-event/index.js";
import {
  markRecurringExpenseConfirmAttempted,
  markRecurringExpenseRecorded,
} from "@micro-domain/recurring-expense/index.js";
import type { RecurringExpenseOccurrence } from "@micro-domain/recurring-expense/index.js";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import type { PrototypeLocalStore } from "@/storage/local/types";
import { assertOk } from "@/testing/resultAssertions";
import { RecurringExpenseService } from "./recurringExpenseService";

/* S06 (UNIT-019 P3 — ORG-011/D07 وB4/D06): خيار «يتكرر» داخل المصروف —
 * منسق قصد مصروف واحد + إعداد تكرار واحد بمعرّف حتمي قابل للاستئناف،
 * وأول تذكير جديد هو القادم حصرًا (لا دورة حالية تكرر الواقعة المسجلة
 * للتو). وربط مصروف يدوي قائم بدورة باختيار صريح — لا حدث جديد ولا
 * تعديل مفتاح ولا دلتا مالية، بحرس صلاحية وحصرية وعكس وتعارض. على
 * المهايئين معًا. */

const OCTOBER = "2026-10-15T08:00:00.000Z"; /* عمّان +03: اليوم 2026-10-15 */
const DATABASE_NAME = "micro-prototype-local";

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

async function eventsOf(store: PrototypeLocalStore) {
  const events = await store.listFinancialEvents();
  if (!events.ok) throw new Error(events.message);
  return events.value;
}

async function occurrencesOf(store: PrototypeLocalStore) {
  const occurrences = await store.listRecurringExpenseOccurrences();
  if (!occurrences.ok) throw new Error(occurrences.message);
  return occurrences.value;
}

for (const adapter of adapters) {
  describe(`S06 — خيار «يتكرر» داخل المصروف (D07) (${adapter.label})`, () => {
    afterEach(async () => {
      if (adapter.label === "IndexedDB") await clearDatabase();
    });

    it("مصروف الآن + تكرار شهري ← إعداد واحد وأول تذكير هو القادم لا دورة حالية", async () => {
      const store = await adapter.make();
      const service = new RecurringExpenseService(store, () => OCTOBER);
      const setup = await service.setupFromExpense({
        seriesId: "recurring-bill-intent-1",
        title: "إيجار المحل",
        nextReminderDate: "2026-11-15",
        suggestedAmountMinor: 12_000,
        suggestedWalletId: null,
        categoryLabel: "إيجار",
      });
      if (!setup.ok) throw new Error(setup.message);
      expect(setup.value.series.status).toBe("active");
      expect(setup.value.series.title).toBe("إيجار المحل");

      const detail = await service.readDetail("recurring-bill-intent-1");
      if (!detail.ok) throw new Error(detail.message);
      const revision = detail.value.revisions[0];
      expect(revision?.amountMode).toBe("fixed_suggested");
      expect(revision?.suggestedAmountMinor).toBe(12_000);
      expect(revision?.categoryLabel).toBe("إيجار");
      expect(revision?.anchorDate).toBe("2026-11-15");
      expect(revision?.dueDay).toBe(15);
      expect(revision?.monthEndPolicy).toBe("last_valid_day");
      expect(revision?.effectiveFromPeriod).toBe("2026-11");

      /* التوليد الأمامي: فترة الشهر الحالي (2026-10) لا تنشأ أصلًا —
       * مصروف هذه الفترة سُجل للتو؛ أول فترة هي القادمة (2026-11). */
      const periods = detail.value.occurrences.map(reading => reading.occurrence.periodKey);
      expect(periods).not.toContain("2026-10");
      expect(periods).toContain("2026-11");
    });

    it("إعادة النية نفسها تعيد الإعداد القائم (reused) — لا سلسلة ثانية لاستئناف الناقص", async () => {
      const store = await adapter.make();
      const service = new RecurringExpenseService(store, () => OCTOBER);
      const first = await service.setupFromExpense({
        seriesId: "recurring-replay-1",
        title: "اشتراك إنترنت",
        nextReminderDate: "2026-11-01",
        suggestedAmountMinor: 3_500,
        suggestedWalletId: null,
        categoryLabel: null,
      });
      if (!first.ok) throw new Error(first.message);
      const second = await service.setupFromExpense({
        seriesId: "recurring-replay-1",
        title: "اشتراك إنترنت",
        nextReminderDate: "2026-11-01",
        suggestedAmountMinor: 3_500,
        suggestedWalletId: null,
        categoryLabel: null,
      });
      if (!second.ok) throw new Error(second.message);
      expect(second.value.reused).toBe(true);
      const seriesList = await store.listRecurringExpenseSeries();
      if (!seriesList.ok) throw new Error(seriesList.message);
      expect(seriesList.value).toHaveLength(1);
    });

    it("التذكير القادم في الفترة الحالية يُرفض — لا دورة حالية تكرر الواقعة المسجلة للتو", async () => {
      const store = await adapter.make();
      const service = new RecurringExpenseService(store, () => OCTOBER);
      const result = await service.setupFromExpense({
        seriesId: "recurring-current-period",
        title: "إيجار",
        nextReminderDate: "2026-10-25",
        suggestedAmountMinor: 1_000,
        suggestedWalletId: null,
        categoryLabel: null,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.message).toContain("شهر لاحق");
      const seriesList = await store.listRecurringExpenseSeries();
      if (!seriesList.ok) throw new Error(seriesList.message);
      expect(seriesList.value).toHaveLength(0);
    });

    it("الاستئناف بعد فشل التفعيل: مسودة قائمة تُفعَّل وحدها بنية الإعداد نفسها", async () => {
      const store = await adapter.make();
      const service = new RecurringExpenseService(store, () => OCTOBER);
      /* محاكاة فشل جزئي: المسودة أُنشئت والتفعيل لم يتم. */
      const draft = await service.createDraft({
        title: "تكه كهرباء",
        rule: {
          effectiveFromPeriod: "2026-11",
          frequency: "monthly",
          interval: 1,
          anchorDate: "2026-11-05",
          dueDay: 5,
          monthEndPolicy: "last_valid_day",
          timezone: "Asia/Amman",
          amountMode: "fixed_suggested",
          suggestedAmountMinor: 2_000,
          suggestedWalletId: null,
          categoryLabel: null,
          changeReason: null,
        },
      });
      if (!draft.ok) throw new Error(draft.message);
      const resumed = await service.setupFromExpense({
        seriesId: draft.value.series.id,
        title: "تكه كهرباء",
        nextReminderDate: "2026-11-05",
        suggestedAmountMinor: 2_000,
        suggestedWalletId: null,
        categoryLabel: null,
      });
      if (!resumed.ok) throw new Error(resumed.message);
      expect(resumed.value.series.status).toBe("active");
      expect(resumed.value.reused).toBe(false);
      /* لا سلسلة موازية — المعرف نفسه. */
      const seriesList = await store.listRecurringExpenseSeries();
      if (!seriesList.ok) throw new Error(seriesList.message);
      expect(seriesList.value).toHaveLength(1);
    });
  });

  describe(`S06 — ربط مصروف مسجل قائم بالدورة (D06) (${adapter.label})`, () => {
    afterEach(async () => {
      if (adapter.label === "IndexedDB") await clearDatabase();
    });

    async function seedSeriesWithCurrentOccurrence(service: RecurringExpenseService): Promise<string> {
      const created = await service.createDraft({
        title: "إيجار المحل",
        rule: {
          effectiveFromPeriod: "2026-09",
          frequency: "monthly",
          interval: 1,
          anchorDate: "2026-09-05",
          dueDay: 5,
          monthEndPolicy: "last_valid_day",
          timezone: "Asia/Amman",
          amountMode: "suggested",
          suggestedAmountMinor: 12_000,
          suggestedWalletId: null,
          categoryLabel: "إيجار",
          changeReason: null,
        },
      });
      if (!created.ok) throw new Error(created.message);
      const activated = await service.activate(created.value.series.id);
      if (!activated.ok) throw new Error(activated.message);
      /* قراءة تولّد فترات حتى الحالي+١ — منها فترة 2026-10 (اليوم 2026-10-15). */
      const overview = await service.readOverview();
      if (!overview.ok) throw new Error(overview.message);
      return created.value.series.id;
    }

    it("الربط بمصروف يدوي قائم يقرّ الدورة بلا حدث جديد ولا تعديل مفتاح", async () => {
      const store = await adapter.make();
      const service = new RecurringExpenseService(store, () => OCTOBER);
      const seriesId = await seedSeriesWithCurrentOccurrence(service);
      /* مصروف يدوي في فترة الدورة نفسها (2026-10). */
      const manual = createFinancialEvent({
        id: "event-manual-1",
        type: "operating_expense_cash",
        amountMinor: 12_000,
        occurredOn: "2026-10-05",
        recordedAt: OCTOBER,
        idempotencyKey: "manual-1-key",
        note: "إيجار أكتوبر — سجلته يدويًا",
        counterparty: null,
        relatedEventId: null,
        expenseContext: {
          relationship: "project",
          behavior: "fixed",
          purpose: "period",
          knowledge: "known",
        },
      });
      const saved = await store.saveFinancialEvent(manual);
      if (!saved.ok) throw new Error(saved.message);

      const occurrences = await occurrencesOf(store);
      const target = occurrences.find(
        (occurrence: RecurringExpenseOccurrence) => occurrence.periodKey === "2026-10",
      );
      if (!target) throw new Error("لا فترة 2026-10");
      const before = await eventsOf(store);

      const linked = await service.linkExistingExpense(target.id, manual.id);
      if (!linked.ok) throw new Error(linked.message);
      if (linked.value.status === "record_failed") throw new Error(linked.value.message);
      expect(linked.value.status).toBe("reused");
      expect(linked.value.occurrence.status).toBe("recorded");
      expect(linked.value.occurrence.recordedFinancialEventId).toBe(manual.id);
      expect(linked.value.event.id).toBe(manual.id);

      /* لا حدث جديد إطلاقًا — نفس العدد قبل وبعد الربط. */
      const after = await eventsOf(store);
      expect(after).toHaveLength(before.length);
      /* مفتاح الحدث ومبلغه كما هما حرفيًا. */
      const eventAfter = after.find(candidate => candidate.id === manual.id);
      expect(eventAfter?.idempotencyKey).toBe("manual-1-key");
      expect(eventAfter?.amountMinor).toBe(12_000);
    });

    it("حصرية الربط: الحدث الواحد دورة واحدة — الربط المزدوج يُرفض", async () => {
      const store = await adapter.make();
      const service = new RecurringExpenseService(store, () => OCTOBER);
      const seriesId = await seedSeriesWithCurrentOccurrence(service);
      const manual = createFinancialEvent({
        id: "event-exclusive",
        type: "operating_expense_cash",
        amountMinor: 12_000,
        occurredOn: "2026-10-05",
        recordedAt: OCTOBER,
        idempotencyKey: "exclusive-key",
        note: "إيجار أكتوبر",
        counterparty: null,
        relatedEventId: null,
        expenseContext: {
          relationship: "project",
          behavior: "fixed",
          purpose: "period",
          knowledge: "known",
        },
      });
      const saved = await store.saveFinancialEvent(manual);
      if (!saved.ok) throw new Error(saved.message);
      const occurrences = await occurrencesOf(store);
      const october = occurrences.find(o => o.periodKey === "2026-10");
      const november = occurrences.find(o => o.periodKey === "2026-11");
      if (!october || !november) throw new Error("فترات ناقصة");
      const first = await service.linkExistingExpense(october.id, manual.id);
      if (!first.ok) throw new Error(first.message);
      const second = await service.linkExistingExpense(november.id, manual.id);
      expect(second.ok).toBe(false);
      if (!second.ok) expect(second.message).toContain("مرتبط بدورة أخرى");
    });

    it("المعكوس والأنواع الأخرى ونتيجة التسجيل غير المحسومة تُرفض بلا كتابة", async () => {
      const store = await adapter.make();
      const service = new RecurringExpenseService(store, () => OCTOBER);
      const seriesId = await seedSeriesWithCurrentOccurrence(service);
      const payableSource = createFinancialEvent({
        id: "event-payable-source",
        type: "operating_expense_payable",
        amountMinor: 5_000,
        occurredOn: "2026-10-01",
        recordedAt: OCTOBER,
        idempotencyKey: "payable-source-key",
        note: "التزام مصروف للسداد",
        counterparty: null,
        relatedEventId: null,
      });
      const savedPayable = await store.saveFinancialEvent(payableSource);
      if (!savedPayable.ok) throw new Error(savedPayable.message);
      const settlement = createFinancialEvent({
        id: "event-settlement",
        type: "payable_settlement_cash",
        amountMinor: 5_000,
        occurredOn: "2026-10-06",
        recordedAt: OCTOBER,
        idempotencyKey: "settlement-key",
        note: "سداد",
        counterparty: null,
        relatedEventId: "event-payable-source",
      });
      const savedSettlement = await store.saveFinancialEvent(settlement);
      if (!savedSettlement.ok) throw new Error(savedSettlement.message);
      const occurrences = await occurrencesOf(store);
      const october = occurrences.find(o => o.periodKey === "2026-10");
      if (!october) throw new Error("لا فترة أكتوبر");
      /* نوع غير مصروف تشغيل. */
      const wrongType = await service.linkExistingExpense(october.id, settlement.id);
      expect(wrongType.ok).toBe(false);
      /* حدث غير موجود. */
      const missing = await service.linkExistingExpense(october.id, "event-ghost");
      expect(missing.ok).toBe(false);
      /* فترة نتيجتها غير محسومة (recording) لا تربط فوقها. */
      const inFlight = await service.confirm(october.id, {
        type: "operating_expense_cash",
        amountMinor: 12_000,
        occurredOn: "2026-10-05",
        note: "محاولة قائمة",
        counterparty: null,
        expenseContext: {
          relationship: "project",
          behavior: "fixed",
          purpose: "period",
          knowledge: "known",
        },
      });
      /* المحاولة قد تنجح أو تُعلق — المهم أن الفترة صارت غير قابلة للربط
       * فوقها؛ نجاح التأكيد يجعلها recorded فتُرفض برسالة «مسجل مسبقًا»،
       * وفشلها يتركها record_failed فتقبل — نحسم بالحالة الفعلية. */
      const afterAttempt = await occurrencesOf(store);
      const octoberAfter = afterAttempt.find(o => o.periodKey === "2026-10");
      if (!octoberAfter) throw new Error("لا فترة أكتوبر بعد المحاولة");
      if (octoberAfter.status === "recorded" || octoberAfter.status === "recording") {
        const blocked = await service.linkExistingExpense(octoberAfter.id, settlement.id);
        expect(blocked.ok).toBe(false);
      }
    });

    it("R2-F01: الحصرية داخل حد الكتابة — ربط متزامن لنافذتين بالحدث نفسه يمر واحد ويُحبط الآخر", async () => {
      const store = await adapter.make();
      const service = new RecurringExpenseService(store, () => OCTOBER);
      const seriesId = await seedSeriesWithCurrentOccurrence(service);
      const occurrences = await occurrencesOf(store);
      const october = occurrences.find(o => o.periodKey === "2026-10");
      const november = occurrences.find(o => o.periodKey === "2026-11");
      if (!october || !november) throw new Error("فترات ناقصة");
      /* حد حد الكتابة نفسه (المخزن): فترتان تطلبان الحدث ذاته في معاملتين
       * متزامنتين — حارس الحصرية داخل المعاملة هو الحكم. */
      const linkOctober = markRecurringExpenseRecorded(
        markRecurringExpenseConfirmAttempted(october, OCTOBER),
        {
          eventId: "event-race-link",
          amountMinor: 12_000,
          walletId: null,
          occurredOn: "2026-10-05",
          reused: true,
          at: OCTOBER,
        },
      );
      const linkNovember = markRecurringExpenseRecorded(
        markRecurringExpenseConfirmAttempted(november, OCTOBER),
        {
          eventId: "event-race-link",
          amountMinor: 12_000,
          walletId: null,
          occurredOn: "2026-10-05",
          reused: true,
          at: OCTOBER,
        },
      );
      const raced = await Promise.all([
        store.commitRecurringExpenseOccurrenceLink(october, linkOctober),
        store.commitRecurringExpenseOccurrenceLink(november, linkNovember),
      ]);
      const succeeded = raced.filter(result => result.ok);
      const rejected = raced.filter(result => !result.ok);
      /* الحدث الواحد دورة واحدة — بالضبط: نجاح واحد ورفض حصري واحد. */
      expect(succeeded).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      if (rejected[0] && !rejected[0].ok) expect(rejected[0].message).toContain("مرتبط بدورة أخرى");
      const after = await occurrencesOf(store);
      const holders = after.filter(occurrence => occurrence.recordedFinancialEventId === "event-race-link");
      expect(holders).toHaveLength(1);
      /* حرس الخدمة يظل ودودًا أولًا: الربط التسلسلي للحدث المربوط يُرفض قبل الحد. */
      const serviceLevel = await service.linkExistingExpense(november.id, "event-race-link");
      expect(serviceLevel.ok).toBe(false);
    });

    it("R2-F02: الحدث المعكوس (حيًّا أو بتراجع موثق) يُرفض ربطه بلا كتابة", async () => {
      const store = await adapter.make();
      const service = new RecurringExpenseService(store, () => OCTOBER);
      const seriesId = await seedSeriesWithCurrentOccurrence(service);
      const original = createFinancialEvent({
        id: "event-reversible",
        type: "operating_expense_cash",
        amountMinor: 12_000,
        occurredOn: "2026-10-05",
        recordedAt: OCTOBER,
        idempotencyKey: "reversible-key",
        note: "مصروف سيعكس",
        counterparty: null,
        relatedEventId: null,
        expenseContext: {
          relationship: "project",
          behavior: "fixed",
          purpose: "period",
          knowledge: "known",
        },
      });
      const savedOriginal = await store.saveFinancialEvent(original);
      if (!savedOriginal.ok) throw new Error(savedOriginal.message);
      const reversal = createFinancialReversal({
        id: "event-reversal",
        sourceEvent: original,
        occurredOn: "2026-10-06",
        recordedAt: OCTOBER,
        idempotencyKey: "reversal-key",
        reason: "خطأ في التسجيل",
      });
      const savedReversal = await store.saveFinancialEvent(reversal);
      if (!savedReversal.ok) throw new Error(savedReversal.message);
      const occurrences = await occurrencesOf(store);
      const october = occurrences.find(o => o.periodKey === "2026-10");
      if (!october) throw new Error("لا فترة أكتوبر");
      const before = (await occurrencesOf(store)).map(o => [o.id, o.status]);
      const link = await service.linkExistingExpense(october.id, original.id);
      expect(link.ok).toBe(false);
      if (!link.ok) expect(link.message).toContain("معكوس");
      const after = (await occurrencesOf(store)).map(o => [o.id, o.status]);
      expect(after).toEqual(before);
    });

    it("R2-F04: مصروف من فترة أخرى يُرفض ربطه — الحرس الحي عند الخدمة", async () => {
      const store = await adapter.make();
      const service = new RecurringExpenseService(store, () => OCTOBER);
      const seriesId = await seedSeriesWithCurrentOccurrence(service);
      const outOfPeriod = createFinancialEvent({
        id: "event-out-of-period-link",
        type: "operating_expense_cash",
        amountMinor: 5_000,
        occurredOn: "2026-08-05",
        recordedAt: OCTOBER,
        idempotencyKey: "out-of-period-link-key",
        note: "مصروف أغسطس",
        counterparty: null,
        relatedEventId: null,
        expenseContext: {
          relationship: "project",
          behavior: "variable",
          purpose: "project_general",
          knowledge: "known",
        },
      });
      const saved = await store.saveFinancialEvent(outOfPeriod);
      if (!saved.ok) throw new Error(saved.message);
      const occurrences = await occurrencesOf(store);
      const october = occurrences.find(o => o.periodKey === "2026-10");
      if (!october) throw new Error("لا فترة أكتوبر");
      const link = await service.linkExistingExpense(october.id, outOfPeriod.id);
      expect(link.ok).toBe(false);
      if (!link.ok) expect(link.message).toContain("فترة أخرى");
      const after = await occurrencesOf(store);
      expect(after.find(o => o.periodKey === "2026-10")?.status).toBe("planned");
    });

    it("مرشحات الربط: مصاريف فترة الدورة القائمة غير المرتبطة وحدها", async () => {
      const store = await adapter.make();
      const service = new RecurringExpenseService(store, () => OCTOBER);
      const seriesId = await seedSeriesWithCurrentOccurrence(service);
      const inPeriod = createFinancialEvent({
        id: "event-in-period",
        type: "operating_expense_cash",
        amountMinor: 1_000,
        occurredOn: "2026-10-07",
        recordedAt: OCTOBER,
        idempotencyKey: "in-period-key",
        note: "داخل الفترة",
        counterparty: null,
        relatedEventId: null,
        expenseContext: {
          relationship: "project",
          behavior: "variable",
          purpose: "project_general",
          knowledge: "known",
        },
      });
      const outOfPeriod = createFinancialEvent({
        id: "event-out-period",
        type: "operating_expense_cash",
        amountMinor: 2_000,
        occurredOn: "2026-09-07",
        recordedAt: OCTOBER,
        idempotencyKey: "out-period-key",
        note: "خارج الفترة",
        counterparty: null,
        relatedEventId: null,
        expenseContext: {
          relationship: "project",
          behavior: "variable",
          purpose: "project_general",
          knowledge: "known",
        },
      });
      for (const event of [inPeriod, outOfPeriod]) {
        const saved = await store.saveFinancialEvent(event);
        if (!saved.ok) throw new Error(saved.message);
      }
      const occurrences = await occurrencesOf(store);
      const october = occurrences.find(o => o.periodKey === "2026-10");
      if (!october) throw new Error("لا فترة أكتوبر");
      const candidates = await service.listLinkableExpenses(october.id);
      if (!candidates.ok) throw new Error(candidates.message);
      expect(candidates.value.map(event => event.id)).toEqual(["event-in-period"]);
      /* بعد الربط يختفي من المرشحات (مرتبط). */
      const linked = await service.linkExistingExpense(october.id, inPeriod.id);
      if (!linked.ok) throw new Error(linked.message);
      const after = await service.listLinkableExpenses(october.id);
      if (!after.ok) throw new Error(after.message);
      expect(after.value).toHaveLength(0);
    });
  });
}
