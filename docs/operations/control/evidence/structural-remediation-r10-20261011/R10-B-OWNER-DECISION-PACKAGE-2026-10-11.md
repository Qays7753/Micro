# R10-B W0 — Owner Decision Package

**Date:** 2026-10-11 · **R10B_BASE_SHA:** `ffc54eb1150932c9bba88b48a7c38275f2a3effa` · **Branch:** `refactoring/r10b-systemic-findings-root-fix-20261011` (created from BASE_SHA; W0 evidence only — no code remediation performed)

This package lists every decision the owner must take (or ratify) before/alongside accepting the W0 gate. R10-A's OD-A..OD-G are carried forward with their W0 resolutions; new decisions surfaced by the W0 research are OD-8..OD-13. **Routine implementation choices inside the approved waves are already delegated by the approved policy (canonical prompt §8) and are NOT re-asked here.**

---

## OD-1 (carries R10-A OD-A) — Protected-baseline differential policy — RATIFY

W0-D verified all three baselines live (all ancestors of main): **primary semantic/invariant `fc2ae6e7`** (isolates the R0–R9 program delta), **secondary weakening/process `25594773`** (guard-hardening era), **historical A-to-Z `5eacbe38`** (spans both programs). Proposed policy: each baseline is used only for what it can prove; no proof type forced onto one baseline. Differential execution (byte/semantic comparisons on protected surfaces) is post-gate work inside the relevant waves.
**Decision:** ratify the three-baseline policy (or name a different primary).

## OD-2 (carries OD-B) — PRESERVE_BY_DESIGN ratification — RATIFY 5/5 with 2 registered soft spots

RV5's 10-element re-ratification: all 5 cards (IndexedDbLocalStore, MemoryLocalStore, craft-order/policies, storage/local/types.ts, transferFamilyValidators+ADR-017) pass 9–10 of 10 elements; growth is machine-enforced for all 5 (ratchet baseline v2 + 27-entry reanchor ledger, verified live). Two honest soft spots, both already registered in the card itself: craft-order/policies **tests** (element 6: 0 direct, ~171 indirect, gap honestly recorded) and its **generic exit criterion** (element 5).
**Decision:** ratify the 5 cards (soft spots remain registered owner-gated gaps), or reject any card with instructions.

## OD-3 (carries OD-C) — OUT_OF_SCOPE trigger specificity — APPROVE B1 batch

SCOPE-001/SCOPE-002/UX-002 carry byte-identical generic reason/next_action with no observable trigger/detection (F-034). The repo's own best pattern exists (INDEPENDENT-TRACKS-RECORD R/S/T/U/V/W/X; comparison rows L-C/L-E/L-G/V7/V10/V12 with recorded triggers — two weak spots noted: V10 circular, V7 no in-repo measurement harness).
**Decision:** approve the B1 batch writing per-item observable triggers + detection methods (or reclassify per the rules: an item without a defensible boundary becomes DEFER/FIX_NOW).

## OD-4 (carries OD-D) — BLOCKED items — CONFIRM with 2 corrections

PILOT-001: blocker stands (external pilot prerequisites). LEGAL-001: cited blocker **stale** (FIN-007 VERIFIED 2026-09-22) → real blocker is external specialist selection (NF-027). DEVICE-001: half-stale (REL-001 VERIFIED; UX-001 + device availability stand) (NF-028).
**Decision:** confirm continue/withdraw per item; approve the two dated reason corrections in B1.

## OD-5 (carries OD-E) — PR #351 (R10-A prompt PR) — OWNER-ONLY merge decision

Untouched by R10-B (verified unmerged; head `e3be3897`). Sequencing note: merging #351 or #352 moves main and opens a new evidence window; the R10-B branch is based on `ffc54eb1` and does not require rebasing (different files), but post-merge reconciliation (F-033 batch + view regen) must ride the R10-B/R10 closure PR, and any "current" phrasing in the R10-A package stales (E-UNV-005 inventory).
**Decision:** owner merges or holds; no action by R10-B.

## OD-6 (carries OD-F) — W0 acceptance + wave authorization — THE GATE DECISION

Accept this W0 package and authorize waves R10-B1..R10-B6 as scoped in `R10-B-REPAIR-CARDS-2026-10-11.md` on the same branch/PR. Summary: 71 finding records (37 R10-A + 34 new); dispositions 54 FIX_NOW (grouped into 6 waves), 16 precise DEFER cards, 1 disproved (retraction); 0 PRESERVE findings (5 cards ratified separately at OD-2).
**Decision:** accept W0 + authorize waves (or amend scope).

## OD-7 (carries OD-G) — Bundle re-anchor pattern — ACKNOWLEDGE

The R9 pattern (main-red resolved by documented re-anchor per protocol, incl. the post-push `7ddc3ef6` repair) remains the standing process. W0 adds: the three-Node-major divergence across environments (local 24 / CI 22 / Replit 20) is now documented (F-024 package).
**Decision:** acknowledge the pattern as accepted process, or require a stricter pre-push cloud-anchor protocol for R10-B waves.

## OD-8 (NEW) — RC-1 scope: minimal vs uniform tamper-evidence — REQUIRED before B2

Minimal: count/gate only the 4 owner families (the only full gaps; golden churn = 2 current-pair goldens + MANIFEST + counters characterization). Uniform: also count the 9 required-but-uncounted families (NF-013) for symmetric evidence (larger one-time churn). Mechanism option either way: `satisfies`-enforced family registry (compile-complete; the `influentialSnapshotFamilies.ts` precedent) so future families cannot miss the counters.
**Decision:** minimal (recommended: closes exactly the proven gap) vs uniform (recommended if the owner wants one-time symmetry); registry mechanism yes/no.

## OD-9 (NEW) — F-024 Replit hook: option A/B/C — REQUIRED before B5

Full comparison in RC-4. **Recommended: C (retire)** — broken since 2026-10-10, zero current documentation/consumers, CI+Pages anchor all real verification. If a Replit post-merge safety net is wanted: **A+B together** with a re-derived `timeoutMs` (RV4-N4: 180s likely insufficient).
**Decision:** A / B / C (fail-closed contract preserved in every option).

## OD-10 (NEW) — Application-internal seam policy (NF-005) — DEFER-card ratification

108 ungoverned cross-house deep imports inside the application layer (R6 scoped UI→application only). Options: (a) declare shared-infrastructure houses (time, formatting, resultCodes, identity) exempt-by-design + ratchet the rest; (b) accept and document the open internal graph.
**Decision:** (a) schedule a guards wave / (b) document now.

## OD-11 (NEW) — MoneyMinor branding (F-013) — DEFER-card ratification

Branding is feasible (326 sites) but sibling concepts stay raw; compensating controls verified live (integer kernel, sole formatter, frozen surface, moneyLayerGuard).
**Decision:** keep unbranded with documented policy (recommended) or schedule a branding wave.

## OD-12 (NEW) — Route-focus + document.title addition (NF-015) — visibility decision

A B4 card adds navigation focus management and per-route `document.title` (a11y semantic addition; no visual change). Surfaced because it *adds* runtime behavior rather than only repairing a defect.
**Decision:** include in B4 (recommended) or defer to the UI track.

## OD-13 (NEW) — PILOT detection methods (14 canonical items) — scope decision

The 14 `PILOT_EVIDENCE_REQUIRED` items (BE-004, BE-005, V-001..012) define an event but no detection method (R10-A finding, count corrected 17→14). B1 can add docs-only detection-method specifications (each item gets: what to measure, how, threshold, decision rule) without touching product code.
**Decision:** include detection-method specs in B1 (recommended) or defer to the pilot-protocol design.

---

## What is NOT being asked

- Schema 38 / Export 30 stay (no wave touches them; RC-1 is count-only).
- Financial meaning, rounding, dates, historical interpretation, rejection semantics: unchanged by every card.
- Visual UI/UX, copy, tokens, navigation: unchanged (B4 cards are a11y-semantics-only, test-enforced).
- Security permissions, repository settings, deployment: out of scope.
- No branch/PR deletions, no cleanup, no merges — BRANCH_AND_PR_ONLY held.

## Decision summary table

| OD | Subject | Recommendation | Required before |
|---|---|---|---|
| OD-1 | baseline policy | ratify three-baseline policy | differential work |
| OD-2 | PRESERVE cards | ratify 5/5 | B1 |
| OD-3 | OUT_OF_SCOPE triggers | approve B1 batch | B1 |
| OD-4 | BLOCKED items | confirm + 2 corrections | B1 |
| OD-5 | PR #351 | owner-only | — |
| OD-6 | **W0 acceptance + waves** | **accept + authorize B1..B6** | **the gate** |
| OD-7 | re-anchor pattern | acknowledge | — |
| OD-8 | RC-1 scope | minimal + registry | B2 |
| OD-9 | Replit hook | C (retire) | B5 |
| OD-10 | app-internal seam | document now, ratchet later | — |
| OD-11 | MoneyMinor branding | keep unbranded (documented) | — |
| OD-12 | route focus + titles | include in B4 | B4 |
| OD-13 | PILOT detection methods | include in B1 | B1 |
