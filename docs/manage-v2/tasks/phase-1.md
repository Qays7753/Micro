# Phase 1 — Pre-deletion separation and foundations (ZAI task prompt)

> **Execute ONE task per run.** The launcher names the task id; do not continue to the next task in the same run.
> Canonical sources: `docs/manage-v2/micro-manage-spec-final.md` (v1.1, binding), `docs/manage-v2/micro-manage-ux-final.md`, `docs/manage-v2/IMPACT.md`, `docs/manage-v2/PLAN.md`, `docs/manage-v2/REVIEW.md`.
> Branch: `feature/manage-v2` only. **`main` is forbidden.** No merge, no force-push, no history rewrite.

## 0. Preflight (every task, report it before writing code)

1. `git fetch`, then report: branch, `git log -1 --format=%H`, `git status --short`, untracked files.
2. Read `docs/manage-v2/TRACKER.md`; report the status of this task and of the previous task.
3. If the tree is dirty or the state differs from the tracker → **stop and report `STATE_DRIFT`**. Never reset/clean/overwrite.
4. Confirm the task id named in the launcher matches a section below. If not, stop.

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

## M1.1 — Extract the costing core out of `craft-order` (Tools independence)

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

## Report format (Arabic, after each task)

- المهمة والـcommit.
- ما تغيّر، ملفًا ملفًا.
- الاختبارات: الأمر، العدد، النتيجة، على أي SHA.
- ما لم يُنفَّذ / مؤجَّل.
- أي سؤال أو `BLOCKED` أو `STATE_DRIFT`.
- تأكيد أن أي ملف ممنوع لم يُلمس.
- تحديث `TRACKER.md` في نفس الـcommit.
