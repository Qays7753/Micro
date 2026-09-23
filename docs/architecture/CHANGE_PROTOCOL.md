# Change Protocol — how to change an existing definition safely

Changing a definition is exponentially riskier than adding one. This protocol is mandatory for: tokens, primitives, AUX behavior, state words, navigation destinations, feature patterns, and screen compositions.

**Bold Modular V2 / Phase 0 (2026-09-23):** the owner-approved V2 documents govern the **new visual direction**, while Micro Standard and `styles/vf-tokens.css` still describe the **current implementation**. This documentation reconciliation does not modify either runtime tokens or the Documents package. Before any V2 implementation, produce a read-only V2-to-Micro integration mapping and obtain its review; use the existing bridge and components in later authorized work, never copy studio fixtures/JSX/CSS or create a competing token source. V2 is Light-only visually in this wave; Micro's active Dark theme (ADR-009) remains intact and must be protected against regressions. `UX-001` remains `DEFERRED`.

## 1. Impact analysis (before any edit)

Answer in writing (PR/commit description or run report):

1. What exactly changes, and why now?
2. Which layer(s) does the change touch on the authority ladder (Standard → mapping → primitives → AUX → patterns → screens → domain)?
3. Does it change product meaning, financial meaning, or a state word? **If yes: hard stop — owner decision required** (a UI run may not rename Micro words or alter financial semantics).
4. Does it introduce a second token source or copied studio style? **If yes: hard stop.** Does it introduce a new palette role or value without an approved V2 mapping, applicable Standard reconciliation and an authorized implementation wave? **If yes: hard stop.** V2 approval alone does not change the current Documents Standard or license raw colors in components.

## 2. Consumer inventory

- Grep the exact token/class/component/word; list every consumer file.
- Classify each consumer: must-adapt / unaffected / must-not-break (frozen tests).
- A change with unknown consumers is not ready — the runtime-cycle and entity-touchpoint guards plus your grep ARE the inventory; run them.
- **Scope rule (audit lesson):** censuses must cover ALL source roots — `pages/`, `components/`, `app/`, `pwa/`, `contexts/` — never pages alone. The `legacyClassCensus.test.ts` guard enforces this mechanically.

## 3. Test plan

- Which existing suites cover the consumers? (journey/dom, primitives, sheet, lock-gate, exact-values…)
- Which new assertions prove the change? Every changed contract needs a test that would have failed before.
- Full `pnpm check` green is the entry bar, not the exit bar. Future V2 Light changes also need visual/component evidence on real affected surfaces and regression coverage for Micro's existing Dark Mode; this does not authorize a Dark redesign.

## 4. Migration notes

- Old value → new value, with date and reason.
- If a legacy name survives as an alias, record it (aliases are temporary and enumerated).
- If a legacy rule is retired, prove 0 consumers first (grep + guard), then remove in the same change — never "dead code for later".
- Exact-duplicate CSS removal is provably safe (cascade-idempotent); partial-overlap families are NOT — they need computed-style equality plus visual review.

## 5. Rollback boundary

- Every change lands as a revertible commit (no force-push, no squashing across wave boundaries).
- Record the pre-change SHA in the run's `ROLLBACK_MANIFEST.json` when a run folder is active.
- Verify rollback in a clean worktree for wave-scale changes: `git worktree add … <pre-sha>` and run the affected checks.

## 6. Change-type specifics

| Changing a… | Extra mandatory steps |
|---|---|
| Token | after approved V2-to-Micro mapping and applicable Standard reconciliation, change once in `vf-tokens.css`; visual captures of affected Light surfaces plus existing Dark regression; guard stays green. No token-only recolor is proof of V2 composition |
| Primitive | update `COMPONENT_CONTRACTS.md` + primitive tests; check every consumer compiles and renders; bump no version silently |
| AUX behavior | safe-area/keyboard/back/focus/scroll/320px verification; sheet + navigation suites |
| State word | **owner decision only** — then adapter + all consumers + frozen-word tests updated together |
| Navigation destination | return-path contract (`withFrom`) audit for every inbound link; route-kind classification; ROUTE_TEMPLATES sync; back-behavior test |
| Feature pattern | state matrix re-verified; no Standard package edits |
| Screen composition | density caps re-checked; journey tests updated honestly |

## 7. Honesty requirements

- Never claim unexecuted verification. Mark NOT_RUN with a reason.
- A failing test is a stop condition, not a TODO — explain it or fix it; never guess.
- Reports state exact numbers (screens, usages, tests) — no vague percentages.
- When a session is lost or a claim cannot be reproduced from the live tree, disclose it and re-execute — the transcript is evidence, never truth.
