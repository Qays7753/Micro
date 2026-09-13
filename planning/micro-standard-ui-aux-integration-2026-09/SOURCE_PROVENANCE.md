# SOURCE PROVENANCE — what was actually read, from where, at which commit

Rule: nothing is claimed as "read" unless it was opened from the canonical source below or its SHA was verified against it. Local workspace copies were used only after the remote SHA was recorded.

| # | Source | Canonical URL / ref | Commit | Path | Status |
|---|---|---|---|---|---|
| 1 | Micro repository | https://github.com/Qays7753/Micro | `c0469e265f24c70427eb7826dee717be117cff87` (main HEAD at start) | full clone | READ (verified via git ls-remote + clone) |
| 2 | Documents repository | https://github.com/Qays7753/Documents | `f919982c692e5ba78cf3284a4240c45f66be91c6` (main HEAD at start) | full clone | READ |
| 3 | Standard package | Documents `main` → `micro-standard-v2/` | as above | 31 files (29 core + 2 metadata) | READ — file count verified = 31; package verified byte-identical to promoted reconciliation-final `micro-standard-v2-UPDATED` |
| 4 | Standard: README, MANIFEST, RELEASE, design-tokens.css, design-tokens.json, component-states, component-contracts, color-system, navigation-shell, typography, button-system, input-system, overlay-system, empty-loading-error-states, data-display-system, accessibility, motion-interaction, spacing-radius-elevation, iconography, surface-system, responsive-geometry, visual-direction | Documents `main:micro-standard-v2/<file>` | as above | individual files | READ (full contents) |
| 5 | Flash comparison report | branch `micro-standard-v2-micro-integration-comparison-20260913` | `bf0fc821e2f118aa9ea0e6cd0a87b1a8249be3f5` | `planning/micro-standard-v2-micro-integration-comparison-2026-09/MICRO_STANDARD_TO_MICRO_READONLY_INTEGRATION_COMPARISON_REPORT.md` | READ (full; §1-19 incl. gap matrix, decisions D-01…D-12, waves) |
| 6 | Gap matrix CSV | same branch | same | `…/MICRO_STANDARD_GAP_MATRIX.csv` | READ (header + GAP-01/02 verified; 47 gap rows available) |
| 7 | UI/AUX structure scan | same branch | same | `…/MICRO_UI_AUX_STRUCTURE_SCAN.md` | READ (full) |
| 8 | Owner unified decision register | branch `micro-standard-v2-reconciliation-context-20260914` | `8806aab5adfa5d7e9b6ddac6098d9032a7cdde61` | `planning/micro-standard-v2-reconciliation-context-2026-09/OWNER_UNIFIED_DECISION_REGISTER.md` | READ (full — U-01…U-20) |
| 9 | Reports reconciliation | same branch | same | `…/REPORTS_RECONCILIATION.md` | READ (full) |
| 10 | Reference ZAI Flash report | same branch | same | `…/REFERENCE_ZAI_FLASH_REPORT.md` | VERIFIED byte-identical to #5 (diff empty) — not re-read |
| 11 | Reference ZAI 5.3 report | same branch | same | `…/REFERENCE_ZAI_5_3_REPORT.md` | AVAILABLE; used as cross-check only (Flash is primary baseline per REPORTS_RECONCILIATION) |
| 12 | Execution prompt context | same branch | same | `…/EXECUTION_PROMPT_CONTEXT.md`, `…/FLASH_DELIVERY_TRANSCRIPT.txt` | AVAILABLE (context pack complete — no CONTEXT_NOT_AVAILABLE condition) |
| 13 | Reconciliation final report + updated package | branch `micro-standard-v2-reconciliation-final-20260914` | `be8d258811de4afdbc38d2932b76bb2057fc483b` | `planning/micro-standard-v2-reconciliation-2026-09/` | READ (tree + package identity verified against main) |
| 14 | Accepted architecture scan | branch `audit/micro-structure-architecture-scan-2026` | `17b264c9966791794d0b37c506e2f2ac56646988` | `audits/micro/structure-architecture-code-organization-scan-v1.md` | READ (structure mapped; key claims re-verified live by Agent 1) |
| 15 | Micro source: index.css (tokens, buttons, chrome, FAB, chips, text-action, overlays), design-token-guards.py, package.json files, vite.config.ts, micro-mark.svg, ThemeContext, router/shell/navigation | Micro @ base commit | `c0469e2` | as listed | READ (directly by lead and by Agents 1-2 with file:line evidence) |

**Note on counts (per REPORTS_RECONCILIATION.md):** Flash figures are the operational baseline with their definitions preserved: 57 route elements, 60 page TSX files (52 non-test), 47 non-test component files, 275 exact `د.أ` literals across 53 files, ≈256 duplicated CSS lines. Deviations between reports are recorded, not silently resolved.

**No missing canonical source.** All documents named in the execution prompt were available. No reconstruction from memory was performed. `SOURCE_ACCESS_BLOCKED` was not triggered.
