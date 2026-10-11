# R9 — Systemic Root-Fix and Evidence-Closure Execution Report (2026-10-11)

**Program:** WS-216 / ARCH-007 — Structural Remediation R0–R10, wave R9 (owner-authorized systemic continuation on the existing branch/PR #347).
**Executor:** Z AI (primary, single writer; five read-only reviewers before implementation and on the final diff).
**Mandate:** `R9-ZAI-SYSTEMIC-ROOT-FIX-AND-EVIDENCE-CLOSURE-PROMPT-2026-10-11.md` at `3cf59707daa4e9448398bb7386b8a71f262085b6` (read from the repository and executed; the short chat message was a pointer only).
**Starting point (verified live, no STATE_DRIFT):** PR #347 open/mergeable/clean, head `3cf59707daa4e9448398bb7386b8a71f262085b6`, base `main` = `8b3c9aeb09ca33ed66f0a929c157b668839d0463`, CI `checks` + Cloudflare Pages both success on that exact head, only PRs #347 + #344 open, worktree clean and in sync, single writer, baseline storage suite 300/300 green.

---

## 1. The five pre-implementation read-only reviews (head `3cf59707`)

### REV1 — Storage, transaction, and adapter integrity

Exhaustive listener inventory (deterministic scan, persisted script `scripts/r9_listener_inventory.py` working copy; the same inventory is re-expressed as the permanent static guard `scripts/check-storage-listener-guards.mjs`):

| Surface                                                                            | Count    | Status                                                                                                                                                                      |
| ---------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onsuccess` listeners total (adapter + primitives + lifecycle)                     | 77       | —                                                                                                                                                                           |
| … wrapped by `guardedSuccessListener` (F7 fix)                                     | 73       | guarded                                                                                                                                                                     |
| … locally guarded (`writeOneIdempotent` own try/catch)                             | 1        | guarded (equivalent pattern)                                                                                                                                                |
| … safe-by-construction (`readOne` resolve-only; `openDatabase` internal try/catch) | 2        | safe                                                                                                                                                                        |
| … **defective: `listAll` comparator throw → promise never settles**                | **1**    | **R9-GA-F7.1**                                                                                                                                                              |
| `transaction.abort()` calls                                                        | 165      | all guarded (try/catch + pending fallback)                                                                                                                                  |
| Write-queueing listeners                                                           | 34       | 33 guarded + 1 locally guarded                                                                                                                                              |
| Executor-level destructive-prefix writes (`clear()` before fallible `put()`)       | 1 family | `replaceIndexedDbSnapshot` — R9-GA-F1 guard verified in place                                                                                                               |
| Read snapshot (`readIndexedDbSnapshot`)                                            | 1        | `oncomplete` property-reads only — safe by construction                                                                                                                     |
| Migration cursor listeners (`indexedDbMigrations.ts`)                              | 7        | typeof-guarded bodies + clone-safe update payloads; a throw fails the open honestly (payload may degrade to the generic open error — migration code cannot currently throw) |

Findings:

1. **`R9-GA-F7.1` (NEW, FIX_NOW):** `indexedDbPrimitives.ts:119` `listAll` — the `onsuccess` body runs the caller's sort comparator; a comparator throw on a malformed stored record escapes the listener, the promise **never settles** (no `onabort` handler, `oncomplete` no-op), and the page hangs in loading forever. This is the read-side sibling of the F7 family (engine-dependent listener-exception outcome). Reachability: latent (a malformed record surviving `validateSnapshot` via validator regression, or manual tampering) — the same reachability class as R9-GA-F1. Memory adapter parity: `MemoryLocalStore` list methods sort synchronously inside async methods → a comparator throw **rejects** (observable signal), so the adapters diverge in the same latent class already recorded for writes (the recorded reject-vs-resolve-failure divergence). The defect to fix is the **hang**: the guard resolves the adapter's declared `StorageResult` failure with the original error. Root fix: wrap the `listAll` listener body (and for uniformity the `readOne` body — see the guard scope note) in the established guard shape.
2. **Static-guard gap (Group C requirement):** nothing prevents a new unguarded write-queueing or callback-bearing `onsuccess` listener from being added silently. Root fix: permanent static guard `scripts/check-storage-listener-guards.mjs` (+ companion test + registration in `package.json` guards chain, `§4.3.1` registry row, ratchet/ledger for the new files, document-index). The guard fails when a storage-layer `onsuccess` listener queues a write (`put/add/delete/clear`) or invokes a caller callback without `guardedSuccessListener`/a documented local-guard marker.
3. Verified intact: the F7 hardening (73+1 listeners, original-error payload first, guarded abort), R9-GA-F1 (guarded abort + original-error rethrow), atomic `clear→put` ordering protection, `writeOne`/`deleteOne` first-request-is-the-write shape (a sync throw leaves an empty auto-committing transaction — no data at risk), Memory `replaceSnapshot` clone-first/swap-later atomicity.

### REV2 — UI state machines and accessibility semantics

Complete semantic inventory (deterministic scans: 99 `micro-field-error` elements — 65 `role=alert`, 22 `role=status`, 12 role-less/dynamic; 30 page-level error/not-found headed sections; complementary `role=status`/dynamic-role scans). Every occurrence classified:

**A. Error-only message surfaces announced as `role="status"` (confirmed defects — flip to `alert`):**
`pages/CashAdjustmentEditor.tsx:143`, `pages/InventoryMovementEditor.tsx:935`, `pages/DirectSaleEditor.tsx:891`, `pages/EstimateDetail.tsx:203`, `pages/MaterialEditor.tsx:308`, `pages/MaterialEditor.tsx:479`, `pages/Tools.tsx:218`, `pages/ToolsIntegrity.tsx:157`, `components/finance/CorrectionsLayer.tsx:221`, `components/direct-sales/SaleCollectionReversalSection.tsx:197`, `pages/CostCalculator.tsx:545` (live validation-failure preview). Setters verified error-only (failures, validation, not-found-at-save).

**B. Mixed-tone single-element announcements (split error/success with tone-in-state — the canonical repo pattern from ActualTimePanel/ScheduleEditor/SupplierPurchaseEditor):**
`components/order/AgreementContextPanel.tsx:180` (`saveState.kind` flag exists), `pages/OwnerEntitlement.tsx:620` (`notice.tone` flag exists), `pages/CashCount.tsx:216`, `pages/CashDistribution.tsx:251`, `pages/CostCalculator.tsx:550`, `pages/FinancialEventEditor.tsx:959`, `pages/Profile.tsx:301`, `pages/Schedule.tsx:556`, and `pages/Schedule.tsx:349` (`capacityMessage` — string-prefix role sniffing; **current mislabel confirmed**: the info message «أُزيلت السعة اليومية.» is announced `alert` + error class today). The six string-prefix sites derive tone by sniffing Arabic prefixes — the recurrence risk; the root fix carries tone in state.

**C. Read-error sections with honest text but NO announcement role (role-only additions; zero visual change):**
29 page-level read-error surfaces render `<p>{message}</p>` inside `micro-not-found` sections with no live semantics — a retry within the page inserts the error dynamically with no announcement. One-line `role="alert"` additions on the error message paragraphs: `CashCount`, `CashDistribution`, `CashOpeningLaterEditor`, `CashWallets`, `Collect`, `CostEditor`, `DraftEditor` (:333), `EstimateDetail` (:104), `Finance` (:299 + bridge :745 + horizon :442), `FinanceActivity`, `Foundation`, `Home`, `InventoryMaterials`, `InventoryMovementEditor` (:406), `OrderDetail`, `Orders`, `OwnerEntitlement` (:230), `OwnerWithdrawalEditor`, `Parties`, `Profile`, `Schedule` (:141), `Statement` (:231 + comparison :403), `Suppliers`, `WalletLedger`, `Tools` (:85), `Loans` (:103/:265/:275), `DeliveryReview` (:227), `ReceivedLoanEditor` (:166), `ToolsIntegrity` (:156). Canonical in-repo precedents: `Assets.tsx:56`, `CashTransferEditor.tsx:92`, the fixed reversal editors.

**D. Swallowed read failures / infinite loading — the F3.1/F3.2/W3-F1 family recurrence (state-machine fixes, mirroring the fixed reversal editors):**

1. `pages/CashAdjustmentEditor.tsx:70–84` — the exact old render guard (`if (!wallet && !message) loading; if (!wallet) not-found`): unknown wallet id → **infinite loading**; read failure → **mislabeled not-found** «لم نجد محفظة الكاش» (the actual message is never rendered).
2. `pages/ScheduleEditor.tsx:195` — `phase === "error" || !schedule` collapsed into one branch rendering «الموعد غير متاح محليًا»; the error message is discarded (`setPhase("error")` without message capture).
3. `pages/RecurringExpenseEditor.tsx:192` — read failure AND unknown id → `loaded` stays false → **infinite loading** (the message is set but never rendered; `readDetail` returns `validationFailure("سلسلة المصروف المتكرر غير موجودة.")` for unknown ids).

**E. PRESERVE classifications (intentional, evidence-backed — not changed):**
`CashCount.tsx:170` (empty-state guidance, informational), `InventoryMovementEditor.tsx:507` (`linkIssue` — pre-save advisory warning; the owner's "if retained as an error surface" clause: it is not an error surface — save-time validation enforces the hard error), `OwnerEntitlement.tsx:640` (cross-model duplicate review notice — warning), `OwnerEntitlement.tsx:719` (inline per-row warning marker — static list content), `SettingsDataProtectionSection.tsx:252/:526` (static destructive-action warnings — static content needs no live region), all loading surfaces (`role="status"` — correct), not-found pages (informational; the honest heading announces), the canonical tone-flag surfaces (`ActualTimePanel:393`, `ScheduleEditor:305`, `SupplierPurchaseEditor:1137` — dynamic role, correct).

Read-effect rejection note: page read effects use `.then()` without `.catch()`; on the production IndexedDB adapter every storage method resolves (verified by the REV1 inventory — all outer try/catch + listener guards), so a rejection requires a service-code bug or the latent malformed-record class (Memory adapter rejects — the recorded divergence). After the F7.1 fix the production adapter resolves failure on the read path as well. Recorded, not a current reachable defect.

### REV3 — Domain, application, identity, and compatibility

1. **G5 current identity verified:** `g5-ui:${JSON.stringify([direction, dueOn, amountMinor, source.trim(), note.trim(), knowledge, relatedOrderId, relatedEventId])}` — all eight persisted semantic inputs, collision-free, frozen `g5-ui:` prefix; the service is a caller-key gate with exact-equality dedupe within kind; the domain constructor persists trimmed values (`source.trim()`, `note.trim()`, links `?.trim() || null`) — semantic comparison against persisted records is well-defined.
2. **`R9-GA-G5.1` (NEW, FIX_NOW — the Group B core question):** old-format keys (`g5-ui:${direction}:${dueOn}:${amountMinor}:${source}:${note}:${related ?? "none"}`) do not match the new format — a genuinely identical retry across the boundary creates a semantic duplicate. Determination (required by the prompt): the issue **can** be closed without a schema/export version change via a **safe semantic compatibility lookup** — after the exact-key miss, `createDeclaration` compares the persisted semantic fields (direction, dueOn, amountMinor, source, note, knowledge, relatedOrderId, relatedEventId) against the input; a field-exact match reuses the existing record truthfully regardless of key format. This is one of the prompt's explicitly offered root approaches ("canonical semantic comparison"). It cannot falsely reuse (field-exact, includes knowledge — immune to the legacy colon-collision ambiguity because keys are not consulted at all), it does not mutate stored records, it works identically on Memory and IndexedDB (list+find), and it covers imported old-format records. The exact-key fast path and the reversal identity (`reverse:${id}` UUID-derived + `reversalOfId` uniqueness) are untouched.
3. **`R9-GA-G5.2` (NEW, FIX_NOW — sibling identity builder):** `src/domain/financial-analysis/policies.ts:291` `mixKey = ${itemName.trim()}::${unitKey ?? "legacy:recorded-mix"}` — a free-text `::` concatenation grouping key (contribution-mix display aggregation). A crafted `itemName` containing `::` can merge distinct (name, unit) pairs. Display-only blast radius; collision-free JSON key is the same-family root fix.
4. All other concatenation keys audited safe: UUID bases (`${id}:action` family), enum-first prefixes with opaque trailing segments (import validator `${kind}:${key}`), digit-run amounts before timestamps (`collect-full-${amount}-${timestamp}` family — unique first-delimiter parse), trailing free text (`assign-name:${name}` — suffix is the name, distinct names give distinct keys). Import validation for the G5 family: shape + opaque-key uniqueness + reversal field-consistency — collision-free; old-format keys import unchanged.

### REV4 — Tests, CI, browser evidence, and negative proof

1. **`R9-GA-F8` (the owner's second required correction):** `r9c-browser-evidence/f7-harness.mjs.txt` imports `./adapter-entry.ts`, which is **not committed** — the README's "all artifacts preserved"/"the exact committed adapter code" claims are not reproducible from the repository alone. Root fix (Group D): commit the deterministic bundle builder + the exact generated adapter entry + a content-addressed manifest (source SHA, esbuild version + command, SHA-256 hashes), **re-run the real-browser scenario from the committed artifacts** (real Chromium available in the execution environment), and make the README/verdict/report claims exactly true.
2. Existing regression evidence verified structurally: RB-1/RB-2/RB-3 legs in `rollbackRehearsal.r9.test.ts` (F1 sync/async legs, F7 legs A/B/C/C2/D with original-payload assertions), the G5 identity tests, the page state-machine tests. Negative proofs for the pre-existing fixes were executed by temporary un-revert (documented, not committed) — the same protocol is applied to the new fixes in this continuation.
3. CI: `pnpm check` + whitespace verification + PWA artifact upload; Cloudflare Pages is a provider-side check on every head. Final-head pinning per the R9-GA-F5 protocol (PR body carries the run URLs; post-merge reconciliation back-fills).
4. Coverage gaps to close with this continuation: no direct tests exist for the three newly-found state-machine pages; no test proves the `listAll` failure contract; no test covers the G5 cross-format reuse; no static guard protects the listener invariants.

### REV5 — Documentation, Operations Control, and source-of-truth consistency

1. The R9-POST-REVIEW-ROOT-FIX-EXECUTION-REPORT §3/F3.5 and §11.2 record the role offenders as "out of scope/future card" — **superseded by the owner's rejection**; this report closes that disposition with dated corrections (append-only, no history rewrite).
2. The r9c-browser-evidence README overstates artifact completeness (REV4 finding above).
3. `R9-REPAIR-CARDS.md` carries `R9-GA-F3.6` = the ReceivedLoanDetail import-block informational card, while the owner's PR finding re-uses the hyphenated ID `R9-GA-F3.6-ERROR-ROLE-INVENTORY` for the error-role inventory — a numbering collision to reconcile with a dated note (both IDs remain stable and distinct; no card is rewritten).
4. WS-216/ARCH-007 `next_action`, `current-state.md` (the R9 line: "real browser evidence out of scope" — superseded), state-log §171, AGENT-SEQUENTIAL-WORKLOG Entry 85, TEST-AND-DOCUMENTATION-MAP (regeneration after new test files), and the document index (evidence arrays reference the new report) all require the standard same-PR updates. `validate.py` / `generate_tracker.py --check` / doc-index coverage / current-state size / `git diff --check` are the closing gates.

### Reviewer synthesis — conflict resolutions

- REV2's D-family (three more swallowed-read pages) extends beyond the owner's named list; the prompt's Group A ("also scan every other page/component found by the semantic inventory") and the recurrence-family mandate include them — adopted as FIX_NOW.
- The mixed-tone split changes the rendered class of **info/success** messages on the affected pages from the error style to the pages' own intended `micro-save-note` style (evidenced by each page's existing prefix-sniffing). No new styles are introduced; this is the truthful-state correction the mandate authorizes, recorded here explicitly.
- REV3's semantic bridge changes the service dedupe contract from "caller-key equality" to "caller-key equality OR exact semantic equality" — resolved as authorized: the prompt's Group B explicitly offers canonical semantic comparison as the required root approach, scenario 8 (no wrong reuse) is provably satisfied (field-exact comparison including knowledge), and the alternative (key migration) would require the forbidden versioned schema change.
- The REV1 static guard is a new repo script + test — resolved as required by Group C ("add static/contract guards so new unsafe listeners cannot be added silently"); it follows the existing guard family's house pattern and registration chain.

---

## 2. Implementation matrix (pre-code commitment)

| ID                                                             | Family                                         | Evidence                                                                           | Root cause                                                                                          | Blast radius                                        | Class                | Remediation                                                                                                                                                                                           | Tests                                                                                                                                                                            | Acceptance                                                                                                                                          | Rollback                                                    |
| -------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| R9-GA-F3.6-ERROR-ROLE-INVENTORY (owner finding; sub-items a–d) | UI/error semantics                             | REV2 inventory: 99 elements, 22 status-proximate, 12 role-less, 30 headed sections | Tone and role derived ad hoc (string-prefix sniffing, single mixed element, missing live semantics) | 24 production files + their tests                   | FIX_NOW              | (a) 11 error-only sites → `role="alert"`; (b) 9 mixed-tone sites → tone-in-state split; (c) 31 read-error paragraphs → `role="alert"`; (d) 8 informational/warning sites → PRESERVE documented        | Per-family direct tests (new state-machine tests assert alert on read-error; representative mixed-tone journeys assert alert-on-error + status-on-success); existing suite green | Semantic inventory complete; every confirmed error surface announces `alert`; status only where semantically correct; tests fail on role regression | Per-fix slice revert                                        |
| R9-GA-F3.7                                                     | UI state machines (F3.1/F3.2/W3-F1 recurrence) | REV2-D: CashAdjustmentEditor:70-84, ScheduleEditor:195, RecurringExpenseEditor:192 | Read settle-outcome not modeled (null data + no phase discriminator)                                | 3 pages + their tests                               | FIX_NOW              | Explicit read-state machines (loading/ready/not-found/read-error + retry) mirroring the fixed reversal editors; error message captured and rendered                                                   | 3 new direct test files (not-found reachable, loading ends, read-error renders actual message + retry, save guard)                                                               | No infinite loading; no failure mislabeled as not-found                                                                                             | Per-fix slice revert                                        |
| R9-GA-F7.1                                                     | Storage read path                              | REV1: indexedDbPrimitives.ts:119 listAll                                           | Comparator throw inside unguarded `onsuccess` → promise never settles                               | All list paths (read); pages hang on malformed data | FIX_NOW              | Guard the listener body → resolve `failure(error)` with the original error (readonly transaction — no abort needed); permanent static guard `check-storage-listener-guards.mjs` + test + registration | RB-4 in rollbackRehearsal.r9.test.ts (settles-with-failure, bounded race); negative proof by guard removal; static-guard unit tests incl. a failing fixture                      | No storage read can hang; the guard blocks new unsafe listeners                                                                                     | Revert the primitive change; disable the guard registration |
| R9-GA-G5.1                                                     | Identity/compatibility                         | REV3: cross-format retry duplication                                               | Key format change orphans old-format keys                                                           | G5 declarations; dev DBs + old exports              | FIX_NOW              | Semantic compatibility lookup in `createDeclaration` after the exact-key miss (8-field exact comparison)                                                                                              | Service tests: cross-format reuse, knowledge-difference no-reuse, colon-collision no-false-reuse, adapter parity (fake-indexeddb leg); editor journey                            | Identical retry reuses regardless of key format; semantic differences never reuse; no schema/export change                                          | Revert the service change                                   |
| R9-GA-G5.2                                                     | Identity (sibling)                             | REV3: policies.ts:291 mixKey `::` concatenation                                    | Free-text concatenation grouping key                                                                | Contribution-mix display aggregation                | FIX_NOW              | Collision-free JSON array key                                                                                                                                                                         | Domain test: colliding name/unit pairs stay distinct                                                                                                                             | No crafted-input merge                                                                                                                              | Revert the domain change                                    |
| R9-GA-F8                                                       | Browser evidence                               | REV4: missing `adapter-entry.ts`; README overclaims                                | Evidence chain not reproducible from the repo                                                       | r9c-browser-evidence package; reports               | FIX_NOW              | Commit deterministic builder + generated adapter entry + manifest (SHAs, versions, hashes); re-run the real-browser scenario from committed artifacts; true README/verdict                            | The re-run itself (machine-readable verdict, engine UA, hashes match the manifest)                                                                                               | A clean checkout can reproduce exactly what ran; no stale claim                                                                                     | Revert the evidence commit                                  |
| R9-GA-F3.6 (numbering)                                         | Documentation                                  | REV5: ID collision with the owner's hyphenated finding                             | Two findings share the F3.6 number                                                                  | Repair cards                                        | FIX_NOW (dated note) | Dated numbering note; both IDs stable and distinct                                                                                                                                                    | validate.py/--check                                                                                                                                                              | No ambiguity in the permanent record                                                                                                                | n/a (records)                                               |

PRESERVE records extended (no code change): the Memory reject-vs-resolve divergence now covers the read path (after F7.1 the production adapter resolves failure; Memory rejects on the same latent trigger); migration listener payload fidelity (safe-by-construction bodies); `.then()`-without-`.catch()` read effects (unreachable rejection on the production adapter; recorded trigger).

Earlier-report reconciliation: every F3.1–F3.5/F7/W3-F1 item = fixed (verified on the live tree); the "five additional offenders" list = subsumed and completed by F3.6's full inventory; the "future card" deferrals = superseded (owner rejection, dated corrections); the G5 migration note = closed by G5.1; the browser-evidence limitation = repaired by F8 (out-of-band one-time → reproducible chain + fresh run); R9-GA-F2/N7–N10 PRESERVE records = unchanged.

---

## 3. Execution log — groups, commits, tests, and gates

### Group A — systemic error-surface semantics (commit `da8747ca`)

Scope: R9-GA-F3.6-ERROR-ROLE-INVENTORY (a/b/c/d) + R9-GA-F3.7. 37 production files + 5 test files changed. Focused verification before the commit: the four new/extended test files (14 tests) green; full app suite 343 files / 2,516 tests green; typecheck 0 errors; lint ≤37 clean; ratchet PASS (12 ledger entries R9-SYS-A-*); text-density cap 33→34 for RecurringExpenseEditor with the golden regenerated byte-identically through the official characterization path (7/7); surfaces re-anchored (entry unchanged 631,254/155,010; lazy +3,001 raw / +740 gzip-norm); test-map regenerated (no drift); full `pnpm check` **exit 0** (747/747 root, 2,516/2,516 app).

### Group B — G5 identity and legacy compatibility (commit `ecc4b963`)

Scope: R9-GA-G5.1 (the semantic bridge) + R9-GA-G5.2 (mixKey). Focused verification: the financial-analysis service suite 22/22 (incl. the 4 new cross-format tests), the domain suite 470/470 (incl. the mixKey test), transfers 289/289 (goldens byte-stable — no compatibility change), G5DeclarationEditor journey 8/8. **Negative proof (F7-style protocol):** with the bridge disabled via a temporary one-line change, exactly the two cross-format reuse tests fail; restored green (never committed broken). Ratchet ledger entries R9-SYS-B-*; surfaces re-anchored (entry +372 raw / +76 gzip under the untouched ceilings; lazy unchanged). Full `pnpm check` **exit 0** (748/748 root, 2,520/2,520 app).

### Group C — IndexedDB recurrence and adapter parity (commit `ecf17620`)

Scope: R9-GA-F7.1 (the listAll read guard) + the permanent static guard. Focused verification: the rehearsal suite 10/10 (incl. RB-4); the static guard PASS on the live tree (77 listeners; 2 documented exemptions); the guard's companion test 6/6 (live-tree pass, write-queueing negative fixture, callback negative fixture, both guard shapes accepted, exemption integrity, bounded finder). **Negative proof:** with the listAll guard removed, RB-4 fails with «listOrders never settled — the read hang regression» (the 2s bounded race); restored 10/10. Registered in the `pnpm guards` chain + the §4.3.1 metadata table (guard #20, dated note). Ratchet ledger entry R9-SYS-C-IDEDB-PRIMITIVES-LISTALL-GUARD (chain 106→132); surfaces re-anchored (entry +26 raw). Full `pnpm check` **exit 0** (754/754 root, 2,521/2,521 app).

### Group D — browser evidence closure (commit `91bd07ac`)

Scope: R9-GA-F8. The chain: builder (esbuild 0.28.2, the lockfile's pinned transitive devDependency) → `adapter-entry.js` (246,768 bytes, SHA-256 `b1d5fd5f53408ecb9068933c7dbefd17744b26940d05e72c3e9db989b63ec6a3`, **rebuild verified byte-identical**) → the harness imports the committed bundle → the host page → the manifest → **a fresh real-browser run executed from these committed artifacts**: real Chromium `HeadlessChrome/156.0.8078.4` (playwright, host installation) — leg B `commitFinancialEventCorrection` poisoned reversal: `ok:false`/`storage_error` with the original `Failed to execute 'put' on 'IDBObjectStore': () => "poison" could not be cloned.` and the events family untouched; leg A `saveDirectSale` poisoned: `ok:false` with the same original payload and zero sales persisted; all four verdict booleans true; **zero console errors**. Recorded in `f7-verdict.json` + `f7-run.json`; the README states exactly what ran and the precise limitations. check-secrets PASS over the new files; doc-index coverage complete.

The recorded run's runner (verbatim, out-of-band — the README references this annex):

```js
/* R9-GA-F8 — real-browser execution runner. Run from the REPOSITORY ROOT. */
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const evidenceDir = path.join(
  repoRoot,
  "docs/operations/control/evidence/structural-remediation-r9-20261010/r9c-browser-evidence",
);
await copyFile(path.join(evidenceDir, "f7-harness.mjs.txt"), path.join(evidenceDir, "f7-harness.mjs"));

const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
};
const server = createServer(async (req, res) => {
  const urlPath = req.url.split("?")[0] === "/" ? "/f7-page.html" : req.url.split("?")[0];
  try {
    const body = await readFile(path.join(evidenceDir, urlPath));
    res.writeHead(200, { "content-type": types[path.extname(urlPath)] ?? "text/plain" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/f7-page.html`;

const { chromium } = await import("playwright"); // the host installation used for the recorded run
const browser = await chromium.launch();
const page = await browser.newPage();
const consoleLines = [];
page.on("console", message => consoleLines.push(`${message.type()}: ${message.text()}`));
page.on("pageerror", error => consoleLines.push(`pageerror: ${error.message}`));
await page.goto(url, { waitUntil: "load" });
await page.waitForFunction(() => document.title === "DONE", null, { timeout: 30_000 });
const resultText = await page.textContent("#result");
const userAgent = await page.evaluate(() => navigator.userAgent);
await browser.close();
server.close();

const parsed = JSON.parse(resultText);
const verdict = {
  legB_honestFailure: parsed.verdict.legB_honestFailure,
  legB_stateIntact: parsed.verdict.legB_stateIntact,
  legA_honestFailure: parsed.verdict.legA_honestFailure,
  legA_stateIntact: parsed.verdict.legA_stateIntact,
  engine: userAgent,
};
await writeFile(path.join(evidenceDir, "f7-verdict.json"), JSON.stringify(verdict, null, 1) + "\n", "utf8");
const bundleSha = createHash("sha256")
  .update(await readFile(path.join(evidenceDir, "adapter-entry.js")))
  .digest("hex");
await writeFile(
  path.join(evidenceDir, "f7-run.json"),
  JSON.stringify({ url, bundleSha256: bundleSha, ...parsed, verdict, console: consoleLines }, null, 1) + "\n",
  "utf8",
);
```

### Group E — cross-cutting closure audit (this report + the docs commit)

Re-scan results versus the pre-implementation matrix:

- **Listener inventory:** 77 `onsuccess` listeners — 73 guarded + 1 locally guarded + 2 documented exemptions + **1 now guarded (listAll — was the F7.1 defect)**; 165/165 aborts guarded; zero unguarded write-queueing listeners; the static guard PASSes and blocks recurrence.
- **Old-guard infinite-loading patterns:** one textual match remains (`InventoryMovementEditor:397`) — **verified false positive** of the family (references is unconditionally set on read success; the failure path renders the actual message with alert). Zero true instances.
- **Prefix-sniffing tone derivation:** zero occurrences remain in the fixed pages.
- **`role="status"` on `micro-field-error`:** exactly the three documented PRESERVE sites remain (empty-state guidance, linkIssue advisory, cross-model review notice).
- **Every finding has a final classification** (the six new cards + the preserved records); no ordinary current defect is left as a generic defer; no test enshrines a bug (the semantics test asserts the preserved warnings stay `status` — the opposite direction of enshrinement).
- **Protected contracts:** `localSchemaVersion=38` / `localExportVersion=30` verified untouched; no persisted money/date/direction/link/classification change (the G5 bridge changes _which distinct saves share a record_, not what any save persists); export/import goldens byte-stable; no CSS/layout/visual-system change (role-only additions + the pages' own intended note style on split surfaces); CI workflow and package scripts unchanged except the guards-chain registration.
- **No unrelated files:** the whole-PR diff (vs main) is exactly the authorized surfaces (the first continuation's set + this continuation's error-surface pages, the G5 service/domain, the storage primitives, the rehearsal/semantics/page tests, the guard script + registration, the baselines/ledger, and the evidence/docs set).

## 4. Verification table (final pre-docs tree)

| Command                                                                                           | Result                                                                                       |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm --filter @micro/prototype-web exec vitest run client/src/storage/local/`                    | 305/305 (exit 0) — includes RB-1/RB-2/RB-3/RB-4                                              |
| `pnpm --filter @micro/prototype-web exec vitest run` (full app suite)                             | 2,521/2,521 across 343 files (exit 0)                                                        |
| `pnpm --filter @micro/prototype-web check` (tsc)                                                  | exit 0                                                                                       |
| `pnpm exec vitest run` (root)                                                                     | 754/754 (exit 0) — includes the guard's 6 tests                                              |
| `node scripts/check-storage-listener-guards.mjs`                                                  | PASS — 77 listeners, all guarded (2 documented exemptions)                                   |
| `node scripts/check-file-size-ratchet.mjs`                                                        | PASS (ledger entries R9-SYS-A/B/C-*)                                                         |
| `pnpm text-density` + characterization                                                            | all within caps; golden regenerated; 7/7                                                     |
| `pnpm --filter @micro/prototype-web build` (budget + surfaces)                                    | PASS — entry 631,652/155,093 under 650,000/155,300; surfaces within the re-anchored baseline |
| `pnpm check` (full canonical)                                                                     | **exit 0**                                                                                   |
| `python3 scripts/operations-control/validate.py` / `generate_tracker.py --check`                  | exit 0 / exit 0 (after the JSON edits below — recorded in the docs commit)                   |
| `node scripts/check-doc-index-coverage.mjs` / `check-current-state-size.mjs` / `git diff --check` | complete / intact / clean                                                                    |

## 5. Schema / export / financial / historical / security / UI impact statement

`localSchemaVersion=38` / `localExportVersion=30` **untouched** (verified on the final tree). Export/import bytes and the accepted version matrix unchanged (transfers 289/289 with byte-stable goldens; the G5 key remains an opaque string field; the semantic bridge reads, never writes). **No financial change:** no money amount, unit, rounding, classification, date, direction, link, reversal behavior, or rejection semantic changed — the G5 bridge changes _which distinct saves reuse an existing record_ (adding the truthful cross-format reuse), the mixKey fix changes a display grouping key's collision-freedom, and the storage guard changes failure behavior only (a hung read now resolves its honest failure). No historical record mutates anywhere. No security/permission change (check-secrets green on every head). **UI impact — failure-path truthfulness and accessibility only:** reachable not-found surfaces where infinite loading stood, actual read-error messages with retry (three more pages), error announcements with `role="alert"` (35 sites), tone-correct success/info announcements (9 splits), zero CSS/layout/visual-system change.

## 6. Memory/IndexedDB parity statement

The adapters behave identically on every path exercised by this continuation's changes: the G5 semantic bridge runs over `listShortCashDeclarations` on both adapters (proven by the Memory tests + the fake-indexeddb parity leg); the listAll guard settles the honest failure on the IndexedDB side while Memory's list methods surface the same malformed-data condition as a rejection — the pre-existing reject-vs-resolve failure-channel divergence (first recorded in the first continuation §11.3) now explicitly covers the read path, remains latent-only (validator-regression/tampering reachability), and is preserved with its rationale (the adapter's declared `StorageResult` contract is what the fixed side enforces).

## 7. Operations Control and documentation changes

`R9-REPAIR-CARDS.md` (six new cards + the F3.6 numbering note + the disposition table); dated supersession notes on `R9-POST-REVIEW-ROOT-FIX-EXECUTION-REPORT-2026-10-10.md` and `R9-COMPLETE-PR-READINESS-REPORT-2026-10-10.md` (append-only — no history rewritten); the `r9c-browser-evidence/` package rebuilt (Group D); `WS-216.json` + `ARCH-007.json` (evidence arrays + next_action); `current-state.md` live fields (within the 20,480-byte contract); `current-state-log.md` §171; `AGENT-SEQUENTIAL-WORKLOG.md` Entry 85; `TEST-AND-DOCUMENTATION-MAP.md` (regenerated via the official generator — no drift); `PLAN-A-TO-Z` §4.3.1 (guard #20 row + dated title note); this report (catalogued through the evidence arrays — the doc-index coverage gate passes).

## 8. Unverified / not executed / deferred / preserved items

- **NOT_EXECUTED (standing):** an in-repo repeatable real-browser CI harness — the recorded run's chain is reproducible from the committed artifacts, but CI reproducibility itself remains the standing R9-GA-F7 trigger (owner-gated; now for CI only, not for defect closure).
- **VERIFIED-with-limitation:** the read-error page surfaces are jsdom-proven through the real services (no UI path can make a real storage read fail on demand); the browser verifies loading/not-found/ready rendering (the 2026-10-10 recorded run) and the storage failure legs (this continuation's run).
- **PRESERVE (documented):** the Memory reject-vs-resolve divergence (now covering the read path); migration-listener payload fidelity (safe-by-construction bodies); `.then()`-without-`.catch()` read effects (unreachable rejection on the production adapter — every storage method resolves; recorded trigger: any new service that can reject on valid data); R9-GA-F2 and N7–N10 (unchanged).
- **Deferred:** none. Every ordinary current defect found in the investigated recurrence families is closed with evidence.

## 9. Owner action required next

1. Review this report + the repair cards + the PR #347 diff (the final head and its CI/Cloudflare results are pinned in the PR body per the R9-GA-F5 protocol).
2. **Merge decision (owner-only).** If merged: the recorded post-merge reconciliation back-fills the final-head run URLs + machine outputs into the canonical evidence directory and moves `merge_sha`/`verified_on_main_sha` — then R10 becomes eligible per the program contract.
3. If declined: the per-fix rollback boundaries in §3 (each fix commit reverts cleanly; the negative proofs double as revert detectors).

## 10. Merge Manifest — **NOT EXECUTED (owner approval required separately)**

| Item                                 | Value                                                                                                                                                                                               |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository                           | `Qays7753/Micro`                                                                                                                                                                                    |
| PR                                   | #347 — https://github.com/Qays7753/Micro/pull/347                                                                                                                                                   |
| Source branch                        | `refactoring/r9-complete-w1-w2-w3-20261010`                                                                                                                                                         |
| Source full SHA                      | the final head carrying this report (pinned in the PR body with its exact-head CI + Cloudflare Pages run URLs)                                                                                      |
| Target branch                        | `main` (target SHA before merge `8b3c9aeb09ca33ed66f0a929c157b668839d0463`)                                                                                                                         |
| Merge method recommended             | merge commit                                                                                                                                                                                        |
| Required checks                      | `pnpm check` (full canonical) + the provider-side Cloudflare Pages check on the exact final head — URLs pinned in the PR body                                                                       |
| Schema/export impact                 | none (38/30 intact; goldens byte-stable)                                                                                                                                                            |
| Financial/semantic/historical impact | none (the G5 bridge adds truthful cross-format reuse; no persisted value changes)                                                                                                                   |
| Security/permission impact           | none                                                                                                                                                                                                |
| Visual UI impact                     | failure-path truthfulness + accessibility only (owner-authorized): reachable not-found surfaces, actual read-error messages + retry, alert roles, tone-correct announcements — no CSS/layout change |
| Deployment state                     | not deployed by this PR; no provider action taken                                                                                                                                                   |
| Rollback method                      | revert the merge commit (no data migration); per-fix boundaries in §3                                                                                                                               |
| Status                               | **NOT EXECUTED — no merge performed; no `main` writes; no cleanup performed**                                                                                                                       |

## 11. Final Status

```text
R9_SYSTEMIC_REMEDIATION_COMPLETE — PR_READY
NO_MERGE_PERFORMED
NO_MAIN_CHANGES_PERFORMED
NO_TOKEN_EXPOSURE
NO_REPOSITORY_CLEANUP_PERFORMED
NO_ADDITIONAL_WRITES_AFTER_FINAL_REPORT
NO_REPOSITORY_WRITES_AFTER_FINAL_REPORT
```

All in-scope defects (F3.6-ERROR-ROLE-INVENTORY a–d, F3.7, G5.1, G5.2, F7.1, F8) are closed with root-cause changes, negative proofs, and regression evidence; the standing limitations are the recorded CI-harness trigger and the jsdom-proven read-error surfaces — neither is an open defect; the full canonical checks pass on the final tree; the final-head CI/Cloudflare results are pinned in the PR body; the documentation and tracker agree with the final head.
