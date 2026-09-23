import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";

/* REL-001 (WS-181 — Wave 9 / عقد ٣٩ + ٣٥): فجوة الصمود — إعادة المحاولة بعد
 * الرفض والاستيراد المعاد: ملف مرفوض يترك البيانات كما كانت، ثم الملف
 * الصحيح يستورد نظيفًا بلا بقايا؛ وإعادة استيراد الملف المتحقق نفسه مرتين
 * تستبدل استبدالًا ذريًا بلا تكرار ولا فقد (الحالة النهائية مطابقة) —
 * بيانات اصطناعية فقط، لا بيانات مستخدم حقيقية. */

const NOW = "2026-09-23T12:00:00.000Z";

function seedEvent(store: MemoryLocalStore) {
  const event = createFinancialEvent({
    id: "event-rel-1",
    type: "operating_expense_cash",
    amountMinor: 5000,
    occurredOn: "2026-08-01",
    recordedAt: NOW,
    idempotencyKey: "rel-1:expense",
    note: "مصروف اصطناعي للاختبار",
    expenseContext: {
      relationship: "project",
      behavior: "fixed",
      purpose: "period",
      knowledge: "known",
    },
  });
  return store.saveFinancialEvent(event);
}

async function exportSnapshotOf(store: MemoryLocalStore) {
  const service = new LocalTransferService(store, () => NOW);
  const exported = await service.createVerifiedExport();
  if (!exported.ok) throw new Error(exported.message);
  return exported.value.file;
}

describe("REL-001 resilience gap-fill (WS-181 — Wave 9)", () => {
  it("recovers cleanly after a rejected import: data untouched, then the good file applies with no residue", async () => {
    const source = new MemoryLocalStore();
    const seeded = await seedEvent(source);
    if (!seeded.ok) throw new Error(seeded.message);
    const goodFile = await exportSnapshotOf(source);

    const target = new MemoryLocalStore();
    const targetSeed = await seedEvent(target);
    if (!targetSeed.ok) throw new Error(targetSeed.message);
    const before = await target.readSnapshot();
    if (!before.ok) throw new Error(before.message);

    const service = new LocalTransferService(target, () => NOW);
    /* المحاولة الأولى: ملف مكسور (حدث بمفتاح حتمية مكرر داخل العائلة) —
     * يُرفض قبل أي استبدال وبيانات الجهاز لا تُمس. */
    const tampered = JSON.parse(JSON.stringify(goodFile));
    tampered.data.financialEvents = [
      ...(tampered.data.financialEvents ?? []),
      tampered.data.financialEvents[0],
    ];
    const rejected = await service.prepareImport(JSON.stringify(tampered));
    expect(rejected.ok).toBe(false);
    const afterReject = await target.readSnapshot();
    if (!afterReject.ok) throw new Error(afterReject.message);
    expect(JSON.stringify(afterReject.value)).toBe(JSON.stringify(before.value));

    /* إعادة المحاولة بالملف الصحيح: استيراد نظيف بلا بقايا من الرفض. */
    const retried = await service.prepareImport(JSON.stringify(goodFile));
    expect(retried.ok).toBe(true);
    if (!retried.ok) throw new Error(retried.message);
    const applied = await service.confirmImport(retried.value);
    if (!applied.ok) throw new Error(applied.message);
    const events = await target.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    expect(events.value.filter(event => event.id === "event-rel-1")).toHaveLength(1);
  });

  it("re-importing the same verified file twice replaces atomically: no duplication, no loss", async () => {
    const source = new MemoryLocalStore();
    const seeded = await seedEvent(source);
    if (!seeded.ok) throw new Error(seeded.message);
    const goodFile = await exportSnapshotOf(source);

    const target = new MemoryLocalStore();
    const service = new LocalTransferService(target, () => NOW);
    for (let round = 1; round <= 2; round += 1) {
      const prepared = await service.prepareImport(JSON.stringify(goodFile));
      expect(prepared.ok).toBe(true);
      if (!prepared.ok) throw new Error(prepared.message);
      const applied = await service.confirmImport(prepared.value);
      if (!applied.ok) throw new Error(applied.message);
      const events = await target.listFinancialEvents();
      if (!events.ok) throw new Error(events.message);
      /* الاستبدال الذري: الحالة النهائية بعد كل دورة مطابقة للمصدر —
       * لا تكرار بالتطبيق الثاني ولا فقد. */
      expect(events.value.filter(event => event.id === "event-rel-1")).toHaveLength(1);
    }
    const finalEvents = await target.listFinancialEvents();
    const sourceEvents = await source.listFinancialEvents();
    if (!finalEvents.ok || !sourceEvents.ok) throw new Error("event read failed");
    expect(finalEvents.value).toHaveLength(sourceEvents.value.length);
  });
});
