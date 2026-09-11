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

  /* المجموعة ٥ (التحصين الكامل): كل الأنواع العابرة تعبر الحد نفسه — الأنواع
   * الأصلية ونوعا محرر الحدث المالي والإعداد المهاجران حديثًا. */
  it.each([
    "asset",
    "loan",
    "supplier_purchase",
    "direct_sale",
    "inventory_movement",
    "finance_event",
    "setup",
  ] as const)("kind %s loads, saves, restores, and clears through the one boundary", async kind => {
    const store = new MemoryLocalStore();
    const drafts = new FormDraftService(store, () => NOW);
    const scope = kind === "finance_event" ? "operating_expense_cash" : null;
    const saved = await drafts.save(kind, scope, { marker: "قيمة" });
    expect(saved.ok).toBe(true);
    const read = await drafts.read(kind, scope);
    expect(read.ok && (read.value?.values as { marker?: string }).marker).toBe("قيمة");
    await drafts.discard(kind, scope);
    const cleared = await drafts.read(kind, scope);
    expect(cleared.ok && cleared.value).toBeNull();
  });

  it("oversized values are rejected with a typed error and never written", async () => {
    const store = new MemoryLocalStore();
    const drafts = new FormDraftService(store, () => NOW);
    const oversized = { blob: "ن".repeat(40_000) };
    const result = await drafts.save("asset", "new", oversized);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("too_large");
    const read = await drafts.read("asset", "new");
    expect(read.ok && read.value).toBeNull();
  });

  it("list enumerates and clearAll wipes every ephemeral draft atomically", async () => {
    const store = new MemoryLocalStore();
    const drafts = new FormDraftService(store, () => NOW);
    await drafts.save("asset", "new", { a: 1 });
    await drafts.save("finance_event", "loss_non_cash", { b: 2 });
    await drafts.save("setup", null, { c: 3 });
    const listed = await drafts.list();
    expect(listed.ok && listed.value).toHaveLength(3);
    const cleared = await drafts.clearAll();
    expect(cleared.ok).toBe(true);
    const after = await drafts.list();
    expect(after.ok && after.value).toHaveLength(0);
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
