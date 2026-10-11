# R9 — Post-Review Root-Fix Execution Report (2026-10-10)

**Program:** WS-216 / ARCH-007 — Structural Remediation R0–R10, wave R9 (owner-authorized continuation on the existing branch/PR #347).
**Executor:** Z AI (primary, single writer; five read-only reviewers before implementation and on the final diff record below).
**Mandate:** the owner's PR #347 root-fix continuation — implement the independently reviewed root fixes F3.1–F3.5 + F7 (= repair cards R9-GA-F3.1–.5, R9-W3-F1, R9-GA-F7), verify, update evidence, PR-ready, **no merge**.

---

> **تصحيح مؤرخ 2026-10-11 (الاستمرار الجذري — اقرأ هذا أولًا):** بندَي §3/F3.5
> و§11.2 أدناه («خمسة مواقع إضافية… بطاقة مستقبلية») صارا **متقاعدين بقرار
> المالك** — رفض المالك تصنيف «بطاقة مستقبلية» لعيوب حالية (تعليق PR #347
> بتاريخ 2026-10-10)، وجرد الدور الدلالي الكامل أُغلق في الاستمرار الجذري:
> `R9-GA-F3.6-ERROR-ROLE-INVENTORY` (البطاقات في R9-REPAIR-CARDS.md). القائمة
> أدناه (خمسة مواقع + حالتا نبرة مختلطة) كانت **غير كاملة** — الجرد الكامل:
> 11 سطح خطأ صرفًا حُوّل إلى alert، و9 فصول نبرة مختلطة، و24 فقرة خطأ قراءة
> بلا أي دور، و3 صفحات بآلات حالة القراءة (R9-GA-F3.7). التقرير الكنوني
> للاستمرار الجذري: `R9-SYSTEMIC-ROOT-FIX-AND-EVIDENCE-CLOSURE-EXECUTION-REPORT-2026-10-11.md`.

## 1. Scope anchors — exact SHAs, branch, PR, resume checkpoint

| Item | Value |
|---|---|
| Baseline (verified live before any write; no STATE_DRIFT) | PR #347 open, mergeable/clean, base `main` = `8b3c9aeb09ca33ed66f0a929c157b668839d0463`, head `d0a48545aa4c5a13b956b5460cf27717d927700b`, CI check-run `114295795759` + Cloudflare Pages check-run `114295770397` both success on that exact head; only PRs #347 + #344 (docs-only) open; worktree clean and in sync |
| Branch (unchanged) | `refactoring/r9-complete-w1-w2-w3-20261010` — the single writer/integration unit |
| Continuation code commits | `56c47a27` (Fix Groups A+B+D — reversal page state machines, return path, roles) · `c1d294b1` (Fix Group C — G5 idempotency identity) · `0bb51d1e` (Fix Group E — IndexedDB listener hardening) |
| Documentation commit | this report's commit (evidence + Operations Control + surfaces re-anchor + state docs) |
| Final PR head | the documentation commit carrying this report (pinned in the PR body with the final-head CI/Pages run URLs per the R9-GA-F5 protocol) |
| Work reused | the entire R9 W1+W2+W3 history, evidence, and PR body — no resets, no force-push, no rebase, no history rewrite |

## 2. The five pre-implementation reviews and conflict resolution

Five read-only specialist reviews (R9C-REV1..REV5) ran on `d0a48545` before any edit:

1. **Storage/transaction (REV1):** enumerated **every** affected listener path — 73 `onsuccess` listeners across 37 commit methods in `IndexedDbLocalStore.ts` + `writeOneIdempotent` in `indexedDbPrimitives.ts` (the GA-F7 card had named only 4–5 methods) — with per-method fix shapes and the existing-style inventory (abortWith / pending+finish / local rejection / direct resolve). **Critical premise correction:** verified live against the W3C IndexedDB 3.0 spec §5.9 — a *conforming* engine **does** abort when a success listener throws (`legacyOutputDidListenersThrowFlag` → a new `AbortError` DOMException); the original card's "real IndexedDB does not abort" claim holds only for engines that do not honor that legacy flag (the spec's "will not abort" text applies to explicit `commit()`, which this codebase never calls). The defect is therefore accurately stated as (a) **payload fidelity loss** (the original error is replaced by an empty-message AbortError — measured) and (b) **dependence on engine-specific exception handling** rather than application-determined behavior. Adopted; the repair card carries the dated evidence correction.
2. **UI state-machine/accessibility (REV2):** validated the four-phase read-state design (the `EstimateDetail.tsx` precedent) + retry token + `active` cleanup; the read-error surface as a strict `ReceivedLoanDetail` mirror; the `save()` phase guard for the unsaved-changes-dialog edge; the exact F3.5 inventory (2 offenders + 3 stale test assertions); 5 additional out-of-scope role offenders elsewhere recorded for a future card, not this PR.
3. **Domain/semantic (REV3):** confirmed the G5 identity root fix belongs at the page (the sole production caller; the service is a caller-key gate by contract); recommended collision-free JSON serialization of all eight persisted semantic fields over a minimal append (the mandate's own "no silent reuse for semantically different declarations" clause + the live colon-collision hole); confirmed zero Schema/Export/Import impact and the frozen `g5-ui:` prefix; F3.3 = one-line `navigate(returnPath)` with the `/inventory` fallback behavior-compatible.
4. **Tests/CI/browser (REV4):** exact focused-command forms; the ESLint placement rule forcing page-journey tests to `client/src` root; the poison-record injection idiom verified against the fake-indexeddb 6.2.5 source; the definitive statement that **no real-browser test mechanism exists in the repository**; baseline counts 747 root / 2,488 app.
5. **Documentation/control (REV5):** the full ordered documentation plan; the current-state.md size headroom (**158 bytes** — the live-field rewrite had to be net-neutral); the ratchet/surfaces ledger processes with exact numbers; the gzip entry headroom (**597 bytes** — the sharpest risk, measured early: the final delta is +306 gzip, under the ceiling).

**Conflict resolutions:** REV2 flagged F3.3 as outside the authorized package — overruled by the owner's continuation instruction itself (Fix Group B is explicitly in scope); REV3's analysis stands. The G5 minimal-append vs JSON-serialization question was resolved in favor of serialization (REV3's evidence). The F7 evidence framing adopted REV1's spec-accurate correction (independently verified by the executor against the live W3C spec text before implementation).

## 3. Root cause → change, per fix

### F3.1 + F3.2 + W3-F1 — the reversal editors' render guard (commit `56c47a27`)

**Before:** `if (!entry && !message) return loading; if (!entry) return not-found;` — an unknown id on the success path left `entry=null, message=null` → **infinite loading** (the not-found surface was unreachable); a read failure set `message` → the **not-found surface mislabeled the failure** (the actual error text was never rendered). One rendering-guard defect family.

**After:** an explicit `ReversalReadState` union — `{phase:"loading"} | {phase:"not-found"} | {phase:"read-error"; message:string} | {phase:"ready"; entry|movement}` — with the effect settling exactly one phase per completed read, the `active` cleanup flag, and a `retryCount` token for the retry. The not-found section is **byte-identical** to the existing one; the new read-error surface follows the strict `ReceivedLoanDetail` pattern (back button with the page's own label, `micro-field-error` paragraph with `role="alert"` rendering the **actual** service message, `«إعادة المحاولة»` button). `save()` gains a silent phase guard (returns `false` outside `ready` — protects the unsaved-changes dialog's save-and-exit edge). No timing delays; no test-only flags; existing Arabic copy untouched.

### F3.3 — the inventory reversal save-exit (commit `56c47a27`)

**Before:** `navigate("/inventory")` hardcoded after a successful save — the only deep editor violating S1-07 (عقد ٢٦ قاعدة ٣). **After:** `navigate(returnPath)` — the same `useReturnPath` contract as every sibling; with no `?returnTo`/`?from`, `canonicalReturnFor` on the real route still resolves to `/inventory` (behavior-compatible for the only existing production entry point, contract-compliant for any future source).

### F3.4 — the G5 idempotency identity (commit `c1d294b1`)

**Before:** `g5-ui:${direction}:${dueOn}:${amountMinor}:${source.trim()}:${note.trim()}:${relatedOrderId ?? relatedEventId ?? "none"}` — omitted `knowledge` (a knowledge-differing correction was silently swallowed as `reused` and the page navigated as success) and joined free text with `:` (source `"أ:ب"`+note `"ج"` collided with source `"أ"`+note `"ب:ج"`).

**After:** `g5-ui:${JSON.stringify([direction, dueOn, amountMinor, source.trim(), note.trim(), knowledge, relatedOrderId, relatedEventId])}` — all eight persisted semantic inputs, collision-free, behind the **frozen `g5-ui:` prefix** (R5 compatibility surface). The service contract is untouched (caller-provided key; exact-equality dedupe within kind — inspected, no change needed; no content comparison on reuse; `reverseDeclaration` untouched). **Migration note (honest):** old-format keys in development databases will not match the new format — a genuinely identical retry across the boundary creates a second record; the app is in development with no users and there is no migration path that does not force the forbidden schema/export version changes.

### F3.5 — error announcement roles (commit `56c47a27`)

`CashWalletEditor.tsx:115` and `InventoryReversalEditor.tsx:114`: `role="status"` → `role="alert"` (actual errors), matching the repo-wide `micro-field-error` convention; `role="status"` remains for loading surfaces only. The three test assertions that had pinned the wrong role were updated in the same commit. Five additional out-of-scope offenders exist elsewhere (CashAdjustmentEditor:143, InventoryMovementEditor:507,935, DirectSaleEditor:891, EstimateDetail:203, CorrectionsLayer:221 + two mixed-tone cases) — recorded here for a future card; **not** touched in this PR (scope discipline).

### F7 — IndexedDB transaction safety inside request listeners (commit `0bb51d1e`)

**Before:** a synchronous throw inside a request `onsuccess` listener (put() with an uncloneable value → DataCloneError; DataError; TransactionInactiveError; a TypeError from guard logic on malformed stored records) escaped the listener, so the outcome depended on the engine's listener-exception handling: a replacement empty-message AbortError on conforming engines (payload loss — measured), and a false `ok:true` for an unwritten value on any engine that does not honor the legacy abort-on-throw flag.

**After:** every write-queueing listener body is wrapped by the module-level `guardedSuccessListener(onThrow, listener)` — on any synchronous throw, the per-method `failFromListener` **settles the pending result with the ORIGINAL error first**, then aborts the transaction guarded (`onabort` delivers the settled failure; if the transaction already finished, the failure is delivered directly) — the R9-GA-F1 shape extended to the listener phase, mirroring each method's own existing `onerror` idiom. Coverage: **73 listeners across 37 methods** + `writeOneIdempotent` + the one bare `transaction.abort()` in `commitCashContinuity` guarded. Request order, transaction fingerprints, and every existing failure code/message are unchanged (the diff is lexical around listener bodies — bodies stay byte-identical). Schema 38 / export 30 untouched.

## 4. Coverage and regression proof

| Area | Evidence |
|---|---|
| RB-3 (F7 CI regression) | 5 new tests in `rollbackRehearsal.r9.test.ts`: leg A (primitive via poisoned direct sale), leg B (Style A `commitFinancialEventCorrection`), leg C (Style B `saveExpenseBudget`), leg C2 (`commitCashContinuity` — proves the wallet write queued earlier in the same transaction rolls back), leg D (deterministic `vi.spyOn` put injection surfacing its exact message verbatim). Every leg asserts `ok:false` + `storage_error` + the **original** payload + state-A integrity (stableHash + per-family read-backs). |
| **Negative proofs (F7)** | Verified by temporarily reverting each guard: with `IndexedDbLocalStore.ts` at the pre-fix state, legs B/C/C2/D fail (the empty AbortError message betrays the reintroduced defect) while the F1 and primitive legs stay green; with `indexedDbPrimitives.ts` reverted, exactly leg A fails. Both restorations re-verified green. |
| **Negative proof (F3.4)** | Verified by temporarily restoring the old key derivation: exactly the knowledge test and the colon-collision test fail (the second save is swallowed as reused); the identical-retry test stays green. Restored; all green. |
| Page state machines | The two unknown-id tests now assert the rendered not-found headings and that loading ends (previously they documented the surface as unreachable); new read-failure tests drive real services over a fail-once `MemoryLocalStore` subclass (real mapped messages, retry-to-ready); return-path assertions (`?returnTo` honored; legal fallback without a source, with the real route as location); unsaved-changes guard journey (drawer appears, stay keeps the page, no write). |
| G5 identity | Identical retry → exactly one persisted record; knowledge-only difference → two (one `known`, one `needs_review`); amount difference → two; colon-collision inputs → two distinct records; plus an **IndexedDB-backed** service-level leg (fake-indexeddb) proving the dedupe contract on the second adapter. |
| Full suites | Root 747/747 · app 2,502/2,502 (was 2,488 → +14 new tests) · storage 300/300 (was 295 → +5) · all 17 root guards PASS. |
| **Real-browser (out-of-band)** | See §5. |

## 5. Browser-evidence statement (F7 and the page surfaces)

The repository has **no real-browser test harness** (verified by REV4 and the executor: no playwright/puppeteer/cypress/webdriver anywhere; vitest = jsdom + fake-indexeddb; `docs/quality/prototype-qa-v1.md:50`; the Cloudflare Pages PR check is a provider-side build). Per the mandate's option to obtain real-browser evidence without adding repository infrastructure, an **out-of-band execution** was performed (agent-browser 0.39.0, real Chromium `HeadlessChrome/155.0.0.0`) with all artifacts preserved in-repo under `r9c-browser-evidence/`:

1. **F7 on real IndexedDB:** a standalone page bundling the committed adapter (esbuild, type imports erased) ran the poisoned-write scenario against Chromium's native engine. Both legs (Style A `commitFinancialEventCorrection`; primitive `saveDirectSale`) resolved `ok:false` / `storage_error` with the **original** `DataCloneError` message (`Failed to execute 'put' on 'IDBObjectStore': () => "poison" could not be cloned.`) and intact state — identical behavior to fake-indexeddb. No false success.
2. **Page surfaces on the real production build:** first-run setup completed through the real UI; `/cash/entry/<unknown>/reverse` renders «لم نجد أثر الكاش» with loading absent; `/inventory/movement/<unknown>/reverse` renders «لم نجد حركة المادة» with loading absent; the G5 editor renders fully.
3. **G5 identity end-to-end through the real UI:** identical retry → reused (one persisted record); a knowledge-only difference → a second persisted record; direct IndexedDB read-back shows both records with the new-format keys.

**Honest boundary:** this is a one-time out-of-band execution recorded as evidence, **not** a repeatable CI check — the standing recommendation for an in-repo real-browser harness remains (now for CI reproducibility, not for defect closure). The read-error surfaces were not browser-verified (no UI path can make a real storage read fail on demand); their behavior is proven by the jsdom direct tests through the real service layer.

## 6. Guard, ratchet, and budget deltas (all same-PR, ceilings untouched)

- **File-size ratchet:** six ledger entries with same-commit baseline updates — `R9-GA-F3-ROOT-FIX-CASH-REVERSAL` (177→220 NORMAL), `R9-GA-F3-ROOT-FIX-INVENTORY-REVERSAL` (128→170 NORMAL), `R9-GA-F3-ROOT-FIX-CASH-WALLET-ROLE` (132→135 NORMAL) in `56c47a27`; `R9-GA-F3-ROOT-FIX-G5-KEY` (238→256 NORMAL) in `c1d294b1`; `R9-GA-F7-ROOT-FIX-ADAPTER` (4133→4391 SPLIT_NOW) + `R9-GA-F7-ROOT-FIX-PRIMITIVE` (106→120 NORMAL) in `0bb51d1e`. Authorization: the owner's continuation mandate. Guard: PASS with zero unauthorized growth.
- **Bundle budget (entry ceilings untouched):** entry **631,254 raw / 155,009 gzip** against 650,000/155,300 — PASS (+1,905 raw / +306 gzip over the W2 anchor; the pre-implementation risk call was 597 B of gzip headroom, measured before committing).
- **Bundle surfaces (re-anchored at code head `0bb51d1e` with dated method strings, W2 precedent):** local lazyRawTotal 1,206,629→**1,207,964**, lazyGzipNormTotal 363,974→**364,297**, precacheBytesTotal 2,672,292→**2,675,532**; cloud records 2,675,644 (the documented +112 environment variance, same-tree argument, to be verified by the final-head CI/Pages runs). All counts unchanged (lazy 101, initial 2, dynamic roots 70, precache 156 entries with 0 duplicates, SW runtime 2 at 26,170; initial companions unchanged 224,687/70,716).
- **Text density:** the golden characterization fixture refreshed (19→20 at-rest strings per reversal editor — the new «إعادة المحاولة» label; cap 30 holds).

## 7. Schema / export / financial / historical / security / UI impact statement

`localSchemaVersion=38` / `localExportVersion=30` **untouched**. Export/import bytes and the accepted version matrix unchanged (goldens green; the G5 key is an opaque string field — format change only, old exports still import). **No financial change:** persisted money amounts/units, directions, dates, sources, notes, links, reversal behavior, rejection semantics — all unchanged (the G5 fix changes *which distinct saves share an idempotency key*, not what any save persists; the F7 fix changes failure behavior only — a failed write now resolves with its original error instead of an engine-dependent outcome). No historical record touched (reversals still add compensating entries; originals never mutate). No security/permission change. **UI impact — failure-path truthfulness only, owner-authorized:** reachable not-found surfaces (previously infinite loading), actual read-error messages with retry (previously mislabeled as not-found), two ARIA role corrections, one save-exit destination now honoring the return-path contract. **No CSS, layout, navigation-structure, or visual-system change; all existing Arabic copy preserved verbatim.**

## 8. Verification table (commands and exit codes, on the final pre-docs tree)

| Command | Result |
|---|---|
| `pnpm --filter @micro/prototype-web exec vitest run client/src/storage/local/` | 300/300 (exit 0) |
| `pnpm --filter @micro/prototype-web exec vitest run` (full app suite) | 2,502/2,502 across 339 files (exit 0) |
| `pnpm --filter @micro/prototype-web check` (tsc) | exit 0 |
| `prettier --check` on every touched file | clean |
| `node scripts/check-file-size-ratchet.mjs` (after the ledger+baseline in each commit) | PASS (zero unauthorized growth) |
| `pnpm --filter @micro/prototype-web build` (budget + surfaces after re-anchor) | PASS — entry 631,254/155,009; all surfaces within baseline |
| `pnpm check` (full canonical: operations-control ×2, typecheck, lint ≤37, format, text-density, design guards, 17 guards, root tests, prototype tsc/tests/build) | **exit 0** — root 747/747, app 2,502/2,502, text-density golden refreshed |
| `python3 scripts/operations-control/generate_tracker.py --check` / `validate.py` (after the JSON edits + view regeneration) | exit 0 / exit 0 (the two standing warnings only) — recorded in the docs commit |
| `git diff --check` | clean |
| `node scripts/generate-test-map.mjs --check` | no drift (no new test files) |

The **final PR head** (this docs commit) re-runs the full check before the push, and its CI + Cloudflare Pages results are pinned in the PR body on the exact head per the R9-GA-F5 protocol (post-merge reconciliation back-fills the machine outputs — owner action).

## 9. Files changed and not changed

**Changed (code):** `pages/CashReversalEditor.tsx`, `pages/InventoryReversalEditor.tsx`, `pages/CashWalletEditor.tsx`, `pages/G5DeclarationEditor.tsx`, `storage/local/IndexedDbLocalStore.ts`, `storage/local/indexedDbPrimitives.ts`. **Changed (tests, all extensions of existing files):** `CashReversalEditor.dom.test.tsx`, `InventoryReversalEditor.dom.test.tsx`, `CashWalletEditor.dom.test.tsx`, `G5DeclarationEditor.dom.test.tsx`, `application/financial-analysis/financialAnalysisService.test.ts`, `storage/local/rollbackRehearsal.r9.test.ts`. **Changed (guard data):** ratchet baseline + ledger (6 entries), surfaces baseline (3 environment records), text-density golden fixture. **Changed (docs/evidence):** this report, the repair cards (dated disposition updates + the GA-F7 spec-accuracy correction), the W9 readiness report (dated corrections), `r9c-browser-evidence/` (new), WS-216/ARCH-007 JSON + regenerated views, current-state live fields (net-neutral within the size contract), state-log §170, AGENT-SEQUENTIAL-WORKLOG Entry 84. **Not changed:** every other page/component/CSS file; the domain layer; the transfer layer; the service contracts (including `financialAnalysisService.createDeclaration`); the G5 reversal identity; contracts/docs outside the R9 set; CI; package scripts; PR #344; the protected UI branch; `main`.

## 10. Rollback boundary

Per-fix reverts are clean (no data migration anywhere): `56c47a27` (state machines + return path + roles + their tests/golden/ratchet rows), `c1d294b1` (G5 key + tests + ledger row), `0bb51d1e` (listener hardening + RB-3 + two ledger rows), and this docs commit (evidence/control/surfaces anchor — the surfaces baseline reverts with it). Reverting any code commit restores the prior behavior exactly (the defects return as documented; the tests that would fail are precisely the ones added for that fix — the negative proofs double as revert detectors).

## 11. Additional findings during this continuation

1. **R9C-REV1 spec-accuracy correction (records):** the original R9-GA-F7 evidence claim "real IndexedDB reports the exception without aborting" is inaccurate for conforming engines (IndexedDB 3.0 §5.9 aborts on listener throw with a replacement AbortError) — corrected by a dated append in the repair card; the fix rationale stands (payload fidelity + application-determined behavior). No code impact.
2. **Out-of-scope role offenders (record-only):** five+ additional `micro-field-error`-with-`role="status"` sites outside the mandate's four pages (list in §3/F3.5) — recorded for a future card; not fixed here (scope discipline; the mandate's "do not mechanically replace every role=status in the application").
3. **Pre-existing Memory/IndexedDB failure-mode divergence (record-only):** `MemoryLocalStore` *rejects* on an uncloneable clone while the IndexedDB adapter *resolves* `ok:false` — pre-existing (the sync-phase `writeOne` already behaved this way), not widened by F7; the F7 catch follows the IndexedDB adapter's own established `failure()` contract. Recorded; no change (the mandate preserves the service/result-code contracts).
4. **G5 cross-format retry-dedup loss (documented migration note):** §3/F3.4 — development-stage only, explicitly recorded rather than papered over.

## 12. Owner action required next

1. Review this report + the repair cards + the PR #347 diff (final head pinned in the PR body with its CI/Pages run URLs).
2. **Merge decision (owner-only).** If merged: run the recorded post-merge reconciliation (back-fill the final-head run URLs + machine outputs into the canonical evidence; move `merge_sha`/`verified_on_main_sha` only after the merge exists) — then R10 becomes eligible per the program contract.
3. If declined: the per-fix rollback boundaries in §10.

## 13. Merge Manifest — **NOT EXECUTED (owner approval required separately)**

| Item | Value |
|---|---|
| Repository | `Qays7753/Micro` |
| PR | #347 — https://github.com/Qays7753/Micro/pull/347 |
| Source branch | `refactoring/r9-complete-w1-w2-w3-20261010` |
| Source full SHA | the final head carrying this report (pinned in the PR body) |
| Target branch | `main` (target SHA before merge `8b3c9aeb09ca33ed66f0a929c157b668839d0463`) |
| Merge method recommended | merge commit |
| Required checks | `pnpm check` on the final head + the provider-side Cloudflare Pages check — URLs pinned in the PR body |
| Status | **NOT EXECUTED — no merge performed; no `main` writes; no cleanup performed** |

## 14. Final Status

```text
REMEDIATION_COMPLETE — PR_READY
NO_MERGE_PERFORMED
NO_MAIN_CHANGES_PERFORMED
NO_TOKEN_EXPOSURE
NO_REPOSITORY_CLEANUP_PERFORMED
```

All in-scope defects (F3.1, F3.2, F3.3, F3.4, F3.5, F7, W3-F1) are fixed with root-cause changes and regression evidence; the full canonical checks pass on the continuation tree; the final-head CI/Cloudflare results are pinned in the PR body; the only recorded limitations are the standing engine/browser items in §5 (out-of-band real-browser evidence preserved; no in-repo harness — the recorded trigger) and the documented migration note in §3/F3.4 — neither is an open defect.
