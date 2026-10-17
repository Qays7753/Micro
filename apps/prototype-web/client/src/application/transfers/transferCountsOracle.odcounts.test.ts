/**
 * R11 W2a / OD-COUNTS (موجة المتابعة 2026-10-15): العدّاد الجانبي-الاختبار
 * المدفوع بالسجل — يغطي العائلات الـ31 كلها فوق IndexedDB وMemory معًا.
 *
 * القرار المعتمد (OD-COUNTS — OWNER_APPROVED — TEST_SIDE_ONLY —
 * 31_OF_31_REQUIRED): cardinality evidence لكل عائلة عبر المهايئين،
 * وmeta-test يثبت أن سجل العائلات (TRANSFER_ARRAY_FAMILY_ROLES) يطابق
 * العدّاد المشتق من مخرجات المصدّر نفسه، مع توثيق اللاتماثل الحالي 22/31
 * (تسع عائلات مطلوبة-غير-معدودة) كدليل في ADR-017 — لا كحقل في Export 30.
 *
 * لا تغيير إنتاجي إطلاقًا: العدّاد هنا اختباري بحت؛ exportCountsOf يظل
 * مصدر عدادات الملف الحالي كما هو (22)، والذهبيات وMANIFEST وLegacy
 * وSchema 38/Export 30 لا تُمس.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createCatalogItem } from "@micro-domain/catalog/index.js";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import type { LocalStoreSnapshot } from "@/storage/local/types";
import { LocalTransferService } from "./localTransferService";
import { exportCountsOf } from "./transferCounters";
import { TRANSFER_ARRAY_FAMILY_ROLES, countedArrayFamilyKeys } from "./transferArrayFamilyRoles";

const GOLDEN_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../../docs/fixtures/export-goldens",
);
const supplement = JSON.parse(
  readFileSync(path.join(GOLDEN_DIR, "current-pair-supplement.golden.json"), "utf8"),
) as { data: LocalStoreSnapshot; counts: Record<string, number> };
const currentPair = JSON.parse(readFileSync(path.join(GOLDEN_DIR, "current-pair.golden.json"), "utf8")) as {
  data: LocalStoreSnapshot;
  counts: Record<string, number>;
};

const NOW = () => "2026-10-15T00:00:00.000Z";

/** العدّاد الجانبي-الاختبار: يعدّ العائلات الـ31 كلها من أي لقطة — بلا
 * استثناء وبلا اطلاع على مفاتيح LocalExportCounts (استقلال العدّاد). */
function oracleCounts(snapshot: LocalStoreSnapshot): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const key of Object.keys(TRANSFER_ARRAY_FAMILY_ROLES)) {
    const value = (snapshot as unknown as Record<string, unknown>)[key];
    counts[key] = Array.isArray(value) ? value.length : 0;
  }
  return counts;
}

/** عائلات من مخرجات المصدّر وحدها: كل مفتاح قيمته مصفوفة في ملف حالٍ
 * صادر فعلًا — الاشتقاق المستقل الذي يُطابق السجلَ ضده في الـmeta-test. */
function arrayKeysOfExportedData(data: Record<string, unknown>): string[] {
  return Object.keys(data)
    .filter(key => Array.isArray(data[key]))
    .sort();
}

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

afterEach(clearDatabase);

/** عهدة غنية فوق الذهبي المكمّل: سجلان في عائلة غير معدودة (بنود
 * المنتجات) ليكون التغطية غير الصفرية على صنف اللاتماثل نفسه أيضًا. */
function richSeed(): LocalStoreSnapshot {
  const first = createCatalogItem({
    id: "oracle-catalog-1",
    kind: "product",
    name: "صندوق خشبي",
    unitLabel: "قطعة",
    unitId: null,
    createdAt: "2026-08-22T00:00:00.000Z",
    createdOperationKey: "oracle-catalog-1",
  });
  const second = createCatalogItem({
    id: "oracle-catalog-2",
    kind: "service",
    name: "تغليف هدايا",
    unitLabel: "خدمة",
    unitId: null,
    createdAt: "2026-08-23T00:00:00.000Z",
    createdOperationKey: "oracle-catalog-2",
  });
  return {
    ...supplement.data,
    catalogItems: [first, second],
  } as LocalStoreSnapshot;
}

describe("OD-COUNTS meta-tests — registry == oracle (السجل يطابق العدّاد)", () => {
  it("the exporter corpus itself yields exactly the 31 registry families (derived == registered)", () => {
    const registryKeys = Object.keys(TRANSFER_ARRAY_FAMILY_ROLES).sort();
    expect(registryKeys).toHaveLength(31);
    expect(arrayKeysOfExportedData(currentPair.data as unknown as Record<string, unknown>)).toEqual(
      registryKeys,
    );
    expect(arrayKeysOfExportedData(supplement.data as unknown as Record<string, unknown>)).toEqual(
      registryKeys,
    );
  });

  it("the counted set (22) matches the exporter's counts keys exactly", () => {
    const counted = [...countedArrayFamilyKeys()].sort();
    expect(counted).toHaveLength(22);
    expect(Object.keys(supplement.counts).sort()).toEqual(counted);
    expect(Object.keys(exportCountsOf(supplement.data)).sort()).toEqual(counted);
  });

  it("the 22/31 asymmetry is pinned by name (ADR-017 evidence — nine required-but-uncounted families)", () => {
    const uncounted = Object.keys(TRANSFER_ARRAY_FAMILY_ROLES)
      .filter(key => !TRANSFER_ARRAY_FAMILY_ROLES[key as keyof typeof TRANSFER_ARRAY_FAMILY_ROLES].counted)
      .sort();
    expect(uncounted).toEqual([
      "actualTimeRecords",
      "allocationPolicies",
      "catalogItems",
      "catalogTemplates",
      "costEstimates",
      "directConversions",
      "measurementUnits",
      "recurrences",
      "shortCashDeclarations",
    ]);
    expect(uncounted).toHaveLength(9);
  });
});

describe("OD-COUNTS oracle over IndexedDB — all 31 families, counted and uncounted", () => {
  it("readSnapshot + createExport cardinalities match the oracle for every family", async () => {
    const store = new IndexedDbLocalStore();
    const seed = richSeed();
    const replaced = await store.replaceSnapshot(seed);
    expect(replaced.ok).toBe(true);
    const read = await store.readSnapshot();
    if (!read.ok) throw new Error(read.message);
    expect(read.ok).toBe(true);

    const oracle = oracleCounts(read.value);
    const goldenOracle = oracleCounts(seed);
    expect(oracle).toEqual(goldenOracle);

    const transfers = new LocalTransferService(store, NOW);
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    expect(exported.ok).toBe(true);

    const envelopeCounts = exported.value.counts as unknown as Record<string, number>;
    for (const key of Object.keys(TRANSFER_ARRAY_FAMILY_ROLES)) {
      if (TRANSFER_ARRAY_FAMILY_ROLES[key as keyof typeof TRANSFER_ARRAY_FAMILY_ROLES].counted) {
        expect(envelopeCounts[key]).toBe(oracle[key]);
      } else {
        expect(key in envelopeCounts).toBe(false);
      }
    }
  });
});

describe("OD-COUNTS oracle over Memory — all 31 families, counted and uncounted", () => {
  it("readSnapshot + createExport cardinalities match the oracle for every family", async () => {
    const store = new MemoryLocalStore();
    const seed = richSeed();
    const replaced = await store.replaceSnapshot(seed);
    expect(replaced.ok).toBe(true);
    const read = await store.readSnapshot();
    if (!read.ok) throw new Error(read.message);
    expect(read.ok).toBe(true);

    const oracle = oracleCounts(read.value);
    const goldenOracle = oracleCounts(seed);
    expect(oracle).toEqual(goldenOracle);

    const transfers = new LocalTransferService(store, NOW);
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    expect(exported.ok).toBe(true);

    const envelopeCounts = exported.value.counts as unknown as Record<string, number>;
    for (const key of Object.keys(TRANSFER_ARRAY_FAMILY_ROLES)) {
      if (TRANSFER_ARRAY_FAMILY_ROLES[key as keyof typeof TRANSFER_ARRAY_FAMILY_ROLES].counted) {
        expect(envelopeCounts[key]).toBe(oracle[key]);
      } else {
        expect(key in envelopeCounts).toBe(false);
      }
    }
  });
});

describe("OD-COUNTS full-cycle round trip — import → confirm → re-export keeps the oracle exact", () => {
  it.each([
    ["memory", () => new MemoryLocalStore()],
    ["indexeddb", () => new IndexedDbLocalStore()],
  ] as const)(
    "over %s: golden supplement import then re-export matches the seeded oracle",
    async (_name, makeStore) => {
      const store = makeStore();
      const transfers = new LocalTransferService(store, NOW);
      const seed = richSeed();

      const replaced = await store.replaceSnapshot(seed);
      expect(replaced.ok).toBe(true);

      const first = await transfers.createExport();
      if (!first.ok) throw new Error(first.message);
      const prepared = transfers.prepareImport(JSON.stringify(first.value));
      if (!prepared.ok) throw new Error(prepared.message);
      const confirmed = await transfers.confirmImport(prepared.value);
      if (!confirmed.ok) throw new Error(confirmed.message);

      const reExported = await transfers.createExport();
      if (!reExported.ok) throw new Error(reExported.message);
      const oracle = oracleCounts(seed);
      const envelopeCounts = reExported.value.counts as unknown as Record<string, number>;
      for (const key of Object.keys(TRANSFER_ARRAY_FAMILY_ROLES)) {
        if (TRANSFER_ARRAY_FAMILY_ROLES[key as keyof typeof TRANSFER_ARRAY_FAMILY_ROLES].counted) {
          expect(envelopeCounts[key]).toBe(oracle[key]);
        } else {
          expect(key in envelopeCounts).toBe(false);
        }
      }
    },
  );
});
