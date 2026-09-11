/** المجموعة ٩ (STR-011): تفعيل عينات خطة G8.2 الرسمية — هذا الاختبار يحمّل
 * ملف العينات الموثق نفسه (`docs/fixtures/g82-guided-opening-import-fixtures.json`
 * — المصدر المعلن في `docs/quality/g82-guided-opening-import-test-plan.md`)
 * ويشغّل سيناريوهاته الستة عبر الخدمة الحقيقية، فلا يعود الملف قادرًا على
 * الانجراف بلا فشل. لا تعدَّل العينات أبدًا — تُقرأ كما وُثقت. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GuidedOpeningImportService } from "./guidedOpeningImportService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

const fixtureUrl = new URL(
  "../../../../../../docs/fixtures/g82-guided-opening-import-fixtures.json",
  import.meta.url,
);

type G82Fixture = {
  valid: unknown;
  incomplete: unknown;
  corrupt: string;
  unsupported: unknown;
  nonEmptyStore: { sameAs: "valid" };
  retry: { sameAs: "valid" };
};

const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8")) as G82Fixture;

const emptyStore = async () => {
  const snapshot = await new MemoryLocalStore().readSnapshot();
  if (!snapshot.ok) throw new Error("تعذر قراءة حالة المتجر الفارغة في الاختبار.");
  return snapshot.value;
};

describe("guided opening import — the documented g82 fixture scenarios (STR-011)", () => {
  it("loads the fixture file the plan declares as its source, with all six scenarios intact", () => {
    /* درء الانجراف: أي حذف أو إعادة تسمية لسيناريو موثق يفشل هنا بصوت عالٍ. */
    expect(fixture.valid).toBeTypeOf("object");
    expect(fixture.incomplete).toBeTypeOf("object");
    expect(fixture.corrupt).toBe("{not-json");
    expect(fixture.unsupported).toBeTypeOf("object");
    expect(fixture.nonEmptyStore).toMatchObject({ sameAs: "valid" });
    expect(fixture.retry).toMatchObject({ sameAs: "valid" });
  });

  it("scenario `valid`: previews then atomically confirms an opening position, with no write before confirm", async () => {
    const store = new MemoryLocalStore();
    const service = new GuidedOpeningImportService(store, () => "2026-08-24T10:00:00.000Z");
    const preview = await service.prepare(JSON.stringify(fixture.valid));
    expect(preview).toMatchObject({
      ok: true,
      value: {
        summary: {
          importId: "opening-2026-08-24-valid",
          acceptedWallets: 1,
          acceptedMaterials: 1,
          acceptedCashMinor: 12500,
          acceptedMaterialQuantityMilli: 2500,
          estimatedRecords: 1,
        },
      },
    });
    if (!preview.ok) return;
    /* حارس الخطة: لا كتابة قبل التأكيد الصريح. */
    await expect(store.readSnapshot()).resolves.toMatchObject({
      ok: true,
      value: { profile: null, cashWallets: [], materials: [], inventoryMovements: [] },
    });
    await expect(service.confirm(preview.value)).resolves.toMatchObject({
      ok: true,
      value: { acceptedWallets: 1, acceptedMaterials: 1 },
    });
    await expect(store.readSnapshot()).resolves.toMatchObject({
      ok: true,
      value: {
        profile: { activityName: "مخبز صغير" },
        cashWallets: [{ name: "درج المحل" }],
        cashContinuityEntries: [{ cashDeltaMinor: 12500 }],
        materials: [{ name: "طحين" }],
        inventoryMovements: [{ quantityDeltaMilli: 2500, valueDeltaMinor: 8750 }],
      },
    });
  });

  it.each([
    ["incomplete", JSON.stringify(fixture.incomplete)],
    ["corrupt", fixture.corrupt],
    ["unsupported", JSON.stringify(fixture.unsupported)],
  ])("scenario `%s` is rejected before any write", async (_name, text) => {
    const store = new MemoryLocalStore();
    const service = new GuidedOpeningImportService(store);
    const result = await service.prepare(text);
    expect(result).toMatchObject({ ok: false, code: "validation_error" });
    expect(await emptyStore()).toEqual(await store.readSnapshot().then(current => current.value));
    await expect(store.readSnapshot()).resolves.toMatchObject({
      ok: true,
      value: { profile: null, cashWallets: [], materials: [], inventoryMovements: [] },
    });
  });

  it("scenario `nonEmptyStore` is refused without overwrite or merge", async () => {
    const store = new MemoryLocalStore();
    await store.saveProfile({
      id: "local-profile",
      activityName: "سجل قائم",
      currency: "JOD",
      activityType: "custom_craft",
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    });
    const result = await new GuidedOpeningImportService(store).prepare(JSON.stringify(fixture.valid));
    expect(result).toMatchObject({ ok: false, code: "non_empty_store" });
    await expect(store.getProfile()).resolves.toMatchObject({
      ok: true,
      value: { activityName: "سجل قائم" },
    });
  });

  it("scenario `retry`: the same importId returns the prior result with no duplicate effect", async () => {
    const store = new MemoryLocalStore();
    const service = new GuidedOpeningImportService(store);
    const preview = await service.prepare(JSON.stringify(fixture.valid));
    if (!preview.ok) throw new Error(preview.message);
    await expect(service.confirm(preview.value)).resolves.toMatchObject({ ok: true });
    await expect(service.prepare(JSON.stringify(fixture.valid))).resolves.toMatchObject({
      ok: true,
      reused: true,
    });
    await expect(service.confirm(preview.value)).resolves.toMatchObject({ ok: true, reused: true });
    await expect(store.listCashWallets()).resolves.toMatchObject({
      ok: true,
      value: [{ name: "درج المحل" }],
    });
    await expect(store.listCashContinuityEntries()).resolves.toMatchObject({
      ok: true,
      value: [{ cashDeltaMinor: 12500 }],
    });
    await expect(store.listInventoryMovements()).resolves.toMatchObject({
      ok: true,
      value: [{ quantityDeltaMilli: 2500 }],
    });
  });
});
