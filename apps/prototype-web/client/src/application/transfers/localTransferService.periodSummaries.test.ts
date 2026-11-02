/**
 * S14 (DOC-023 / UNIT-002 — أمر ba2ce7b4 §5): نقل عائلتي ملخصات الفترة
 * وإيصالات الأوامر — التصدير يحملهما بعدادات صادقة، والاستيراد على الزوج
 * الحالي 34/41 يقبلهما ويستعيدهما كما هما، والزوج الموروث 33/40 يُقبل
 * بغيابهما (قائمة فارغة بلا اختراع)، والقيم المشوهة تُرفض قبل المعاينة
 * والكتابة، والإيصال المستعاد دليل تاريخي لا يعيد تنفيذ أثرًا.
 */
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createCommandReceipt,
  createPeriodSummary,
  type CommandReceipt,
  type PeriodSummary,
} from "@micro-domain/shared/index.js";
import { syncSha256Hex } from "@/lib/syncSha256";
import { LocalTransferService } from "./localTransferService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";

const DATABASE_NAME = "micro-prototype-local";
function clearDatabase(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
afterEach(clearDatabase);

const NOW = "2026-11-02T09:00:00.000Z";
const now = () => NOW;

function summary(): PeriodSummary {
  return createPeriodSummary(
    "summary-transfer-1",
    {
      kind: "direct_sales",
      ownerDomain: "direct-sale",
      from: "2026-09-01",
      to: "2026-10-31",
      currency: "JOD",
      coverageMode: "unrecorded_only",
      dimensions: {
        revenue: { state: "entered", amountMinor: 20_000, knowledge: "known" },
        received: { state: "unknown" },
      },
      coverageLinks: [
        { detailRef: "direct_sale:detail-1", dimension: "revenue", amountMinor: 8_000, revision: 1 },
      ],
      supersedesRef: null,
      supersedesReason: null,
      operationKey: "s14-transfer-summary-1",
    },
    NOW,
  );
}

function receipt(resultRefs: readonly string[]): CommandReceipt {
  return createCommandReceipt({
    commandId: "cmd-transfer-1",
    commandType: "account-completion",
    generation: "0",
    payloadVersion: 1,
    payloadDigest: "digest-transfer-1",
    outcome: "confirmed",
    resultRefs,
    recordedAt: NOW,
  });
}

async function seededStore() {
  const store = new MemoryLocalStore();
  const committed = await store.commitAccountCompletion({
    command: {
      commandId: "cmd-transfer-1",
      commandType: "account-completion",
      generation: "0",
      payloadVersion: 1,
      payloadDigest: "digest-transfer-1",
    },
    summaries: [summary()],
    cashObservation: null,
    recordedAt: NOW,
  });
  if (!committed.ok) throw new Error(committed.message);
  return store;
}

/** إعادة إحكام المظروف بعد التلاعب — بصمة صادقة على البيانات المتغيرة. */
function reseal(file: Record<string, unknown>): string {
  file.integrity = { algorithm: "sha256", digest: syncSha256Hex(JSON.stringify(file.data)) };
  return JSON.stringify(file);
}

describe("S14 — نقل ملخصات الفترة وإيصالات الأوامر (34/41)", () => {
  it("التصدير يحمل العائلتين بعدادات صادقة، والاستيراد الحالي يستعيدهما كما هما", async () => {
    const store = await seededStore();
    const transfers = new LocalTransferService(store, now);
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    expect(exported.value.data.periodSummaries).toHaveLength(1);
    expect(exported.value.data.commandReceipts).toHaveLength(1);
    if (!exported.value.counts) throw new Error("counts missing");
    expect(exported.value.counts.periodSummaries).toBe(1);
    expect(exported.value.counts.commandReceipts).toBe(1);
    /* الاستيراد على الذاكرة: قبول واستعادة كاملة بتطابق القيم. */
    const target = new MemoryLocalStore();
    const imported = await new LocalTransferService(target, now).prepareImport(
      JSON.stringify(exported.value),
    );
    expect(imported).toMatchObject({ ok: true });
    if (!imported.ok) throw new Error(imported.message);
    const restored = await target.replaceSnapshot(imported.value.file.data);
    if (!restored.ok) throw new Error(restored.message);
    const summaries = await target.listPeriodSummaries();
    expect(summaries.ok && summaries.value).toHaveLength(1);
    expect(summaries.ok && summaries.value[0]).toEqual(summary());
    const receipts = await target.listCommandReceipts();
    expect(receipts.ok && receipts.value).toHaveLength(1);
    /* الإيصال المستعاد دليل تاريخي — إعادة القصد نفسه تعيد نتيجة الأصل
     * على الهدف أيضًا (الحتمية تنتقل مع البيانات، لا يُعاد تنفيذ أثر). */
    const retried = await target.commitAccountCompletion({
      command: {
        commandId: "cmd-transfer-1",
        commandType: "account-completion",
        generation: "0",
        payloadVersion: 1,
        payloadDigest: "digest-transfer-1",
      },
      summaries: [summary()],
      cashObservation: null,
      recordedAt: NOW,
    });
    if (!retried.ok) throw new Error(retried.message);
    expect(retried.value.reused).toBe(true);
  });

  it("الزوج الموروث 33/40 يُقبل بلا العائلتين — الغياب قائمة فارغة بلا اختراع", async () => {
    const store = await seededStore();
    const transfers = new LocalTransferService(store, now);
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    const file = exported.value as unknown as Record<string, unknown>;
    const data = file.data as Record<string, unknown>;
    delete data.periodSummaries;
    delete data.commandReceipts;
    file.version = 33;
    file.schemaVersion = 40;
    const legacy = reseal(file);
    const prepared = await new LocalTransferService(new MemoryLocalStore(), now).prepareImport(legacy);
    expect(prepared).toMatchObject({ ok: true });
    if (!prepared.ok) throw new Error(prepared.message);
    expect(prepared.value.file.data.periodSummaries).toEqual([]);
    expect(prepared.value.file.data.commandReceipts).toEqual([]);
  });

  it("ملخص مشوه (بعد معرفة يحمل مبلغًا) يُرفض قبل المعاينة — والهدف لم يُمس", async () => {
    const store = await seededStore();
    const transfers = new LocalTransferService(store, now);
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    const file = exported.value as unknown as Record<string, unknown>;
    const data = file.data as { periodSummaries: Array<Record<string, unknown>> };
    /* بعد unknown مع مبلغ — شكل معرفة كاذب يكسر عقد الاتحاد الصادق. */
    data.periodSummaries[0]!.dimensions = { revenue: { state: "unknown", amountMinor: 5_000 } };
    const tampered = reseal(file);
    const target = new MemoryLocalStore();
    const before = await target.readSnapshot();
    const rejected = await new LocalTransferService(target, now).prepareImport(tampered);
    expect(rejected).toMatchObject({ ok: false, code: "validation_error" });
    const after = await target.readSnapshot();
    expect(after.ok && JSON.stringify(after.value)).toBe(before.ok ? JSON.stringify(before.value) : "");
  });

  it("إيصال مشوه (نجاح يحمل فشلًا) يُرفض قبل المعاينة", async () => {
    const store = await seededStore();
    const transfers = new LocalTransferService(store, now);
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    const file = exported.value as unknown as Record<string, unknown>;
    const data = file.data as { commandReceipts: Array<Record<string, unknown>> };
    data.commandReceipts[0]!.failureCode = "storage_error";
    const tampered = reseal(file);
    const rejected = await new LocalTransferService(new MemoryLocalStore(), now).prepareImport(tampered);
    expect(rejected).toMatchObject({ ok: false, code: "validation_error" });
  });

  it("معرف إيصال مكرر داخل الملف يُرفض — منع الدمج اليدوي الصامت", async () => {
    const store = await seededStore();
    const transfers = new LocalTransferService(store, now);
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    const file = exported.value as unknown as Record<string, unknown>;
    const data = file.data as { commandReceipts: CommandReceipt[] };
    data.commandReceipts = [data.commandReceipts[0]!, { ...data.commandReceipts[0]!, id: "cmd-other" }];
    /* المعرف المكرر بالأمر نفسه (commandId) — تعارض هوية صريح. */
    data.commandReceipts[1]!.id = data.commandReceipts[0]!.commandId;
    const tampered = reseal(file as Record<string, unknown>);
    const rejected = await new LocalTransferService(new MemoryLocalStore(), now).prepareImport(tampered);
    expect(rejected).toMatchObject({ ok: false, code: "validation_error" });
  });

  it("IndexedDB: الاستيراد والاستعادة يحملان العائلتين — تكافؤ المهايئين", async () => {
    await clearDatabase();
    const store = await seededStore();
    const transfers = new LocalTransferService(store, now);
    const exported = await transfers.createExport();
    if (!exported.ok) throw new Error(exported.message);
    const target = new IndexedDbLocalStore();
    const prepared = await new LocalTransferService(target, now).prepareImport(
      JSON.stringify(exported.value),
    );
    expect(prepared).toMatchObject({ ok: true });
    if (!prepared.ok) throw new Error(prepared.message);
    const restored = await target.replaceSnapshot(prepared.value.file.data);
    if (!restored.ok) throw new Error(restored.message);
    const summaries = await target.listPeriodSummaries();
    expect(summaries.ok && summaries.value).toHaveLength(1);
    const receipts = await target.listCommandReceipts();
    expect(receipts.ok && receipts.value).toHaveLength(1);
    expect(receipts.ok && receipts.value[0]?.commandId).toBe("cmd-transfer-1");
  });

  it("تزامن الأزواج: القائمة الصادرة تشمل 33/40 الموروث والزوج الحالي معًا", async () => {
    /* حارس انجراف مصغر: الزوج الموروث الجديد 33/40 مسجل، والزوج الحالي
     * يتبع الثوابت الحية (34/41 بعد S14). */
    const { RELEASED_LEGACY_EXPORT_PAIRS } = await import("./transferEnvelope");
    expect(RELEASED_LEGACY_EXPORT_PAIRS.has("33/40")).toBe(true);
    const { localExportVersion, localSchemaVersion } = await import("@/storage/local/types");
    expect(`${localExportVersion}/${localSchemaVersion}`).toBe("34/41");
    expect(RELEASED_LEGACY_EXPORT_PAIRS.has(`${localExportVersion}/${localSchemaVersion}`)).toBe(false);
  });
});

/* منع التحذير: vi مستورد للاستخدام المستقبلي في توسعات التلاعب الزمني. */
void vi;
