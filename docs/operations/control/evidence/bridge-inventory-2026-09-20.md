# Bridge inventory — 2026-09-20

**Repository:** `Qays7753/Micro`  
**Source:** `git ls-remote --heads origin`  
**Current `main`:** `81fa524df48ee2d84161dd2248cbeff123dc08c1`  
**Current remote branches:** **41**  
**Prior reported count:** 37; **delta:** +4 branches created by the Package A/B and Tracker closure PRs.

## Safety boundary

This is a read-only inventory. No branch was deleted, renamed, force-pushed, or modified.

## Disposition summary

| Disposition | Count | Meaning |
|---|---:|---|
| `DELETE_CANDIDATE_AFTER_PROVENANCE` | 3 | merged/squash but tip not reachable; provenance first |
| `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` | 31 | merged and branch tip reachable from main |
| `KEEP_NO_TOUCH` | 3 | protected keep/* branch; do not touch |
| `KEEP_PERMANENT` | 1 | main; keep permanently |
| `REVIEW_REQUIRED_CLOSED_UNMERGED` | 3 | closed unmerged PR; review separately |

## Branch-level inventory

| Branch | Head SHA | In main? | PRs | Initial disposition |
|---|---|---:|---|---|
| `agent/group1-traceability-finalize` | `876ff64aeb150b4a931a7208d97cb0f7dbbd4b50` | no | #143 MERGED | `DELETE_CANDIDATE_AFTER_PROVENANCE` |
| `docs/operations-control-closure` | `877c92bbdae904c6553f24fbe971445b31fbf671` | no | #189 MERGED | `DELETE_CANDIDATE_AFTER_PROVENANCE` |
| `docs/operations-control-v2` | `8e8d4ce3f28ca5d1d2c10331a610f83736715512` | no | #188 MERGED | `DELETE_CANDIDATE_AFTER_PROVENANCE` |
| `docs/pre-pilot-safety-closure-20260920` | `7ff82767793f2537a3955fd1a5282f03304bca1d` | yes | #192 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `docs/pre-pilot-safety-verified-20260920` | `bc85b343e7f22f29b92dfa3a9c0b90003b3cfa1d` | yes | #193 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `docs/wave-4-1-product-ux-blueprint` | `160fdb24e6f27c1120eef0d58bde4dda6de057e7` | yes | #165 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `docs/wave-4-2-final-report` | `ad46a8e711fc9c31e3ee309f764bf9104cea8746` | yes | #171 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `docs/wave-4-3-final-report` | `24ed0066ad33e2652b247e021610d9cc274cb5cc` | yes | #179 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `docs/wave-4-3-report-final-sha` | `39da1a1887b333f421b2d5790076ad97b448bde2` | yes | #180 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `docs/wave-4-4-final-shas` | `094eb55581cf9d9657bae60ae8cb0552bb7a248c` | yes | #187 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `feat/wave-4-2-1-shell-navigation-naming` | `b5bcb83ff473b7178752dedcbd6f653e4792de1c` | yes | #166 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `feat/wave-4-2-2-clean-tools` | `66b7ca39971b5fa00fb023d8e7c25c488ada2d58` | yes | #167 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `feat/wave-4-2-3-settings-data-backup` | `ee2371846434baa2c2904a3cdbcd9dc24446c05b` | yes | #168 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `feat/wave-4-2-4-finance-more-integrity` | `604c2a3b24aa398afb62c571c3ff983d406e5c7b` | yes | #169 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `feat/wave-4-2-5-policies-catalog-wallet-destination` | `59b987b49068d7742766ea18e62e6f194a0445d2` | yes | #170 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `feat/wave-4-3-1-design-foundations-app-surface` | `65e1d9c90d47aa39b89181234dfd8094aa179f0c` | yes | #172 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `feat/wave-4-3-2-home-quick-actions` | `48c3a6fdf8bd01bbb4adce2d0e1ed4e360d387d7` | yes | #173 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `feat/wave-4-3-3-finance-obligations` | `fa19fb391ea07c703a14eca14061258f7d5b4399` | yes | #174 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `feat/wave-4-3-4-work-orders-sharing` | `0fd92533ac507666f839c33867b935d22341a7f2` | yes | #175 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `feat/wave-4-3-5-cash-wallets` | `5c0dc96299c072e3af4d2dc9d6ec05ebb692832c` | yes | #176 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `feat/wave-4-3-6-deep-screens` | `7d9b763305aa87fdd3e8d2510b284ba812ef9653` | yes | #177 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `feat/wave-4-4-1-residuals` | `1c74310484da932bd2f6e176e31a399bff58d58a` | yes | #181 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `feat/wave-4-4-2-formatters` | `ae8180a2e22f3406aead54a1b297ac8e71749221` | yes | #182 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `feat/wave-4-4-3-arabic-rtl-content` | `6f8435e42845b21a1d4e33a2a10686aad5be80c1` | yes | #183 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `feat/wave-4-4-4-states-recovery` | `9fe3fb60d097bcb9a6874eb7f4f99be7d45b4855` | yes | #184 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `feat/wave-4-4-5-accessibility` | `8edbbca4a01ec2a4063130f6b91d01569aa26359` | yes | #185 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `feat/wave-4-4-6-device-pwa-regression` | `4f758daf9f733cb5dac0e0e0ecd053172b16cc70` | yes | #186 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `fix/pre-pilot-safety-a-b` | `b44edcda67d97b51cbf6d4b1175fe39361d7c67a` | yes | #190 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `fix/pre-pilot-safety-b` | `8cfc30347655079f32316a542735098240dec4ba` | yes | #191 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `fix/product-journey-verification-20260916` | `9a3479627ccf46c7a5ebe1867812a692fc7c2aa2` | yes | #160 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `fix/wave-1-correctness-truth` | `33693f43f3da37899af9f2ac2193d2f365f34837` | yes | #162 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `fix/wave-2-financial-data-foundations` | `12ded7c0f114f0b1f2f568aec4d57ba354905f83` | yes | #163 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `fix/wave-4-3-review-p2` | `935b3cefd03144ce36ea3740aeb08f2e5b946bcc` | yes | #178 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `jules-15390500015238590867-77e56821` | `72db7abd2a8fb6f7f9884630f8d50448b20dcf7f` | no | #157 CLOSED | `REVIEW_REQUIRED_CLOSED_UNMERGED` |
| `keep/DO-NOT-DELETE-founding-history` | `087b24f296f2cef9dc0c4218f4299182269bf52e` | yes | none | `KEEP_NO_TOUCH` |
| `keep/DO-NOT-DELETE-main-mirror` | `6c64723442ad80ad7bdda3c588088b9005506704` | yes | none | `KEEP_NO_TOUCH` |
| `keep/ORIGINAL-HISTORY-before-main-restart` | `087b24f296f2cef9dc0c4218f4299182269bf52e` | yes | none | `KEEP_NO_TOUCH` |
| `main` | `81fa524df48ee2d84161dd2248cbeff123dc08c1` | yes | none | `KEEP_PERMANENT` |
| `refactor/wave-3-technical-contracts-ownership` | `5d2fd8115e929991c19c84e2087d5dc18d24ce21` | yes | #164 MERGED | `DELETE_CANDIDATE_MERGED_TIP_IN_MAIN` |
| `report/deep-system-audit-20260916` | `37456704853c33bd61b429a9450eb8f8fb40aff1` | no | #161 CLOSED | `REVIEW_REQUIRED_CLOSED_UNMERGED` |
| `task/direct-sale` | `c2bea878207aa4929f197f4a3b69a4018e4903d6` | no | #141 CLOSED | `REVIEW_REQUIRED_CLOSED_UNMERGED` |

## Explicit closed-unmerged review set

- PR #141 — `task/direct-sale`
- PR #157 — Jules analytical branch
- PR #161 — `report/deep-system-audit-20260916`

These are not deletion candidates in this wave. PR #157 remains especially protected until its unique content is shown to be preserved or formally superseded.
