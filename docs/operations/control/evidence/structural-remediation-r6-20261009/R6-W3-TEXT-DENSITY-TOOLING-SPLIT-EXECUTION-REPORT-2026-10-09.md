# R6-W3 — Text-Density Tooling Split — Execution Report

**Program:** WS-216 / ARCH-007 — Structural Remediation R0–R10, R6 records wave 3
**Mode:** Tooling + tests + documentation only. Zero production application behavior change; zero bundle impact (proven below).
**Execution date:** 2026-10-09 — **Executor:** Z AI (single primary executor; five read-only review gates before commit)
**Base:** the verified W2 final head `fb11c6c71be7124c3bf4ac62704d5186eede43d6` (PR #339 open at the owner gate; stacked lineage `main fd92d7e8 ← W1 b3048f2a ← W2 fb11c6c7 ← W3`)
**Branch:** `refactoring/r6-w3-text-density-tooling-20261009`
**Authority inputs:** the canonical R6 scan report + owner decision package on `main` (SHA-256 `e06a27a4…` / `13387db9…`; both byte-untouched in this diff).

---

## 1. Characterization FIRST (the contract, captured before the split)

Before any edit to the target, the exact current CLI contract was captured from the unsplit script at the W2 head:

| Contract element | Captured value |
|---|---|
| Invocation | `python3 scripts/text-density-count.py` (also `pnpm text-density`); flags `--list <Page>`, `--breakdown` |
| Exit code | 0 (all surfaces within caps) |
| stdout | **4,117 bytes**, 62 lines: per-page `OK  <name> <count> distinct at-rest strings (cap <cap>)` in PAGES order, blank line, `All surfaces within §10 caps.` |
| stderr | empty (0 bytes) |
| stdout SHA-256 | `812a24bb3f97c0196191b4e36b450d6b80d66be8eaa1ec701bd2c1c051d8f110` |
| Error behavior | missing listed page → `MISS …` + exit 1; unmeasured page → listed + exit 1; over-cap → `OVER` + exit 1 |
| Ordering/determinism | PAGES list order; sorted breakdown lines |
| Full-repo fixture | `docs/fixtures/text-density/w3-characterization.golden.txt` (committed, byte-exact) |

The characterization test `scripts/text-density-count.characterization.test.mjs` was written and run **against the unsplit script first** — the byte-identity test passed pre-split (the golden's provenance is the pre-split run), then the split was performed, and the full suite passed post-split. Layers: (1) byte-exact golden; (2) structural contract (literal line format, PAGES order from the policy module, exact closing line); (3) caps-in-output == policy module CAPS (single source cross-check); (4) `--list` argument contract; (5) negatives — see §3; (6) engine/policy boundary proof (engine imports the policy, defines no data of its own; policy module is data-only — no main/count/exit).

## 2. The split

- **`scripts/text_density_policy.py` (NEW — the policy/CAPS ledger, data only):** `EXPLICIT_SERVICES` + `CAPS` (48 entries with the **full dated provenance comment history preserved verbatim** — the ledger's source is its history; removal is forbidden by the wave contract) + `PAGES`. 846 nbLOC / 852 raw / 68,666 bytes. No logic: the engine validates it at startup.
- **`scripts/text-density-count.py` (the engine — parsing, counting, validation, reporting):** all extraction/traversal/counting/reporting logic retained; imports the policy module; **new `validate_policy()`** runs at `main()` startup — malformed policy data (non-int cap, duplicate/empty page name, non-list service mapping) fails loudly with exit 2 and a clear `text-density policy:` stderr message (previously an obscure comparison crash). 458 nbLOC / 506 raw / 19,577 bytes — **leaves SPLIT_NOW** (was 1,253 nbLOC) → WATCH.
- No `utils.py` dumping ground; no second source of truth; the policy module is the single home of the data.

## 3. Byte-identical output proof + negatives

- **Full-repository run:** pre-split output (4,117 bytes, exit 0, empty stderr) vs post-split: **`cmp` byte-identical**; the golden test passes; `pnpm text-density` (the CI-native invocation) prints `All surfaces within §10 caps.` with exit 0.
- **Negative 1 — altered policy entry detected:** in-process tamper `policy.CAPS["Home"] = 3` → the engine (which consumes the same policy object) reports `OVER` for Home and exits 1 — an altered cap cannot pass silently.
- **Negative 2 — malformed policy entry detected:** `policy.CAPS["Home"] = "not-an-int"` → the engine's `validate_policy()` rejects it: exit 2 with a `text-density policy:` stderr line naming the malformed entry.
- Characterization suite: **7/7 green**; the CLI contract for valid inputs is unchanged byte-for-byte; the only behavior delta is the invalid-input path, which now fails loudly instead of crashing obscurely (a tooling-contract improvement inside the wave boundary, documented here).

## 4. Register / ratchet / test-map / documentation updates (same PR)

- **Register §2:** engine row updated (458/506/19,577, WATCH, dated note); **new row** for `scripts/text_density_policy.py` (846/852/68,666, SPLIT_CANDIDATE, data-only disposition — size dominated by the preserved dated provenance; growth governed by the documented caps protocol). **§3 card:** dated W3 closure appended to the F-009 card. **§7:** dated note (band change + baseline update + new files).
- **Ratchet baseline** (`scripts/file-size-ratchet-baseline.json`): engine entry **tightened SPLIT_NOW → WATCH** (a ratchet gain); new entry `scripts/text_density_policy.py: SPLIT_CANDIDATE` per the ratchet's own same-PR protocol for legitimate new files (the un-updated state fails with `new-file-enters-band`, verified live before the update). No threshold changed; no cap value changed.
- **Test-map:** regenerated (`pages 60, contracts 49`) — the new characterization test file is mapped; `--check` no drift.
- **`docs/architecture/SOURCE_OF_TRUTH.md`:** the §10.1 caps row now names the engine + the policy module (dated seam note) — the authority pointer follows the split.
- **Operations Control:** WS-216/ARCH-007 JSON-first (append-only evidence + next_action); state-log §158; worklog Entry 67; current-state + CONTROL live fields; views regenerated by the official generator only.

## 5. No-bundle-impact proof

`pnpm prototype:build` on the W3 tree: **bundle-budget PASS; bundle-surfaces PASS — lazy 101 chunks (1,409,712 raw / 432,901 gzip), precache 187 entries (2,741,296 bytes)** — identical to the recorded R5/W1/W2 state (the script and the policy module are outside the vite build graph; no `src/` or `apps/` production file changed in this wave).

## 6. Commands, exit codes

| Command | Result |
|---|---|
| `python3 scripts/text-density-count.py` (pre-split capture) | exit 0; stdout 4,117 B sha256 `812a24bb…`; stderr empty |
| same, post-split | **byte-identical** (`cmp`); exit 0; stderr empty |
| `pnpm text-density` | `All surfaces within §10 caps.` exit 0 |
| characterization suite (7 tests) | 7/7 green (golden run pre-split green as well) |
| root suite `pnpm test` | **730/730** (723 base + 7 characterization) |
| app suite `pnpm prototype:test` | **323 files / 2,388 tests** |
| typecheck (root + app) / lint / format | clean / 0 errors 35 warnings / clean |
| guards (17-chain) | exit 0 (secrets **1,555**/0; test-focus **386**/0; file-size-ratchet PASS 486/408) |
| `pnpm prototype:build` | PASS; bundle identical to recorded state |
| `node scripts/generate-test-map.mjs` + `--check` | wrote (60/49); no drift |
| ops-control generator + `--refresh-excel-meta` + `--check` + `validate.py` | exit 0 (after control-record updates) |
| `git diff --check` | clean |

## 7. Five-reviewer gate results (read-only, before commit)

1. **Architecture/boundary:** the seam matches the scan's verified engine-vs-policy-data split; no utils dumping ground; no second source of truth; stacked lineage intact. PASS.
2. **Data/domain:** no domain/storage file touched; the caps ledger preserved verbatim (no cap value changed — the density ceilings are untouched); schema 38 / export 30 untouched. PASS.
3. **Runtime/UI:** no application runtime or visual change; bundle proven byte-identical. PASS.
4. **Tests/CI/operations:** characterization-before-split honored (golden captured and green pre-split); negatives prove detection both ways; ratchet protocol followed exactly (violation observed, then documented same-PR update); test-map regenerated; rollback = slice revert. PASS.
5. **Hostile:** verified the golden's provenance is genuinely pre-split (captured at the W2 head before any edit); verified the policy module contains no logic; verified no caller of the CLI needs change (package.json/CI invoke the engine path, unchanged); verified the historical decision-log references (D-026/D-029) remain true (they cite the file that still exists and still owns the caps through its policy module); noted the invalid-input behavior delta is documented in §3. PASS_WITH_NOTES (no W3-blocking finding).

## 8. Changed paths (complete)

1. `scripts/text-density-count.py` — the engine (policy block removed; policy import + `validate_policy`)
2. `scripts/text_density_policy.py` — NEW: the policy/CAPS ledger (data only, provenance preserved)
3. `scripts/text-density-count.characterization.test.mjs` — NEW: 7-test characterization/boundary/negative suite
4. `docs/fixtures/text-density/w3-characterization.golden.txt` — NEW: the byte-exact golden (pre-split capture)
5. `scripts/file-size-ratchet-baseline.json` — engine tightened to WATCH; policy registered SPLIT_CANDIDATE (same-PR protocol)
6. `docs/architecture/refactoring/FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md` — §2 rows + §3 card closure + §7 dated note
7. `docs/architecture/SOURCE_OF_TRUTH.md` — §10.1 caps row (dated seam note)
8. `docs/architecture/refactoring/generated/test-map.json` — regenerated
9. `docs/operations/control/evidence/structural-remediation-r6-20261009/R6-W3-TEXT-DENSITY-TOOLING-SPLIT-EXECUTION-REPORT-2026-10-09.md` — this report
10. `docs/operations/control/workstreams/WS-216.json` + `docs/operations/control/items/ARCH-007.json` — JSON-first records
11. `docs/operations/current-state.md` + `current-state-log.md` (§158) + `AGENT-SEQUENTIAL-WORKLOG.md` (Entry 67) + `REFACTORING-CONTROL.md` — live fields + append-only history
12. `docs/operations/control/generated/*` — regenerated from JSON

**Explicitly unchanged:** every file under `src/` and `apps/` (no application code at all), CSS/tokens/package/lockfile, the two canonical R6 authority files, all export goldens, the caps values.

## 9. Schema/Export/financial/history/rejection/security/UI impact

**None.** No production application file changed; the tooling split is outside the build graph (bundle proven identical); `localSchemaVersion=38` / `localExportVersion=30` untouched.

## 10. Risks and rollback

Risk: the policy import relies on the script-directory being on `sys.path` (true for direct `python3 scripts/…` invocation, which is the only documented invocation — package.json + CI). Rollback: **slice-level** — revert this commit to restore the single pre-split file; the register notes are dated/append-only; the ratchet baseline reverts with the slice.

---

R6_W3_EXECUTED_ON_BRANCH — PR_NEXT
TOOLING_TESTS_DOCS_ONLY
BYTE_IDENTICAL_OUTPUT_PROVEN
NO_PRODUCTION_CHANGE
NO_MERGE_PERFORMED
NO_CLEANUP_PERFORMED
