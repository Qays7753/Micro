/**
 * R3 (بطاقة R3-SC-07): عقد قدرة «المادة والمخزون». ثلاث طبقات إثبات، بلا أي تعديل إنتاج:
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
import { createMaterial } from "@micro-domain/inventory-material/index.js";
import type { InventoryMovement } from "@micro-domain/inventory-material/index.js";
import { IndexedDbLocalStore } from "../IndexedDbLocalStore";
import { MemoryLocalStore } from "../MemoryLocalStore";
import type { InventoryActivation } from "../types";
import { inventoryMaterialStoreMethods, type InventoryMaterialStore } from "./inventoryMaterialStore";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../../../../");
const ANCHORS_FILE = path.join(HERE, "inventoryMaterialCapabilityAnchors.ts");
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

function materialFixture(id: string, key: string) {
  return createMaterial({
    id,
    name: "دقيق فاخر",
    unit: "kilogram",
    createdAt: TS,
    createdOperationKey: key,
    tracking: null,
    opening: null,
  });
}

function movementFixture(id: string, materialId: string, key: string): InventoryMovement {
  return Object.freeze({
    id,
    materialId,
    type: "opening",
    occurredOn: "2026-10-07",
    recordedAt: TS,
    quantityDeltaMilli: 5_000,
    valueDeltaMinor: 3_000,
    note: "رصيد بداية",
    reason: null,
    operationKey: key,
    purchaseId: null,
    orderId: null,
    reversesMovementId: null,
  });
}
/** السيناريو يستقبل النوع الضيق حصرًا — عدسة مستهلك القدرة لا أوسع. */
async function runCapabilityScenario(store: InventoryMaterialStore) {
  /* ١) الالتزام الذرّي: المادة وحركاتها معًا أو لا شيء (STR-606 منطق
   *    داخل-المحوّل). */
  const material = materialFixture("mat-cap-1", "op-mat-cap-1");
  const movement = movementFixture("mv-cap-1", "mat-cap-1", "op-mv-cap-1");
  const committed = await store.commitInventory(material, [movement]);
  expect(committed.ok).toBe(true);
  if (!committed.ok) throw new Error(committed.message);
  expect(committed.value.material?.id).toBe("mat-cap-1");
  expect(committed.value.movements).toHaveLength(1);

  /* ٢) القراءة كما كُتبت: المواد والحركات. */
  const materials = await store.listMaterials();
  expect(materials.ok && materials.value.map(m => m.id)).toEqual(["mat-cap-1"]);
  const movements = await store.listInventoryMovements();
  expect(movements.ok && movements.value).toHaveLength(1);
  expect(movements.ok && movements.value[0]?.quantityDeltaMilli).toBe(5_000);

  /* ٣) التنشيط: get→null ثم حفظ ثم قراءته كما كُتب. */
  const beforeActivation = await store.getInventoryActivation();
  expect(beforeActivation.ok && beforeActivation.value).toBeNull();
  const activation: InventoryActivation = Object.freeze({
    id: "local-inventory-activation",
    activatedOn: "2026-10-08",
    recordedAt: TS,
    operationKey: "op-activation-cap",
  });
  const savedActivation = await store.saveInventoryActivation(activation);
  expect(savedActivation.ok && savedActivation.value.activatedOn).toBe("2026-10-08");
  const afterActivation = await store.getInventoryActivation();
  expect(afterActivation.ok && afterActivation.value?.operationKey).toBe("op-activation-cap");

  /* ٤) النواقص: قائمة فارغة ثم كتابة ذرّية مع نقص (D-027). */
  const noShortages = await store.listInventoryShortages();
  expect(noShortages.ok && noShortages.value).toHaveLength(0);
  const shortage = Object.freeze({
    id: "shortage-cap-1",
    materialId: "mat-cap-1",
    requestedQuantityMilli: 8_000,
    availableQuantityMilli: 5_000,
    shortageQuantityMilli: 3_000,
    occurredOn: "2026-10-08",
    recordedAt: TS,
    note: "طلب ٨ كيلو والمتاح ٥",
    orderId: null,
    operationKey: "op-shortage-cap-1",
  });
  const withShortage = await store.commitInventoryWithShortage(material, [movement], shortage);
  expect(withShortage.ok).toBe(true);
  if (!withShortage.ok) throw new Error(withShortage.message);
  const shortages = await store.listInventoryShortages();
  expect(shortages.ok && shortages.value).toHaveLength(1);
  expect(shortages.ok && shortages.value[0]?.shortageQuantityMilli).toBe(3_000);
}
describe("R3 — قدرة المادة والمخزون (بطاقة R3-SC-07): العضوية", () => {
  it("قائمة الطرق هي نطاق المجموعة بالضبط: 8 أسماء فريدة", () => {
    expect(inventoryMaterialStoreMethods).toHaveLength(8);
    expect(new Set(inventoryMaterialStoreMethods).size).toBe(8);
  });

  describe.each([
    ["MemoryLocalStore", () => new MemoryLocalStore()],
    ["IndexedDbLocalStore", () => new IndexedDbLocalStore()],
  ] as const)("%s يكشف كل طريقة قدرة كدالة", (_label, makeStore) => {
    it("العضوية كاملة", () => {
      const store = makeStore();
      for (const method of inventoryMaterialStoreMethods) {
        expect(typeof (store as unknown as InventoryMaterialStore)[method]).toBe("function");
      }
    });
  });
});

describe("R3 — قدرة المادة والمخزون: العقود السلوكية عبر العدسة الضيقة", () => {
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

describe("R3 — قدرة المادة والمخزون: طبقة الأنواع", () => {
  it(
    "المحوّلان والواجهة التوافقية ما زالوا يحققون القدرة (tsc على ملف المراسي)",
    { timeout: 120_000 },
    () => {
      const tmp = mkdtempSync(path.join(tmpdir(), "micro-inventoryMaterial-capability-"));
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
