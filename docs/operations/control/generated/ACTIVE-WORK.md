# Active Work

> مولّد آليًا من Workstream claims؛ يشمل المراجعة المطلوبة حتى لا يختفي Claim قديم.

| ID | الحالة | الفرع | PR | البنود | الخطوة التالية |
|---|---|---|---|---|---|
| WS-216 | IN_PROGRESS | `refactoring/r10b-complete-b1-b6-20261011` | 356 | ARCH-007 | R10-B/D1 EXECUTED (OD-14=D1 owner-approved): commit 0a829bf6 removes the build identity from the JS entry and carries it in ONE index.html meta tag (strict build-time validation + closeBundle fail-closed carrier/leak verification; guarded one-shot DOM read in buildIdentity.ts). Gate PASS on the committed tree: 30 identity draws byte-identical (index-CPVmJmgX.js 631,903/155,290, sigma-hat 0), same-identity rebuild identical, null-vs-identity differ only in index.html+sw.js, headroom 10 >= 2*sigma-hat under untouched 650,000/155,300. Surfaces re-anchored same-PR (local 2,683,356 / cloud 2,683,446); ratchet R10B-D1-IDENTITY-CARRIER. NEXT: push D1 + post-push PWA/CI/Cloudflare evidence + five reviewers on the implementation, then OD-9=C as a separate revertible commit (no-consumer proof first), then NF-020 part 2 (exclusion removal + narrowing insertions + coverage guard), then B6 final closure (matrix re-check, five verification agents, full chain, final report + Merge Manifest). Merge remains owner-only. |
