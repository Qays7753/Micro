/**
 * S12-TRANSFER-001 (أمر S13 2158b0fc §5 — موجدة المراجعة المستقلة عند
 * ac4429ef): القيمة الحاضرة المشوهة في followUpEvents لم تعد تُمحى بصمت —
 * ملف تصدير سليم المظروف (بصمة sha256 معاد حسابها وعدادات صحيحة) يحمل
 * طلبًا واحدًا صالحًا كاملًا قُلب حقل أحداث متابعته إلى قيمة مشوهة حاضرة
 * (نص/كائن/null) يُرفض قبل المعاينة والكتابة على الزوج الحالي 33/40 وعلى
 * الزوج الموروث المدعوم 32/40 معًا، ويبقى المخزن الهدف بالبايت/السجل كما
 * كان — لا محو بيانات حاضرة ولا استيراد نصف نجاح.
 */
import { describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { syncSha256Hex } from "@/lib/syncSha256";
import { calculateCostSnapshot, createCraftOrder } from "@micro-domain/craft-order/index.js";

const NOW = "2026-11-01T09:00:00.000Z";
const now = () => NOW;

/** ملف تصدير حقيقي كامل: طلب واحد صالح (بمواعيد متابعة فارغة سليمة) من
 * * مصدر حقيقي عبر المهايئ — لا شكل ملف يدوي. */
async function realExportFile(): Promise<Record<string, unknown>> {
  const store = new MemoryLocalStore();
  const cost = calculateCostSnapshot("s12t-cost", {
    source: "draft",
    currency: "JOD",
    materialItems: [],
    time: { minutes: 60, hourlyRateMinor: 500, confidence: "known" },
    packagingMinor: 0,
    deliveryMinor: 0,
    wasteMinor: 0,
    safetyBufferMinor: 0,
    quantity: 1,
    createdAt: NOW,
    freshnessDays: null,
  });
  const order = createCraftOrder({
    id: "s12t-order",
    customerName: "سارة",
    itemName: "صندوق فحص الأحداث المشوهة",
    specifications: "اختبار",
    quantity: 1,
    agreedPriceMinor: 2000,
    costSnapshot: cost,
    createdAt: NOW,
  });
  const saved = await store.saveOrder({
    catalogItemId: null,
    id: order.id,
    order,
    deliveryDate: "2026-11-20",
    agreementSource: null,
    followUpSummary: null,
    followUpDate: null,
    followUpReason: null,
    followUpEvents: [],
    createdAt: NOW,
    updatedAt: NOW,
  });
  if (!saved.ok) throw new Error(saved.message);
  const exported = await new LocalTransferService(store, now).createExport();
  if (!exported.ok) throw new Error(exported.message);
  return structuredClone(exported.value) as unknown as Record<string, unknown>;
}

/** بذل القيمة المشوهة الحاضرة مع إعادة إحكام المظروف — البصمة تُعاد على
 * البيانات المتغيرة والعدادات صادقة (طلب واحد كما هو). */
function tamperedFollowUpEvents(
  file: Record<string, unknown>,
  malformed: unknown,
  version: number,
  schemaVersion: number,
): string {
  const data = file.data as { orders: Array<Record<string, unknown>> };
  data.orders[0]!.followUpEvents = malformed;
  file.version = version;
  file.schemaVersion = schemaVersion;
  file.integrity = { algorithm: "sha256", digest: syncSha256Hex(JSON.stringify(data)) };
  return JSON.stringify(file);
}

const PAIRS: ReadonlyArray<readonly [number, number, string]> = [
  [33, 40, "الزوج الحالي 33/40"],
  [32, 40, "الزوج الموروث 32/40"],
];

const MALFORMED: ReadonlyArray<readonly [string, unknown]> = [
  ["نص", "حدث مشوه"],
  ["كائن", { id: "ليس حدثًا", type: 1 }],
  ["null", null],
];

describe("S12-TRANSFER-001 — الأحداث الحاضرة المشوهة لا تُمحى: رفض صادق قبل المعاينة والكتابة", () => {
  for (const [version, schemaVersion, pairLabel] of PAIRS) {
    for (const [kind, value] of MALFORMED) {
      it(`${pairLabel}: followUpEvents حاضر مشوه (${kind}) — مظروف سليم والرفض قبل أي كتابة`, async () => {
        const file = await realExportFile();
        const text = tamperedFollowUpEvents(file, value, version, schemaVersion);
        const target = new MemoryLocalStore();
        const before = await target.readSnapshot();
        if (!before.ok) throw new Error("before read failed");
        const transfers = new LocalTransferService(target, now);

        /* الرفض عند التحقق قبل المعاينة — لا قيمة معاينة تُنتج أصلًا. */
        const importResult = transfers.prepareImport(text);
        expect(importResult).toMatchObject({ ok: false, code: "validation_error" });
        const restoreResult = await transfers.prepareRestore(text);
        expect(restoreResult).toMatchObject({ ok: false, code: "validation_error" });

        /* المخزن الهدف بالبايت/السجل كما كان — لم تمسه أي كتابة. */
        const after = await target.readSnapshot();
        if (!after.ok) throw new Error("after read failed");
        expect(after.value).toEqual(before.value);
      });
    }
  }

  it("الغياب الحقيقي للحقل يبقى قيمة افتراضية مشروعة — لا يوسّع الرفض إلى الغائب", async () => {
    /* حذف الحقل كليًا (غياب حقيقي) = افتراض [] عند الترحيل كما كان — التمييز
     * بين الغياب والحضور المشوه هو عقد الإصلاح نفسه. */
    const file = await realExportFile();
    const data = file.data as { orders: Array<Record<string, unknown>> };
    delete data.orders[0]!.followUpEvents;
    file.integrity = { algorithm: "sha256", digest: syncSha256Hex(JSON.stringify(data)) };
    const prepared = new LocalTransferService(new MemoryLocalStore(), now).prepareImport(
      JSON.stringify(file),
    );
    expect(prepared).toMatchObject({ ok: true });
    if (!prepared.ok) throw new Error(prepared.message);
    expect(prepared.value.file.data.orders[0]?.followUpEvents).toEqual([]);
  });

  it("مصفوفة سليمة من الأحداث تعبر كما هي — الإصلاح لا يضيّق الصالح القائم", async () => {
    const file = await realExportFile();
    const data = file.data as { orders: Array<Record<string, unknown>> };
    data.orders[0]!.followUpEvents = [
      {
        id: "s12t-followup-1",
        type: "created",
        idempotencyKey: "s12t-followup-1",
        createdAt: NOW,
        previousDate: null,
        followUpDate: "2026-11-25",
        reason: "مراجعة بعد التسليم",
      },
    ];
    file.integrity = { algorithm: "sha256", digest: syncSha256Hex(JSON.stringify(data)) };
    const prepared = new LocalTransferService(new MemoryLocalStore(), now).prepareImport(
      JSON.stringify(file),
    );
    expect(prepared).toMatchObject({ ok: true });
  });
});
