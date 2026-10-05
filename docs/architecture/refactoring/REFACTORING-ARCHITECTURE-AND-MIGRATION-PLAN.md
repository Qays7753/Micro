# Micro — خطة المعمارية والانتقال: من الوضع الحالي إلى الهدف وموجات التنقل

**التاريخ:** 2026-10-02
**رأس `main` الحي المعتمد لهذا التقرير:** `e7688efda3bbae945a258cca92eabce889c7dab4` (متحقق بـ `git fetch origin --prune` + `git rev-parse origin/main`)
**إصدار التقرير:** v1.1 (v1.0 — أول خطة انتقال موحدة، 2026-10-02؛ v1.1 — إضافة قسم §23 «Post-Closure A-to-Z Gap Reconciliation» المؤرخ، 2026-10-03)
**الحالة النهائية:** `OWNER_REVIEW_REQUIRED` عند النشر (v1.0، 2026-10-02) — **ثم قبِل المالك المكتشفات والاتجاه الكامل بتاريخ 2026-10-03** (تعليمة برنامج التحصين والمعالجة البنيوية المضبوطة؛ موثقة في `AGENT-SEQUENTIAL-WORKLOG.md` Entry 1) — لا تنفيذ، لا نقل ملفات، لا تغيير سلوك داخل هذا التقرير نفسه
**تحديث v1.1 (2026-10-03):** أُغلق برنامج المعالجة (WS-212 VERIFIED؛ PRs #299–#308) وأُضيف قسم §23 «Post-Closure A-to-Z Gap Reconciliation» عند الرأس الحي `04895f2643608fce00553040d484db84f80bf5dc` — مسح فجوات ما بعد الإغلاق **للتقرير فقط**؛ لا تنفيذ ولا تغيير سلوك داخل هذا التحديث
**مرجع البرنامج:** `docs/architecture/refactoring/REFACTORING-PLAN-A-TO-Z.md` (v1.3) + `REFACTORING-CONTROL.md` (v1.3) *(تصحيح مؤرخ 2026-10-03 عند ترقية هذا التقرير إلى v1.1: كانت الإشارة «v1.1/v1.0» متقادمة — كلا المرجعين الحيين v1.3)*
**سلطة هذا الملف:** خطة انتقال مبنية على أدلة حية للتقرير فقط؛ لا يُنشئ سلطة معمارية ثانية ولا سجل ملكية ثانيًا، ولا يفوّض أي تغيير بنيوي قبل قرار مالك صريح لكل موجة.

---

## 1. الجواب التنفيذي المبسط (بالعربية)

**ما الذي هو سليم ولا يجب لمسه؟**
نواة المجال (`src/domain/` — 18 وحدة، كلها عبر barrels مقفلة باختبار عقد عام) نقية تمامًا: صفر استيراد لـ React أو المتصفح أو التخزين، ومحمية بـ ESLint واختبارات حراس. التمثيل المالي (قروش صحيحة، 1/100، منزلتان) متماسك ومصدره واحد. حماية التاريخ حقيقية ومختبرة: تجميد CostSnapshot، علاقات العكس `reversesEventId`، مفاتيح الحتمية، وديباجة التصدير (38/30) بفحص sha256. كتابة البيانات محروسة (9 وحدات commit guards بنمط idempotency + CAS داخل حد الكتابة). سجل الكيانات الدائمة مطابق للواقع 37/37. هذا هو رأس المال المعماري: **أي موجة مستقبلية تحافظ عليه ولا تستبدله**.

**ما الذي هو خطر ويحتاج ترتيبًا؟**
ثلاث بؤر تركّز: (1) **البوابة الواسعة**: عقد واحد `PrototypeLocalStore` بـ131 методًا يغطي ~30 مفهومًا و37 مخزنًا، ومنفَّذ مرتين (IndexedDb 4,139 سطرًا / Memory 2,099) — أي تقسيم يحتاج جردًا (Wave N) وخط أساس تكافؤ (Wave D) وقرار مالك. (2) **`application/finance/`**: 9,174 سطرًا إنتاجية تختلط فيها ≥6 مسؤوليات (تسجيل، قراءات، تشخيص، مال المالك، تخطيط متكرر) — الفصل يحتاج سجل ملكية أولًا (Wave F). (3) **منظومة النقل**: مدققات مكتوبة يدويًا (1,715+1,185 سطرًا، 83 مقارنة حرفية) تعيد وصف أشكال المجال — انحراف صامت فيها قد يجعل التطبيق يرفض ملفات تصديره الخاصة؛ وهي بلا اختبارات مباشرة ولا golden files على القرص.

كذلك: قواعد مالية مشتقة (تركيب COGS للفترة، تغطية المحفظة للسحب، حسابات تسوية المالك) تعيش في طبقة Application وليس Domain — نقلها قرار مالك في مسار دلالي مستقل (Wave R) ولا يدخل أي موجة هيكلية.

**ما الذي لا يُلمس الآن إطلاقًا؟**
المخطط/التصدير/الاستيراد (38/30 وأزواج التاريخ والترحيلات)، معنى المال وأرقامه ورسائله، الواجهة وTSX وCSS والتنقل، حواف الالتزام الحرجة في حدود الكتابة، أسماء المفاهيم وIDs (بما فيها g5)، وأي منصة مستقبلية (Dart/Flutter/Python/API/Sync/Auth) — لا شيء من محفزاتها متحقق اليوم، وقد تحققنا من غياب أي كود منصات في الشجرة.

**الخلاصة:** المعمارية السليمة موجودة ومقيسة؛ الخطر ليس «نظامًا مكسورًا» بل **تركّز حدود واسعة + سياسات اتجاه غير محسومة + غياب أصول تكافؤ مادية**. أصغر موجة آمنة تالية هي قبول المالك لهذه الخطة ثم خط أساس التكافؤ (D) — لا نقل ملفات.

---

## 2. Scope, non-goals, credentials mode, exact actions performed

### 2.1 What was read (mandatory first actions — all VERIFIED)

`AGENTS.md` (172 lines), `README.md` (45), `docs/operations/current-state.md` (86), `docs/operations/micro-thinking-charter-v1.md` (102), `docs/00-document-index.md` (234), `docs/implementation/03-pre-build-alignment-v1.md` (106), `docs/operations/control/generated/AGENT-BRIEF.md` (35), `docs/architecture/refactoring/README.md` (59), `REFACTORING-CONTROL.md` (115), `REFACTORING-PLAN-A-TO-Z.md` (380). Plus, during synthesis: `.github/pull_request_template.md`, `apps/prototype-web/ARCHITECTURE.md`, `eslint.config.js`, Operations Control schemas/validator/generator, and targeted reads across `src/domain/**`, `apps/prototype-web/client/src/**`, `tests/**`, `scripts/**`, `docs/contracts/**` as cited in the findings register.

### 2.2 What was inspected

The live tree at `e7688efd`: module/layout census (wc/ls/git ls-files), import graph (static AST-based analysis over 636 TS/TSX files + `rg` spot checks), layer/boundary rule inventory (`eslint.config.js` + guard scripts), 6 representative end-to-end flows (craft order, financial event, inventory, owner funds, export/import transfer, cash continuity), storage port/adapters/guards/migrations, test/fixture/contract/documentation mapping, decision records and Operations Control state, CI workflow and PR template, future-platform portability (purity, contract neutrality, money, clock, storage).

### 2.3 What was NOT inspected or changed

Not inspected as authority: `reports/`, `planning/`, `docs/operations/archive/`, `docs/operations/control/evidence/` (historical stores, per AGENTS.md §2); the external documentation repo containing the prior Group-7 scan (referenced by AGENTS.md §11) — **historical and UNVERIFIED, outside this clone, and explicitly NOT a prerequisite for this fresh current-tree scan** (this scan re-derived every finding from the live tree at `e7688efd`); no runtime/device/PWA field acceptance verification; no full `pnpm check`/`pnpm test` execution (see §4 limitations). Not changed: everything except the report/control files listed in §20 — no code, no tests, no configs, no guards, no schema, no UI.

### 2.4 Credentials mode

Read access: public clone (no credentials). GitHub API (open-PR check, PR creation, branch push): the owner-provided secure token was used only in the Authorization header / push URL; it was never printed in output, never written to any file, never committed, and is not stored anywhere in the repo or the report. `gh` CLI is unavailable in this environment (noted as a warning by `validate.py`; API used instead).

### 2.5 Exact actions performed (chronological)

1. Cloned the repository; fetched `origin/main`; recorded live SHA `e7688efda3bbae945a258cca92eabce889c7dab4`; verified clean worktree; recorded `STATE_DRIFT` vs the expected baseline `9271a85d…` (delta = exactly one docs-only commit #298 creating `docs/architecture/refactoring/`; 7 files, +937/−1 — verified by `git diff --stat 9271a85..e7688efd`).
2. Read all mandatory files (§2.1). Ran `python3 scripts/operations-control/validate.py` → exit 0 ("78 items, 52 workstreams, 0 active claims, origin/main=e7688efd…").
3. Checked open PRs via authenticated GitHub API → **0 open PRs**; AGENT-BRIEF + validator agree: no active workstream claims → no coordination conflicts.
4. Launched five independent read-only specialists (module boundaries; dependency conformance; domain/storage/data; tests/docs/contracts; future evolution & risk). Each verified the anchor SHA and a clean worktree before and after; none modified the repo; all wrote reports outside the repo and appended to the shared worklog.
5. Synthesizer re-verified every contested number directly against the live tree (composition-root service count, port method count, commit-guard module count, lazy-service count, deep-import list, KnowledgeState triplication) — see the reconciliation table (§18).
6. Wrote this plan (the only canonical deliverable), updated `REFACTORING-CONTROL.md` phase status/report pointer, and created the minimal Operations Control record (item `ARCH-001` + workstream `WS-211` + regenerated views via the official generator).

### 2.6 Non-goals (this phase)

No structural refactoring; no file moves/renames/deletes; no Ports/Facades/Shared-Kernel extraction; no `features/`/`common/`/`utils/` creation; no changes to financial meaning, formulas, policies, terminology, error messages, schema, migrations, export/import, snapshots, or historical interpretation; no UI/TSX/CSS/token/DOM/navigation/copy changes; no dependency/build/CI/security/deployment changes; no platform work (Dart/Flutter/Kotlin/Swift/Python/API/Sync/Auth); no merging/closing/deleting of PRs or branches; no rewriting of historical reports; no second architecture authority or ownership registry.

---

## 3. Baseline table

| Field | Value (VERIFIED unless noted) |
|---|---|
| Repository | `https://github.com/Qays7753/Micro` |
| Branch | `main` (report branch created from it: `docs/architecture-refactoring-plan-20261002`) |
| Full live SHA | `e7688efda3bbae945a258cca92eabce889c7dab4` (2026-10-02, "docs: bootstrap architecture refactoring control space (#298)") |
| Expected setup baseline | `9271a85dc29934096297f24cfe9d729f9af65b10` — **STATE_DRIFT**: live head is +1 docs-only commit (#298: created `docs/architecture/refactoring/` control space, 7 files, +937/−1). Benign, program-related; all findings re-anchored to the live SHA. |
| Worktree state | Clean (`git status --porcelain` empty on the report branch before commit; clone dedicated to this program) |
| Package/tooling | pnpm@9.15.9; workspace `apps/*`; root scripts: test (vitest), typecheck (tsc), lint (eslint `--max-warnings 37`), format (prettier), guards (8 `scripts/check-*.mjs`), design-guards (3 python), operations-control (python validate/generate + unittest); `check` aggregates all + prototype build with bundle budget 650,000/155,000 bytes |
| Test files | 328 total: 44 root vitest (33 `tests/domain/` + 1 `tests/` root + 1 colocated domain + 9 `scripts/*.test.mjs`) + 282 colocated app tests + 1 app bundle-budget test + 1 python unittest |
| Open PRs | 0 (authenticated GitHub API, 2026-10-02) |
| Active Workstreams | 0 active claims (AGENT-BRIEF + `validate.py` agree); 78 items / 52 workstreams total |
| Known drift | (1) `docs/operations/current-state.md` cites head `a6b80179…` — one docs-only commit behind live head; the file's own "verify live head" rule governs (by design). (2) `docs/architecture/refactoring/` (created by #298) is indexed via the architecture-dir full-coverage guard (guard exit 0). (3) Dated counters in `apps/prototype-web/ARCHITECTURE.md` were re-verified this scan: 42 services / 53 `*Service.ts` / 37 stores / 18 domain areas / 38–30 — **all still correct** (see §18 reconciliation). |
| Schema/export | `localSchemaVersion=38` / `localExportVersion=30` (`apps/prototype-web/client/src/storage/local/types.ts:55,71`) — unchanged by this phase |
| CI | `.github/workflows/ci.yml`: lint + check (which includes all guards, both vitest projects, typecheck, format, text-density, design guards, build + bundle budget) on PR/push |

---

## 4. Evidence legend and limitations

**Evidence classes (used throughout):** `VERIFIED` = directly observed in the live tree/command/file at the anchor SHA · `INFERRED` = supported interpretation not directly proven · `UNVERIFIED` = could not be checked · `NOT_EXECUTED` = intentionally not run · `DEFERRED` = deliberately postponed · `BLOCKER` = prevents completion. Owner-facing classifications: `FIX_NOW` / `PRESERVE` / `DEFER` / `OUT_OF_SCOPE` / `OWNER_DECISION_REQUIRED`.

**Limitations that bound this scan:**

1. **Full suite NOT_EXECUTED (STR-118).** `pnpm check` / `pnpm test` / `pnpm lint` were not run: `node_modules` is absent in the scan clone and installing would write into the read-only tree. All boundary/cycle/deep-import statements are static-analysis based (AST import graph over 636 files + `rg`), cross-validated where possible: the repo's own `check-runtime-cycles.mjs` guard (run from a copy outside the repo, exit 0: "319 production files scanned, 0 runtime cycles"), `check-doc-index-coverage.mjs` (exit 0), and `operations-control/validate.py` (exit 0). CI remains the live truth for suite pass/fail; current-state's 514/514 + 1996/1996 are dated historical claims (static `it(` counts this scan: 537 root / 1960 app — consistent in magnitude, `INFERRED`).
2. **Prior scan historical/unverified.** The accepted Group-7 structural scan (at `9a8c949`, report `17b264c`) lives in the external documentation repo — outside this clone. It is a **historical artifact, not a prerequisite**: this report did not rely on it for any finding, and per REFACTORING-CONTROL §3 no prior scan may be assumed valid. Wave B reconciliation with it remains optional owner-side history work, not a gate for this program.
3. **Historical material excluded as authority.** `reports/`, `planning/`, archives, and evidence dirs were not used as current truth; every number in this report was re-derived from the live tree.
4. **Coverage-scope limit.** ESLint/guard semantics were read from source and their self-tests, not fuzzed. No runtime behavior, device, or PWA acceptance was verified. Contract-to-code semantic fidelity for 43 of 49 contracts is comment-based (STR-402) — full per-contract verification is Wave C/E work, not this scan.
5. **Token boundary.** Write access was used only for the report-only branch/PR; nothing else was pushed; no secret was written anywhere (checked).

---

## 5. Current module/feature map (VERIFIED)

### 5.1 Top level

```
micro/ (anchor e7688efd)
├── package.json            pnpm@9.15.9; workspace apps/*; root check/guards scripts
├── eslint.config.js        467 lines — the layer-boundary guard engine (17 blocks)
├── src/domain/             18 areas, 61 files, 10,257 production lines
├── apps/prototype-web/     client/src layers below; ARCHITECTURE.md; vite/vitest configs
├── tests/                  34 files, 11,046 lines (33 in tests/domain/ + 1 at tests/ root)
├── scripts/                24 files: 8 guard checks + self-tests, 3 python design guards, operations-control/
├── docs/                   441 files (contracts/ 49, product/, architecture/ + 9 ADRs, operations/ + control/, expansion/, decisions/, quality/, research/, implementation/, scenarios/, fixtures/)
├── ai-skills/              22 portable skill files
├── reports/, planning/     historical (non-authoritative)
```

### 5.2 Domain Core — `src/domain/*` (18 areas, all with `index.ts` barrels)

| Area | Lines | Concept owned | Barrel style |
|---|---|---|---|
| craft-order | 2,123 | order lifecycle: agreement, cost snapshot, knowledge gaps, deposit collect/settle/retain/refund, delivery terms & attribution, debt, collections & reversals, corrections, settlement invariant | curated named (55-line barrel; policies.ts 1,493) |
| g5 | 1,335 | break-even, short-cash (+declarations/reversals), direct margin, operating break-even | `export *` |
| owner-entitlement | 1,115 | owner money: policies/records/movements/opening balances + reversals | curated named (policies 934) |
| recurring-expense | 848 | series / frozen rule revisions / occurrences with decisions | `export *` |
| financial-event | 703 | project-level events (in/out/owner/amanah/non-cash loss), reversals, shared-project share | curated named |
| direct-sale | 580 | direct sale as financial record (cash/deferred, price cuts) | `export *`; only colocated domain test |
| recurring-margin | 514 | allocation policies (manual/per-unit/actual-time) | `export *` |
| asset | 502 | asset contract + depreciation + disposal as declared events | `export *` |
| inventory-material | 467 | materials, dated movements, shortages, waste, tracking state | `export *` |
| supplier-purchase | 406 | purchases & payments (cash/payables) | `export *` |
| budget | 398 | optional expense budgets/goals (plan, not event) | `export *` |
| catalog | 380 | reference catalog: items, units, conversions, templates | `export *`; self-contained |
| received-loan | 285 | borrowing: "borrowed is not income" | `export *` |
| loan | 222 | loans given: "debt is not expense" | `export *` |
| cash-continuity | 218 | wallets, continuity entries, unallocated-cash allocation | `export *` |
| shared | 197 | money (JOD minor), Amman business time, ids/asserts, quantity-milli, Arabic labels | curated named (kernel) |
| owner-safe-withdrawal | 149 | safe-withdrawal advisory reading | `export *` |
| actual-time | 115 | actual time records & summaries | `export *`; self-contained |

**Domain internal edges (measured):** 14 areas → `shared/`; `asset`, `loan`, `received-loan` → `financial-event/` (via barrel); `recurring-expense` → `financial-event/types.js` (the only intra-domain deep import); `owner-safe-withdrawal` → `g5/` (barrel). `catalog` and `actual-time` import nothing. **No cycles.** `shared/` is the de-facto shared kernel; `financial-event/` is the de-facto "records with reversals" hub. The public surface is locked by `tests/domain/public-surface.test.ts` (462 lines: presence + locked type surface + absence of removed symbols) — the strongest boundary mechanism in the repo.

### 5.3 Application layer — `apps/prototype-web/client/src/application/*` (31 subdirs, 78 production files, 26,318 production lines, 53 `*Service.ts`)

Largest subdirs: `finance/` **9,174** prod lines (19+ services), `transfers/` **4,071** (export/import subsystem), `fulfillment/` 1,652, `inventory/` 1,527, `collections/` 981, `scheduling/` 906, `catalog/` 652, `home/` 834, `g5/` 568, `assets/` 511, `cash/` 517, `loans/` 592, `agreements/` 484, `suppliers/` 434, `drafts/` 428, `activity/` 557, plus 16 smaller (security, diagnostics, parties, preferences, share, time, estimates, follow-up, input, owner, cost, financial-pulse, profile, identity).

**Composition root** (`app/PrototypeServicesContext.tsx`, 367 lines): 42 `new *Service(` instantiations (synthesizer-verified; each unique) + 4 lazy dynamic-import services (loanService, localTransferService, guidedOpeningImportService, recurringExpenseService — bundle-budget pattern D-034). `ProjectFinancialService` (1,518 lines, 12 public methods) is the documented single financial reading core, importing from 8 domain areas and 5 application modules. `IntegrityCheckService` (1,460) runs 16 read-only cross-area checks (MIC-1..MIC-18).

### 5.4 Presentation layers

`pages/` 60 non-test files, 29,043 prod lines, 58 routes in `MicroRouter.tsx`; `components/` 83 files in 16 subdirs (13,483 prod lines; biggest `finance/` 17 files); `presentation/` 17 files (976 prod lines: formatters/labels/plurals/stateAdapter — pure TS, no React in production files); `contexts/` 1 file (76 lines, ThemeContext only); `lib/` 3 files (197 lines); `pwa/` 9 files (435 prod lines); `styles/` 5 files. **Observation (INFERRED):** the size pyramid is inverted vs the "thin application" intent — pages 29,043 and application 26,318 vs domain 10,257 prod lines.

### 5.5 Storage/adapters — `storage/local/` (20 production files, ~9,664 prod lines + tests)

`types.ts` (885) = the Port (`PrototypeLocalStore`, **131 methods** — three independent counts agree) + ~40 persistence record types + schema constants (38/30); `IndexedDbLocalStore.ts` (4,139; 37 object stores; guarded multi-store atomic commits); `MemoryLocalStore.ts` (2,099; same 131-method surface); `indexedDbMigrations.ts` (564; schema 1→38); `indexedDbSnapshot.ts` (432); lifecycle/primitives/stores helpers; `influentialSnapshotFamilies.ts` (compile-time snapshot completeness); **9 commit-guard modules** (supplierScheduleCommitGuard 357, deliveryReversalCommitGuard 299, recurringExpenseCommitGuard 165, orderCommitGuard 102, expenseBudgetCommitGuard 80, receivedLoanCommitGuard 69, loanCommitGuard 67, cashContinuityCommitGuard, supplierAttributionCommitGuard) shared by both adapters.

### 5.6 App shell & cross-cutting

`app/` (18 files, 2,241 lines): `MicroRouter.tsx` (257; 58 routes), `PrototypeServicesContext.tsx` (367), `navigationContract.ts` (216), `StartupGate.tsx` (99; ESLint-waived), `CapabilityRouteGate`, route classifiers. Ownership guard: `docs/contracts/40-technical-ownership-map-contract.md` + `app/ownershipBoundaries.exe017.test.ts` (permanent architectural test). Entity registry: `docs/quality/persistent-entity-touchpoints.json` (37 stores + 3 localOnlyRecords) + `scripts/check-entity-touchpoints.mjs`.

---

## 6. Oversized-file and responsibility map (top 20 production files, VERIFIED)

| # | File | Lines | Distinct responsibilities coexisting |
|---|---|---|---|
| 1 | `storage/local/IndexedDbLocalStore.ts` | 4,139 | full 131-method port for ~22 record families + 25+ multi-store atomic commit transactions + IndexedDB plumbing + snapshot read/replace |
| 2 | `storage/local/MemoryLocalStore.ts` | 2,099 | same port in-memory; duplicated per-family logic; conformance-tested against adapter #1 |
| 3 | `pages/OrderDetail.tsx` | 1,888 | order read-model assembly + lifecycle action orchestration (deliver/collect/reverse/cancel/deposit) + share draft + navigation + presentation glue (51 `useState`, 8 `useEffect`) |
| 4 | `application/transfers/transferFamilyValidators.ts` | 1,715 | hand-rolled runtime type guards for every entity family — a second description of all domain shapes at application level (83 literal comparisons) |
| 5 | `pages/Finance.tsx` | 1,639 | finance hub: period result + events + corrections + policies + obligations + budgets + deposits + G5 decision + safe withdrawal (mostly sectioned already) |
| 6 | `application/finance/projectFinancialService.ts` | 1,518 | event recording + position + period result + insights + reversals + unallocated distribution + edit/delete/restore (12 public methods) |
| 7 | `src/domain/craft-order/policies.ts` | 1,493 | order creation + transitions + cost snapshot + deposit lifecycle + debt + delivery terms + corrections (cohesive but monolithic) |
| 8 | `application/finance/integrityCheckService.ts` | 1,460 | 16 cross-area integrity checks + report assembly + Arabic titles |
| 9 | `application/inventory/inventoryMaterialService.ts` | 1,432 | materials + movements + shortages + activation + waste/cost readings + catalog-linked suggestions (25+ methods) |
| 10 | `pages/FinancialEventEditor.tsx` | 1,285 | guided event entry: shared-expense allocation + budgets + wallets + correction flows (31 `useState`) |
| 11 | `application/transfers/transferSnapshotValidation.ts` | 1,185 | snapshot structure/version/semantics validation for import |
| 12 | `pages/SupplierPurchaseEditor.tsx` | 1,184 | purchase entry + payments + wallet coverage + attribution (27 `useState`) |
| 13 | `pages/OwnerEntitlement.tsx` | 1,157 | owner money hub: policies + records + movements + opening balances (52 `useState`; sections exist) |
| 14 | `application/finance/ownerEntitlementService.ts` | 1,109 | owner policy/record/movement/opening-balance orchestration + settlement arithmetic |
| 15 | `pages/Schedule.tsx` | 1,035 | capacity schedule board + recurrence + follow-up |
| 16 | `pages/DirectSaleEditor.tsx` | 1,022 | direct sale entry + collection + price cuts (31 `useState`) |
| 17 | `pages/InventoryMovementEditor.tsx` | 973 | movement entry + shortage resolution + cost knowledge |
| 18 | `storage/local/types.ts` | 885 | port interface (131 methods) + snapshot types + schema constants + Stored* wrappers composing 13 domain areas |
| 19 | `pages/InventoryMaterials.tsx` | 880 | materials list + tracking decisions + shortage + waste views |
| 20 | `components/finance/EventsLayer.tsx` | 843 | events list + row view logic + family-owner deep links + labels |

Just outside: `pages/Statement.tsx` 833, `application/finance/recurringExpenseService.ts` 818, `pages/Catalog.tsx` 813 (62 `useState`), `application/fulfillment/fulfillmentService.ts` 762. **21 pages ≥ 500 lines.** UI-structure implications are Wave T territory (owner-gated); this scan records them as change-isolation evidence only.

---

## 7. Dependency/layer/cycle/deep-import findings (all MEASURED)

### 7.1 Layer matrix (production edges)

| From → To | Edges | Notes |
|---|---|---|
| pages → components | 262 (59 files) | normal |
| pages → app | 167 (59 files) | navigation/feedback utilities live in the shell |
| pages → application | 87 (42 files) | deep service-file paths (no barrels) |
| pages/components/app → domain | 67 non-test (16 value) | bypasses Application; policy undecided (STR-106) |
| components → application | 51 (34 files) | deep paths |
| app → pages (routing) | 60 (1 file: MicroRouter) | composition-root routing |
| app → application | 53 (1 file: PrototypeServicesContext) | composition root |
| application → domain | 158 (54 files) | via barrels (except 3 dynamic deep imports) |
| application → storage | 66 (58 files; 62 into `types.ts`) | port + records live in the adapter dir |
| application → presentation | 14 value edges (12 files) | upward dependency, not ESLint-banned (STR-203) |
| storage → domain | 75 (13 files; type-only) | adapter→domain, correct direction |
| storage → application | 0 production (8 test-file edges) | clean |
| pwa → application | 2 (register.ts → diagnostics) | documented singleton use |

Domain purity: **0 non-relative imports** in all 60 production domain files; 0 edges leaving `src/domain/`; the only external import anywhere in domain is `vitest` in 1 colocated test (documented exception). Enforced by ESLint blocks 2–4 and proven by fixtures in `scripts/check-layer-boundaries.test.mjs`.

### 7.2 Cycles

- **Runtime cycles: 0** — the repo guard's own output reproduced: "319 production files scanned, 0 runtime cycles" (type-only edges ignored by design).
- **Type-level SCCs: 3** (all-edges graph): (a) `storage/local/types.ts` ↔ `supplierScheduleCommitGuard.ts` — the documented Preserve cycle; (b) `application/g5/g5Service.ts` ↔ `application/finance/projectFinancialService.ts` — **undocumented** (g5Service type-imports ProjectFinancialService; projectFinancialService value-imports `expenseInputs/orderInputs`); (c) `components/finance/FinancePeriodResultSection.tsx` ↔ `pages/Finance.tsx` — **undocumented** (component imports `FinanceState` type from the page; page value-imports the component). The guard's header comment claims only cycle (a) exists — stale (STR-204).

### 7.3 Deep imports and barrels

- 654 cross-area domain edges: **648 via barrels (99.08%), 6 deep**: (1) `integrityCheckService.ts:1437` dynamic `@micro-domain/craft-order/settlementInvariant.js` — symbol **not exported by the barrel** (the only import path is the deep one; D-034 bundle-budget rationale in-code); (2) `projectFinancialService.ts:1012` and (3) `g5Service.ts:368` dynamic `@micro-domain/g5/operatingBreakEven.js` — symbols ARE in the barrel (D-034); (4) `recurring-expense/policies.ts:37` type-only `../financial-event/types.js`; (5)+(6) `recurring-margin` → `inventory-material` re-export alias pair (documented STR-030 compatibility alias with twinning tests).
- The **only barrel in the whole client app** is `components/primitives/index.ts`. Application (78 production files) and storage (20) have no barrels: 65 of 78 application production files are imported directly by UI layers (196 production edges). 13 application files are internal-only helpers.

### 7.4 Storage access conformance (AGENTS.md §10.6)

Production runtime UI→storage imports = **2**, both documented ESLint waivers (`StartupGate.tsx` → `persistentStorage`; `PrototypeServicesContext.tsx` → `createBrowserLocalStore`, each with a removal condition). 19 production **type-only** import sites in UI (policy: `allowTypeImports: true`). 98 test-file imports (94 root client tests — by design, F-044). 0 `localStorage`/`sessionStorage` violations in production pages/components.

### 7.5 ESLint boundary inventory (17 blocks) and what it does NOT restrict

Enforced: domain purity (static+dynamic imports, browser globals, Math ban D-02); application/storage React-free and UI-import-free (value AND type — Group 8 STR-005); app-shell storage runtime ban; pages/components storage value-import ban + globals ban; primitives are leaves; root client tests linted; lint budget `--max-warnings 37`; 9 documented waivers (2 app-shell storage, page/component test helpers, domain-test vitest, shared Math exemption, 3 application Math files, STR-030 alias, D-034 dynamic deep imports). Guard self-test: `scripts/check-layer-boundaries.test.mjs` (373 lines, runs the real engine on fixtures — runs in CI).

NOT restricted (measured gaps): application → `@/presentation` (14 value edges exist); presentation/pages/components → `@micro-domain/*` (67 non-test edges); components → `@/pages` for non-primitives (1 real type edge); application-internal direction (finance↔g5↔fulfillment unregulated); domain-area↔domain-area edges; `lib/` has no import restrictions; all bans are specifier-string-based (`@/…`), so relative-path escapes would bypass them (0 exist today — verified by resolution-based scan).

### 7.6 Hidden coupling

7 localized module-level mutable-state sites: `localDiagnostics` singleton (consumed by ErrorBoundary/Settings/pwa outside the composition root), `routeTemplate` array init, formatters memoization cache, pwa `dirtyRegistry`, pwa `register` SW state machine, `indexedDbLifecycle` cached connection, `indexedDbMigrations` exported mutable `WeakMap` (the only *exported* mutable state). All localized, none carry financial truth.

---

## 8. Domain/application/storage/UI composition map (flows traced — VERIFIED)

Six representative flows were traced end-to-end (exact file chains in the specialist evidence):

- **A. Craft order:** `NewDraft/DraftEditor` → `draftService`/`costService` → domain `calculateCostSnapshot` (computed & frozen ONLY in domain: `craft-order/policies.ts:243/129`, `Object.freeze` on clone) → `AgreementService.record` (builds CraftOrder via domain factories → `commitOrderFromDraft` atomic order+draft+schedule) → `OrderDetail` → `fulfillmentService`/`deliveryReviewService` (`commitDelivery`/`reverseDelivery` → `commitOrderDelivery/…Reversal` guarded 5-store transactions). Policy=domain; orchestration=services; persistence=adapters+guards; presentation reads via `usePrototypeServices()` + `dataVersion` bump (BroadcastChannel `micro-data-changed`).
- **B. Financial event:** `FinancialEventEditor` → `projectFinancialService.record()` (idempotency pre-check → `expenseRecordIntent` expansion → domain limits → `withdrawalWalletGuard.evaluateWithdrawalWalletCoverage` → domain `createFinancialEvent` → `saveFinancialEvent`); wallet distribution is a **separate** `commitCashContinuity` keyed by `operationKey` with unallocated cash bridging — deliberate data-behavior, not a structural defect.
- **C. Inventory:** editors → `inventoryMaterialService` (operationKey idempotency, domain `assertInventoryRemainsNonNegative`/`positionCostKnowledge` → `createInventoryMovement`; waste-with-known-cost → `createFinancialEvent(loss_non_cash)` → atomic `commitInventoryWithEvents`; shortage path `commitInventoryWithShortage`).
- **D. Owner funds:** `OwnerEntitlement` → `ownerEntitlementService` (5 parallel reads, `owner-movement:<key>` pairing, wallet coverage for draws, **settlement-remaining arithmetic computed inline in the service** → domain `createOwnerMovement` + `createCashContinuityEntry` → atomic `commitOwnerMovement`).
- **E. Export/import:** Settings → lazy `localTransferService.createExport` (envelope v30/schema 38, sha256 integrity + counts, AV-04) → `prepareImport` (format → pair gate over 21 released legacy pairs → integrity → `migrateTransferSnapshot` → `validateSnapshot` → counts) → `confirmImport` (builds a **verified full backup first** via round-trip, then atomic `replaceSnapshot`).
- **F. Cash continuity:** wallet pages → `cashContinuityService` (single-opening rule via guard) → domain factories → `commitCashContinuity`; Finance.tsx consumes statement/periodComparison/profitToCashBridge/shortCashHorizon read models. Note: `Finance.tsx:1374` calls domain `calculateSafeWithdrawal` directly in the page (STR-304).

**Where the layers mix (evidence-backed):**
1. **Financial policy in Application (STR-302, owner decision):** `derivePeriodCogs` (projectFinancialService.ts:377-436 — implements "purchase ≠ COGS / missing ≠ zero"), expense classification helpers, `evaluateWithdrawalWalletCoverage` (withdrawalWalletGuard.ts:37-60), owner settlement arithmetic (ownerEntitlementService.ts:949-1006). Counter-evidence: ARCHITECTURE.md designates ProjectFinancialService as the single canonical reading core; `periodResultCanonical.test.ts` locks it; g5/safe-withdrawal ARE domain functions. Whether each equation is read-model composition (allowed) or domain rule (misplaced) is a per-equation owner decision.
2. **Port owned by the adapter directory (STR-102/301):** `storage/local/types.ts` hosts port + records + constants; 62 application production edges + 19 UI type sites depend on it; documented type-only cycle with a guard module.
3. **Storage records as UI view models (STR-305):** 16 non-test UI files type-import `StoredCraftOrder`/`CostEstimate` etc. from `@/storage/local/types`.
4. **Application imports presentation (STR-203):** 12 files/14 value edges into `@/presentation/formatters` etc. (pure TS formatting kernel shared by services and UI).
5. **Pages call domain directly (STR-106):** 6 pages import domain VALUE functions (e.g., `Finance.tsx` → `calculateSafeWithdrawal`; `OrderDetail.tsx` → `orderResultBreakdown`, `hasDeliveredEvent`…); 67 non-test UI→domain edges total (16 value).
6. **Business invariants split between domain policies and 9 storage commit guards (STR-115):** guards compare payloads (idempotency reuse → base-vs-live CAS → extension checks) inside the write boundary; pure and shared by both adapters — no financial rule derivation in them (they compare, not compute).
7. **Clock:** 42 constructor-injected `now: () => string` lambdas across application services; exactly one domain wall-clock default (`shared/businessTime.ts:38`); business date = Asia/Amman via `Intl` (ICU-dependent). No Clock port exists (STR-309).
8. **Diagnostics:** 8-field, never-uploaded, localStorage-backed service in application with documented singleton exception (STR-310 — PRESERVE).

**Structural vs semantic/data-sensitive split:** port size/ownership, adapter file size, import directions, DI pattern, type ownership, barrel absence = STRUCTURAL (wave-eligible after gates). Rule relocation (STR-302 equations), validator consolidation, the two-commit event/wallet sequence, schema/export versions & legacy pairs & migrations, guarded-commit semantics, reversal/idempotency invariants, JOD-cents/milli/Amman contracts = SEMANTIC or DATA-SENSITIVE — excluded from all structural waves.

---

## 9. Sources-of-truth and duplication map (VERIFIED)

| Fact | Authoritative source | Guarded echoes | Enforcement |
|---|---|---|---|
| schema 38 / export 30 | `storage/local/types.ts:55,71` | AGENTS.md §10/§13, current-state.md §1/§3.1, doc-index rows 12C-4/5, contracts 39–42, coverage/traceability headers | `group3-6Docs` tests pin literals; doc-index guard pins `اليوم 38/30`; double-diff rule (owner decision to raise) |
| Bundle budget 650,000/155,000 | `apps/prototype-web/scripts/check-bundle-budget.mjs` | vite `closeBundle` **delegates to the same script** (single source); AGENTS/current-state/log | `group6Docs` asserts constants; runs in both build paths |
| Lint cap 37 | `package.json` `--max-warnings 37` | AGENTS §10/§13, D-032, log §36 | `group6Docs` asserts script content |
| 37 object stores | code (`indexedDbStores.ts` + migrations + types) | `docs/quality/persistent-entity-touchpoints.json` | `check-entity-touchpoints.mjs` (bidirectional) |
| Test counts 514/1996 | none (dated historical claim) | current-state.md §2 only | none — CI is live truth (explicit in the doc) |
| Document authority | AGENTS.md §2 (single reading map) → `docs/00-document-index.md` (catalog) → current-state.md (live, ≤20KB) → control JSON → generated views | folder READMEs defer by design | `check-doc-index-coverage.mjs` (full coverage for contracts/architecture/decisions/research + 48 canonical), `check-current-state-size.mjs`, `validate.py` |

**Real duplications found (each with the authoritative source named):** (1) the twin adapters' 131-method surfaces — inherent to the dual-adapter design, pinned by 5 `adapterConformance*` suites (the issue is port granularity, not the duplication itself); (2) `KnowledgeState` 6-literal union restated ×3 (domain `craft-order/types.ts:3`, storage `types.ts:321` private `CostEstimateKnowledge`, `transferFamilyValidators.ts:30-38`) — no runtime guard exported from domain (STR-211); (3) transfer validators re-listing domain status unions by hand (83 `value === "…"` comparisons) — mitigated for specific families that DO import domain guards (`isValidWasteContext`, `isValidOwnerEntitlementPolicy`, `DEPOSIT_SETTLEMENT_DECISIONS`…), the pattern exists but was not retrofitted to statuses (STR-104/509); (4) numeric governance echoes — governed, by design (change amplification ≥10 files per version bump). `StoredCraftOrder` etc. are NOT duplicates — they compose domain types.

---

## 10. Test, fixture, contract, and documentation map (VERIFIED)

**Tests (328 files):** 34 centralized domain unit tests (all 18 areas covered; biggest `craft-order` family ~3,237 lines) + 1 colocated + 1 at tests/ root; 116 application service tests (colocated); 23 storage tests (adapter conformance + per-area); 27 transfer round-trip/schema-pair suites (`schema29…34`, `envelope27`, `releasedPairs` 910, `localTransferService.test.ts` 2,052, `dataRoundTrip.exe014` 569); 6 commit-guard tests; 81 `.dom` journey tests + ~30 more at src root (97 root-level test files, program-code named); 12 page `.ui` tests; 6 contract-oracle tests; 7 characterization tests (rounding/quantity/exact-values/complex-six/waste-context/businessTime); 5 groupDocs governance tests + doc-pinning inside contract tests; ~10 architectural source-scan guard tests; 10 guard-script self-tests; 1 python control-plane test.

**Fixtures:** the only repo fixture consumed by a test is `docs/fixtures/g82-guided-opening-import-fixtures.json`. The historical 8/17 export-pair fixture is inline in `releasedPairs.test.ts` (per D-030). **No golden files, no test-vector files, no `__fixtures__` directories exist** — parity lives only inside test code (STR-401: Wave D must materialize).

**Contracts (49 files, numbers 01–43, 18–23 doubled: local prototype series vs network E-00 series; disambiguation codified in doc-index row 12C-1; owner decision D3 forbids renumbering).** Only contracts 02/05/08/26/39/40 are read by tests (oracle pattern) — 40 is also behaviorally enforced by `ownershipBoundaries.exe017.test.ts`. 42/49 referenced by Operations Control items; 19 unreferenced (E-00 network series + local 07/19/20/21/22/26/30/33/36/37/38) — their truth lives in traceability/log/reports (STR-411). Code↔contract linkage is comment-based (`عقد ٢٨` ×32 in inventoryMaterialService, `عقد ٤١` ×11 in recurringExpenseService, etc.).

**Documentation governance:** single reading map (AGENTS §2); guarded doc-index; size-guarded live state; append-only log (1,705 lines); Operations Control (78 items / 52 workstreams, JSON→generated views, validated); `docs/implementation-traceability.md` (749 lines, stopped at transfer-program Group 4) vs `current-state-log.md` (continued to §101) — dated-snapshot discipline, no conflict. Decision records: D-001…D-041 + parallel registers (owner-decisions, EX-D, F-series, REM) with a referral table; 18 test files and 6 production files cite D-IDs.

**Coverage gaps (evidence for waves D/Q):** transfer helper cluster (5 modules incl. 1,715-line validators) has **zero direct test references** (STR-405); `expenseBudgetService` no direct test (STR-406); `contexts/`+`lib/` no direct tests (STR-407); 46/59 pages without colocated tests, no page→test registry (STR-408); 2 tested services undocumented (STR-412).

---

## 11. Feature discoverability assessment

**What works (PRESERVE):** the agent path (README → current-state → AGENTS §2 routing table → doc-index) is guarded and unambiguous; domain areas are business-named with 100% barrel imports (census: 93× craft-order, 85× financial-event, 53× cash-continuity, …); ARCHITECTURE.md documents the responsibility path and counting methods; routing/navigation contract are tested; ownership map (contract 40) + exe017 test is a working ownership registry precedent; entity touchpoints registry; public-surface lock.

**Gaps (evidence):** (1) `application/` has no barrels/READMEs — discovery by filename convention; domain-area↔application-subdir mapping is 1-to-many and inconsistent (owner-entitlement ↔ `finance/ownerEntitlementService` + `owner/ownerProfileService`; craft-order ↔ fulfillment+collections+agreements+scheduling+drafts) (STR-213); (2) test placement split three ways: `tests/domain/` (17 areas) vs `tests/` root (owner-entitlement) vs colocated (direct-sale), plus 97 program-code-named root journey tests — no test map or reverse index (STR-111/408); (3) "g5/G3/G4-B" wave labels as module names — a new agent must learn that g5 = break-even/short-cash/direct-margin (STR-110); (4) stale references in entry docs: AGENTS.md lists `qa/` (renamed 2026-10-01 to `docs/operations/archive/quality-history/`), contract 40 cites `application/cost-estimates/` (actual: `application/estimates/`), a deleted CatalogPoliciesSection path, `application/recurring-work/` (actual: `finance/recurringWorkService.ts`) (STR-403); (5) 19 contracts without machine-readable status (STR-411).

---

## 12. Future-evolution assessment (triggers only — no platform work proposed or authorized)

**Portability verdict (VERIFIED):**
- **Domain purity: CLEAN.** Zero non-relative imports, zero browser globals, zero runtime package deps (root `package.json` has no `dependencies`; app runtime deps are UI-only). The portable heart for any future platform exists today.
- **Money: FROZEN & COHERENT.** `MoneyMinor` integers (piastre = 1/100, 2 decimals, D-15 deliberate ISO 4217 deviation); scale appears only in display formatters, input parsing, and 6 domain error strings; rounding via shared helpers with Math bans enforced.
- **Persisted shapes: JSON-neutral** (string-literal unions, ISO strings, integer minors, `null` absence). **4 Wave-U caveats:** tri-state `undefined` update inputs (asset/direct-sale, D-001 documented), `Date | string` at the `businessTime` API edge, `Date.parse` validation (implementation-defined for non-ISO; Micro data is ISO), error identity = exact Arabic message strings golden-tested in 21 files (storage/transfer failures DO have codes; domain use-case failures do not).
- **Storage port: technology-neutral but very wide** — 131 methods + 9 guard modules + 22 legacy pairs + sha256 envelope; `MemoryLocalStore` proves the port is implementable without IndexedDB.
- **Clock: injected (42 sites); one domain default; business time ICU/tzdata-dependent (Asia/Amman, day boundary 21:00Z, documented honestly in the module header).**

**Trigger table (none met — VERIFIED absence of any platform code: no `.dart`, no pubspec, no product Python (only repo tooling), no backend SDKs, no Auth/Sync/Cloud; pre-pilot gate BLOCKED; E-00 docs-only):**

| Platform | Wave | Trigger (per approved plan) | Met today? |
|---|---|---|---|
| Language-neutral contracts + vectors | U | a real non-TypeScript consumer exists | **NO** |
| Flutter/Dart or native mobile | V | a real owner decision for a mobile app; separate spike; same vectors + parity | **NO** |
| Python/API/Auth/Sync/Reporting | W | real need + MVP-commercial phase gate; Python never owns offline financial truth | **NO** |
| Service extraction | X | boundary stable AND measured independent benefit; ADR with numbers | **NO** |

**Structural risks for the program itself:** adapter-pair split carries a parity-test blast radius (5 conformance suites + per-area suites are the oracle); the transfer gate's hand-written unions are the highest-probability data-compatibility trap (a future status addition that misses the validators → app rejects its own exports); revert-insufficient zones are precisely identified and fenced (schema/export/snapshot/migrations; `confirmImport` creates a verified backup before `replaceSnapshot`); guard blind spots for structural changes are enumerated (type-only cycles invisible; warning-budget reshuffles; no deep-import guard yet; coverage gaps on unexercised seams; freeze/sequencing/consumer-inventory discipline is doc-enforced).

---

## 13. Complete findings register

IDs are stable. Where specialists independently surfaced the same root cause, one **master finding** is kept and duplicates are linked (column `Linked`). The linked IDs are aliases of the master and are not repeated as separate findings. Severity reflects impact on the *program's goals* (development/extensibility/change isolation/data safety), not runtime-bug urgency — no production defect is alleged by this scan.

### 13.A Preserve — healthy, evidence-anchored (do not touch without an approved wave)

```
ID: STR-101
Title: Domain Core has a uniform, locked module skeleton — 18 barrels + public-surface contract test; fully pure
Evidence class: VERIFIED
Owner classification: PRESERVE
Severity: Low
Current evidence: src/domain/*/index.ts (18/18); tests/domain/public-surface.test.ts (462 lines; presence + locked type surface + REMOVED_SURFACE_SYMBOLS absence); AST scan: 0 non-relative imports in 60 production files; eslint.config.js:26-121 + fixtures in scripts/check-layer-boundaries.test.mjs. Linked: S2:STR-201, S5:STR-501.
Affected boundaries: Domain Core ↔ everything.
Why it matters: financial / data / change isolation — the load-bearing wall; future-platform asset.
Root cause or uncertainty: none (Group-6 hardening output, holding).
Minimum safe remediation: none. Extend the pattern to other layers only via approved waves (J).
Dependencies and ordering: precedes Wave J/K.
Acceptance criteria: public-surface test passes unchanged after any wave.
Rollback boundary: any wave touching domain keeps barrels green; revert at wave base SHA.
Explicit non-goals: renaming barrels/areas; moving domain files.
```

```
ID: STR-207
Title: Runtime UI→storage boundary is clean (exactly the 2 documented waivers); 19 type-only sites by policy
Evidence class: VERIFIED
Owner classification: PRESERVE
Severity: Low
Current evidence: measured: 2 runtime imports (StartupGate.tsx:6 → persistentStorage; PrototypeServicesContext.tsx:74 → createBrowserLocalStore; waivers at eslint.config.js:304-332 with removal conditions); 19 type-only UI sites; 98 test-file imports (94 root tests, by design F-044); 0 localStorage/sessionStorage violations.
Affected boundaries: AGENTS §10.6 boundary.
Why it matters: security / data — the runtime boundary holds.
Root cause or uncertainty: deliberate policy (allowTypeImports:true).
Minimum safe remediation: none. Optionally track the 19 type sites for later reduction (Waves J-K).
Dependencies and ordering: none.
Acceptance criteria: continued zero unwaived runtime imports.
Rollback boundary: n/a.
Explicit non-goals: removing the two waivers (their removal conditions are future waves).
```

```
ID: STR-306
Title: Guarded-commit protocol (idempotency + CAS) is adapter-owned via 9 shared pure guard modules — correctly placed
Evidence class: VERIFIED
Owner classification: PRESERVE
Severity: Low
Current evidence: storage/local/{order,supplierSchedule,deliveryReversal,recurringExpense,expenseBudget,loan,receivedLoan,cashContinuity,supplierAttribution}CommitGuard.ts; invoked inside IndexedDB transactions and mirrored in MemoryLocalStore; parity via 5 adapterConformance suites + adapterDeliveryReversal.test.ts (401); port documents storage_stale-no-write (types.ts:445-456). Guards compare payloads — they derive no amounts.
Affected boundaries: Adapter ↔ Port ↔ Application.
Why it matters: data — implements AGENTS §10.7 at the write boundary.
Root cause or uncertainty: design intent.
Minimum safe remediation: none; Wave N inventories them as port candidates (plan names them).
Dependencies and ordering: none.
Acceptance criteria: unchanged behavior; guards single-sourced.
Rollback boundary: n/a.
Explicit non-goals: guard edits or moves.
```

```
ID: STR-307
Title: The port file has a documented type-only cycle with supplierScheduleCommitGuard (SupplierPurchaseCommit type)
Evidence class: VERIFIED
Owner classification: PRESERVE
Severity: Low
Current evidence: storage/local/types.ts:39 imports the commit type from the guard; guard imports types from ./types; both directions import type; documented Preserve in scripts/check-runtime-cycles.mjs header.
Affected boundaries: port contract ownership.
Why it matters: change isolation — naive "split types.ts" waves would break or duplicate it.
Root cause or uncertainty: commit-message type co-located with its validator.
Minimum safe remediation: keep documented; if types.ts is ever split (approved wave), move the type into the port file first (pure type move).
Dependencies and ordering: prerequisite detail for Wave O/P planning.
Acceptance criteria: cycle remains type-only.
Rollback boundary: n/a.
Explicit non-goals: any move now.
```

```
ID: STR-310
Title: Local diagnostics: 8-field, never-uploaded, localStorage-backed, documented singleton
Evidence class: VERIFIED
Owner classification: PRESERVE
Severity: Low
Current evidence: application/diagnostics/localDiagnosticsService.ts (190 lines; exactly 8 fields; MAX 25 entries/48,000 bytes; no network); registered in persistent-entity-touchpoints.json localOnlyRecords with notExportedReason; ARCHITECTURE.md documents the naming exception.
Affected boundaries: privacy boundary.
Why it matters: security — keeps the no-secrets/no-upload promise auditable in one file.
Root cause or uncertainty: intentional (Group 5).
Minimum safe remediation: none.
Dependencies and ordering: none.
Acceptance criteria: unchanged.
Rollback boundary: n/a.
Explicit non-goals: field additions; any upload path.
```

```
ID: STR-312
Title: Clean DI composition root + 4 lazy services + 4 documented page-level constructions
Evidence class: VERIFIED
Owner classification: PRESERVE
Severity: Low
Current evidence: 42 new *Service( (synthesizer-verified) + 4 lazy dynamic imports (loans, transfers, guidedOpeningImport, recurringExpense) in PrototypeServicesContext.tsx; getPrototypeLocalStore() consumed by 4 UI sites that construct lazy services inside import() effects (ReceivedLoanEditor, Loans, ReceivedLoanDetail, ExpenseBudgetsSectionBody) — EXE-014/D-034 pattern; zero runtime port calls in pages/components.
Affected boundaries: composition root ↔ pages.
Why it matters: development — DI discipline with documented, budget-driven exceptions.
Root cause or uncertainty: bundle-budget-driven lazy loading.
Minimum safe remediation: none; no new UI getPrototypeLocalStore() sites without an ADR.
Dependencies and ordering: none.
Acceptance criteria: no new un-ADR'd sites.
Rollback boundary: n/a.
Explicit non-goals: eager loading; context registration changes.
```

```
ID: STR-314
Title: Historical-value protection is real and tested (snapshot freeze, reversesEventId, resultStatus gating, idempotency, envelope integrity)
Evidence class: VERIFIED
Owner classification: PRESERVE
Severity: Low
Current evidence: craft-order/policies.ts:121-141 (clone+freeze+self-consistency), :1047-1101 (reverseDelivery: neutralizes revenue/cost, resultStatus=review_required, reversesEventId, mandatory reason+idempotencyKey, double-reversal rejected); deliveryReversalCommitGuard mutual-relation guard; reviewLockBoundary.test.ts (183); every commit* carries keys; transferEnvelope.ts 21 released pairs + sha256 + counts (AV-04). Suite execution NOT_EXECUTED in scan (CI is the oracle).
Affected boundaries: Domain ↔ storage ↔ export.
Why it matters: financial / data — the unbreakable rules; parity oracles for Wave D.
Root cause or uncertainty: hardening program output.
Minimum safe remediation: none; waves must cite these suites as parity oracles.
Dependencies and ordering: Wave D baseline runs them.
Acceptance criteria: all cited tests green at baseline SHA.
Rollback boundary: n/a.
Explicit non-goals: any change to snapshots/reversals/versions.
```

```
ID: STR-315
Title: Persistent-entity touchpoints registry matches reality (37/37) with a bidirectional guard
Evidence class: VERIFIED
Owner classification: PRESERVE
Severity: Low
Current evidence: docs/quality/persistent-entity-touchpoints.json (37 objectStores + 3 localOnlyRecords with reasons); scripts/check-entity-touchpoints.mjs extracts stores from code and snapshot fields from types.ts, fails on unregistered/orphan/missing-path; wired into pnpm guards → CI.
Affected boundaries: storage ↔ export/import ↔ tests ↔ docs.
Why it matters: data / change isolation — the contract that kept 9-surface change amplification honest.
Root cause or uncertainty: Group-6 rule 8.
Minimum safe remediation: none.
Dependencies and ordering: template for the Wave F ownership registry.
Acceptance criteria: guard exits 0 (CI-verified).
Rollback boundary: n/a.
Explicit non-goals: registry edits.
```

```
ID: STR-404
Title: Numeric governance is a deliberate "double diff" (38/30, 650k/155k, lint 37) — governed duplication, high change amplification
Evidence class: VERIFIED
Owner classification: PRESERVE
Severity: Medium
Current evidence: authoritative in code (types.ts:55/71; check-bundle-budget.mjs:32-33 with vite closeBundle delegating to the same script; package.json lint); literal pins in group3/4/5/6Docs tests + doc-index guard line 125; echoes in ≥10 doc files; owner decision required to raise any cap (AGENTS §10).
Affected boundaries: storage, scripts, docs authority chain, any version-bump PR.
Why it matters: change isolation / data — prevents silent raises at the cost of ≥10-file synchronized edits.
Root cause or uncertainty: deliberate anti-silent-raise design (F-033/W4-B).
Minimum safe remediation: none now; a later wave may reduce redundant literal pins to the single live-pair derivation pattern (owner-gated).
Dependencies and ordering: any reduction rides Wave S with owner gate.
Acceptance criteria: unchanged.
Rollback boundary: n/a.
Explicit non-goals: raising caps; weakening guards.
```

```
ID: STR-410
Title: Governance tests hard-bind docs structure — every docs-touching wave must update them in lockstep
Evidence class: VERIFIED
Owner classification: PRESERVE
Severity: High
Current evidence: group2-6Docs.test.ts pin exact Arabic sentences and §-headings in current-state-log.md/todo.md; check-doc-index-coverage.mjs pins literal "اليوم 38/30"; Wave3Glossary/Wave4ContractOracles/FinalLogicOwnerDecisions pin contract/glossary sentences.
Affected boundaries: docs/operations/*, contracts {02,05,26,39,40}, glossary, PR template, this program's own doc moves.
Why it matters: change isolation — intentional anti-silent-edit protection; conversely, deleting assertions to make a move pass would silently remove protection.
Root cause or uncertainty: F-033/W4-B design.
Minimum safe remediation: preserve; per docs-touching wave: enumerate affected governance tests and update expectations in the same PR; never delete assertions without owner decision.
Dependencies and ordering: applies to Waves Q/S/Z.
Acceptance criteria: each docs-touching PR lists the governance tests it updated.
Rollback boundary: expectations revert with the docs revert.
Explicit non-goals: decoupling tests from docs now.
```

```
ID: STR-415
Title: moneyLayerGuard freezes the F-049 UI money-computation mirror family — lockstep-update constraint for Wave T
Evidence class: VERIFIED
Owner classification: PRESERVE
Severity: Medium
Current evidence: moneyLayerGuard.contract.test.ts (BARE_ARITHMETIC/MATH_ROUNDING/MONEY_REDUCE patterns over pages/components/app TSX) freezes the documented mirror family; fails on any NEW money computation site in UI.
Affected boundaries: client/src/{pages,components,app}, Wave T/R.
Why it matters: financial — interim control until the UI cleanup wave; moving components relocates expressions and trips the census.
Root cause or uncertainty: F-049 (UI mirrors documented, not yet repaired).
Minimum safe remediation: preserve; list as lockstep guard for every Wave T slice.
Dependencies and ordering: binds Wave T.
Acceptance criteria: no Wave T PR merges with an unlisted new mirror site.
Rollback boundary: guard list reverts with the move.
Explicit non-goals: repairing the F-049 family in this program.
```

```
ID: STR-413
Title: Duplicate contract numbers 18–23 (two series) — owner-accepted; citation discipline required
Evidence class: VERIFIED
Owner classification: PRESERVE
Severity: Low
Current evidence: 49 files for numbers 01-43; 18-23 doubled (local prototype vs network E-00); doc-index row 12C-1 codifies disambiguation; owner decision D3 forbids renumbering.
Affected boundaries: docs/contracts; code comments citing عقد ١٨–٢٣.
Why it matters: debugging — quoting the wrong series in a financial decision.
Root cause or uncertainty: two independent numbering sequences; renumbering rejected.
Minimum safe remediation: preserve; Wave Q map carries a series tag column; one read-only audit of عقد 18-23 code comments.
Dependencies and ordering: Wave Q.
Acceptance criteria: map column present.
Rollback boundary: docs-only.
Explicit non-goals: renumbering; merging series.
```

```
ID: STR-414
Title: Test-count and SHA claims in current-state.md are historical statements by design — re-derive at each gate
Evidence class: NOT_EXECUTED (suite not run)
Owner classification: PRESERVE
Severity: Low
Current evidence: current-state.md §2 claims 514/514 + 1996/1996 (log §84/§85) and head a6b80179; live head is e7688efd (+1 docs-only #298); file's own read-fresh rule governs; static it( counts 537/1960 consistent (INFERRED).
Affected boundaries: program reporting.
Why it matters: development — treating dated claims as live truth without CI would be the actual risk.
Root cause or uncertainty: dated-snapshot discipline.
Minimum safe remediation: none; Wave D records fresh pass/fail at its base SHA.
Dependencies and ordering: Wave D supersedes.
Acceptance criteria: Wave D records its own counts.
Rollback boundary: n/a.
Explicit non-goals: adding a count-guard test.
```

```
ID: STR-504
Title: Money representation is frozen, coherent, single-sourced (integer minor units; piastre=1/100; 2 decimals)
Evidence class: VERIFIED
Owner classification: PRESERVE
Severity: Low
Current evidence: src/domain/shared/currency.ts (MoneyMinor=number, Currency="JOD"); safe-integer discipline (assertPositiveMinor, addSafe, roundHalfUp); D-15 documented deviation; /100 appears only in display formatters, input parsing, and 6 domain error strings; Math bans enforced (D-02/A-07).
Affected boundaries: domain/shared ↔ everything ↔ future contracts.
Why it matters: financial / data / portability — THE frozen decision (plan §3: no 1/1000 scale, no migration, explicit scale in any future neutral contract).
Root cause or uncertainty: none — strength.
Minimum safe remediation: none; Wave U vectors state scale explicitly and pin the 6 error strings.
Dependencies and ordering: feeds U/V/W.
Acceptance criteria: no /100 arithmetic on stored values (already true).
Rollback boundary: n/a.
Explicit non-goals: scale change; re-encoding; JOD=1000 anywhere.
```

```
ID: STR-507
Title: Clock is injectable and deterministic-by-construction; one domain default wall-clock
Evidence class: VERIFIED
Owner classification: PRESERVE
Severity: Low
Current evidence: 42 constructor-injected now: () => string across application (grep); deterministic tests inject fixed ISO strings; exactly one domain wall-clock (shared/businessTime.ts:38 default = new Date()); persisted times are ISO-8601 strings; UI new Date() only for ephemeral concerns.
Affected boundaries: time source ownership.
Why it matters: determinism / future parity.
Root cause or uncertainty: deliberate per-service injection pattern.
Minimum safe remediation: none; Wave U notes the default-parameter behavior.
Dependencies and ordering: feeds Wave U/V/W parity.
Acceptance criteria: met (tests inject fixed clocks).
Rollback boundary: n/a.
Explicit non-goals: Clock port extraction now (no second implementation — plan principle 8).
```

```
ID: STR-512
Title: Revert-insufficient zones are precisely identified and fenced (schema/export/snapshot/migrations + verified-backup-before-replace)
Evidence class: VERIFIED
Owner classification: PRESERVE
Severity: Medium
Current evidence: plan principle 18; zones: types.ts versions + indexedDbMigrations (any bump writes new stores/fields), LocalStoreSnapshot families + replaceSnapshot, transferSnapshotMigrations + envelope (import rewrites snapshots), evolving optional-field semantics; confirmImport builds a verified backup BEFORE replaceSnapshot (EXE-014); PR template mandates rollback-boundary + schema-impact fields; version pins guarded.
Affected boundaries: storage/local ↔ transfers ↔ domain record shapes.
Why it matters: data — the worst program outcome would be a "structural" wave that writes new-shaped data, making revert lossy.
Root cause or uncertainty: none — policy correct; residual risk is procedural compliance.
Minimum safe remediation: preserve; every wave card repeats the no-shape-impact assertion + rollback boundary.
Dependencies and ordering: all waves; Wave S is the only sanctioned shape work.
Acceptance criteria: every wave card carries code+data rollback boundary and read-compatibility statement.
Rollback boundary: (meta) for shape-changing emergency work: restore via verified export file, not git.
Explicit non-goals: migration authoring; version bumps.
```

```
ID: STR-513
Title: Operational control is largely executable; freeze/sequencing/consumer-inventory discipline remains review-enforced
Evidence class: VERIFIED
Owner classification: PRESERVE
Severity: Medium
Current evidence: CI runs lint+check (all guards, both vitest projects, build+budget); Operations Control validated (78 items/52 workstreams/0 active); PR template carries understanding card + rollback fields; doc-only: the freeze itself, no-features/ rule (D8), consumer-inventory-before-move, owner gates between waves; plan principle 16 honestly bounds guard capability.
Affected boundaries: whole-repo governance ↔ migration waves.
Why it matters: development in a single-maintainer agent-heavy workflow (~298 PRs).
Root cause or uncertainty: inherent — process decisions cannot be fully automated.
Minimum safe remediation: preserve; keep using claims per wave + wave cards; optional owner-gated hardening in Waves H/I — approval recorded in worklog before execution (refactoring-control vs current-state consistency guard; oversized-file ratchet counter).
Dependencies and ordering: Waves H/I are the sanctioned home for new enforcement.
Acceptance criteria: every structural PR: green CI + control item + wave card + rollback boundary.
Rollback boundary: guards additive; code-only revert.
Explicit non-goals: new guards written by this phase.
```

```
ID: STR-210
Title: Seven localized module-level mutable-state sites (incl. one exported application singleton and one exported mutable WeakMap)
Evidence class: VERIFIED
Owner classification: PRESERVE
Severity: Low
Current evidence: localDiagnostics singleton (consumed by ErrorBoundary/Settings/pwa), routeTemplate init, formatters memo cache, pwa dirtyRegistry, pwa register state machine, indexedDbLifecycle cachedConnection, indexedDbMigrations exported upgradeErrors WeakMap.
Affected boundaries: composition-root purity; testability.
Why it matters: debugging — implicit context; all localized, none carry financial truth.
Root cause or uncertainty: pragmatic caches/lifecycle registries.
Minimum safe remediation: none; register in Wave F registry; keep the exported WeakMap on the radar.
Dependencies and ordering: Wave F.
Acceptance criteria: registry lists each with owner+reason; count does not grow unregistered.
Rollback boundary: n/a.
Explicit non-goals: refactoring PWA lifecycle/caches.
```

```
ID: STR-117
Title: Ownership-guard precedent exists and works (contract 40 + ownershipBoundaries.exe017.test.ts)
Evidence class: VERIFIED
Owner classification: PRESERVE
Severity: Low
Current evidence: docs/contracts/40 + app/ownershipBoundaries.exe017.test.ts (181 lines): scans production sources; allocation-policy writer = finance/recurringWorkService only; tools write nothing financial; market/delivery zero writers; transfers confined to settings + composition root.
Affected boundaries: application-internal ownership.
Why it matters: change isolation — the tested implementation of "ownership before movement"; template for Wave F.
Root cause or uncertainty: none — positive.
Minimum safe remediation: none; Wave F generalizes this pattern (registry file + architectural test), does not invent a parallel mechanism.
Dependencies and ordering: input to Wave F.
Acceptance criteria: registry enforcement reuses this pattern.
Rollback boundary: n/a.
Explicit non-goals: rewriting the test; moving pinned services.
```

```
ID: STR-516
Title: No future-platform triggers are met — verified absence of Dart/Flutter/Python-product/backend/sync/auth code
Evidence class: VERIFIED
Owner classification: OUT_OF_SCOPE
Severity: Low
Current evidence: no .dart/pubspec; Python only as repo tooling (operations-control, design guards); no supabase/firebase/websocket/axios/express in product code; runtime deps UI-only; pre-pilot gate BLOCKED; E-00 docs-only.
Affected boundaries: none (verification).
Why it matters: confirms "Future by Trigger" is respected; baseline for detecting when a trigger fires.
Root cause or uncertainty: none.
Minimum safe remediation: none; trigger table (§12) is the reference.
Dependencies and ordering: Waves U/V/W/X stay closed.
Acceptance criteria: met.
Rollback boundary: n/a.
Explicit non-goals: must not be read as recommending any platform wave.
```

### 13.B Defer — structural findings, sequenced by the approved waves

```
ID: STR-102
Title: God-port + god-adapters: PrototypeLocalStore (131 methods, ~30 concepts, 37 stores) implemented twice (4,139 + 2,099 lines), owned by the adapter directory
Evidence class: VERIFIED
Owner classification: DEFER (Waves N → O only, owner-gated; AGENTS §11.1 freeze)
Severity: High
Current evidence: types.ts:429-885 (131 methods — 3 independent counts); IndexedDbLocalStore.ts 4,139 / MemoryLocalStore.ts 2,099 (identical 131/131 name sets); 62 application production edges + 19 UI type sites into types.ts; 9 commit guards; AGENTS.md §11.1 explicitly freezes splitting these files outside an approved wave. Linked: S1:STR-112, S2:STR-202, S2:STR-212, S3:STR-301, S3:STR-308, S5:STR-506, S5:STR-508.
Affected boundaries: every business area ↔ storage; future module boundaries; future platforms.
Why it matters: change isolation / extensibility — every new family extends one interface and both adapters; conformance burden grows; review load concentrates in the two largest files.
Root cause or uncertainty: port grew store-by-store (schema 12→38) as one database-wide surface; ownership sits with the implementer, not the consumer.
Minimum safe remediation: none in this program. Wave N (Port Inventory): classify all 131 methods + 9 guards by owner/consumer/behavior. Wave O only on real trigger (second implementation need) with compatibility facade; both adapters pass the same contract tests.
Dependencies and ordering: after Waves E/F (acceptance, registry); Wave D parity baseline precedes any split.
Acceptance criteria (future waves): inventory complete with no unclassified method; capability ports each pass Local+Memory contract tests; no schema/export change.
Rollback boundary: facade-based extraction revertible per capability; data-rollback plan required for write-path changes (plan principle 18).
Explicit non-goals: splitting now; interface changes; schema/version changes.
```

```
ID: STR-103
Title: application/finance/ is a mega-module mixing ≥6 business responsibilities (9,174 production lines, 19+ services)
Evidence class: VERIFIED (sizes/contents) + INFERRED (responsibility split)
Owner classification: DEFER (after Wave F registry; owner decision on clusters)
Severity: High
Current evidence: finance/ contains projectFinancialService 1,518 (event recording + readings), integrityCheckService 1,460 (diagnostics), ownerEntitlementService 1,109 (owner money), recurringExpenseService 818, statementService 692, recurringWorkService 564 (allocation policies), correctionHistoryService 481, periodComparisonService 436, profitToCashBridgeService 407, expenseBudgetService 370, + dueDates/upcoming/retainedDeposit/statementMarkdown/withdrawalWalletGuard/shortCashHorizon/periodPresets/expenseRecordIntent/expenseCategorySuggestions/dueDateAging. Linked: S5:STR-510.
Affected boundaries: owner-money vs event-recording vs read-models vs diagnostics vs recurring-planning clusters.
Why it matters: change isolation / ownership — "finance" became a catch-all; ownership of records vs computations blurred.
Root cause or uncertainty: layer-named directory accretion; no rule governs application-internal structure.
Minimum safe remediation: none now; direct input to Wave F (registry: who owns the record, who computes the number, who consumes) then owner-accepted per-cluster homes.
Dependencies and ordering: after Wave E; before any Wave L/M moves.
Acceptance criteria: registry rows for every finance/ service; owner accepts/amends each proposed home.
Rollback boundary: N/A (registry/documentation only in this phase).
Explicit non-goals: moving/renaming services now; features/ or common/ folders.
```

```
ID: STR-104
Title: Transfer subsystem hand-duplicates domain shapes as runtime validators — second description of entity semantics; highest data-compatibility trap; zero direct tests
Evidence class: VERIFIED
Owner classification: DEFER + candidate FIX_NOW guard test (pending owner approval recorded in worklog — the 2026-10-03 program instruction covers it as Wave 3B)
Severity: High
Current evidence: transferFamilyValidators.ts 1,715 (83 `value === "…"` literal comparisons re-listing domain status unions), transferSnapshotValidation.ts 1,185, migrations 347, envelope 75, counters 64; prepareImport rejects files whose enum fields fail these predicates BEFORE replaceSnapshot; pair gate over 21 released legacy pairs; 0 test files reference these modules directly (all coverage via localTransferService.* facade tests); no golden files on disk. Partial mitigation exists: some families DO import domain guards/lists (isValidWasteContext, DEPOSIT_SETTLEMENT_DECISIONS…) — the pattern exists, not retrofitted to statuses. Linked: S1:STR-104 root, S3:STR-311, S4:STR-405, S5:STR-509.
Affected boundaries: export/import gate ↔ domain record shapes ↔ every export file ever produced.
Why it matters: data / financial — a future domain change that misses the validators makes the app WRITE values its own prepareImport REJECTS → verified backup unimportable on a new device.
Root cause or uncertainty: backward-import compatibility requires accepting historical shapes current factories no longer produce; validators extracted verbatim (Group 10 Phase 10-D) before the domain-literal-import pattern existed.
Minimum safe remediation: (a) FIX_NOW candidate (test-only; approved for execution by the owner on 2026-10-03 as the program's Wave 3B — approval recorded in AGENT-SEQUENTIAL-WORKLOG.md): a characterization test deriving accepted status sets FROM domain unions and asserting the transfer predicates accept exactly those — no production change; (b) Wave D: materialize export goldens; (c) full fix (domain-exported runtime lists) no earlier than Wave Q/R as its own slice.
Dependencies and ordering: (a) alongside Wave D; never inside a structural wave.
Acceptance criteria (a): test fails if either side drifts; pnpm check green; no production file touched.
Rollback boundary: additive test only.
Explicit non-goals: changing acceptance decisions, error messages, rejection order; version changes; pair-gate relaxation.
```

```
ID: STR-105
Title: Oversized pages own form-state orchestration machines (7 pages > 900 lines; up to 62 useState) — UI-track territory
Evidence class: VERIFIED
Owner classification: DEFER (Wave T) / OUT_OF_SCOPE (visual redesign)
Severity: Medium
Current evidence: OrderDetail 1,888 (51 useState/8 useEffect), Finance 1,639 (13/4 — sections already extracted), FinancialEventEditor 1,285 (31/9), SupplierPurchaseEditor 1,184 (27/8), OwnerEntitlement 1,157 (52/6), Schedule 1,035, DirectSaleEditor 1,022 (31/6), InventoryMovementEditor 973 (26/3), InventoryMaterials 880; 21 pages ≥ 500 lines; ARCHITECTURE.md documents the "pages as orchestrators, sections behind them" pattern — applied inconsistently; AGENTS §11.1 freezes splitting OrderDetail/Finance/Catalog/OwnerEntitlement without an approved wave. Linked: S5:STR-511.
Affected boundaries: presentation vs application (state machines in pages).
Why it matters: development / change isolation / debugging.
Root cause or uncertainty: incremental growth; extraction only when a hardening group funded it.
Minimum safe remediation: none now; route to Wave T if/when the owner opens it.
Dependencies and ordering: Wave T (owner decision 7); page tests exist (Orders.ui, DirectSaleEditor.ui…).
Acceptance criteria (Wave T): UI tests green; no route/copy/navigation change.
Rollback boundary: wave base SHA; no data impact.
Explicit non-goals: visual/UX critique; TSX/CSS/copy changes; splitting in this program.
```

```
ID: STR-113
Title: Four boundary rules exist only as convention + guard blind spots (specifier-based bans, type-cycle invisibility, warning reshuffles, no deep-import guard)
Evidence class: VERIFIED
Owner classification: DEFER (Waves G→H→I)
Severity: Medium
Current evidence: not enforced: deep domain imports (0 today — convention), components→pages (1 exists), application-internal direction (finance↔g5 edges unregulated), domain-area edges; bans match only @/ specifiers (0 relative escapes today, verified resolution-based); check-runtime-cycles ignores type-only edges; --max-warnings 37 is numeric; complexity/max-lines budgets don't apply to client/src. Baselines recorded in this report = the ratchet's starting counts. Linked: S2:STR-208, S5:STR-514.
Affected boundaries: all module boundaries.
Why it matters: change isolation — unenforced conventions erode; a refactor converting an alias to a relative path silently exits ban scope.
Root cause or uncertainty: guards built per-incident, not from a complete boundary matrix.
Minimum safe remediation: adopt this report's counts as Wave H baselines; add resolution-based observer + alias/relative fixtures; ratchet in Wave I after Wave G rules accepted.
Dependencies and ordering: G → H → I.
Acceptance criteria: deterministic observe-mode report with explicit exceptions; CI rejects NEW violations; fixtures prove relative-form bypass detection.
Rollback boundary: each guard independently revertible.
Explicit non-goals: writing lint rules now; weakening existing rules.
```

```
ID: STR-213
Title: Application layer has no public doors — 65/78 production files imported directly by UI (196 edges); only barrel in client app is primitives
Evidence class: VERIFIED
Owner classification: DEFER (Waves J/K)
Severity: Medium
Current evidence: 35 application folders, flat service files; pages 87 edges/42 files, components 51/34, app shell 53/1; 13 files internal-only helpers; imports path-coupled to exact filenames.
Affected boundaries: plan principle 7 for the application layer.
Why it matters: extensibility — renaming any service breaks many UI imports; no curation point for future ownership enforcement.
Root cause or uncertainty: flat-folder convention — consistent and greppable but uncurated.
Minimum safe remediation: Wave J: per-area barrels ONLY for areas with real external consumers; Wave K: mechanical import redirection (no function-body changes); re-budget bundles after redirection (D-034).
Dependencies and ordering: after Waves F + D.
Acceptance criteria: piloted areas' external imports via barrel; deep-import count measurably below the 196-edge baseline; typecheck/tests/bundle green.
Rollback boundary: barrel + redirection separately revertible.
Explicit non-goals: mass barrel creation; service logic changes.
```

```
ID: STR-204
Title: Two undocumented type-level cycles + stale cycle-guard header comment (claims 1 cycle; measured 3 type SCCs)
Evidence class: VERIFIED
Owner classification: DEFER (Wave H) + FIX_NOW-eligible comment correction
Severity: Medium
Current evidence: SCC (b) application/g5/g5Service.ts ↔ application/finance/projectFinancialService.ts (type vs value edges); SCC (c) components/finance/FinancePeriodResultSection.tsx ↔ pages/Finance.tsx (FinanceState type owned by the page); guard header documents only (a) types.ts↔supplierScheduleCommitGuard. Linked: S1:STR-107 (SCC (c) root cause: view-model type owned by page).
Affected boundaries: application-internal coupling; UI component↔page layering; guard truthfulness.
Why it matters: debugging / change isolation — type cycles entangle IDE refactors and future code-splitting; the stale comment misleads agents.
Root cause or uncertainty: guard deliberately erases type edges (sound for runtime); cycles grew after the comment was written.
Minimum safe remediation: (1) docs-only comment fix listing all three; (2) Wave H observe-mode type-cycle report; (3) candidates: move expenseInputs/orderInputs or the type (b); move FinanceState out of pages/Finance (c) — via Wave K/L mechanics after gates.
Dependencies and ordering: comment fix rides any docs wave; code moves wait for K/L (and T for (c)).
Acceptance criteria: comment matches measured reality; no new type SCCs beyond the registered three.
Rollback boundary: comment fix trivially revertible; each move single-file revert.
Explicit non-goals: changing guard pass/fail semantics now; mass import rewrites.
```

```
ID: STR-205
Title: Six barrel-bypassing deep imports (3 dynamic app→domain, 3 intra-domain) — settlementInvariant is public API without being in the public surface
Evidence class: VERIFIED
Owner classification: DEFER (Waves J/K)
Severity: Low
Current evidence: list in §7.3 with file:line; integrityCheckService.ts:1437 dynamically imports craft-order/settlementInvariant.js whose symbol is NOT exported by the barrel; the two operatingBreakEven dynamic imports duplicate barrel-exported symbols (D-034 budget rationale in-code); recurring-expense→financial-event/types.js type-only; STR-030 recurring-margin alias pair (documented, twinning tests). Linked: S1:STR-108, S3:STR-313.
Affected boundaries: plan principle 7 (public doors only); domain encapsulation.
Why it matters: extensibility — deep imports bypass the only curation point; bundle-budget dynamic imports create an invisible public path.
Root cause or uncertainty: bundle-budget pressure + one missing barrel export; documented compatibility alias (intentional).
Minimum safe remediation: Wave J: export settlementInvariantResult from the craft-order barrel (keeping the dynamic import pointed per budget constraints); register the g5 dynamic imports + STR-030 alias in the exception log.
Dependencies and ordering: after Wave D (bundle budget guarded at 650,000/155,000 — re-measure after re-pointing).
Acceptance criteria: deep-import count ≤ 6 with every remaining one a registered waiver; typecheck + bundle budget green.
Rollback boundary: each re-point a single reversible commit.
Explicit non-goals: domain file moves; barrel redesign beyond the missing export.
```

```
ID: STR-209
Title: Application has four direct dependencies on concrete storage modules beyond the port interface
Evidence class: VERIFIED
Owner classification: DEFER (Wave N)
Severity: Medium
Current evidence: preferenceService → persistentStorage (value; browser channel outside the port); guidedOpeningImportService → influentialSnapshotFamilies (value); formDraftTestHarness → MemoryLocalStore (value; test harness colocated in application, consumed by 3 page test files); supplierPurchaseService → supplierScheduleCommitGuard (type; participates in STR-307 cycle).
Affected boundaries: Application → Storage (plan principle 5).
Why it matters: extensibility — a second adapter/sync driver would have to reproduce these side channels.
Root cause or uncertainty: conveniences that grew storage-local; the harness is deliberate.
Minimum safe remediation: Wave N classifies each: persistence port candidate / shared contract / moves with port extraction / registered test-only exception (relocate harness to a *.test helper location so production counts stay honest).
Dependencies and ordering: with STR-102 (same wave).
Acceptance criteria: each of the four routed via port/facade or registered as documented test-only exception.
Rollback boundary: per-module single commits.
Explicit non-goals: storage implementation changes.
```

```
ID: STR-305
Title: Storage persistence records are the de-facto UI view models (16 non-test page/component files type-import @/storage/local/types)
Evidence class: VERIFIED
Owner classification: DEFER
Severity: Medium
Current evidence: e.g. OrderDetail.tsx:23 imports StoredCraftOrder, CostEstimate; 16 files total (list in §7.4); allowTypeImports:true is documented policy.
Affected boundaries: Presentation ↔ storage contract; application view-model ownership.
Why it matters: change isolation — the 885-line types file is simultaneously port, records, and view-model source; any storage-type restructuring touches ~16 UI files + ~50 services.
Root cause or uncertainty: type-only reuse chosen to avoid duplication; no view-model layer for record-shaped reads.
Minimum safe remediation: none now; registry records the 16 consumers; any storage-types work carries a consumer inventory covering them.
Dependencies and ordering: Wave F; before any Wave O/P.
Acceptance criteria: registry records consumers; no type moved without inventory.
Rollback boundary: N/A.
Explicit non-goals: type redefinition; creating a re-export layer now.
```

```
ID: STR-214
Title: app/ shell mixes the composition root with widely-consumed navigation/feedback utilities (bidirectional app↔pages entanglement)
Evidence class: VERIFIED
Owner classification: DEFER (Waves F/G)
Severity: Low
Current evidence: 11 non-test files: composition (MicroRouter, PrototypeServicesContext, StartupGate, CapabilityRouteGate, quickRecording) + shared utilities (navigation, navigationContract, routeClassifier, useReturnNavigation, useDisabledCapabilities, resultFeedback); pages→app 167 edges (59 files), components→app 28, app→pages 60 (router only).
Affected boundaries: presentation-internal modularity; composition-root isolation.
Why it matters: change isolation — navigation contract changes ripple into 59 pages from the same layer that owns routing/composition.
Root cause or uncertainty: navigation hooks grew next to the router.
Minimum safe remediation: Wave F records app/ as two concepts; Wave G decides surfaces; a later mechanical move (Wave L) splits them with consumer inventory.
Dependencies and ordering: F/G before any move.
Acceptance criteria: registry separates the concepts; any move keeps route behavior identical.
Rollback boundary: single-folder move revert.
Explicit non-goals: routing behavior changes; new navigation abstraction.
```

```
ID: STR-109
Title: Domain dependency graph (shared kernel, financial-event hub, g5 edge) exists but is undocumented in any registry
Evidence class: VERIFIED (edges) + INFERRED (gap)
Owner classification: DEFER (Wave F seed)
Severity: Medium
Current evidence: edges in §5.2; no file records domain-area dependencies (contract 40 covers application ownership only).
Affected boundaries: domain-area boundaries; future split/merge decisions.
Why it matters: extensibility — hidden hubs constrain future splits (splitting financial-event ripples into 4 areas); agents must re-derive the graph each time.
Root cause or uncertainty: Wave F registry not yet built.
Minimum safe remediation: adopt §5.2's edge list as the Wave F registry seed.
Dependencies and ordering: Wave F; before L/M.
Acceptance criteria: registry covers 18 areas + edges; owner accepts.
Rollback boundary: documentation-only.
Explicit non-goals: changing imports; merging/splitting areas.
```

```
ID: STR-115
Title: Business invariants are split between domain policies and the 9 storage commit guards
Evidence class: VERIFIED (existence) + INFERRED (responsibility split)
Owner classification: DEFER (Wave N classification)
Severity: Medium
Current evidence: guards encode concurrency/staleness/idempotency preconditions at the write boundary; domain areas hold pure policies; debugging a write rejection requires reading two layers.
Affected boundaries: domain ↔ storage; "where the rule lives."
Why it matters: financial / data — a future second adapter or sync driver must reimplement these invariants or lose them.
Root cause or uncertainty: atomic multi-store transactions needed precondition checks at the write boundary.
Minimum safe remediation: none now; Wave N classifies each guard (owner/consumer/behavior) and decides whether invariants migrate to domain use-cases or become port-level contracts.
Dependencies and ordering: Wave N.
Acceptance criteria: every guard has a registry row; concurrency/staleness tests stay green under any future relocation.
Rollback boundary: wave base SHA; data-rollback plan for write-path changes.
Explicit non-goals: moving guards; changing rejection semantics.
```

```
ID: STR-116
Title: contexts/ layer is vestigial (1 file) and lib/ is an unregulated de-facto shared kernel
Evidence class: VERIFIED
Owner classification: DEFER (REFRAME at Wave G)
Severity: Low
Current evidence: contexts/ = ThemeContext.tsx (76 lines) only; real DI context lives in app/; lib/ (3 files: syncSha256, textDelivery, utils) has no import restrictions and no direct tests.
Affected boundaries: layer taxonomy.
Why it matters: development / discoverability — a named one-member layer misleads; lib/ lacks ownership rules.
Root cause or uncertainty: historical scaffold; utilities accreted.
Minimum safe remediation: none now; Wave G decides alias/absorption; before any move of lib/, add small direct suites (syncSha256 vectors, textDelivery edges).
Dependencies and ordering: Wave G; STR-407 pairs.
Acceptance criteria: taxonomy in accepted target rules matches the live tree or names an alias.
Rollback boundary: documentation-only.
Explicit non-goals: moving ThemeContext; deleting directories.
```

```
ID: STR-309
Title: No Clock port — 42 injected now-lambdas; plan names Clock among adapters but no seam exists
Evidence class: VERIFIED
Owner classification: DEFER (Wave N inventory)
Severity: Low
Current evidence: grep `now: () => string` = 42 non-test application hits; domain canonical business date in shared/businessTime.ts; display timezone moved out of presentation (Wave 4.4).
Affected boundaries: time-source ownership.
Why it matters: testing / future platforms — a future Clock adapter would touch 42 constructors (no second implementation exists today — plan principle 8 says no port without real need).
Root cause or uncertainty: per-service injection was the minimal deterministic-test pattern.
Minimum safe remediation: none; Wave N inventories the 42 injection points as a port candidate.
Dependencies and ordering: Wave N.
Acceptance criteria: inventory exists; no behavior change.
Rollback boundary: N/A.
Explicit non-goals: timezone semantics changes (Amman business day is frozen).
```

```
ID: STR-211
Title: KnowledgeState 6-literal union restated ×3 (domain type, storage private type, application validator)
Evidence class: VERIFIED
Owner classification: DEFER (semantic track R candidate; guard beside domain type at Wave J)
Severity: Low
Current evidence: craft-order/types.ts:3; storage/local/types.ts:321 (CostEstimateKnowledge); transferFamilyValidators.ts:30-38 (isKnownState); domain exports no runtime guard.
Affected boundaries: Domain ↔ Storage ↔ Application type ownership.
Why it matters: data — adding/renaming a knowledge state must be done in three places; a missed copy silently accepts/rejects imported data.
Root cause or uncertainty: import validation needs a runtime predicate; domain never exported one.
Minimum safe remediation: at Wave J: add isKnowledgeState beside the domain type, consume in validators, twin the storage type (existing STR-030 twinning pattern) — tiny, isolated, owner-gated (Wave J is outside the approved 3A-4E batch; approval must be recorded in worklog first).
Dependencies and ordering: Wave J (domain-surface addition); semantic aspects to Wave R if owner opens it.
Acceptance criteria: one literal definition + one guard; twinning test; grep finds exactly one authoritative listing.
Rollback boundary: single small commit revert.
Explicit non-goals: knowledge-semantics changes; stored-value changes.
```

```
ID: STR-111
Title: Test placement is split three ways; 97 journey tests flat at client/src root; no authoritative convention documented
Evidence class: VERIFIED
Owner classification: DEFER (Wave Q) + owner convention decision
Severity: Low
Current evidence: tests/domain/ (33 files, 17 areas); tests/owner-entitlement.test.ts at tests/ root; src/domain/direct-sale/policies.test.ts colocated; 97 root-level app tests under program-code names; vitest includes allow all; no doc states the rule. Linked: S4:STR-409.
Affected boundaries: test ↔ module mapping (Wave Q).
Why it matters: development — finding "the test for rule X" requires knowing three conventions.
Root cause or uncertainty: organic growth; conventions never written.
Minimum safe remediation: none now (moves are structural); Wave Q maps every test to a unit; owner records the convention (recommend: tests/domain/ canonical for domain tests); align new tests to it.
Dependencies and ordering: Wave Q.
Acceptance criteria: written rule; map marks the two exceptions.
Rollback boundary: docs-only.
Explicit non-goals: mass-moving tests; vitest config changes.
```

```
ID: STR-402
Title: Contract-to-test enforcement is asymmetric — only contracts 02/05/08/26/39/40 have test oracles; 43 bind via comments and narrative
Evidence class: VERIFIED
Owner classification: DEFER (Wave Q)
Severity: Medium
Current evidence: doc-paths appear in exactly 7 code/test files; production cites contracts as Arabic-Indic numerals in comments (عقد ٢٨ ×32, عقد ٤١ ×11…); 42/49 referenced by control items.
Affected boundaries: docs/contracts ↔ code/tests.
Why it matters: extensibility / debugging — a contract edit can silently diverge from code for 43 of 49 contracts.
Root cause or uncertainty: contracts written ahead of enforcement; oracles funded only by remediation programs.
Minimum safe remediation: Wave Q: test↔contract↔unit map; prioritize oracle tests for financially-binding comment-only contracts (esp. 27, 28, 29, 41, 42, 43) using the Wave4ContractOracles pattern (hand-computed fixtures, never copied from production equations).
Dependencies and ordering: after D/E; per-contract owner approval; no renumbering (D3).
Acceptance criteria: each financially-binding contract has an oracle test or a documented reason.
Rollback boundary: additive tests/docs.
Explicit non-goals: renumbering; rewriting contracts; enforcing E-00 series (no code).
```

```
ID: STR-406
Title: expenseBudgetService has no direct unit test (covered only via storage conformance, transfer round-trips, one UI journey)
Evidence class: INFERRED
Owner classification: DEFER
Severity: Medium
Current evidence: 0 test references; indirect coverage: IndexedDbLocalStore/adapterConformance.expenseBudget, localTransferService.expenseBudget, FinanceBudgets.w174.dom; contract 42 (D-038) governs.
Affected boundaries: application/finance; contract 42.
Why it matters: financial — budget derived states (within/over/under_review) are decision surfaces.
Root cause or uncertainty: storage-first build under FIN-002.
Minimum safe remediation: add expenseBudgetService.test.ts (sibling style) before any Wave M consolidation in application/finance.
Dependencies and ordering: before application/finance file moves.
Acceptance criteria: direct test exists and passes; indirect tests untouched.
Rollback boundary: delete the new test file.
Explicit non-goals: behavior or contract-42 semantics changes.
```

```
ID: STR-407
Title: contexts/ and lib/ have zero direct tests (ThemeContext, syncSha256, textDelivery, utils)
Evidence class: VERIFIED
Owner classification: DEFER
Severity: Low
Current evidence: 0 test files in both dirs; syncSha256 exercised only via releasedPairs; theme pinned only by R3.themeBehavior App smoke.
Affected boundaries: client/src/{contexts,lib}.
Why it matters: change isolation — moves would rely on App-level smoke only.
Root cause or uncertainty: small modules covered by integration.
Minimum safe remediation: before any move of these dirs: small direct suites (esp. syncSha256 known vectors).
Dependencies and ordering: only if/when a wave touches these dirs.
Acceptance criteria: direct tests exist for moved modules.
Rollback boundary: delete added tests.
Explicit non-goals: restructuring now.
```

```
ID: STR-408
Title: 46/59 page components lack colocated tests; UI coverage keyed to program-code journey tests; no page→test registry
Evidence class: VERIFIED
Owner classification: DEFER (Wave Q deliverable)
Severity: Medium
Current evidence: pages/ 72 files − 13 tests = 59 components, 46 without colocated tests; coverage via src-root journeys (FinanceJourneys, DeepScreens.w43, group2InventorySurfaces…) named by program codes; no registry.
Affected boundaries: client/src/pages; Waves Q/T.
Why it matters: change isolation — before moving any page there is no way to prove coverage didn't drop except reading 97 root test files.
Root cause or uncertainty: journey-test style chosen during quality waves.
Minimum safe remediation: Wave Q: scripted, derived page/component→test map (generated view, like Operations Control views — not hand-maintained).
Dependencies and ordering: after D/E; feeds Wave T gate.
Acceptance criteria: map exists, regenerable by a read-only script; page-move PRs cite their tests from it.
Rollback boundary: delete the generated map.
Explicit non-goals: rewriting tests; mandating colocated page tests.
```

```
ID: STR-411
Title: 19/49 contracts have no Operations Control linkage; implementation truth spread across three historical stores
Evidence class: VERIFIED
Owner classification: DEFER
Severity: Low
Current evidence: unreferenced: E-00 series (intentional) + local 07/19/20/21/22/26/30/33/36/37/38; their truth lives in implementation-traceability (stopped at Group 4), current-state-log §9-§101, reports/.
Affected boundaries: docs/contracts ↔ control; Waves Q/Y.
Why it matters: discoverability — no machine-readable status for these contracts.
Root cause or uncertainty: Operations Control born mid-history (2026-09-19).
Minimum safe remediation: Wave Q: "status source" column naming the authoritative store per contract; no retrospective control items with invented dates.
Dependencies and ordering: after D/E; before Wave Y audit.
Acceptance criteria: every contract has exactly one named status source.
Rollback boundary: docs-only map.
Explicit non-goals: renumbering; retrospective items.
```

```
ID: STR-412
Title: Two tested application services are undocumented (financialPulseService, capacityDecisionService)
Evidence class: VERIFIED
Owner classification: DEFER
Severity: Low
Current evidence: 0 doc references outside archives; both tested; view-model roles per headers.
Affected boundaries: application/{financial-pulse,scheduling}; Wave F/Q.
Why it matters: development — public surfaces of the app layer locked only by tests.
Root cause or uncertainty: built during quality waves below contract threshold.
Minimum safe remediation: registry rows (owner = read-model; doc anchor = test file); one-paragraph scope note.
Dependencies and ordering: with Wave F.
Acceptance criteria: both appear in the registry with owner and evidence.
Rollback boundary: registry row removal.
Explicit non-goals: writing full contracts for view-model services now.
```

```
ID: STR-416
Title: Doc-index guard covers only 4 directories fully; quality/product/operations/implementation/expansion guarded via a 48-file canonical list only
Evidence class: VERIFIED
Owner classification: DEFER (guard-only slice)
Severity: Low
Current evidence: FULL_COVERAGE_DIRS = contracts/architecture/decisions/research; e.g. security-boundaries.md and implementation-traceability.md indexed but their un-indexing would not fail any check.
Affected boundaries: check-doc-index-coverage; WS-204 anti-invisible-authority goal.
Why it matters: development — the RC-4 failure mode (authoritative file unindexed) can recur in 5 dirs.
Root cause or uncertainty: WS-204 scope choice.
Minimum safe remediation: extend FULL_COVERAGE_DIRS progressively (start with quality/ + implementation/) in a guard-only slice after owner approval; index rows already exist.
Dependencies and ordering: after Wave Q map; before Wave Z.
Acceptance criteria: guard exits 0 with extended dirs.
Rollback boundary: revert guard array.
Explicit non-goals: indexing non-authoritative stores.
```

```
ID: STR-502
Title: Contract-neutrality caveats for future vectors (tri-state undefined update inputs; Date|string at businessTime; Date.parse reliance)
Evidence class: VERIFIED
Owner classification: DEFER (Wave U)
Severity: Medium
Current evidence: asset/types.ts:96 and direct-sale/types.ts:76-77 document undefined=no-change vs null=reset (update INPUTS, not persisted); businessTime.ts:38/47 accept Date|string; Date.parse used in 9 domain files (ISO-only data in practice; ECMA mandates ISO only).
Affected boundaries: domain update-input surfaces; future Wave U artifacts.
Why it matters: extensibility / data — a second-platform reimplementation must honor tri-state and the accepted date grammar or silently diverge.
Root cause or uncertainty: deliberate ergonomics (D-001); no second consumer existed (correct per plan).
Minimum safe remediation: documentation at Wave U: vectors covering undefined/null/absent cases (asset, direct-sale) + ISO acceptance/rejection cases; live beside existing characterization seeds.
Dependencies and ordering: Wave U only (trigger: non-TS consumer).
Acceptance criteria: vectors cover tri-state + ISO grammar; green in TS runner.
Rollback boundary: additive artifacts.
Explicit non-goals: Result<T,E> conversion; removing undefined semantics; signature changes.
```

```
ID: STR-503
Title: Error identity = exact Arabic message strings (no codes); golden-tested in 21 files; storage/transfer failures DO have codes
Evidence class: VERIFIED
Owner classification: DEFER (Wave U documentation; Wave R for any code-level change)
Severity: Medium
Current evidence: shared/numeric.ts:67-80 + fieldLabelAr (58 labels) throw Arabic strings; 21 test files assert exact messages; SETTLEMENT_CONFLICT_MESSAGE branching (craft-order/policies.ts:369); StorageFailureCode + transfer codes exist.
Affected boundaries: domain ↔ consumers; future platforms.
Why it matters: extensibility — a Dart/Python port cannot "throw the same string"; branching on message text is fragile across platforms.
Root cause or uncertainty: deliberate Phase-2 choice (single Arabic-RTL user; no second consumer).
Minimum safe remediation: at Wave U: error-vector family mapping branch-worthy failures to stable IDs (docs first); code-level error codes only via Wave R (owner decision 5).
Dependencies and ordering: Wave U vectors; Wave R for changes.
Acceptance criteria: vector file enumerates failures with stable IDs + current strings as annotations.
Rollback boundary: additive docs/vectors.
Explicit non-goals: Result<T,E>; message rewriting; i18n.
```

```
ID: STR-505
Title: Business-time algorithm depends on platform ICU/tzdata (Asia/Amman; day boundary 21:00Z) — cross-platform determinism needs pinned vectors
Evidence class: VERIFIED
Owner classification: DEFER (Wave U)
Severity: Medium
Current evidence: businessTime.ts:30-35 Intl.DateTimeFormat Asia/Amman; header documents frozen contract + platform-tzdata dependence; month keys = first 7 chars of business date; no independent month algorithm (by design).
Affected boundaries: shared/businessTime ↔ every period-key consumer ↔ future platforms.
Why it matters: data / financial — platform tzdata differences could shift period keys by a day.
Root cause or uncertainty: inherent to Intl; documented honestly.
Minimum safe remediation: at Wave U: boundary-instant vectors (20:59:59Z vs 21:00:00Z) + stated tzdata floor (≥2022 rules).
Dependencies and ordering: Wave U; prerequisite for Wave V parity.
Acceptance criteria: vectors cover boundary instants + month-key derivation.
Rollback boundary: additive vectors.
Explicit non-goals: algorithm rewrite; fixed-offset assumption; timezone storage changes.
```

### 13.C Owner decisions required

```
ID: STR-302
Title: Derived financial policy lives in the Application layer, not src/domain (period-result/COGS composition, wallet-coverage guard, owner-settlement arithmetic)
Evidence class: VERIFIED
Owner classification: OWNER_DECISION_REQUIRED
Severity: High
Current evidence: projectFinancialService.ts:377-436 derivePeriodCogs (implements purchase≠COGS / missing≠zero; cogsStatus); :349-370 expense classification; withdrawalWalletGuard.ts:37-60 evaluateWithdrawalWalletCoverage (G-006); ownerEntitlementService.ts:949-1006 settlement-remaining arithmetic. Counter-evidence: ARCHITECTURE.md designates ProjectFinancialService the single reading core; periodResultCanonical.test.ts locks it; g5/safe-withdrawal ARE domain; integrityCheckService.ts:7 "checks invent no rules."
Affected boundaries: Application ↔ Domain rule ownership; future module splits; test placement.
Why it matters: financial / change isolation — the equations defining period profit and withdrawal safety live outside the layer AGENTS §10.5 designates for money rules; whether each is "read-model composition" (allowed) or "domain rule" (misplaced) is a per-equation owner decision, not provable from code.
Root cause or uncertainty: read-model composition and write-path guards accreted in services during hardening (G-006, F-005/W2-D, MIC audits); the repo consciously treats ProjectFinancialService as canonical reader.
Minimum safe remediation: none in structural waves (plan §3 explicitly routes this to a separate semantic track). Register each equation in Wave F with its owner; open Wave R per equation family only with owner approval and characterization tests (periodResultCanonical.test.ts is the existing parity oracle).
Dependencies and ordering: Wave F registry first; Wave R strictly separate; Wave D green before any move.
Acceptance criteria: every equation in the registry with a decided owner; no equation moved without its own approved wave card.
Rollback boundary: N/A (no change proposed).
Explicit non-goals: relocation, re-derivation, rounding/order-of-operations changes, error-message changes in this program.
```

```
ID: STR-106
Title: Presentation imports the domain directly (67 non-test edges; 16 runtime-value, incl. a financial reading composed in Finance.tsx) — policy undecided
Evidence class: VERIFIED (counts) / INFERRED (conformance judgment)
Owner classification: OWNER_DECISION_REQUIRED
Severity: Medium
Current evidence: 6 pages import domain VALUE functions (CostEditor: knowledgeGapsOf; Catalog: perOutputUnitAmountMinor; AssetDetail: residualOf; DirectSaleEditor: directSaleOutstandingMinor; InventoryMaterials: quantityMilliExact; OrderDetail: localDateInAmman); Finance.tsx:48+1374 composes calculateSafeWithdrawal with g5 output + session reserve IN THE PAGE; components too (AllocationReviewCard → calculateSharedProjectShareMinor); 51 type-only edges; all via barrels; no ESLint rule either way. AGENTS §10.5 bans domain RULES implemented in UI — not domain imports. Linked: S2:STR-206, S3:STR-304.
Affected boundaries: Presentation ↔ Application ↔ Domain direction (plan principle 5).
Why it matters: change isolation / future platforms — if Application is intended as the only orchestrator, these are 16 unregistered shortcuts; if pure-function reads from UI are acceptable (common in hexagonal reads), only calculation-style imports deserve scrutiny. The ambiguity itself is the risk.
Root cause or uncertainty: no documented owner decision; barrels make it frictionless.
Minimum safe remediation: owner decision at Wave G: (a) ADR accepting presentation→domain for pure reads/labels (then guard-freezes the count), or (b) redirection through application read models in a later wave (safe-withdrawal wrapper is the only page composing money inputs).
Dependencies and ordering: Wave G decision → optional Wave K/T work.
Acceptance criteria: recorded decision; if (b): ratchet guard freezing the 16-value baseline; Finance.tsx no longer composes money readings inline (behavior byte-equal).
Rollback boundary: ADR is docs-only; wrappers are single-file reverts.
Explicit non-goals: changing domain function signatures; moving domain functions into UI.
```

```
ID: STR-203
Title: Application value-imports the presentation layer (14 edges, 12 files) — conflicts with plan wording; ESLint and guard tests treat it as legitimate
Evidence class: VERIFIED (edges) / INFERRED (judgment)
Owner classification: OWNER_DECISION_REQUIRED
Severity: Medium
Current evidence: formatters imported by agreements/followUpDate, collections, finance/{correctionHistory, integrityCheck, projectFinancial, statementMarkdown, statement, withdrawalWalletGuard}, follow-up, fulfillment/deliveryReview, home, share (+2 more modules); presentation/formatters.ts is pure TS (0 React) and itself imports domain — chain application→presentation→domain; eslint block 8 bans react + @/components + @/pages for application but NOT @/presentation; check-layer-boundaries.test.mjs describes presentation among "legitimate application imports". Linked: S3:STR-303.
Affected boundaries: Application ↔ Presentation; plan principle 5.
Why it matters: change isolation — money/date formatting used by financial services lives in a UI layer; UI copy/format policy changes ripple into services.
Root cause or uncertainty: formatters.ts is functionally a shared formatting kernel (Wave 4.4 centralized it there); placement predates the plan's direction chain; the repo's own guard test blesses it — a genuine live-practice vs plan-wording conflict only the owner can resolve.
Minimum safe remediation: owner decision: (a) accept as documented waiver + ADR + exception-list entry (zero code change), or (b) relocate the pure formatting kernel to a layer below application in a later mechanical wave (12-file consumer inventory, byte-identical formatters).
Dependencies and ordering: decision blocks any guard change; any move is Wave L-style after consumer inventory.
Acceptance criteria: either documented waiver with ADR, or zero application→presentation edges with an observe→ratchet guard.
Rollback boundary: single commit either way; no data impact.
Explicit non-goals: formatting behavior changes (dates/money strings are contract-pinned); UI redesign.
```

```
ID: STR-110
Title: "g5" (and G3/G4-B labels) encode wave numbering, not business concepts — discoverability debt in code, pages, and contracts
Evidence class: VERIFIED
Owner classification: OWNER_DECISION_REQUIRED
Severity: Medium
Current evidence: src/domain/g5/ owns break-even, short-cash declarations, direct margin, operating break-even; application/g5/g5Service.ts; pages/G5DeclarationEditor.tsx; presentation/g5Plurals.ts; contract "17-contribution-break-even-short-cash-g5-contract.md"; plan §6 freezes concept/ID renames.
Affected boundaries: naming/identity of the analysis cluster; onboarding.
Why it matters: development — label-based names do not reveal the owned concept, slowing every future task and inviting misplacement; also g5 is a HYBRID (read-models + the shortCashDeclarations stored record) — record vs read-model placement is an ownership question.
Root cause or uncertainty: delivery-wave labels assigned during growth.
Minimum safe remediation: none now (rename = identity change). At Wave G: owner decides a naming-alias table (label ↔ concept ↔ paths — explicitly a Wave G deliverable) and whether shortCashDeclarations belongs to the records cluster.
Dependencies and ordering: Wave G; any rename would be its own wave with full consumer inventory.
Acceptance criteria: alias table accepted and linked from the doc index.
Rollback boundary: documentation-only.
Explicit non-goals: renaming files/folders/exports/IDs now.
```

```
ID: STR-515
Title: Smallest-safe future-wave sequence (recommendation) — requires owner acceptance/amendment
Evidence class: VERIFIED (mapping onto approved waves)
Owner classification: OWNER_DECISION_REQUIRED
Severity: Medium
Current evidence: sequencing rules (plan §7 table + §7.1.2 D-before-first-write; CONTROL §7; AGENTS §11); pre-existing assets that shorten the path (public-surface lock, touchpoints registry, characterization/conformance/round-trip suites, Operations Control). The full sequence is §15 of this report.
Affected boundaries: entire program sequencing.
Why it matters: development / data safety — minimal path to permanent guards + future-platform readiness without premature platform work.
Root cause or uncertainty: synthesis finding; owner must accept or amend (CONTROL §7.5).
Minimum safe remediation: owner accepts/amends §15; no wave starts automatically.
Dependencies and ordering: per §15.
Acceptance criteria: each step uses the plan's own exit criteria verbatim.
Rollback boundary: steps are docs/tests/guards (code-only revert) except J-M code moves (revert to base SHA + re-run Wave D oracle; data untouched by construction).
Explicit non-goals: new wave names; platform builds; schema/export changes inside structural waves; mass moves.
```

### 13.D FIX_NOW candidates — approved for execution by the owner only if the worklog records the owner's approval; otherwise pending owner approval

> **تحديث مؤرخ 2026-10-03:** موافقة المالك البرنامجية مسجلة في `AGENT-SEQUENTIAL-WORKLOG.md` (Entry 1) وتغطي هذه الدفعة (docs/tests فقط) كموجات 3A–3C من البرنامج المعتمد؛ أي إصلاح فردي خارجها يبقى «pending owner approval».

```
ID: STR-401
Title: No materialized parity artifacts (goldens/vectors) exist on disk — Wave D's exit criterion cannot be met from current artifacts
Evidence class: VERIFIED
Owner classification: FIX_NOW (Wave D prerequisite)
Severity: High
Current evidence: exhaustive search: no __fixtures__ dirs, no *.golden/*vector files; only repo fixture consumed by a test is docs/fixtures/g82-guided-opening-import-fixtures.json; historical 8/17 pair fixture is inline in localTransferService.releasedPairs.test.ts (~line 727+, per D-030); round-trips/schema pairs are inline test code.
Affected boundaries: application/transfers, storage/local, contract 39, any Wave L/M move, Wave D exit.
Why it matters: data / financial — without checked-in goldens, a move that changes export bytes/ordering can only be caught by re-reading test code.
Root cause or uncertainty: parity was always executable tests; no structural move was allowed before this program, so nobody materialized artifacts.
Minimum safe remediation: in Wave D (before any Wave L/M): generate export goldens for the current pair (38/30) and accepted historical pairs from existing round-trip tests into a fixtures directory; record hashes; wire tests to compare; no production code changes.
Dependencies and ordering: after this report's acceptance; before any Wave L/M; coordinates with contract 39 + touchpoints manifest.
Acceptance criteria: goldens directory with per-pair envelope+counters+snapshot fixtures; tests fail on drift; Wave D exit demonstrably met.
Rollback boundary: additive only — delete fixtures + revert test wiring.
Explicit non-goals: changing export format/versions/pair lists; normalizing inline test data.
```

```
ID: STR-403
Title: Stale path references in authority docs (AGENTS.md qa/; contract 40 cost-estimates/recurring-work/CatalogPoliciesSection)
Evidence class: VERIFIED
Owner classification: FIX_NOW (docs-only)
Severity: Low
Current evidence: AGENTS.md:41 lists qa/ (renamed to docs/operations/archive/quality-history/ in 6fb8e0c, 2026-10-01; does not exist at HEAD); contract 40:22 application/cost-estimates/ (actual: application/estimates/), :43 components/catalog/CatalogPoliciesSection.tsx (deleted), :62 application/recurring-work/ (actual: application/finance/recurringWorkService.ts).
Affected boundaries: AGENTS.md (entry point); contract 40 (ownership authority enforced by exe017 test).
Why it matters: development — the entry-point doc sends agents to a nonexistent directory; contract 40 misnames the estimates module owner during the exact program that will use it.
Root cause or uncertainty: WS-204 cleanup moved qa/ but left the AGENTS.md mention; contract 40 predates later renames.
Minimum safe remediation: one docs-only PR: fix the three contract-40 paths (keep historical narrative, mark the deleted file explicitly); replace or drop the qa/ entry. Note: doc-index guard covers only 4 dirs, so these fixes are not machine-enforced.
Dependencies and ordering: none; independent; should precede Wave Q map generation.
Acceptance criteria: zero broken repo paths in AGENTS.md forbidden-read list and contract 40 tables.
Rollback boundary: pure docs revert.
Explicit non-goals: renumbering/restructuring contracts; touching code.
```

### 13.E Scan-environment limitation

```
ID: STR-118
Title: Full test/lint/guard suite not executable in the scan clone (node_modules absent) — all boundary statements are static-analysis based
Evidence class: NOT_EXECUTED
Owner classification: OUT_OF_SCOPE
Severity: Low
Current evidence: node_modules empty; installing would write into the read-only tree; cross-validation instead: repo's own check-runtime-cycles.mjs (copied outside repo, exit 0), check-doc-index-coverage.mjs (exit 0), operations-control validate.py (exit 0); CI remains the live oracle.
Affected boundaries: verification fidelity of this scan.
Why it matters: debugging — cycle counts, lint pass/fail, and test results are not runtime-verified at this SHA by this scan.
Root cause or uncertainty: scan clone intentionally dependency-free.
Minimum safe remediation: Wave D runs full pnpm check + pnpm test in an environment where installing is permitted, and records results at its base SHA.
Dependencies and ordering: before/at Wave D.
Acceptance criteria: full check output recorded at the Wave D base SHA.
Rollback boundary: N/A.
Explicit non-goals: running installs from the read-only phase.
```

### 13.F Duplicate links (aliases — not repeated findings)

| Specialist ID | Master finding | Note |
|---|---|---|
| S2:STR-201, S5:STR-501 | STR-101 | domain purity/skeleton (agreement) |
| S2:STR-202, S2:STR-212, S3:STR-301, S3:STR-308, S5:STR-506, S5:STR-508, S1:STR-112 | STR-102 | god-port/adapters/port-home (agreement) |
| S5:STR-510 | STR-103 | finance mega-module + oversized read core |
| S3:STR-311, S4:STR-405, S5:STR-509 | STR-104 | transfer validators duplication + drift trap + zero direct tests |
| S5:STR-511 | STR-105 | oversized pages = Wave T |
| S1:STR-106 ≈ S2:STR-206 ≈ S3:STR-304 | STR-106 | UI→domain imports (merged; counts differ by denominator — see §18) |
| S3:STR-303 | STR-203 | application→presentation |
| S1:STR-107 | STR-204(c) | component→page type cycle root cause |
| S1:STR-108, S3:STR-313 | STR-205 | deep imports |
| S2:STR-208, S5:STR-514 | STR-113 | guard blind spots/convention-only rules |
| S4:STR-409 | STR-111 | test placement convention |
| S1:STR-114 | **REFUTED** | "ARCHITECTURE.md 42 vs 43 drift" — synthesizer re-measured 42 instantiations (each unique) in the composition root; the doc is CORRECT; see §18 |

---

## 14. Target module map

Logical map only — final folder names are deferred to Wave G per plan §5 ("do not decide kernel/foundation/modules names before evidence and ownership"). No move is recommended without a named consumer inventory, tests, and rollback boundary.

| Current boundary | Responsibility | Candidate target boundary | Evidence | Consumers | Proposed action | Prerequisites | Risk |
|---|---|---|---|---|---|---|---|
| `src/domain/shared/` (197 lines) | money/time/ids/quantity primitives | Shared Kernel (de-facto; final name = owner) | 14/18 areas import it; ESLint-pure; Math exemption documented | all domain areas; presentation formatters | **PRESERVE** | none | Low |
| `financial-event/` + `asset/ loan/ received-loan/ recurring-expense/ cash-continuity/` | records-with-reversals semantics | Financial-records cluster (hub = financial-event) | verified edges §5.2; reversal semantics consumed by 4 areas | application finance/cash/loans/assets; transfers validators | **PRESERVE** + GUARD_ONLY (registry rows Wave F) | Wave F registry | Low |
| `craft-order/` + `application/{fulfillment,collections,agreements,scheduling,drafts}` | craft-order lifecycle | Craft-order lifecycle module | flow A chain; 2,123 domain lines + 4,214 application lines | orders/schedule/collect pages; integrity; transfers | **PRESERVE** (REFRAME only after registry) | Wave F | Medium |
| `inventory-material/` + `catalog/` + `application/{inventory,catalog}` | materials, movements, shortages, waste + reference catalog | Inventory & catalog module | flows C; both domains self-contained-ish; STR-030 alias | inventory/catalog pages; deliveryReview; integrity | **PRESERVE** | Wave F; STR-030 alias stays documented | Low |
| `owner-entitlement/` + `owner-safe-withdrawal/` + `finance/ownerEntitlementService.ts` | owner money | Owner-money module | flow D; domain 1,264 lines + service 1,109 | OwnerEntitlement page + sections; finance reads | **REFRAME** (MOVE_LATER after registry) | Wave F; STR-302 settlement-arithmetic decision | Medium |
| `g5/` + `application/g5/` + `finance/{statement,periodComparison,profitToCashBridge,shortCashHorizon}` + `financial-pulse/` + `home/` | analysis & read-models | Read-model cluster | §5.3; ARCHITECTURE "single reading core"; caveat: g5 also owns the `shortCashDeclarations` STORED record | Finance/Statement/Home pages; integrity | **OWNER_DECISION_REQUIRED** (g5 naming STR-110 + declarations placement) | Wave F/G | Medium |
| `recurring-expense/`, `recurring-margin/`, `budget/` | recurring planning siblings | 3 sibling modules (shared lifecycle pattern only) | contracts 41/42 keep concepts separate | finance recurring/budget surfaces | **PRESERVE** (no merge) | none | Low |
| `direct-sale/` + `application/direct-sales/` (+ sale side of collections) | direct sale | Direct-sale module | flow maps; 580 domain lines | DirectSale pages; collections | **PRESERVE** | none | Low |
| `supplier-purchase/` + `application/suppliers/` | supplier purchasing | Supplier-purchasing module | 406 domain lines; attribution atomicity guard | SupplierPurchase pages; integrity | **PRESERVE** | none | Low |
| `application/transfers/` (4,071) + `indexedDbSnapshot.ts` + envelope + guided opening | export/import/backup subsystem | Transfer/backup subsystem (infrastructure-flavored module) | flow E; consumers: Settings + composition root only | Settings pages; composition root | **PRESERVE** + characterization-first (STR-104/401/405) before ANY move | Wave D goldens + direct tests | High (data) |
| `storage/local/` port + 2 adapters + 9 guards + migrations | local persistence | Port + Adapters (capability split only via Waves N/O) | 131 methods ×2; conformance suites | ~50 services; composition root | **DEFER** (MOVE_LATER only on trigger; Wave N inventory first) | Waves E/F/D/N; owner gate per AGENTS §11.1 | High |
| `application/finance/` (9,174 lines) | ≥6 responsibilities | split into the clusters above after registry | STR-103 service inventory | 42-page consumers; integrity; g5 | **OWNER_DECISION_REQUIRED** → SPLIT (only after Wave F acceptance) | Wave F registry; Wave D baseline; STR-302 semantic decisions | High |
| `presentation/formatters` (+labels/plurals) | pure formatting kernel (no React) | shared formatting module below application (placement decision) | STR-203: 12 application files + all UI consume it | application + UI | **OWNER_DECISION_REQUIRED** (waiver vs move) | Wave G decision; Wave L mechanics if moved | Medium |
| `pages/` + `components/` + `presentation/` + `styles/` | presentation kit + orchestrator pages | UI layers (Wave T territory) | STR-105; AGENTS §11.1 freeze on named pages | router; app shell | **DEFER** (Wave T, owner-gated) | owner decision 7; Wave Q test map | Medium |
| `app/` | composition root + navigation utilities | two concepts: composition root vs navigation/feedback | STR-214: 167 page edges in, 60 routing edges out | all pages; components | **REFRAME** (MOVE_LATER via Wave L after F/G) | Wave F/G | Low |
| `contexts/` (1 file) + `lib/` (3 files) | vestigial context + small shared utils | absorb/alias (Wave G decision) | STR-116/407 | theme; sha256 (transfers); components | **REFRAME** | Wave G; direct tests before any lib/ move | Low |
| tests layout (`tests/domain`, `tests/` root outlier, colocated domain test, 97 root journey tests) | test organization | test map + written convention (Wave Q) | STR-111/408 | all agents | **DEFER** + GUARD_ONLY (generated map) | Wave Q | Low |
| `docs/contracts/` + Operations Control + doc-index | authority & coordination system | as-is | guards exit 0; single reading map | all agents | **PRESERVE** | none | Low |
| `IndexedDbLocalStore.ts` / `MemoryLocalStore.ts` (as files) | adapter implementations | per-capability adapter modules (only via approved Wave O/P) | AGENTS §11.1 names them frozen | port consumers via port only | **MOVE_LATER** (strictly gated) | Waves N→O; parity oracle; facade | High |

---

## 15. Minimum safe migration/refactoring waves

Mapped strictly onto the approved A–Z waves (no new wave names). Sequencing note: E/F (read-only acceptance + registry) may run before D; the plan's hard rule — D precedes the first WRITING wave (§7.1.2) — is satisfied at step 5. If the owner prefers strict letter order, D moves before E/F with no safety loss.

| Step | Wave | Objective | Owner approval | Tests/CI after |
|---|---|---|---|---|
| 0 | A — Freeze & Charter | confirm freeze, base SHA, structural-only scope, emergency exception | **YES** (charter acceptance) | n/a (docs) |
| 1 | B — Scan Reconciliation | reconcile prior Group-7 scan (9a8c949 / 17b264c, external docs repo — UNVERIFIED here) with this report; record STATE_DRIFT (9271a85→e7688efd, docs-only) | report acceptance | n/a |
| 2 | C — Read-only Structure Scan | **this report IS Wave C's execution** | **YES** (findings acceptance — the mandatory Micro gate) | n/a |
| 3 | E→F — Findings Acceptance + Ownership Registry | classify findings; concept→owner→computation site→consumers→storage/history (seeds: §5.2 edges, STR-117 exe017 pattern, touchpoints registry, STR-109/412) | **YES** (ownership map) | n/a |
| 4 | D — Parity Baseline | full `pnpm check`+`pnpm test` at base SHA; materialize export goldens (STR-401); direct characterization for the transfer cluster (STR-104/405); optional domain-derived drift-guard test (STR-104a); record counts | recorded pass/fail | **YES** (this wave IS tests) |
| 5 | G→H→I — Target Rules → Guard Observe → Guard Ratchet | decide direction policies (STR-106/203/110, port home, guards home, contexts/lib); baseline violations; CI then rejects NEW violations (STR-113); fix stale cycle-guard comment (STR-204) | **YES** (rules acceptance at G) | YES (guard self-tests in CI) |
| 6 | J→K — Public Surface Pilot → Import Consolidation | barrel for one unit with real consumers; export settlementInvariant via barrel (STR-205); re-point imports mechanically; register D-034 waivers | per-wave PR + checks | YES |
| 7 | L→M — File-Move Pilot → Measured Consolidation | ONE file move after consumer inventory + hash/rename identity (candidates: FinanceState type move STR-204c; recurring-expense barrel retarget STR-205); repeat only where registry shows benefit — no mass moves | **YES** per wave | YES |
| 8 | N — Port Inventory | classify all 131 methods + 9 guards + 4 side channels (STR-209) + 42 clock sites (STR-309) by owner/consumer/behavior — the future-platform readiness deliverable | inventory acceptance | n/a |
| 9 | Q — Test & Documentation Map | generated test↔contract↔unit map (STR-402/408/411/412); series-tag column (STR-413); page→test registry; convention decision (STR-111) | map acceptance | n/a |
| 10 | Y→Z — Completion Audit → Closure & Moratorium | re-scan; match registry/tree/docs/guards/tests/versions; owner signs; permanent guards + moratorium | **YES** (owner decisions 9) | YES |
| — | R / S / T — semantic / schema-export / UI tracks | ONLY by owner decisions 5/6/7; independent tracks, never inside structural waves | **YES** each | per-track cards |
| — | U / V / W / X — vectors / mobile / Python-API / extraction | trigger-based (§12: none met) | **YES** (owner decision 8) | per-track |

**Per-wave required fields (near-term waves):**

- **Wave D card.** Objective: prove behavior parity and materialize oracles. Scope: run full check+test at base SHA; write export goldens (current pair + accepted legacy pairs) into a fixtures directory; add direct characterization tests for `transferFamilyValidators/transferSnapshotValidation/transferSnapshotMigrations/transferEnvelope/transferCounters`; optionally the domain-derived drift-guard test. Allowed files: new test files + new fixtures + test wiring only. Forbidden: every production file; schema/export constants; pair lists. Risks: none to runtime (additive). Acceptance: goldens exist with hashes; new tests green; full suite green at base SHA; counts recorded. Rollback: delete additive artifacts. Owner approval: yes (it is the first wave after report acceptance). Tests/CI required: yes — this wave is entirely tests.
- **Wave G card.** Objective: decide target rules. Scope: documentation/ADR only — direction policies (STR-106, STR-203), g5 alias table + declarations placement (STR-110), port home + commit-guard home (STR-102/115), contexts/lib taxonomy (STR-116), application-barrel strategy (STR-213), test-placement convention (STR-111). Allowed: docs/adr files + this program's control files. Forbidden: all code/guards. Risks: none. Acceptance: owner accepts each rule; ADRs linked from doc index. Rollback: docs revert. Owner approval: yes (this wave is decisions). Tests/CI: doc guards only.
- **Wave H card.** Objective: observe-mode enforcement. Scope: resolution-based layer-boundary observer (reusing the cycle-guard's resolver); type-cycle observe report; deep-import allowlist (1 documented exception STR-313); fix the stale cycle-guard header comment (STR-204); alias+relative fixtures added to check-layer-boundaries.test.mjs. Allowed: new guard scripts + their tests + the one comment fix. Forbidden: production code; ESLint rule semantics. Risks: CI noise if baselines wrong — hence observe mode. Acceptance: deterministic baseline report with explicit exceptions. Rollback: remove observer step. Owner approval: yes. Tests/CI: yes (guard self-tests).
- **Wave I card.** Objective: ratchet. Scope: promote observer rules to CI-failing for NEW violations only. Allowed: guard/lint config + fixtures. Forbidden: production code. Risks: false positives blocking work — mitigated by registered baselines. Acceptance: CI rejects a synthetic new violation; zero production diffs. Rollback: revert rule. Owner approval: yes. Tests/CI: yes.
- **Waves J/K/L/M cards** follow CONTROL §8 fields verbatim (Base SHA, branch, consumer inventory, parity oracle, allowed/forbidden lists, explicit "no impact" schema/export/financial/UI line, acceptance criteria, rollback boundary, short report + PR); each is owner-gated; bundle budget re-measured after any import re-pointing (D-034); moneyLayerGuard and group*Docs lockstep lists apply where relevant.

**What is deliberately NOT a wave now:** any adapter/port split (N output feeds a future decision); any finance/ split (needs Wave F + STR-302 decisions); any page split (Wave T); any semantic repair (Wave R); any schema/export work (Wave S); any platform (U/V/W/X — triggers unmet).

---

## 16. Owner decision table

| # | Decision | Why it matters | Options | Recommendation | Safe if deferred? |
|---|---|---|---|---|---|
| 1 | Accept this report + findings classifications (Wave C/E gate) | unlocks the whole program; the plan's mandatory Micro gate | accept / accept with amendments / reject per-finding | accept with amendments where desired | yes — program simply stays in REPORT_ONLY |
| 2 | Accept Wave A freeze charter (already de facto per plan §6) | formalizes no-new-features during program | confirm / amend exceptions | confirm as-is | yes — freeze is already operating |
| 3 | Presentation→domain policy (STR-106) | decides the enforced direction chain; affects 16 value edges + future mobile reads | (a) ADR allowing pure reads + count-freeze guard; (b) redirect via application read models | (a) now (cheap, honest); revisit (b) only if a second surface appears | yes — record baseline 16; no drift guard until decided |
| 4 | Application→presentation policy (STR-203) | 12 service files depend on a UI-layer module; guard tests currently bless it | (a) documented waiver + ADR; (b) relocate pure formatting kernel below application | (a) now; (b) as a Wave L pilot if the owner wants direction purity | yes — waiver documents reality |
| 5 | g5 naming + shortCashDeclarations placement (STR-110) | discoverability + record-vs-read-model ownership | alias table (Wave G deliverable) vs rename wave (identity change) | alias table now; rename never without its own wave | yes — aliases are cheap |
| 6 | finance/ mega-module split approach (STR-103) | 9,174 lines mixing ≥6 responsibilities | split per cluster after Wave F / partial split (owner-money first) / keep with registry only | registry first (Wave F), then owner-money reframe as the pilot cluster | yes — registry alone resolves ownership ambiguity |
| 7 | Port home + commit-guard home (STR-102/115/202) | where the 131-method port and write-boundary invariants live long-term | keep storage-owned / move port to consumer side / capability ports (Wave O on trigger) | decide at Wave G after Wave N inventory; no move before | yes — Wave N inventory is the prerequisite either way |
| 8 | Storage records as UI view models (STR-305) | 16 UI files depend on adapter-owned schema types | status quo + registry / application-owned view-model layer (Wave T-adjacent) | status quo + registry; revisit with Wave T | yes |
| 9 | FIX_NOW batch approval (STR-401/403 + STR-204 comment + STR-104a guard test) | cheap, doc/test-only risk reduction | approve all / approve subsets / defer to Wave D/Q | approve: STR-403 + STR-204 comment immediately; STR-401 + STR-104a as the Wave D card | yes — each is independently safe to defer |
| 10 | Wave sequence acceptance (STR-515/§15) | ordering of E/F vs D and pilot scope | as proposed / strict letter order | as proposed (safety-equivalent, less waiting) | yes — no wave starts automatically |
| 11 | Domain test placement convention (STR-111) | where domain tests live going forward | tests/domain/ canonical (2 exceptions documented) / colocated canonical | tests/domain/ canonical | yes |
| 12 | Confirm money-scale freeze (STR-504) | plan §3 already froze it; re-confirm at acceptance | confirm no change | confirm | yes — frozen either way |
| 13 | When to open semantic track R (STR-302/211/503) | moving financial equations/error identity is meaning-sensitive | keep deferred / open per-equation cards | keep deferred until after Wave D + registry | yes — safest |
| 14 | Timing of S (schema/export) and T (UI) tracks | both are owner-gated independent tracks | trigger-based per plan | keep closed (no triggers) | yes |

---

## 17. Explicit lists

**PRESERVE (do not touch without an approved wave):** domain purity rules + public-surface lock (STR-101); guarded-commit protocol + its 9 modules (STR-306) and the documented type-only cycle (STR-307); runtime UI→storage boundary + 2 waivers (STR-207); local diagnostics (STR-310); composition-root DI + lazy pattern (STR-312); snapshot freeze/reversal/idempotency/envelope invariants (STR-314); touchpoints registry (STR-315); numeric double-diff governance (STR-404); docs-pinning governance tests (STR-410); moneyLayerGuard census (STR-415); contract numbering (STR-413); dated-claims discipline (STR-414); money representation (STR-504); clock injection pattern (STR-507); revert-insufficient fencing (STR-512); operational-control executable layer (STR-513); mutable-state sites (STR-210); ownership-guard precedent (STR-117); JOD cents/milli/Amman contracts; schema 38/30 and the accepted historical pairs (executable source: `ACCEPTED_PAIRS` in `localTransferService.releasedPairs.test.ts`).

**DEFER (sequenced by §15):** STR-102 (Waves N→O), STR-103 (Wave F→owner), STR-104 (Wave D/Q/R), STR-105 (Wave T), STR-113 (G→H→I), STR-213 (J→K), STR-204 (H; moves K/L), STR-205 (J→K), STR-209 (N), STR-305 (F→O/P), STR-214 (F/G→L), STR-109 (F), STR-115 (N), STR-116 (G), STR-309 (N), STR-211 (J/R), STR-111 (Q), STR-402 (Q), STR-406 (pre-M), STR-407 (pre-move), STR-408 (Q), STR-411 (Q), STR-412 (F), STR-416 (guard slice), STR-502/503/505 (U).

**OUT_OF_SCOPE:** all UI/visual work (STR-105 visual aspects; Wave T content); platform builds (STR-516 — no triggers met); schema/export/migration changes (Wave S only); financial-semantic repairs (Wave R only); historical reports and archives; branch/PR cleanup (the preserved unmerged branch `docs/ux-ui-zed-handoff-20260921` stays untouched per current-state §8.2.6).

**OWNER_DECISION_REQUIRED:** STR-302, STR-106, STR-203, STR-110, STR-515 (§15 sequence), plus decisions §16/6-8/13 (finance split approach, port/guards home, view-model layer, semantic-track timing).

---

## 18. Reconciliation table (specialist agreement/disagreement → resolution)

| Topic | Positions | Resolution (evidence wins) |
|---|---|---|
| Domain purity | S1, S2, S5 all verified clean | **Agreement** — 0 non-relative imports, guard-enforced |
| God-port/adapters | S1 (STR-102/112), S2 (202/212), S3 (301/308), S5 (506/508) | **Agreement** — merged into STR-102 |
| finance/ mega-module | S1 (103), S5 (510) | **Agreement** — merged into STR-103 |
| Transfer duplication risk | S1 (104), S3 (311), S4 (405), S5 (509) | **Agreement** — merged into STR-104 (highest data-compat trap) |
| Oversized pages = UI track | S1 (105), S5 (511) | **Agreement** — OUT_OF_SCOPE for structural program |
| Wave D as entry condition | S4 (401), S5 (§sequence) | **Agreement** — goldens/characterization before any move |
| Composition-root service count | S1 claimed 43 (STR-114 "doc drift 42 vs 43"); ARCHITECTURE.md says 42 | **Synthesizer re-measured: 42** `new *Service(` (each unique) in PrototypeServicesContext.tsx → **ARCHITECTURE.md is CORRECT; STR-114 REFUTED and withdrawn.** S1's extra count likely included non-composition-root instantiations (48 exist tree-wide). Doc needs no fix. |
| Port size | S1 "~146 members"; S2 AST 131; S3 regex 131 | **131 methods** (three-way verification incl. synthesizer's independent count); S1's figure was an approximation |
| Commit-guard count | S1 "7 guards (1,039 lines)"; S3 "9 modules" | **9** non-test guard files measured by synthesizer; S1 undercounted |
| Lazy services | S1 "2 lazy"; S3 "42 eager + 4 lazy slots" | **4 lazy dynamic imports** measured (loans, transfers, guidedOpeningImport, recurringExpense); S3 correct |
| Deep domain imports | S1/S3 "zero/one deep import"; S2 "6 deep edges" | **6** (S2's AST graph catches dynamic imports the rg patterns missed); S1's §6 claim of "100% via barrels" corrected to 99.08% |
| UI→domain imports | S1 "6 pages with value imports"; S2 "16 value edges incl. components/presentation" | Both true, different denominators — register states both (6 pages; 16 runtime-value edges total) |
| application→presentation | S2 OWNER_DECISION (plan conflict); S3 DEFER + document exception now | **OWNER_DECISION_REQUIRED** (STR-203) — genuine plan-wording vs live-practice conflict; interim: documented as open decision in this report, no code/guard change |
| UI→domain policy | S1 borderline DEFER/OWNER; S2 OWNER; S3 DEFER | **OWNER_DECISION_REQUIRED** (STR-106) — policy gap, not a defect |
| Cycle guard comment | S2 measured 3 type SCCs vs header "1" | **Measured wins** — 3 SCCs; comment fix = FIX_NOW docs (in STR-204) |
| STATE_DRIFT | current-state.md head a6b80179 vs live e7688efd | By design (docs-only #298, this program's control space); recorded in §3; no conflict |
| g5 hybrid | S1 flagged naming; S3 confirmed shortCashDeclarations is a stored record | Kept as one OWNER_DECISION (STR-110): naming alias + record placement |

---

## 19. Final recommendation — smallest safe next wave

**Do not move anything.** The smallest safe next wave is: **owner review of this report → acceptance of findings (Wave C/E gate) → approval of the FIX_NOW doc-only batch (STR-403 stale paths; STR-204 guard-comment correction) → execution of Wave D (parity baseline: full suite at base SHA + export goldens + direct transfer-cluster characterization + optional STR-104a drift-guard test).** Everything else (G/H/I rules-and-guards, J/K pilots, N port inventory, Q map) follows only after those gates, one owner-gated wave at a time. The three structural concentrations (god-port, finance mega-module, transfer validators) are real but are *sequencing problems*, not emergencies — the repo's guards, conformance suites, and control system currently hold them safely.

---

## 20. Exact files and lines changed by this report-only phase

On branch `docs/architecture-refactoring-plan-20261002` (from verified live `origin/main` = `e7688efda3bbae945a258cca92eabce889c7dab4`). **المنشifest محدث 2026-10-03 ليطابق الـdiff الفعلي للـPR** (تصحيح إلزامي: النسخة الأولى ذكرت NEXT-ACTIONS.md وهو ليس ضمن الـdiff، وأغفلت ملفات التزامات المالك):

**مرحلة المسح (التزامات الوكيل — 23e4557، 09248b9):**

1. `docs/architecture/refactoring/REFACTORING-ARCHITECTURE-AND-MIGRATION-PLAN.md` — **new** (this file; the single canonical deliverable).
2. `docs/architecture/refactoring/REFACTORING-CONTROL.md` — minimal edit: program status line + report pointer.
3. `docs/operations/control/items/ARCH-001.json` — **new** minimal control item.
4. `docs/operations/control/workstreams/WS-211.json` — **new** minimal report-only workstream claim.
5. `docs/operations/control/generated/{AGENT-BRIEF.md, ACTIVE-WORK.md, MASTER-TRACKER.md, MASTER-TRACKER.csv, MASTER-TRACKER.xlsx.meta.json}` — regenerated exclusively via the official generator (`--refresh-excel-meta`; the Excel workbook itself intentionally not regenerated, consistent with PRs #291/#293/#294). **NEXT-ACTIONS.md ليس ضمن هذا الـPR** (لا يوجد ضمن الـdiff).

**توسيعات المالك على الفرع (8e361e7، a59eeb1):**

6. `docs/architecture/refactoring/REFACTORING-PLAN-A-TO-Z.md` — بوابات التغطية الشاملة وحدود النمو.
7. `docs/architecture/refactoring/ZAI-STRUCTURE-ARCHITECTURE-SCAN-PROMPT.md` — توسيع موجب المسح.
8. `docs/architecture/refactoring/README.md` + `REFACTORING-CONTROL.md` — تحديثات مرجعية صغيرة.

**مرحلة التصحيحات الموثقة (التزام 2026-10-03 — تصحيحات إلزامية بأمر المالك قبل الدمج):**

9. هذا الملف (التصحيحات أعلاه) + `docs/architecture/refactoring/AGENT-SEQUENTIAL-WORKLOG.md` و`OWNERSHIP-AND-TRUTH-REGISTRY.md` و`REFACTORING-EXECUTION-REPORT.md` و`FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md` — **new** (ملفات البرنامج الحية الأربعة).
10. `docs/operations/current-state.md` + `docs/operations/current-state-log.md` — تحديث الحقل الحي وإلحاق السجل المؤرخ (إغلاق الانحراف البروتوكولي الموثق في النسخة الأولى).
11. `AGENTS.md` — تصحيح مسار qa/ (STR-403).
12. `docs/contracts/40-technical-ownership-map-contract.md` — تصحيح المسارات الثلاثة (STR-403).
13. `scripts/check-runtime-cycles.mjs` — **تعليق فقط** (STR-204): توثيق 3 SCCs نوعية مقيسة؛ صفر تغيير دلالة.
14. `docs/00-document-index.md` — فهرسة الملفات الحية الأربعة (سطر 187).
15. سجلات Operations Control (ARCH-001/WS-211 محدثة + views معاد توليدها بالمولد الرسمي).

**تم إغلاق الانحراف البروتوكولي (النسخة الأولى أجّلت تحديث current-state للمالك):** هذا الالتزام يحدث `current-state.md` ويلحق `current-state-log.md` وفق AGENTS §9/§10 — لم يبق انحراف.

## 21. Exact files and behavior NOT changed

No file under `apps/`, `src/`, `tests/`, `ai-skills/`, `reports/`, `planning/`, `.github/` was created, edited, moved, renamed, deleted, or reformatted. **الاستثناء الوحيد تحت `scripts/` (مستند في §20 بند 13):** `scripts/check-runtime-cycles.mjs` — تعديل تعليق رأس فقط (توثيق أدق للـSCCs النوعية المقيسة؛ STR-204)؛ منطق الحارس وسلوكه وخروجه لم يُمسا. No configuration (`package.json`, `tsconfig.json`, `eslint.config.js`, `vitest.config.ts`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, vite configs) was created, edited, moved, renamed, deleted, or reformatted. No React/TSX/CSS/token/DOM/navigation/copy change. No financial meaning, formula, policy, terminology, error message, or accounting claim changed. No storage, IndexedDB schema, migrations, snapshots, export/import, or historical interpretation changed (`localSchemaVersion`/`localExportVersion` remain 38/30). No Ports/Facades/Shared-Kernel/modules extracted; no `features/`, `common/`, `utils/` created. No dependencies, build, CI, security, or deployment settings changed. No branches deleted, no PRs closed/merged, no old reports rewritten. No secrets committed anywhere.

## 22. Rollback/recovery boundary for the report-only PR

The PR changes documentation and control records only — **no runtime behavior** (the single `scripts/` touch is a header comment with zero semantic effect, and the guard's own self-test still passes) — so no runtime rollback is needed. Recovery = close the PR without merging, or revert the merge commit; the repository returns to `e7688efd` semantics exactly. The Operations Control record (ARCH-001/WS-211) would then be updated to `SUPERSEDED`/`DEFERRED` by the owner (or left as history); no data, schema, export, or user-visible behavior is affected in any case.

---

**Final status:** `OWNER_ACCEPTED — 2026-10-03` (remediation program authorized by the owner's instruction; execution records in `AGENT-SEQUENTIAL-WORKLOG.md` / `REFACTORING-EXECUTION-REPORT.md`) — the report itself changed no runtime file.

```text
PLAN_COMPLETE — OWNER_DECISIONS_REQUIRED
NO_STRUCTURAL_REFACTORING_PERFORMED (by this report; program waves tracked separately)
NO_PRODUCT_OR_FINANCIAL_SEMANTICS_CHANGED
NO_SCHEMA_OR_EXPORT_IMPORT_CHANGED
```

---

## 23. Post-Closure A-to-Z Gap Reconciliation (2026-10-03)

**التاريخ:** 2026-10-03
**رأس `main` الحي المعتمد لهذا القسم:** `04895f2643608fce00553040d484db84f80bf5dc` (تحقق: `git fetch origin --prune` + `git rev-parse origin/main`؛ فرع البرنامج `refactoring/remediation-program-20261003` عند الرأس نفسه؛ الشجرة نظيفة؛ صفر PRs مفتوحة؛ صفر claims نشطة)
**حالة القسم:** `REPORT_ONLY — OWNER_DECISIONS_REQUIRED` — PR واحد للتقرير فقط، مفتوح إلى `main` **ولا يُدمج** قبل مراجعة المالك وقبوله الصريح لقائمة الموجات التالية
**البرنامج:** Micro A-to-Z Structural Completion and Controlled Refactoring Program (استمرار ما بعد إغلاق برنامج المعالجة عند PR #308 / WS-212 VERIFIED)
**المرجع الحاكم (قاعدة المرجع أولًا):** قُرئ `REFACTORING-PLAN-A-TO-Z.md` **كاملًا من المستودع الحي** — v1.3، مؤرخ 2026-09-30، الحالة `OWNER_ACCEPTED — 2026-10-03`، آخر التزام للمسار `a0f19d13350bddc480c393eb32313e5b70c91643` (#299) — واستُخرجت مبادئه الثمانية عشر وتصنيفاته (PRESERVE/REFRAME/MERGE/SPLIT/DEFER/FIX_NOW/OUT_OF_SCOPE/OWNER_DECISION_REQUIRED) وشرائط أحجام الملفات (NORMAL<400 / WATCH 400–799 / SPLIT_CANDIDATE 800–1,199 / SPLIT_NOW ≥1,200 متعدد المسؤوليات) وبواباته ومعايير إكماله §9. هذا القسم يقوّم ضد الخطة ولا ينشئ سلطة ثانية ولا سجل ملكية ثانيًا ولا يعيد صياغة سياسة مالية، وتعلو عليه `AGENTS.md` والعقود والحية الكود حيث تحكم.

### 23.1 الجواب التنفيذي المبسط (بالعربية)

**ما الذي تحقق فعلًا ويجب الحفاظ عليه؟**
برنامج المعالجة السابق أُغلق **صادقًا** عند `04895f2`: كل ما نفّذه (ذهبيات التصدير الـ27، غارد الدريفت بطبقتيه، التسمية الأساسية financial-analysis، عناقيد المالية القابلة للنقل، طيار قدرة Order lifecycle، سجل توافق النقل التاريخي، حارسا 4E، التدقيقات المعادية المستقلة AUDIT_PASS) **أعيد التحقق منه في هذا المسح بشكل مستقل** — بما فيه الحياد الدلالي الكامل لفرق البرنامج: نقل الملفات الإنتاجية الإحدى عشرة متطابق البصمات أو إعادة تسمية نقية (10/11 متطابقة البصمات + إعادة تسمية g5)، و`localSchemaVersion=38`/`localExportVersion=30` كما هما، والذهبيات بلا مس منذ #300، وحراس الكتابة التسعة وسلوك CAS سليمان. سجل الجرد **دقيق تمامًا**: 1,323 ملفًا متتبعًا / 752 في النطاق، صفر ملف مفقود، صفر صف متقادم، صفر عدم تطابق شرائط (أُعيد قياسه مرتين مستقلتين بوكلاء مختلفين). كل حراس CI الخمسة الرئيسيون خضر عند الرأس الحي (حدود 3/13/14؛ راتشة 357/350؛ دورات 0؛ فهارس وتحكم exit 0).

**ما الذي بقي فعلًا لإكمال A-to-Z البنيوي؟** تسع فئات، لا أكثر ولا أقل:
1. **دفعة توثيقية FIX_NOW صغيرة** (STR-601..607): ترويسات حالة متقادمة في مساحة التحكم، وأعداد ومسارات في ARCHITECTURE.md وعقدي 27/34، وترويسة §5 في تقرير التنفيذ، وتاريخ §8.2 في الحالة الحية، وحزمة دقة سجلات، وأساس راتشة متأخر بسبعة ملفات.
2. **سبعة قرارات مالك حاجبة** (STR-608..614) — أخطرها هامش ميزانية CI الخام (~12–17 بايتًا، D-034) الذي **يبوّب أي عمل على الرسم الاعتمادي** (موجات B وJ/K واستكمال التفويض).
3. **موجتا J/K للبوابات العامة**: 69/89 ملف تطبيق إنتاجي يستورده الـUI بمسار مباشر (191 حافة)، وصفر براميل تطبيق، و`settlementInvariant` ما يزال خارج برميله (STR-205).
4. **استمرار O لاستخراج القدرات**: مجموعة واحدة مستخرجة من 20 جوهرية؛ **ست مجموعات تفي بمعيار الموجة اليوم** (المصروف المتكرر، ميزانيات المصروف، القروض، سياسات التوزيع، تصريحات الكاش القصير، واستحقاق المالك بحذر exe017).
5. **إكمال M/E**: العناقيد الثلاثة المحروسة بإقامة عقد 40، و`inventoryMaterialService` (SPLIT_NOW بلا حسم — أضعف ملف في النظام من حيث التدبير)، وSCC النوعي الباقي.
6. **إكمال H/I للحراس**: تعداد SCCs النوعية، والاستيرادات العميقة داخل المجال، وقاعدة resolution-based لواجهة→تخزين، وبُعد المسؤولية في الراتشة.
7. **موجة Q لخريطة الاختبارات/العقود**: 50/60 صفحة بلا اختبارات مرافقة، وإنفاذ عقود 5/49، وتسعة عشر عقدًا بلا ربط.
8. **مكتشف معادي واحد جديد** (STR-623): نسختان من معرفة قيم القبول خارج سجل 4D وكل الحراس — وجدها المدقق المعادي المستقل حيًّا.
9. **مهارة التشغيل A0** (§23.20): يجب إنشاؤها وتسجيلها قبل أي موجة كود بنيوية.

لا يوجد في المتبقي أي عمل منصات مستقبلية (U/V/W/X غير محفزة)، ولا UI (T مغلق)، ولا دلالة مالية (R غير محفز)، ولا مخطط/تصدير (S محروس).

**الخلاصة:** البنية السليمة محفوظة ومقيسة والبرنامج السابق صادق في إغلاقه — لكن «إكمال A-to-Z» يتطلب الموجات المتبقية أعلاه **بقرار مالك لكل منها**. أصغر خطوة تالية آمنة: قبول هذا التقرير → موجة A0 (المهارة) → موجة A (مصالحة التوثيق) → بوابة قرارات G.

### 23.2 Scope, non-goals, credentials mode

**نطاق هذه المرحلة (للتقرير فقط):** مسح فجوات ما بعد الإغلاق من A إلى Z مقابل `REFACTORING-PLAN-A-TO-Z.md` v1.3 عند الرأس الحي؛ خمسة اختصاصيين قراءة فقط (حدود الوحدات؛ المجال/التخزين/البيانات/التوافق؛ الاعتماديات/الأسطح العامة/الدورات/النمو؛ الاختبارات/العقود/التوثيق/العمليات؛ ثم مراجعة معادية مستقلة خامسة تتحدى الأربعة والتوليف)؛ تحديث هذا الملف بقسم مؤرخ واحد؛ تحديث سجلات Operations Control الدنيا؛ PR تقرير واحد غير مدمج.

**خارج النطاق (non-goals):** لا تعديل/نقل/حذف/توليد أي ملف إنتاج أو اختبار أو سكربت أو إعداد أو UI أو تخزين؛ لا تنفيذ أي مكتشف FIX_NOW (تُقترح للقبول فقط)؛ لا تغيير معنى مالي أو مخطط أو تصدير/استيراد أو تاريخ أو واجهة؛ لا حذف فروع أو PRs أو سجلات؛ لا منصات مستقبلية؛ لا إعادة كتابة تاريخ؛ لا تنظيف لا علاقة له بالبرنامج؛ لا دمج الـPR.

**Credentials mode:** القراءة عبر استنساخ عام للمستودع العمومي (لا يحتاج رمزًا). استُخدم رمز `MICRO_WRITE_ACCESS_TOKEN_with_workflow` **حصرًا** لعمليات API المصدقة للقراءة (تحقق PRs المفتوحة وSHAs الدمج) ثم لدفع فرع التقرير وفتح الـPR الواحد. الرمز محفوظ في ملف chmod-600 **خارج المستودع** (`/home/z/my-project/.micro-credential`، خارج الشجرة المتتبعة)، لم يُطبع ولم يُلصق ولم يُلتزم في أي ملف أو سجل أو تقرير، ويُحذف في ختام الجلسة. لو فشلت صلاحية: يُبلَّغ عن صنف الفشل فقط ويُوقف العمل عند حدّه (لم يحدث).

### 23.3 Live baseline and state drift — [VERIFIED]

| الحقل | القيمة الحية عند هذا القسم |
|---|---|
| `origin/main` | `04895f2643608fce00553040d484db84f80bf5dc` — **مطابق تمامًا للنقطة المرجعية المعلنة للبرنامج الجديد؛ لا STATE_DRIFT** |
| فرع البرنامج السابق | `refactoring/remediation-program-20261003` = الرأس نفسه (متزامن بعد كل دمج) |
| الشجرة | نظيفة (`git status --porcelain` = 0 أسطر) قبل المسح وبعده وخلاله (أثبت كل اختصاصي ذلك بداية ونهاية) |
| PRs المفتوحة | **0** (API مصدق) — والقضيتان المفتوحتان #56/#59 بطاقتا فهم تاريخيتان من سلسلة G6 (2026-08-24) لا تعارضان البرنامج |
| Claims النشطة | 0 (`validate.py`: 80 بندًا / 54 Workstream / 0 نشط)؛ WS-212 = VERIFIED |
| سلسلة الدمج | e7688efd → #299 a0f19d1 → #300 76ebb6d → #301 7e75ded → #302 c4b3a59 → #303 99356fc → #304 aa7a78d → #305 efb61ca → #306 b02e939 → #307 4a4e317 → #308 04895f2 — **كل SHAs الدمج العشرة أسلاف مباشرون لـmain** (تم التحقق بـ`git merge-base --is-ancestor` لكل واحد) |
| آخر تحديث للمرجع/التحكم/الخطة | `a0f19d1` (#299) — لم تُمَس ملفات الحوكمة الثلاثة منذ بدء التنفيذ |

### 23.4 Specialist scopes, commands, and evidence — [عنصر 6 من عقد التقرير]

خمسة اختصاصيين مستقلين للقراءة فقط، ركّز كل منهم على الرأس `04895f2` وتحقق من نظافة الشجرة بدايةً ونهايةً (صفر كتابات داخل المستودع من كل منهم — مبرهنة). التقارير الكاملة: `/home/z/my-project/work/micro/specialists-20261003/` (خارج المستودع؛ S1..S4 + المسودة + المعادي S5).

| الاختصاصي | النطاق | أوامر/فحوص نفّذها (exit codes) | مخرجات |
|---|---|---|---|
| S1 — حدود الوحدات والمسؤوليات | خريطة الوحدات، الجرد والشرائط، SPLIT_NOW/CANDIDATE، عناقيد عقد 40، خريطة الهدف §14، التركيب | إعادة قياس الجرد بسكربت مستقل (scratch)؛ `validate.py` 0؛ `check-module-boundaries.mjs` 0؛ `check-file-size-ratchet.mjs` 0؛ `check-doc-index-coverage.mjs` 0 | 10 مكتشفات + 5 ثانوية؛ حروف D/F/G/H/I/L/M |
| S2 — المجال/التخزين/البيانات/التوافق | المنفذ 131، المحوّلان، قدرة 4C، سجل 4D، الحرم 38/30 والذهبيات وحراس الكتابة، حياد فرق البرنامج (بصمات) | محلل أقواس python للواجهة؛ تتبع مستهلكين live؛ `git diff -M a0f19d1..04895f2` بفحص بصمات | 15 مكتشفًا؛ جدول Q5 الكامل (22 مجموعة)؛ حروف D/N/O/P/R/S |
| S3 — الاعتماديات/الأسطح/الدورات/النمو | مصفوفة قاعدة→حارس (22 قاعدة)، البراميل، الشيم التسع، الراتشة، الميزانية | الحراس الخمسة كلها 0؛ تحليل AST من scratch؛ عدّ الحواف 191/69 ملفًا | 11 مكتشفًا؛ حروف H/I/J/K + سياق D/L/Y/Z |
| S4 — الاختبارات/العقود/التوثيق/العمليات | مشهد الاختبارات، إنفاذ العقود، سجلات العمليات، Provenance، الصدق التوثيقي | `validate.py` 0؛ `check-doc-index-coverage.mjs` 0؛ مطابقة السجلات مقابل git log | 16 مكتشفًا؛ كل الحروف بتقدير أدلة |
| S5 — المراجعة المعادية المستقلة | تحدى الأربعة + المسودة على أنماط الفشل العشرة؛ تحقق مستقل | أعاد الحراس الخمسة (0)؛ أعاد اشتقاق كل الأرقام الحاملة؛ بصمات النقل الـ11؛ تعداد إعادة التسمية | **HOSTILE_REVIEW_PASS**؛ مكتشف جديد S5-F01 (→STR-623)؛ دحض إحصاء واحد (14→13 إعادة تسمية) + تعديلان |

**قاعدة القراءة قبل التحليل (نُفذت):** قرأ كل اختصاصي worklog الجلسة + `REFACTORING-PLAN-A-TO-Z.md` كاملًا + ملفات الحوكمة الحية قبل أي استنتاج، واستخدم تقارير الاختصاصيين الخمسة الأصليين (من مسح 2026-10-02) كأدلة مرشحة **أعاد التحقق منها** لا كمصدر نهائي.

### 23.5 Verification of the v1.0 maps against the live tree — [عناصر 7–12]

كل خرائط §5–§12 في هذا الملف بقيت صالحة عند `04895f2` مع الدلتا الموثقة التالية (كلها VERIFIED ما لم يُذكر غير ذلك):

- **خريطة الوحدات (عنصر 7):** المجال 19 مسارًا (18 منطقة + برميل توافق g5)؛ التطبيق 35 مجلدًا فرعيًا / 89 ملفًا إنتاجيًا (بيوت جديدة: `financial-records/`، `budgets/`، `owner-money/`، `financial-analysis/`)؛ `application/finance/` انكمش من 9,174 إلى 6,833 سطرًا إنتاجيًا (13 خدمة حقيقية + 7 شيم توافق)؛ التخزين 22 ملفًا إنتاجيًا / 9,955 سطرًا (types + محوّلان + 9 حراس + migrations/snapshot + قدرات 4C). الطبقات كما هي (pages 60، components 68، presentation 10، contexts 1، lib 3، app 11، pwa 6).
- **جرد الملفات/المسؤولية/الحجم (عنصر 8):** `FILE-SIZE-AND-RESPONSIBILITY-REGISTER.md` v1.4 **دقيق تمامًا** — 1,323 متتبعًا / 752 في النطاق (إنتاج 338، اختبار 337، سكربت 20، إعداد 21، مولد 7، عهدة 29)؛ الشرائط 681/42/13/12/4؛ صفر مفقود/متقادم/متباين (قياسان مستقلان). الأساس المرافق للراتشة (`file-size-ratchet-baseline.json`) متأخر بسبعة ملفات فقط (STR-607).
- **خريطة الاعتماديات/الطبقات/الدورات/الاستيراد العميق (عنصر 9):** R1=3 / R2=13 / R3=14 (خضراء عند الرأس، مطابقة للسجل حرفيًا)؛ 69/89 ملف تطبيق بمسار مباشر من الـUI (191 حافة، صفر براميل)؛ صفر دورات تشغيل (333 ملفًا)؛ 3 SCCs نوعية موثقة (واحدة بتوثيق متقادم — STR-620)؛ 9 إعفاءات ESLint موثقة.
- **تركيب المجال/التطبيق/التخزين/المحوّلات/العرض (عنصر 10):** لا ملف غادر `src/domain` أو دخل طبقات UI في فرق البرنامج كله (13 إعادة تسمية، 0 حذف)؛ `exe017` حُدّث ولم يُضعف؛ ملفات §11.1 المجمدة في AGENTS لم تُمس.
- **مصادر الحقيقة والتكرار (عنصر 11):** سجل §4 أُغلق بموجة 4D (3 DOMAIN_RUNTIME_LIST / 18 GUARDED_UNION / 1 HISTORICAL_REGISTRY — أُعيد العد حيًّا)؛ KnowledgeState أحادية الاتحاد؛ **استثناء جديد وجده المعادي**: نسختا قيم قبول خارج السجل وكل حراسة (STR-623).
- **خريطة الاختبارات/العقود/العهد/التوثيق (عنصر 12):** جذري 46 ملفًا / 555 حالة ثابتة (555/555 تشغيليًا في السجل)؛ تطبيقي 291 ملفًا / 2,042 ثابتة (2,172/2,172 تشغيليًا في السجل — NOT_EXECUTED هنا)؛ **كل وحدة مقبولة/منقولة لها اختبارات مباشرة متحقق منها** (قائمة كاملة في تقرير S4 §4.3)؛ إنفاذ العقود 5/49 و19 عقدًا بلا ربط؛ 50/60 صفحة بلا اختبارات مرافقة.

### 23.6 A-to-Z status matrix — [عنصر 13]

القراءة: كل حالة أدناه مقوّمة ضد تعريف الحرف في `REFACTORING-PLAN-A-TO-Z.md` §7 وليس ضد نطاق البرنامج السابق (الذي كان 3A→4E فقط). الصيغ المسموحة: COMPLETE / PARTIAL / NOT_STARTED / PRESERVE_BY_DESIGN / DEFERRED_BY_OWNER_DECISION / OUT_OF_SCOPE / NOT_TRIGGERED / BLOCKED.

| الحرف | الحالة | الدليل المختصر (صنف الدليل) |
|---|---|---|
| A — تجميد وميثاق | **COMPLETE** | قبول المالك 2026-10-03؛ `e7688efd..04895f2` لا يحوي إلا PRs البرنامج #299–#308 (VERIFIED) |
| B — مصالحة المسح | **PARTIAL** | إعادة القياس لكل موجة صحيحة (جرد v1.0→v1.4، إعادة بناء الرسم، إعادة مسار الأسس)؛ انحراف التوثيق ما بعد النقل لم يُصالح (STR-601..607) (VERIFIED) |
| C — مسح بنيوي قراءة فقط | **COMPLETE** | مسح #299 المقبول؛ وهذا القسم هو إعادة المسح بعد الإغلاق (تقرير فقط) (VERIFIED) |
| D — أساس التكافؤ | **COMPLETE** | 27 ذهبية + MANIFEST بلا مس منذ #300؛ غارد دريفت بطبقتين؛ وصف مباشر؛ دُقق مرتين مستقلتين (VERIFIED) |
| E — قبول المكتشفات | **COMPLETE** | قبول المالك 2026-10-03 موثق (تذييل الخطة؛ CONTROL §3؛ worklog Entry 1) (VERIFIED) |
| F — سجل الملكية | **PARTIAL** | المجال 18+1 صفًا / التخزين 131/131 / المالية 21 صفًا مكتملة؛ `financialPulseService` و`capacityDecisionService` بلا صفوف؛ ~16 مجلد تطبيق غير مالي بمستوى الملف فقط (VERIFIED) |
| G — قواعد الهدف المعماري | **NOT_STARTED** | لا قرارات اتجاه ولا ADRs؛ STR-106/203/302/305/110 ما زالت مفتوحة في السجل §6؛ 4E جمّد الأسس فقط (VERIFIED) |
| H — حارس المراقبة | **PARTIAL** | المراقب الثلاثي + الراتشة + حارس الدورات + validate.py (views) خضر بسلبيات مثبتة؛ **المراقب العام للطبقات وتعداد SCCs النوعية ومراقب تغطية السجل غير موجودة** (كانت في بطاقة H الأصلية) (VERIFIED) |
| I — راتشة الحراس | **PARTIAL** | راتشة الشرائط + الحواف الثلاث موصولة بCI بسلبيات مثبتة (17 اختبارًا ذاتيًا)؛ **بُعد المسؤولية** («لا مسؤولية جديدة في ملف خطر») مراجعة يدوية فقط (VERIFIED) |
| J — طيار السطح العام | **DEFERRED_BY_OWNER_DECISION** | صفر براميل تطبيق؛ STR-205 غير منفذ (`settlementInvariant` خارج برميل craft-order)؛ تأجيل صريح موثق (current-state-log:1737) (VERIFIED) |
| K — توحيد الاستيراد | **DEFERRED_BY_OWNER_DECISION** | الاستيراد العميق 3 كما هو؛ 69/89 ملف تطبيق بمسار مباشر (191 حافة)؛ البوابة نفسها (VERIFIED) |
| L — طيار نقل الملف | **COMPLETE** | نُفذ فعليًا عبر 4A/4B/متابعة #307 بميكانيكا L كاملة: جرد مستهلكين، تطابق بصمات، شيم، تحديث أسس بنفس الـPR، تدقيق (VERIFIED) |
| M — الدمج المقيس | **PARTIAL** | 3/6 عناقيد مالية + التسمية؛ قدرة 1/22؛ الباقي بقرار مالك (STR-611/612/613) (VERIFIED) |
| N — جرد المنفذ | **COMPLETE** | 131/131 في 22 مجموعة؛ الواجهة هي العدّ المرجعي؛ تحفظات دقة توثيقية فقط (STR-606) (VERIFIED) |
| O — استخراج المنفذ | **PARTIAL** | الطيار 4C منفذ (9/131 طريقة، 1/22 مجموعة)؛ 6 مجموعات تفي بالمعيار اليوم؛ كل استخراج إضافي ببطاقة وقرار (VERIFIED) |
| P — حدود المحوّلات | **PARTIAL** | عزل المنفذ+المحوّلين وconformance وtouchpoints محفوظة وخضراء؛ منافذ Clock (42 موقعًا) و17 استيراد نوعي UI و4 حواف DI بقرار مالك؛ الموجة الرسمية لم تُفتح (VERIFIED) |
| Q — خريطة الاختبار والتوثيق | **PARTIAL** | الجرد/السجل/الفهرس/المتتبع يخططون الملفات والمفاهيم وكل وحدة مقبولة مختبرة مباشرة (متأكد)؛ **سجل صفحة→اختبار وربط العقود (5/49) واصطلاح موضع الاختبارات غير موجودة** (VERIFIED) |
| R — مسار الإصلاح الدلالي | **NOT_TRIGGERED** | صفر تغيير دلالي (بصمات)؛ حافة isLocalDate مثبتة بالوصف؛ المرشحون موثقون (VERIFIED) |
| S — مسار المخطط/التصدير | **NOT_TRIGGERED** | 38/30 عند types.ts:55/:71؛ الترحيلات بلا مس منذ c4b412a؛ لا مصدر حقيقة مالي ثانٍ (VERIFIED) |
| T — مسار حدود الواجهة | **NOT_TRIGGERED** | 9 شيم تنتظر مسار UI؛ صفر تغيير UI في فرق البرنامج (VERIFIED) |
| U — قابلية نقل المتجهات | **NOT_TRIGGERED** | لا مستهلك غير TypeScript موجود (VERIFIED) |
| V — بوابة المحمول | **NOT_TRIGGERED** | لا كود Dart/Flutter في الشجرة (VERIFIED) |
| W — بوابة Python/API | **NOT_TRIGGERED** | Python كأداة مستودع فقط (VERIFIED) |
| X — تقييم استخراج خدمة | **NOT_TRIGGERED** | لا محفز؛ الحدود لم تستقر بعد على الهدف (INFERRED) |
| Y — تدقيق الإكمال | **COMPLETE (لنطاق البرنامج المنفذ)** | A5-FINAL AUDIT_PASS عند 4a4e317؛ D1–D7 كلها موجودة حيًّا؛ **يُعاد وجوبًا بعد أي موجات مقبولة إضافية قبل إغلاق A-to-Z** (VERIFIED) |
| Z — الإغلاق والمجمد | **PARTIAL** | الإغلاق صادق في سجلاته؛ ترويسات مساحة التحكم متقادمة (STR-601)؛ مجمد A-to-Z لم يُسجل بعد (VERIFIED) |

### 23.7 سجل المكتشفات الكامل — [عنصر 14]

ترقيم جديد STR-601..STR-623 (سلسلة مسح ما بعد الإغلاق؛ لا تصطدم بسلاسل 1xx–5xx السابقة). الصيغة: المعرف / العنوان / صنف الدليل / تصنيف المالك / الخطورة / الأدلة الحالية / الحدود المتأثرة / لماذا يهم / السبب الجذري / الحد الأدنى الآمن للمعالجة / الترتيب والاعتماديات / معيار القبول / حد الرجوع / خارج الأهداف.

#### الفئة أ — FIX_NOW (توثيقي صرف؛ لا يغير أي معنى؛ تنفيذه بعد قبول المالك فقط)

**STR-601 — ترويسات حالة مساحة التحكم متقادمة مقابل الإغلاق.** VERIFIED / FIX_NOW / متوسطة.
أدلة: `docs/architecture/refactoring/README.md:3-4` (`OWNER_REVIEW_REQUIRED`، `PRE-SCAN / REPORT-ONLY`) و`REFACTORING-CONTROL.md:5-6` (`OWNER_ACCEPTED — PROGRAM_IN_PROGRESS`) بينما البرنامج مغلق VERIFIED عند #308؛ يضاف إليه (مكتشف المعادي) أن `ZAI-STRUCTURE-ARCHITECTURE-SCAN-PROMPT.md` ما يزال يُقرأ كأمر مرحلة أولى حي.
لماذا يهم: أي وكيل يفتح مساحة التحكم يستنتج حالة خاطئة (بوابات مقفلة توًّا أو عمل معلق) فيتخطى بوابات أو يعيد عملًا مكتملًا.
السبب الجذري: لم تُحدَّث ترويسات المساحة عند إغلاق #308 (كانت تصحيحات D1–D7 موجهة للسجلات الحية لا للترويسات).
الحد الأدنى الآمن: تصحيح أسطر الحالة فقط + إحالة لسجلات الإغلاق (قراءة فقط؛ لا إعادة صياغة قواعد).
القبول: الترويسات تطابق WS-212 VERIFIED؛ الفحوص التوثيقية خضراء. الرجوع: revert الالتزام. خارج الأهداف: أي تعديل على نص القواعد نفسها.

**STR-602 — عدّادات ARCHITECTURE.md متقادمة بعد نقل البرنامج.** VERIFIED / FIX_NOW / منخفضة–متوسطة.
أدلة: `apps/prototype-web/ARCHITECTURE.md` يذكر 53 ملف `*Service.ts` (الحي: 58) و18 منطقة مجال (الحي: 19 مسارًا بما فيها برميل التوافق) و42 خدمة موصولة (الحي: 43 بطريقته المعلنة نفسها — أعاد المعادي العد).
لماذا يهم: وثيقة التنقل الأولى للتطبيق؛ انحراف الأعداد أضلّ سابقًا مصالحةً كاملة (قضية 42/43 في مسح v1.0).
الحد الأدنى الآمن: إعادة عدّ بطريقة الملف المعلنة + ملاحظة مؤرخة. القبول: الأعداد تطابق الشجرة الحية. الرجوع: revert. خارج الأهداف: أي إعادة هيكلة.

**STR-603 — مسارات/أسماء متقادمة في عقدي 27 و34.** VERIFIED / FIX_NOW / منخفضة.
أدلة: `docs/contracts/34-correction-history-trail-contract.md:19` ما يزال يسمي `application/finance/correctionHistoryService.ts` (انتقل إلى `financial-records/` في #307؛ عقد 40 أخذ ملاحظة 4B المكافئة و34 لم يأخذها)؛ `docs/contracts/27…:75` يستشهد `g5Service.expenseInputs` بلا ملاحظة إعادة تسمية 4A.
لماذا يهم: العقود سلطة؛ مسار متقادم في عقد يضلل كل وكيل يتحقق منه.
الحد الأدنى الآمن: ملاحظة مؤرخة + المسار الأساس الجديد (كنمط عقد 40). القبول: صفر مسارات ميتة في العقدين. الرجوع: revert. خارج الأهداف: أي تغيير معنى تعاقدي.

**STR-604 — ترويسة §5 في تقرير التنفيذ تسمي رأسًا خاطئًا للإغلاق.** VERIFIED / FIX_NOW / منخفضة.
أدلة: `REFACTORING-EXECUTION-REPORT.md` §5 عنوانه «أحدثها عند رأس الإغلاق c4b3a59» بينما الإغلاق الفعلي: تدقيق 4a4e317 وسجلات #308 عند 04895f2 (وهو سطر وحيد نجا من تصحيحات D).
الحد الأدنى الآمن: تصحيح السطر + إحالة. القبول: الترويسة تطابق §6. الرجوع: revert.

**STR-605 — تعارض تاريخي صغير في الحالة الحية.** VERIFIED / FIX_NOW / منخفضة.
أدلة: `docs/operations/current-state.md` §1 يستشهد `a6b80179` (تاريخي بالتصميم لكنه في خانة «الحقيقة الحالية») و§8.2 بتاريخ 2026-10-02 بينما ترويسة الملف 2026-10-03 (إغلاق البرنامج).
الحد الأدنى الآمن: توحيد التاريخ + ملاحظة أن SHA §1 تاريخي بالتصميم. القبول: لا تعارض تواريخ داخل الملف. الرجوع: revert.

**STR-606 — حزمة دقة السجلات (7 بنود).** VERIFIED / FIX_NOW / منخفضة.
أدلة: (1) سجل الملكية §2 يسمي ≥10 «وحدات حراسة» لا وجود لها كملفات (الحقيقة: 9 وحدات نقية + CAS داخل المحوّلين)؛ (2) §5 يقول «Clock حقن ~25 خدمة» والحي 42 موقعًا؛ (3) §5 يقول STR-305 = 16 ملف UI والحي 17؛ (4) ملاحظة §4 في الجرد تستشهد عددي v1.1 (67/83) مقابل جدولها v1.4 نفسه (89 صفًا)؛ (5) STR-313 موسوم تصنيفًا غير دقيق؛ (6) صف SCC ما يزال يسمي g5Service بعد إعادة تسمية 4A (الحي financialAnalysisService)؛ (7) نص موقع إعفاء Math يقول finance والملفات diagnostics/home/input؛ ويضاف (8، من المعادي) تسجيل موقعي STR-623 في §4 وتصحيح صياغة «الوحيد».
لماذا يهم: هذه السجلات هي مصدر الملاحة للبرنامج القادم؛ كل رقم خاطئ بذرة مصالحة كاذبة.
الحد الأدنى الآمن: تصحيحات توثيقية فقط بنفس الـPR. القبول: إعادة عدّ مستقلة تطابق. الرجوع: revert.

**STR-607 — أساس الراتشة متأخر بسبعة ملفات.** VERIFIED / FIX_NOW / منخفضة.
أدلة: `scripts/file-size-ratchet-baseline.json` (350 مدخلًا: 283/42/13/12) مقابل 357 ملفًا إنتاجيًا مقيسًا حيًّا؛ غير المتتبع: 5 أهداف منقول أساسية + سكربتا حارس 4E؛ مدخلات شيم ميتة باقية؛ الحارس PASS بلا تصعيد (الحماية سليمة — القاعدة الجديدة/الملف الجديد يُمسك دائمًا).
الحد الأدنى الآمن: تحديث الأساس بالبروتوكول الموثق (نفس الـPR الذي يمس المسارات المشروعة أو شريحة مخصصة صغيرة). القبول: 357/357 متتبعة؛ الحارس أخضر. الرجوع: revert الأساس. خارج الأهداف: أي رفع عتبات.

#### الفئة ب — OWNER_DECISION_REQUIRED (قرارات حاجبة؛ لا تخمين)

**STR-608 — هامش ميزانية CI الخام ~12–17 بايتًا (D-034).** VERIFIED + NOT_EXECUTED (بناء حي) / OWNER_DECISION_REQUIRED / **عالية**.
أدلة: آخر قياس موثق 649,871 خامًا / 154,754 مضغوطًا محليًا (Node-24) مقابل سقفين 650,000/155,000؛ CI (Node-22) يقيس +112–117 فوق المحلي (فشل RAW_OVER موثق في 4D عولج بتراجع محسوب)؛ السقفان مثبتان بdiff مزدوج (كود+وثائق+اختبار).
لماذا يهم: هذا القرار **يبوّب** موجات B (إعادة توجيه استيرادات تغيّر entry chunks) واستكمال تفويض 4D المؤجل (~42+ بايت) وكل منفذ قدرة إضافي.
الخيارات: (أ) رفع السقف بقرار مالك وdiff مزدوج؛ (ب) ضغط الحزمة (~200–300 بايت) بشريحة بنيوية صغيرة؛ (ج) قبول المراقبة (خطر: أي إضافة تُفشل CI).
القبول (أي خيار): قرار موثق + الأرقام متطابقة ثلاثيًا. الرجوع: revert. خارج الأهداف: تخفيض السقف صامتًا أو تجاوز الحارس.

**STR-609 — سياستا الاتجاه غير محسومتين (STR-106/STR-203).** VERIFIED / OWNER_DECISION_REQUIRED / متوسطة.
أدلة: 13 حافة قيمة UI→مجال و14 حافة تطبيق→عرض، مجمدتان بحارس 4E لا محلولتان؛ الموجة G لم تُفتح قط؛ لا ADRs.
الخيارات لكل سياسة: إعفاء موثق بADR (+تجميد العدد) أو إعادة توجيه عبر طبقة (موجة L لاحقًا). القبول: ADR لكل سياسة. الرجوع: revert ADR.

**STR-610 — تصديق ADR على التغييرات المنفذة.** VERIFIED / OWNER_DECISION_REQUIRED / متوسطة.
أدلة: خطة §7.1.4 تشترط ADR لأي تغيير حد/مصدر حقيقة/Surface عام/منفذ/استثناء؛ البرنامج نفّذ خمسة من هذه (4A/4B/4C/4D/4E+#307) ببطاقات موجات موثقة قَبلها المالك كوعاء («عبر بطاقات الموجات الموثقة فقط») دون ADRs مستقلة.
الخيارات: تصديق جماعي أن البطاقات هي ADRs المعتمدة، أو دفعة ADRs استرجاعية موجزة (5–7 صفوف لكل تغيير). القبول: قرار موثق في worklog + (اختياريًا) ملفات ADR مفهرسة. الرجوع: revert.

**STR-611 — العناقيد الثلاثة المحروسة: الإقامة أم النقل.** VERIFIED / OWNER_DECISION_REQUIRED / متوسطة.
أدلة: Integrity & Diagnostics وRecurring Planning وFinancial Read Models = 13 خدمة / 6,833 سطرًا في `application/finance/`؛ لكل منها صف عقد 40 (أو §8) + حارس exe017 قابل للتنفيذ + اختبارات مباشرة + لا اقتران قسري — **فالحفظ موقف دفاعي سليم**؛ ودوافع النقل: الاتساق (نمط 4B مثبت 5 مرات) والاكتشافية (finance = 3 عناقيد + 7 شيم). فروق دقيقة: `recurringExpenseService` ليس مثبتًا في العقد (دلتا أصغر)؛ Read Models موزعة على بيتين بعد 4A.
الخيارات: حفظ مستقر / نقل كامل / نقل جزئي (نصف المصروف المتكرر أولًا). القبول: قرار لكل عنقود + تحديث exe017 بالدلالة نفسها إن نُقل. الرجوع: revert النقل (لا أثر بيانات).

**STR-612 — `inventoryMaterialService` SPLIT_NOW بلا حسم.** VERIFIED / OWNER_DECISION_REQUIRED / متوسطة.
أدلة: 1,428 سطرًا غير فارغة؛ الملف الوحيد غير UI من SPLIT_NOW بلا بيت عنقود/موجة/سبب حفظ — «ملاحظة تأجيل» فقط. كل نظرائه محسومون (المحوّلات→O/P؛ المحفظة القارئة→عقد 40؛ policies→حفظ موثق).
الخيارات: بيت عنقود (مثلًا inventory ضمن موجة E) أو حفظ بسبب تماسك موثق أو بطاقة تقسيم مستقلة. القبول: صف حاسم في الجرد/السجل. الرجوع: revert.

**STR-613 — ترتيب استخراج القدرات (استمرار O).** VERIFIED / OWNER_DECISION_REQUIRED / متوسطة.
أدلة: جدول Q5 الكامل (S2 §5): **ست مجموعات تفي بالمعيار اليوم** — المصروف المتكرر (الأقوى: مستهلك واحد + conformance مخصص + عقد 41)، ميزانيات المصروف (conformance + 3C)، القروض والقروض المستلمة، سياسات التوزيع (قفل exe017)، تصريحات الكاش القصير، واستحقاق المالك (بحذر exe017)؛ تليها الأصول/الوقت الفعلي (بعد عدسة conformance) ثم الجداول. الباقي (الأحداث المالية، سيولة الكاش، النقل-اللقطة، ومجموعات القراءة المشتركة) **يبقى خلف الواجهة بتصميم**. كل شريحة بنمط RC-7 المثبت (منفذ Pick + مراسي + عقد بالمحوّلين معًا + هجرة ميكانيكية) وتكلف بايتات — الترتيب يحترم STR-608.
القبول: بطاقة لكل قدرة + عقد أخضر بالمحوّلين + الواجهة سلطوية. الرجوع: revert (لا أثر بيانات).

**STR-614 — فرضية إزالة شيمة withdrawalWalletGuard غير صحيحة.** VERIFIED / OWNER_DECISION_REQUIRED / منخفضة–متوسطة.
أدلة: الشيمة (في `finance/withdrawalWalletGuard.ts`) مستبقاة حيًّا **بمستهلك غير UI وحيد**: `application/owner-money/ownerEntitlementService.ts:27`؛ لا مستهلك UI — فتوثيق «الإزالة تتبع مسار UI» غير صحيح لهذه الوحدة تحديدًا.
الخيارات: هجرة الاستيراد الوحيد وإزالة الشيمة (شريحة ميكانيكية صغيرة قابلة للدمج مع موجة A/B) أو إعادة توثيق شرط الإزالة الفعلي. القبول: التوثيق يطابق المستهلكين الحيّين (جرد مستهلكين مرفق). الرجوع: revert.

#### الفئة ج — DEFER (بنيوي مؤجل؛ مرتب على الموجات المقترحة §23.9)

**STR-615 — فجوة J/K: بوابات عامة للتطبيق وتوحيد الاستيراد.** VERIFIED / DEFER / متوسطة.
أدلة: 69/89 ملفًا إنتاجيًا تطبيقيًا يستورده الـUI بمسار مباشر (191 حافة؛ صفر براميل `index.ts` تحت application)؛ `settlementInvariantResult` ما يزال يُستورد ديناميكيًا من عمق المجال (`integrityCheckService.ts:1437`؛ غير مصدَّر من برميل craft-order — STR-205 الأصلية).
لماذا يهم: قابلية الاكتشاف وعزل التغيير؛ أي إعادة تنظيم داخلية للتطبيق كسر بريء لـUI لأن الاستيرادات بمسارات كاملة.
الحد الأدنى الآمن: براميل فقط حيث مستهلك فعلي (لا براميل generic)، هجرة ميكانيكية للمستهلكين، تصدير settlementInvariant عبر البرميل، إعادة قياس الميزانية. الاعتماديات: STR-608 + STR-609 (قرارات G) تسبق. القبول: انخفاض الحواف المباشرة؛ الحزمة داخل السقف؛ لا تغيير سلوك. الرجوع: revert. خارج الأهداف: براميل شاملة أو `common/`.

**STR-616 — 18 طاقم GUARDED_UNION حرفية باقية في مدققات النقل.** VERIFIED / DEFER / منخفضة–متوسطة.
أدلة: خريطة القبول الحية 3 DOMAIN_RUNTIME_LIST / 18 GUARDED_UNION / 1 HISTORICAL_REGISTRY؛ التفويض المؤجل (unitDimensions + 4 قوائم متكررة + catalogItemKinds) موسوم D-034 (~42+ بايت براميل جديدة)؛ الطواقم متكافئة حرفيًا (يشهد الوصف والذهبيات والدريفت قبل/بعد).
الحد الأدنى الآمن: استكمال التفويض بعد قرار STR-608؛ أو إبقاء موسومًا بقرار. القبول: خريطة القبول محدثة + الطواقم متكافئة حرفيًا. الرجوع: revert.

**STR-617 — فجوات إكمال الحراس (تسعة بنود).** VERIFIED / DEFER (موجة H للإكمال) / منخفضة–متوسطة.
أدلة (مصفوفة القاعدة→حارس الكاملة عند S3 §4 — 22 قاعدة): (1) لا تعداد/حارس لـSCCs النوعية (الرابعة تمر بCI)؛ (2) الاستيرادات العميقة داخل المجال بلا قاعدة (3 حواف حية موثقة؛ المراقب يستثني layer=domain)؛ (3) حظر UI→تخزين زمن التشغيل specifier-only في ESLint (لا قاعدة resolution-based؛ صفر إفلات اليوم بتحقق أحادي)؛ (4) UI_LAYERS في R2 لا تشمل `presentation/*` (3 حواف عرض→مجال خارج التجميد)؛ (5) لا مراقب تغطية للسجل؛ (6) بُعد المسؤولية في الراتشة يدوي؛ (7) دورة حياة الشيم غير قابلة للتنفيذ (وفرضية واحدة فشلت — STR-614)؛ (8) regex مناطق R1 `[a-z-]+` لا يطابق مناطق بأرقام (`g5` كامن — مكتشف المعادي)؛ (9) مراسي دريفت لموقعي STR-623.
الحد الأدنى الآمن: إضافة الحراس الستة القابلة للتنفيذ + سلبيات مثبتة لكل. القبول: مصفوفة 22/22 «GUARDED أو موثق بعذر». الرجوع: revert كل حارس مستقل.

**STR-618 — بقايا موجة N.** VERIFIED / DEFER / منخفضة.
أدلة: 8 طرق منفذ بلا مستهلكين إنتاجيين (وحدها saveOrder محروسة F-053)؛ القنوات الجانبية الأربع قائمة (عالم IndexedDB معزول؛ Clock غير مخيّط — 42 موقعًا؛ localDiagnostics ثماني حقول؛ touchpoints 37+3)؛ منفذ Clock غير موجود.
الحد الأدنى الآمن: قرار لكل طريقة خاملة (إزالة تتطلب إثبات خلو + تحديث المحوّلين) + منفذ Clock إن قُبل (نمط الحقن القائم يجعله رخيصًا). القبول: جرد محدث + conformance خضراء. الرجوع: revert.

**STR-619 — فجوات موجة Q.** VERIFIED / DEFER / متوسطة.
أدلة: إنفاذ العقود 5/49 (7 ملفات مستشهدة) و19 عقدًا بلا ربط تحكم؛ 50/60 صفحة بلا اختبارات مرافقة ولا سجل صفحة→اختبار؛ موضع اختبارات المجال ثلاثي بلا اصطلاح مكتوب؛ حارس الفهرس يغطي 4 مجلدات فقط؛ `financialPulseService`/`capacityDecisionService` بلا صفوف سجل ملكية؛ ~16 مجلد تطبيق غير مالي بمستوى الملف فقط (إكمال F).
الحد الأدنى الآمن: سجل صفحة→اختبار مولّد + ربط العقود + اصطلاح موضع + صفوف الملكية الناقصة. القبول: صفر وحدة مقبولة بلا دليل تغطية أو سبب موثق. الرجوع: revert (إضافي فقط).

**STR-620 — SCC النوعي projectFinancialService↔financialAnalysisService باقٍ بعد 4A/4D.** VERIFIED / DEFER / منخفضة.
أدلة: أُعيد تسمية الطرف فقط؛ الحافة النوعية حية؛ صف السجل §5 يسمي الاسم القديم (g5Service) — جزء توثيقي صار في STR-606.
الحد الأدنى الآمن: فك ميكانيكي (نقل نوع) في أول شريحة تمس الملفين، أو قبول موثق كدورة نوعية. القبول: صفر SCC غير موثق. الرجوع: revert.

**STR-623 — نسختا قيم قبول خارج سجل 4D وكل حراسة (مكتشف المراجعة المعادية).** VERIFIED / DEFER / متوسطة.
أدلة: `application/agreements/agreementContextService.ts:9-39` يعرّف `LegacyAgreementSource` محليًا + طاقم قيم من 8 (5 حالية + 3 تاريخية) يكرر معرفة `AGREEMENT_SOURCE_ACCEPTANCE` «المصدر الوحيد» المفترض؛ و`application/transfers/guidedOpeningImportService.ts:76-77` يعرّف `walletKinds` و`materialUnits` كطاقمين محليين (يُستخدمان للقبول عند :128/:150) مكررين لقوائم المجال الحية. كلا الموقعين خارج سجل الملكية §4 وخريطة مصادر القبول وغارد الدريفت وكل حارس.
لماذا يهم: هذا **نمط الفشل الأول** الذي وُجدت موجة 4D لإغلاقه (مصدر حقيقة ثانٍ كامن): تغيير قائمة المجال لا يفشل أي فحص هنا فينزلق الانحراف صامتًا.
الحد الأدنى الآمن: (1) صفان في سجل الملكية §4 (توثيقي — ضمن STR-606)؛ (2) **تمديد مراسي دريفت 3B لتغطية الموقعين (اختباري فقط، بلا أثر حزمة)** — الشريحة الأولى المرشحة بعد القبول؛ (3) التوحيد الكامل (استهلاك من السجل/المجال) اختياري بعد STR-608.
القبول: أي تغيير في القوائم المرجعية يفشل الاختبار عند الموقعين. الرجوع: حذف الاختبارات المضافة. خارج الأهداف: أي تغيير سلوك قبول فعلي.

#### الفئة د — PRESERVE (رأس المال المعماري؛ لا يُمس بلا موجة معتمدة)

**STR-621 — أصول البرنامج المحايدة والمتحقق منها.** VERIFIED / PRESERVE / معلوماتية.
أدلة (أعاد المعادي التحقق مستقلًا): فرق البرنامج كله `a0f19d1..04895f2` = 13 إعادة تسمية و0 حذف ولا ملف غادر المجال أو دخل UI؛ **نقل الملفات الإنتاجية الإحدى عشرة متطابق البصمات أو إعادة تسمية نقية** (10/11 متطابقة + إعادة تسمية g5) — والفروق الخمسة في ملفات اختبار منقولة ميكانيكية (استيرادات/إعادة تسمية صنف، غير دلالية، فُحصت كلها)؛ 38/30 عند types.ts:55/:71؛ الترحيلات بلا مس؛ 27 ذهبية + MANIFEST بلا مس؛ EXE-014 سليم؛ 9 حراس كتابة + CAS؛ حافة isLocalDate مثبتة بالوصف (السطر 173)؛ KnowledgeState اتحاد وحيد؛ touchpoints 37+3؛ نقاء المجال صفر انتهاكات؛ قفل السطح العام 16/16؛ دقة الجرد الكاملة؛ خريطة القبول 3/18/1 بملاحظات D2 مطبقة.
الحد الأدنى الآمن: لا شيء — الحفظ ذاته. الرجوع: غير مطلوب. خارج الأهداف: أي «تحسين» يمس هذه الأصول بلا موجة.

**STR-622 — تنبيه تسمية «تحصين الحدود».** VERIFIED / PRESERVE (بتوضيح) / منخفضة.
أدلة: 4E سلّمت **تجميدًا + راتشة** (لا نمو صامت) لا حلًا للسياسات؛ التوثيق والإغلاق صادقان لكن التسمية قد تُقرأ على أنها «الحدود حُلّت».
الحد الأدنى الآمن: جملة توضيحية في STR-601/606 batch. القبول: لا قارئ يستنتج حل السياسات. الرجوع: revert.

### 23.8 Target module map — execution status — [عنصر 15]

خريطة الهدف §14 تبقى صالحة (خرائط منطقية فقط؛ الأسماء النهائية مؤجلة بحكم الخطة §5). حالة التنفيذ عند `04895f2`:

| صف §14 | الحالة عند الرأس الحي |
|---|---|
| shared / financial-records cluster / craft-order / inventory+catalog / recurring siblings / direct-sale / supplier / transfer subsystem / contracts+control / tests layout | PRESERVE كما هو (لا تغيير مطلوب) |
| **owner-money (REFRAME)** | **EXECUTED** (4B: بيت `application/owner-money/` + شيمتان) |
| **read-model cluster: g5 naming (OWNER_DECISION)** | **EXECUTED جزئيًا** (4A: `financial-analysis` أساس + برميل توافق؛ قرارا STR-110 الفرعيان — الجدول المرجعي وموضع shortCashDeclarations — ما زالا مفتوحين ضمن STR-609/611) |
| storage port + adapters (DEFER خلف N/O) | N مكتمل؛ O طيار فقط (STR-613)؛ الملفان كما هما (4,135/2,091 سطرًا غير فارغة) |
| application/finance SPLIT (OWNER_DECISION→SPLIT بعد F) | **3/6 منفذة** (Owner Money، Financial Records، Budgets)؛ الباقي STR-611 |
| presentation/formatters (OWNER_DECISION) | مفتوح (ضمن STR-609) |
| pages/components (Wave T) | خارج النطاق البنيوي (T مغلق) |
| app/ composition root (REFRAME) | PENDING (لم تُفتح موجة) |
| contexts/lib (REFRAME) | PENDING |
| IndexedDb/Memory كملفين (MOVE_LATER خلف O/P) | PENDING خلف STR-613 |

### 23.9 الحد الأدنى من الموجات الآمنة مع الاعتماديات — [عنصر 16]

مرتبة على أمواج الخطة A–Z (بلا أسماء جديدة) وعلى ترتيب تعليمة البرنامج (A0→A→B→C→D→E→F→G→H→I→Y→Z):

| # | الموجة | الهدف | البطاقات/المكتشفات | الاعتماديات | موافقة المالك |
|---|---|---|---|---|---|
| 0 | **A0 — مهارة التشغيل** | إنشاء وتسجيل `skills/micro-a-to-z-structural-refactoring/SKILL.md` (العقد المقترح §23.20) | §23.20 | قبول هذا التقرير | نعم |
| 1 | **A — مصالحة الأساس والتحكم** | دفعة FIX_NOW التوثيقية + تحديث أسس الراتشة ببروتوكول نفس-الـPR + سجلات تحكم البرنامج الجديد | STR-601..607 (+توثيقي STR-614/623) | A0 | نعم (قائمة الملفات أدناه) |
| 2 | **G — قواعد الهدف والقرارات** | ADRs: سياستا الاتجاه، تصديق البطاقات كـADRs، قرارات الحزم/العناقيد/القدرات/الشيمة | STR-608..614 | A (سجلات مصالحة) | نعم (كل قرار) |
| 3 | **B — الأسطح العامة وتوحيد الاستيراد (J/K)** | براميل بمستهلكين فعليين + settlementInvariant + هجرة ميكانيكية + قياس الحزمة | STR-615 (+STR-616 إن سمح الهامش) | **STR-608 + STR-609** | نعم |
| 4 | **C — استخراج القدرات (O)** | منافذ قدرة ببطاقات معتمدة واحدة واحدة (الترتيب في STR-613) | STR-613 (+STR-618 جزئيًا) | G + STR-608 | نعم لكل بطاقة |
| 5 | **D — حدود المحوّلات (P)** | عزل الفواصل المتبقية حيث تثبت الخريطة حدًّا (Clock أولًا إن قُبل) | STR-618 | C | نعم |
| 6 | **E — إكمال المالية التطبيقية (M)** | تنفيذ المنقول المعتمد من STR-611/612 + فك أو قبول SCC (STR-620) + شيمة STR-614 | STR-611/612/620/614 | G | نعم |
| 7 | **F — الملفات غير UI المتضخمة** | شريحة تقسيم/حفظ واحدة لكل ملف محسم (transferFamilyValidators أول المرشحين بعد B) | §23.6-M بقايا | B/C/E | نعم لكل ملف |
| 8 | **G2 — خريطة الاختبارات/العقود/المولدات (Q)** | سجل صفحة→اختبار + ربط العقود + الاصطلاح + صفوف F | STR-619 | A (يمكن موازاتها مع B–F بلا تعارض كتابة) | نعم |
| 9 | **H — إكمال الحراس والراتشة** | الحراس الستة القابلة للتنفيذ + مراسي STR-623 + إصلاح regex R1 | STR-617 (+623) | بعد أول موجة كود (ليتغذى على واقع جديد) | نعم |
| 10 | **I — فصل المسارات** | سجل قرار/مسار لكل بند R/S/T/U/V/W/X (معظمها قائم؛ توثيق الحالة) | §23.6 R..X | — | نعم (توثيقي) |
| 11 | **Y — التدقيق المعادي النهائي** | إعادة مسح كاملة مستقلة بعد كل الموجات المقبولة | معايير §9 للخطة | كل الموجات أعلاه | نعم |
| 12 | **Z — الإغلاق والمجمد** | سجل الإكمال + مجمد التوسع البنيوي | — | Y | نعم (توقيع الإغلاق) |

**ما ليس موجة الآن (بقرار):** أي شطر محوّلات لإعادة الكتابة؛ أي UI (T)؛ أي دلالة (R) أو مخطط (S)؛ أي منصة (U/V/W/X). **بلا بواباتها لا يبدأ شيء تلقائيًا.**

### 23.10 المسارات المسموحة والممنوعة لكل موجة — [عنصر 17]

| الموجة | مسموح حصرًا | ممنوع حصرًا |
|---|---|---|
| A0 | `docs/architecture/refactoring/skills/**` (جديد) + سطر الفهرس + worklog | كل ما عداه |
| A | الملفات السبعة المستهدفة بـSTR-601..607 + سجلات `docs/operations/control/**` (JSON ثم Views بالمولد) + `current-state.md`/`-log.md` | أي ملف تحت `src/` أو `apps/` أو `tests/` أو `scripts/` (عدا `file-size-ratchet-baseline.json` ببروتوكول نفس-الـPR) |
| G (قرارات) | `docs/architecture/ADRs/**` + السجل §6 + سجلات التحكم | كل الكود |
| B | براميل `application/*/index.ts` جديدة + أسطر الاستيراد لدى المستهلكين + تصدير البرميل لـsettlementInvariant + أسس الحارس في نفس الـPR | أي تغيير سلوك؛ أي ملف UI خارج أسطر الاستيراد حرفيًا؛ `src/domain/**` |
| C | `storage/local/capabilities/**` + تضييق أنواع المستهلكين + عقود القدرة | `types.ts` (الواجهة)؛ دلالة المحوّلين؛ المخطط/الترحيلات/اللقطات |
| D | الفواصل المعتمدة للمحوّلات (Clock: منفذ + مواقع الحقن) | إعادة كتابة المحوّلات؛ conformance بدلالتها |
| E | `application/finance/**` + بيوت العناقيد + تحديث exe017 بالدلالة نفسها | المعادلات/التقريب/التصنيف/سياسات النتيجة حرفيًا |
| F | الملفات المحسمة ببطاقاتها + اختباراتها | ملفات UI |
| G2 | سجلات الخرائط + صفوف السجل + نطاق حارس الفهرس | حذف أي اختبار أو assert |
| H | `scripts/**` (حراس + سلبيات + أسس) | أي إضعاف حارس موجود |

### 23.11 المخاطر وحدود الرجوع — [عنصر 18]

كل موجة = PR مستقل قابل لـrevert بلا أثر بيانات (وثّق ذلك لكل موجة سابقة وأعاد المدقق التحقق). المخاطر المحددة: (1) **B** تمس entry chunks — خطر الميزانية (STR-608 يسبقها) وسقف البايت يُراقب ببايت-تطابق عند الإمكان؛ (2) **C** كل منفذ يضاف يعقّد الواجهة — الواجهة تبقى سلطوية ولا تُحذف طريقة بلا إثبات خلو؛ (3) **E** نقل مالي — حرفيًا ميكانيكي وexe017 يُحدَّث بالدلالة نفسها (سابقة 4B مثبتة)؛ (4) **H** حراس جدد — خطر الإزعاج يُعالج بوضع المراقبة أولًا (نمط 4E)؛ (5) مبدأ 18 في الخطة قائم: لا يوصف revert بأنه آمن للبيانات تلقائيًا — كل بطاقة تكتب حد رجوعها.

### 23.12 معايير القبول والفحوص المطلوبة — [عنصر 19]

لكل موجة: بطاقة نطاق وحد رجوع (CONTROL §8)؛ فحوص مركزة خضراء + سلسلة `guards` + CI على الرأس؛ للموجات الكودية B–F: الجناحان كاملان + typecheck/lint/format + **الميزانية داخل السقف** + الذهبيات والدريفت والوصف خضراء قبل/بعد؛ للتوثيقية A/G2/I: validate.py + doc-index + secrets + `git diff --check` فقط. الإكمال الكلي (Z) لا يُعلن إلا بعد Y المعادي المستقل عند رأس main النهائي وكل معايير §9 في الخطة.

### 23.13 جدول قرارات المالك — [عنصر 20]

| # | القرار | الخيارات | التوصية | خطر التأجيل |
|---|---|---|---|---|
| 1 | قبول هذا التقرير ومصفوفة A-to-Z وقائمة الموجات | قبول / قبول بتعديلات / رفض لبند | قبول مع تعديل ما يشاء المالك | البرنامج يقف عند بوابة التقرير (سليم لكن بلا تقدم) |
| 2 | STR-608 هامش الميزانية | رفع بdiff مزدوج / ضغط ~200-300 بايت / قبول مراقبة | **رفع صغير موثق أو ضغط** — لا تجميد | يُعطّل B وC وSTR-616 |
| 3 | STR-609 سياستا الاتجاه | إعفاءان بADR / إعادة توجيه | إعفاءان الآن + إعادة توجيه كاحتمال L لاحق | آمن (التجميد يحرس) |
| 4 | STR-610 تصديق ADRs | البطاقات هي ADRs / دفعة استرجاعية | تصديق + دفعة استرجاعية موجزة في موجة A | آمن |
| 5 | STR-611 العناقيد الثلاثة | حفظ / نقل كامل / نقل جزئي (المصروف المتكرر أولًا) | **حفظ مستقر** ونقل جزئي فقط إن أراد المالك الاتساق | آمن (موثق ومحروس) |
| 6 | STR-612 inventoryMaterialService | بيت عنقود / حفظ بسبب / بطاقة تقسيم | بيت عنقود inventory في موجة E | آمن لكنه أضعف تدبير في السجل |
| 7 | STR-613 ترتيب القدرات | الترتيب المقترح / تعديل / إيقاف | الترتيب المقترح (المصروف المتكرر أولًا) | آمن |
| 8 | STR-614 شيمة withdrawalWalletGuard | هجرة+إزالة في A/B / إعادة توثيق | هجرة+إزالة (صغيرة وميكانيكية) | آمن |
| 9 | STR-623 شريحة مراسي الدريفت | تنفيذ مبكر (اختباري فقط) / مع موجة H | **مبكر** — رخيص ويغلق نمط الفشل الأول | انحراف صامت ممكن حتى التنفيذ |
| 10 | STR-615/616/619 القبول كمؤجلة مرتبة | قبول الترتيب / تعديل | قبول | آمن |
| 11 | توقيت المجمد Z | بعد Y مباشرة | بعد Y | — |

### 23.14 القوائم الصريحة — [عنصر 21]

- **FIX_NOW:** STR-601، STR-602، STR-603، STR-604، STR-605، STR-606، STR-607 (+الجزءان التوثيقيان STR-614/623).
- **PRESERVE:** STR-621، STR-622؛ وكل قائمة PRESERVE في §17 أعلاه تبقى سارية.
- **DEFER:** STR-615، STR-616، STR-617، STR-618، STR-619، STR-620، STR-623 (الشق الاختباري/التوحيدي).
- **OUT_OF_SCOPE:** كل عمل UI/بصري (Wave T)؛ المنصات U/V/W/X؛ المخطط/التصدير (S)؛ الدلالة المالية (R)؛ السجلات والفروع التاريخية.
- **OWNER_DECISION_REQUIRED:** STR-608، STR-609، STR-610، STR-611، STR-612، STR-613، STR-614 + قرارات §23.13.

### 23.15 جدول مصالحة الاختلافات — [عنصر 22]

| الموضوع | المواقف | الحسم (الدليل يفصل) |
|---|---|---|
| حالة G | S1: NOT_TRIGGERED مقابل S4: NOT_STARTED | **NOT_STARTED** (لم تُفتح؛ القرارات مفتوحة) |
| حالة H/I | S1/S4: COMPLETE مقابل S3: PARTIAL | **PARTIAL** (دليل S3 أعمق: بطاقة H وعدت بمراقب عام وتعداد نوعي؛ بُعد المسؤولية يدوي) |
| حالة L | S1: COMPLETE مقابل S4: NOT_TRIGGERED | **COMPLETE** (أُنفذت فعليًا بميكانيكا L كاملة — الدليل التنفيذي يفوز) |
| حالة P | S2: PARTIAL مقابل S4: NOT_TRIGGERED | **PARTIAL** (العزل قائم ومحفوظ؛ الدروات المتبقية بقرار) |
| حالة Q | S4: NOT_STARTED مقابل التوليف | **PARTIAL** (المخرجات الجوهرية موجودة ومتحققة؛ منتجات Q الرسمية غير موجودة) |
| عدد GUARDED_UNION | الإحاطة قالت ~7 مقابل القياس الحي | **18** (تصحيح D2 مطبق؛ الإحاطة كانت متقادمة) |
| الخدمات الموصولة | S1: 43 مقابل ARCHITECTURE: 42 | **43 بطريقة الملف نفسها بعد النقل** (الـ42 كان صحيحًا قبل البرنامج — انظر STR-602) |
| عدد إعادة التسميات | S1: 14 مقابل المعادي: 13 | **13** (دحض إحصائي موثق) |
| حياد النقل | «10/11 بصمات» | **مؤكد للإنتاج**؛ + توضيح: 5/10 ملفات اختبار منقولة بفروق ميكانيكية غير دلالية (فُحصت) |
| مصفوفة Q10 «16 محروسًا» | — | حاشية: يشمل صف دورة حياة الشيم (موثق غير قابل للتنفيذ — انظر STR-617/614) |

### 23.16 الملفات التي غيرتها هذه المرحلة (للتقرير فقط) — [عنصر 23]

على الفرع `docs/post-closure-a2z-gap-scan-20261003` من `origin/main` = `04895f2643608fce00553040d484db84f80bf5dc` — **كلها وثائق وسجلات تحكم؛ صفر كود**:

1. `docs/architecture/refactoring/REFACTORING-ARCHITECTURE-AND-MIGRATION-PLAN.md` — هذا القسم §23 + ترقية الترويسة إلى v1.1 (تصحيح إشارتي المرجع المتقادمتين).
2. `docs/operations/control/items/ARCH-003.json` — **جديد** (بند مسح الفجوات؛ GOVERNANCE/RESEARCH).
3. `docs/operations/control/workstreams/WS-213.json` — **جديد** (claim تقرير فقط).
4. `docs/operations/control/generated/{AGENT-BRIEF.md, ACTIVE-WORK.md, MASTER-TRACKER.md, MASTER-TRACKER.csv, MASTER-TRACKER.xlsx.meta.json}` — معاد توليدها **حصرًا بالمولد الرسمي** (`--refresh-excel-meta`؛ دفتر Excel نفسه لم يُعد توليده أسوة بـ#291/#293/#294/#299).
5. `docs/operations/current-state.md` — تحديث الحقل الحي للخطوة التالية المسموحة فقط (§8.2).
6. `docs/operations/current-state-log.md` — إلحاق القيد المؤرخ §113.

### 23.17 الملفات والسلوك الذي لم يتغير — [عنصر 24]

**صفر ملف** تحت `apps/` أو `src/` أو `tests/` أو `scripts/` أو `ai-skills/` أو `reports/` أو `planning/` أو `.github/` أُنشئ أو عُدّل أو نُقل أو حُذف أو أعيد تنسيقه. لا إعداد (`package.json`/`tsconfig`/`eslint.config`/vitest/vite/lockfile). لا React/TSX/CSS/token/DOM/تنقل/نص. لا معنى مالي أو معادلة أو سياسة أو مصطلح أو رسالة خطأ. لا تخزين أو مخطط IndexedDB أو ترحيلات أو لقطات أو تصدير/استيراد أو تفسير تاريخي (`localSchemaVersion`/`localExportVersion` = 38/30 كما هما). لا منافذ/واجهات/Shared-Kernel مستخرجة؛ لا `features/` أو `common/` أو `utils/`. لا حذف فروع أو PRs أو تقارير؛ لا إعادة كتابة سجلات. لا أسرار في أي التزام. المرحلة كلها قراءة فقط عدا ملفات §23.16 على فرع التقرير.

### 23.18 حدود المعرفة والمجهول — [عنصر 25]

- **NOT_EXECUTED (بقرار القراءة فقط):** الجناحان لم يُشغّلا عند الرأس (الأرقام التشغيلية 555/555 و2172/2172 من سجلات الإغلاق التي دققها مدققان مستقلان سابقًا)؛ الحزمة لم تُبنَ (الرقمان 649,871/154,754 من سجلات 4D/الإغلاق + السقفان مثبتان بالكود)؛ سلبيات الحراس قُرئت مصدريًا ولم تُشغَّل ديناميكيًا.
- أعداد `it(` الثابتة أقل من التشغيلية بـ130 حالة (parametrized — نمط STR-414 المعروف).
- مسح الاختصاصيين الخمسة الأصليين (2026-10-02) استُخدم كدليل مرشح **أعيد التحقق منه** لا كمصدر.
- القضيتان المفتوحتان #56/#59 بطاقتا فهم تاريخيتان غير متعارضتين (تحقق من لقطة API محفوظة؛ لا شبكة داخل رمال الاختصاصيين).
- تقارير الاختصاصيين الخمسة + المسودة محفوظة خارج المستودع (`/home/z/my-project/work/micro/specialists-20261003/`) وليست جزءًا من سجلات المستودع الدائمة (هذا القسم هو الملخص الملكي الوحيد).
- خريطة هدف §14 تبقى منطقية؛ الأسماء النهائية للوحدات قرار G كما دائمًا.

### 23.19 حد رجوع مرحلة التقرير فقط — [عنصر 26]

التغيير وثائق وسجلات تحكم فقط — **لا سلوك تشغيلي إطلاقًا**؛ لا حاجة لاستعادة زمن تشغيل. الاستعادة = إغلاق الـPR بلا دمج، أو revert التزام الدمج إن دُمج خطأً؛ يعود المستودع إلى دلالات `04895f2` حرفيًا. سجلات التحكم (ARCH-003/WS-213) يحدّثها المالك إلى SUPERSEDED/DEFERRED حينها (أو تُترك تاريخًا)؛ لا أثر على بيانات أو مخطط أو تصدير أو واجهة في كل الأحوال.

### 23.20 عقد مهارة التشغيل المقترحة (موجة A0) — [عنصر 27]

**المسار المقترح:** `docs/architecture/refactoring/skills/micro-a-to-z-structural-refactoring/SKILL.md` — تُنشأ بعد قبول هذا التقرير وقبل أي موجة كود بنيوية، وتُفهرس في `docs/00-document-index.md`.

**سلسلة السلطة (إلزامية نصًّا في المهارة):** `AGENTS.md` والعقود ← `REFACTORING-PLAN-A-TO-Z.md` (v1.3) ← هذه المهارة ← إجراءات المسح/الفحص/الموجات. المهارة **إجراء تنفيذ وتفتيش، لا سلطة معمارية ثانية**: لا تعيد صياغة سياسة مالية، ولا تستبدل AGENTS/عقدًا/الخطة/سجل الملكية، ولا تفوّض تغييرًا بنيويًا بذاتها، ولا تحوي سرًا أو قيمة، ولا تحمل قائمة أعمال حقيقية ثانية، ولا تصنف طيارًا اكتمالًا.

**محتواها الإلزامي:** (1) روابط للخطة الكاملة + قراءتها إلزامية قبل أي عمل؛ (2) محفزات الاستدعاء (قبل أي مسح/موجة/نقل/تقسيم/إعادة استيراد/منفذ/محوّل/حارس)؛ (3) التحقق المسبق: رأس حي + SHA + worklog/سجل ملكية/جرد؛ (4) إجراء المسح القرائي بخمسة اختصاصيين وأصناف الأدلة الستة؛ (5) قائمة تفتيش A-to-Z كاملة (حدود/ملكية/مصدر حقيقة/تخزين/محوّلات/طبقات/سطح عام/دورات/استيراد عميق/حجم ملف/اختبارات/عقود/توثيق/مولدات/حدود أمان/أداء/رجوع)؛ (6) التصنيفات الخمسة + WATCH؛ (7) متى تجب بطاقة إصلاح/جرد مستهلكين/تكافؤ/عقد اختبار/ADR/حارس/خطة رجوع؛ (8) بوابة التقرير فقط وبوابة قبول المالك؛ (9) حدود الكتابة المسموحة لكل موجة؛ (10) منع النقل الجماعي والتغييرات الدلالية/المالية/المخطط/التصدير/UI/الأمن المخفية؛ (11) واجبات كل موجة (فحوص/CI/PR/worklog/سجل/views)؛ (12) شروط التوقف (انحراف حالة/دليل ناقص/صلاحية/توسع نطاق/فشل فحص)؛ (13) التدقيق النهائي ومعايير الإغلاق §9؛ (14) قاعدة الصيانة: تُحدَّث المهارة فقط عند تغير الخطة أو الإجراء، بتسجيل سبب وتاريخ، ولا تتباعد عن الخطة بصمت.

**إثبات الاشتقاق (يُكتب داخلها):** كل بند تفتيش يشير إلى بند الخطة الذي اشتق منه (§4 مبادئ؛ §5 تصنيف؛ §6 تجميد؛ §7 أمواج؛ §7.1 إضافات؛ §7.2 بوابة التغطية؛ §7.3 شرائط؛ §9 إكمال) — والمهارة لا تضيف قاعدة عمارة جديدة واحدة.

---

**الفحوص المركزة لهذه المرحلة (ما شُغل فعلًا ونتائجه):** `python3 scripts/operations-control/validate.py` → exit 0 (80/54/0 قبل الإضافة؛ يعاد تسجيل العدد بعد إضافة ARCH-003/WS-213)؛ `node scripts/check-doc-index-coverage.mjs` → exit 0؛ `node scripts/check-secrets.mjs` → exit 0؛ `git diff --check` → نظيف؛ `node scripts/check-current-state-size.mjs` → exit 0 (بعد تحديث الحالة الحية). **لم تُشغل** الجناحان ولا البناء (قراءة فقط) — NOT_EXECUTED بموجب عقد هذه المرحلة.

```text
A_TO_Z_GAP_SCAN_COMPLETE — OWNER_DECISIONS_REQUIRED
NO_STRUCTURAL_REFACTORING_PERFORMED
NO_PRODUCT_OR_FINANCIAL_SEMANTICS_CHANGED
NO_SCHEMA_OR_EXPORT_IMPORT_CHANGED
NO_UI_OR_VISUAL_BEHAVIOR_CHANGED
NO_REPOSITORY_WRITES_PERFORMED
NO_CLEANUP_PERFORMED
REPORT_ONLY_PR_OPEN — DO_NOT_MERGE
```

**معنى كتلة الحالة حرفيًا:** لا كتابة على `main` ولا تغيير بنيوي/دلالي/مخطط/واجهة في أي مكان؛ «الكتابة» الوحيدة هي فرع التقرير غير المدمج هذا (ملفات §23.16 فقط) وPR الواحد المفتوح الذي **لا يُدمج** قبل قرار المالك.


### 23.21 مصالحة ما بعد الإغلاق على `main` — 2026-10-05

هذا القيد **إضافة مصالحة لاحقة** ولا يعيد كتابة أدلة المسح التاريخية في §23. عند إعادة التحقق الحي بعد إغلاق PRs التقرير، كانت الحقيقة التالية:

| الحقل | النتيجة المتحققة |
|---|---|
| `origin/main` | `5eacbe38011c9a753b4daeb9801541fb2538ca30` — رأس main النهائي بعد PR #312 |
| PR #311 | **MERGED** إلى `main`؛ رأس المصدر `43215f3325105a1a51acefaab1ce6824333cf345`؛ رأس دمج الكود `c26eb838b90b359da182885f21c4318f78ec1006` |
| PR #312 | **MERGED** إلى `main`؛ مصالحة السجلات والـViews من JSON المصدر؛ رأس الدمج `5eacbe38011c9a753b4daeb9801541fb2538ca30` |
| CI | تشغيل `37281587396` على رأس main النهائي: **success** |
| PR #309 | **CLOSED — NOT MERGED**؛ مخرجات gap-scan محفوظة في هذا الملف وفي ARCH-003/WS-213 كسجل تاريخي مصالح عليه |
| PR #310 | **CLOSED — NOT MERGED**؛ عقد التنفيذ محفوظ في `ZAI-A-TO-Z-EXECUTION-CONTRACT.md` داخل تسوية وثائقية لاحقة |
| ARCH-004 / WS-214 | إكمال A-to-Z مدموج ومتحقق على رأس main النهائي |
| ARCH-003 / WS-213 | `SUPERSEDED` كسجل تقرير مستقل؛ لا Claim نشطة لهما |
| التغيير المحمي | لا تغيير مالي أو دلالي أو مخطط أو تصدير/استيراد أو UI؛ `localSchemaVersion=38` و`localExportVersion=30` ثابتان |

**سبب المصالحة:** لم يُستخدم cherry-pick أعمى لفرع التقرير، لأن Views والحالة فيه كانتا عند رأس `04895f2` وستعيدان ادعاءات قديمة. أُعيد إدخال الخطة والعقد كسجلين مرجعيين، ثم تُحدَّث مصادر JSON وتُعاد Views بالمولد الرسمي. لا يعني هذا القيد فتح موجة بنيوية جديدة؛ أي تغيير بنيوي لاحق يبقى محكومًا ببوابة ما بعد Group 6: مسح قراءة-فقط، مراجعة المالك، قبول النتائج، ثم موجات مضبوطة.

**حالة البرنامج بعد المصالحة:** `A_TO_Z_STRUCTURAL_COMPLETION — VERIFIED_ON_MAIN; MORATORIUM_ACTIVE`.
