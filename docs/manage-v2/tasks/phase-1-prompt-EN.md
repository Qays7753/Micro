# Phase 1 — Pre-deletion separation and foundations (ZAI task prompt)

> **Execute ONE wave per run.** The launcher names the wave; run its tasks in the listed order without pausing between them, then stop at the wave boundary.
> Canonical sources: `docs/manage-v2/micro-manage-spec-final.md` (v1.1, binding), `docs/manage-v2/micro-manage-ux-final.md`, `docs/manage-v2/IMPACT.md`, `docs/manage-v2/PLAN.md`, `docs/manage-v2/REVIEW.md`.
> Branch: `feature/manage-v2` only. **`main` is forbidden.** No merge, no force-push, no history rewrite.

## Waves (owner decision 26/11/2026 — batch execution)

| Wave | Tasks (in this order) | Scope | Status |
|---|---|---|---|
| A | M1.2 → M1.3 | Cut the estimate → order cost link; remove the financial draft from Ask Micro | **authorized now** |
| B | M1.6 | §14 folders and module boundaries | pending |
| C | M1.7 → M1.8 → M1.9 | Money unit, strings catalog, deletion manifest + import guard | pending |
| D | M1.10 → M1.11 | CI guards, then `knip` | pending |
| — | M1.1, M1.1a | Already executed and accepted (26/11/2026) | done — do not re-run |

## Execution model, transitions, and resume

- **One wave per run.** The launcher names exactly one wave. Execute its tasks **in the listed order, without pausing for approval between them**. Each task keeps its own **Allowed files**, its own commit, and its own tracker entry — batching changes the run boundary, never the task boundary.
- **No transitions between waves.** At the end of the wave: run the wave gate, commit, push, report in Arabic, and stop. The next wave begins only with a new launcher from the owner.
- **Wave gate (mandatory, after the last task):** `corepack pnpm guards` → zero `FAIL`; `corepack pnpm test` → zero failures; `corepack pnpm typecheck` → clean. A wave that ends red is not finished: fix inside the wave's allowed files, or stop with `BLOCKED` — never widen scope to make a gate pass, never weaken a guard, threshold, or exemption.
- **Failure isolation inside a wave:** if a task cannot be completed safely, finish nothing after it, keep what is committed, and report `BLOCKED` with the exact task, file, and question. Do not compensate by editing a later task's files.
- **Execution is not acceptance.** A finished wave and green tests do not mean the tasks are accepted, the phase is closed, or merge/deploy is authorized. Manus reviews each task against `docs/manage-v2/REVIEW.md` after the commits; only the owner accepts.
- **Resume:** if a run is interrupted, inspect the real workspace (branch, `HEAD`, dirty/untracked files, running processes), then continue the **same wave** from the first task whose tracker entry is not `DONE`. Inside a task, continue from its first incomplete action. Never reset, clean, drop stashes, or reclone over work. If the tree holds work the tracker does not explain, report `STATE_DRIFT` and stop.
- **One writer, one branch.** No sub-agents and no parallel edits in this phase; no branch or PR per task. Small commits on `feature/manage-v2`, each carrying its task id and rule ids.
- **Test timing:** tests-first inside every task (write, run, paste the failure, implement, run again). The wave gate runs after the last task; the full `pnpm check` runs in M1.10 (shared guards change) and again at the phase gate.
- **Read-only outside the current task:** every path not in that task's **Allowed files** is read-only. Inspecting is allowed; editing is not.
- **Credentials:** none are needed. Never put a token, password, cookie, or key in a file, commit, log, or report; if the platform ever asks for authentication, use its secure credential field only.
- **Stop point:** end of the wave, after the wave gate, the commits, the push, and the Arabic report. Then stop: `NO_REPOSITORY_WRITES` beyond those commits and `NO_CLEANUP` (no deletions, no formatting sweeps, no dependency updates) unless a later task explicitly authorizes them.

## Deliverables, evidence channel, and chat format

The owner works with you from a **browser chat**, not from an IDE, and does not accept files as chat attachments.

- **Never attach a file to the chat.** No attachments, no uploads, no pasted file bodies, no screenshots as images. This holds for reports, logs, patches, manifests, exports, and test output.
- **Every deliverable is a file in this repository** on `feature/manage-v2`, delivered as a **full GitHub URL pinned to a commit SHA**: `https://github.com/Qays7753/Micro/blob/<SHA>/<path>`.
- **Report file per wave:** `docs/manage-v2/reports/WAVE-<X>-report-AR.md`, with one section per task. Raw command output, if long, goes next to it as `WAVE-<X>-evidence.md`.
- **Commit the report in the last task's commit**, or in a docs-only commit on the same branch immediately after it; then link the exact SHA that contains it.
- **Chat reply after the wave:** at most 10 lines in Arabic — wave, tasks done, final SHA, gate results (guards / test / typecheck), the report link, and any blocker. Nothing else.
- **No external file service, no pastebin, no cloud drive link.** The repository is the only delivery channel.
- **If a deliverable cannot be committed** (binary too large, secret-bearing, or outside the allowed paths), stop and ask; never attach it and never work around the boundary.
- No token, password, cookie, or key in any committed file, URL, log, or chat message.

## 0. Preflight (every wave, report it before writing code)

1. `git fetch`, then report: branch, `git log -1 --format=%H`, `git status --short`, untracked files.
2. Read `docs/manage-v2/TRACKER.md`; report the status of every task in the named wave.
3. If the tree is dirty or the state differs from the tracker → **stop and report `STATE_DRIFT`**. Never reset/clean/overwrite.
4. Confirm the wave named in the launcher exists in the waves table above, and that its task ids match sections below. If not, stop.
5. Skip any task already marked `DONE` in the tracker; start from the first task that is not `DONE` in that wave.

## 1. Global write boundary (applies to every task below)

**Always forbidden, in every task:**
- `main`, force-push, merge, deploy, tags.
- Micro Market: `client/src/application/market/**`, `client/src/pages/Market*`, `worker/routes.market.ts`, `worker/domain/market.ts`, market tables.
- Micro Delivery: `client/src/application/delivery/**`, `client/src/pages/Delivery*`, `worker/routes.delivery.ts`, `worker/domain/delivery.ts`, delivery tables.
- Ask Micro: `client/src/components/ask/**`, `client/src/application/ask/**`, `client/src/pages/AskMicro.tsx` — **except task M1.3**.
- App-level: auth, session, workspace, project lifecycle, bottom navigation, online-only mode — **except tasks that name them**.
- Shared money semantics: `formatMoneyMinor`, `formatMoneyWithUnit`, `persistedMoneyTextMinor`, `parseEnglishNumericText("money")`, `EnglishNumberInput` must not change behaviour (they serve Delivery, Market, Tools).
- Any file not listed in the task's allowed set.

**Always required:**
- Tests first: write the failing test, run it, paste the failure, then implement, then run again.
- No financial calculation in UI code; no Arabic literal outside the strings catalog for new Manage surfaces.
- No `number`/decimal money; Manage money is `MoneyFils` (integer, 1/1000 JOD).
- No dead code, no commented-out blocks, no new dependency without asking.
- Unspecified state or contradiction → stop and report `BLOCKED` with the exact question.
- Update **your section only** of `docs/manage-v2/TRACKER.md` in the same commit: status, commit SHA, tests (command + result), notes.
- Commit messages carry rule ids, e.g. `M1.1 §14.3 — extract costing core`.

---

## M1.1 — Extract the costing core out of `craft-order` (Tools independence) — DONE 26/11/2026, do not re-run

**Why:** `src/domain/planning/policies.ts:18` imports `calculateCostSnapshot` from `craft-order`, so deleting the old order domain would break Tools (أدواتي). Tools must keep its own calculation code and must not depend on Manage domain code (§14.3).

**Rules:** §14.3, IMPACT S1.

**Move (no behaviour change):**
- `CostSnapshotInput`, `CostSnapshot`, `MaterialCostItem`, `KnowledgeState`, `KnowledgeGap` from `src/domain/craft-order/types.ts`.
- `calculateCostSnapshot` and its private helpers from `src/domain/craft-order/policies.ts`: `cloneCostSnapshotInput`, `freezeCostSnapshot`, `determineKnowledgeState`, `deriveKnowledgeGaps`, `materialItemCostMinor`, `unitCostCeilingMinor`, and any helper used only by them.
- Into a new neutral module `src/domain/costing/` (`types.ts`, `costSnapshot.ts`, `index.ts`).

**Compatibility:** `src/domain/craft-order/index.ts` and `types.ts` must re-export the moved symbols so every existing importer keeps compiling unchanged. No duplicated implementation.

**Allowed files:**
- `src/domain/costing/**` (new)
- `src/domain/craft-order/types.ts`, `src/domain/craft-order/policies.ts`, `src/domain/craft-order/index.ts` (imports/re-exports only)
- `src/domain/planning/policies.ts` (import from `../costing/index.js`)
- `tests/**` new/extended tests for the moved module

**Tests first:**
1. New test proving `src/domain/planning` has no `craft-order` import (source-scan assertion).
2. New test importing `calculateCostSnapshot` from `src/domain/costing/index.js` and asserting one known snapshot (values copied from an existing green test).
3. Existing cost-snapshot and planning tests stay green without edits.

**Acceptance:** `grep -R "craft-order" src/domain/planning` returns nothing; `pnpm test` green for `src/domain/**` and `tests/**`; `pnpm typecheck` green; no duplicated function bodies.

**Stop if:** a moved helper is used by non-cost craft-order logic in a way that would create a cycle, or a test outside the allowed set must change.

---

## M1.2 — Cut the estimate → order cost link

**Why:** an estimate made in Tools must not feed an order's cost (S2, §14.3).

**Rules:** §14.3, IMPACT S2.

**Do:**
- Delete `readSourceEstimate` from `client/src/application/agreements/orderDetailViewModel.ts` (and its now-unused imports/params).
- Remove the corresponding state, effect, import and the «بدأ هذا الطلب من تقديرك…» block from `client/src/pages/OrderDetail.tsx` (around lines 57, 122–123, 259–265, 1831–1845).
- Keep `sourceEstimateId` on the draft type (`application/drafts/draftService.ts`, `storage/local/types.ts`) untouched — it is used by other surfaces and by the future deletion of transfers.
- Do **not** touch `pages/CostEditor.tsx` prefill logic (that is Tools' own editor, not the order cost).

**Allowed files:** `client/src/application/agreements/orderDetailViewModel.ts`, `client/src/pages/OrderDetail.tsx`, plus tests that assert the removed behaviour (list them in the report).

**Tests first:** a test asserting the order detail model exposes no source-estimate reader and the page renders without any estimate lookup; run it failing first.

**Acceptance:** `grep -R "readSourceEstimate" client/src` returns nothing; order detail tests green; no other surface changed.

**Stop if:** another production file imports `readSourceEstimate`, or the removal forces edits outside the allowed set.

---

## M1.3 — Remove the financial draft from Ask Micro (approved separation S3)

**Why:** `client/src/components/ask/AskDraftCard.tsx:150` builds a legacy financial event and writes it to `financialEvents`. The owner approved removing only this financial path until it is redesigned on the new system.

**Rules:** scope boundary, IMPACT S3. **This is the only task allowed to touch Ask files.**

**Do:**
- Remove the `AskDraftCard` render and import from `client/src/pages/AskMicro.tsx`.
- Delete `client/src/components/ask/AskDraftCard.tsx`.
- Do not change the Ask conversation, `application/ask/**`, `askMicroService`, or `ask-history`.
- If `result.draft` becomes unused in the page, keep the service contract untouched and remove only the page's unused variable.

**Allowed files:** `client/src/pages/AskMicro.tsx`, `client/src/components/ask/AskDraftCard.tsx` (delete), tests referencing the card.

**Tests first:** a test asserting `AskMicro` renders no financial-draft affordance and that no module writes the `financialEvents` family from Ask; run failing first.

**Acceptance:** `grep -R "AskDraftCard\|constructFinancialEventRecord" client/src/pages/AskMicro.tsx client/src/components/ask` returns nothing; Ask page tests green; `application/ask/**` unchanged (`git diff --stat` proves it).

**Stop if:** the Ask page cannot compile without touching `application/ask/**`.

---

## M1.6 — Module boundaries for Manage v2

**Why:** enforce the approved direction before any Manage code exists: `worker/api/manage → worker/application/manage → src/domain/manage`; the client never imports the domain; Delivery/Market/Tools never import Manage.

**Rules:** §14.1–14.3, owner decision D-5.

**Do:**
- Extend `scripts/check-module-boundaries.mjs` with explicit rules for the Manage paths (they may not exist yet; the rules must be ready and must not weaken existing checks).
- Add a rule: no file under `apps/prototype-web/client/src/**` may import `src/domain/manage/**` or `worker/application/manage/**`.
- Add a rule: `src/domain/manage/**` may import only `src/domain/shared/**` and its own subtree.
- Add a self-test fixture proving each rule fails when violated.

**Allowed files:** `scripts/check-module-boundaries.mjs`, its tests/fixtures, `docs/architecture/refactoring/OWNERSHIP-AND-TRUTH-REGISTRY.md` (only if the guard requires a registry entry).

**Acceptance:** `pnpm guards` green; a deliberately violating fixture makes the guard fail (prove it, then remove the fixture).

**Stop if:** the guard cannot express a rule without changing existing behaviour.

---

## M1.7 — Money in fils (domain module)

**Why:** Manage money is fils = 1/1000 JOD, integer 64-bit, `round_half_up` once per multiply/divide. Shared money functions must not change.

**Rules:** §9 (R-20…R-22), IMPACT §4, owner decision D-4.

**Do:**
- Create `src/domain/manage/money/` with: `MoneyFils` type (integer, non-negative where applicable), `FILS_PER_JOD = 1000`, `filsFromJodText` (strict parser, max 3 decimals, rejects > 3 decimals and non-numeric), `jodTextFromFils` (3 decimals, grouping, `.` decimal), `addFils`, `subFils`, `mulFilsByQuantityMilli`, `divFils`, each applying `roundHalfUp` exactly once and throwing on unsafe integers.
- No dependency on `formatMoneyMinor` or on any `*Minor` naming.
- Add `src/domain/manage/index.ts` exporting the public surface.

**Allowed files:** `src/domain/manage/**`, `tests/manage/**` (new).

**Tests first:** table-driven tests for parsing (`"12.350"` → 12350, `"12.35"` → 12350, `"12.3456"` rejected, `"1,250.000"` handling as specified), formatting (`12350` → `"12.350"`), rounding half-up at `.5`, overflow rejection, and quantity multiplication (milli × fils).

**Acceptance:** tests green; `pnpm typecheck` green; no float arithmetic; `grep` shows no `/100` or `*100` in the module.

**Stop if:** the spec is ambiguous about a formatting or rounding case (report the exact case).

---

## M1.8 — Manage strings catalog + literal-text guard

**Why:** UI strings come from one catalog keyed by §10/§11; no literal Arabic on new Manage surfaces.

**Rules:** §10, §11, §14.2, owner decision D-7.

**Do:**
- Create `client/src/application/manage/strings/` with `keys.ts` (key union), `ar.ts` (verbatim Arabic values copied from §10/§11 — **copy, never invent or paraphrase**), `index.ts` (`t(key)` lookup, throws on missing key).
- Create `scripts/check-manage-literal-text.mjs`: fails on Arabic literals inside `client/src/pages/manage/**`, `client/src/components/manage/**`, `client/src/application/manage/**` (excluding `strings/ar.ts`).
- Register the guard in `package.json` `guards`.

**Allowed files:** `client/src/application/manage/**`, `scripts/check-manage-literal-text.mjs`, `package.json` (guards script only).

**Tests first:** a test comparing catalog keys against the key list in the spec (parse §10/§11 pragmatically; if parsing is ambiguous, stop and report the ambiguous lines instead of guessing), plus a test that the guard fails on a fixture with literal Arabic.

**Acceptance:** keys unique, every value non-empty, every value matches the spec verbatim, guard green on the current tree.

**Stop if:** the spec contains a key without text or text without key (report both lists).

---

## M1.9 — Deletion manifest + deleted-import guard

**Why:** no dead code may return silently; every deletion is declared before it happens.

**Rules:** owner decision D-10.

**Do:**
- Create `docs/manage-v2/DELETION-MANIFEST.md`: one row per path planned for deletion (from `IMPACT.md` §1/§13), columns: path, reason, replacement, status (`planned` / `deleted`), phase.
- Create `scripts/check-deleted-imports.mjs`: reads the manifest, and for every row marked `deleted`, fails if any file imports that path (relative or alias).
- Register in `package.json` `guards`; add a fixture test proving it fails.

**Allowed files:** `docs/manage-v2/DELETION-MANIFEST.md`, `scripts/check-deleted-imports.mjs`, its test/fixtures, `package.json` (guards script only).

**Acceptance:** guard green (nothing deleted yet), fixture fails, manifest covers every path in IMPACT §1.

---

## M1.10 — Update the CI guards affected by Manage v2

**Why:** the existing guards must keep protecting the repo while the new paths appear.

**Rules:** §14, CI.

**Do:** minimally update, without weakening:
- `scripts/check-registry-coverage.mjs` + `docs/architecture/refactoring/OWNERSHIP-AND-TRUTH-REGISTRY.md` for the new Manage paths.
- `scripts/check-file-size-ratchet.mjs` for the new files.
- `scripts/check-money-minor-casts.mjs` so `MoneyFils` is not counted as `*Minor` (and no exemption is added for real `*Minor` casts).
- `scripts/check-doc-index-coverage.mjs` + `docs/00-document-index.md` for `docs/manage-v2/**`.

**Allowed files:** the four scripts above, the registry, the doc index, `docs/manage-v2/**`.

**Acceptance:** `pnpm guards` green; no threshold raised; each change explained in the report.

**Stop if:** a guard would need a real weakening to pass (report it instead).

---

## M1.11 — Add `knip` for dead-code detection

**Why:** "no dead code" is a project rule; the owner approved adding knip now, at least for Manage and Tools paths.

**Rules:** owner decision D-10.

**Do:**
- Add `knip` as a devDependency (ask before any other dependency).
- Create `knip.json` scoping the run to Manage and Tools paths, with the public entry points declared (`src/domain/manage/index.ts`, `src/domain/costing/index.ts`, `client/src/application/manage/**/index.ts`) so public APIs are not reported as unused.
- Add `"knip": "knip"` script and a CI step.
- Baseline must be **zero** issues in the scoped paths. Do not add ignore rules to hide real findings; if an existing genuine finding appears in scope, report it and stop.

**Allowed files:** `package.json`, `pnpm-lock.yaml`, `knip.json`, `.github/workflows/ci.yml`.

**Acceptance:** `pnpm knip` exits 0 with zero issues in scope; CI step present; report the exact command and output.

---

## M1.1a — M1.1 fix-up: registry row, test-map regeneration, stale comment — DONE 26/11/2026, do not re-run

**Why:** M1.1's code is correct, but it left the branch red and one comment factually wrong. The owner requires a green gate after every task, so these three items are authorized now instead of waiting for M1.10.

**Rules:** §14.3, IMPACT S1, owner decision 26/11/2026.

**Do (exactly three things):**

1. `docs/architecture/refactoring/OWNERSHIP-AND-TRUTH-REGISTRY.md`:
   - Add one row for the new domain area `costing`: concept `costing`, authoritative source `§14.3 + src/domain/costing/`, implementation owner `domain/costing`, main consumers `domain/planning (أدواتي)؛ domain/craft-order (إعادة تصدير توافق)`, storage owner `— (نقي بلا تخزين)`, export/import `لا يوجد`, tests `tests/domain/costing.test.ts`, documentation `docs/manage-v2/PLAN.md §14.3؛ IMPACT S1`, status `PRESERVE — نواة تكلفة محايدة مشتركة (M1.1)`.
   - Update the `planning` row so it no longer says it consumes the cost core **from `craft-order`**: it now consumes `src/domain/costing/`.
   - Update the section-1 heading count (`20 منطقة + صف … = 21 صفًا`) to the real number after your row.
2. Regenerate `docs/architecture/refactoring/generated/test-map.json` with `node scripts/generate-test-map.mjs`. **Never hand-edit the generated file.** Commit the generator output only.
3. `src/domain/planning/types.ts`: correct the header comment (around lines 4–8) that still claims T01 consumes `calculateCostSnapshot` from `@micro-domain/craft-order`. It now consumes `src/domain/costing/`. **Comment text only — zero code change in this file.**

**Allowed files:** the three files above, plus `docs/manage-v2/TRACKER.md` and `docs/manage-v2/reports/M1.1a-report-AR.md`.

**Tests first / verification order:**

1. Run `corepack pnpm guards` and paste the `registry-coverage` failure (it is the failing state).
2. Make the three changes.
3. Run `corepack pnpm guards` → every check `PASS`, zero `FAIL`.
4. Run `node scripts/generate-test-map.mjs` twice; `git status --short` must be clean after the second run (no drift).
5. Run `corepack pnpm test` → zero failures (the two guard-smoke failures of M1.1 must be gone).
6. Run `corepack pnpm typecheck` → green. Paste `git diff --stat` and confirm `src/domain/planning/types.ts` shows comment-only changes.

**Acceptance:** `pnpm guards` fully green; `pnpm test` zero failures; no generated-file drift; registry heading count matches its rows; no source behaviour changed.

**Stop if:** a guard needs a threshold change, an exemption, or an ignore rule to pass — report instead of weakening it; or the registry format requires fields you cannot fill truthfully.

---

## Report format (Arabic) — written to `docs/manage-v2/reports/WAVE-<X>-report-AR.md`

Per task, in the wave's order:
- المهمة والـcommit.
- ما تغيّر، ملفًا ملفًا.
- الاختبارات: الأمر، العدد، النتيجة، على أي SHA.
- ما لم يُنفَّذ / مؤجَّل.
- أي سؤال أو `BLOCKED` أو `STATE_DRIFT`.
- تأكيد أن أي ملف ممنوع لم يُلمس.
- تحديث `TRACKER.md` في نفس الـcommit.

Then the wave gate: `guards` / `test` / `typecheck` commands, counts, and results on the final SHA.

The file is committed and linked; the chat carries only the 10-line summary described above.
