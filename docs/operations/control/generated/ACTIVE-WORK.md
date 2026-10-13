# Active Work

> مولّد آليًا من Workstream claims؛ يشمل المراجعة المطلوبة حتى لا يختفي Claim قديم.

| ID | الحالة | الفرع | PR | البنود | الخطوة التالية |
|---|---|---|---|---|---|
| WS-216 | IN_PROGRESS | `refactoring/r10b-complete-b1-b6-20261011` | 356 | ARCH-007 | R10-B Phase 5 EXECUTED (NF-020 part 2 complete after the D1 gate): the app tsconfig test exclusion is REMOVED (353 test files now typechecked; 428 surfaced errors fixed to zero via controlled narrowing insertions + fixture drift repairs), and the 18th guard check-test-typecheck-coverage.mjs proves LIVE (tsc --listFilesOnly) that every test file stays inside the typecheck program — 4 negative tests, wired into pnpm guards. pnpm check exit 0 on the final tree (root 811/811; app 358/2,636; 18 guards; D1 entry byte-identical 631,903/155,290 — test-only slice). PRIOR: D1 (OD-14) gate-passed+pushed green on CI+Pages; OD-9=C retirement pushed. NEXT: Phase 6 — B6 final closure: mechanical re-check of all 54 FIX_NOW IDs + 16 precise DEFER cards + the disproved item + 5 PRESERVE_BY_DESIGN cards against the final tree; defect-family verification; five sequential read-only verification agents on the final head; full final test+guard chain; final bundle measurement; final PR-ready report + Merge Manifest; leave PR #356 open for owner review. |
