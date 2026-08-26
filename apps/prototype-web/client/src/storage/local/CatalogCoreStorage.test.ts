import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { CatalogService } from "@/application/catalog/catalogService";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";

const databaseName = "micro-prototype-local";
const at = "2026-08-26T13:00:00.000Z";

afterEach(() => new Promise<void>((resolve, reject) => {
  const request = indexedDB.deleteDatabase(databaseName);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error);
}));

describe("IndexedDB G4-A stores", () => {
  it("round-trips units, conversions, templates, and inactive history across adapters", async () => {
    const store = new IndexedDbLocalStore();
    const service = new CatalogService(store, () => at);
    const count = await service.createUnit({ nameAr: "قطعة", dimension: "count", operationKey: "unit:piece:indexed" });
    const gram = await service.createUnit({ nameAr: "غرام", dimension: "mass", operationKey: "unit:gram:indexed" });
    if (!count.ok || !gram.ok) throw new Error("units should be created");
    const item = await service.create({ kind: "product", name: "منتج", unitLabel: "قطعة", unitId: count.unit.id, operationKey: "catalog:item:indexed" });
    if (!item.ok) throw new Error("item should be created");
    const template = await service.createTemplate({ catalogItemId: item.item.id, title: "مرجع", note: null, components: [{ id: "component", name: "مادة", quantityMilli: 1000, unitId: gram.unit.id, note: null }], yield: null, operationKey: "template:item:indexed" });
    if (!template.ok) throw new Error("template should be created");
    await service.deactivateUnit(gram.unit.id);
    const resumed = new IndexedDbLocalStore();
    const listedUnits = await resumed.listMeasurementUnits();
    if (!listedUnits.ok) throw new Error("units should read");
    expect(listedUnits.value).toEqual(expect.arrayContaining([expect.objectContaining({ id: count.unit.id, active: true }), expect.objectContaining({ id: gram.unit.id, active: false })]));
    await expect(resumed.listCatalogTemplates(item.item.id)).resolves.toMatchObject({ ok: true, value: [{ id: template.template.id, active: true }] });
    const snapshot = await resumed.readSnapshot();
    if (!snapshot.ok) throw new Error("snapshot should read");
    expect(snapshot.value.measurementUnits).toEqual(expect.arrayContaining([expect.objectContaining({ id: count.unit.id }), expect.objectContaining({ id: gram.unit.id })]));
    expect(snapshot.value.catalogTemplates).toEqual([expect.objectContaining({ id: template.template.id })]);
  });

  it("adds unitId null to a schema-23 legacy catalog item without matching or rewriting its name", async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 23);
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = () => request.result.createObjectStore("catalog-items", { keyPath: "id" });
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("catalog-items", "readwrite");
        transaction.objectStore("catalog-items").put({ id: "legacy-item", kind: "product", name: "اسم قديم", unitLabel: "قطعة", active: true, createdAt: at, updatedAt: at, createdOperationKey: "legacy-item" });
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
    });
    const store = new IndexedDbLocalStore();
    await expect(store.getCatalogItem("legacy-item")).resolves.toMatchObject({ ok: true, value: { id: "legacy-item", name: "اسم قديم", unitId: null } });
  });
});
