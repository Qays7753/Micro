/** المجموعة ٥ (عقد ٣٦ — اختبار المسودة النصية): حفظ/قراءة/تجاهل بحارس تزامن،
 * إصدار شكل مختلف يُتجاهل بلا انفجار، والمعرّف لكل شاشة×نطاق. */
import { describe, expect, it } from "vitest";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { FormDraftService, formDraftId } from "./formDraftService";

const NOW = "2026-09-05T09:00:00.000Z";
const later = (minutes: number) => new Date(Date.parse(NOW) + minutes * 60_000).toISOString();

describe("form draft service (المجموعة ٥ — عقد ٣٦)", () => {
  it("saves, reads back, and discards by formKind + scope", async () => {
    const store = new MemoryLocalStore();
    const drafts = new FormDraftService(store, () => NOW);
    const saved = await drafts.save("asset", "new", { name: "ثلاجة", amountMinor: 5000 });
    if (!saved.ok) throw new Error(saved.message);
    expect(saved.value.values).toEqual({ name: "ثلاجة", amountMinor: 5000 });
    expect(saved.value.updatedAt).toBe(NOW);
    const read = await drafts.read("asset", "new");
    if (!read.ok) throw new Error(read.message);
    expect(read.value?.values).toEqual({ name: "ثلاجة", amountMinor: 5000 });
    await drafts.discard("asset", "new");
    const after = await drafts.read("asset", "new");
    if (!after.ok) throw new Error(after.message);
    expect(after.value).toBeNull();
  });

  it("stale window does not overwrite a newer save — conflict is honest", async () => {
    const store = new MemoryLocalStore();
    let clock = NOW;
    const drafts = new FormDraftService(store, () => clock);
    const first = await drafts.save("loan", "new", { borrowerName: "أحمد" });
    if (!first.ok) throw new Error(first.message);
    clock = later(30);
    const second = await drafts.save("loan", "new", { borrowerName: "خالد" });
    if (!second.ok) throw new Error(second.message);
    /* نافذة قديمة تحمل توقيت الحفظ الأول: تُرفض كتابتها فوق الأحدث. */
    const stale = await drafts.save("loan", "new", { borrowerName: "أحمد" }, first.value.updatedAt);
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.code).toBe("conflict");
    const final = await drafts.read("loan", "new");
    if (!final.ok) throw new Error(final.message);
    expect((final.value?.values as { borrowerName: string }).borrowerName).toBe("خالد");
  });

  it("a draft from a different values version is ignored, not exploded", async () => {
    const store = new MemoryLocalStore();
    const drafts = new FormDraftService(store, () => NOW);
    await store.saveFormDraft({
      id: formDraftId("asset", "new"),
      formKind: "asset",
      scopeId: "new",
      valuesVersion: 999,
      values: { name: "قديم" },
      createdAt: NOW,
      updatedAt: NOW,
    });
    const read = await drafts.read("asset", "new");
    if (!read.ok) throw new Error(read.message);
    expect(read.value).toBeNull();
  });

  it("drafts live outside the snapshot — restore never carries them", async () => {
    const store = new MemoryLocalStore();
    const drafts = new FormDraftService(store, () => NOW);
    await drafts.save("direct_sale", "new", { itemName: "قطعة" });
    const snapshot = await store.readSnapshot();
    if (!snapshot.ok) throw new Error(snapshot.message);
    expect(JSON.stringify(snapshot.value)).not.toContain("قطعة");
  });
});
