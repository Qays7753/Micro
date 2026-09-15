# OWNER DECISIONS IMPLEMENTED

| # | Decision | Implementation | Verification |
|---|---|---|---|
| D1 | Dark Mode fully implemented as a permanent theme | `styles/theme-dark.css` single owner rebinding the `--vf-*` contracts under `:root.dark`; ADR-009 supersedes ADR-007 per its own clause | 70 captures both themes; 82 contrast pairs; render-smoke 55x2; guards |
| D2 | No Row/Field big convergence (post-journey) | Neither primitive was force-adopted; preserved-items table intact in MIGRATION_STATUS.md | diff scope — no Row/Field consumer changes |
| D3 | High-consequence action classes unchanged in meaning | No action-class reclassifications in this run; existing destructive/commit bindings untouched | Button tests + migration matrix unchanged |
| D4 | Surface tone syntax centralized as UI/AUX semantics | `docs/architecture/SURFACE_TONE_SYNTAX.md` — normative grammar (data-tone/status/knowledge/void, chosen-state, FeedbackKind, invariants, theme rules) | doc review + attribute census |
| D5 | Mechanical Light/Dark contrast floors (light palette untouched) | `scripts/theme-contrast-guard.py` — 82 pairs, text >=4.5 / marks >=3, wired into `pnpm design-guards`; the 18 light hexes byte-for-byte unchanged | guard PASS; vf-tokens approved-18 test |
| D6 | FeedbackNote explicit typed channel; wording never edited | `kind: completion\|advisory\|error` required at the event source; prefix classifier deleted; all 6 consumer surfaces migrated | 4 channel-contract tests; wordings diffed unchanged |
| D7 | link-ink kept; aria-pressed explicit; no chip migration | `.micro-text-action[aria-pressed=true]` clay-interactive underline; accent-text ink untouched; no chips migrated | U09 assertion + capture (activity-filters-pressed) |
| D8 | FinanceActivity no-data vs no-results via existing state-slot pattern | silent unfiltered census read -> EmptyState state slot with StatusChip no-data/no-results | 3 behavioral tests + 2 captures |
| D9 | Completion markers from explicit states/primitive semantics | literal checkmark dropped from the export completion word; markers render from QuietCompletion only | Settings wording diff (character removed only) |
| D10 | Documents/micro-standard-v2 untouched | zero changes outside the Micro branch; Standard clarification only proposed here: none required | boundary proof (empty diff on protected paths) |

**Standard clarifications proposed (report-only, per D10):** none — the Standard's contracts were sufficient; the dark palette is a Micro-owned layer exactly as the boundary document anticipated.
