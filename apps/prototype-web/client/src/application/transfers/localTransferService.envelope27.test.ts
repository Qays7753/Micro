/** المجموعة ٥ (عقد ٣٩ — اختبار مظروف النسخة ٢٧): بصمة التكامل ترفض التلاعب
 * بعد الإنشاء، والعدادات المضمّنة تصل، وملف ٢٦/٣٤ (زوج المجموعة ٤) يبقى
 * مقبولًا كما وعد العقد. */
import { describe, expect, it } from "vitest";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { LocalTransferService } from "./localTransferService";

const now = () => "2026-09-05T09:00:00.000Z";

async function seedExpense(store: MemoryLocalStore) {
  const saved = await store.saveFinancialEvent(
    createFinancialEvent({
      id: "envelope-exp",
      type: "operating_expense_cash",
      amountMinor: 1500,
      occurredOn: "2026-09-01",
      recordedAt: now(),
      idempotencyKey: "envelope-exp",
      note: "بنزين",
      counterparty: null,
    }),
  );
  if (!saved.ok) throw new Error(saved.message);
}

describe("export envelope v27 (المجموعة ٥ — عقد ٣٩)", () => {
  it("embeds sha256 integrity, embedded counts, and app version", async () => {
    const store = new MemoryLocalStore();
    await seedExpense(store);
    const transfers = new LocalTransferService(store, now);
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    expect(exported.value.version).toBe(27);
    expect(exported.value.integrity?.algorithm).toBe("sha256");
    expect(exported.value.integrity?.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(exported.value.counts?.financialEvents).toBe(1);
    expect(exported.value.appVersion).toBe("micro-prototype-web");
    /* دورة كاملة عبر التحقق الذاتي — المظروف نفسه يعبر. */
    const verified = await transfers.createVerifiedExport();
    expect(verified.ok).toBe(true);
  });

  it("rejects a tampered file by digest before any preview — data unchanged", async () => {
    const store = new MemoryLocalStore();
    await seedExpense(store);
    const transfers = new LocalTransferService(store, now);
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    const tampered = JSON.parse(JSON.stringify(exported.value));
    tampered.data.financialEvents[0].amountMinor = 10;
    const prepared = transfers.prepareImport(JSON.stringify(tampered));
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) expect(prepared.code).toBe("validation_error");
    expect(prepared.message).toContain("بصمة التكامل");
  });

  it("accepts the Group-4 26/34 pair verbatim — legacy promise kept", async () => {
    const store = new MemoryLocalStore();
    await seedExpense(store);
    const transfers = new LocalTransferService(store, now);
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    const group4File = JSON.parse(JSON.stringify(exported.value));
    group4File.version = 26;
    group4File.schemaVersion = 34;
    delete group4File.integrity;
    delete group4File.counts;
    delete group4File.appVersion;
    const prepared = new LocalTransferService(new MemoryLocalStore(), now).prepareImport(
      JSON.stringify(group4File),
    );
    expect(prepared.ok).toBe(true);
  });
});
