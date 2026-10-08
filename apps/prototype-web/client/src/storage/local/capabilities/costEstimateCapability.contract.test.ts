/**
 * R3 (بطاقة R3-SC-06): عقد قدرة «تقديرات الطلب». ثلاث طبقات إثبات، بلا أي تعديل إنتاج:
 * عضوية المحوّلين، السلوك عبر العدسة الضيقة (الذاكرة وIndexedDB/fake-indexeddb)،
 * ومراسي الأنواع زمن التشغيل (نمط Wave 3B/4C).
 */
import "fake-indexeddb/auto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { IndexedDbLocalStore } from "../IndexedDbLocalStore";
import { MemoryLocalStore } from "../MemoryLocalStore";
import type { CostEstimate } from "../types";
import { costEstimateStoreMethods, type CostEstimateStore } from "./costEstimateStore";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../../../../");
const ANCHORS_FILE = path.join(HERE, "costEstimateCapabilityAnchors.ts");
const APP_TSCONFIG = path.join(REPO_ROOT, "apps", "prototype-web", "tsconfig.json");

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const TS = "2026-10-08T09:00:00.000Z";

function estimateFixture(id: string): CostEstimate {
  return Object.freeze({
    id,
    title: "كيكة مناسبة",
    currency: "JOD",
    materialItems: [{ name: "دقيق", quantity: 2, unit: "كيلو", unitPriceMinor: 1_200, confidence: "known" }],
    time: { minutes: 90, hourlyRateMinor: 3_000, confidence: "known" },
    packagingMinor: 500,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 1_000,
    quantity: 1,
    plannedCostMinor: 8_300,
    unitCostMinor: 8_300,
    priceFloorMinor: 9_300,
    knowledgeState: "known",
    note: null,
    createdAt: TS,
    updatedAt: TS,
  });
}
/** السيناريو يستقبل النوع الضيق حصرًا — عدسة مستهلك القدرة لا أوسع. */
async function runCapabilityScenario(store: CostEstimateStore) {
  /* ١) الحفظ والقراءة كما كُتبت: أداة تفكير لا سجل مالي. */
  const saved = await store.saveCostEstimate(estimateFixture("estimate-cap-1"));
  expect(saved.ok && saved.value.title).toBe("كيكة مناسبة");
  const listed = await store.listCostEstimates();
  expect(listed.ok && listed.value.map(estimate => estimate.id)).toEqual(["estimate-cap-1"]);
  const single = await store.getCostEstimate("estimate-cap-1");
  expect(single.ok && single.value?.priceFloorMinor).toBe(9_300);
  const missing = await store.getCostEstimate("estimate-cap-none");
  expect(missing.ok && missing.value).toBeNull();

  /* ٢) الحذف الحر: بلا أثر على أي رصيد؛ والحذف مرة أخرى يبقى ok
   *    (idempotent بالحذف لا يرمي). */
  const removed = await store.deleteCostEstimate("estimate-cap-1");
  expect(removed.ok).toBe(true);
  const afterRemove = await store.listCostEstimates();
  expect(afterRemove.ok && afterRemove.value).toHaveLength(0);
  const removedAgain = await store.deleteCostEstimate("estimate-cap-1");
  expect(removedAgain.ok).toBe(true);
}
describe("R3 — قدرة تقديرات الطلب (بطاقة R3-SC-06): العضوية", () => {
  it("قائمة الطرق هي نطاق المجموعة بالضبط: 4 أسماء فريدة", () => {
    expect(costEstimateStoreMethods).toHaveLength(4);
    expect(new Set(costEstimateStoreMethods).size).toBe(4);
  });

  describe.each([
    ["MemoryLocalStore", () => new MemoryLocalStore()],
    ["IndexedDbLocalStore", () => new IndexedDbLocalStore()],
  ] as const)("%s يكشف كل طريقة قدرة كدالة", (_label, makeStore) => {
    it("العضوية كاملة", () => {
      const store = makeStore();
      for (const method of costEstimateStoreMethods) {
        expect(typeof (store as unknown as CostEstimateStore)[method]).toBe("function");
      }
    });
  });
});

describe("R3 — قدرة تقديرات الطلب: العقود السلوكية عبر العدسة الضيقة", () => {
  afterEach(async () => {
    await clearDatabase();
  });

  it("الذاكرة: عقد القدرة كاملًا", async () => {
    await runCapabilityScenario(new MemoryLocalStore());
  });

  it("IndexedDB (fake-indexeddb): عقد القدرة نفسه", async () => {
    await clearDatabase();
    try {
      await runCapabilityScenario(new IndexedDbLocalStore());
    } finally {
      await clearDatabase();
    }
  });
});

describe("R3 — قدرة تقديرات الطلب: طبقة الأنواع", () => {
  it(
    "المحوّلان والواجهة التوافقية ما زالوا يحققون القدرة (tsc على ملف المراسي)",
    { timeout: 120_000 },
    () => {
      const tmp = mkdtempSync(path.join(tmpdir(), "micro-costEstimate-capability-"));
      try {
        const tmpConfig = path.join(tmp, "tsconfig.capability.json");
        writeFileSync(
          tmpConfig,
          JSON.stringify({
            extends: APP_TSCONFIG,
            include: [ANCHORS_FILE],
            exclude: [],
            compilerOptions: { types: [] },
          }),
          "utf8",
        );
        const tscEntry = path.join(REPO_ROOT, "node_modules", "typescript", "bin", "tsc");
        execFileSync(process.execPath, [tscEntry, "--noEmit", "--project", tmpConfig], {
          cwd: REPO_ROOT,
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "pipe"],
        });
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
      expect(true).toBe(true);
    },
  );
});
