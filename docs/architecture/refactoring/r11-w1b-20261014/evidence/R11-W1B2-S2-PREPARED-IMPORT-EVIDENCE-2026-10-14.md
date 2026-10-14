# R11 W1b-2 — S-2 Opaque `PreparedImport` Provenance Contract — Evidence

**Artifact ID:** R11-W1B2-S2-PREPARED-IMPORT-EVIDENCE-2026-10-14 | **Slice:** W1b-2 | **Date:** 2026-10-14 (UTC) | **Executor:** ZAI (single W1b writer)
**Decision authority:** S-2 (`OWNER_APPROVED — OPAQUE_PREPARED_IMPORT`) in the R11 owner decision package §4; D-10 / R10B-NF-012 in the crosswalk; executed under the canonical W1b execution prompt slice W1b-2.
**Base SHA:** `0ede6e941a7ec276baf1594febb34e2d4ebf14ee` (branch base)

---

## 0. Status

```text
W1B2_S2_PREPARED_IMPORT — VERIFIED
SINGLE_MINT_PROVEN — source-scan + module-private ambient symbol
RUNTIME_BEHAVIOR — unchanged (emitted entry byte-identical; 303+18 caller tests green)
```

## 1. Census (every caller, test, export, and type path — before any write)

Production exact-token census of `prepareImport` / `confirmImport` / `PreparedImport`:

| Site | Kind |
|---|---|
| `application/transfers/localTransferService.ts:173` (`prepareImport`) / `:236` (`confirmImport`) | the seam (mint + accept) |
| `localTransferService.ts:258` (`createVerifiedExport` → `this.prepareImport(serialized)`) | internal round-trip; reads `.file`/`.summary` only — never passes a preview to `confirmImport` |
| `pages/Settings.tsx:209` + `:425` (`transfers.prepareImport(...)`) | the only production callers of the mint |
| `pages/Settings.tsx:440-459` (page `confirmImport()` wrapper → `transfers.confirmImport(preview)`) | the only production accept call |
| `pages/Settings.tsx:219` (`useState<TransferPreview \| null>`) | preview state |
| `pages/Settings.tsx:658` → `components/settings/SettingsDataProtectionSection.tsx:74` (`confirmImport: () => Promise<void>` prop) | page-level wrapper prop — never touches the service type |
| `SettingsDataProtectionSection.tsx:59-60` (`preview` / `setPreview` props) | the component's typed view of the preview |
| `application/transfers/index.ts:13` (door type re-export) | the export path |
| Comments: `transferArrayFamilyRoles.ts:112`, `transferEnvelope.ts:3/:55`, `transferSnapshotMigrations.ts:3`, `transferSnapshotValidation.ts:78`, `Settings.tsx:160` | documentation references only |
| Tests: 32 files under `application/transfers/` + 4 Settings DOM suites (`Set003SettingsSection`, `Settings.lockGate`, `SettingsDataBackupSection.w42`, `U11`) + `storage/local/IndexedDbLocalStore.group2.test.ts:323-325` | every real-service test flows `prepareImport(...).value → confirmImport(...)` (the branded value passes through); every DOM mock is `as unknown as ReturnType<typeof usePrototypeServices>` (type-opaque double cast — unaffected by signature types) |

The guided opening import service (`guidedOpeningImportService.ts`) is a separate `prepare`/`confirm` family with its own wire format — not part of this seam (census-verified).

## 2. The provenance contract (implemented)

`localTransferService.ts`:

```ts
declare const preparedImportBrand: unique symbol;                                  // ambient, module-private, zero runtime footprint
export type PreparedImport = TransferPreview & { readonly [preparedImportBrand]: "minted-by-prepareImport" };

prepareImport(text: string): TransferResult<PreparedImport>                        // the mint (single documented cast at its success return)
async confirmImport(preview: PreparedImport): Promise<TransferResult<RestoreResult>> // accepts only the minted type
```

- **Opaque/phantom:** the brand symbol is `declare`d (ambient) and **not exported** — no external module can write the brand property into an object literal; the runtime object remains exactly `{ file, summary }`.
- **Single mint:** the only production `as PreparedImport` is the documented cast at `prepareImport`'s success return.
- **Consumers:** door re-export (`transfers/index.ts`) + `Settings.tsx` state (`useState<PreparedImport | null>`) + `SettingsDataProtectionSection` props (`PreparedImport | null`) — all type-position updates only.
- **Preserved contracts:** the single-validation runtime flow, rejection precedence, messages, and the backup-first behavior (`createVerifiedExport` before `replaceSnapshot`) are untouched; no second validation pass was added.

## 3. Proof tests (new: `application/transfers/preparedImport.provenance.test.ts`, 4/4 green)

1. **Negative type test (compile-pinned):** `rejectedBypass()` — a never-called function whose body passes an ordinary `TransferPreview` to `confirmImport` under `@ts-expect-error`; TS2578 (unused directive) makes the suppression self-verifying on every `pnpm check`.
2. **Widening direction:** `PreparedImport extends TransferPreview` pinned to `true` and `PreparedImport["summary"]["exportedAt"]` pinned to `string` — UI readers keep working.
3. **Test-only forge helper:** `forgePreparedImportForTests` (identity cast) declared in the test file for future tests, per the owner decision.
4. **Production source-scan:** across all production `.ts`/`.tsx` under `client/src` **and** the domain root `src/`, the only occurrences of `as PreparedImport` / `satisfies PreparedImport` / expression-position `<PreparedImport>` casts (lookbehind excludes generic-argument positions like `TransferResult<PreparedImport>`) are exactly **one** — the documented mint inside `localTransferService.ts`; the forge-helper name is additionally banned from production files. *(Two initial false positives — the generic type argument and the mint's own doc comment — were eliminated by the pattern and comment wording; the guard now counts exactly 1.)*

## 4. Verification matrix

| Check | Result |
|---|---|
| Provenance test | **4/4 PASS** |
| All transfers suites (`vitest run client/src/application/transfers/`) | **32 files / 303 tests PASS** — unchanged behavior |
| Settings DOM caller suites (lockGate, Set003, w42, U11) | **4 files / 18 tests PASS** |
| Typecheck (root + app incl. tests) | PASS |
| Lint (5 touched files, ceiling 37) | PASS (exit 0) |
| Prettier | PASS |
| File-size ratchet | PASS with documented ledger entry `R11-W1B2-S2-PREPARED-IMPORT-PROVENANCE` — `localTransferService.ts` 306 → 329 nbLoc (NORMAL→NORMAL, comment + brand + signature only; ocRef ARCH-009); the other four files have zero growth |
| Module boundaries / other guards | PASS (19/128/80/48 exact; no new edges) |
| Emitted-JS identity | **entry `assets/index-CPVmJmgX.js` raw 631,903 / gzip 155,290 — byte-identical to the canonical baseline**; budget PASS 650,000/155,300; surfaces 102/2/70/157/2 exact |
| `git diff --check` | PASS |

## 5. Protected invariants (re-verified)

- **Schema 38 / Export 30** — no storage file in the diff; constants untouched.
- **Legacy acceptance / goldens / MANIFEST / rejection precedence** — no transfer-validation file changed; `prepareImport`'s gates and messages byte-identical; the 32 transfers suites (incl. `exportGoldens`, `releasedPairs`, `rc1Gate`, all `schemaNN`/family suites) pass unchanged.
- **No second runtime validation** — the cast is erased at compile time; the runtime flow is provably identical (entry hash).

## 6. Rollback boundary

Revert this slice's commit to restore the unbranded `TransferPreview` signatures everywhere (service + door + two UI consumers + ledger entry travel with the same commit; the provenance test file is deleted with it). The revert restores exactly the pre-S-2 tree — no other slice depends on `PreparedImport`.

## 7. Dated addendum — 2026-10-15 (five-reviewer gate; R11-W1B-RV1-2 + R11-W1B-RV2-2)

The final reviews recorded one residual inherent to the owner-approved phantom-brand pattern, documented here as a boundary (not a defect): a type-level **spread/assign derivation from a genuine minted value** (`{ ...prepared, file: X }` or `Object.assign(minted, …)`) retains the phantom brand in the result type without re-entering `prepareImport` — it is not a cast, so the source-scan family cannot cover it. Fresh forging remains impossible (module-private unexported symbol; `as`/`satisfies`/angle-bracket casts scan-banned; `@typescript-eslint/no-explicit-any: error` in all production scopes). This requires possession of a genuine minted value (post-mint tampering, a different threat class than unvalidated-object injection). Exact hardening trigger if the owner ever wants it closed: a W2-era lint rule banning spread/assign of `PreparedImport` outside `localTransferService.ts`, or `no-unsafe-argument` for the transfers module.
