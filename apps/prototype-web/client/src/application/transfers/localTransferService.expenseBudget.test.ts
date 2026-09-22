import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { createExpenseBudget, reviseExpenseBudget } from "@micro-domain/budget/index.js";
import { localExportVersion, localSchemaVersion } from "@/storage/local/types";

/* FIN-002 (عقد ٤٢ / عقد ٣٩): مغلف التصدير ٢٩ — عائلة الميزانيات داخل اللقطة
 * والعدادات الصارمة ذهابًا وإيابًا؛ وملف ٢٨/٣٦ الموروث يُقبل بلا اختراع
 * ميزانيات (الغياب = قائمة فارغة صادقة)؛ والملف المكسور (معرّف مكرر /
 * مفتاح عملية مكرر / مفتاح فترة غير صالح / رابط خلف مكسور / مغلق بلا علة /
 * نافذ برابط خلف) يُرفض قبل أي استبدال كما تُرفض البصمة المعطوبة — وبيانات
 * هذا الجهاز لا تُمس بعد أي رفض. */

const NOW = "2026-09-22T08:00:00.000Z";

async function seedBudgetFamily(store: MemoryLocalStore) {
  const general = createExpenseBudget(
    {
      id: "budget-general-10",
      periodKind: "month",
      periodKey: "2026-10",
      scope: { kind: "general_expense" },
      amountMinor: 30_000,
      knowledge: "known",
      note: "سقف شهري عام",
      operationKey: "op-create-general",
      createdAt: NOW,
    },
    [],
  );
  const fuel = createExpenseBudget(
    {
      id: "budget-fuel-11",
      periodKind: "month",
      periodKey: "2026-11",
      scope: { kind: "category", categoryLabel: "بنزين" },
      amountMinor: 8_000,
      knowledge: "estimated",
      note: null,
      operationKey: "op-create-fuel",
      createdAt: NOW,
    },
    [],
  );
  const december = createExpenseBudget(
    {
      id: "budget-tools-12",
      periodKind: "month",
      periodKey: "2026-12",
      scope: { kind: "category", categoryLabel: "أدوات" },
      amountMinor: 20_000,
      knowledge: "known",
      note: null,
      operationKey: "op-create-tools",
      createdAt: NOW,
    },
    [],
  );
  for (const budget of [general, fuel, december]) {
    const saved = await store.saveExpenseBudget(budget);
    if (!saved.ok) throw new Error(saved.message);
  }
  /* زوج مراجعة واحد: الخلف النافذ والسابقة المستبدلة — التاريخ لا يُعاد كتابته. */
  const pair = reviseExpenseBudget(december, {
    successorId: "budget-tools-12-r2",
    amountMinor: 25_000,
    knowledge: "known",
    note: "بعد شراء منشار جديد",
    operationKey: "op-revise-tools",
    at: NOW,
  });
  const committed = await store.saveExpenseBudgetRevisionPair(pair.successor, pair.supersededPrevious);
  if (!committed.ok) throw new Error(committed.message);
  return { general, fuel, pair };
}

/** ملف ٢٨/٣٦ كما صدر فعلًا من OPS-003 — بعائلات المصروف المتكرر وبلا عائلة الميزانيات. */
function legacy2836File(): Record<string, unknown> {
  return {
    format: "micro-prototype-local-export",
    version: 28,
    schemaVersion: 36,
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
      /* لا expenseBudgets هنا عمدًا — الزوج صدر قبل عقد ٤٢. */
    },
  };
}

function tamperedCopy(file: Record<string, unknown>): Record<string, unknown> {
  const copy = JSON.parse(JSON.stringify(file)) as Record<string, unknown>;
  copy.integrity = undefined;
  copy.counts = undefined;
  return copy;
}

describe("export envelope v29 (FIN-002 — عقد ٤٢ / عقد ٣٩)", () => {
  it("round-trips the expense-budget family verbatim through a verified export (deep-equal snapshot)", async () => {
    const store = new MemoryLocalStore();
    await seedBudgetFamily(store);
    const sourceSnapshot = await store.readSnapshot();
    if (!sourceSnapshot.ok) throw new Error(sourceSnapshot.message);
    const service = new LocalTransferService(store, () => NOW);
    const exported = await service.createVerifiedExport();
    if (!exported.ok) throw new Error(exported.message);
    expect(exported.value.file.version).toBe(29);
    expect(exported.value.file.schemaVersion).toBe(37);
    expect(exported.value.file.version).toBe(localExportVersion);
    expect(exported.value.file.schemaVersion).toBe(localSchemaVersion);
    expect(exported.value.file.data.expenseBudgets).toHaveLength(4);
    expect(exported.value.file.counts?.expenseBudgets).toBe(4);
    expect(exported.value.summary.expenseBudgets).toBe(4);

    const target = new MemoryLocalStore();
    const targetService = new LocalTransferService(target, () => NOW);
    const restored = await targetService.prepareImport(JSON.stringify(exported.value.file));
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error(restored.message);
    const applied = await targetService.confirmImport(restored.value);
    if (!applied.ok) throw new Error(applied.message);
    /* الدورة الكاملة: اللقطة المستعادة تطابق لقطة المصدر حرفيًا. */
    const targetSnapshot = await target.readSnapshot();
    if (!targetSnapshot.ok) throw new Error(targetSnapshot.message);
    expect(targetSnapshot.value).toEqual(sourceSnapshot.value);
    const budgetsAfter = await target.listExpenseBudgets();
    expect(budgetsAfter.ok && budgetsAfter.value).toHaveLength(4);
    const superseded = budgetsAfter.ok
      ? budgetsAfter.value.find(budget => budget.id === "budget-tools-12")
      : undefined;
    expect(superseded?.status).toBe("superseded");
    expect(superseded?.supersededById).toBe("budget-tools-12-r2");
    expect(superseded?.amountMinor).toBe(20_000);
  });

  it("accepts a legacy 28/36 file and seeds empty budgets (migration v36→v37 never invents plans)", async () => {
    const target = new MemoryLocalStore();
    const service = new LocalTransferService(target, () => NOW);
    const prepared = service.prepareImport(JSON.stringify(legacy2836File()));
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error(prepared.message);
    expect(prepared.value.file.version).toBe(localExportVersion);
    expect(prepared.value.file.schemaVersion).toBe(localSchemaVersion);
    expect(prepared.value.file.data.expenseBudgets).toEqual([]);
    expect(prepared.value.summary.expenseBudgets).toBe(0);
    /* ملف ٢٨/٣٦ بلا مظروف تكامل — على مساره الموروث كما صدر فعلًا. */
    const applied = await service.confirmImport(prepared.value);
    expect(applied.ok).toBe(true);
    const budgets = await target.listExpenseBudgets();
    expect(budgets.ok && budgets.value).toHaveLength(0);
  });

  it("rejects each malformed budget family before replacement and leaves stored data untouched", async () => {
    const store = new MemoryLocalStore();
    await seedBudgetFamily(store);
    const service = new LocalTransferService(store, () => NOW);
    const exported = await service.createVerifiedExport();
    if (!exported.ok) throw new Error(exported.message);
    const before = await store.readSnapshot();
    expect(before.ok).toBe(true);
    if (!before.ok) throw new Error(before.message);

    /* ١) معرّف مكرر: سجلان يحملان المعرّف نفسه. */
    const duplicateId = tamperedCopy(exported.value.file as unknown as Record<string, unknown>);
    const duplicateIdData = duplicateId.data as Record<string, unknown>;
    const budgets = duplicateIdData.expenseBudgets as Record<string, unknown>[];
    budgets.push({ ...structuredClone(budgets[0]) });
    expect(service.prepareImport(JSON.stringify(duplicateId)).ok).toBe(false);

    /* ٢) مفتاح عملية مكرر: سجلان بمفتاح العملية نفسه. */
    const duplicateKey = tamperedCopy(exported.value.file as unknown as Record<string, unknown>);
    const duplicateKeyData = duplicateKey.data as Record<string, unknown>;
    const keyBudgets = duplicateKeyData.expenseBudgets as Record<string, unknown>[];
    keyBudgets.push({ ...structuredClone(keyBudgets[0]), id: "budget-dup-key" });
    expect(service.prepareImport(JSON.stringify(duplicateKey)).ok).toBe(false);

    /* ٣) مفتاح فترة غير صالح: ليس YYYY-MM. */
    const badPeriod = tamperedCopy(exported.value.file as unknown as Record<string, unknown>);
    const badPeriodData = badPeriod.data as Record<string, unknown>;
    (badPeriodData.expenseBudgets as Record<string, unknown>[])[0] = {
      ...((badPeriodData.expenseBudgets as Record<string, unknown>[])[0] as Record<string, unknown>),
      periodKey: "2026-13",
    };
    expect(service.prepareImport(JSON.stringify(badPeriod)).ok).toBe(false);

    /* ٤) رابط خلف مكسور: المستبدلة تشير لخلف غير موجود في الملف. */
    const brokenLink = tamperedCopy(exported.value.file as unknown as Record<string, unknown>);
    const brokenLinkData = brokenLink.data as Record<string, unknown>;
    const linkBudgets = brokenLinkData.expenseBudgets as Record<string, unknown>[];
    const supersededRecord = linkBudgets.find(budget => budget.status === "superseded") as Record<
      string,
      unknown
    >;
    supersededRecord.supersededById = "budget-ghost";
    expect(service.prepareImport(JSON.stringify(brokenLink)).ok).toBe(false);

    /* ٥) مغلق بلا علة موثقة. */
    const closedNoReason = tamperedCopy(exported.value.file as unknown as Record<string, unknown>);
    const closedNoReasonData = closedNoReason.data as Record<string, unknown>;
    (closedNoReasonData.expenseBudgets as Record<string, unknown>[])[0] = {
      ...((closedNoReasonData.expenseBudgets as Record<string, unknown>[])[0] as Record<string, unknown>),
      status: "closed",
      closedAt: NOW,
      closeReason: null,
    };
    expect(service.prepareImport(JSON.stringify(closedNoReason)).ok).toBe(false);

    /* ٦) نافذ يحمل رابط خلف — الرابط صفة المستبدلة وحدها. */
    const activeWithLink = tamperedCopy(exported.value.file as unknown as Record<string, unknown>);
    const activeWithLinkData = activeWithLink.data as Record<string, unknown>;
    (activeWithLinkData.expenseBudgets as Record<string, unknown>[])[0] = {
      ...((activeWithLinkData.expenseBudgets as Record<string, unknown>[])[0] as Record<string, unknown>),
      supersededById: "budget-tools-12-r2",
    };
    expect(service.prepareImport(JSON.stringify(activeWithLink)).ok).toBe(false);

    /* ٧) مصفوفة غير مصفوفة: عائلة الميزانيات شيء آخر غير مصفوفة. */
    const notArray = tamperedCopy(exported.value.file as unknown as Record<string, unknown>);
    (notArray.data as Record<string, unknown>).expenseBudgets = { nope: true };
    expect(service.prepareImport(JSON.stringify(notArray)).ok).toBe(false);

    /* ٨) بيانات هذا الجهاز لم تتغير بعد أي رفض. */
    const after = await store.readSnapshot();
    expect(after.ok).toBe(true);
    if (!after.ok) throw new Error(after.message);
    expect(after.value).toEqual(before.value);
  });
});
