import { describe, expect, it } from "vitest";
import { createCraftOrder, calculateCostSnapshot } from "@micro-domain/craft-order/index.js";
import { AgreementContextService } from "./agreementContextService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

async function storedOrder(id = "order-context") {
  const store = new MemoryLocalStore();
  const cost = calculateCostSnapshot(`${id}-cost`, { currency: "JOD", materialItems: [], time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" }, packagingMinor: 0, deliveryMinor: 0, wasteMinor: 0, safetyBufferMinor: 0, quantity: 1, createdAt: "2026-08-22T00:00:00.000Z", freshnessDays: null });
  const order = createCraftOrder({ id, customerName: "سارة", itemName: "صندوق سياق", specifications: "اختبار", quantity: 1, agreedPriceMinor: 2200, costSnapshot: cost, createdAt: "2026-08-22T00:00:00.000Z" });
  await store.saveOrder({ id, order, catalogItemId: null, deliveryDate: "2026-08-30", agreementSource: null, followUpSummary: null, followUpDate: null, followUpReason: null, followUpEvents: [], createdAt: "2026-08-22T00:00:00.000Z", updatedAt: "2026-08-22T00:00:00.000Z" });
  return store;
}

const emptyContext = { agreementSource: null, followUpSummary: null, followUpDate: null, followUpReason: null };

describe("AgreementContextService", () => {
  it("keeps an unspecified source explicit and saves every allowed source locally", async () => {
    const store = await storedOrder(); const service = new AgreementContextService(store, () => "2026-08-23T08:00:00.000Z");
    await expect(service.get("order-context")).resolves.toMatchObject({ ok: true, value: { agreementSource: null, followUpDate: null, followUpSummary: null } });
    for (const agreementSource of ["instagram", "whatsapp", "referral", "walk_in", "other"] as const) {
      await expect(service.save("order-context", { ...emptyContext, agreementSource })).resolves.toMatchObject({ ok: true, value: { agreementSource } });
    }
    await expect(service.save("order-context", { ...emptyContext, agreementSource: "telegram" as never })).resolves.toMatchObject({ ok: false, code: "validation_error" });
  });

  it("saves an owner-written summary and local follow-up date without creating a schedule", async () => {
    const store = await storedOrder(); const service = new AgreementContextService(store, () => "2026-08-23T08:00:00.000Z");
    const beforeSchedules = await store.listSchedules();
    const saved = await service.save("order-context", { agreementSource: "whatsapp", followUpSummary: "تأكيد اللون والموعد", followUpDate: "2026-08-25", followUpReason: "تأكيد التفاصيل مع العميل" });
    expect(saved).toMatchObject({ ok: true, value: { agreementSource: "whatsapp", followUpSummary: "تأكيد اللون والموعد", followUpDate: "2026-08-25", followUpReason: "تأكيد التفاصيل مع العميل", followUpEvents: [{ type: "created", previousDate: null, followUpDate: "2026-08-25" }] } });
    const afterSchedules = await store.listSchedules(); expect(afterSchedules).toEqual(beforeSchedules);
    await expect(service.dueFollowUps()).resolves.toMatchObject({ ok: true, value: { due: [], upcoming: [{ id: "order-context", followUpDate: "2026-08-25" }] } });
  });

  it("requires a reason to change an existing follow-up date and preserves the history on correction", async () => {
    const store = await storedOrder(); const service = new AgreementContextService(store, () => "2026-08-23T08:00:00.000Z");
    await service.save("order-context", { agreementSource: "referral", followUpSummary: "راجع المقاس", followUpDate: "2026-08-24", followUpReason: "مراجعة المقاس" });
    await expect(service.save("order-context", { agreementSource: "referral", followUpSummary: "راجع المقاس", followUpDate: "2026-08-25", followUpReason: null })).resolves.toMatchObject({ ok: false, code: "validation_error" });
    await expect(store.getOrder("order-context")).resolves.toMatchObject({ ok: true, value: { followUpDate: "2026-08-24", followUpEvents: [{ type: "created" }] } });
    const before = await store.getOrder("order-context"); if (!before.ok || !before.value) throw new Error("order should exist");
    await expect(service.save("order-context", { agreementSource: "referral", followUpSummary: "راجع المقاس", followUpDate: "2026-08-25", followUpReason: "العميل طلب يومًا مختلفًا" })).resolves.toMatchObject({ ok: true, value: { followUpDate: "2026-08-25", followUpEvents: [{ type: "created" }, { type: "changed", previousDate: "2026-08-24", followUpDate: "2026-08-25", reason: "العميل طلب يومًا مختلفًا" }] } });
    await expect(store.getOrder("order-context")).resolves.toMatchObject({ ok: true, value: { order: { agreedPriceMinor: before.value.order.agreedPriceMinor, collectedMinor: before.value.order.collectedMinor }, deliveryDate: "2026-08-30" } });
  });

  it("rejects clearing a follow-up date without a reason, then clears it with an audited reason only", async () => {
    const store = await storedOrder("order-clear"); const service = new AgreementContextService(store, () => "2026-08-23T08:00:00.000Z");
    await service.save("order-clear", { agreementSource: "whatsapp", followUpSummary: "تأكيد العينة", followUpDate: "2026-08-25", followUpReason: "تأكيد اللون" });
    const beforeSchedules = await store.listSchedules(); const before = await store.getOrder("order-clear"); if (!before.ok || !before.value) throw new Error("order should exist");
    await expect(service.save("order-clear", { agreementSource: "whatsapp", followUpSummary: "تأكيد العينة", followUpDate: null, followUpReason: " " })).resolves.toMatchObject({ ok: false, code: "validation_error" });
    await expect(store.getOrder("order-clear")).resolves.toMatchObject({ ok: true, value: { followUpDate: "2026-08-25", followUpReason: "تأكيد اللون", followUpEvents: [{ type: "created" }] } });
    await expect(service.save("order-clear", { agreementSource: "whatsapp", followUpSummary: "تأكيد العينة", followUpDate: null, followUpReason: "تم إلغاء المتابعة بناءً على طلب العميل" })).resolves.toMatchObject({ ok: true, value: { followUpDate: null, followUpReason: null, followUpEvents: [{ type: "created" }, { type: "changed", previousDate: "2026-08-25", followUpDate: null, reason: "تم إلغاء المتابعة بناءً على طلب العميل" }] } });
    await expect(store.getOrder("order-clear")).resolves.toMatchObject({ ok: true, value: { order: { agreedPriceMinor: before.value.order.agreedPriceMinor, collectedMinor: before.value.order.collectedMinor }, deliveryDate: before.value.deliveryDate } });
    await expect(store.listSchedules()).resolves.toEqual(beforeSchedules);
  });

  it("returns due follow-ups separately from upcoming ones and rejects invalid local dates", async () => {
    const store = await storedOrder("order-due"); await store.saveOrder({ ...(await store.getOrder("order-due")).value as NonNullable<Awaited<ReturnType<MemoryLocalStore["getOrder"]>> extends { ok: true; value: infer T } ? T : never>, id: "order-due" });
    const secondStore = await storedOrder("order-upcoming");
    const dueService = new AgreementContextService(store, () => "2026-08-23T08:00:00.000Z"); const upcomingService = new AgreementContextService(secondStore, () => "2026-08-23T08:00:00.000Z");
    await dueService.save("order-due", { agreementSource: "walk_in", followUpSummary: "تحصيل جواب", followUpDate: "2026-08-23", followUpReason: "حان وقت المراجعة" });
    await upcomingService.save("order-upcoming", { agreementSource: "other", followUpSummary: "مراجعة العينة", followUpDate: "2026-08-24", followUpReason: "متابعة العينة" });
    await expect(dueService.dueFollowUps()).resolves.toMatchObject({ ok: true, value: { due: [{ id: "order-due" }], upcoming: [] } });
    await expect(upcomingService.dueFollowUps()).resolves.toMatchObject({ ok: true, value: { due: [], upcoming: [{ id: "order-upcoming" }] } });
    await expect(upcomingService.save("order-upcoming", { agreementSource: "other", followUpSummary: null, followUpDate: "2026-02-30", followUpReason: "تاريخ خاطئ" })).resolves.toMatchObject({ ok: false, code: "validation_error" });
  });
});
