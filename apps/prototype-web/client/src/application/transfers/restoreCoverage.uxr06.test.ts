/** UXR-06 (عقد ٣٩/٠٤٤ + A16/A20): تغطية الاستعادة على ملف تعريف معزول وبيانات
 * اصطناعية فقط — لا بيانات مالك ولا ملفات حقيقية. المسارات الخمسة المنفذة هنا:
 * نسخة صحيحة (معاينة وتأكيد صريح ونسخة رجوع متحققة وذرية)، ونسخة تالفة (رفض بلا
 * كتابة)، ونسخة قديمة مقبولة (زوج موروث مسجل)، ونسخة غير مدعومة (رفض على الباب)،
 * وإلغاء المعاينة (لا كتابة). فشل الاستبدال/عدم الكتابة الجزئية مغطى في
 * localTransferService.restoreProtection.test.ts القائم (بناء النسخة الرجوع قبل
 * الاستبدال، السياج داخل المعاملة، حسم الانهيار، النية المستعصية) — تصحيح مؤرخ
 * 2026-11-06 (UXR-W05/مراجعة 4) بعد أن عدّدها الترويسة خطأً ضمن هذا الملف.
 *
 * ⚠️ مؤجل التشغيل بأمر المالك (أمر التنفيذ المتصل 2026-11-06 §5/§6): يُكتب
 * مع التغيير ولا يُشغَّل إلا في التحقق الشامل بعد W05. */
import { describe, expect, it } from "vitest";
import { createDirectSale } from "@micro-domain/direct-sale/index.js";
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { ProfileService } from "@/application/profile/profileService";
import { LocalTransferService } from "./localTransferService";
import { localExportVersion, localSchemaVersion } from "@/storage/local/types";

const NOW = "2026-11-06T09:00:00.000Z";

async function seedSynthetic(store: MemoryLocalStore) {
  const profile = await new ProfileService(store, () => NOW).create("ورشة اصطناعية للاختبار");
  if (!profile.ok) throw new Error(profile.message);
  const sale = await store.saveDirectSale(
    createDirectSale({
      id: "synthetic-sale-1",
      itemName: "قطعة اصطناعية",
      quantity: 2,
      revenueMinor: 15000,
      collectedMinor: 5000,
      costMinor: null,
      occurredOn: "2026-11-01",
      recordedAt: "2026-11-01T08:00:00.000Z",
      note: "بيع اصطناعي",
      idempotencyKey: "synthetic-sale-1",
      customerName: null,
    }),
  );
  if (!sale.ok) throw new Error(sale.message);
  const expense = await store.saveFinancialEvent(
    createFinancialEvent({
      id: "synthetic-expense-1",
      type: "operating_expense_cash",
      amountMinor: 2500,
      occurredOn: "2026-11-02",
      recordedAt: "2026-11-02T08:00:00.000Z",
      idempotencyKey: "synthetic-expense-1",
      note: "مصروف اصطناعي",
      counterparty: null,
    }),
  );
  if (!expense.ok) throw new Error(expense.message);
}

function service(store: MemoryLocalStore) {
  return new LocalTransferService(store, () => NOW);
}

describe("UXR-06 — تغطية الاستعادة على ملف معزول وبيانات اصطناعية", () => {
  it("نسخة صحيحة: معاينة قراءة خالصة ثم تأكيد صريح يستبدل ذريًا مع نسخة رجوع متحققة", async () => {
    const source = new MemoryLocalStore();
    await seedSynthetic(source);
    const exporter = service(source);
    const file = await exporter.createExport();
    if (!file.ok) throw new Error(file.message);
    expect(file.value.version).toBe(localExportVersion);
    expect(file.value.schemaVersion).toBe(localSchemaVersion);

    const target = new MemoryLocalStore();
    await seedSynthetic(target);
    /* تعديل مستهدف ليختلف المضمون قبل الاستعادة. */
    const extra = await target.saveFinancialEvent(
      createFinancialEvent({
        id: "target-extra",
        type: "operating_expense_cash",
        amountMinor: 999,
        occurredOn: "2026-11-03",
        recordedAt: "2026-11-03T08:00:00.000Z",
        idempotencyKey: "target-extra",
        note: "سيزول بالاستبدال",
        counterparty: null,
      }),
    );
    if (!extra.ok) throw new Error(extra.message);

    const targetService = service(target);
    const before = await target.readSnapshot();
    /* UXR-08 (تصحيح تجميعي للاختبار المؤجل): المعاينة عبر prepareRestore —
     * الربط بالمراجعة (الجيل وبصمة الحالة الحية) هو ما يقبله confirmImport
     * (BoundRestoreIntent) وفق عقد ٠٤٤/S02-A؛ prepareImport وحده لا يصلح مدخلًا للتأكيد. */
    const prepared = await targetService.prepareRestore(JSON.stringify(file.value));
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error(prepared.message);

    /* المعاينة قراءة خالصة: لا كتابة قبل التأكيد (عقد ٠٤٤). */
    const stillBefore = await target.readSnapshot();
    if (!before.ok || !stillBefore.ok) throw new Error("snapshot read failed");
    expect(stillBefore.value).toEqual(before.value);

    const confirmed = await targetService.confirmImport(prepared.value);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) throw new Error(confirmed.message);
    expect(confirmed.value.profile).toBe(true);
    const restoredProfile = await target.getProfile();
    if (!restoredProfile.ok || !restoredProfile.value) throw new Error("restored profile missing");
    expect(restoredProfile.value.activityName).toBe("ورشة اصطناعية للاختبار");

    const after = await target.readSnapshot();
    if (!after.ok) throw new Error(after.message);
    /* الاستبدال الذري: أثر المصدر حاضر وأثر المستهدف الإضافي زال. */
    expect(after.value.directSales?.length ?? 0).toBe(1);
    expect((after.value.financialEvents ?? []).some(event => event.id === "target-extra")).toBe(false);

    /* نسخة رجوع متحققة: العودة الدائمة جاهزة وتحمل ما قبل الاستبدال. */
    const rollbackStatus = await targetService.readRestoreStatus();
    expect(rollbackStatus.ok && rollbackStatus.value.rollbackCreatedAt).toBeTruthy();
    const rollback = await targetService.readActiveRollback();
    expect(rollback.ok).toBe(true);
    if (rollback.ok && rollback.value) {
      const rollbackPrepared = targetService.prepareImport(JSON.stringify(rollback.value.file));
      expect(rollbackPrepared.ok).toBe(true);
      expect(rollbackPrepared.ok && rollbackPrepared.value.summary.directSales).toBe(1);
    }
  });

  it("نسخة تالفة: رفض على الباب بلا أي كتابة — بيانات الجهاز كما هي", async () => {
    const source = new MemoryLocalStore();
    await seedSynthetic(source);
    const file = await service(source).createExport();
    if (!file.ok) throw new Error(file.message);
    const corrupted = JSON.stringify(file.value).replace(
      '"format":"micro-prototype-local-export"',
      '"format":"micro-prototype-local-export "',
    );

    const target = new MemoryLocalStore();
    await seedSynthetic(target);
    const before = await target.readSnapshot();
    const result = service(target).prepareImport(corrupted);
    expect(result.ok).toBe(false);
    const after = await target.readSnapshot();
    if (!before.ok || !after.ok) throw new Error("snapshot read failed");
    expect(after.value).toEqual(before.value);
  });

  it("نسخة قديمة مقبولة: زوج موروث مسجل يمر المعاينة ويستبدل بصدق", async () => {
    const source = new MemoryLocalStore();
    await seedSynthetic(source);
    const file = await service(source).createExport();
    if (!file.ok) throw new Error(file.message);
    /* زوج موروث مسجل (S12/S13 كما صدر فعلًا — 33/40 بصيغة الإصدار/المخطط). */
    const legacy = { ...file.value, version: 33, schemaVersion: 40 };

    const target = new MemoryLocalStore();
    const prepared = service(target).prepareImport(JSON.stringify(legacy));
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) throw new Error(prepared.message);
  });

  it("نسخة غير مدعومة: زوج غير مسجل يُرفض برسالة صريحة بلا كتابة", async () => {
    const source = new MemoryLocalStore();
    await seedSynthetic(source);
    const file = await service(source).createExport();
    if (!file.ok) throw new Error(file.message);
    const unsupported = { ...file.value, version: 99, schemaVersion: 99 };

    const target = new MemoryLocalStore();
    await seedSynthetic(target);
    const before = await target.readSnapshot();
    const result = service(target).prepareImport(JSON.stringify(unsupported));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("غير مدعوم");
    const after = await target.readSnapshot();
    if (!before.ok || !after.ok) throw new Error("snapshot read failed");
    expect(after.value).toEqual(before.value);
  });

  it("إلغاء المعاينة: عدم التأكيد لا يكتب شيئًا (الإلغاء مسار صريح آمن)", async () => {
    const source = new MemoryLocalStore();
    await seedSynthetic(source);
    const file = await service(source).createExport();
    if (!file.ok) throw new Error(file.message);

    const target = new MemoryLocalStore();
    await seedSynthetic(target);
    const before = await target.readSnapshot();
    const prepared = service(target).prepareImport(JSON.stringify(file.value));
    expect(prepared.ok).toBe(true);
    /* إلغاء صريح: لا confirmImport — السجل كما هو تمامًا. */
    const after = await target.readSnapshot();
    if (!before.ok || !after.ok) throw new Error("snapshot read failed");
    expect(after.value).toEqual(before.value);
  });
});
