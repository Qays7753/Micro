import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { CatalogService } from "./catalogService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import type { PrototypeLocalStore } from "@/storage/local/types";

/* S09 (UNIT-029 — أمر التنفيذ المتصل ad133bae القسم ٢): «حفظ لاستخدامه مرة
 * أخرى» — حفظ صريح اختياري من سياق المسودة بالهوية الدنيا (اسم + نوع)، لا
 * تكرار بالنقر المتكرر ولا بالنية نفسها بعد إعادة التحميل ولا فوق تعريف
 * نشط موجود بالنوع والاسم نفسيهما، وبلا أي أثر مالي أو مخزوني. */

const NOW = "2026-10-30T17:00:00.000Z";
const DATABASE_NAME = "micro-prototype-local";

function clearDatabase(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

const stores: ReadonlyArray<{
  label: string;
  make: () => PrototypeLocalStore | Promise<PrototypeLocalStore>;
}> = [
  { label: "Memory", make: () => new MemoryLocalStore() },
  {
    label: "IndexedDB",
    make: async () => {
      await clearDatabase();
      return new IndexedDbLocalStore();
    },
  },
];

describe.each(stores)("S09 save-for-reuse ($label)", ({ make }) => {
  afterEach(async () => {
    await clearDatabase();
  });

  it("saves a minimal offering from a draft context with name + kind only (U029-AC01) and no financial effect", async () => {
    const store = await make();
    const service = new CatalogService(store, () => NOW);
    const result = await service.saveOfferingFromDraft({
      kind: "product",
      name: "صندوق شوكولاتة مخصص",
      operationKey: "draft-reuse:draft-1:product:صندوق شوكولاتة مخصص",
    });
    expect(result).toMatchObject({
      ok: true,
      alreadyExisted: false,
      item: {
        kind: "product",
        name: "صندوق شوكولاتة مخصص",
        active: true,
        defaultPriceMinor: null,
        defaultUnitCostMinor: null,
      },
    });
    /* AC27: لا بيع ولا اتفاق ولا كاش ولا مصروف ولا مخزون — الكتالوج وحده كُتب. */
    const events = await store.listFinancialEvents();
    expect(events.ok && events.value).toHaveLength(0);
    const orders = await store.listOrders();
    expect(orders.ok && orders.value).toHaveLength(0);
    const materials = await store.listMaterials();
    expect(materials.ok && materials.value).toHaveLength(0);
    const items = await store.listCatalogItems();
    expect(items.ok && items.value).toHaveLength(1);
  });

  it("repeated taps and same-intent retry after an unknown outcome create no second definition (U029-AC32/AC37/AC44)", async () => {
    const store = await make();
    const service = new CatalogService(store, () => NOW);
    const operationKey = "draft-reuse:draft-1:product:صندوق شوكولاتة مخصص";
    const first = await service.saveOfferingFromDraft({
      kind: "product",
      name: "صندوق شوكولاتة مخصص",
      operationKey,
    });
    const retry = await service.saveOfferingFromDraft({
      kind: "product",
      name: "صندوق شوكولاتة مخصص",
      operationKey,
    });
    if (!first.ok) throw new Error("first save should succeed");
    expect(retry).toMatchObject({ ok: true, alreadyExisted: true, item: { id: first.item.id } });
    const items = await store.listCatalogItems();
    expect(items.ok && items.value).toHaveLength(1);
  });

  it("an active offering with the same kind and normalized name is returned as-is — no duplicate identity (U029-AC32/AC48)", async () => {
    const store = await make();
    const service = new CatalogService(store, () => NOW);
    const earlier = await service.create({
      kind: "service",
      name: "تغليف هدية",
      unitLabel: null,
      operationKey: "catalog-manual-1",
    });
    if (!earlier.ok) throw new Error("manual creation should succeed");
    const fromDraft = await service.saveOfferingFromDraft({
      kind: "service",
      name: " تغليف   هدية ",
      operationKey: "draft-reuse:draft-2:service:تغليف هدية",
    });
    expect(fromDraft).toMatchObject({
      ok: true,
      alreadyExisted: true,
      item: { id: earlier.item.id },
    });
    const items = await store.listCatalogItems();
    expect(items.ok && items.value).toHaveLength(1);
  });

  it("an archived offering with the same name does not block a new explicit save and keeps its history (U029-AC36)", async () => {
    const store = await make();
    const service = new CatalogService(store, () => NOW);
    const earlier = await service.create({
      kind: "product",
      name: "علبة ماكرون",
      unitLabel: null,
      operationKey: "catalog-manual-2",
    });
    if (!earlier.ok) throw new Error("manual creation should succeed");
    const archived = await service.deactivate(earlier.item.id);
    expect(archived.ok).toBe(true);
    const fromDraft = await service.saveOfferingFromDraft({
      kind: "product",
      name: "علبة ماكرون",
      operationKey: "draft-reuse:draft-3:product:علبة ماكرون",
    });
    expect(fromDraft).toMatchObject({ ok: true, alreadyExisted: false });
    const items = await service.list({ includeInactive: true });
    if (!items.ok) throw new Error("listing should succeed");
    expect(items.items).toHaveLength(2);
    expect(items.items.filter(item => item.active)).toHaveLength(1);
  });

  it("rejects an empty or oversized name honestly without writing anything", async () => {
    const store = await make();
    const service = new CatalogService(store, () => NOW);
    const empty = await service.saveOfferingFromDraft({
      kind: "product",
      name: "   ",
      operationKey: "draft-reuse:draft-4:product:empty",
    });
    const oversized = await service.saveOfferingFromDraft({
      kind: "product",
      name: "ع".repeat(201),
      operationKey: "draft-reuse:draft-4:product:oversized",
    });
    expect(empty).toMatchObject({ ok: false, code: "validation_error" });
    expect(oversized).toMatchObject({ ok: false, code: "validation_error" });
    const items = await store.listCatalogItems();
    expect(items.ok && items.value).toHaveLength(0);
  });

  it("keeps the deliberate creation path strict — create() still rejects an active duplicate by name and kind", async () => {
    const store = await make();
    const service = new CatalogService(store, () => NOW);
    const first = await service.create({
      kind: "product",
      name: "خبز فرنسي",
      unitLabel: null,
      operationKey: "catalog-manual-3",
    });
    expect(first.ok).toBe(true);
    const duplicate = await service.create({
      kind: "product",
      name: "خبز فرنسي",
      unitLabel: null,
      operationKey: "catalog-manual-4",
    });
    expect(duplicate).toMatchObject({ ok: false, code: "validation_error" });
  });
});
