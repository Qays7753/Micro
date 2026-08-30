import { describe, expect, it } from "vitest";
import { DraftService } from "./draftService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

describe("DraftService", () => {
  it("creates a pre-domain customer draft without price, cash, or result fields", async () => {
    const service = new DraftService(new MemoryLocalStore(), () => "2026-08-22T00:00:00.000Z");
    const created = await service.create("customer_order");
    expect(created).toMatchObject({
      ok: true,
      draft: { intent: "customer_order", customerName: "", itemName: "", specifications: "", quantity: 1 },
    });
    if (created.ok) expect(created.draft).not.toHaveProperty("agreedPriceMinor");
  });

  it("saves and resumes a draft while trimming content and retaining the creation timestamp", async () => {
    const store = new MemoryLocalStore();
    let timestamp = "2026-08-22T00:00:00.000Z";
    const service = new DraftService(store, () => timestamp);
    const created = await service.create("planned_design");
    if (!created.ok) throw new Error("draft should be created");
    timestamp = "2026-08-22T01:00:00.000Z";
    const saved = await service.save({
      ...created.draft,
      itemName: "  صندوق خشبي  ",
      specifications: "  نقش بسيط  ",
      quantity: 2,
    });
    const resumed = await service.get(created.draft.id);
    expect(saved).toMatchObject({
      ok: true,
      draft: {
        itemName: "صندوق خشبي",
        specifications: "نقش بسيط",
        quantity: 2,
        createdAt: "2026-08-22T00:00:00.000Z",
        updatedAt: "2026-08-22T01:00:00.000Z",
      },
    });
    expect(resumed).toMatchObject({ ok: true, value: { itemName: "صندوق خشبي", quantity: 2 } });
  });

  it("rejects an invalid quantity without overwriting the existing draft", async () => {
    const store = new MemoryLocalStore();
    const service = new DraftService(store, () => "2026-08-22T00:00:00.000Z");
    const created = await service.create("customer_order");
    if (!created.ok) throw new Error("draft should be created");
    const rejected = await service.save({ ...created.draft, quantity: 0 });
    const unchanged = await service.get(created.draft.id);
    expect(rejected).toMatchObject({ ok: false, code: "validation_error" });
    expect(unchanged).toMatchObject({ ok: true, value: { quantity: 1 } });
  });

  /* القرار ٢١ (بناء لا توصيل): المسودة المهجورة تُحذف بسهولة وبلا سبب —
   * والحد القاطع linkedOrderId !== null يُقرأ من الحقل ولا يُستنتج من الحالة. */
  it("deletes an unlinked draft easily without a reason and removes it from the store", async () => {
    const store = new MemoryLocalStore();
    const service = new DraftService(store, () => "2026-08-22T00:00:00.000Z");
    const created = await service.create("planned_design");
    if (!created.ok) throw new Error("draft should be created");
    await expect(service.delete(created.draft.id)).resolves.toMatchObject({
      ok: true,
      id: created.draft.id,
    });
    const after = await service.list();
    expect(after.ok && after.value).toHaveLength(0);
  });

  it("refuses to delete a draft that became an order — the field is read, not inferred", async () => {
    const store = new MemoryLocalStore();
    const service = new DraftService(store, () => "2026-08-22T00:00:00.000Z");
    const created = await service.create("customer_order");
    if (!created.ok) throw new Error("draft should be created");
    const linked = await service.save({ ...created.draft, linkedOrderId: "order-1" });
    if (!linked.ok) throw new Error("draft should save");
    await expect(service.delete(linked.draft.id)).resolves.toMatchObject({
      ok: false,
      code: "validation_error",
    });
    const kept = await service.get(linked.draft.id);
    expect(kept).toMatchObject({ ok: true, value: { linkedOrderId: "order-1" } });
  });

  it("says not_found honestly when deleting an unknown draft instead of pretending success", async () => {
    const service = new DraftService(new MemoryLocalStore(), () => "2026-08-22T00:00:00.000Z");
    await expect(service.delete("missing-id")).resolves.toMatchObject({
      ok: false,
      code: "not_found",
    });
  });

  /* و٦ (§٥-٩): لا طمس صامت لتعديل أحدث من نافذة ثانية — الحفظ برقم المرجعية
   * (updatedAt) كما فُتحت المسودة، وعند تقدمه يُرفض الحفظ. */
  it("refuses a save whose expected updatedAt fell behind a newer edit from another window", async () => {
    const store = new MemoryLocalStore();
    const timestamps = [
      "2026-08-22T00:00:00.000Z", // الإنشاء
      "2026-08-22T01:00:00.000Z", // حفظ النافذة الأولى
      "2026-08-22T02:00:00.000Z", // محاولة النافذة الثانية
    ];
    const service = new DraftService(store, () => timestamps.shift()!);
    const created = await service.create("customer_order");
    if (!created.ok) throw new Error("draft should be created");
    const openedAt = created.draft.updatedAt;

    const first = await service.save({ ...created.draft, itemName: "تصحيح النافذة الأولى" });
    if (!first.ok) throw new Error(first.message);

    const stale = await service.save(
      { ...created.draft, itemName: "تصحيح النافذة الثانية المتأخرة" },
      openedAt,
    );
    expect(stale).toMatchObject({ ok: false, code: "conflict" });

    const after = await service.get(created.draft.id);
    expect(after).toMatchObject({ ok: true, value: { itemName: "تصحيح النافذة الأولى" } });
  });

  it("accepts a save whose expected updatedAt matches the stored draft", async () => {
    const store = new MemoryLocalStore();
    const timestamps = ["2026-08-22T00:00:00.000Z", "2026-08-22T01:00:00.000Z"];
    const service = new DraftService(store, () => timestamps.shift()!);
    const created = await service.create("planned_design");
    if (!created.ok) throw new Error("draft should be created");
    await expect(
      service.save({ ...created.draft, itemName: "بمفتاح صحيح" }, created.draft.updatedAt),
    ).resolves.toMatchObject({ ok: true, draft: { itemName: "بمفتاح صحيح" } });
  });

  it("keeps the guard optional so saves without an expectation behave as before", async () => {
    const store = new MemoryLocalStore();
    const timestamps = ["2026-08-22T00:00:00.000Z", "2026-08-22T01:00:00.000Z"];
    const service = new DraftService(store, () => timestamps.shift()!);
    const created = await service.create("customer_order");
    if (!created.ok) throw new Error("draft should be created");
    await service.save({ ...created.draft, itemName: "حفظ أول" });
    await expect(service.save({ ...created.draft, itemName: "حفظ ثانٍ" })).resolves.toMatchObject({
      ok: true,
      draft: { itemName: "حفظ ثانٍ" },
    });
  });

  it("creates a draft carrying first real input values, never an empty record from a click (و٥)", async () => {
    const service = new DraftService(new MemoryLocalStore(), () => "2026-08-30T00:00:00.000Z");
    const created = await service.create("customer_order", { itemName: "صندوق", quantity: 3 });
    expect(created).toMatchObject({
      ok: true,
      draft: { itemName: "صندوق", quantity: 3, customerName: "", specifications: "" },
    });
  });
});
