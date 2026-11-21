import "fake-indexeddb/auto";
/** @vitest-environment jsdom */
/**
 * The ask-history storage adapter (owner supplement §10.2-7-2, 2026-11-22 —
 * WS-251/DOC-041): the neighboring test for the local TEXT-only history —
 * the 21-day purge holds on every read, the retained entries stay, and the
 * record shape carries text fields only (no raw audio anywhere).
 */
import { afterEach, describe, expect, it } from "vitest";
import { appendAskHistory, readAskHistory, ASK_HISTORY_MAX_AGE_MS, type AskHistoryEntry } from "./askHistory";

describe("§10.2-7-2: the local TEXT-only history (≤21 days, no raw audio)", () => {
  afterEach(async () => {
    await new Promise<void>(resolve => {
      const request = indexedDB.deleteDatabase("micro-prototype-local");
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  });

  it("the adapter purges entries older than 21 days on read and keeps the recent ones", async () => {
    const now = Date.now();
    const fresh = await appendAskHistory(now, "سؤال جديد", "جواب جديد");
    expect(fresh.ok).toBe(true);
    /* Seed an entry beyond the 21-day window directly in the store (the
     * adapter must never return or keep it). */
    const old: AskHistoryEntry = {
      id: "ask-old",
      askedAt: now - ASK_HISTORY_MAX_AGE_MS - 24 * 60 * 60 * 1000,
      question: "سؤال قديم",
      answer: "جواب قديم",
    };
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("micro-prototype-local");
      open.onsuccess = () => {
        const tx = open.result.transaction("ask-history", "readwrite");
        tx.objectStore("ask-history").put(old);
        tx.oncomplete = () => {
          open.result.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });
    const read = await readAskHistory(now);
    expect(read.ok).toBe(true);
    if (!read.ok) throw new Error("history read failed");
    const questions = read.value.map(entry => entry.question);
    expect(questions).toContain("سؤال جديد");
    expect(questions).not.toContain("سؤال قديم");
    // The record shape is TEXT ONLY — no audio field exists anywhere.
    expect(Object.keys(read.value[0]!).sort()).toEqual(["answer", "askedAt", "id", "question"]);
  });
});
