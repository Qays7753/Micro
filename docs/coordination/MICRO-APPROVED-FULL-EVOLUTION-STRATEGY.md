# Micro — Approved Full Evolution Strategy

**Status:** ACTIVE — latest approved strategy
**Approved:** 2026-09-26
**Repository:** `Qays7753/Micro`
**Verified baseline at preparation:** `origin/main` = `3d5503a20e173500856dbe9946b84a3e475123f6`
**Owner:** Qays

## 1. Mission

Evolve Micro completely and safely from its current baseline while preserving its working behavior, financial meaning, data contracts, components, patterns, local-first boundaries, and user control.

This is **not** a screen-copy project, Studio import, rewrite, blind migration, or permission to replace complete Micro components with external JSX/CSS. Bold Modular V2 supplies visual direction and reference composition only. Documents Micro Standard v2 supplies visual contracts according to its scope. Micro remains the authority for product behavior, data, financial meaning, contracts, storage, export/import, operational truth, and existing functionality.

The intended outcome is one coherent Micro system, not two competing design systems and not multiple competing financial or semantic sources.

## 2. Five context groups

The groups are context and governance boundaries. They are not a fixed PR count. PR boundaries are determined by affected files, tests, risk, reviewability, and rollback.

### Group 0 — Baseline, reconciliation, and read-only gates

Produce, from the live `origin/main` and accepted evidence:

- baseline and current-state confirmation;
- one semantic source-of-truth reconciliation matrix;
- classification of active, historical/superseded, and owner-conflict references;
- comparison against the accepted Structure/Architecture/Code Organization scan, without repeating the full scan unless a real gap exists;
- Code/Logic Maturity & Evolvability record;
- cross-cutting review of security/privacy, compatibility/migration, determinism, recovery, diagnostics, test quality, user control, performance, dependency/license risk, accessibility, RTL, and operational readiness;
- Repair Card mapping, minimum safe waves, dependencies, risks, acceptance criteria, and rollback boundaries;
- explicit owner decisions required.

**Group 0 is read-only.** It must not edit runtime code, move files in bulk, create a `features/` layer, change tokens/CSS, change financial meaning, alter schema/export, delete historical sources, clean branches, merge, or hide refactoring inside documentation work.

### Group 1 — Trust and input safety

Address only approved, evidenced issues involving:

- honest financial explanations and comparisons;
- validation and Arabic error messages;
- loss of typed input when closing sheets/drawers;
- draft versus financial-event wording;
- back, cancel, undo, return navigation, focus, keyboard, safe area, and touch behavior;
- destructive actions and explicit confirmation;
- state/error/selection cues that do not rely on color alone.

It must not silently change financial policy, calculation meaning, schema, export semantics, or historical records.

### Group 2 — Financial meaning and contracts

After owner decisions, reconcile and implement only approved financial work across:

- Domain/Application calculation ownership;
- UI, report, export/import, and fixture equivalence for the same sample and period;
- financial contracts, invariants, states, snapshots, reversals, idempotency, and historical protection;
- focused tests for normal, incomplete, unknown, negative, retry, stale, and failure cases;
- explicit distinction between implementation consistency and accounting-policy correctness.

Micro currently provides internal management indicators. Do not call them formal financial statements or official accounting profit without appropriate qualified review.

The following remain explicit owner gates; no agent may choose silently:

- delivery fee treatment in debt/collection;
- delivery cost treatment in period result;
- break-even definition and basis;
- direct-sale full-collection assumption versus explicit/unknown collection.

### Group 3 — Micro-owned design foundation and reference screens

Adapt the approved visual direction into Micro's existing implementation:

- preserve Micro primitives, contracts, feature patterns, data, and behavior;
- use one token bridge and one source of truth;
- no Studio raw-code import and no competing token system;
- preserve Arabic-first RTL, phone-first composition, accessibility, safe areas, keyboard behavior, Light-first direction, and Dark regression;
- validate three reference screens through states, touch, data density, and actual runtime behavior before broader rollout;
- keep financial meaning and calculation ownership in Micro's domain/application layers.

### Group 4 — Controlled product-wide application and closeout

Extend only validated patterns to remaining Micro surfaces, with:

- route and feature coverage;
- complete and incomplete/no-data/error/pending/unknown states;
- Android/iOS platform considerations where relevant;
- accessibility, touch, safe area, keyboard, responsive RTL, and Dark regression checks;
- final concept/source-consumer-display-export-test-documentation matrix;
- unresolved decisions and limitations;
- owner closeout.

No broad rollout occurs before the reference slice is accepted.

## 3. Mandatory controls for every problem and PR

### One Repair Card per root cause

Each independent problem or root cause gets one Repair Card containing:

- symptom and evidence;
- confirmed cause or explicit reproduction hypothesis;
- required user/data behavior;
- authoritative contract/source and all consumers;
- allowed change and protected non-goals;
- acceptance cases, including failure and historical cases where relevant;
- tests/evidence and rollback boundary.

Duplicate identifiers remain linked to one card instead of being solved multiple times.

### Truth-Consistency Check

Before a PR changes a shared number, state, label, token role, or behavior, it must map:

`definition → calculation/derivation → Domain/Application/Storage consumers → UI/report → export/import → tests/fixtures → documentation → historical effect`

A PR is rejected if it fixes one surface while another consumer still calculates or labels the concept differently, unless the difference in period or purpose is explicitly documented and tested.

### Evolvability Check

Before a PR adds or changes a capability, it must state:

- where a future developer will discover the capability;
- the single owner of its layer and contract;
- its types, schemas, invariants, guards, and tests;
- whether it adds abstraction, duplication, or dependency and why;
- how a future extension can reuse the correct source without creating a parallel source.

### Cross-Cutting Safety Check

For each affected PR, record the result or `NOT_APPLICABLE` with a reason for:

- security, privacy, secrets, diagnostics, and dependency supply chain;
- schema/export compatibility and migration/recovery;
- deterministic dates, periods, timezone, rounding, Decimal, locale, and bidi;
- reload/offline/partial-write/duplicate-retry/import-failure behavior;
- error classification and supportability;
- contract, invariant, negative, equivalence, integration, and anti-flaky tests;
- cancel/back/undo, input preservation, explicit confirmation, and no hidden transitions;
- performance, bundle budget, accessibility, RTL, Android/iOS, and operational evidence.

## 4. Classification and gates

Every finding is classified:

`FIX_NOW` · `PRESERVE` · `DEFER` · `OUT_OF_SCOPE`

Every material statement is distinguished as:

`VERIFIED` · `INFERRED` · `UNVERIFIED` · `NOT_EXECUTED` · `DEFERRED` · `BLOCKER` · `OWNER_DECISION_REQUIRED`

Every group ends with a report and owner review. No next group starts automatically.

No structural refactoring, bulk moves, or code-organization change may begin before the read-only Group 0 findings are reviewed and explicitly accepted. No semantic or financial change may be hidden inside structural work. No direct `main` change is allowed.

Tests are targeted to the affected slice and full gates run at PR/group boundaries, not after every small action without a reason.

## 5. Authority boundaries

- Micro contracts, policies, decisions, live code, tests, and current state own Micro behavior and meaning.
- Documents Micro Standard v2 owns visual contracts within its scope: roles, tokens, buttons, states, geometry, RTL, accessibility, and composition guidance.
- Bold Modular V2 owns visual direction and reference composition only.
- V2 Studio and fixtures are evidence and inspiration, not production sources.
- Reports and chat messages are evidence or proposals, not authority by themselves.

If two current sources conflict, record the conflict and stop at the point where the choice would change product behavior, financial meaning, permissions, architecture, or historical interpretation.

## 6. Required result before implementation

Before ZAI receives an implementation prompt, the owner must have:

1. reviewed the Group 0 reconciliation and maturity output;
2. accepted or rejected the classified findings;
3. resolved owner decisions that materially affect behavior or financial meaning;
4. accepted the first implementation slice, its files, non-goals, tests, and rollback boundary;
5. confirmed that the next action is a controlled branch/PR, never direct `main` work.

This document is the current approved strategy. Do not replace it with an older plan or reintroduce deprecated alternatives without an explicit owner decision and a new dated revision.
