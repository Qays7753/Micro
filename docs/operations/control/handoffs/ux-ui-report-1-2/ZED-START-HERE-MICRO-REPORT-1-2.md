# Zed AI — Start Here for Micro UX/UI Reports 1–2

## Purpose

This is the entry point for the approved UX/UI implementation handoff for Micro. Read this file first, then read the linked implementation package in full before inspecting or changing code.

## Repository and baseline

```text
Repository: Qays7753/Micro
Approved implementation baseline: b0b4cea66a06c295c65eb895dc2b9067c8b732cf
Audit branch used for the refreshed review: audit/replit-ux-ui-refresh-20260921
Implementation branch: create a new independent branch; never work directly on main
```

The approved baseline is the current `main` state that includes OPS-003. Do not silently switch to a newer baseline. If `main` has moved, stop and report the new SHA and wait for owner approval or a fresh delta.

## First reading order

Before editing anything, read these files in this order:

1. `AGENTS.md` — repository-level agent rules and post-Group-6 governance.
2. `docs/operations/control/generated/AGENT-BRIEF.md` — current operating brief.
3. `docs/operations/control/generated/ACTIVE-WORK.md` — active tracker context.
4. `docs/operations/control/generated/NEXT-ACTIONS.md` — current next-action and gate context.
5. `docs/operations/control/generated/MASTER-TRACKER.md` — source tracker for work items and statuses.
6. `docs/operations/control/product-scope.md` — product and scope boundaries.
7. `docs/operations/current-state.md` — current system state.
8. `MICRO-REPORT-1-2-ZED-IMPLEMENTATION-PACKAGE.md` — the binding implementation scope for this task.

The repository governance and tracker remain authoritative for development process, safety gates, workstream status, and delivery evidence. The UX/UI package is authoritative only for this task’s approved Z1/Z2 product-scope decisions. If the governance/tracker requires a gate or evidence that is stricter than this package, follow the stricter rule.

## What this task is

Implement only the two approved UX/UI waves from the implementation package:

- **Z1:** Home as a clearer daily decision surface, fixed Home actions, contextual collection, Home states, and ownership/links inside the existing five destinations.
- **Z2:** Work/order stage and next-action clarity, affected sale/expense/contextual-collection outcome grammar, correction/reversal language, and the limited OPS-003 non-regression behavior that intersects manual expense.

This is not a general Micro redesign and not a general cleanup task.

## What this task is not

Do not implement or infer:

- a new navigation destination or a change to the five existing destinations;
- a new financial Quick Action;
- recurring expense in Home;
- a full recurring-expense UI redesign;
- final palette, typography, visual identity, or motion system;
- tablet or desktop layouts;
- Charts, Goals, Gamification, Dark Mode, broad personalization, or broad assistant work;
- Architecture, refactoring, file moves, module reorganization, dependency/toolchain repair, Vite/Workflow repair;
- Database, API, Storage, Auth, schema, migration, export, Domain, Business Logic, financial calculation, or accounting-policy changes.

Any idea that is not explicitly within Z1/Z2 and its acceptance criteria is deferred automatically.

## Required execution behavior

1. Confirm the baseline SHA and a clean working tree.
2. Create an independent implementation branch.
3. Produce a short understanding card before editing: in-scope, out-of-scope, invariants, failure conditions, acceptance criteria, and rollback boundary.
4. Execute Z1 only.
5. Run the required targeted and full gates.
6. Review the complete diff and produce the Z1 delivery report.
7. Stop at the Z1 gate. Do not start Z2 if required tests fail or the diff leaves the allowlist.
8. Execute Z2 only after Z1 is accepted.
9. Run the required targeted, OPS-003 non-regression, and full gates.
10. Review the complete diff and produce the Z2 delivery report.

## Change control

Use the file allowlist and protected-file protocol in the implementation package. A necessity note never authorizes a conditional supporting-file edit by itself. If a conditional supporting file is needed, record the exact criterion, minimal diff, tests, and risk, then stop for separate owner approval.

If implementation requires a Domain, Storage, migration, financial policy, route-count, destination-ownership, or Business Logic change, stop. Do not hide the change inside a UX/UI commit.

## Evidence required at each wave close

The delivery report must include:

- baseline SHA and implementation branch;
- files changed and why;
- visible behavior changed;
- contracts preserved;
- tests and exact commands run;
- results and blockers;
- full-gate status;
- visual/RTL/mobile checks and any precise blockers;
- protected-file exceptions, if any;
- deferred work;
- rollback boundary;
- owner decision required, or an explicit statement that none is required.

## Final source of truth

The binding implementation contract is:

```text
MICRO-REPORT-1-2-ZED-IMPLEMENTATION-PACKAGE.md
```

The project process and tracker remain binding alongside it:

```text
AGENTS.md
docs/operations/control/generated/AGENT-BRIEF.md
docs/operations/control/generated/ACTIVE-WORK.md
docs/operations/control/generated/NEXT-ACTIONS.md
docs/operations/control/generated/MASTER-TRACKER.md
docs/operations/control/product-scope.md
docs/operations/current-state.md
```

If there is any conflict or ambiguity, stop and report it. Do not choose silently.
