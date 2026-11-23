/**
 * Ask Micro local history service (owner supplement §10.2-7-2, 2026-11-22 —
 * WS-251/DOC-041): the application-layer wrapper around the local ask-history
 * storage port. The page never touches the storage layer directly (the
 * module-boundary rule R5) — this service is its only door.
 *
 * The governance rules live at the storage boundary itself (both adapters):
 * TEXT ONLY (no raw audio anywhere), at most 21 days (purged on every read
 * and save), bounded entries, ephemeral (outside the influential snapshot),
 * device-local (never sent to the server).
 *
 * R11 W1b-3/D-12 (OD-TIME): the current moment crosses through the injected
 * clock port only — no ambient Date.now()/new Date() in the application
 * layer; the epoch millis of the entry derive from an explicit parse of the
 * injected moment.
 */
import type { AskHistoryEntry, PrototypeLocalStore } from "@/storage/local/types";
import { systemClock, type Clock } from "@/application/time/clock";
import { ASK_HISTORY_ANSWER_MAX_CHARS, ASK_HISTORY_QUESTION_MAX_CHARS } from "@/storage/local/askHistory";

export type { AskHistoryEntry };

/** The storage seam this service owns — the write rides the guarded save* verb. */
export type AskHistoryServiceStore = Pick<PrototypeLocalStore, "listAskHistory" | "saveAskHistoryEntry">;

/** A fresh history id — derived from the explicit asked-at moment (no ambient clock). */
function askHistoryId(askedAt: number): string {
  return `ask-${askedAt}-${Math.random().toString(36).slice(2)}`;
}

export class AskHistoryService {
  constructor(
    private readonly store: AskHistoryServiceStore,
    private readonly now: Clock = systemClock,
  ) {}

  /** The retained local history, newest first — always within the 21-day cap. */
  async loadHistory(): Promise<AskHistoryEntry[]> {
    const result = await this.store.listAskHistory(Date.parse(this.now()));
    return result.ok ? [...result.value] : [];
  }

  /** Record one served Q&A pair (text only); null on a storage failure. */
  async recordExchange(question: string, answer: string): Promise<AskHistoryEntry | null> {
    const askedAt = Date.parse(this.now());
    const entry: AskHistoryEntry = {
      id: askHistoryId(askedAt),
      askedAt,
      question: question.slice(0, ASK_HISTORY_QUESTION_MAX_CHARS),
      answer: answer.slice(0, ASK_HISTORY_ANSWER_MAX_CHARS),
    };
    const result = await this.store.saveAskHistoryEntry(entry, askedAt);
    return result.ok ? result.value : null;
  }
}
