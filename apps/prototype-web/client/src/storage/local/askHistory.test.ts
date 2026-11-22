import "fake-indexeddb/auto";
/** @vitest-environment jsdom */
/**
 * The ask-history storage boundary (owner supplement §10.2-7-2, 2026-11-22 —
 * WS-251/DOC-041): the adapter-contract evidence for the local TEXT-only
 * history at the storage port — BOTH adapters carry the store (the
 * form-drafts pattern; the entity-touchpoints registration rides this
 * parity): the 21-day purge holds on every read and save, the entry bound
 * keeps at most the newest MAX_ENTRIES, and the record shape carries text
 * fields only (no raw audio anywhere).
 */
import { afterEach, describe, expect, it } from "vitest";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { MemoryLocalStore } from "./MemoryLocalStore";
import type { AskHistoryEntry, PrototypeLocalStore } from "./types";
import { ASK_HISTORY_MAX_AGE_MS, ASK_HISTORY_MAX_ENTRIES } from "./askHistory";

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>(resolve => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}

/* A FRESH adapter per test — no state may leak between tests (the loop only
 * captures the factory, never an instance). */
const adapterFactories: [label: string, make: () => PrototypeLocalStore][] = [
  ["memory", () => new MemoryLocalStore()],
  ["indexeddb", () => new IndexedDbLocalStore()],
];

function entry(id: string, askedAt: number, question = "سؤال", answer = "جواب"): AskHistoryEntry {
  return { id, askedAt, question, answer };
}

describe("§10.2-7-2: the local TEXT-only history at the storage port (both adapters)", () => {
  afterEach(async () => {
    await clearDatabase();
  });

  for (const [label, make] of adapterFactories) {
    it(`[${label}] purges entries older than 21 days on read and keeps the recent ones`, async () => {
      const adapter = make();
      const now = Date.UTC(2026, 10, 22, 9, 0, 0);
      const fresh = await adapter.saveAskHistoryEntry(entry("ask-fresh", now, "سؤال جديد", "جواب جديد"), now);
      expect(fresh.ok).toBe(true);
      /* Seed an entry beyond the 21-day window directly in the store (the
       * adapter must never return or keep it). */
      const seededOld = entry(
        "ask-old",
        now - ASK_HISTORY_MAX_AGE_MS - 24 * 60 * 60 * 1000,
        "سؤال قديم",
        "جواب قديم",
      );
      const seeded = await adapter.saveAskHistoryEntry(seededOld, seededOld.askedAt);
      expect(seeded.ok).toBe(true);
      const listed = await adapter.listAskHistory(now);
      expect(listed.ok).toBe(true);
      if (!listed.ok) return;
      const ids = listed.value.map(item => item.id);
      expect(ids).toEqual(["ask-fresh"]);
      /* The purge is durable: a second read after the first still never
       * resurrects the expired entry. */
      const again = await adapter.listAskHistory(now);
      expect(again.ok && again.value.map(item => item.id)).toEqual(["ask-fresh"]);
    });

    it(`[${label}] saves and returns the served Q&A pair verbatim — text fields only, no audio anywhere`, async () => {
      const adapter = make();
      const now = Date.UTC(2026, 10, 22, 10, 0, 0);
      const stored = await adapter.saveAskHistoryEntry(
        entry("ask-1", now, "كم طلبي هذا الأسبوع؟", "خمسة طلبات"),
        now,
      );
      expect(stored.ok).toBe(true);
      if (!stored.ok) return;
      expect(stored.value.question).toBe("كم طلبي هذا الأسبوع؟");
      expect(stored.value.answer).toBe("خمسة طلبات");
      expect(Object.keys(stored.value).sort()).toEqual(["answer", "askedAt", "id", "question"]);
      const listed = await adapter.listAskHistory(now);
      expect(listed.ok && listed.value).toHaveLength(1);
    });

    it(`[${label}] keeps at most the newest MAX_ENTRIES entries after a save`, async () => {
      const adapter = make();
      const now = Date.UTC(2026, 10, 22, 11, 0, 0);
      for (let index = 0; index < ASK_HISTORY_MAX_ENTRIES + 5; index += 1) {
        const saved = await adapter.saveAskHistoryEntry(
          entry(`ask-${index}`, now + index, `سؤال ${index}`, `جواب ${index}`),
          now + index,
        );
        expect(saved.ok).toBe(true);
      }
      const listed = await adapter.listAskHistory(now + ASK_HISTORY_MAX_ENTRIES + 10);
      expect(listed.ok).toBe(true);
      if (!listed.ok) return;
      expect(listed.value.length).toBeLessThanOrEqual(ASK_HISTORY_MAX_ENTRIES);
      /* The newest survived; the oldest five were dropped at the write boundary. */
      const ids = listed.value.map(item => item.id);
      expect(ids).toContain(`ask-${ASK_HISTORY_MAX_ENTRIES + 4}`);
      expect(ids).not.toContain("ask-0");
    });

    it(`[${label}] an empty store lists as an empty history (the old base opens and finds it empty)`, async () => {
      const adapter = make();
      const listed = await adapter.listAskHistory(Date.UTC(2026, 10, 22, 12, 0, 0));
      expect(listed.ok).toBe(true);
      if (!listed.ok) return;
      expect(listed.value).toEqual([]);
    });
  }
});
