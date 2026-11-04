import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import {
  IMPORT_SIZE_LIMIT_MESSAGE,
  MAX_IMPORT_FILE_UNITS,
  isWithinImportFileBytes,
  isWithinImportSizeLimit,
} from "./transferResourceLimits";
import { TRANSFER_ARRAY_FAMILY_ROLES } from "./transferArrayFamilyRoles";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import { syncSha256Hex } from "@/lib/syncSha256";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import {
  localExportVersion,
  localSchemaVersion,
  type FormDraftEnvelope,
  type LocalExportCounts,
  type LocalExportFile,
  type LocalStoreSnapshot,
  type PrototypeLocalStore,
} from "@/storage/local/types";

/* S17 (DOC-026 / UNIT-033+044 + SH-22 — الأمر المتصل 2026-11-04): الأدلة
 * الدائمة لحالات القبول المملوكة للمرحلة:
 *  - SDF-046: تصدير أثناء كتابات متزامنة ← لقطة متسقة، لا عدد من قبل الفعل
 *    ومبلغ من بعده (معاملة قراءة واحدة للقطة كلها).
 *  - SDF-048: ملف أكبر من حدود التحقق الآمن يُرفض قبل التحليل وقبل أي كتابة
 *    برسالة محددة؛ لا استيراد جزئي وإسقاط بقية الملف.
 *  - SDF-069: الملف القديم المؤهل (30/38) يهاجر دون إعادة مال، والتطبيق
 *    الحالي يرفض الزوج الأحدث بدل إسقاط حقول جديدة.
 *  - SDF-070: استعادة إيصالات تاريخية مع جيل محلي جديد — يحفظ تاريخها ولا
 *    يحيي أمرًا قديمًا أو إذن نموذج سابق؛ لا إعادة تنفيذ للأعمال.
 *  - SH-22: مصالحة العائلات — كل عائلة مصفوفية في اللقطة تحملها الملفات
 *    الحالية وتعدّها العدادات الصارمة، ومخازن الاستثناء (المسودات العابرة،
 *    القفل المتقاعد، قاعدة حماية الاستبدال، الجيل المحلي) خارج الملف أبدًا.
 */

const NOW = "2026-11-04T12:00:00.000Z";
const clock = () => NOW;

const GOLDEN_DIR = path.resolve(__dirname, "../../../../../../docs/fixtures/export-goldens");

function clearDatabases() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("micro-prototype-local");
    request.onerror = () => reject(new Error("main delete error"));
    request.onblocked = () => reject(new Error("main delete BLOCKED"));
    request.onsuccess = () => {
      const restoreRequest = indexedDB.deleteDatabase("micro-prototype-restore");
      restoreRequest.onerror = () => reject(new Error("restore delete error"));
      restoreRequest.onblocked = () => reject(new Error("restore delete BLOCKED"));
      restoreRequest.onsuccess = () => resolve();
    };
  });
}

async function seedProject(store: PrototypeLocalStore, name: string) {
  const saved = await store.saveProfile({
    id: "local-profile",
    activityName: name,
    currency: "JOD",
    activityType: "custom_craft",
    createdAt: NOW,
    updatedAt: NOW,
  });
  if (!saved.ok) throw new Error(saved.message);
}

/** حدث مالي مكتمل الشكل — الاستثمار النقدي للمالك (زيادة نقد ورأس مال معًا). */
function investmentEvent(id: string, amountMinor: number, key: string): FinancialEvent {
  return {
    id,
    type: "owner_investment_cash",
    currency: "JOD",
    amountMinor,
    occurredOn: "2026-10-01",
    recordedAt: NOW,
    idempotencyKey: key,
    note: "استثمار",
    counterparty: null,
    relatedEventId: null,
    cashDeltaMinor: amountMinor,
    payableDeltaMinor: 0,
    ownerCapitalDeltaMinor: amountMinor,
    operatingExpenseDeltaMinor: 0,
  };
}

async function saveEvent(store: PrototypeLocalStore, event: ReturnType<typeof investmentEvent>) {
  const saved = await store.saveFinancialEvent(event);
  if (!saved.ok) throw new Error(saved.message);
}

async function exportFileOf(service: LocalTransferService): Promise<LocalExportFile> {
  const exported = await service.createVerifiedExport();
  if (!exported.ok) throw new Error(exported.message);
  return exported.value.file;
}

async function restoreRoundTrip(service: LocalTransferService, file: LocalExportFile) {
  const prepared = await service.prepareRestore(JSON.stringify(file));
  if (!prepared.ok) throw new Error(prepared.message);
  const confirmed = await service.confirmImport(prepared.value);
  if (!confirmed.ok) throw new Error(confirmed.message);
  return confirmed.value;
}

const draftEnvelope: FormDraftEnvelope = {
  id: "direct_sale:new",
  formKind: "direct_sale",
  scopeId: null,
  valuesVersion: 1,
  generation: 0,
  values: { note: "بيع غير مسلم بعد" },
  createdAt: NOW,
  updatedAt: NOW,
};

/* ─── SDF-046: لقطة متسقة أثناء كتابات متزامنة ─── */

describe("S17 — SDF-046 export during concurrent writes yields one consistent snapshot", () => {
  afterEach(clearDatabases);

  it("a write racing the export read never tears the snapshot: counts, digest, and rows all come from the same read (IndexedDB adapter)", async () => {
    const store = new IndexedDbLocalStore();
    await seedProject(store, "ورشة سباق التصدير");
    await saveEvent(store, investmentEvent("event-seed", 12000, "seed:46"));

    const service = new LocalTransferService(store, clock);
    /* التصدير يبدأ (معاملة قراءة واحدة لكل المخازن) وقبل اكتمالها يُصدر
     * حدث ثانٍ في معاملة كتابة مستقلة — فلا يمكن أن يدخل نصفه في اللقطة. */
    const exportPromise = service.createExport();
    const racingWrite = saveEvent(store, investmentEvent("event-racing", 5000, "race:46"));
    const exported = await exportPromise;
    await racingWrite;
    if (!exported.ok) throw new Error(exported.message);
    const file = exported.value;

    /* اللقطة إما قبل الفعل أو بعده كاملة — لا مزيج: كل صف حدث مكتمل
     * (معرف+mبلغ معًا) والعدد من البيانات نفسها لا من لحظة أخرى. */
    const events = file.data.financialEvents;
    const ids = events.map(event => event.id);
    expect(ids).toContain("event-seed");
    expect(new Set(ids).has("event-racing")).toBe(ids.includes("event-racing"));
    for (const event of events) {
      expect(event.amountMinor).toBe(event.id === "event-seed" ? 12000 : 5000);
      expect(event.cashDeltaMinor).toBe(event.amountMinor);
      expect(event.ownerCapitalDeltaMinor).toBe(event.amountMinor);
    }
    /* لا عدد من قبل الفعل ومبلغ من بعده: العدادات من اللقطة نفسها. */
    if (file.counts) expect(file.counts.financialEvents).toBe(events.length);
    /* البصمة تطابق البيانات المطابقة نفسها — لا فصل بينهما. */
    expect(file.integrity?.digest).toBe(syncSha256Hex(JSON.stringify(file.data)));
    /* والملف الناتج يمر دورة تحقق كاملة كما هو — لا تمزق يخفيه التحليل. */
    const roundTrip = service.prepareImport(JSON.stringify(file));
    expect(roundTrip.ok).toBe(true);
  });

  it("memory adapter parity: the same race keeps the file internally consistent", async () => {
    const store = new MemoryLocalStore();
    await seedProject(store, "سباق الذاكرة");
    await saveEvent(store, investmentEvent("event-seed", 9000, "seed:46m"));

    const service = new LocalTransferService(store, clock);
    const exportPromise = service.createExport();
    const racingWrite = saveEvent(store, investmentEvent("event-racing", 3000, "race:46m"));
    const exported = await exportPromise;
    await racingWrite;
    if (!exported.ok) throw new Error(exported.message);

    const events = exported.value.data.financialEvents;
    expect(events.length).toBeGreaterThanOrEqual(1);
    if (exported.value.counts) expect(exported.value.counts.financialEvents).toBe(events.length);
    for (const event of events) {
      expect(event.amountMinor).toBe(event.id === "event-seed" ? 9000 : 3000);
    }
  });
});

/* ─── SDF-048: الملف الأكبر من حد التحقق الآمن يُرفض قبل أي شيء ─── */

describe("S17 — SDF-048 an oversized file is refused before parsing and before any write", () => {
  it("rejects a text beyond the import resource ceiling with the specific size message, before JSON parsing", () => {
    const service = new LocalTransferService(new MemoryLocalStore(), clock);
    /* نص أكبر من السقف وليس JSON أصلًا — رسالة الحجم تثبت أن البوابة تسبق
     * التحليل (وإلا لظهرت رسالة «ليس ملف نسخة صالحًا»). */
    const oversized = "x".repeat(MAX_IMPORT_FILE_UNITS + 1);
    const prepared = service.prepareImport(oversized);
    expect(prepared.ok).toBe(false);
    if (prepared.ok) return;
    expect(prepared.code).toBe("validation_error");
    expect(prepared.message).toBe(IMPORT_SIZE_LIMIT_MESSAGE);
    expect(prepared.message).not.toContain("ليس ملف نسخة صالحًا");
  });

  it("the ceiling is inclusive at the exact boundary — a padded valid file of exactly the limit is not refused for size", () => {
    const service = new LocalTransferService(new MemoryLocalStore(), clock);
    /* ملف حالٍ أدنى صادق (كل العائلات فارغة) مبطن بمسافات لاحقة إلى السقف
     * بالضبط — JSON يقبل المسافات اللاحقة، فالحد شامل لا قاطع عند الحافة. */
    const data: Record<string, unknown> = {
      profile: null,
      ownerProfile: null,
      preferences: null,
      inventoryActivation: null,
    };
    for (const family of Object.keys(TRANSFER_ARRAY_FAMILY_ROLES)) data[family] = [];
    const envelope = {
      format: "micro-prototype-local-export",
      version: localExportVersion,
      schemaVersion: localSchemaVersion,
      exportedAt: NOW,
      data,
      integrity: { algorithm: "sha256", digest: syncSha256Hex(JSON.stringify(data)) },
    };
    const base = JSON.stringify(envelope);
    const padded = base + " ".repeat(MAX_IMPORT_FILE_UNITS - base.length);
    expect(padded.length).toBe(MAX_IMPORT_FILE_UNITS);
    expect(isWithinImportSizeLimit(padded)).toBe(true);
    const prepared = service.prepareImport(padded);
    if (!prepared.ok) expect(prepared.message).not.toBe(IMPORT_SIZE_LIMIT_MESSAGE);
    else expect(prepared.ok).toBe(true);
  });

  it("the byte gate for the file picker refuses beyond the ceiling and admits at it", () => {
    expect(isWithinImportFileBytes(MAX_IMPORT_FILE_UNITS + 1)).toBe(false);
    expect(isWithinImportFileBytes(MAX_IMPORT_FILE_UNITS)).toBe(true);
  });

  it("the ceiling is a measured protective bound: a thousand times the largest honest golden stays far below it, and the bound itself stays bounded", () => {
    /* اشتقاق موثق لا رقم اعتباطي: أكبر ملف ذهبي صادق في المستودع (تغطية
     * كاملة للعائلات) × ١٠٠٠ ما زال دون السقف بمراحل — فلا يُرفض مشروع
     * صادق بحجم واقعي — والسقف نفسه دون ٢^٢٥ فيبقى وقائيًا فعليًا. */
    const goldens = readFileSync(path.join(GOLDEN_DIR, "MANIFEST.json"), "utf8");
    const manifest = JSON.parse(goldens) as { files: Array<{ file: string; sha256?: string }> };
    let largest = 0;
    for (const entry of manifest.files) {
      const text = readFileSync(path.join(GOLDEN_DIR, entry.file), "utf8");
      largest = Math.max(largest, text.length);
    }
    expect(largest).toBeGreaterThan(0);
    expect(largest * 1000).toBeLessThan(MAX_IMPORT_FILE_UNITS);
    expect(MAX_IMPORT_FILE_UNITS).toBeLessThan(2 ** 25);
  });
});

/* ─── SDF-069: القديم المؤهل يهاجر دون إعادة مال، والأحدث يُرفض ─── */

describe("S17 — SDF-069 an eligible old pair migrates without money replay; a newer pair is refused", () => {
  it("a 30/38 file with recorded money restores as-is: same event ids, amounts, and deltas — nothing re-executed, nothing added", async () => {
    const store = new MemoryLocalStore();
    await seedProject(store, "استقبال ملف قديم");
    const service = new LocalTransferService(store, clock);

    const data = {
      profile: {
        id: "local-profile",
        activityName: "مشروع الملف القديم",
        currency: "JOD",
        activityType: "custom_craft",
        createdAt: "2026-05-01T08:00:00.000Z",
        updatedAt: "2026-05-01T08:00:00.000Z",
      },
      preferences: null,
      drafts: [],
      orders: [],
      schedules: [],
      financialEvents: [
        investmentEvent("old-event-1", 5000, "old:1"),
        investmentEvent("old-event-2", 7000, "old:2"),
      ],
    };
    const file = {
      format: "micro-prototype-local-export",
      version: 30,
      schemaVersion: 38,
      exportedAt: "2026-06-01T09:00:00.000Z",
      data,
    } as unknown as LocalExportFile;

    await restoreRoundTrip(service, file);

    /* الترحيل نقل التمثيل ولم يعد تنفيذ الأعمال: نفس الحدثين بهويتهما
     * ومبلغيهما ودلتيهما، ولا حدث ثالث ولا تكرار. */
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    expect(events.value.map(event => event.id).sort()).toEqual(["old-event-1", "old-event-2"]);
    const byId = new Map(events.value.map(event => [event.id, event]));
    expect(byId.get("old-event-1")?.amountMinor).toBe(5000);
    expect(byId.get("old-event-1")?.cashDeltaMinor).toBe(5000);
    expect(byId.get("old-event-2")?.amountMinor).toBe(7000);
    expect(byId.get("old-event-2")?.ownerCapitalDeltaMinor).toBe(7000);
    const snapshot = await store.readSnapshot();
    if (!snapshot.ok) throw new Error(snapshot.message);
    expect(snapshot.value.commandReceipts ?? []).toEqual([]);
    expect(snapshot.value.periodSummaries ?? []).toEqual([]);
  });

  it("a file from a newer pair is refused with the unsupported-version message instead of dropping its new fields", () => {
    const service = new LocalTransferService(new MemoryLocalStore(), clock);
    const data = {
      profile: null,
      preferences: null,
      drafts: [],
      orders: [],
      schedules: [],
      financialEvents: [],
      /* حقل من المستقبل لا يعرفه هذا التطبيق — يجب أن يُرفض الملف كله
       * برسالة الإصدار، لا أن يُستورد ويسقط الحقل بصمت. */
      futureFamily: [{ id: "from-the-future" }],
    };
    const prepared = service.prepareImport(
      JSON.stringify({
        format: "micro-prototype-local-export",
        version: localExportVersion + 1,
        schemaVersion: localSchemaVersion + 1,
        exportedAt: NOW,
        data,
      }),
    );
    expect(prepared.ok).toBe(false);
    if (prepared.ok) return;
    expect(prepared.message).toBe(
      "إصدار الملف غير مدعوم في هذا الإصدار من التطبيق؛ بقيت بيانات هذا الجهاز دون تغيير.",
    );
  });
});

/* ─── SDF-070: إيصالات تاريخية مع جيل محلي جديد ─── */

describe("S17 — SDF-070 restoring historical command receipts keeps their history and never revives an old command or draft", () => {
  afterEach(clearDatabases);

  it("receipts restore verbatim as history while the live generation advances, drafts stay cleared, and no business is re-executed", async () => {
    for (const store of [new MemoryLocalStore(), new IndexedDbLocalStore()]) {
      await seedProject(store, "مشروع الإيصالات");
      await saveEvent(store, investmentEvent("event-history", 4400, "history:70"));
      const savedDraft = await store.saveFormDraft(draftEnvelope);
      if (!savedDraft.ok) throw new Error(savedDraft.message);

      const service = new LocalTransferService(store, clock);
      const file = await exportFileOf(service);
      /* ملف يحمل إيصالًا تاريخيًا من جيل سابق (جيل آخر جهاز/دورة) — كما
       * يصدر عن جهاز فيه استكمال حسابات S14. */
      const receipt = {
        id: "completion:cmd-old",
        commandId: "completion:cmd-old",
        commandType: "account-completion",
        generation: "0",
        payloadVersion: 1,
        payloadDigest: "deadbeef",
        outcome: "confirmed",
        resultRefs: ["period_summary:summary-1"],
        failureCode: null,
        failureMessage: null,
        recordedAt: "2026-07-01T10:00:00.000Z",
      };
      const data = {
        ...file.data,
        commandReceipts: [receipt],
      } as unknown as LocalStoreSnapshot;
      const carrier = {
        ...file,
        integrity: { algorithm: "sha256" as const, digest: syncSha256Hex(JSON.stringify(data)) },
        counts: { ...file.counts, commandReceipts: 1 } as LocalExportCounts,
        data,
      } as unknown as LocalExportFile;

      await restoreRoundTrip(service, carrier);

      /* التاريخ محفوظ حرفيًا — الإيصال نفسه بجيله الأصلي دليلًا تاريخيًا. */
      const receipts = await store.listCommandReceipts();
      if (!receipts.ok) throw new Error(receipts.message);
      expect(receipts.value).toHaveLength(1);
      expect(receipts.value[0]).toMatchObject({
        id: "completion:cmd-old",
        generation: "0",
        outcome: "confirmed",
        payloadDigest: "deadbeef",
      });
      /* الجيل المحلي تقدم بالاستبدال — الملف لم يُعده إلى الوراء، فإيصال
       * الجيل ٠ لا يفوّض شيئًا فوق الجيل الحي ١ (فحص الجيل يسبق الاسترداد). */
      const generation = await store.getDataGeneration();
      if (!generation.ok) throw new Error(generation.message);
      expect(generation.value).toBe(1);
      /* المسودة العابرة القديمة لم تُحيا: مُسحت داخل الحد ولا توجد في المخزن
       * الحي (تظل معزولة في نسخة الرجوع وحدها). */
      const drafts = await store.listFormDrafts();
      if (!drafts.ok) throw new Error(drafts.message);
      expect(drafts.value.filter(envelope => envelope.id === draftEnvelope.id)).toEqual([]);
      /* ولا أعيد تنفيذ أي عمل: الحدث المالي واحد كما في الملف، بلا تكرار. */
      const events = await store.listFinancialEvents();
      if (!events.ok) throw new Error(events.message);
      expect(events.value.map(event => event.id)).toEqual(["event-history"]);
      expect(events.value[0]?.amountMinor).toBe(4400);
    }
  });
});

/* ─── SH-22: مصالحة العائلات ومخازن الاستثناء ─── */

describe("S17 — SH-22 family reconciliation: every array family travels; excluded stores never do", () => {
  afterEach(clearDatabases);

  it("a current-pair export carries every array family (plus the singles) and none of the excluded stores", async () => {
    const store = new MemoryLocalStore();
    await seedProject(store, "مصالحة العائلات");
    await saveEvent(store, investmentEvent("event-matrix", 1000, "matrix:1"));
    const service = new LocalTransferService(store, clock);
    const file = await exportFileOf(service);

    const data = file.data as unknown as Record<string, unknown>;
    for (const family of Object.keys(TRANSFER_ARRAY_FAMILY_ROLES)) {
      expect(Array.isArray(data[family])).toBe(true);
    }
    for (const single of ["profile", "ownerProfile", "preferences", "inventoryActivation"]) {
      expect(single in data).toBe(true);
    }
    /* مخازن الاستثناء لا تسافر أبدًا: المسودات العابرة (تُعزل في نسخة
     * الرجوع)، القفل المتقاعد (S02/SH-04)، قاعدة حماية الاستبدال بنيّاتها
     * وإيصالاتها وجيلها — كلها محلية لا تُصدَّر ولا يستعيدها ملف. */
    for (const excluded of [
      "formDrafts",
      "formDraftEnvelopes",
      "localSecurity",
      "restoreProtection",
      "restoreRollback",
      "replacementIntent",
      "replacementReceipt",
      "dataGeneration",
      "generation",
    ]) {
      expect(excluded in data).toBe(false);
    }
    /* العدادات الصارمة تطابق أطوال العائلات في الملف نفسه. */
    if (file.counts) {
      expect(file.counts.financialEvents).toBe(file.data.financialEvents.length);
      expect(file.counts.commandReceipts).toBe((file.data.commandReceipts ?? []).length);
    }
  });

  it("restoring that export onto a second store reproduces the same family set (round-trip completeness)", async () => {
    const source = new MemoryLocalStore();
    await seedProject(source, "مصدر المصالحة");
    await saveEvent(source, investmentEvent("event-rt", 2000, "rt:1"));
    const file = await exportFileOf(new LocalTransferService(source, clock));

    const target = new MemoryLocalStore();
    await restoreRoundTrip(new LocalTransferService(target, clock), file);
    const snapshot = await target.readSnapshot();
    if (!snapshot.ok) throw new Error(snapshot.message);
    for (const family of Object.keys(TRANSFER_ARRAY_FAMILY_ROLES)) {
      expect(Array.isArray((snapshot.value as unknown as Record<string, unknown>)[family])).toBe(true);
    }
    expect(snapshot.value.financialEvents.map(event => event.id)).toEqual(["event-rt"]);
  });
});
