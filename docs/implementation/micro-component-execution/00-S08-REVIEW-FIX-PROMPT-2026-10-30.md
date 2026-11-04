# Z AI — S08 Review Corrections Only: Asset Party Integrity and Transfer Round-Trip

## Mission and authority

Correct exactly two confirmed S08 review findings on the existing Micro integration branch and PR. Do not reimplement S08, expand UNIT-034, or begin S09.

The authorized scope is limited to:

1. validate saved acquisition-party references against the imported snapshot's saved-party family; and
2. add permanent end-to-end transfer/restore regression evidence for the S08 asset fields `acquisitionParty` and `paidAtCreationMinor`, then correct the result report's evidence claim.

The delivered S08 implementation, five prior read-only review passes, and exact-head green remote gates are evidence to preserve, not a reason to skip these confirmed gaps. Do not claim S08 is accepted. Deliver the correction for independent review and owner acceptance.

Do not wait for an intermediate reviewer or owner message. Complete this focused correction, its tests, records, reviewers, and exact-head remote gates in one continuous execution. Stop only for a genuine unresolved contract/data-integrity conflict, unavailable secure credentials, unsafe local/remote state, or a gate that cannot be repaired without changing an approved contract.

## Repository boundary and safe continuation

- Repository: `https://github.com/Qays7753/Micro`
- Only allowed branch: `components/integration-20261027`
- Only allowed PR: `https://github.com/Qays7753/Micro/pull/383` — keep Draft
- Base: `main`
- Last verified integration head when this prompt was prepared: `81fda9534cd80111fe290ddf4ce4b33b1cb223c3`
- Last verified `main`: `3584aa1d08cea3e0a00623b719fed7f991ce187f`
- Existing S08 result: `docs/implementation/micro-component-execution/13-S08-RESULT-2026-10-30.md`
- Existing S08 Control: DOC-017 / WS-233; discover and verify the live JSON records rather than guessing paths or changing identifiers.

Verify every reference live before acting. If the branch advanced safely, continue from the actual live head. First inspect the local branch, worktree, unpushed commits, uncommitted files, reflog/stashes, and active writers. Preserve all local work. Do not use reset, clean, rebase, force-push, overwrite, or checkout-overwrite. If unknown or unrelated local work exists, preserve it and do not mix it into this correction. If safe ancestry cannot be established, stop with `STATE_DRIFT` and report the exact checkpoint.

Write only commits to the existing integration branch and updates to PR #383. Do not write `main`, merge, rebase, force-push, delete branches, clean branches, close the PR, or create another branch or PR. Do not rewrite any earlier accepted or delivered history. Use only secure credential channels; never print, request, store in a repository artifact, comment, or report tokens or private credentials.

## Confirmed findings

### S08-MR-001 — saved asset acquisition party can be orphaned in an imported snapshot

**Evidence on the delivered S08 candidate:**

- `apps/prototype-web/client/src/application/transfers/transferFamilyValidators.ts` validates the shape of `asset.acquisitionParty` (`partyId`, `labelSnapshot`) and treats the field as optional.
- `apps/prototype-web/client/src/application/transfers/transferSnapshotValidation.ts` builds the saved-party ID set from `data.counterparties` and uses it for direct-sale and supplier-purchase references, but the asset loop does not require a non-null `asset.acquisitionParty.partyId` to resolve within that same saved-party family.
- `AssetService.create` correctly resolves a selected acquisition party against saved parties before writing, but import is a separate trust boundary. A crafted file can therefore contain a shape-valid asset pointing to an absent party ID and pass the current cross-family validation.

**Impact:** The restored asset claims a saved stable identity that is not present in the restored data. A historical label snapshot is display history and cannot repair or replace a missing stable reference. This breaks referential integrity and is inconsistent with the S05 party-reference protections.

**Required root fix:**

1. Add the cross-family check at the canonical snapshot-validation boundary: when `acquisitionParty` is non-null, its stable `partyId` must resolve to an entry in that same snapshot's `counterparties` family.
2. Keep `null`/absence valid where the asset contract permits an optional party. Do not synthesize a party from `labelSnapshot`, name, phone, or other text. Do not merge by name.
3. A saved party may be archived and still be a valid historical reference if it is included in the snapshot and passes the existing party-record validator. Do not add an active-only rule unless the canonical contract requires it.
4. The broken reference must be rejected by `prepareImport` before preview and by `prepareRestore` before any target write. Preserve rejection precedence and the existing S05 direct-sale/supplier-purchase reference checks.
5. Keep the fix in the existing transfer/snapshot validation layer. Do not add a second validator or a parallel source of truth.

### S08-MR-002 — new durable asset fields lack permanent end-to-end export/restore round-trip tests

**Evidence on the delivered S08 candidate:**

- S08 introduced `acquisitionParty` and `paidAtCreationMinor` on the asset record.
- `transferFamilyValidators.ts` accepts their shape and `transferSnapshotMigrations.ts` normalizes absence to `null`.
- The S08 tests cover asset creation and the resulting values, but do not assert these new fields across `createVerifiedExport → prepareImport → prepareRestore → confirmImport → re-export`.
- The changed `transferCounters.migrations.characterization.test.ts` only verifies normalization of absent fields; it is not a round-trip or an assertion that valid values survive export and restore.
- Existing residual/note asset round-trip tests prove those older fields only; they do not cover these S08 fields.
- The S08 result currently classifies the full transfer cycle for these new fields as implemented based on validator/migration characterization alone. Correct the report so its claim matches the new permanent evidence.

**Required permanent regression evidence:**

1. Add a real end-to-end test using the actual `LocalTransferService` flow. Create an asset through the real application service with a valid saved party and partial payment, then:
   - call `createVerifiedExport`;
   - pass that exact export through `prepareImport`;
   - pass it through `prepareRestore` on a clean target store;
   - call `confirmImport`;
   - re-export from the target;
   - assert deep equality of the asset identity, `acquisitionParty.partyId`, historical `labelSnapshot`, `paidAtCreationMinor`, acquisition/event references, dates, and relevant financial events, with no replayed cash or asset effects.
2. Exercise both Memory and IndexedDB paths where the existing transfer-test infrastructure supports them. If transfer preparation is adapter-independent, document that fact and test persistence/application through both adapters rather than duplicating pure parsing tests.
3. Add a legacy-compatibility case for an asset with both fields absent: current supported schema/export pair remains `40/32`; the migration yields the documented `null` values without inventing identity or payment; the asset and its original acquisition meaning remain readable.
4. Add malformed cases for at least a dangling saved-party ID and invalid `paidAtCreationMinor` (zero, negative/unsafe, or not strictly less than the acquisition amount according to the live contract). Prove rejection occurs before preview/target writes and target data remains byte-for-byte or semantically unchanged according to the established test helper.
5. Include a valid archived saved-party reference if the test fixtures can create one, proving the historical reference is preserved without allowing name-based reconstruction.
6. Map each test to stable finding/acceptance IDs in the result report. Do not count a migration-shape test or validator unit test as a round-trip.

Do not change the approved partial-payment financial semantics, acquisition event types, rejection precedence, schema/export wire keys, or accepted version pair. Do not bump schema/export versions for these corrections. If the correct fix truly requires a wire-format/version change or a business-policy change, stop with the exact evidence and ask for owner direction rather than guessing.

## Required implementation and evidence sequence

1. Verify the live branch, PR, base, exact head, ancestry, worktree, and secure credential channel. Preserve any existing local work.
2. Read the canonical S08 prompt, S08 result, current DOC-017/WS-233 JSON, UNIT-034 sections on saved party identity and transfer, UNIT-037 saved-party identity/import rules, and the current transfer validator/migration/tests. Keep reading limited to those authoritative sections and the current affected code.
3. Update the existing S08 Control records through their legal state lifecycle to reopen these two findings for correction. Do not create a new S08 Control Item or Workstream. Record stable IDs, evidence, impact, classification `FIX_NOW`, and rollback boundary.
4. Add failing focused characterization/regression tests for both findings before or alongside the smallest root fix.
5. Implement the referential-integrity check at the canonical transfer boundary and the permanent end-to-end round-trip tests. Keep changes within the two findings.
6. Run the focused transfer suites and affected party-reference/asset tests. Record exact command, adapter(s), counts, exit code, environment, and tested SHA.
7. Run the repository's canonical `pnpm check` once on the stable corrected worktree if it has not already been run on this exact code state. Do not reuse the prior S08 check as evidence for the new code. Do not weaken guards, raise limits, add `.skip`/`.only`, or alter CI policy.
8. Update `13-S08-RESULT-2026-10-30.md` so it:
   - records S08-MR-001 and S08-MR-002, exact root corrections and commits;
   - replaces the inaccurate transfer-cycle claim with the exact new test evidence;
   - states `REVIEW_REQUIRED`, not accepted;
   - distinguishes code candidate, tested SHA, documentation head, GitHub CI SHA, Cloudflare deployment SHA, and owner acceptance;
   - records that 40/32 and the wire format did not change.
9. Update DOC-017/WS-233 JSON sources, progress/handoff, current-state, append-only worklog, doc index/Manifest, and generated views only as required by repository contracts. Update JSON first and use the official generators; never edit generated views manually. Respect the current-state size guard.
10. Run focused read-only review passes sequentially on the corrected diff only, reusing the existing S08 review roster and limiting reads to directly affected evidence:
    - R1: source ownership/layer placement of the new cross-family invariant;
    - R2: party identity, validator behavior, import/restore rejection and unchanged wire semantics;
    - R3: verify no UI behavior/financial meaning changed and that archived/null cases are represented honestly;
    - R4: tests, target-store non-write proof, security, exact-head local/remote checks;
    - R5: result/Control/Tracker claim accuracy and provenance.
    Do not rerun whole prior reviews or their tests; each pass reads the changed diff and the minimum relevant caller/test. Fix any newly confirmed in-scope issue and have the relevant reviewer reread it.
11. Push normally to the same branch and verify GitHub Actions and Cloudflare Pages on the exact final pushed head. If a remote gate fails, repair the cause and repeat; do not re-anchor a baseline without direct measurements and the repository's documented same-PR provenance.
12. Finish with S08 still `REVIEW_REQUIRED`; do not start S09.

## Commits and rollback boundary

Use separate phase-labelled commits for:

- the two S08 transfer-integrity regression tests and root validator correction; and
- corrected S08 result/Control/Tracker evidence.

Do not mix unrelated cleanup, broad refactoring, or code changes outside these two findings. No bulk file moves or new architecture layers are authorized. The safe rollback boundary is the last live S08 delivery head before these review corrections; preserve all prior S07/S08 commits and history. Since the correction must remain schema/export-compatible, rollback is code-history only and must not lower versions or rewrite exported data.

## Final delivery contract

When complete, report:

- starting live head and final full head SHA;
- each finding, root correction, changed files, commits, and acceptance tests;
- exact focused/full local check evidence and SHA;
- exact CI and Cloudflare evidence for the final head;
- reviewer re-read results;
- schema/export pair and wire-format impact (`40/32`, unchanged, if verified);
- current DOC-017/WS-233 status and next action;
- confirmation that the PR remains Draft and there was no `main` write, merge, rebase, force-push, branch cleanup, second branch, or second PR.

End the response with exactly one truthful block:

```text
S08_REVIEW_FIXES_DELIVERED — S08-MR-001,S08-MR-002 — REVIEW_REQUIRED
PR_READY_FOR_INDEPENDENT_REVIEW — <FULL_FINAL_HEAD_SHA>
S08_NEXT_ACTION — MANUS_INDEPENDENT_REVIEW_AND_OWNER_ACCEPTANCE
NO_MAIN_WRITES_PERFORMED
NO_MERGE_PERFORMED
NO_REBASE_PERFORMED
NO_FORCE_PUSH_PERFORMED
NO_BRANCH_CLEANUP_PERFORMED
NO_SECOND_BRANCH_OR_PR_CREATED
NO_REPOSITORY_WRITES_OUTSIDE_ALLOWED_BRANCH
```

If a genuine blocker prevents completion, preserve a safe checkpoint and end with:

```text
EXECUTION_BLOCKED — <EXACT_BLOCKER_ID_AND_REASON>
S08_REVIEW_FIXES — <COMPLETE_PARTIAL_OR_NOT_STARTED>
SAFE_CHECKPOINT — <FULL_SHA>
NEXT_ACTION — <EXACT_RESUME_ACTION>
NO_MAIN_WRITES_PERFORMED
NO_MERGE_PERFORMED
NO_REBASE_PERFORMED
NO_FORCE_PUSH_PERFORMED
NO_BRANCH_CLEANUP_PERFORMED
NO_SECOND_BRANCH_OR_PR_CREATED
NO_REPOSITORY_WRITES_OUTSIDE_ALLOWED_BRANCH
```
