/**
 * Ask Micro local history adapter (owner supplement §10.2-7-2, 2026-11-22 —
 * WS-251/DOC-041): the TEXT-ONLY local history of the user's questions and
 * the served answers.
 *
 * Governance rules this adapter enforces:
 *  - TEXT ONLY: the record carries question/answer strings — there is no audio
 *    feature and no raw audio is ever stored anywhere (the store has no audio
 *    field at all; the Ask surface has no voice input).
 *  - AT MOST 21 DAYS: every read and every append purges entries older than
 *    21 days — nothing older than the cap is ever retained or returned.
 *  - EPHEMERAL BY DESIGN: the store lives OUTSIDE the influential snapshot
 *    (like the form-drafts/local-security precedent) — it never enters the
 *    backup/export/import surface and never becomes financial data.
 *  - DEVICE-LOCAL: the history never travels to the server (the ask port
 *    carries ONLY the current question and the bounded fact set — §10.2-6).
 */
import { connection, failure } from "./indexedDbLifecycle";
import { askHistoryStore } from "./indexedDbStores";
import type { StorageResult } from "./types";

export const ASK_HISTORY_MAX_AGE_MS = 21 * 24 * 60 * 60 * 1000;
/** A generous per-device bound so a heavy day cannot grow unbounded. */
export const ASK_HISTORY_MAX_ENTRIES = 200;

export interface AskHistoryEntry {
  id: string;
  askedAt: number;
  question: string;
  answer: string;
}

function newHistoryId(at: number, seq: number): string {
  return `ask-${at}-${seq}`;
}

/** Remove every entry older than the 21-day cap (and trim to the newest
 * MAX_ENTRIES) — called on every read and every append so the cap holds
 * regardless of when the user last opened the surface. */
async function purgeExpired(now: number): Promise<void> {
  const database = await connection();
  await new Promise<void>(resolve => {
    const transaction = database.transaction(askHistoryStore, "readwrite");
    const store = transaction.objectStore(askHistoryStore);
    const cutoff = now - ASK_HISTORY_MAX_AGE_MS;
    const index = store.index("askedAt");
    const range = IDBKeyRange.upperBound(cutoff, true);
    const purgeRequest = index.openCursor(range);
    purgeRequest.onsuccess = () => {
      const cursor = purgeRequest.result;
      if (cursor === null) return;
      cursor.delete();
      cursor.continue();
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}

/** The retained history, newest first — always within the 21-day cap. */
export async function readAskHistory(now: number): Promise<StorageResult<AskHistoryEntry[]>> {
  try {
    await purgeExpired(now);
    const database = await connection();
    return await new Promise<StorageResult<AskHistoryEntry[]>>(resolve => {
      const transaction = database.transaction(askHistoryStore, "readonly");
      const request = transaction.objectStore(askHistoryStore).getAll();
      request.onerror = () => resolve(failure(request.error, database));
      request.onsuccess = () => {
        const entries = (request.result as AskHistoryEntry[])
          .filter(entry => entry.askedAt > now - ASK_HISTORY_MAX_AGE_MS)
          .sort((a, b) => b.askedAt - a.askedAt)
          .slice(0, ASK_HISTORY_MAX_ENTRIES);
        resolve({ ok: true, value: entries });
      };
    });
  } catch (error) {
    return failure(error);
  }
}

/** Append one served Q&A pair (text only). Old entries beyond the cap are
 * purged first so nothing outside the retention window is ever written over. */
export async function appendAskHistory(
  now: number,
  question: string,
  answer: string,
): Promise<StorageResult<AskHistoryEntry>> {
  try {
    await purgeExpired(now);
    const entry: AskHistoryEntry = {
      id: newHistoryId(now, Math.floor(Math.random() * 1_000_000)),
      askedAt: now,
      question: question.slice(0, 2000),
      answer: answer.slice(0, 4000),
    };
    const database = await connection();
    return await new Promise<StorageResult<AskHistoryEntry>>(resolve => {
      const transaction = database.transaction(askHistoryStore, "readwrite");
      const request = transaction.objectStore(askHistoryStore).put(entry);
      request.onerror = () => resolve(failure(request.error, database));
      transaction.onabort = () => resolve(failure(transaction.error, database));
      transaction.oncomplete = () => resolve({ ok: true, value: entry });
    });
  } catch (error) {
    return failure(error);
  }
}
