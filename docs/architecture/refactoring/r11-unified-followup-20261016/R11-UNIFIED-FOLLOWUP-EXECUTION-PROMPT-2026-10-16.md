# Z AI — Micro R11 Unified Follow-up Remediation
## ARCH-012-NF-001/NF-002 + W2b + D-12/F-040 + Tracker Reconciliation

**Date:** 2026-10-16
**Repository:** `https://github.com/Qays7753/Micro`
**Execution mode:** controlled remediation on one dedicated branch and one PR
**Executor:** Z AI only
**Owner:** Qays7753

---

## 1. Mission

Continue Micro's verified `main` state with one controlled implementation contract. Execute the owner-approved root fixes and documentation closure below, in order, on a dedicated feature branch and one PR. Keep `main` untouched. Do not merge, delete branches, close unrelated PRs, clean up repository history, or deploy production.

The approved scope is:

1. **ARCH-012-NF-001** — fix the Setup draft lifecycle race/root cause.
2. **ARCH-012-NF-002** — fix the FinancialEventEditor draft restore/autosave lifecycle race/root cause.
3. **W2b / ARCH-013** — activate strict rejection of unknown top-level `data` keys for the current `(Schema 38, Export 30)` pair only, with the exact owner-approved payload below.
4. **D-12 / F-040** — close the documented source-of-truth gap around the Micro Standard with evidence, without inventing a parallel authority.
5. Reconcile the canonical Tracker and append-only records for every item the owner explicitly chose to keep future-gated or outside this implementation.
6. Run the complete verification contract, five sequential read-only reviews, and deliver one PR-ready report.

This is a root-fix task. Micro has no production users or authoritative production data, but that fact is not by itself evidence for deletion or semantic change. Every deletion or behavior change still requires a live consumer/corpus/contract census and the acceptance evidence below.

---

## 2. Live baseline — verify, do not trust this prompt blindly

The last observed `origin/main` was approximately `cb3b9aa` on 2026-10-16. Treat that only as a hint. Before any write:

1. Fetch the repository and verify the live `origin/main` full SHA through Git and GitHub API.
2. Inspect open PRs, branches, worktree status, active Operations Control claims, and the last relevant reports.
3. Read `AGENTS.md` in full.
4. Read the current canonical records, not stale local copies:
   - `docs/operations/current-state.md`
   - `docs/operations/current-state-log.md`
   - `docs/architecture/refactoring/AGENT-SEQUENTIAL-WORKLOG.md`
   - `docs/operations/control/items/ARCH-011.json`
   - `docs/operations/control/items/ARCH-012.json`
   - `docs/operations/control/items/ARCH-013.json`
   - `docs/operations/control/items/REM-004.json`
   - `docs/operations/control/items/GOV-001.json`
   - the R11 reports under `docs/architecture/refactoring/r11-*`
   - the current `docs/00-document-index.md`
5. Verify that the execution branch is based on the live `origin/main` and that no other writer is actively changing the same branch.

If the live baseline, branch, PR, or claim state differs materially, do not reset or overwrite work. Preserve existing work, record `STATE_DRIFT`, and resume safely only after reconciling the actual state.

---

## 3. Owner-approved decisions and exact boundaries

### 3.1 ARCH-012-NF-001 and ARCH-012-NF-002

These are **not** the already-closed legacy migration deletion. The legacy migration removal (Outcome A) is already merged and must remain closed. The two remaining findings are separate behavioral findings discovered by the ARCH-012 census:

- **ARCH-012-NF-001:** the Setup opening lifecycle can clear or overwrite the current form-draft state before the user has completed the explicit restore/discard decision. Closing the page or interrupting the flow can lose the draft during that window.
- **ARCH-012-NF-002:** the FinancialEventEditor restore lifecycle can interact with dirty-state/autosave effects so that the draft is cleared and then re-saved, or an early close can lose the draft before restoration is settled.

Owner decision: fix both now, as a dedicated behavioral remediation slice. Do not reintroduce the retired legacy adapter. Do not add direct `localStorage` access. Preserve the unified `FormDraftService` boundary, IndexedDB/Memory parity, current draft size/atomicity contracts, and the existing explicit user decision semantics.

### 3.2 W2b exact payload and behavior

The owner has now authorized full closure of W2b. Use this exact payload; do not invent a second code or wording:

- **Result code:** existing `validation_error` (`VALIDATION_ERROR` constant where the codebase uses the constant).
- **Exact Arabic message:**

  `تعذّر استيراد الملف لأنه يحتوي على أقسام بيانات غير معروفة لهذا الإصدار. بقيت بيانات هذا الجهاز دون تغيير.`

Behavioral scope:

- Reject unknown top-level keys inside `data` only for the current pair `(schemaVersion = 38, version/export = 30)`.
- Derive the allowed family-key set from the existing 31-family registry and include any non-family keys demonstrably emitted by the exporter.
- Preserve the existing seven-step rejection precedence and all existing first-failure behavior. Place the new check only where the W2a characterization proves it cannot reorder existing failures.
- Keep all 24 legacy pairs accepted exactly as before.
- Keep current goldens, MANIFEST, exporter output, backup-first behavior, `PreparedImport`, `confirmImport`, storage atomicity, and no-write-on-rejection behavior unchanged.
- Do not echo unknown key names in the error message.
- Do not add count fields, alter `Schema 38`, alter `Export 30`, or change any wire format.
- Do not change unknown nested keys inside family records unless a pre-existing validator already owns that behavior; this slice is only the specified top-level `data` boundary.

Before implementing W2b, verify that the exact payload is recorded in an append-only owner-decision/evidence addendum. If the repository's current result-code constant name differs, reuse the existing canonical validation code rather than creating a parallel error-code family, and record the mapping explicitly.

### 3.3 D-12 / F-040

Close D-12/F-040 completely as a source-of-truth and evidence item:

- Inspect the repository's actual Micro Standard references, source-of-truth records, glossary/contracts, document index, and existing D-12/F-040 evidence.
- Identify the authoritative Micro Standard source, revision/commit or exact repository path, scope, owner, and how it relates to Micro runtime/domain/storage/financial authority.
- Remove ambiguity and stale contradictory wording through a dated append-only correction or a precise current-state correction, without rewriting protected history.
- Ensure the document index and Operations Control point to one authority and do not create a second Standard or second source of truth.
- If the evidence proves that D-12 is documentation-only, close F-040 as documentation/evidence closure with exact evidence. If it proves a code or contract change is required, do not hide that change inside this slice: record a new precise finding and stop that sub-scope with `OWNER_DECISION_REQUIRED` rather than changing financial, historical, schema, export/import, or UI semantics silently.

Do not read, import, or implement the separate **New Design** material. New Design is a separate workstream and must not appear in this PR or in the R11 Core execution report.

### 3.4 Explicitly recorded future-gated or out-of-scope decisions

The following are not to be implemented in this PR. Record each one precisely in the canonical source record and append-only evidence with its trigger, owner, reason, next action, and safe stopping state:

- **D-13 / F-055:** remain future-gated in the Tracker. Do not add `calculationVersion`; do not change historical semantics; do not rewrite history. Reopen only after the explicitly required threshold, semantic decision, and legacy-reader plan are approved.
- **QR-5 / F-060:** remain future-gated in the Tracker. Do not implement loan-interest semantics, and do not assume interest is zero.
- **F-043 / structural gate:** record it in the Tracker as a structural-gate item. Do not perform structural refactoring, bulk moves, module reorganization, or code-organization changes here. Any future structural work must first pass the mandatory read-only comprehensive Structure/Architecture/Code Organization Scan, owner review, accepted findings, and controlled remediation waves.
- **GOV-001:** record the G10-A versus Contract C1 conflict as an explicit owner-review item. Do not silently unify, rewrite, or choose between the contracts.
- **DEFERRED_UI:** keep the UI-only items explicitly tracked as deferred/future scope. No visual redesign, CSS/token/layout/navigation/copy change is allowed in this PR.
- **W5 / MoneyMinor branding:** keep `W5_CLOSED_BY_POLICY — NO_TRIGGER_PROVEN`. Do not brand `MoneyMinor`, change persisted representation, or open W5 without a proven trigger.
- Preserve all five protected storage/transfer surfaces (`P-01` through `P-05`) as evidence-only where applicable. Do not split, move, or change transaction boundaries, rejection precedence, the 130-method contract, Schema 38, Export 30, Legacy, Goldens, or MANIFEST.

No generic `DEFER` is acceptable. Every non-implemented item must have a durable ID, exact classification, evidence, trigger or reason, owner, next action, and rollback/safe stopping boundary.

---

## 4. Write boundary and branch/PR policy

- Use one dedicated feature branch created from the verified live `origin/main`; suggested name: `remediation/r11-nf001-nf002-w2b-d12-20261016`.
- Use one PR for this unified follow-up.
- Never write directly to `main`.
- Never force-push.
- Do not merge this PR.
- Do not delete branches or close PRs.
- Do not clean up unrelated documentation branches, old prompts, historical reports, or generated artifacts.
- Do not modify or delete secrets, settings, branch protection, billing, deployments, or external accounts.
- Keep commits coherent and separately revertible. Minimum recommended commit boundaries:
  1. baseline/owner-payload and tracker evidence addendum;
  2. ARCH-012-NF-001 Setup lifecycle root fix;
  3. ARCH-012-NF-002 FinancialEventEditor lifecycle root fix;
  4. W2b current-pair behavior flip;
  5. D-12/F-040 evidence closure and generated records;
  6. final reconciliation, reviews, and PR-ready report.
- If a phase needs a different boundary because the live code proves it safer, document why before writing and keep rollback explicit.

---

## 5. Required execution phases

### Phase 0 — inventory and evidence freeze

Read-only first. Produce a short baseline entry in the canonical execution report with:

- live main SHA, branch, PR, and base SHA;
- exact files and current statuses for ARCH-011/012/013, D-12/F-040, D-13/F-055, QR-5/F-060, F-043, GOV-001, and DEFERRED_UI;
- current draft-service call graph and storage boundaries;
- current W2a allowed-key derivation, rejection order, and exporter output;
- current source-of-truth/Standard references;
- active claims and writer ownership.

Do not edit application code before this inventory is recorded.

### Phase 1 — ARCH-012-NF-001 Setup draft lifecycle

1. Reproduce the finding against the live current code with a focused failing test or characterization.
2. Trace the complete lifecycle: initial read, loading/settling, restore banner, accept, discard, close/unmount, dirty state, save, clear, and failure paths.
3. Implement the smallest root fix that makes the lifecycle explicit and race-safe. The current draft must not be cleared merely because the page mounted or because a restore decision is still pending. A close before a decision must not silently discard the draft.
4. Preserve existing user-visible copy and visual behavior. This is a correctness/lifecycle change, not a UI redesign.
5. Add positive, negative, interruption, repeated-mount, failure, and no-write-before-decision tests.
6. Test both the real service boundary and the page-level behavior. Do not test only a mocked hook.
7. Update the relevant contract/evidence and Operations Control source only after the code and tests prove the behavior.

Acceptance:

- A draft remains available until explicit accept/discard or the existing documented successful-save path.
- Mounting, rendering, focus, or a read failure cannot silently clear it.
- Discard clears exactly once and only after the explicit discard action.
- Accepted restoration cannot be overwritten by an early autosave race.
- Existing current-draft service behavior, size limit, atomicity, IndexedDB/Memory parity, and failure behavior remain green.

### Phase 2 — ARCH-012-NF-002 FinancialEventEditor draft lifecycle

1. Reproduce the restore/autosave race with a focused failing test or characterization.
2. Trace restoration, hydration, dirty tracking, autosave scheduling, close/unmount, save success/failure, and discard.
3. Implement an explicit restoration/hydration state boundary so autosave cannot treat restoration itself as a user edit. Autosave may resume only after restoration has settled and a real user mutation occurs.
4. Ensure close/unmount during restoration does not destroy the only draft copy.
5. Preserve existing explicit restore/discard semantics, current copy, financial calculations, historical data, and storage contracts.
6. Add tests for early close, repeated restore, real edit after restore, save failure, discard, reload, and no spurious write/clear.

Acceptance:

- Restoration is not misclassified as a dirty user edit.
- No clear-then-resave race can lose the draft during the restoration window.
- An actual edit after restoration is saved through the existing canonical service.
- Save failure preserves the draft and reports the existing failure path honestly.
- No financial result, schema, export/import, or UI visual semantics change.

### Phase 3 — W2b current-pair unknown top-level data-key rejection

1. Re-run the W2a corpus and confirm the exact allowed set and seven-step precedence before changing production behavior.
2. Add tests first for:
   - one unknown top-level `data` key on Current 38/30;
   - multiple unknown top-level keys without key-name echo;
   - unknown key with another earlier fault to prove precedence is unchanged;
   - every valid exporter-produced non-family key;
   - each 24 Legacy pair remains accepted;
   - all Current/Golden/MANIFEST fixtures remain accepted;
   - rejection causes zero writes and leaves the device unchanged;
   - IndexedDB and Memory parity;
   - round-trip/export output remains byte-identical where already required.
3. Implement the exact payload from §3.2 and only the approved current-pair gate.
4. Update the W2b report, ARCH-013 source record, owner decision addendum, and current-state evidence with before/after behavior and rollback boundary.
5. Never alter the existing validator order except for the proven insertion point.

Acceptance:

- Current 38/30 unknown top-level `data` keys are rejected with exactly `validation_error` and the exact Arabic message from §3.2.
- Legacy pairs and valid current files remain accepted.
- No key name is echoed.
- No data is written on rejection.
- Existing seven precedence outcomes are unchanged.
- Schema 38, Export 30, Goldens, MANIFEST, and backup-first behavior are unchanged.

### Phase 4 — D-12/F-040 source-of-truth closure

1. Perform a bounded repository census of all Micro Standard references and their consumers.
2. Select one authoritative reference based on evidence, not preference.
3. Add a dated append-only closure/addendum with exact path/revision/SHA/scope/owner and the authority ladder.
4. Correct only live stale claims that would mislead future agents; preserve historical reports and old measurements.
5. Update the canonical Operations Control JSON source first, then regenerate all generated views using the repository generator. Never hand-edit generated CSV/XLSX/Markdown views.
6. Add the document-index row if a new authoritative evidence document is created.

Acceptance:

- F-040 is either `VERIFIED` with direct evidence or explicitly `BLOCKED/OWNER_DECISION_REQUIRED` with the exact missing authority; never falsely claim closure.
- No second Micro Standard or parallel source of truth exists.
- No New Design document, Drive material, CSS, UI, financial, schema, export/import, or historical semantics is changed.

### Phase 5 — Tracker and records reconciliation

Update source records first, then regenerate and validate:

```bash
python3 scripts/operations-control/generate_tracker.py
python3 scripts/operations-control/generate_tracker.py --check
python3 scripts/operations-control/validate.py
node scripts/check-doc-index-coverage.mjs
node scripts/check-current-state-size.mjs
git diff --check
```

Required record behavior:

- ARCH-012 becomes accurate about NF-001/NF-002 being fixed in this wave, while preserving the already-merged Outcome A history.
- ARCH-013 records W2b behavior completion and the exact payload.
- D-12/F-040 receives the evidence closure or a precise evidence blocker.
- D-13/F-055, QR-5/F-060, F-043, GOV-001, and DEFERRED_UI remain explicit, durable future-gated records with no generic defer.
- Append to `current-state-log.md` and `AGENT-SEQUENTIAL-WORKLOG.md`; do not rewrite history.
- `current-state.md` must contain only concise live state and remain within its guard.
- Do not manually edit generated views.

---

## 6. Five sequential read-only reviewers

After implementation and before the final report, run exactly five sequential read-only reviewers. One writer only: the primary executor. Reviewers must not edit, commit, push, merge, delete, or clean up.

1. **RV1 — draft/storage lifecycle:** inspect NF-001/NF-002 root cause, race safety, service boundary, IndexedDB/Memory parity, and no destructive clear.
2. **RV2 — Transfer/data integrity:** inspect W2b exact payload, current-pair boundary, legacy/golden/MANIFEST compatibility, precedence, no-write-on-rejection, and PreparedImport.
3. **RV3 — contracts/semantic/security:** inspect Schema 38/Export 30, financial/historical/rejection semantics, source-of-truth closure, and secret handling.
4. **RV4 — tests/CI/build/operability:** inspect focused tests, full gates, lint/bundle ceilings, generated views, mutation/negative tests, and exact-head CI evidence.
5. **RV5 — documentation/Tracker/owner decisions:** inspect append-only history, record classifications, D-12/F-040 evidence, all future-gated items, index coverage, and stale claims.

Then run one synthesizer/reconciliation step. If any reviewer finds a real issue, fix it in a new coherent commit, rerun the affected checks, and re-run the affected reviewer. Do not hide disagreements.

---

## 7. Mandatory verification contract

Run the focused tests after each implementation phase and the complete gate on the final code head. At minimum include the repository's canonical commands and all relevant focused suites:

```bash
pnpm check
python3 scripts/operations-control/generate_tracker.py --check
python3 scripts/operations-control/validate.py
node scripts/check-doc-index-coverage.mjs
node scripts/check-current-state-size.mjs
git diff --check
```

Also run and record the exact commands for:

- Setup draft lifecycle tests;
- FinancialEventEditor guided/draft lifecycle tests;
- FormDraftService tests;
- ARCH-012 storage guard and negative tests;
- W2b/transfer top-level-key characterization and behavior tests;
- all transfer corpus/golden/legacy/Memory/IndexedDB suites;
- source-of-truth/D-12/F-040 documentation tests;
- security/secret scan and relevant guards;
- prototype build and bundle budgets.

Required ceilings and invariants:

- raw bundle `<= 650000`;
- gzip bundle `<= 155300`;
- lint count must not be raised or hidden;
- no guard measurement, baseline, threshold, or normalization may be weakened to make a test pass;
- no lottery re-pushes to obtain a green gzip result;
- no generated view may be hand-edited;
- every new finding must have a durable ID and classification.

If a check fails, diagnose and root-fix it. Do not silence it, raise a ceiling, add a broad exception, or mark it green without evidence.

---

## 8. Security and credentials

Use the secure credential field only:

```text
GITHUB_ACCESS_TOKEN=<SECURE_SECRET_FIELD_ONLY>
```

Never request, print, paste, store, commit, or include any real token, token prefix, cookie, authorization header, or private environment value in chat, files, commands, logs, screenshots, PR comments, or reports. Use the secure credential to fetch, create/update the branch and PR, push commits, and publish checkpoint comments. Report only redacted status such as `valid`, `401`, `403`, or `permission missing`.

---

## 9. Required PR/report output

Keep the PR open and unmerged. Add concise checkpoint comments after each coherent wave with:

- full commit SHA;
- scope and files changed;
- tests and exit codes;
- CI/Cloudflare status for the exact head when available;
- known limitations and next wave;
- no secrets.

Create or update one canonical execution report under the appropriate `docs/architecture/refactoring/r11-*` evidence directory. It must include:

1. live baseline and state-drift check;
2. exact owner-approved scope and non-goals;
3. ARCH-012-NF-001 root cause, fix, evidence, tests, and rollback;
4. ARCH-012-NF-002 root cause, fix, evidence, tests, and rollback;
5. W2b exact payload, allowed-set derivation, precedence proof, compatibility matrix, and no-write proof;
6. D-12/F-040 authority and evidence closure;
7. Tracker disposition table for every included, preserved, future-gated, and out-of-scope item;
8. complete changed-file and commit manifest;
9. tests, CI, Cloudflare, and build evidence separated by exact SHA;
10. five reviewer records and synthesizer reconciliation;
11. limitations, unverified items, rollback boundaries, and safe stopping state;
12. explicit statement of what was not changed.

Use evidence labels `VERIFIED`, `INFERRED`, `UNVERIFIED`, `NOT_EXECUTED`, `DEFERRED`, and `BLOCKER` honestly. Never promote an inference or a green unrelated check to VERIFIED.

The final report must end with exactly the applicable status block:

```text
R11_UNIFIED_FOLLOWUP_COMPLETE — PR_READY
ARCH012_NF001_NF002_FIXED
W2B_BEHAVIOR_COMPLETE — CURRENT_38_30_ONLY
D12_F040_CLOSED_WITH_EVIDENCE
TRACKER_DISPOSITIONS_RECONCILED
NO_MERGE_PERFORMED
NO_CLEANUP_PERFORMED
NO_SECRETS_EXPOSED
```

If a genuine blocker remains:

```text
R11_UNIFIED_FOLLOWUP_BLOCKED — <exact blocker>
OWNER_DECISION_REQUIRED — <exact decision, if any>
NO_MERGE_PERFORMED
NO_CLEANUP_PERFORMED
NO_SECRETS_EXPOSED
```

Do not stop for routine questions. Inspect, implement, test, review, document, push, and report continuously within this exact boundary. Stop only for state drift, missing authorization, a protected semantic decision not covered above, a security/permission failure, or a check that cannot be made truthful without violating the invariants.
