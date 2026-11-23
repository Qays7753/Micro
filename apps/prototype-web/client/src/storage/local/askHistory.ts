/**
 * Ask Micro local history storage policy (owner supplement §10.2-7-2,
 * 2026-11-22 — WS-251/DOC-041): the shared policy constants for the local
 * TEXT-ONLY history of the user's questions and the served answers.
 *
 * The store itself lives in BOTH adapters behind the storage port
 * (`PrototypeLocalStore.listAskHistory` / `saveAskHistoryEntry` — the
 * form-drafts pattern), so the governance rules are enforced at the write
 * boundary itself:
 *  - TEXT ONLY: the record carries question/answer strings — there is no
 *    audio feature and no raw audio is ever stored anywhere (the store has
 *    no audio field at all; the Ask surface has no voice input).
 *  - AT MOST 21 DAYS: every read and every save purges entries older than
 *    the cap — nothing older is ever retained or returned.
 *  - BOUNDED: at most MAX_ENTRIES entries are ever retained on the device
 *    (the newest ones), so a heavy day cannot grow the store unbounded.
 *  - EPHEMERAL BY DESIGN: the store lives OUTSIDE the influential snapshot
 *    (like the form-drafts precedent) — it never enters the backup/export/
 *    import surface and never becomes financial data.
 *  - DEVICE-LOCAL: the history never travels to the server (the ask port
 *    carries ONLY the current question and the bounded fact set — §10.2-6).
 */
export const ASK_HISTORY_MAX_AGE_MS = 21 * 24 * 60 * 60 * 1000;
/** A generous per-device bound so a heavy day cannot grow unbounded. */
export const ASK_HISTORY_MAX_ENTRIES = 200;
/** The stored question text is capped (defense in depth at the boundary). */
export const ASK_HISTORY_QUESTION_MAX_CHARS = 2000;
/** The stored answer text is capped (defense in depth at the boundary). */
export const ASK_HISTORY_ANSWER_MAX_CHARS = 4000;
