# Active Work

> مولّد آليًا من Workstream claims؛ يشمل المراجعة المطلوبة حتى لا يختفي Claim قديم.

| ID | الحالة | الفرع | PR | البنود | الخطوة التالية |
|---|---|---|---|---|---|
| WS-216 | IN_PROGRESS | `refactoring/r10b-complete-b1-b6-20261011` | 356 | ARCH-007 | R10-B5 PARTIAL + NEW BLOCKER: 11/13 findings closed (heads cbe38120..257d0f54; E-UNV-008 drill 6/6; CI+Cloudflare green on 4a993836 with entry 631,833/155,281, 19-byte margin). NEW FINDING R10B-NF-038 (S2, merge-blocking, discovered on the wave push): the CI build identity (merge SHA) cascades through the chunk graph and re-rolls the entry gzip by up to ~63 bytes with zero content change — head ca9fe368 drew 155,310 (+10 over 155,300) and is red on CI from this alone. OD-14 published (A scoped entry reduction / B CI identity pinning with the PWA tradeoff / C documented risk acceptance); the ceiling is not an option. F-024 also gated on OD-9. NO further code commits before OD-14 (every commit is a draw, including the owner's merge); NF-020 part 2 and B6 wait on it. IN_REVIEW after PR; VERIFIED only with on-main evidence. |
