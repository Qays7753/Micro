import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { LocalTransferService } from "./localTransferService";
import { runProtectedReplacement } from "./replacementProtectionProtocol";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import { canonicalSnapshotDigest } from "@/storage/local/snapshotCanonicalization";
import {
  localExportVersion,
  localSchemaVersion,
  type FormDraftEnvelope,
  type LocalExportFile,
  type PrototypeLocalStore,
  type ReplacementIntentRecord,
  type RestoreRollbackRecord,
} from "@/storage/local/types";

/* S02-A (SH-02/SH-03): قبول حدود حماية الاستبدال — الحالات الأساسية للعقد
 * المشترك §14/§16 وعقد ٠٤٤ B4/B6:
 *  - SDF-049: نسخة رجوع دائمة مُتحقق منها قبل الاستبدال؛ تعذّرها يمنع البدء.
 *  - SDF-050: تغيّر البيانات بعد المعاينة يرفض الأمر القديم (stale_context)
 *    ولو لم يتغير projectId؛ وسياج المعاملة يصد كاتبًا سبقها.
 *  - SDF-037: إعادة نفس الأمر والحمولة بعد إيصال ملتزم تعيد نتيجة الأصل
 *    بلا أثر ثانٍ (جيل واحد، نسخة رجوع واحدة).
 *  - SDF-038: نفس مفتاح الأمر بحمولة مختلفة تعارض idempotency_conflict بلا كتابة.
 *  - SDF-042: نتيجة غير محسومة تمنع قصدًا ثانيًا حتى الحسم.
 *  - SDF-051: فشل متأخر يترك القديم كاملًا أو الجديد كاملًا، والمآل المجهول
 *    يُحسم من النية والبصمات لا بإعادة استيراد عمياء.
 *  - الجيل والمسودات: صك جيل جديد داخل الحد، ومسح المسودات العابرة فيه،
 *    وحمايتها معزولة في نسخة الرجوع، واسترجاعها مع اللقطة القديمة.
 *  - توافق المهايئين: الحالات المحورية على Memory وIndexedDB معًا.
 */

const NOW = "2026-10-27T12:00:00.000Z";
const clock = () => NOW;

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
afterEach(clearDatabases);

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
  const event = await store.saveFinancialEvent({
    id: `event-${name}`,
    type: "owner_investment_cash",
    currency: "JOD",
    amountMinor: 12000,
    occurredOn: "2026-10-01",
    recordedAt: NOW,
    idempotencyKey: `seed:${name}`,
    note: "استثمار افتتاحي",
    counterparty: null,
    relatedEventId: null,
    cashDeltaMinor: 12000,
    payableDeltaMinor: 0,
    ownerCapitalDeltaMinor: 12000,
    operatingExpenseDeltaMinor: 0,
  });
  if (!event.ok) throw new Error(event.message);
}

async function exportFileOf(service: LocalTransferService): Promise<LocalExportFile> {
  const exported = await service.createVerifiedExport();
  if (!exported.ok) throw new Error(exported.message);
  return exported.value.file;
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

async function protectionOf(store: PrototypeLocalStore) {
  const state = await store.readRestoreProtection();
  if (!state.ok) throw new Error(state.message);
  return state.value;
}

async function restoreRoundTrip(service: LocalTransferService, file: LocalExportFile) {
  const prepared = await service.prepareRestore(JSON.stringify(file));
  if (!prepared.ok) throw new Error(prepared.message);
  const confirmed = await service.confirmImport(prepared.value);
  if (!confirmed.ok) throw new Error(confirmed.message);
  return { prepared: prepared.value, confirmed };
}

/* ─── SDF-049: النسخة الرجوع الدائمة قبل الاستبدال ─── */

describe("S02-A restore protection boundary — SDF-049 durable rollback before destructive replacement", () => {
  it("committing a restore leaves a durable rollback (file + isolated drafts) outside the replaced stores, on both adapters", async () => {
    for (const store of [new MemoryLocalStore(), new IndexedDbLocalStore()]) {
      await seedProject(store, "ورشة نجارة");
      const savedDraft = await store.saveFormDraft(draftEnvelope);
      if (!savedDraft.ok) throw new Error(savedDraft.message);
      const service = new LocalTransferService(store, clock);
      const file = await exportFileOf(service);

      const { confirmed } = await restoreRoundTrip(service, file);
      expect(confirmed.value.backup.data.profile?.activityName).toBe("ورشة نجارة");

      /* النسخة الرجوع دائمة في قاعدة الحماية — تُقرأ بعد «إعادة التحميل» (مثيل
       * خدمة جديد فوق المخزن نفسه) فتصمد، لا قيمة في ذاكرة الواجهة. */
      const freshServiceRead = await new LocalTransferService(store, clock).readActiveRollback();
      if (!freshServiceRead.ok) throw new Error(freshServiceRead.message);
      expect(freshServiceRead.value).not.toBeNull();
      expect(freshServiceRead.value?.file.data.profile?.activityName).toBe("ورشة نجارة");
      /* المسودة العابرة محفوظة معزولة مع اللقطة القديمة (عقد ٠٤٤ B6). */
      expect(freshServiceRead.value?.drafts.some(envelope => envelope.id === "direct_sale:new")).toBe(true);
      /* والمسودة نفسها مُسحت من المخزن الحي داخل الحد. */
      const draftRead = await store.getFormDraft("direct_sale:new");
      if (!draftRead.ok) throw new Error(draftRead.message);
      expect(draftRead.value).toBeNull();
    }
  });

  it("a failing verified-backup build blocks the destructive replacement entirely — nothing is written (SDF-049/U044-AC12)", async () => {
    const store = new MemoryLocalStore();
    await seedProject(store, "مشروعة");
    const service = new LocalTransferService(store, clock);
    const file = await exportFileOf(service);
    const prepared = await service.prepareRestore(JSON.stringify(file));
    if (!prepared.ok) throw new Error(prepared.message);

    const outcome = await runProtectedReplacement(
      store,
      clock,
      {
        commandType: "restore",
        payload: prepared.value.file.data,
        payloadDigest: prepared.value.intent.payloadDigest,
        summaryJson: "{}",
        binding: {
          kind: "prepared",
          expectedGeneration: prepared.value.intent.expectedGeneration,
          expectedSnapshotDigest: prepared.value.intent.expectedSnapshotDigest,
        },
      },
      async () => ({ ok: false as const, code: "storage_error" as const, message: "تعذر التصدير" }),
    );
    expect(outcome).toMatchObject({ status: "blocked", code: "storage_error" });
    /* لم يُكتب شيء: النية غير مسجلة، والجيل ثابت، والبيانات كما هي. */
    const protection = await protectionOf(store);
    expect(protection.intent).toBeNull();
    expect(protection.generation).toBe(0);
    const snapshot = await store.readSnapshot();
    if (!snapshot.ok) throw new Error(snapshot.message);
    expect(snapshot.value.profile?.activityName).toBe("مشروعة");
  });
});

/* ─── SDF-050: ربط المراجعة وسياج المعاملة ─── */

describe("S02-A restore protection boundary — SDF-050 stale review and the in-transaction fence", () => {
  it("data changed after the preview rejects the old command with stale_context even though projectId is unchanged", async () => {
    const store = new MemoryLocalStore();
    await seedProject(store, "ورشة");
    const service = new LocalTransferService(store, clock);
    const file = await exportFileOf(service);
    const prepared = await service.prepareRestore(JSON.stringify(file));
    if (!prepared.ok) throw new Error(prepared.message);

    /* كتابة من نافذة ثانية بعد المعاينة وقبل التأكيد — نفس المشروع تمامًا. */
    const saved = await store.saveFinancialEvent({
      id: "event-late",
      type: "owner_investment_cash",
      currency: "JOD",
      amountMinor: 700,
      occurredOn: "2026-10-02",
      recordedAt: NOW,
      idempotencyKey: "late-write",
      note: "تمويل لاحق",
      counterparty: null,
      relatedEventId: null,
      cashDeltaMinor: 700,
      payableDeltaMinor: 0,
      ownerCapitalDeltaMinor: 700,
      operatingExpenseDeltaMinor: 0,
    });
    if (!saved.ok) throw new Error(saved.message);

    const confirmed = await service.confirmImport(prepared.value);
    expect(confirmed).toMatchObject({ ok: false, code: "stale_context" });
    /* لا كتابة: الحدث اللاحق باقٍ والجيل لم يتحرك. */
    const protection = await protectionOf(store);
    expect(protection.intent).toBeNull();
    expect(protection.generation).toBe(0);
    const events = await store.listFinancialEvents();
    if (!events.ok) throw new Error(events.message);
    expect(events.value.some(event => event.id === "event-late")).toBe(true);
  });

  it("the in-transaction fence aborts a replacement when a writer slips between the binding read and the transaction (both adapters)", async () => {
    for (const store of [new MemoryLocalStore(), new IndexedDbLocalStore()]) {
      await seedProject(store, "ورشة السياج");
      const file = await exportFileOf(new LocalTransferService(store, clock));

      /* بصمة مرجوة من قراءة سابقة، ثم كاتب يسبق المعاملة. */
      const staleDigest = "0".repeat(64);
      const replacement = await store.replaceSnapshot(file.data, {
        expectedSnapshotDigest: staleDigest,
        digestOf: canonicalSnapshotDigest,
      });
      expect(replacement.ok).toBe(false);
      if (!replacement.ok) expect(replacement.code).toBe("replacement_context_stale");
      /* البيانات لم تُمس إطلاقًا — الحالة الأصلية كاملة. */
      const snapshot = await store.readSnapshot();
      if (!snapshot.ok) throw new Error(snapshot.message);
      expect(snapshot.value.profile?.activityName).toBe("ورشة السياج");
    }
  });
});

/* ─── SDF-037/038/042: الأمر والإيصال والمآل ─── */

describe("S02-A restore protection boundary — SDF-037/038/042 command receipt and unknown outcome", () => {
  it("re-sending the same prepared command after a committed receipt returns the original outcome with no second effect (SDF-037)", async () => {
    const store = new MemoryLocalStore();
    await seedProject(store, "ورشة الإيصال");
    const service = new LocalTransferService(store, clock);
    const file = await exportFileOf(service);
    const prepared = await service.prepareRestore(JSON.stringify(file));
    if (!prepared.ok) throw new Error(prepared.message);

    const first = await service.confirmImport(prepared.value);
    if (!first.ok) throw new Error(first.message);
    const generationAfterFirst = (await protectionOf(store)).generation;
    const rollbackAfterFirst = await service.readActiveRollback();

    /* إعادة نفس الأمر — انقطاع رد أو نقر مكرر: نتيجة الأصل بلا أثر ثانٍ. */
    const second = await service.confirmImport(prepared.value);
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value.orders).toBe(first.value.orders);
      expect(second.value.financialEvents).toBe(first.value.financialEvents);
    }
    const protection = await protectionOf(store);
    expect(protection.generation).toBe(generationAfterFirst);
    const rollbackAfterSecond = await service.readActiveRollback();
    if (!rollbackAfterSecond.ok || !rollbackAfterFirst.ok) throw new Error("rollback read failed");
    expect(rollbackAfterSecond.value?.createdAt).toBe(rollbackAfterFirst.value?.createdAt);
  });

  it("the same command key with a different payload is an idempotency conflict with no writes (SDF-038)", async () => {
    const store = new MemoryLocalStore();
    await seedProject(store, "ورشة التعارض");
    const service = new LocalTransferService(store, clock);
    const file = await exportFileOf(service);
    const prepared = await service.prepareRestore(JSON.stringify(file));
    if (!prepared.ok) throw new Error(prepared.message);
    const first = await service.confirmImport(prepared.value);
    if (!first.ok) throw new Error(first.message);

    /* إيصال مزوّر بنفس المفتاح وحمولة مختلفة — عبر منفذ المخزن نفسه (محاكاة
     * سجل تالف/مكتوب خارجيًا): التعارض يُرفض بلا أي كتابة. */
    const before = await store.readSnapshot();
    if (!before.ok) throw new Error(before.message);
    const digestBefore = canonicalSnapshotDigest(before.value);
    const protection = await protectionOf(store);
    const doctoredReceipt = {
      ...protection.receipt!,
      payloadDigest: "different-payload-digest",
    };
    await store.commitReplacementIntent(protection.generation, doctoredReceipt, NOW);

    const conflict = await service.confirmImport(prepared.value);
    expect(conflict).toMatchObject({ ok: false, code: "idempotency_conflict" });
    const after = await store.readSnapshot();
    if (!after.ok) throw new Error(after.message);
    expect(canonicalSnapshotDigest(after.value)).toBe(digestBefore);
  });

  it("a crashed commit (late failure) resolves on the next attempt: complete new state, receipt completed, original outcome returned to the same command (SDF-051/037/042)", async () => {
    const store = new MemoryLocalStore();
    await seedProject(store, "ورشة المآل");
    const service = new LocalTransferService(store, clock);
    const file = await exportFileOf(service);
    const prepared = await service.prepareRestore(JSON.stringify(file));
    if (!prepared.ok) throw new Error(prepared.message);

    /* حقن الفشل المتأخر: الاستبدال يلتزم ثم «تنهار» كتابة الإيصال — نحاكيها
     * بمنفذ مخزن يفشل مرة واحدة عند الالتزام فقط. */
    const originalCommit = store.commitReplacementIntent.bind(store);
    let commitShouldFail = true;
    store.commitReplacementIntent = (generation: number, receipt: unknown, resolvedAt: string) => {
      if (commitShouldFail) {
        commitShouldFail = false;
        return Promise.resolve({
          ok: false as const,
          code: "storage_error" as const,
          message: "حقن فشل متأخر",
        });
      }
      return originalCommit(generation, receipt as never, resolvedAt);
    };

    const crashed = await service.confirmImport(prepared.value);
    expect(crashed).toMatchObject({ ok: false, code: "outcome_unknown" });
    /* الجديد كامل: معاملة الاستبدال التزمت قبل الفشل المتأخر — لا خليط أبدًا. */
    const snapshot = await store.readSnapshot();
    if (!snapshot.ok) throw new Error(snapshot.message);
    expect(snapshot.value).toEqual(prepared.value.file.data);
    /* النية قائمة غير محسومة — تمنع قصدًا ثانيًا مختلفًا حتى الحسم. */
    let protection = await protectionOf(store);
    expect(protection.intent).not.toBeNull();

    /* إعادة نفس الأمر (نفس القصد بعد انقطاع الرد): الحسم يتم أولًا ثم تعاد
     * نتيجة الأصل بلا أثر ثانٍ — جيل واحد وإيصال واحد. */
    const retry = await service.confirmImport(prepared.value);
    expect(retry.ok).toBe(true);
    protection = await protectionOf(store);
    expect(protection.intent).toBeNull();
    expect(protection.receipt).not.toBeNull();
    expect(protection.generation).toBe(1);
    expect(protection.activeRollback).not.toBeNull();
  });

  it("a crashed replacement that never committed resolves to the complete old state and the same intent may proceed afresh (SDF-051)", async () => {
    const store = new MemoryLocalStore();
    await seedProject(store, "ورشة الإحباط");
    const service = new LocalTransferService(store, clock);
    const file = await exportFileOf(service);
    const prepared = await service.prepareRestore(JSON.stringify(file));
    if (!prepared.ok) throw new Error(prepared.message);

    /* محاكاة انهيار قبل معاملة الاستبدال: نية كاملة مسجلة ولا استبدال حدث. */
    const live = await store.readSnapshot();
    if (!live.ok) throw new Error(live.message);
    const pendingRollback: RestoreRollbackRecord = {
      id: "rollback-pending",
      file,
      drafts: [],
      snapshotDigest: canonicalSnapshotDigest(live.value),
      generation: 0,
      createdAt: NOW,
    };
    const intent: ReplacementIntentRecord = {
      id: "replacement-marker",
      commandId: "restore:crashed:legacy:0",
      commandType: "restore",
      fromGeneration: 0,
      toGeneration: 1,
      beforeDigest: canonicalSnapshotDigest(live.value),
      afterDigest: canonicalSnapshotDigest(prepared.value.file.data),
      payloadDigest: prepared.value.intent.payloadDigest,
      summaryJson: "{}",
      startedAt: NOW,
    };
    const began = await store.beginReplacementIntent(pendingRollback, intent);
    if (!began.ok) throw new Error(began.message);

    /* التأكيد التالي يحسم أولًا: الحالة الحية ما تزال القديم الكامل فتُحبَط
     * النية، ثم يمضي الأمر الجديد من جديد على القاعدة نفسها. */
    const confirmed = await service.confirmImport(prepared.value);
    expect(confirmed.ok).toBe(true);
    const protection = await protectionOf(store);
    expect(protection.intent).toBeNull();
    expect(protection.generation).toBe(1);
    expect(protection.receipt?.commandId).toContain("restore:");
  });

  it("an unresolvable pending intent (neither old nor new digest) blocks every new destructive intent with an honest unknown outcome (SDF-042/B4.5)", async () => {
    const store = new MemoryLocalStore();
    await seedProject(store, "ورشة الحجب");
    const service = new LocalTransferService(store, clock);
    const file = await exportFileOf(service);

    /* نية قديمة قائمة، والكتابات تجاوزتها إلى حالة ثالثة — لا يمكن إثبات
     * القديم أو الجديد، فكل نية استبدال جديدة تُحجب حتى الحسم. */
    const saved = await store.saveFinancialEvent({
      id: "event-third-state",
      type: "owner_investment_cash",
      currency: "JOD",
      amountMinor: 300,
      occurredOn: "2026-10-03",
      recordedAt: NOW,
      idempotencyKey: "third-state",
      note: "كتابة ثالثة",
      counterparty: null,
      relatedEventId: null,
      cashDeltaMinor: 300,
      payableDeltaMinor: 0,
      ownerCapitalDeltaMinor: 300,
      operatingExpenseDeltaMinor: 0,
    });
    if (!saved.ok) throw new Error(saved.message);
    const live = await store.readSnapshot();
    if (!live.ok) throw new Error(live.message);
    const pendingRollback: RestoreRollbackRecord = {
      id: "rollback-pending",
      file,
      drafts: [],
      snapshotDigest: canonicalSnapshotDigest(live.value),
      generation: 0,
      createdAt: NOW,
    };
    const intent: ReplacementIntentRecord = {
      id: "replacement-marker",
      commandId: "restore:stale-crashed:old:0",
      commandType: "restore",
      fromGeneration: 0,
      toGeneration: 1,
      beforeDigest: "b".repeat(64),
      afterDigest: "a".repeat(64),
      payloadDigest: "p".repeat(64),
      summaryJson: "{}",
      startedAt: NOW,
    };
    const began = await store.beginReplacementIntent(pendingRollback, intent);
    if (!began.ok) throw new Error(began.message);

    const prepared = await service.prepareRestore(JSON.stringify(file));
    if (!prepared.ok) throw new Error(prepared.message);
    const confirmed = await service.confirmImport(prepared.value);
    expect(confirmed).toMatchObject({ ok: false, code: "outcome_unknown" });
    /* والتقرير الصادق يظهر الحالة غير المحسومة. */
    const status = await service.readRestoreStatus();
    if (!status.ok) throw new Error(status.message);
    expect(status.value.unresolvedIntent).toBe(true);
  });
});

/* ─── الجيل واسترجاع النسخة السابقة ─── */

describe("S02-A restore protection boundary — generation and durable rollback restore", () => {
  it("each committed replacement mints exactly one new local generation; an old backup never restores a generation", async () => {
    const store = new MemoryLocalStore();
    await seedProject(store, "ورشة الأجيال");
    const service = new LocalTransferService(store, clock);
    const file = await exportFileOf(service);
    expect((await protectionOf(store)).generation).toBe(0);
    await restoreRoundTrip(service, file);
    expect((await protectionOf(store)).generation).toBe(1);
    /* استيراد ملف آخر فوق النتيجة — جيل جديد داخل الحد. */
    const other = new MemoryLocalStore();
    await seedProject(other, "ورشة أخرى");
    const otherFile = await exportFileOf(new LocalTransferService(other, clock));
    await restoreRoundTrip(service, otherFile);
    expect((await protectionOf(store)).generation).toBe(2);
    /* الجيل محلي لا يصدر: ملف التصدير لا يحمله إطلاقًا. */
    const exported = await exportFileOf(service);
    expect(JSON.stringify(exported).includes("data-generation")).toBe(false);
    expect((exported as unknown as Record<string, unknown>).generation).toBeUndefined();
  });

  it("rollback restore swaps back to the old data and its isolated drafts while protecting the current state first (عقد ٠٤٤ B4.4)", async () => {
    const store = new MemoryLocalStore();
    await seedProject(store, "الورشة الأصلية");
    const service = new LocalTransferService(store, clock);
    const originalFile = await exportFileOf(service);
    await store.saveFormDraft(draftEnvelope);

    /* استيراد ملف مختلف فوق البيانات — المسودة القديمة معزولة مع نسخة الرجوع. */
    const other = new MemoryLocalStore();
    await seedProject(other, "ورشة مستوردة");
    const otherFile = await exportFileOf(new LocalTransferService(other, clock));
    await restoreRoundTrip(service, otherFile);
    let snapshot = await store.readSnapshot();
    if (!snapshot.ok) throw new Error(snapshot.message);
    expect(snapshot.value.profile?.activityName).toBe("ورشة مستوردة");

    /* استرجاع النسخة السابقة: نفس خدمة الاستعادة، معاينة وتأكيد وحماية
     * للبيانات الحالية أولًا (سلسلة الرجوع لا تنقطع). */
    const rollbackPrepared = await service.prepareRollbackRestore();
    if (!rollbackPrepared.ok) throw new Error(rollbackPrepared.message);
    expect(rollbackPrepared.value.intent.restoreFormDrafts?.some(env => env.id === "direct_sale:new")).toBe(
      true,
    );
    const rollbackConfirmed = await service.confirmImport(rollbackPrepared.value);
    if (!rollbackConfirmed.ok) throw new Error(rollbackConfirmed.message);

    snapshot = await store.readSnapshot();
    if (!snapshot.ok) throw new Error(snapshot.message);
    expect(snapshot.value.profile?.activityName).toBe("الورشة الأصلية");
    /* المسودة المعزولة عادت مع اللقطة القديمة داخل الحد نفسه. */
    const draftRead = await store.getFormDraft("direct_sale:new");
    if (!draftRead.ok) throw new Error(draftRead.message);
    expect(draftRead.value).not.toBeNull();
    /* والجيل صُك مرة أخرى، ونسخة الرجوع النشطة صارت تصف «ورشة مستوردة» —
     * البيانات التي استُبدلت محمية بدورها. */
    const protection = await protectionOf(store);
    expect(protection.generation).toBe(2);
    const rollback = await service.readActiveRollback();
    if (!rollback.ok) throw new Error(rollback.message);
    expect(rollback.value?.file.data.profile?.activityName).toBe("ورشة مستوردة");
  });

  it("prepareRollbackRestore reports honestly when no previous copy exists", async () => {
    const store = new MemoryLocalStore();
    const service = new LocalTransferService(store, clock);
    const prepared = await service.prepareRollbackRestore();
    expect(prepared).toMatchObject({
      ok: false,
      code: "validation_error",
      message: expect.stringContaining("لا توجد نسخة سابقة"),
    });
  });
});

/* ─── التصفير المحروس ─── */

describe("S02-A restore protection boundary — protected reset (ابدأ من جديد)", () => {
  it("resetAll protects the current state durably, clears the snapshot and transient drafts in one boundary, and mints a generation", async () => {
    const store = new MemoryLocalStore();
    await seedProject(store, "ورشة التصفير");
    const savedDraft = await store.saveFormDraft(draftEnvelope);
    if (!savedDraft.ok) throw new Error(savedDraft.message);
    const service = new LocalTransferService(store, clock);

    const reset = await service.resetAll();
    if (!reset.ok) throw new Error(reset.message);
    const snapshot = await store.readSnapshot();
    if (!snapshot.ok) throw new Error(snapshot.message);
    expect(snapshot.value.profile).toBeNull();
    const draftRead = await store.getFormDraft("direct_sale:new");
    if (!draftRead.ok) throw new Error(draftRead.message);
    expect(draftRead.value).toBeNull();
    const protection = await protectionOf(store);
    expect(protection.generation).toBe(1);
    expect(protection.activeRollback?.file.data.profile?.activityName).toBe("ورشة التصفير");
    expect(protection.activeRollback?.drafts.some(env => env.id === "direct_sale:new")).toBe(true);
  });
});

/* ─── توافق المهايئين: العقد نفسه على Memory وIndexedDB ─── */

describe("S02-A restore protection boundary — Memory/IndexedDB parity of the protocol state machine", () => {
  it("the full protected lifecycle behaves identically on both adapters", async () => {
    for (const store of [new MemoryLocalStore(), new IndexedDbLocalStore()]) {
      await seedProject(store, "ورشة التوافق");
      const service = new LocalTransferService(store, clock);
      const file = await exportFileOf(service);
      const { confirmed } = await restoreRoundTrip(service, file);
      expect(confirmed.ok).toBe(true);

      const protection = await protectionOf(store);
      expect(protection.generation).toBe(1);
      expect(protection.intent).toBeNull();
      expect(protection.receipt).not.toBeNull();
      expect(protection.receipt?.commandType).toBe("restore");
      expect(protection.activeRollback?.file.data.profile?.activityName).toBe("ورشة التوافق");

      /* سياج النية الواحدة: نية قائمة ترفض بدء نية ثانية داخل الحد. */
      const pendingRollback: RestoreRollbackRecord = {
        id: "rollback-pending",
        file,
        drafts: [],
        snapshotDigest: protection.activeRollback?.snapshotDigest ?? "",
        generation: 1,
        createdAt: NOW,
      };
      const intent: ReplacementIntentRecord = {
        id: "replacement-marker",
        commandId: "restore:x:y:1",
        commandType: "restore",
        fromGeneration: 1,
        toGeneration: 2,
        beforeDigest: "1".repeat(64),
        afterDigest: "2".repeat(64),
        payloadDigest: "3".repeat(64),
        summaryJson: "{}",
        startedAt: NOW,
      };
      const began = await store.beginReplacementIntent(pendingRollback, intent);
      expect(began.ok).toBe(true);
      const secondBegin = await store.beginReplacementIntent(pendingRollback, intent);
      expect(secondBegin).toMatchObject({ ok: false, code: "replacement_intent_busy" });
      const aborted = await store.abortReplacementIntent();
      expect(aborted.ok).toBe(true);
      const afterAbort = await protectionOf(store);
      expect(afterAbort.intent).toBeNull();
      expect(afterAbort.generation).toBe(1);
      expect(afterAbort.receipt?.commandType).toBe("restore");
    }
  });
});
