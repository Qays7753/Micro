/**
 * R3 (بطاقة R3-SC-09): عقد قدرة «الكتالوج». ثلاث طبقات إثبات، بلا أي تعديل إنتاج:
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
import { createCatalogItem } from "@micro-domain/catalog/index.js";
import type { CatalogTemplate } from "@micro-domain/catalog/index.js";
import { IndexedDbLocalStore } from "../IndexedDbLocalStore";
import { MemoryLocalStore } from "../MemoryLocalStore";
import type { MeasurementUnit } from "../types";
import { catalogStoreMethods, type CatalogStore } from "./catalogStore";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../../../../");
const ANCHORS_FILE = path.join(HERE, "catalogCapabilityAnchors.ts");
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

function catalogItemFixture(id: string, key: string) {
  return createCatalogItem({
    id,
    kind: "product",
    name: "صينية خشبية",
    unitLabel: "قطعة",
    unitId: null,
    defaultPriceMinor: 7_500,
    defaultUnitCostMinor: null,
    createdAt: TS,
    createdOperationKey: key,
  });
}

function unitFixture(id: string): MeasurementUnit {
  return Object.freeze({
    id,
    nameAr: "كيلو",
    dimension: "mass",
    symbol: "كغ",
    active: true,
    createdAt: TS,
    updatedAt: TS,
    createdOperationKey: "op-unit-cap",
  });
}

function templateFixture(
  id: string,
  itemId: string,
  revision: number,
  active: boolean,
  operationKey: string,
): CatalogTemplate {
  return Object.freeze({
    id,
    catalogItemId: itemId,
    title: "قالب التصنيع",
    note: null,
    components: [
      {
        id: `${id}:comp-1`,
        name: "خشب",
        quantityMilli: 1_500,
        unitId: "unit-cap-1",
        note: null,
      },
    ],
    yield: { quantityMilli: 1_000, unitId: "unit-cap-1" },
    yieldReadiness: "ready",
    extras: null,
    revision,
    sourceTemplateId: null,
    active,
    autoConsumeOnDelivery: null,
    createdAt: TS,
    updatedAt: TS,
    createdOperationKey: operationKey,
  });
}
/** السيناريو يستقبل النوع الضيق حصرًا — عدسة مستهلك القدرة لا أوسع. */
async function runCapabilityScenario(store: CatalogStore) {
  /* ١) وحدة القياس: حفظ وقراءة كما كُتبت. */
  const savedUnit = await store.saveMeasurementUnit(unitFixture("unit-cap-1"));
  expect(savedUnit.ok && savedUnit.value.nameAr).toBe("كيلو");
  const units = await store.listMeasurementUnits();
  expect(units.ok && units.value.map(unit => unit.id)).toEqual(["unit-cap-1"]);
  const singleUnit = await store.getMeasurementUnit("unit-cap-1");
  expect(singleUnit.ok && singleUnit.value?.dimension).toBe("mass");
  const missingUnit = await store.getMeasurementUnit("unit-none");
  expect(missingUnit.ok && missingUnit.value).toBeNull();

  /* ٢) البند: حفظ وقراءة كما كُتبت. */
  const savedItem = await store.saveCatalogItem(catalogItemFixture("item-cap-1", "op-item-cap-1"));
  expect(savedItem.ok && savedItem.value.active).toBe(true);
  const items = await store.listCatalogItems();
  expect(items.ok && items.value.map(item => item.id)).toEqual(["item-cap-1"]);
  const singleItem = await store.getCatalogItem("item-cap-1");
  expect(singleItem.ok && singleItem.value?.defaultPriceMinor).toBe(7_500);
  const missingItem = await store.getCatalogItem("item-none");
  expect(missingItem.ok && missingItem.value).toBeNull();

  /* ٣) التحويل المباشر: حفظ وقراءة. */
  const conversion = Object.freeze({
    id: "conv-cap-1",
    fromUnitId: "unit-cap-1",
    toUnitId: "unit-cap-1",
    dimension: "mass",
    numerator: 1,
    denominator: 1,
    note: "تحويل مطابقة",
    active: true,
    createdAt: TS,
    updatedAt: TS,
    createdOperationKey: "op-conv-cap-1",
  });
  const savedConversion = await store.saveDirectConversion(conversion);
  expect(savedConversion.ok && savedConversion.value.id).toBe("conv-cap-1");
  const conversions = await store.listDirectConversions();
  expect(conversions.ok && conversions.value).toHaveLength(1);
  const singleConversion = await store.getDirectConversion("conv-cap-1");
  expect(singleConversion.ok && singleConversion.value?.numerator).toBe(1);
  const missingConversion = await store.getDirectConversion("conv-none");
  expect(missingConversion.ok && missingConversion.value).toBeNull();

  /* ٤) القالب ومراجعته المحروسة: السابقة تُخزَّن خاملة والخلف نشطًا في
   *    معاملة واحدة. */
  const template = templateFixture("tpl-cap-1", "item-cap-1", 1, true, "op-tpl-cap-1");
  const savedTemplate = await store.saveCatalogTemplate(template);
  expect(savedTemplate.ok && savedTemplate.value.revision).toBe(1);
  const templates = await store.listCatalogTemplates();
  expect(templates.ok && templates.value.map(t => t.id)).toEqual(["tpl-cap-1"]);
  const singleTemplate = await store.getCatalogTemplate("tpl-cap-1");
  expect(singleTemplate.ok && singleTemplate.value?.active).toBe(true);
  const missingTemplate = await store.getCatalogTemplate("tpl-none");
  expect(missingTemplate.ok && missingTemplate.value).toBeNull();
  const successor = templateFixture("tpl-cap-2", "item-cap-1", 2, true, "op-tpl-cap-2");
  const superseded = { ...template, active: false };
  const revision = await store.commitCatalogTemplateRevision(superseded, successor);
  expect(revision.ok).toBe(true);
  if (!revision.ok) throw new Error(revision.message);
  expect(revision.value.previous.active).toBe(false);
  expect(revision.value.next.active).toBe(true);
  const afterRevision = await store.listCatalogTemplates();
  expect(afterRevision.ok && afterRevision.value).toHaveLength(2);
}
describe("R3 — قدرة الكتالوج (بطاقة R3-SC-09): العضوية", () => {
  it("قائمة الطرق هي نطاق المجموعة بالضبط: 13 أسماء فريدة", () => {
    expect(catalogStoreMethods).toHaveLength(13);
    expect(new Set(catalogStoreMethods).size).toBe(13);
  });

  describe.each([
    ["MemoryLocalStore", () => new MemoryLocalStore()],
    ["IndexedDbLocalStore", () => new IndexedDbLocalStore()],
  ] as const)("%s يكشف كل طريقة قدرة كدالة", (_label, makeStore) => {
    it("العضوية كاملة", () => {
      const store = makeStore();
      for (const method of catalogStoreMethods) {
        expect(typeof (store as unknown as CatalogStore)[method]).toBe("function");
      }
    });
  });
});

describe("R3 — قدرة الكتالوج: العقود السلوكية عبر العدسة الضيقة", () => {
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

describe("R3 — قدرة الكتالوج: طبقة الأنواع", () => {
  it(
    "المحوّلان والواجهة التوافقية ما زالوا يحققون القدرة (tsc على ملف المراسي)",
    { timeout: 120_000 },
    () => {
      const tmp = mkdtempSync(path.join(tmpdir(), "micro-catalog-capability-"));
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
