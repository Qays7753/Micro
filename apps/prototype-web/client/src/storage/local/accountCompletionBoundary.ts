/**
 * S14 (DOC-023 / العقد المشترك §14.1 — أمر ba2ce7b4 §5): قرار الالتزام
 * المنسق النقي — يُحمّل كسولًا من المهايئين (نمط حماية كومة الإقلاع
 * D-034/ADR-017): نماذج مجال ملخص الفترة وإيصال الأمر لا تدخل كومة الإقلاع
 * إلا عند أول استكمال فعلي. القرار خالص تمامًا — المهايئان يقرآن الحالة
 * الحية داخل حدهما ثم يطبقان النتيجة بكتاباتهما المحروسة.
 */
import {
  createCommandReceipt,
  decideCommandReceipt,
  type CommandReceipt,
  type PeriodSummary,
} from "@micro-domain/shared/index.js";
import type { AccountCompletionCommit } from "./types";
import {
  balanceObservationStore,
  cashContinuityEntryStore,
  commandReceiptStore,
  periodSummaryStore,
} from "./indexedDbStores";
import { connection, failure, guardedSuccessListener } from "./indexedDbLifecycle";

export type AccountCompletionDecision =
  | { kind: "reuse"; receipt: CommandReceipt }
  | { kind: "idempotency_conflict"; message: string }
  | { kind: "operation_key_conflict"; message: string }
  | {
      kind: "commit";
      summariesToStore: readonly PeriodSummary[];
      receipt: CommandReceipt;
    };

/* فحص الجيل الحي يسبق كل شيء (العقد §14.1 — SDF-050) — يعيش في المهايئين
 * نفسهما قبل فتح الحد لأن الجيل يُقرأ من محرك الحماية الحي عندهم. */
const IDEMPOTENCY_CONFLICT_MESSAGE =
  "أمر الاستكمال نفسه سبق التزامه بحمولة مختلفة — لم يُكتب شيء؛ أعد المحاولة بقصد جديد أو راجع النتيجة المحفوظة.";

/**
 * القرار الكامل — الحتمية داخل الحد (نفس commandId بنفس البصمة والجيل
 * يعيد نتيجة الأصل؛ بحمولة مختلفة تعارضًا صريحًا)، وعهدة الملخصات داخل
 * الحد (المفتاح المستعمل لسجل آخر تعارض؛ المطابق يُعاد بلا كتابة ثانية)،
 * والإيصال يُبنى مع بياناته لا قبلها.
 */
export function decideAccountCompletionCommit(
  commit: AccountCompletionCommit,
  existingReceipt: CommandReceipt | undefined,
  storedSummariesByOperationKey: ReadonlyMap<string, PeriodSummary>,
): AccountCompletionDecision {
  const decision = decideCommandReceipt(commit.command, existingReceipt);
  if (decision.kind === "reuse") return { kind: "reuse", receipt: decision.receipt };
  if (decision.kind === "idempotency_conflict")
    return { kind: "idempotency_conflict", message: IDEMPOTENCY_CONFLICT_MESSAGE };
  /* عهدة الملخصات: المفتاح المستعمل لسجل آخر رفض صادق؛ المطابق يُعاد. */
  const summariesToStore: PeriodSummary[] = [];
  for (const summary of commit.summaries) {
    const byKey = storedSummariesByOperationKey.get(summary.operationKey);
    if (byKey && byKey.id !== summary.id)
      return {
        kind: "operation_key_conflict",
        message: `ملخص الفترة «${summary.id}» يحمل مفتاح عهدة مستعملًا لسجل آخر — لم يُكتب شيء؛ أعد المحاولة.`,
      };
    if (!byKey) summariesToStore.push(summary);
  }
  const resultRefs = summariesToStore.map(summary => `period_summary:${summary.id}`);
  /* ملخصات الكتابة الجديدة فقط تُحال في الإيصال؛ القياس يضيف المهايئ مرجعه
   * عند تخزينه فعليًا (قرار S04 الحي داخله). */
  const receipt = createCommandReceipt({
    ...commit.command,
    outcome: "confirmed",
    resultRefs,
    recordedAt: commit.recordedAt,
  });
  return { kind: "commit", summariesToStore, receipt };
}

/** إضافة مرجع القياس إلى إيصال الالتزام عند تخزينه — يبني نسخة معدلة
 * بالإيصال نفسه (المهايئ يستدعيها بعد قرار S04 الحي). */
export function receiptWithObservation(receipt: CommandReceipt, observationId: string): CommandReceipt {
  return {
    ...receipt,
    resultRefs: [...receipt.resultRefs, `cash_observation:${observationId}`],
  };
}

/* ─── التزامتن الكاملان — يُحمَّلان كسولًا من المهايئين (D-034) ─── */

/** حالة الذاكرة التي يحتاجها الالتزام — خرائط حية ومولد الجيل والخيط. */
export type MemoryCompletionDeps = {
  periodSummaries: Map<string, PeriodSummary>;
  commandReceipts: Map<string, CommandReceipt>;
  balanceObservations: Map<string, import("@micro-domain/cash-continuity/index.js").CashObservation>;
  cashContinuityEntries: Map<string, import("@micro-domain/cash-continuity/index.js").CashContinuityEntry>;
  dataGeneration: number;
  onCoordinatedWrite: () => void;
  decideCashObservationCommit: typeof import("./cashContinuityCommitGuard").decideCashObservationCommit;
  clone: <T>(value: T) => T;
};

const STALE = "storage_stale" as const;
const STORAGE_ERR = "storage_error" as const;

/** التزام الذاكرة — القراءة والقرار والكتابة خطوة متزامنة واحدة مع دفتر
 * تراجع بنيوي (نمط S12-ATOMIC-001): الملخصات والقياس والإيصال معًا أو لا
 * شيء (SDF-030)، والحتمية داخل الحد، وفحص الجيل أولًا (SDF-050). */
export async function commitAccountCompletionInMemory(
  deps: MemoryCompletionDeps,
  commit: import("./types").AccountCompletionCommit,
): Promise<
  import("./types").StorageResult<{
    summaries: readonly PeriodSummary[];
    cashObservation: import("@micro-domain/cash-continuity/index.js").CashObservation | null;
    receipt: CommandReceipt;
    reused: boolean;
  }>
> {
  const undoJournal: Array<() => void> = [];
  const journalSet = <K, V>(map: Map<K, V>, key: K, value: V) => {
    const previous = map.get(key);
    undoJournal.push(previous === undefined ? () => map.delete(key) : () => map.set(key, previous));
    map.set(key, value);
    deps.onCoordinatedWrite();
  };
  try {
    if (commit.command.generation !== String(deps.dataGeneration))
      return {
        ok: false,
        code: STALE,
        message:
          "غيّرت بيانات هذا الجهاز بعد بناء أمر الاستكمال (استبدال أو استعادة) — لم يُكتب شيء؛ أعد بناء الإجابات من الوضع الحالي.",
      };
    const existingReceipt = deps.commandReceipts.get(commit.command.commandId);
    const byOperationKey = new Map(
      Array.from(deps.periodSummaries.values()).map(summary => [summary.operationKey, summary]),
    );
    const decision = decideAccountCompletionCommit(commit, existingReceipt, byOperationKey);
    if (decision.kind === "reuse")
      return {
        ok: true,
        value: {
          summaries: decision.receipt.resultRefs
            .filter(ref => ref.startsWith("period_summary:"))
            .map(ref => deps.periodSummaries.get(ref.slice("period_summary:".length)))
            .filter((summary): summary is PeriodSummary => summary !== undefined)
            .map(deps.clone),
          cashObservation: null,
          receipt: deps.clone(decision.receipt),
          reused: true,
        },
      };
    if (decision.kind === "idempotency_conflict" || decision.kind === "operation_key_conflict")
      return { ok: false, code: STALE, message: decision.message };
    /* عهدة القياس الحية داخل الحد — نفس قرار S04 (الرفض الصادق بلا كتابة). */
    let observationToStore: import("@micro-domain/cash-continuity/index.js").CashObservation | null = null;
    if (commit.cashObservation) {
      const observationDecision = deps.decideCashObservationCommit(
        Array.from(deps.balanceObservations.values()),
        Array.from(deps.cashContinuityEntries.values()),
        commit.cashObservation,
        null,
        null,
      );
      if (observationDecision.kind === "reject")
        return { ok: false, code: observationDecision.code, message: observationDecision.message };
      if (observationDecision.kind === "commit") observationToStore = commit.cashObservation;
    }
    /* الإيصال يكتب مع بياناته — لا إيصال نجاح قبل أثره (العقد §14.1). */
    let receipt = decision.receipt;
    if (observationToStore) receipt = receiptWithObservation(receipt, observationToStore.id);
    decision.summariesToStore.forEach(summary => journalSet(deps.periodSummaries, summary.id, summary));
    if (observationToStore) journalSet(deps.balanceObservations, observationToStore.id, observationToStore);
    journalSet(deps.commandReceipts, receipt.id, receipt);
    return {
      ok: true,
      value: {
        summaries: decision.summariesToStore.map(deps.clone),
        cashObservation: observationToStore ? deps.clone(observationToStore) : null,
        receipt: deps.clone(receipt),
        reused: false,
      },
    };
  } catch (error) {
    for (const step of undoJournal.reverse()) step();
    return {
      ok: false,
      code: STORAGE_ERR,
      message: error instanceof Error ? error.message : "تعذر حفظ استكمال الحسابات محليًا.",
    };
  }
}

/** التزام IndexedDB — كل القراءات داخل معاملة readwrite واحدة قبل القرار
 * وكل الكتابات مصطففة بعده؛ أي فشل أو رفض يُحبِط المعاملة فتتدحرج كلها
 * (SDF-030)؛ فحص الجيل يسبق المعاملة (SDF-050). */
export async function commitAccountCompletionInIndexedDb(
  commit: import("./types").AccountCompletionCommit,
  liveGeneration: () => Promise<{ ok: true; value: number } | { ok: false; code: string; message: string }>,
): Promise<
  import("./types").StorageResult<{
    summaries: readonly PeriodSummary[];
    cashObservation: import("@micro-domain/cash-continuity/index.js").CashObservation | null;
    receipt: CommandReceipt;
    reused: boolean;
  }>
> {
  try {
    const generation = await liveGeneration();
    if (!generation.ok) return { ok: false, code: "storage_error", message: generation.message };
    if (commit.command.generation !== String(generation.value))
      return {
        ok: false,
        code: "storage_stale",
        message:
          "غيّرت بيانات هذا الجهاز بعد بناء أمر الاستكمال (استبدال أو استعادة) — لم يُكتب شيء؛ أعد بناء الإجابات من الوضع الحالي.",
      };
    const database = await connection();
    return await new Promise(resolve => {
      const transaction = database.transaction(
        [periodSummaryStore, commandReceiptStore, balanceObservationStore, cashContinuityEntryStore],
        "readwrite",
      );
      const summariesStore = transaction.objectStore(periodSummaryStore);
      const receiptsStore = transaction.objectStore(commandReceiptStore);
      const observationsStore = transaction.objectStore(balanceObservationStore);
      let rejection: import("./types").StorageFailure | null = null;
      let outcome: {
        summaries: readonly PeriodSummary[];
        cashObservation: import("@micro-domain/cash-continuity/index.js").CashObservation | null;
        receipt: CommandReceipt;
        reused: boolean;
      } | null = null;
      const resolveOutcome = () =>
        resolve(outcome ? { ok: true, value: outcome } : (rejection ?? failure(transaction.error, database)));
      const abortWith = (fallback: () => void) => {
        try {
          transaction.abort();
        } catch {
          fallback();
        }
      };
      const failFromListener = (error: unknown) => {
        const failed = failure(error, database);
        rejection = failed;
        abortWith(() => resolve(failed));
      };
      const receiptRequest = receiptsStore.get(commit.command.commandId);
      const summaryRequests = commit.summaries.map(summary =>
        summariesStore.index("operationKey").get(summary.operationKey),
      );
      const observationRequest = commit.cashObservation
        ? observationsStore.index("operationKey").get(commit.cashObservation.operationKey)
        : null;
      const readsTotal = 1 + (observationRequest ? 1 : 0) + summaryRequests.length;
      let readsPending = readsTotal;
      const onAllRead = () => {
        readsPending -= 1;
        if (readsPending > 0 || outcome || rejection) return;
        const existingReceipt = receiptRequest.result as CommandReceipt | undefined;
        const byOperationKey = new Map(
          summaryRequests
            .map((request, index) => [
              commit.summaries[index]!.operationKey,
              request.result as PeriodSummary | undefined,
            ])
            .filter((entry): entry is [string, PeriodSummary] => entry[1] !== undefined),
        );
        const decision = decideAccountCompletionCommit(commit, existingReceipt, byOperationKey);
        if (decision.kind === "reuse") {
          /* إعادة نتيجة الأصل بلا أي كتابة — السجلات الناتجة قائمة فوقها. */
          const storedSummaries = decision.receipt.resultRefs
            .filter(ref => ref.startsWith("period_summary:"))
            .map(ref => summariesStore.get(ref.slice("period_summary:".length)));
          let summariesPending = storedSummaries.length;
          const collected: PeriodSummary[] = [];
          if (summariesPending === 0) {
            outcome = { summaries: [], cashObservation: null, receipt: decision.receipt, reused: true };
            abortWith(resolveOutcome);
            return;
          }
          for (const request of storedSummaries) {
            request.onsuccess = guardedSuccessListener(failFromListener, () => {
              const summary = request.result as PeriodSummary | undefined;
              if (summary) collected.push(summary);
              summariesPending -= 1;
              if (summariesPending === 0) {
                outcome = {
                  summaries: collected,
                  cashObservation: null,
                  receipt: decision.receipt,
                  reused: true,
                };
                abortWith(resolveOutcome);
              }
            });
          }
          return;
        }
        if (decision.kind === "idempotency_conflict" || decision.kind === "operation_key_conflict") {
          rejection = { ok: false, code: "storage_stale", message: decision.message };
          abortWith(() => resolve(rejection!));
          return;
        }
        /* عهدة القياس الحية داخل المعاملة — نفس قرار S04 على قراءتها. */
        let observationToStore: import("@micro-domain/cash-continuity/index.js").CashObservation | null =
          null;
        if (commit.cashObservation) {
          const existingObservation = observationRequest!.result as
            import("@micro-domain/cash-continuity/index.js").CashObservation | undefined;
          if (existingObservation === undefined) observationToStore = commit.cashObservation;
        }
        /* الإيصال يكتب مع بياناته — كل الكتابات مصطففة داخل المعاملة. */
        let receipt = decision.receipt;
        if (observationToStore) receipt = receiptWithObservation(receipt, observationToStore.id);
        decision.summariesToStore.forEach(summary => summariesStore.put(summary));
        if (observationToStore) observationsStore.put(observationToStore);
        receiptsStore.put(receipt);
        outcome = {
          summaries: decision.summariesToStore,
          cashObservation: observationToStore,
          receipt,
          reused: false,
        };
      };
      receiptRequest.onerror = () => resolve(failure(receiptRequest.error, database));
      receiptRequest.onsuccess = guardedSuccessListener(failFromListener, onAllRead);
      if (observationRequest) {
        observationRequest.onerror = () => resolve(failure(observationRequest.error, database));
        observationRequest.onsuccess = guardedSuccessListener(failFromListener, onAllRead);
      }
      for (const request of summaryRequests) {
        request.onerror = () => resolve(failure(request.error, database));
        request.onsuccess = guardedSuccessListener(failFromListener, onAllRead);
      }
      transaction.onerror = () => resolve(failure(transaction.error, database));
      transaction.onabort = resolveOutcome;
      transaction.oncomplete = resolveOutcome;
    });
  } catch (error) {
    return failure(error);
  }
}

/** قراءات IndexedDB الخفيفة — تُحمَّل مع الحد الكسول نفسه (المقارنات هنا
 * لا في المهايئ المتحمّس — كل بايت في كومة الإقلاع محسوب D-034). */
export function listPeriodSummariesInIndexedDb(
  storeName: string,
): Promise<import("./types").StorageResult<readonly PeriodSummary[]>> {
  return listSorted(
    storeName,
    (left, right) => right.recordedAt.localeCompare(left.recordedAt) || left.id.localeCompare(right.id),
  );
}

export function listCommandReceiptsInIndexedDb(
  storeName: string,
): Promise<import("./types").StorageResult<readonly CommandReceipt[]>> {
  return listSorted(
    storeName,
    (left, right) => right.recordedAt.localeCompare(left.recordedAt) || left.id.localeCompare(right.id),
  );
}

function listSorted<T extends { recordedAt: string; id: string }>(
  storeName: string,
  compare: (left: T, right: T) => number,
): Promise<import("./types").StorageResult<readonly T[]>> {
  return new Promise(resolve => {
    void (async () => {
      try {
        const database = await connection();
        const transaction = database.transaction([storeName], "readonly");
        const request = transaction.objectStore(storeName).getAll();
        request.onerror = () => resolve(failure(request.error, database));
        request.onsuccess = guardedSuccessListener(
          error => resolve(failure(error, database)),
          () => {
            const values = (request.result as T[]).slice().sort(compare);
            resolve({ ok: true, value: values });
          },
        );
      } catch (error) {
        resolve(failure(error));
      }
    })();
  });
}

export function getCommandReceiptInIndexedDb(
  storeName: string,
  commandId: string,
): Promise<import("./types").StorageResult<CommandReceipt | null>> {
  return new Promise(resolve => {
    void (async () => {
      try {
        const database = await connection();
        const transaction = database.transaction([storeName], "readonly");
        const request = transaction.objectStore(storeName).get(commandId);
        request.onerror = () => resolve(failure(request.error, database));
        request.onsuccess = guardedSuccessListener(
          error => resolve(failure(error, database)),
          () => resolve({ ok: true, value: (request.result as CommandReceipt | undefined) ?? null }),
        );
      } catch (error) {
        resolve(failure(error));
      }
    })();
  });
}
