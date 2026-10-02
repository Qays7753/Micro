/**
 * Wave 3A (ARCH-002 / WS-212 — STR-405): اختبارات وصف مباشرة للعدادات والترحيل.
 *
 * transferCounters: العدادات الصارمة (عقد ٣٩) على بيانات الذهبي المجمّدة نفسها —
 * عدّ العائلات، ورفض العدادات المخالفة/المزيفة (NaN/Infinity/سالب/عائم/نص/مفتاح زائد).
 * transferSnapshotMigrations: ملء العائلات الغائبة للزوج الحالي وسلوك الترحيل
 * على عهدة 8/17 الحقيقية (لا اختراع قيم — الفراغ يبقى فراغًا).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { exportCountsOf, verifyTransferCounts } from "./transferCounters";
import { migrateTransferSnapshot } from "./transferSnapshotMigrations";
import { file817 } from "./historical817.fixture";
import { localExportVersion, localSchemaVersion, type LocalExportCounts } from "@/storage/local/types";

const GOLDEN_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../../docs/fixtures/export-goldens",
);
const supplement = JSON.parse(
  readFileSync(path.join(GOLDEN_DIR, "current-pair-supplement.golden.json"), "utf8"),
) as {
  data: Parameters<typeof exportCountsOf>[0];
  counts: LocalExportCounts;
  version: number;
  schemaVersion: number;
};

describe("exportCountsOf — strict counters on frozen golden data", () => {
  it("counts every family the contract covers on the supplement golden", () => {
    expect(exportCountsOf(supplement.data)).toEqual(supplement.counts);
  });

  it("counts zero families on a minimal empty snapshot", () => {
    const empty = {
      profile: null,
      preferences: null,
      drafts: [],
      orders: [],
      schedules: [],
      financialEvents: [],
      actualTimeRecords: [],
    } as unknown as Parameters<typeof exportCountsOf>[0];
    const counts = exportCountsOf(empty);
    expect(counts.orders).toBe(0);
    expect(counts.receivedLoans).toBe(0);
    expect(counts.expenseBudgets).toBe(0);
  });
});

describe("verifyTransferCounts — tamper detection (عقد ٣٩)", () => {
  const data = supplement.data;
  const ok = (counts: LocalExportCounts) =>
    verifyTransferCounts(
      { version: localExportVersion, schemaVersion: localSchemaVersion, counts } as never,
      data,
      true,
    );

  it("accepts honest counters", () => {
    expect(ok(supplement.counts)).toBeNull();
  });

  it("rejects a missing counter key (strict shape)", () => {
    const tampered = { ...supplement.counts } as Record<string, number>;
    delete tampered.assets;
    expect(ok(tampered as never)).toContain("عدادات");
  });

  it("rejects mismatched counts, NaN, Infinity, floats, negatives, strings, and extra keys", () => {
    const cases: Record<string, LocalExportCounts>[] = [
      { ...supplement.counts, assets: (supplement.counts.assets ?? 0) + 1 },
      { ...supplement.counts, loans: Number.NaN },
      { ...supplement.counts, loans: Number.POSITIVE_INFINITY },
      { ...supplement.counts, materials: 1.5 },
      { ...supplement.counts, orders: -1 },
      { ...supplement.counts, orders: "1" as never },
      { ...supplement.counts, extraUnknownKey: 1 } as never,
    ];
    for (const tampered of cases) {
      expect(ok(tampered), JSON.stringify(tampered)).toContain("عدادات");
    }
  });
});

describe("migrateTransferSnapshot — migration behavior on the faithful 8/17 fixture", () => {
  it("migrates a legacy snapshot to the current shape without inventing values", () => {
    const migrated = migrateTransferSnapshot(file817.data as never, false);
    /* العائلات التي لم تكن موجودة في ٨/١٧ تبقى فراغًا — لا قيم مزعومة. */
    expect(migrated.assets).toEqual([]);
    expect(migrated.loans).toEqual([]);
    expect(migrated.ownerMovements).toEqual([]);
    expect(migrated.directSales).toEqual([]);
    expect(migrated.costEstimates).toEqual([]);
    /* القيم التاريخية الأصلية محفوظة كما هي. */
    expect(migrated.orders[0]?.order.collectedMinor).toBe(12000);
    expect(migrated.orders[0]?.order.events.length).toBe(3);
    expect(migrated.financialEvents[0]?.amountMinor).toBe(20000);
  });

  it("keeps current snapshots on their identity path (no migration artifacts)", () => {
    const current = migrateTransferSnapshot(supplement.data as never, true);
    /* الزوج الحالي يمر كما هو — البيانات نفسها لا نسخ محرفة. */
    expect(current).toEqual(supplement.data);
  });
});
