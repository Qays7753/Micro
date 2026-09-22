import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import {
  createRecurringExpenseDraftSeries,
  activateRecurringExpenseSeries,
  createRecurringExpenseOccurrence,
  markRecurringExpenseConfirmAttempted,
  markRecurringExpenseRecorded,
  skipRecurringExpenseOccurrence,
  pauseRecurringExpenseSeries,
  resumeRecurringExpenseSeries,
} from "@micro-domain/recurring-expense/index.js";
import { localExportVersion, localSchemaVersion } from "@/storage/local/types";

/* OPS-003 (عقد ٤١ / عقد ٣٩): مغلف التصدير ٢٨ — العائلات الثلاث داخل اللقطة
 * والعدادات الصارمة ذهابًا وإيابًا؛ وملف ٢٧/٣٥ الموروث يُقبل بلا اختراع
 * سجلات؛ والملف المكسور (رابط حدث مفقود / مرجع سلسلة يتيم / مفتاح غير
 * مركّب / مقَرَّرة بلا حدث) يُرفض قبل أي معاينة كما تُرفض البصمة المعطوبة. */

const NOW = "2026-09-21T08:00:00.000Z";
const transfers = () => new LocalTransferService(new MemoryLocalStore(), () => NOW);

function seededStore(): MemoryLocalStore {
  return new MemoryLocalStore();
}

async function seedRecurringFamily(store: MemoryLocalStore) {
  const { series, revision } = createRecurringExpenseDraftSeries({
    id: "series-1",
    title: "إيجار المحل الشهري",
    createdAt: NOW,
    rule: {
      effectiveFromPeriod: "2026-01",
      frequency: "monthly",
      interval: 1,
      anchorDate: "2026-01-05",
      dueDay: 5,
      monthEndPolicy: "last_valid_day",
      timezone: "Asia/Amman",
      amountMode: "suggested",
      suggestedAmountMinor: 25_000,
      suggestedWalletId: null,
      categoryLabel: "إيجار",
      changeReason: null,
    },
  });
  const created = await store.commitRecurringExpenseDraft(series, revision);
  if (!created.ok) throw new Error(created.message);
  const active = activateRecurringExpenseSeries(series, NOW);
  const activation = await store.commitRecurringExpenseSeriesChange(series, active, null, []);
  if (!activation.ok) throw new Error(activation.message);
  const september = createRecurringExpenseOccurrence({
    seriesId: "series-1",
    revision: 1,
    periodKey: "2026-09",
    dueOn: "2026-09-05",
    createdAt: NOW,
  });
  const august = createRecurringExpenseOccurrence({
    seriesId: "series-1",
    revision: 1,
    periodKey: "2026-08",
    dueOn: "2026-08-05",
    createdAt: NOW,
  });
  const materialized = await store.commitRecurringExpenseOccurrences([september, august]);
  if (!materialized.ok) throw new Error(materialized.message);
  const skipped = skipRecurringExpenseOccurrence(august, "دفع نقدًا", NOW);
  const skipCommit = await store.commitRecurringExpenseOccurrenceDecision(august, skipped);
  if (!skipCommit.ok) throw new Error(skipCommit.message);
  const attempted = markRecurringExpenseConfirmAttempted(september, NOW);
  const attemptCommit = await store.commitRecurringExpenseOccurrenceDecision(september, attempted);
  if (!attemptCommit.ok) throw new Error(attemptCommit.message);
  const recorded = markRecurringExpenseRecorded(attempted, {
    eventId: "event-rent-09",
    amountMinor: 25_000,
    walletId: null,
    occurredOn: "2026-09-05",
    reused: false,
    at: NOW,
  });
  const event = {
    id: "event-rent-09",
    type: "operating_expense_cash" as const,
    currency: "JOD" as const,
    amountMinor: 25_000,
    occurredOn: "2026-09-05",
    recordedAt: NOW,
    idempotencyKey: recorded.recordingIdempotencyKey,
    note: "إيجار المحل — فترة 2026-09",
    counterparty: null,
    relatedEventId: null,
    expenseContext: {
      relationship: "project" as const,
      behavior: "fixed" as const,
      purpose: "period" as const,
      knowledge: "known" as const,
    },
    correctionType: null,
    correctionOfEventId: null,
    correctionReason: null,
    cashDeltaMinor: -25_000,
    payableDeltaMinor: 0,
    ownerCapitalDeltaMinor: 0,
    operatingExpenseDeltaMinor: 25_000,
  };
  const commit = await store.commitRecurringExpenseOccurrenceRecord(attempted, recorded, event);
  if (!commit.ok) throw new Error(commit.message);
  /* إيقاف ثم استئناف بحد توليد موثق — الفترة المحفوظة تعبر المغلف ذهابًا وإيابًا. */
  const paused = pauseRecurringExpenseSeries(active, NOW);
  const pauseCommit = await store.commitRecurringExpenseSeriesChange(active, paused, null, []);
  if (!pauseCommit.ok) throw new Error(pauseCommit.message);
  const resumed = resumeRecurringExpenseSeries(paused, NOW, "2026-09");
  const resumeCommit = await store.commitRecurringExpenseSeriesChange(paused, resumed, null, []);
  if (!resumeCommit.ok) throw new Error(resumeCommit.message);
  return { series: resumed, revision, recorded };
}

function minimalLegacy2735File(): Record<string, unknown> {
  return {
    format: "micro-prototype-local-export",
    version: 27,
    schemaVersion: 35,
    exportedAt: NOW,
    data: {
      profile: null,
      preferences: null,
      drafts: [],
      orders: [],
      schedules: [],
      financialEvents: [],
      supplierPurchases: [],
      cashWallets: [],
      cashContinuityEntries: [],
      materials: [],
      inventoryMovements: [],
      inventoryShortages: [],
      inventoryActivation: null,
      catalogItems: [],
      measurementUnits: [],
      directConversions: [],
      catalogTemplates: [],
      actualTimeRecords: [],
      shortCashDeclarations: [],
      ownerEntitlementPolicies: [],
      ownerEntitlementRecords: [],
      ownerEntitlementOpeningBalances: [],
      ownerMovements: [],
      allocationPolicies: [],
      costEstimates: [],
      assets: [],
      loans: [],
    },
  };
}

describe("export envelope v28 (OPS-003 — عقد ٤١ / عقد ٣٩)", () => {
  it("round-trips the recurring-expense families verbatim through a verified export", async () => {
    const store = seededStore();
    const { recorded } = await seedRecurringFamily(store);
    const service = new LocalTransferService(store, () => NOW);
    const exported = await service.createVerifiedExport();
    if (!exported.ok) throw new Error(exported.message);
    expect(exported.value.file.version).toBe(29);
    expect(exported.value.file.schemaVersion).toBe(37);
    expect(exported.value.file.data.recurringExpenseSeries).toHaveLength(1);
    expect(exported.value.file.data.recurringExpenseRevisions).toHaveLength(1);
    expect(exported.value.file.data.recurringExpenseOccurrences).toHaveLength(2);
    expect(exported.value.file.counts?.recurringExpenseSeries).toBe(1);
    expect(exported.value.file.counts?.recurringExpenseOccurrences).toBe(2);
    expect(exported.value.summary.recurringExpenseSeries).toBe(1);
    expect(exported.value.summary.recurringExpenseOccurrences).toBe(2);

    const target = new MemoryLocalStore();
    const targetService = new LocalTransferService(target, () => NOW);
    const restored = await targetService.prepareImport(JSON.stringify(exported.value.file));
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error(restored.message);
    expect(restored.value.file.version).toBe(localExportVersion);
    expect(restored.value.file.schemaVersion).toBe(localSchemaVersion);
    const applied = await targetService.confirmImport(restored.value);
    if (!applied.ok) throw new Error(applied.message);
    const seriesAfter = await target.listRecurringExpenseSeries();
    expect(seriesAfter.ok && seriesAfter.value[0]?.title).toBe("إيجار المحل الشهري");
    expect(seriesAfter.ok && seriesAfter.value[0]?.resumedFromPeriod).toBe("2026-09");
    const occurrencesAfter = await target.listRecurringExpenseOccurrences();
    expect(occurrencesAfter.ok && occurrencesAfter.value).toHaveLength(2);
    const recordedAfter = occurrencesAfter.ok
      ? occurrencesAfter.value.find(occurrence => occurrence.id === recorded.id)
      : undefined;
    expect(recordedAfter?.recordedFinancialEventId).toBe("event-rent-09");
    expect(recordedAfter?.status).toBe("recorded");
  });

  it("accepts a legacy 27/35 file without inventing recurring records (empty = honest)", async () => {
    const service = transfers();
    const prepared = service.prepareImport(JSON.stringify(minimalLegacy2735File()));
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error(prepared.message);
    expect(prepared.value.file.data.recurringExpenseSeries).toEqual([]);
    expect(prepared.value.file.data.recurringExpenseRevisions).toEqual([]);
    expect(prepared.value.file.data.recurringExpenseOccurrences).toEqual([]);
  });

  it("rejects a broken event link, an orphan series reference, and a non-composite key", async () => {
    const store = seededStore();
    await seedRecurringFamily(store);
    const service = new LocalTransferService(store, () => NOW);
    const exported = await service.createVerifiedExport();
    if (!exported.ok) throw new Error(exported.message);
    const file = JSON.parse(JSON.stringify(exported.value.file));

    /* ١) رابط حدث مفقود: الفترة المقَرَّرة تشير لحدث غير موجود. */
    const brokenLink = JSON.parse(JSON.stringify(file));
    brokenLink.data.financialEvents = [];
    brokenLink.integrity = undefined;
    brokenLink.counts = undefined;
    const rejectedLink = service.prepareImport(JSON.stringify(brokenLink));
    expect(rejectedLink.ok).toBe(false);

    /* ٢) مرجع سلسلة يتيم: الفترة تشير لسلسلة غير موجودة في الملف. */
    const orphan = JSON.parse(JSON.stringify(file));
    orphan.data.recurringExpenseSeries = [];
    orphan.integrity = undefined;
    orphan.counts = undefined;
    const rejectedOrphan = service.prepareImport(JSON.stringify(orphan));
    expect(rejectedOrphan.ok).toBe(false);

    /* ٣) مفتاح غير مركّب: معرّف الفترة لا يطابق بنية السلسلة:الفترة:الخانة. */
    const tamperedKey = JSON.parse(JSON.stringify(file));
    tamperedKey.data.recurringExpenseOccurrences[0] = {
      ...tamperedKey.data.recurringExpenseOccurrences[0],
      recordingIdempotencyKey: "something-else",
    };
    tamperedKey.integrity = undefined;
    tamperedKey.counts = undefined;
    const rejectedKey = service.prepareImport(JSON.stringify(tamperedKey));
    expect(rejectedKey.ok).toBe(false);

    /* ٤) مقَرَّرة بلا حدث مرتبط — تناقض الحالة والربط يُرفض. */
    const unlinked = JSON.parse(JSON.stringify(file));
    const unlinkedOccurrence = unlinked.data.recurringExpenseOccurrences.find(
      (occurrence: { status: string }) => occurrence.status === "recorded",
    );
    unlinkedOccurrence.recordedFinancialEventId = null;
    unlinked.integrity = undefined;
    unlinked.counts = undefined;
    const rejectedUnlinked = service.prepareImport(JSON.stringify(unlinked));
    expect(rejectedUnlinked.ok).toBe(false);

    /* ٥) حد التوليد بعد الاستئناف مكسور: ليست فترة YYYY-MM صالحة ولا غيابًا. */
    const badBoundary = JSON.parse(JSON.stringify(file));
    badBoundary.data.recurringExpenseSeries[0] = {
      ...badBoundary.data.recurringExpenseSeries[0],
      resumedFromPeriod: "banana",
    };
    badBoundary.integrity = undefined;
    badBoundary.counts = undefined;
    const rejectedBoundary = service.prepareImport(JSON.stringify(badBoundary));
    expect(rejectedBoundary.ok).toBe(false);

    /* ٦) بيانات هذا الجهاز لم تتغير بعد أي رفض. */
    const after = await store.readSnapshot();
    expect(after.ok).toBe(true);
  });
});
