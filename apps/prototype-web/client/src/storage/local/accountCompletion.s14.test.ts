/**
 * S14 (DOC-023 / UNIT-002 + العقد المشترك §14.1 — أمر ba2ce7b4 §5): إثبات
 * حد الكتابة المنسق لاستكمال الحسابات على المهايئين معًا:
 *  • الحتمية داخل الحد: نفس commandId بنفس البصمة والجيل يعيد نتيجة الأصل
 *    بلا كتابة ثانية (SDF-030 لا نجاح جزئي)، وبحمولة مختلفة idempotency_conflict
 *    بلا أي كتابة.
 *  • عهدة الملخصات داخل الحد: مفتاح العملة المستعمل لسجل آخر رفض صادق.
 *  • عهدة القياس الحية: نفس قرار S04 داخل المعاملة المنسقة.
 *  • الذرّية بعد بدء الكتابة (الذاكرة): حقن فشل حتمي بعد أول كتابة مجندلة
 *    يُنفّذ دفتر التراجع بالعكس — لقطة المخزن الكاملة بالبايت كما كانت
 *    (نمط S12-ATOMIC-001 نفسه عبر الخيط onCoordinatedWrite).
 *  • اللقطة: العائلتان داخل القراءة والاستبدال (نقل كامل).
 */
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import {
  createCashObservation,
  createCashWallet,
  type CashObservation,
} from "@micro-domain/cash-continuity/index.js";
import { createPeriodSummary, type PeriodSummary } from "@micro-domain/shared/index.js";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { MemoryLocalStore } from "./MemoryLocalStore";
import type { AccountCompletionCommit, PrototypeLocalStore } from "./types";

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
/* جيل المخزن الحي الابتدائي (0 قبل أي استبدال) — نفس عقد الحماية. */
const LIVE_GENERATION = "0";

function salesSummary(id: string, operationKey: string, revenueMinor: number): PeriodSummary {
  return createPeriodSummary(
    id,
    {
      kind: "direct_sales",
      ownerDomain: "direct-sale",
      from: "2026-09-01",
      to: "2026-10-31",
      currency: "JOD",
      coverageMode: "unrecorded_only",
      dimensions: { revenue: { state: "entered", amountMinor: revenueMinor, knowledge: "known" } },
      coverageLinks: [],
      supersedesRef: null,
      supersedesReason: null,
      operationKey,
    },
    NOW,
  );
}

function cashObservation(id: string, operationKey: string): CashObservation {
  return createCashObservation({
    id,
    scopeKind: "project_total",
    walletId: null,
    countedMinor: 18_000,
    knowledge: "known",
    cutoff: NOW,
    observedOn: "2026-11-02",
    recordedAt: NOW,
    operationKey,
    note: "عدّة بداية الاستكمال",
  });
}

function completionCommand(
  commandId: string,
  digest: string,
  summaries: readonly PeriodSummary[],
  observation: CashObservation | null,
): AccountCompletionCommit {
  /* الجيل الحي للمخزن وقت البناء — فحص الجيل داخل الحد (SDF-050) يرفض
   * أي أمر بُني على جيل آخر؛ الاختبارات تمرر الجيل الحي الحقيقي. */
  return {
    command: {
      commandId,
      commandType: "account-completion",
      generation: LIVE_GENERATION,
      payloadVersion: 1,
      payloadDigest: digest,
    },
    summaries,
    cashObservation: observation,
    recordedAt: NOW,
  };
}

const adapters = [
  ["الذاكرة", () => new MemoryLocalStore()],
  ["IndexedDB", () => new IndexedDbLocalStore()],
] as const;

describe("S14 — الالتزام المنسق لاستكمال الحسابات (UNIT-002/العقد §14.1)", () => {
  for (const [label, makeStore] of adapters) {
    it(`${label}: الحزمة كاملة تلتزم — الملخصات والقياس والإيصال معًا وتُقرأ من اللقطة`, async () => {
      if (label === "IndexedDB") await clearDatabase();
      const store = makeStore();
      const summary = salesSummary("summary-1", "s14-op-1", 20_000);
      const observation = cashObservation("obs-1", "s14-obs-1");
      const committed = await store.commitAccountCompletion(
        completionCommand("cmd-1", "digest-1", [summary], observation),
      );
      if (!committed.ok) throw new Error(committed.message);
      expect(committed.value.reused).toBe(false);
      expect(committed.value.receipt.outcome).toBe("confirmed");
      expect(committed.value.receipt.resultRefs).toEqual([
        "period_summary:summary-1",
        "cash_observation:obs-1",
      ]);
      /* القراءة الحية واللقطة كلاهما يحمل العائلتين. */
      const listed = await store.listPeriodSummaries();
      expect(listed.ok && listed.value.map(entry => entry.id)).toEqual(["summary-1"]);
      const receipts = await store.listCommandReceipts();
      expect(receipts.ok && receipts.value).toHaveLength(1);
      const snapshot = await store.readSnapshot();
      expect(snapshot.ok && snapshot.value.periodSummaries).toHaveLength(1);
      expect(snapshot.ok && snapshot.value.commandReceipts).toHaveLength(1);
      expect(snapshot.ok && snapshot.value.balanceObservations).toHaveLength(1);
    });

    it(`${label}: نفس الأمر بنفس البصرة والجيل يعيد نتيجة الأصل بلا كتابة ثانية (SDF-030)`, async () => {
      if (label === "IndexedDB") await clearDatabase();
      const store = makeStore();
      const first = await store.commitAccountCompletion(
        completionCommand("cmd-2", "digest-2", [salesSummary("summary-2", "s14-op-2", 5_000)], null),
      );
      if (!first.ok) throw new Error(first.message);
      const retried = await store.commitAccountCompletion(
        completionCommand("cmd-2", "digest-2", [salesSummary("summary-2", "s14-op-2", 5_000)], null),
      );
      if (!retried.ok) throw new Error(retried.message);
      expect(retried.value.reused).toBe(true);
      expect(retried.value.receipt.id).toBe("cmd-2");
      expect(retried.value.summaries.map(entry => entry.id)).toEqual(["summary-2"]);
      /* لا كتابة ثانية: العائلة ما زالت بسجل واحد والإيصال واحد. */
      const listed = await store.listPeriodSummaries();
      expect(listed.ok && listed.value).toHaveLength(1);
      const receipts = await store.listCommandReceipts();
      expect(receipts.ok && receipts.value).toHaveLength(1);
    });

    it(`${label}: نفس الأمر بحمولة مختلفة تعارض حتمية صريحًا بلا أي كتابة`, async () => {
      if (label === "IndexedDB") await clearDatabase();
      const store = makeStore();
      const first = await store.commitAccountCompletion(
        completionCommand("cmd-3", "digest-3", [salesSummary("summary-3", "s14-op-3", 5_000)], null),
      );
      if (!first.ok) throw new Error(first.message);
      const before = await store.readSnapshot();
      const conflicted = await store.commitAccountCompletion(
        completionCommand(
          "cmd-3",
          "digest-DIFFERENT",
          [salesSummary("summary-3b", "s14-op-3b", 9_000)],
          null,
        ),
      );
      expect(conflicted.ok).toBe(false);
      if (!conflicted.ok) expect(conflicted.code).toBe("storage_stale");
      const after = await store.readSnapshot();
      expect(after.ok && JSON.stringify(after.value)).toBe(before.ok ? JSON.stringify(before.value) : "");
    });

    it(`${label}: مفتاح عهدة ملخص مستعمل لسجل آخر رفض صادق داخل الحد`, async () => {
      if (label === "IndexedDB") await clearDatabase();
      const store = makeStore();
      const first = await store.commitAccountCompletion(
        completionCommand("cmd-4", "digest-4", [salesSummary("summary-4", "s14-op-4", 5_000)], null),
      );
      if (!first.ok) throw new Error(first.message);
      /* ملخص مختلف بمفتاح العهدة نفسه — تعارض لا كتابة فوق السجل القائم. */
      const rejected = await store.commitAccountCompletion(
        completionCommand("cmd-5", "digest-5", [salesSummary("summary-5", "s14-op-4", 9_000)], null),
      );
      expect(rejected.ok).toBe(false);
      if (!rejected.ok) expect(rejected.code).toBe("storage_stale");
      const listed = await store.listPeriodSummaries();
      expect(listed.ok && listed.value).toHaveLength(1);
    });

    it(`${label}: قياس النقد بعهدة مستعملة يعيد الأصل بقرار S04 الحي داخل المعاملة المنسقة — لا نسخة ثانية`, async () => {
      if (label === "IndexedDB") await clearDatabase();
      const store = makeStore();
      /* محفظة حية واحدة وقياس قائم عليها بعهدة معروفة. */
      const wallet = createCashWallet({
        id: "wallet-s14",
        name: "درج الاستكمال",
        kind: "cash_drawer",
        createdAt: NOW,
        createdOperationKey: "s14-wallet-open",
      });
      const opened = await store.commitCashContinuity(wallet, []);
      if (!opened.ok) throw new Error(opened.message);
      const first = await store.commitCashObservation(
        createCashObservation({
          id: "obs-first",
          scopeKind: "wallet",
          walletId: "wallet-s14",
          countedMinor: 12_000,
          knowledge: "known",
          cutoff: NOW,
          observedOn: "2026-11-01",
          recordedAt: NOW,
          operationKey: "s14-obs-shared",
          note: "العدّ الأول",
        }),
        null,
        null,
      );
      if (!first.ok) throw new Error(first.message);
      /* إعادة العهدة نفسها داخل الحزمة المنسقة — عقد S04 القائم: المفتاح
       * هو هوية القصد، فالأصل يُعاد بلا نسخة ثانية؛ الحزمة تلتزم بملخصها
       * وإيصالها والقياس الأصلي باقٍ كما سُجل (لا تكرار ولا محو). */
      const committed = await store.commitAccountCompletion(
        completionCommand(
          "cmd-6",
          "digest-6",
          [salesSummary("summary-6", "s14-op-6", 5_000)],
          createCashObservation({
            id: "obs-second",
            scopeKind: "wallet",
            walletId: "wallet-s14",
            countedMinor: 15_000,
            knowledge: "known",
            cutoff: NOW,
            observedOn: "2026-11-02",
            recordedAt: NOW,
            operationKey: "s14-obs-shared",
            note: "العدّ الثاني",
          }),
        ),
      );
      if (!committed.ok) throw new Error(committed.message);
      /* لا قياس جديد خُزن — الأصل باقٍ وحيدًا بقيمه، والإيصال يحيل إلى
       * الملخص وحده (القياس المعاد ليس ناتجًا جديدًا). */
      expect(committed.value.cashObservation).toBeNull();
      expect(committed.value.receipt.resultRefs).toEqual(["period_summary:summary-6"]);
      const snapshot = await store.readSnapshot();
      if (!snapshot.ok) throw new Error("snapshot failed");
      expect(snapshot.value.balanceObservations).toHaveLength(1);
      expect(snapshot.value.balanceObservations?.[0]?.id).toBe("obs-first");
      expect(snapshot.value.balanceObservations?.[0]?.countedMinor).toBe(12_000);
      expect(snapshot.value.periodSummaries).toHaveLength(1);
    });
  }

  it("الذاكرة: فشل بعد بدء كتابة مجندلة يُرجع الكل — دفتر التراجع بالعكس (نمط S12-ATOMIC-001)", async () => {
    /* الخيط الداخلي الضيق onCoordinatedWrite (protected لا public) يُستدعى
     * بعد كل كتابة مجندلة — حقن الفشل بعد الأولى يثبت التدحرج الكامل. */
    class FaultAfterFirstWrite extends MemoryLocalStore {
      private writes = 0;
      protected onCoordinatedWrite(): void {
        this.writes += 1;
        if (this.writes >= 1) throw new Error("حقن فشل اختباري بعد أول كتابة منسقة");
      }
    }
    const store = new FaultAfterFirstWrite();
    const before = await store.readSnapshot();
    if (!before.ok) throw new Error("before snapshot failed");
    const failed = await store.commitAccountCompletion(
      completionCommand("cmd-7", "digest-7", [salesSummary("summary-7", "s14-op-7", 5_000)], null),
    );
    expect(failed.ok).toBe(false);
    if (failed.ok) throw new Error("unreachable");
    expect(failed.code).toBe("storage_error");
    /* لقطة المخزن الكاملة بالبايت كما كانت — لا ملخص ولا إيصال يتيم. */
    const after = await store.readSnapshot();
    if (!after.ok) throw new Error("after snapshot failed");
    expect(after.value).toEqual(before.value);
  });

  it("الذاكرة: النقل الكامل عبر replaceSnapshot يحمل العائلتين — استعادة صادقة بلا إعادة تنفيذ", async () => {
    const source = new MemoryLocalStore();
    const committed = await source.commitAccountCompletion(
      completionCommand("cmd-8", "digest-8", [salesSummary("summary-8", "s14-op-8", 7_000)], null),
    );
    if (!committed.ok) throw new Error(committed.message);
    const snapshot = await source.readSnapshot();
    if (!snapshot.ok) throw new Error("snapshot failed");
    const target = new MemoryLocalStore();
    const replaced = await target.replaceSnapshot(snapshot.value);
    if (!replaced.ok) throw new Error(replaced.message);
    /* الإيصال دليل تاريخي يُستعاد كما هو — لا يعيد تنفيذ أثر ولا يصير
     * تفويضًا لنموذج قديم (فحص الجيل عند الاستخدام مسؤولية القارئ). */
    const receipts = await target.listCommandReceipts();
    expect(receipts.ok && receipts.value.map(receipt => receipt.commandId)).toEqual(["cmd-8"]);
    const summaries = await target.listPeriodSummaries();
    expect(summaries.ok && summaries.value.map(summary => summary.id)).toEqual(["summary-8"]);
    /* والإعادة بنفس القصد على الهدف تعيد نتيجة الأصل (reused) لا نسخة ثانية. */
    const retried = await target.commitAccountCompletion(
      completionCommand("cmd-8", "digest-8", [salesSummary("summary-8", "s14-op-8", 7_000)], null),
    );
    if (!retried.ok) throw new Error(retried.message);
    expect(retried.value.reused).toBe(true);
  });
});
