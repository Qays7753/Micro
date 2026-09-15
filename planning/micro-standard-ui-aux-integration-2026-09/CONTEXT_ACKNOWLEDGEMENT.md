# CONTEXT ACKNOWLEDGEMENT — Micro Standard UI/AUX Integration

**Run:** micro-standard-ui-aux-integration-20260914
**Date:** 2026-09-14 (Asia/Amman)
**Prepared by:** Lead implementation engineer (ZAI), with five-agent operating model.

This document is the mandatory context acknowledgement required before any edit.
Every fact below was verified against the live canonical sources on 2026-09-14.

## 1. Exact baselines (verified live)

| Source | Commit | Verified |
|---|---|---|
| Micro `main` HEAD (base of this branch) | `c0469e265f24c70427eb7826dee717be117cff87` | `git ls-remote` + clone + `git rev-parse` |
| Documents `main` HEAD | `f919982c692e5ba78cf3284a4240c45f66be91c6` | `git ls-remote` + clone + `git rev-parse` |
| Standard package consumed | `Documents/main:micro-standard-v2/` — exactly 31 files (29 core + `MANIFEST.json` + `RELEASE.md`) | `git ls-tree -r` count = 31 |
| Standard identity check | `Documents/main:micro-standard-v2` is byte-identical to the promoted reconciliation-final package (`micro-standard-v2-UPDATED`) | empty `git diff` |
| Evidence branch: comparison | `micro-standard-v2-micro-integration-comparison-20260913` @ `bf0fc821e2f118aa9ea0e6cd0a87b1a8249be3f5` | read (report + gap matrix + structure scan) |
| Evidence branch: context pack | `micro-standard-v2-reconciliation-context-20260914` @ `8806aab5adfa5d7e9b6ddac6098d9032a7cdde61` | read (`OWNER_UNIFIED_DECISION_REGISTER.md`, `REPORTS_RECONCILIATION.md`, reference reports) |
| Evidence branch: reconciliation final | `micro-standard-v2-reconciliation-final-20260914` @ `be8d258811de4afdbc38d2932b76bb2057fc483b` | read (final report + updated package verified identical to main) |
| Accepted architecture scan | `audit/micro-structure-architecture-scan-2026` @ `17b264c9966791794d0b37c506e2f2ac56646988`, file `audits/micro/structure-architecture-code-organization-scan-v1.md` | read; re-verified by Agent 1 (Section 4) |

Baseline verification status: full `pnpm check` green at branch point — typecheck, lint, format, text-density, design-guards, guards, 35 root test files (391 tests), prototype check + 166 client test files (1166 tests), production build + bundle budget (633,197 raw / 150,606 gzip vs 650,000 / 155,000 limits). Working tree clean.

## 2. Accepted strategy (fixed — not renegotiable)

```
Contract-first → Token-driven → Component-driven → Feature-oriented → Composition-based
```

Authority ladder:
```
Documents/Micro Standard (visual contracts)
→ Micro runtime token mapping (Standard names ↔ Micro variables)
→ Micro shared primitives (reusable visual behavior, no product policy)
→ Micro AUX shell (Header, BottomNav, FAB, chrome, safe areas, overlays)
→ Micro feature patterns (Finance, Orders, Tables, Calendar, Charts, Filters, Tools, detail)
→ Micro screens (composition + data)
→ Micro domain/application/storage (meaning, formulas, persistence — untouched by this run)
```

## 3. Fixed decisions (owner-approved; will not be reopened)

1. Arabic-first, RTL, phone-first (320–430px), light-first.
2. English digits in isolated LTR/bidi slots; `د.أ`/`دأ` unit outside the number per existing Micro policy.
3. `#D97757` = identity/create/FAB (text-bearing: `#141413` ink; icon-only: white icon). `#C96442` = chosen/current/pressed edge or underline. `#141413` = Warm-Ink for high-consequence commitment only.
4. Ordinary save/confirm = Warm Tint `#F5F4ED` + ink + `#C96442` pressed edge. High-consequence commit = filled Warm-Ink + white text + consequence wording + independent confirmation. Destructive = error `#B53333` + confirmation.
5. Semantic colors for outcomes only; color never carries state alone (word + non-color marker always).
6. Honest voids preserved: unrecorded ≠ unavailable ≠ measured zero. Pending ≠ success. Unknown ≠ failure.
7. Micro state words and orthography preserved initially (central State Adapter; no renames). Micro nav labels «مشروعي الآن / العمل / مالي / أدواتي» and labeled in-grid FAB «سجّل» ratified as product-owned variants (register U-09).
8. Micro strengths preserved: `formatters.ts`, `DisplayValue`, bidi isolation, safe areas, keyboard chrome hiding, `UnsavedChangesGuard`, domain separation, financial meaning.
9. No retired palette returns: `#964E33`, `#5F3120` (and incumbent `#CC785C` family is retired by adoption D-01/U-01), no gold/amber identity, no unapproved teal role (register U-02: links use ink-secondary/ink + underline; teal never returns as identity/choice/success).
10. Dark Mode: NOT activated in this Light integration; existing dark layer remains Micro-local legacy until its own owner gate; this run documents the isolated semantic boundary (register U-03, W7).
11. Prototype v0 is evidence only — no routes, words, values, or flows copied. No AI Assistant/chat/LLM work.
12. Type floors (U-04): labels ≥13px; 12px caption = non-financial metadata only; financial facts ≥15px.
13. Feedback regime (U-07): inline/quiet feedback ratified as Micro's contract; Snackbar remains optional, not default.
14. Period control (U-08): keep native month inputs + quick ranges; period chip is an optional variant.
15. No new palette values. The only permitted derivations are the Standard's two disclosed functional alpha composites (scrim `rgba(20,20,19,0.45)`, translucent header `rgba(250,249,245,0.86)`) and the recorded elevation shadow tone `rgba(60,50,40,x)`.

## 4. Five-agent operating model

| Agent | Role | Waves |
|---|---|---|
| 1 | Repository & architecture boundary auditor (read-only) | W0; verifies each wave's boundaries |
| 2 | Standard contract & runtime mapping engineer | W1 (mapping + State Adapter), W2 token bindings |
| 3 | Shared primitives & accessibility engineer | W2, W4 (states, RTL, bidi, focus, reduced motion) |
| 4 | AUX & feature-composition engineer | W3, W5 (shell + feature patterns) |
| 5 | Adversarial QA, regression & release reviewer | every wave gate; final review before push |

Agents inspect in parallel where possible; the lead integrates serially and owns every commit on this branch. No agent edits concurrently with another.

## 5. Wave plan (exact)

- **W0 — Baseline, branch, architecture gate.** Branch from exact main HEAD; baseline manifest, SHA record, rollback archive, working-tree proof; re-run read-only architecture scan; no reorganization. Gate: repo clean, rollback restores baseline, scan confirms approved boundaries.
- **W1 — Runtime token mapping + State Adapter.** One central `--vf-*` mapping layer binding Standard roles to Micro variables (light mode); legacy names preserved as aliases; no legacy deletion; PWA/logo twins updated; guard updated (scrim exception removed → tokenized scrim); central State Adapter maps Micro words → markers/tone contracts without renaming; tests for token resolution, alias integrity, state-word preservation, honest-void truth, RTL/bidi.
- **W2 — Shared primitives.** Proven-repeated primitives only: Button (action classes), StatusChip (+ tone variants — fixes the warn-chip defect), Field states, Surface/Section, MoneyValue/Amount composition, operational Row, Sheet/Dialog overlay primitive, ScreenState/EmptyState/Notice. Each: contract, anatomy, states, ownership boundary, tests, ≥1 real consumer before broad adoption.
- **W3 — AUX shell.** Harden Header/BottomNav/FAB/route chrome/safe areas/keyboard hiding/overlay z-order/scroll border; route transition to Standard 200ms; FAB label to 13px floor; separate QuickActionSheet shell (AUX) from sale/expense form content (Finance feature patterns). No generic overlay conversion of feature workflows.
- **W4 — Pilot screens.** Home first (shell + value zone + period control + rows + states), then Finance (high-sensitivity). Explicit screen contracts before edits; remove local duplication only after shared replacement passes tests; owner-facing visual review artifact.
- **W5 — Feature patterns.** Micro-owned patterns documented + extracted where bounded: finance value zone, period controls (chip variant), order rows/detail, fact cards, knowledge states (via State Adapter), integrity-check presentation, tools/inventory patterns, filters with staged apply. Nothing enters the 29-file Standard.
- **W6 — Screen migration & old-style retirement.** MIGRATION_MATRIX.csv for every route/screen; migrate one feature boundary at a time; deprecate replaced styles; remove old styles only when no consumer remains (dead tokens, dead tooltip, duplicated CSS blocks) with tests green.
- **W7 — Dark Mode preparation.** `DARK_MODE_BOUNDARY.md` only: isolated semantic layer proposal (surface/text/border/state/chart/focus/overlay/elevation roles), parity test plan, owner gate. No activation, no default change, no Standard change.

## 6. Stop conditions (hard stops)

Stop and write a failure report if: either `main` would be modified; a product/financial/sync/permission/domain decision is required but not provided; existing Micro words or financial meanings would need to change; a new palette value or second token source would be required; a structural cycle, unsafe dependency edge, or unbounded duplication is discovered; a test fails unexplainably; a rollback boundary cannot be reproduced; GitHub upload fails or the token would need exposure; a requested feature does not exist in Micro and would require inventing product requirements.

## 7. Explicit confirmations

- **Prototype v0/v1 is evidence only** — not product truth; nothing from it is copied into Micro by this run. ✅ Confirmed.
- **AI Assistant / LLM / chat is out of scope.** ✅ Confirmed.
- **Micro `main` and Documents `main` are not modified by this run** (work happens on `micro-standard-ui-aux-integration-20260914` and the Documents run branch only). ✅ Confirmed.
- **The 29+2 Standard package is not modified by this run.** Any Standard gap found is reported, not patched. ✅ Confirmed.
- **The lead and all agents can state the strategy, ladder, fixed decisions, wave plan, and stop conditions consistently.** ✅ Confirmed (agents 1–2 reports on file; agents 3–5 briefed per-wave).

## 8. Deferred / out of scope (explicit)

Deferred: chart implementation (contract floors recorded only), sort policies, skeleton universalization, `index.css` full split, page-splitting of oversized files, dark-mode activation, state-word orthography unification, link-ink ratification, warning/withdrawal role final fate (Micro-owned until per-role owner decision).
Out of scope: financial formulas, posting/reversal semantics, synchronization, permissions, backend, AI assistant, accounting-policy work.
