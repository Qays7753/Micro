/**
 * Ask Micro local history service (owner supplement §10.2-7-2, 2026-11-22 —
 * WS-251/DOC-041): the application-layer wrapper around the local ask-history
 * storage adapter. The page never touches the storage layer directly (the
 * module-boundary rule R5) — this service is its only door.
 *
 * The governance rules live in the adapter (storage/local/askHistory.ts):
 * TEXT ONLY (no raw audio anywhere), at most 21 days (purged on every read
 * and append), ephemeral (outside the influential snapshot), device-local
 * (never sent to the server).
 */
import { appendAskHistory, readAskHistory, type AskHistoryEntry } from "@/storage/local/askHistory";

export type { AskHistoryEntry };

/** The retained local history, newest first — always within the 21-day cap. */
export async function loadAskHistory(): Promise<AskHistoryEntry[]> {
  const result = await readAskHistory(Date.now());
  return result.ok ? result.value : [];
}

/** Append one served Q&A pair; returns the updated head or null on failure. */
export async function recordAskExchange(question: string, answer: string): Promise<AskHistoryEntry | null> {
  const result = await appendAskHistory(Date.now(), question, answer);
  return result.ok ? result.value : null;
}
