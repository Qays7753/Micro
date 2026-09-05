import { describe, expect, it } from "vitest";
import { CatalogService } from "@/application/catalog/catalogService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { localExportVersion, localSchemaVersion } from "@/storage/local/types";
import { LocalTransferService } from "./localTransferService";

const now = "2026-08-26T12:00:00.000Z";

describe("G4-A catalog transfer boundary", () => {
  it("round-trips units, a direct conversion, and a ready-yield template without financial or inventory effects", async () => {
    const source = new MemoryLocalStore();
    const catalog = new CatalogService(source, () => now);
    const kg = await catalog.createUnit({
      nameAr: "كيلوغرام",
      dimension: "mass",
      operationKey: "unit:kg:transfer",
    });
    const gram = await catalog.createUnit({
      nameAr: "غرام",
      dimension: "mass",
      operationKey: "unit:g:transfer",
    });
    if (!kg.ok || !gram.ok) throw new Error("units should be created");
    await catalog.createConversion({
      fromUnitId: kg.unit.id,
      toUnitId: gram.unit.id,
      numerator: 1000,
      denominator: 1,
      note: "1 كيلوغرام = 1000 غرام",
      operationKey: "conversion:kg-g:transfer",
    });
    const item = await catalog.create({
      kind: "product",
      name: "خلطة",
      unitLabel: "غرام",
      unitId: gram.unit.id,
      operationKey: "catalog:mix:transfer",
    });
    if (!item.ok) throw new Error("item should be created");
    await catalog.createTemplate({
      catalogItemId: item.item.id,
      title: "دفعة معتادة",
      note: null,
      components: [{ id: "c-1", name: "مادة", quantityMilli: 1000, unitId: kg.unit.id, note: null }],
      yield: { quantityMilli: 1000, unitId: kg.unit.id },
      operationKey: "template:mix:transfer",
    });

    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("export should succeed");
    const target = new MemoryLocalStore();
    const transfers = new LocalTransferService(target);
    const preview = transfers.prepareImport(JSON.stringify(exported.value));
    if (!preview.ok) throw new Error(preview.message);
    expect(preview.value.summary).toMatchObject({
      catalogItems: 1,
      measurementUnits: 2,
      directConversions: 1,
      catalogTemplates: 1,
      financialEvents: 0,
      inventoryMovements: 0,
    });
    expect(preview.value.file.data.catalogTemplates).toEqual([
      expect.objectContaining({ yieldReadiness: "ready" }),
    ]);
    await expect(transfers.confirmImport(preview.value)).resolves.toMatchObject({
      ok: true,
      value: { catalogTemplates: 1 },
    });
    const targetSnapshot = await target.readSnapshot();
    if (!targetSnapshot.ok) throw new Error("target snapshot should read");
    expect(targetSnapshot.value.measurementUnits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nameAr: "غرام" }),
        expect.objectContaining({ nameAr: "كيلوغرام" }),
      ]),
    );
    expect(targetSnapshot.value.catalogTemplates).toEqual([
      expect.objectContaining({ yieldReadiness: "ready" }),
    ]);
    expect(targetSnapshot.value.financialEvents).toEqual([]);
    expect(targetSnapshot.value.inventoryMovements).toEqual([]);
  });

  it("rejects a tampered ready yield when its explicit conversion is missing, before writing anything", async () => {
    const source = new MemoryLocalStore();
    const catalog = new CatalogService(source, () => now);
    const unit = await catalog.createUnit({
      nameAr: "قطعة",
      dimension: "count",
      operationKey: "unit:piece:tamper",
    });
    if (!unit.ok) throw new Error("unit should be created");
    const item = await catalog.create({
      kind: "product",
      name: "صندوق",
      unitLabel: "قطعة",
      unitId: unit.unit.id,
      operationKey: "catalog:box:tamper",
    });
    if (!item.ok) throw new Error("item should be created");
    await catalog.createTemplate({
      catalogItemId: item.item.id,
      title: "قالب",
      note: null,
      components: [],
      yield: { quantityMilli: 1000, unitId: unit.unit.id },
      operationKey: "template:box:tamper",
    });
    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("export should succeed");
    const tampered = structuredClone(exported.value);
    tampered.data.catalogTemplates = tampered.data.catalogTemplates?.map(template => ({
      ...template,
      yieldReadiness: "ready",
      yield: { quantityMilli: 1000, unitId: "missing-unit" },
    }));
    const target = new MemoryLocalStore();
    const transfers = new LocalTransferService(target);
    expect(transfers.prepareImport(JSON.stringify(tampered))).toMatchObject({
      ok: false,
      code: "validation_error",
    });
    await expect(target.readSnapshot()).resolves.toMatchObject({
      ok: true,
      value: { catalogItems: [], measurementUnits: [], catalogTemplates: [] },
    });
  });

  it("rejects a tampered compatible yield marked needs-conversion before writing anything", async () => {
    const source = new MemoryLocalStore();
    const catalog = new CatalogService(source, () => now);
    const unit = await catalog.createUnit({
      nameAr: "قطعة",
      dimension: "count",
      operationKey: "unit:piece:readiness",
    });
    if (!unit.ok) throw new Error("unit should be created");
    const item = await catalog.create({
      kind: "product",
      name: "علبة",
      unitLabel: "قطعة",
      unitId: unit.unit.id,
      operationKey: "catalog:box:readiness",
    });
    if (!item.ok) throw new Error("item should be created");
    await catalog.createTemplate({
      catalogItemId: item.item.id,
      title: "قالب",
      note: null,
      components: [],
      yield: { quantityMilli: 1000, unitId: unit.unit.id },
      operationKey: "template:box:readiness",
    });
    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("export should succeed");
    const tampered = structuredClone(exported.value);
    tampered.data.catalogTemplates = tampered.data.catalogTemplates?.map(template => ({
      ...template,
      yieldReadiness: "needs_conversion",
    }));
    const target = new MemoryLocalStore();
    const transfers = new LocalTransferService(target);
    expect(transfers.prepareImport(JSON.stringify(tampered))).toMatchObject({
      ok: false,
      code: "validation_error",
    });
    await expect(target.readSnapshot()).resolves.toMatchObject({
      ok: true,
      value: { catalogItems: [], measurementUnits: [], catalogTemplates: [] },
    });
  });

  it("migrates the previous catalog schema by adding empty G4-A arrays and a null organized unit", async () => {
    const source = new MemoryLocalStore();
    const catalog = new CatalogService(source, () => now);
    const item = await catalog.create({
      kind: "service",
      name: "تغليف",
      unitLabel: "جلسة",
      operationKey: "catalog:wrap:migrate",
    });
    if (!item.ok) throw new Error("item should be created");
    const exported = await new LocalTransferService(source).createExport();
    if (!exported.ok) throw new Error("export should succeed");
    const previous = structuredClone(exported.value);
    previous.version = 14;    delete (previous as Record<string, unknown>).integrity;
    delete (previous as Record<string, unknown>).counts;
    delete (previous as Record<string, unknown>).appVersion;

    previous.schemaVersion = 23;
    previous.data.catalogItems = previous.data.catalogItems?.map(({ unitId: _unitId, ...legacy }) => legacy);
    delete previous.data.measurementUnits;
    delete previous.data.directConversions;
    delete previous.data.catalogTemplates;
    const preview = new LocalTransferService(new MemoryLocalStore()).prepareImport(JSON.stringify(previous));
    expect(preview).toMatchObject({
      ok: true,
      value: {
        file: {
          version: localExportVersion,
          schemaVersion: localSchemaVersion,
          data: {
            catalogItems: [{ id: item.item.id, unitId: null }],
            measurementUnits: [],
            directConversions: [],
            catalogTemplates: [],
            allocationPolicies: [],
          },
        },
      },
    });
  });
});
