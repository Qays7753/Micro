import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { createFinancialEvent, createFinancialReversal } from "@micro-domain/financial-event/index.js";
import {
  addReceivedLoanRepayment,
  createReceivedLoanRecord,
  reverseReceivedLoanRepayment,
} from "@micro-domain/received-loan/index.js";
import { localExportVersion, localSchemaVersion } from "@/storage/local/types";

/* FIN-001 (WS-178 — Wave 6 / عقد ٣٩): مغلف التصدير ٣٠ — عائلة القروض
 * المستلمة داخل اللقطة والعدادات الصارمة ذهابًا وإيابًا؛ وملف ٢٩/٣٧ الموروث
 * يُقبل بلا اختراع قروض (الغياب = قائمة فارغة صادقة)؛ والملف المكسور
 * (معرّف مكرر / نوع مُقرض مجهول / استحقاق قبل القبض / دفعة بلا حدثها /
 * مصفوفة ليست مصفوفة / دفع فوق الأصل) يُرفض قبل أي استبدال — وبيانات هذا
 * الجهاز لا تُمس بعد أي رفض. */

const NOW = "2026-09-23T08:00:00.000Z";

function principalEvent(loanId: string, amountMinor: number, eventId: string) {
  return createFinancialEvent({
    id: eventId,
    type: "loan_received_cash",
    amountMinor,
    occurredOn: "2026-07-01",
    recordedAt: NOW,
    idempotencyKey: `${loanId}:principal`,
    note: "قرض مستلم",
    counterparty: "سامي",
    loanContext: { loanId, borrower: "سامي", lender: "سامي" },
  });
}

async function seedReceivedLoanFamily(store: MemoryLocalStore) {
  /* قرض أول: أصل + دفعة قائمة + دفعة معكوسة — العائلة كاملة التاريخ. */
  const firstEvent = principalEvent("rloan-1", 20_000, "event-1");
  const first = createReceivedLoanRecord({
    id: "rloan-1",
    lenderName: "سامي",
    lenderType: "person",
    principalMinor: 20_000,
    receivedOn: "2026-07-01",
    dueOn: "2026-12-01",
    note: "قرض معرفة",
    walletId: null,
    principalEventId: "event-1",
    operationKey: "rloan-1:create",
    createdAt: NOW,
  });
  const firstCommit = await store.commitReceivedLoanRecord(first, firstEvent);
  if (!firstCommit.ok) throw new Error(firstCommit.message);
  const activeRepayment = createFinancialEvent({
    id: "event-rep-1",
    type: "loan_received_repayment_cash",
    amountMinor: 8_000,
    occurredOn: "2026-08-01",
    recordedAt: NOW,
    idempotencyKey: "rloan-1:repayment:rrep-1",
    note: "دفعة أولى",
    counterparty: "سامي",
    loanContext: { loanId: "rloan-1", borrower: "سامي", lender: "سامي" },
  });
  const reversedRepayment = createFinancialEvent({
    id: "event-rep-2",
    type: "loan_received_repayment_cash",
    amountMinor: 2_000,
    occurredOn: "2026-08-05",
    recordedAt: NOW,
    idempotencyKey: "rloan-1:repayment:rrep-2",
    note: "دفعة ثانية",
    counterparty: "سامي",
    loanContext: { loanId: "rloan-1", borrower: "سامي", lender: "سامي" },
  });
  let withRepayments = addReceivedLoanRepayment(
    first,
    { repaymentId: "rrep-1", amountMinor: 8_000, date: "2026-08-01", eventId: "event-rep-1" },
    NOW,
  );
  const repaidCommit = await store.commitReceivedLoanRecord(withRepayments, activeRepayment);
  if (!repaidCommit.ok) throw new Error(repaidCommit.message);
  withRepayments = addReceivedLoanRepayment(
    withRepayments,
    { repaymentId: "rrep-2", amountMinor: 2_000, date: "2026-08-05", eventId: "event-rep-2" },
    NOW,
  );
  const secondCommit = await store.commitReceivedLoanRecord(withRepayments, reversedRepayment);
  if (!secondCommit.ok) throw new Error(secondCommit.message);
  const repaymentReversal = createFinancialReversal({
    id: "event-rep-2-rev",
    sourceEvent: reversedRepayment,
    occurredOn: "2026-08-06",
    recordedAt: NOW,
    idempotencyKey: "rloan-1:repayment-reversal:rrep-2",
    reason: "خرجت من المحفظة الخطأ",
  });
  const reversedLoan = reverseReceivedLoanRepayment(
    withRepayments,
    "rrep-2",
    "خرجت من المحفظة الخطأ",
    NOW,
    "event-rep-2-rev",
  );
  const reversalCommit = await store.commitReceivedLoanRecord(reversedLoan, repaymentReversal);
  if (!reversalCommit.ok) throw new Error(reversalCommit.message);
  /* قرض ثانٍ: مصحح (عكس + بديل) — دفتر مؤسسة بأصل معدَّل موثقًا. */
  const secondEvent = principalEvent("rloan-2", 50_000, "event-2");
  const second = createReceivedLoanRecord({
    id: "rloan-2",
    lenderName: "مؤسسة النور",
    lenderType: "institution",
    principalMinor: 50_000,
    receivedOn: "2026-07-02",
    dueOn: null,
    note: null,
    walletId: null,
    principalEventId: "event-2",
    operationKey: "rloan-2:create",
    createdAt: NOW,
  });
  const secondLoanCommit = await store.commitReceivedLoanRecord(second, secondEvent);
  if (!secondLoanCommit.ok) throw new Error(secondLoanCommit.message);
  const principalReversal = createFinancialReversal({
    id: "event-2-rev",
    sourceEvent: secondEvent,
    occurredOn: "2026-07-03",
    recordedAt: NOW,
    idempotencyKey: "rloan-2:principal-reversal:1",
    reason: "المبلغ الصحيح أعلى",
  });
  const replacement = createFinancialEvent({
    id: "event-2-new",
    type: "loan_received_cash",
    amountMinor: 60_000,
    occurredOn: "2026-07-02",
    recordedAt: NOW,
    idempotencyKey: "rloan-2:principal-replacement:1",
    note: "تصحيح قرض مستلم",
    counterparty: "مؤسسة النور",
    loanContext: { loanId: "rloan-2", borrower: "مؤسسة النور", lender: "مؤسسة النور" },
  });
  const corrected = {
    ...second,
    principalMinor: 60_000,
    principalEventId: "event-2-new",
    corrections: [{ reason: "المبلغ الصحيح أعلى", at: NOW }],
    updatedAt: NOW,
  };
  const correctionCommit = await store.commitReceivedLoanCorrection(
    corrected,
    principalReversal,
    replacement,
  );
  if (!correctionCommit.ok) throw new Error(correctionCommit.message);
  return { reversedLoan, corrected };
}

/** ملف ٢٩/٣٧ كما صدر فعلًا من FIN-002 — بعائلة الميزانيات وبلا عائلة القروض المستلمة. */
function legacy2937File(): Record<string, unknown> {
  return {
    format: "micro-prototype-local-export",
    version: 29,
    schemaVersion: 37,
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
      recurringExpenseSeries: [],
      recurringExpenseRevisions: [],
      recurringExpenseOccurrences: [],
      expenseBudgets: [],
      /* لا receivedLoans هنا عمدًا — الزوج صدر قبل FIN-001. */
    },
  };
}

function tamperedCopy(file: Record<string, unknown>): Record<string, unknown> {
  const copy = JSON.parse(JSON.stringify(file)) as Record<string, unknown>;
  copy.integrity = undefined;
  copy.counts = undefined;
  return copy;
}

describe("export envelope v30 (FIN-001 — WS-178 / عقد ٣٩)", () => {
  it("round-trips the received-loan family verbatim through a verified export (deep-equal snapshot)", async () => {
    const store = new MemoryLocalStore();
    const { reversedLoan, corrected } = await seedReceivedLoanFamily(store);
    const sourceSnapshot = await store.readSnapshot();
    if (!sourceSnapshot.ok) throw new Error(sourceSnapshot.message);
    const service = new LocalTransferService(store, () => NOW);
    const exported = await service.createVerifiedExport();
    if (!exported.ok) throw new Error(exported.message);
    expect(exported.value.file.version).toBe(30);
    expect(exported.value.file.schemaVersion).toBe(38);
    expect(exported.value.file.version).toBe(localExportVersion);
    expect(exported.value.file.schemaVersion).toBe(localSchemaVersion);
    expect(exported.value.file.data.receivedLoans).toHaveLength(2);
    expect(exported.value.file.counts?.receivedLoans).toBe(2);
    expect(exported.value.summary.receivedLoans).toBe(2);

    const target = new MemoryLocalStore();
    const targetService = new LocalTransferService(target, () => NOW);
    const restored = await targetService.prepareImport(JSON.stringify(exported.value.file));
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error(restored.message);
    const applied = await targetService.confirmImport(restored.value);
    if (!applied.ok) throw new Error(applied.message);
    /* الدورة الكاملة: اللقطة المستعادة تطابق لقطة المصدر حرفيًا — والمقارنة
     * عبر تمثيل الملف نفسه (JSON): التراجعات تحمل -0 في الذاكرة، وJSON لا
     * يميّز -0 من 0 فلا يمكن لأي ملف نقلها؛ القيمة المالية واحدة. */
    const targetSnapshot = await target.readSnapshot();
    if (!targetSnapshot.ok) throw new Error(targetSnapshot.message);
    expect(targetSnapshot.value).toEqual(JSON.parse(JSON.stringify(sourceSnapshot.value)));
    const loansAfter = await target.listReceivedLoans();
    expect(loansAfter.ok && loansAfter.value).toHaveLength(2);
    const restoredFirst = loansAfter.ok ? loansAfter.value.find(loan => loan.id === "rloan-1") : undefined;
    expect(restoredFirst?.dueOn).toBe("2026-12-01");
    expect(restoredFirst?.repayments).toHaveLength(2);
    expect(restoredFirst?.repayments[1]?.reversal?.reversalEventId).toBe("event-rep-2-rev");
    expect(restoredFirst?.repayments[1]?.amountMinor).toBe(2_000);
    expect(reversedLoan.repayments[1]?.reversal?.reversalEventId).toBe("event-rep-2-rev");
    const restoredSecond = loansAfter.ok ? loansAfter.value.find(loan => loan.id === "rloan-2") : undefined;
    expect(restoredSecond?.lenderType).toBe("institution");
    expect(restoredSecond?.principalMinor).toBe(corrected.principalMinor);
    expect(restoredSecond?.corrections).toHaveLength(1);
    /* التزام الاقتراض محفوظ في الأحداث نفسها: 20000 − 8000 (الدفعة القائمة وحدها). */
    const eventsAfter = await target.listFinancialEvents();
    expect(
      eventsAfter.ok && eventsAfter.value.reduce((sum, event) => sum + (event.loanPayableDeltaMinor ?? 0), 0),
    ).toBe(20_000 - 8_000 + 60_000);
  });

  it("accepts a legacy 29/37 file and seeds empty received loans (migration v37→v38 never invents borrowing)", async () => {
    const target = new MemoryLocalStore();
    const service = new LocalTransferService(target, () => NOW);
    const prepared = service.prepareImport(JSON.stringify(legacy2937File()));
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error(prepared.message);
    expect(prepared.value.file.version).toBe(localExportVersion);
    expect(prepared.value.file.schemaVersion).toBe(localSchemaVersion);
    expect(prepared.value.file.data.receivedLoans).toEqual([]);
    expect(prepared.value.summary.receivedLoans).toBe(0);
    /* ملف ٢٩/٣٧ بلا مظروف تكامل — على مساره الموروث كما صدر فعلًا. */
    const applied = await service.confirmImport(prepared.value);
    expect(applied.ok).toBe(true);
    const loans = await target.listReceivedLoans();
    expect(loans.ok && loans.value).toHaveLength(0);
    /* لا تاريخ مخترع: لا أحداث قروض مستلمة أبدًا. */
    const events = await target.listFinancialEvents();
    expect(
      events.ok &&
        events.value.filter(
          event => event.type === "loan_received_cash" || event.type === "loan_received_repayment_cash",
        ).length,
    ).toBe(0);
  });

  it("rejects each malformed received-loan family before replacement and leaves stored data untouched", async () => {
    const store = new MemoryLocalStore();
    await seedReceivedLoanFamily(store);
    const service = new LocalTransferService(store, () => NOW);
    const exported = await service.createVerifiedExport();
    if (!exported.ok) throw new Error(exported.message);
    const before = await store.readSnapshot();
    expect(before.ok).toBe(true);
    if (!before.ok) throw new Error(before.message);

    /* ١) معرّف مكرر: سجلان يحملان المعرّف نفسه. */
    const duplicateId = tamperedCopy(exported.value.file as unknown as Record<string, unknown>);
    const duplicateIdData = duplicateId.data as Record<string, unknown>;
    const duplicateIdLoans = duplicateIdData.receivedLoans as Record<string, unknown>[];
    duplicateIdLoans.push(structuredClone(duplicateIdLoans[0]));
    expect(service.prepareImport(JSON.stringify(duplicateId)).ok).toBe(false);

    /* ٢) نوع مُقرض غير معروف — النوع الاقتصادي اختيار صريح من ثلاثة فقط. */
    const badType = tamperedCopy(exported.value.file as unknown as Record<string, unknown>);
    const badTypeData = badType.data as Record<string, unknown>;
    (badTypeData.receivedLoans as Record<string, unknown>[])[0] = {
      ...((badTypeData.receivedLoans as Record<string, unknown>[])[0] as Record<string, unknown>),
      lenderType: "bank",
    };
    expect(service.prepareImport(JSON.stringify(badType)).ok).toBe(false);

    /* ٣) استحقاق يسبق القبض — وسم العرض متماسك زمنيًا رغم أنه غير مالي. */
    const earlyDue = tamperedCopy(exported.value.file as unknown as Record<string, unknown>);
    const earlyDueData = earlyDue.data as Record<string, unknown>;
    (earlyDueData.receivedLoans as Record<string, unknown>[])[0] = {
      ...((earlyDueData.receivedLoans as Record<string, unknown>[])[0] as Record<string, unknown>),
      dueOn: "2026-06-01",
    };
    expect(service.prepareImport(JSON.stringify(earlyDue)).ok).toBe(false);

    /* ٤) دفعة بلا حدثها المالي في الملف — سجل بلا حقيقته يُرفض. */
    const orphanRepayment = tamperedCopy(exported.value.file as unknown as Record<string, unknown>);
    const orphanData = orphanRepayment.data as Record<string, unknown>;
    const orphanLoans = orphanData.receivedLoans as Record<string, unknown>[];
    const orphanFirst = orphanLoans[0] as { repayments: Record<string, unknown>[] };
    orphanFirst.repayments[0] = { ...orphanFirst.repayments[0], eventId: "event-ghost" };
    expect(service.prepareImport(JSON.stringify(orphanRepayment)).ok).toBe(false);

    /* ٥) مصفوفة غير مصفوفة: عائلة القروض المستلمة شيء آخر غير مصفوفة. */
    const notArray = tamperedCopy(exported.value.file as unknown as Record<string, unknown>);
    (notArray.data as Record<string, unknown>).receivedLoans = { nope: true };
    expect(service.prepareImport(JSON.stringify(notArray)).ok).toBe(false);

    /* ٦) دفع فوق الأصل: مجموع التزام الاقتراض في أحداث الملف يصبح سالبًا. */
    const overRepay = tamperedCopy(exported.value.file as unknown as Record<string, unknown>);
    const overRepayData = overRepay.data as Record<string, unknown>;
    const overRepayEvents = overRepayData.financialEvents as Record<string, unknown>[];
    const repaymentEvent = overRepayEvents.find(
      event => event.type === "loan_received_repayment_cash" && !event.correctionType,
    ) as Record<string, unknown>;
    repaymentEvent.amountMinor = 90_000;
    repaymentEvent.cashDeltaMinor = -90_000;
    repaymentEvent.loanPayableDeltaMinor = -90_000;
    expect(service.prepareImport(JSON.stringify(overRepay)).ok).toBe(false);

    /* ٧) حدث قرض مستلم بسياق يتيم (قرض غير موجود في أي بيت) — يُرفض. */
    const orphanContext = tamperedCopy(exported.value.file as unknown as Record<string, unknown>);
    const orphanContextData = orphanContext.data as Record<string, unknown>;
    const orphanContextEvents = orphanContextData.financialEvents as Record<string, unknown>[];
    const principalEventRecord = orphanContextEvents.find(
      event => event.type === "loan_received_cash",
    ) as Record<string, unknown>;
    const context = principalEventRecord.loanContext as Record<string, unknown>;
    context.loanId = "rloan-ghost";
    expect(service.prepareImport(JSON.stringify(orphanContext)).ok).toBe(false);

    /* ٨) بيانات هذا الجهاز لم تتغير بعد أي رفض. */
    const after = await store.readSnapshot();
    expect(after.ok).toBe(true);
    if (!after.ok) throw new Error(after.message);
    expect(after.value).toEqual(before.value);
  });
});
