import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";
import { createAssetRecord } from "@micro-domain/asset/index.js";
import { localExportVersion, localSchemaVersion } from "@/storage/local/types";

/* عقد ٤٣ (WS-179 — Wave 7 / عقد ٣٩): حقلا القيمة المتبقية والملاحظة داخل
 * عائلة الأصول — دورة كاملة deep-equal، والأصل القديم بلا الحقلين يستورد
 * lossless (الغياب = متبقية ٠/بلا ملاحظة — بلا اختراع)، والملف المكسور
 * (متبقية ≥ القيمة / سالبة / ملاحظة أطول من ٥٠٠) يُرفض قبل أي استبدال
 * وبيانات الجهاز لا تُمس بعد الرفض. */

const NOW = "2026-09-23T09:00:00.000Z";

function acquisitionEvent(assetId: string, amountMinor: number, eventId: string) {
  return createFinancialEvent({
    id: eventId,
    type: "asset_purchase_cash",
    amountMinor,
    occurredOn: "2026-05-01",
    recordedAt: NOW,
    idempotencyKey: `${assetId}:acquisition`,
    note: "اقتناء أصل",
    assetContext: { assetId, name: "مكيف صناعي" },
  });
}

async function seedAssetWithResidual(store: MemoryLocalStore) {
  const event = acquisitionEvent("asset-r1", 48000, "event-acq-r1");
  const record = createAssetRecord({
    id: "asset-r1",
    name: "مكيف صناعي",
    categoryLabel: "تكييف",
    acquisitionAmountMinor: 48000,
    acquisitionKind: "cash",
    purchaseDate: "2026-05-01",
    lifeMonths: 24,
    depreciationStartOn: "2026-05-10",
    residualValueMinor: 6000,
    note: "فاتورة ٢٠٢٦-٩٩٣",
    acquisitionEventId: event.id,
    operationKey: "asset-r1:create",
    createdAt: NOW,
  });
  const commit = await store.commitAssetRecord(record, event);
  if (!commit.ok) throw new Error(commit.message);
  return record;
}

async function seedLegacyAsset(store: MemoryLocalStore) {
  const event = acquisitionEvent("asset-legacy", 30000, "event-acq-legacy");
  const record = createAssetRecord({
    id: "asset-legacy",
    name: "ثلاجة قديمة",
    acquisitionAmountMinor: 30000,
    acquisitionKind: "cash",
    purchaseDate: "2025-01-01",
    lifeMonths: 36,
    depreciationStartOn: "2025-01-10",
    acquisitionEventId: event.id,
    operationKey: "asset-legacy:create",
    createdAt: NOW,
  });
  const commit = await store.commitAssetRecord(record, event);
  if (!commit.ok) throw new Error(commit.message);
  return record;
}

describe("asset residual/note export integrity (contract 43, WS-179)", () => {
  it("round-trips an asset with residual and note verbatim (deep-equal snapshot)", async () => {
    const store = new MemoryLocalStore();
    await seedAssetWithResidual(store);
    const service = new LocalTransferService(store, () => NOW);
    const exported = await service.createVerifiedExport();
    if (!exported.ok) throw new Error(exported.message);
    expect(exported.value.file.version).toBe(localExportVersion);
    expect(exported.value.file.schemaVersion).toBe(localSchemaVersion);
    const exportedAsset = exported.value.file.data.assets?.find(asset => asset.id === "asset-r1");
    expect(exportedAsset?.residualValueMinor).toBe(6000);
    expect(exportedAsset?.note).toBe("فاتورة ٢٠٢٦-٩٩٣");

    const target = new MemoryLocalStore();
    const targetService = new LocalTransferService(target, () => NOW);
    const restored = await targetService.prepareImport(JSON.stringify(exported.value.file));
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error(restored.message);
    const applied = await targetService.confirmImport(restored.value);
    if (!applied.ok) throw new Error(applied.message);
    const imported = await target.listAssets();
    expect(imported.ok && imported.value.find(asset => asset.id === "asset-r1")?.residualValueMinor).toBe(
      6000,
    );
    expect(imported.ok && imported.value.find(asset => asset.id === "asset-r1")?.note).toBe(
      "فاتورة ٢٠٢٦-٩٩٣",
    );
  });

  it("imports a legacy asset without the new fields losslessly (absent residual reads zero)", async () => {
    const legacyStore = new MemoryLocalStore();
    await seedLegacyAsset(legacyStore);
    const legacyService = new LocalTransferService(legacyStore, () => NOW);
    const exported = await legacyService.createVerifiedExport();
    if (!exported.ok) throw new Error(exported.message);
    const legacyAsset = exported.value.file.data.assets?.find(asset => asset.id === "asset-legacy");
    expect(legacyAsset?.residualValueMinor ?? null).toBeNull();
    expect(legacyAsset?.note ?? null).toBeNull();

    const target = new MemoryLocalStore();
    const targetService = new LocalTransferService(target, () => NOW);
    const restored = await targetService.prepareImport(JSON.stringify(exported.value.file));
    expect(restored.ok).toBe(true);
    if (!restored.ok) throw new Error(restored.message);
    const applied = await targetService.confirmImport(restored.value);
    if (!applied.ok) throw new Error(applied.message);
    const imported = await target.listAssets();
    const legacy = imported.ok ? imported.value.find(asset => asset.id === "asset-legacy") : undefined;
    expect(legacy?.residualValueMinor ?? 0).toBe(0);
    expect(legacy?.note ?? null).toBeNull();
  });

  it("rejects a malformed residual before any replacement and leaves local data untouched", async () => {
    const store = new MemoryLocalStore();
    await seedAssetWithResidual(store);
    const service = new LocalTransferService(store, () => NOW);
    const exported = await service.createVerifiedExport();
    if (!exported.ok) throw new Error(exported.message);
    const file = exported.value.file;
    const before = await store.readSnapshot();
    if (!before.ok) throw new Error(before.message);

    for (const residual of [48000, 60000, -1]) {
      const tampered = JSON.parse(JSON.stringify(file));
      tampered.data.assets = tampered.data.assets.map((asset: Record<string, unknown>) =>
        asset.id === "asset-r1" ? { ...asset, residualValueMinor: residual } : asset,
      );
      const rejected = await service.prepareImport(JSON.stringify(tampered));
      expect(rejected.ok).toBe(false);
    }
    const longNote = JSON.parse(JSON.stringify(file));
    longNote.data.assets = longNote.data.assets.map((asset: Record<string, unknown>) =>
      asset.id === "asset-r1" ? { ...asset, note: "ن".repeat(501) } : asset,
    );
    const rejectedNote = await service.prepareImport(JSON.stringify(longNote));
    expect(rejectedNote.ok).toBe(false);

    /* لا استبدال حدث — اللقطة المحلية كما كانت بعد كل رفض. */
    const after = await store.readSnapshot();
    expect(after.ok && JSON.stringify(after.value)).toBe(JSON.stringify(before.value));
  });
});
