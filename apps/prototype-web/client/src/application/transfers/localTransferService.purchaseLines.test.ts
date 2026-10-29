import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { exportCountsOf } from "./transferCounters";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { localExportVersion, localSchemaVersion } from "@/storage/local/types";
import { syncSha256Hex } from "@/lib/syncSha256";

/* S07 (UNIT-027/عقد ٤٤): باب النقل مع بنود الشراء — الشكل الصارم يُرفض قبل
 * المعاينة وقبل أي كتابة في الهدف (لا تكرار هوية بند، ولا قيمة معلومة
 * غير موجبة، ولا مجهولة بقيمة، ولا متتبعة بلا مادة، ولا مرجع بند مكسور
 * في حركة استلام، ولا بند بمادة غير موجودة)، والدورة الكاملة تحفظ هويات
 * البنود والدفعات بلا إعادة تشغيل مالي، ورفض مراجع الأطراف المكسورة
 * (S05-MR-001) يبقى ساريًا فوق بنود الشراء الجديدة. */

const NOW = "2026-10-30T08:00:00.000Z";

const baseLine: Record<string, unknown> = {
  lineId: "pl-1",
  materialId: null,
  expectedQuantityMilli: null,
  valueMinor: 10_000,
  costKnowledge: "known",
  treatment: "period_material",
};

function lineWith(overrides: Partial<Record<string, unknown>>): Record<string, unknown> {
  return { ...baseLine, ...overrides };
}

/** شراء 40/32 بصيغة النقل الكاملة (دفعات ومراجعات وتراجعات). */
function purchaseWithLines(lines: readonly Record<string, unknown>[] | null): Record<string, unknown> {
  return {
    id: "purchase-lines-1",
    supplierName: "مؤسسة النسيج",
    supplierPartyId: null,
    note: "فاتورة ببنود",
    purchasedOn: "2026-10-10",
    dueOn: null,
    totalMinor: 30_000,
    paidMinor: 5_000,
    payableMinor: 25_000,
    status: "partially_paid",
    idempotencyKey: "purchase-lines-1",
    payments: [
      {
        id: "purchase-lines-1:initial",
        amountMinor: 5_000,
        occurredOn: "2026-10-10",
        recordedAt: NOW,
        idempotencyKey: "purchase-lines-1:initial",
        note: "دفعة عند تسجيل الشراء",
        walletId: null,
      },
    ],
    paymentReversals: [],
    revisions: [],
    materialId: null,
    expectedQuantityMilli: null,
    lines,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function materialRecord(id: string): Record<string, unknown> {
  return {
    id,
    name: "قماش قطني",
    unit: "meter",
    createdAt: NOW,
    createdOperationKey: `material-${id}-open`,
    tracking: { status: "tracked", decidedOn: "2026-10-01", reason: null },
    opening: null,
  };
}

/** لقحة بيانات كاملة الأسر الأساسية على الزوج الحالي 40/32. */
function baseData(): Record<string, unknown> {
  return {
    profile: null,
    preferences: null,
    drafts: [],
    orders: [],
    directSales: [],
    schedules: [],
    recurrences: [],
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
    receivedLoans: [],
    recurringExpenseSeries: [],
    recurringExpenseRevisions: [],
    recurringExpenseOccurrences: [],
    expenseBudgets: [],
    balanceObservations: [],
    counterparties: [],
  };
}

type LinesFileInput = {
  readonly lines?: readonly Record<string, unknown>[] | null;
  readonly purchaseOverrides?: Partial<Record<string, unknown>>;
  readonly movements?: readonly Record<string, unknown>[];
  readonly materials?: readonly Record<string, unknown>[];
};

/** ملف 40/32 كامل العدادات والبصمة — يصل إلى validateSnapshot فعلًا. */
function currentPairFile(input: LinesFileInput = {}): Record<string, unknown> {
  const data = baseData();
  const purchase = purchaseWithLines(input.lines ?? null);
  if (input.purchaseOverrides) Object.assign(purchase, input.purchaseOverrides);
  data.supplierPurchases = [purchase];
  if (input.materials) data.materials = [...input.materials];
  if (input.movements) data.inventoryMovements = [...input.movements];
  const counts = exportCountsOf(data as Parameters<typeof exportCountsOf>[0]);
  const file: Record<string, unknown> = {
    format: "micro-prototype-local-export",
    version: localExportVersion,
    schemaVersion: localSchemaVersion,
    exportedAt: NOW,
    data,
  };
  file.integrity = { algorithm: "sha256", digest: syncSha256Hex(JSON.stringify(data)) };
  file.counts = counts;
  return file;
}

const prepare = (file: Record<string, unknown>) =>
  new LocalTransferService(new MemoryLocalStore(), () => NOW).prepareRestore(JSON.stringify(file));

const validLines: readonly Record<string, unknown>[] = [
  lineWith({}),
  lineWith({ lineId: "pl-2", valueMinor: 12_000 }),
];

describe("S07 — باب النقل مع بنود الشراء (عقد ٤٤)", () => {
  it("الدورة الكاملة تحفظ بنود الشراء وهوياتها ودفعاته بلا إعادة تشغيل مالي", async () => {
    const source = new MemoryLocalStore();
    const prepared = await new LocalTransferService(source, () => NOW).prepareRestore(
      JSON.stringify(currentPairFile({ lines: validLines })),
    );
    if (!prepared.ok) throw new Error(prepared.message);
    const confirmed = await new LocalTransferService(source, () => NOW).confirmImport(prepared.value);
    if (!confirmed.ok) throw new Error(confirmed.message);
    const reExported = await new LocalTransferService(source, () => NOW).createExport();
    if (!reExported.ok) throw new Error(reExported.message);
    const exportedPurchases = reExported.value.data.supplierPurchases;
    if (!exportedPurchases) throw new Error("عائلة المشتريات غائبة عن التصدير");
    const roundTripped = exportedPurchases.find(p => p.id === "purchase-lines-1");
    if (!roundTripped) throw new Error("لم يعبر الدورة");
    expect(roundTripped.lines?.map(line => line.lineId)).toEqual(["pl-1", "pl-2"]);
    expect(roundTripped.lines?.[0]?.valueMinor).toBe(10_000);
    expect(roundTripped.lines?.[0]?.treatment).toBe("period_material");
    expect(roundTripped.lines?.[1]?.costKnowledge).toBe("known");
    expect(roundTripped.payments.length).toBe(1);
    expect(roundTripped.payments[0]?.occurredOn).toBe("2026-10-10");
    expect(roundTripped.paidMinor).toBe(5_000);
  });

  it("هوية بند مكررة داخل الشراء تُرفض قبل المعاينة وبلا كتابة في الهدف", async () => {
    const target = new MemoryLocalStore();
    const before = await target.readSnapshot();
    if (!before.ok) throw new Error(before.message);
    const file = currentPairFile({
      lines: [lineWith({}), lineWith({ lineId: "pl-1", valueMinor: 5_000 })],
    });
    const prepared = await new LocalTransferService(target, () => NOW).prepareRestore(JSON.stringify(file));
    expect(prepared.ok).toBe(false);
    const after = await target.readSnapshot();
    if (!after.ok) throw new Error(after.message);
    expect(after.value).toEqual(before.value);
  });

  it("قيمة معلومة غير موجبة، ومجهولة بقيمة معلنة، ومتتبعة بلا مادة — تُرفض كلها", async () => {
    expect((await prepare(currentPairFile({ lines: [lineWith({ valueMinor: 0 })] }))).ok).toBe(false);
    expect((await prepare(currentPairFile({ lines: [lineWith({ valueMinor: -5_000 })] }))).ok).toBe(false);
    expect(
      (await prepare(currentPairFile({ lines: [lineWith({ valueMinor: 7_000, costKnowledge: "unknown" })] })))
        .ok,
    ).toBe(false);
    expect(
      (await prepare(currentPairFile({ lines: [lineWith({ treatment: "tracked_material" })] }))).ok,
    ).toBe(false);
  });

  it("مرجع بند مكسور في حركة استلام يُرفض قبل المعاينة", async () => {
    const file = currentPairFile({
      lines: [lineWith({ lineId: "pl-real", valueMinor: 20_000 })],
      materials: [materialRecord("material-real")],
      movements: [
        {
          id: "movement-broken-1",
          materialId: "material-real",
          type: "purchase_receipt",
          occurredOn: "2026-10-11",
          recordedAt: NOW,
          quantityDeltaMilli: 1_000,
          valueDeltaMinor: 5_000,
          note: "استلام بمرجع بند مكسور",
          reason: null,
          operationKey: "movement-broken-1-op",
          purchaseId: "purchase-lines-1",
          purchaseLineId: "pl-ghost",
          orderId: null,
          saleId: null,
          reversesMovementId: null,
          wasteContext: null,
          costKnowledge: "known",
        },
      ],
    });
    const prepared = await prepare(file);
    expect(prepared.ok).toBe(false);
  });

  it("رفض مراجع الأطراف المكسورة (S05-MR-001) يبقى ساريًا مع بنود الشراء", async () => {
    const file = currentPairFile({
      lines: validLines,
      purchaseOverrides: { supplierPartyId: "party-ghost" },
    });
    const prepared = await prepare(file);
    expect(prepared.ok).toBe(false);
  });

  it("بند بمادة غير موجودة في الملف يُرفض قبل المعاينة", async () => {
    const file = currentPairFile({
      lines: [lineWith({ materialId: "material-ghost", treatment: "tracked_material" })],
    });
    const prepared = await prepare(file);
    expect(prepared.ok).toBe(false);
  });

  it("بلا بنود (null) يعبر كما هو — الإرث المتوافق بلا افتراض معنى", async () => {
    const file = currentPairFile({ lines: null });
    const prepared = await prepare(file);
    if (!prepared.ok) throw new Error(prepared.message);
    const target = new LocalTransferService(new MemoryLocalStore(), () => NOW);
    const confirmed = await target.confirmImport(prepared.value);
    if (!confirmed.ok) throw new Error(confirmed.message);
    const reExported = await target.createExport();
    if (!reExported.ok) throw new Error(reExported.message);
    const exportedPurchases = reExported.value.data.supplierPurchases;
    if (!exportedPurchases) throw new Error("عائلة المشتريات غائبة عن التصدير");
    const restored = exportedPurchases.find(p => p.id === "purchase-lines-1");
    if (!restored) throw new Error("لم يعبر الدورة");
    expect(restored.lines ?? null).toBeNull();
  });
});
