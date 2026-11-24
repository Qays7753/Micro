# Z AI — Micro Passwordless Local Data Protection and Import-Device Remediation

**Status:** Owner-authorized execution prompt, prepared 2026-11-24. This is a narrow successor to the completed follow-up at `docs/expansion/handoffs/zai-micro-prototype-readiness-2026-11-23/FOLLOW-UP-REMEDIATION-PROMPT-EN.md` (catalog 12Y), only for `MNG-LOCAL-03` and `MNG-LOCAL-06`. It supersedes that prompt's prior owner deferral of `MNG-LOCAL-03`; the old report remains an accurate historical record of the prior decision and work.

## 1. Mission and owner authorization

Remediate the two remaining local-data findings and close each only when its own acceptance evidence exists. Work on the dedicated branch `manus/mng-local-03-06-remediation-20261124`, created from `main` at `a370557a4dfe7b11f8c6c0c091ba3ccc2a338539`. These SHAs are preflight hints; verify live state before acting.

The owner's current decisions are explicit:

- Do **not** require the user to type a Micro password, PIN, passphrase, or recovery code to unlock data or download a backup.
- Device-native confirmation, such as a platform passkey, biometric prompt, or OS device-authentication prompt, is allowed when needed.
- A backup download should remain a simple user action, but its contents must be encrypted automatically. Never silently fall back to a readable plaintext export.
- For `MNG-LOCAL-06`, use **60 seconds or less** for validation plus write at the supported-device limit as the proposed acceptance threshold, with no browser crash, forced tab termination, or unusable freeze. Report the three-run median and the individual runs.
- The product is currently an experiment; this does not waive data-loss, confidentiality, repository, architecture, or evidence requirements. Use synthetic data only for tests and measurement.

This authorization permits the bounded code remediation and commits/pushes to the named branch after focused verification. It does **not** authorize a PR, merge, direct `main` change, deployment, Cloudflare/Neon/R2 change, Pages Preview, database access/migration, use of real partner data, branch deletion, force-push, or history rewrite.

Use one primary implementation agent. A single independent read-only security review of the exact final SHA is permitted if Z AI supports it; no parallel writers or broad agent fan-out. Provide brief Arabic progress updates at meaningful milestones; these are informational and must not pause work or request routine approval.

## 2. Live-state preflight and resume behavior

Before changing code:

1. Verify repository `Qays7753/Micro`, the current branch, full `HEAD`, `origin/main`, worktree/untracked files, stashes, running processes, open PRs, relevant Actions state, and Operations Control claims.
2. Confirm the prompt exists on the named branch and preserve it. The previous source branch for PR #388 is merged; do not reuse it as the implementation branch.
3. Read the current `DOC-044`/`WS-254` records. They were `IN_REVIEW` under the old owner decision. The owner has now authorized resuming `MNG-LOCAL-03`; legally reopen/continue that item and workstream if Operations Control permits. Otherwise create one properly linked successor claim with no overlapping active `areas`/`contracts`. Edit the canonical JSON source only, then run the canonical generator/validator; never hand-edit generated views. Do not begin code until the claim is legal and non-conflicting.
4. If the branch, claims, PRs, or tree materially differ from these hints, preserve everything and report `STATE_DRIFT`; do not reset, clean, overwrite, force-push, or rebase away work. Continue only if the difference is safe and unambiguous.
5. If this task was interrupted or partially completed, inspect actual commits, diffs, tests, reports, and processes first. If it is already complete, verify the exact evidence and report completion with a detailed summary; otherwise continue from the first incomplete action only. Never repeat completed work or start a duplicate process.

## 3. Required sources and finding baseline

Read the current versions on the implementation branch, using `AGENTS.md` §2 CORE+STORAGE routing and its file-count/size limit:

- `AGENTS.md`, `docs/operations/current-state.md`, `README.md`, `docs/00-document-index.md`, and the relevant CORE+STORAGE sources.
- `docs/contracts/04-limited-sync-contract.md`, `docs/quality/security-boundaries.md`, and `ai-skills/micro-local-first-prototype/SKILL.md`.
- `docs/expansion/security-findings-status.md` and the two prior reports/prompts cited above.
- The source-pinned audit `Micro — تقرير التدقيق الأمني 2026-11-19.md` from the authorized project files if it is accessible. If it is not accessible, state that limitation and use the exact finding baseline below plus the repository mirror; do not browse external links or claim to have read the unavailable source.
- Inspect the current code and tests corresponding to the report paths, including as they exist on the live branch: `storage/local/indexedDbStores.ts`, `indexedDbLifecycle.ts`, `application/security/localLockService.ts`, `components/security/AppLockGate.tsx`, `PrototypeServicesContext.tsx`, `SettingsDataProtectionSection.tsx`, `pages/Settings.tsx`, `application/transfers/localTransferService.ts`, `guidedOpeningImportService.ts`, and `transferResourceLimits.ts`. Verify actual paths before relying on line numbers.

The source-pinned finding baselines are:

- **`MNG-LOCAL-03`:** records are persisted in IndexedDB without application-level encryption, and exported JSON is plaintext. This relies on the browser profile/OS and does not protect an exposed download or a shared/unlocked browser profile. The existing optional 4–8 digit local lock protects the UI only; it is not database encryption or strong authentication. Do not mislabel it as such or use it as a cryptographic key.
- **`MNG-LOCAL-06`:** the current code already has guarded file-size, family-count, total-count, and nesting-depth limits, with focused boundary tests. On the merged baseline, the evidence records 20,000 records per family, 50,000 total, and depth 64, enforced before writes on both import paths. Verify these exact live values and tests; do not duplicate completed work. The remaining required evidence is a real-device performance measurement on the lowest supported physical device. Emulation, desktop timing, and CI are not substitutes.

Keep every security finding visible in the 30-finding register. Recheck current status/evidence before changing it; do not silently drop or reclassify unrelated findings. No finding becomes `fixed-verified` from a code claim or unrelated green CI alone.

## 4. Authorized implementation scope

### A. `MNG-LOCAL-03` — encrypted local data and automatic encrypted downloads, without typed passwords

Implement the smallest complete solution that meets all of these requirements:

1. Protect persistent local application data at rest and protect every newly exported backup. Use established browser/platform cryptographic primitives; use authenticated encryption and correctly generated, non-reused nonces. Do not implement custom cryptography.
2. Use a supported device-native authenticator/passkey/biometric or equivalent OS-managed mechanism to protect access to the encryption key. The application must not ask the user to type a Micro password, PIN, passphrase, or recovery code. Never store an unwrapped encryption key next to ciphertext in IndexedDB, in plaintext storage, logs, diagnostics, source, or the downloaded backup. Do not assume that a non-extractable Web Crypto key stored in the same origin automatically protects against an unlocked/shared browser profile; demonstrate the actual boundary.
3. Keep export simple: the user may download without typing a password, and the downloaded payload is encrypted automatically. A required OS-native confirmation is allowed. If the user cancels, the authenticator is unavailable, or encryption fails, fail closed: do not create a plaintext file and do not claim export success.
4. Protect the IndexedDB data itself, not only the exported file. Integrate correctly with the existing application lock/session gate, while keeping the key unavailable when the protected session is locked. Do not treat the existing local numeric lock as encryption. Do not add a new app PIN/password prompt.
5. Preserve the local-first boundary: no account, Cloudflare, Neon, R2, server-side key, cloud sync, network call, or new provider. Respect the existing one-owner/local-only contract. Preserve the existing export/import use case to the extent possible without weakening encryption. Document exactly whether a backup can be restored on the same device or another device and what happens if the platform credential is lost. Do not claim portability or recovery unless tested.
6. Migrate existing plaintext IndexedDB records without data loss. Validate the encrypted result before retiring any plaintext copy; make migration interruption-safe and recoverable, with a clear rollback boundary. Never run a destructive migration against real user data in this task.
7. New exports must never be plaintext. If backward compatibility requires accepting a legacy plaintext export, validate it before any write, warn clearly in Arabic that the *old source file* is not encrypted, and immediately persist imported records in encrypted form. Do not claim a pre-existing downloaded plaintext file has become encrypted; do not delete or alter files outside the application.
8. Preserve domain/financial values, event identities, snapshots, and restore semantics exactly. If `localSchemaVersion` or `localExportVersion` must change, follow the canonical contracts and update compatibility/migration tests and documentation in the same bounded change. Do not hide a financial, retention, or business-semantics change inside the storage work.
9. If a new persistent store/entity is introduced, update `docs/quality/persistent-entity-touchpoints.json` and its required test mapping in the same change. Do not bypass existing layer boundaries.
10. Any new Arabic UI must stay concise, RTL, use English numerals `0–9`, and render numeric dates as `DD/MM/YYYY` where a date is needed. Do not redesign unrelated screens.

First inspect browser/device support for the repository's actual supported target matrix. If a secure no-typed-password solution cannot work on an officially supported target, do not add plaintext or a weak-key fallback. Continue any independent `MNG-LOCAL-06` work and report the exact incompatibility and smallest owner choice needed. Do not add device-specific crypto claims that are not directly verified.

### B. `MNG-LOCAL-06` — evidence-led import performance on a real phone

1. Preserve the current maximum file-size, family-count, total-count, and depth limits. Do not raise, remove, bypass, or soften them. Reuse the current exact-boundary tests; rerun them only if the affected importer/limits changed.
2. Do not preemptively refactor or optimize the importer. If a real-device measurement or a focused profile demonstrates a bottleneck, fix only that root cause (for example, avoid redundant full-size copies or yield/chunk work where compatible with atomic validation). Keep validation-before-write and atomic restore guarantees intact. Re-measure after any code change.
3. Prepare temporary synthetic backup fixtures from the current format (do not commit huge fixture files) covering: one family at 20,000 records; total at 50,000 records; and nesting depth 64. Respect the existing file-size cap. Measure read, validation, and write phases separately where possible.
4. The acceptance test must run on the lowest-spec physical device officially supported for the intended trial, using the final production build for the exact candidate SHA in an owner-authorized context. Record device model/RAM, OS, browser/version, build SHA, fixture, three elapsed times and median, and whether the UI froze, the browser crashed, or the tab was terminated. The proposed accepted limit is validation plus write in `<=60` seconds and no crash/forced tab termination/unusable freeze.
5. If the lowest supported device is not available to you, do not substitute emulation, desktop, CI, or an arbitrary high-end phone. Finish all safe code/test preparation, produce a short Arabic owner-side procedure and the synthetic fixture-generation method, mark the measurement `NOT_EXECUTED`, and keep `MNG-LOCAL-06` `open`. Do not claim that both findings are fully closed until the owner returns this physical-device evidence. Do not deploy or create a Preview merely to obtain the measurement.

## 5. Architecture, scope, and security gates

- This is a focused security remediation, not a structural reorganization. No bulk moves, new `features/` layer, or broad storage rewrite.
- If a structural refactor or code-organization change appears necessary, stop structural implementation. Perform the mandatory read-only comprehensive Structure/Architecture/Code Organization Scan on the actual current tree, classify findings `FIX_NOW`, `PRESERVE`, `DEFER`, or `OUT_OF_SCOPE`, propose minimum safe waves with dependencies/risks/acceptance/rollback boundaries, and wait for owner review/acceptance before any structural wave. Continue only independent, bounded work if safe.
- Keep Cloudflare Pages Preview disabled on this branch. Prefix every commit message with `[CF-Pages-Skip]` per the current branch convention. If a Preview nevertheless appears, do not open, retry, promote, or interact with it; report its URL/ID/source SHA and stop deployment-related action.
- No direct `main` change, PR creation/update, merge, production deployment, database/binding/settings change, real-data access, branch deletion, cleanup, force-push, or history rewrite.
- No credentials or secrets in prompts, repository files, commands, logs, screenshots, or reports. Use Z AI's secure credential field if authentication is needed; never ask the owner to paste a token.

## 6. Execution and focused verification sequence

1. **Preflight and claim:** complete §2, reopen/continue `DOC-044/WS-254` or create a lawful successor, and write a brief Arabic understanding card before code: scope, non-goals, invariants, risks, acceptance, and rollback boundary.
2. **Inspect without repeating:** verify existing code, tests, security status, and previous exact-SHA evidence for the current limits, lock, storage, and transfer flow. List only concrete gaps for `MNG-LOCAL-03/06`; do not rerun already-proven unrelated suites.
3. **Implement `MNG-LOCAL-03`:** make the storage, export/import, credential, migration, and recovery behavior meet §4A. Add focused regressions before/with the fix. A read-only security reviewer may review the exact final crypto/key-lifecycle/migration diff; the reviewer must not write.
4. **Verify `MNG-LOCAL-03`:** run only the directly affected unit/integration/browser tests and required guards. Evidence must show encrypted persisted/exported payloads contain no plaintext test sentinel; successful authorized round-trip; tampered/unsupported/cancelled flows fail without writes or plaintext fallback; legacy import (if supported) is re-encrypted; existing values/IDs remain identical; migration interruption does not lose the original data; and the device-auth flow does not ask for a typed Micro password. Report platform support and limits.
5. **Verify `MNG-LOCAL-06`:** preserve the existing boundary tests and run focused importer tests only if relevant code changed. Perform the physical-device procedure when access to the actual lowest supported phone and an owner-authorized exact-SHA build exists. Otherwise provide the ready-to-run materials and keep the finding `open`/`NOT_EXECUTED`.
6. **Register evidence:** update only the relevant source records/status rows and `DOC-044`/workstream state, keeping all 30 findings visible. `MNG-LOCAL-03` remains `open` until its own direct evidence is complete; it is no longer owner-deferred under the new instruction. `MNG-LOCAL-06` remains `open` until physical measurement passes. Set `fixed-verified` only with exact-commit evidence for that finding. Generate/validate derived views using canonical tools; do not edit generated files by hand.
7. **Final candidate:** inspect the diff, `git diff --check`, focused tests/guards, types/build only where affected, secret scan, and repository-defined checks that are genuinely required. The owner explicitly wants to avoid redundant large suites: do not rerun the 3,800-test prototype suite or dispatch/re-run broad CI just for reassurance. If an automatic workflow runs on an authorized push, record its exact URL/SHA once; no manual rerun without a specific failure and root-cause fix.
8. **Commit and push:** after local focused verification, commit/push only to `manus/mng-local-03-06-remediation-20261124`, with `[CF-Pages-Skip]` at the start of every commit subject. If the no-Preview convention cannot be reliably honored, preserve local work and do not push. Do not create a PR.

## 7. Stop conditions and safe continuation

Continue autonomously through all safe, in-scope code and focused tests; do not stop for routine implementation choices. Stop only for a material conflict or irreducible blocker, including:

- no secure implementation can satisfy automatic encrypted downloads, protected local data, and the owner's no-typed-password requirement on the declared target browsers;
- preserving a current restore/migration guarantee would require weakening encryption or silently losing data;
- a new product, financial, retention, or cross-device recovery decision is unavoidable;
- a structural wave is required but has not passed the mandatory scan/owner-review gate;
- the only way to obtain device evidence would require an unapproved Preview, deployment, production setting, or real-data operation.

When blocked, state the exact technical conflict and a recommended smallest owner decision; continue independent safe work. Never resolve a blocker by weakening the guard, exporting plaintext, or labeling evidence `VERIFIED` without running it.

## 8. Final report and exact handoff

Write an Arabic report at `docs/expansion/handoffs/zai-micro-local-security-remediation-2026-11-24/EXECUTION-REPORT-AR.md`, add it to `docs/00-document-index.md` using the next available identifier after this prompt, and update Operations Control source records/views as required. The report must include:

- repository, branch, base `main` SHA, start/final full SHAs, current PR state (expected: no PR), and any `STATE_DRIFT`;
- exact files/commits changed, rollback boundary, whether a push occurred, and evidence that Pages Preview was skipped or that no push was made;
- for each of all 30 security findings, its current status and evidence linkage; emphasize the individual `MNG-LOCAL-03` and `MNG-LOCAL-06` decisions without removing unrelated findings;
- the cryptographic design, how keys are protected, supported browsers/devices, lock/unlock and recovery/portability limits, migration strategy, legacy plaintext behavior, and an honest residual-risk statement;
- exact focused commands, exit codes, result counts, and SHA for tests/guards actually run; distinguish `VERIFIED`, `INFERRED`, `UNVERIFIED`, `NOT_EXECUTED`, `DEFERRED`, and `BLOCKER`;
- for the device measurement, exact model/OS/browser/build, fixture, all three times/median, threshold result, and freeze/crash result; if unavailable, mark `NOT_EXECUTED` and leave the finding `open`;
- financial/domain/schema/export/security impact, any user-visible changes, any CI/Preview activity, and actions explicitly not taken;
- one concise next action for the owner, if any. If execution had already completed during interruption, provide the same detailed verified summary rather than restarting work.

Stop at this handoff. No PR, merge, deployment, Preview, Cloudflare/database change, real-data use, branch cleanup, or deletion.