# R8-N1 — Canonical Evidence Annex (2026-10-10)

**Purpose.** The in-repository R8-N1 execution report
(`R8-N1-PWA-PRECACHE-ROOT-FIX-EXECUTION-REPORT-2026-10-10.md`) is and remains the
canonical root-fix record. Its §4/§6/§8, however, deferred three material artifacts
to PR #345's body context ("recorded in the PR evidence" / "URLs pinned in the PR
body") — and a PR body is an editable, non-versioned artifact. This annex, added by
R9-W1 (finding **R9-PF-N4**), moves that material into versioned repository paths.
**Designation of the canonical source:** for the machine outputs and inventories
below, this annex is the canonical artifact; the PR #345 body is historical
provenance only. No number is changed — everything below was re-derived from the
live tree at the R9-W1 head (or reproduced verbatim from the PR body where the
pre-fix build no longer exists, and labeled as such).

---

## 1. Final-head verification URLs (reproduced from PR #345 body + GitHub API)

| Item | Value |
|---|---|
| PR | https://github.com/Qays7753/Micro/pull/345 (merged as `87274cf91a9d27b9b5f9c3cee3f980218ae6aa0e`) |
| Final PR head | `7a928fac19988231b990dce8c4bd977ee6f725a6` (documentation/closure head; code head `7341f91195a59100a4b9111b1d81c21f0f184368`) |
| PR-head CI run | https://github.com/Qays7753/Micro/actions/runs/38059908849 — **success** on `7a928fac` |
| Cloudflare Pages check-run | https://dash.cloudflare.com/?to=/663413a9a3389b95eb5d970c6a7ef9d5/pages/view/micro-prototype/1a41aab0-adcb-4787-8d85-98157afb9f86 — **success** on `7a928fac` (check-run id 114236114902) |
| Post-merge main CI | https://github.com/Qays7753/Micro/actions/runs/38060781329 — **success** on `87274cf9` (job 114238432384) |
| Post-reconciliation main CI | https://github.com/Qays7753/Micro/actions/runs/38061919149 — **success** on `8b3c9aeb09ca33ed66f0a929c157b668839d0463` (PR #346 merge) |

## 2. Reproduced precache inventory (canonical machine output — live tree)

Command (reproducible): `pnpm --filter @micro/prototype-web build` (official path;
guard chain runs inside it), then parse `apps/prototype-web/dist/public/sw.js` with
`/\{url:"([^"]+)",revision:/g`. Executed at the R9-W1 head (branch
`refactoring/r9-complete-w1-w2-w3-20261010`, base `8b3c9aeb`; node v24.21.0,
zlib 1.3.2.1-motley-8002e91, linux/x64):

```text
total entries: 156 | unique: 156 | duplicates: 0
category breakdown of the 156 unique URLs:
  index.html              1   (app shell)
  fonts/*                12   (11 woff2 + fonts.css)
  brand/*                37   (favicon 6, mark 3, motion 2, motion/light 4,
                              motion/dark 4, pwa 12 [incl. the 3 manifest icons],
                              splash 6)
  assets/*              105   (js/css chunks incl. workbox-window)
  manifest.webmanifest   1   (plugin-managed entry)
guard line: check-bundle-surfaces: precacheEntryCount: 156 (baseline 156);
  precache 156 (2,672,243 bytes); swRuntime 2 (26,170 bytes) — PASS
entry: 629,300 raw / 154,683 gzip (ceilings 650,000/155,300 untouched)
```

The full 156-URL list is regenerable by the one-line command above (recorded here as
the canonical method rather than a frozen list, so the annex cannot drift from the
build; the R8-N1 report §4's category table matches this output exactly).

## 3. Before/after unique-URL set comparison (provenance: PR body — reproduced summary)

The pre-fix Build A existed only at head `0ddba665` (pre-fix PR head) and is not
rebuildable from the live tree without reverting the fix; the comparison below is
reproduced verbatim from PR #345's body (provenance-labeled) and its summary numbers
are independently confirmed by the guard baseline values that ARE in the repository
(`bundle-surfaces-baseline.json`: precache entry count 156 both sides;
`swRuntimeRawTotal` 28,885 → 26,170 re-anchored in all three environment records
with superseded anchors preserved in the dated method strings):

```text
Build A (pre-fix, 0ddba665): 187 entries / 156 unique / 31 duplicates
Build B (experiment, not committed): 159 / 156 / 3 (exactly the 3 manifest icons)
Build C (root fix, 7341f911): 156 / 156 / 0
unique-URL set comparison A vs C: lost = [] ; gained = [] ; sets identical = true
largest precached file: fonts/Alexandria-VF.woff2 = 59,800 B (2 MiB cap)
```

## 4. Verbatim guard output (post-fix build, reproduced live)

```text
check-bundle-surfaces: ENV=local node=v24.21.0 zlib=1.3.2.1-motley-8002e91
  platform=linux/x64 identity=null gzip=hash-names
check-bundle-surfaces: entry=assets/index-DLRHwcNo.js raw=629300 gzip=154683
  (reported only — check-bundle-budget owns the 650,000/155,300 ceilings)
check-bundle-surfaces: lazyJsCount: 101 (baseline 101); initialJsCount: 2 (baseline 2);
  dynamicRootsCount: 70 (baseline 70); precacheEntryCount: 156 (baseline 156);
  swRuntimeFileCount: 2 (baseline 2)
check-bundle-surfaces: PASS — entry 629300/154683 (reported); initial 2
  (224687 raw / 70716 gzipNorm); lazy 101 (1206629 raw / 363974 gzipNorm);
  precache 156 (2672243 bytes); swRuntime 2 (26170 bytes) — within the local
  baseline (tolerances raw +8 / gzip +16)
```

## 5. Bounded preserve record (R9-PF-N7 — theoretical completeness blind spot)

The guards prove zero duplicates, per-surface budgets, and environment anchoring;
none proves **intended-set completeness** — a future public asset with an extension
outside `globPatterns` (`**/*.{js,css,html,ico,png,svg,woff2}`) would be silently
not precached while every guard stays green. Preserved as a bounded theoretical risk:
owner = the guards owner; trigger = any new public asset class or `globPatterns`/
`publicDir` change (same-PR evidence must include the before/after unique-URL set
comparison in the exact format of §3 above); exit condition = an owner decision that
defines the intended offline set as a checked artifact. A second, narrower
theoretical residual (hostile-review note): the duplicate check parses
`\{url:"…",revision` entries; a hypothetical future emission of revisionless
plain-string precache entries would evade the duplicate matcher while still counting
as non-zero entries — same trigger and same evidence format cover it.

## 6. Rollback boundary of this annex

Documentation-only; revert the R9-W1 commit to remove it (the PR body and the R8-N1
report remain regardless). No code, guard, baseline, or data impact.
