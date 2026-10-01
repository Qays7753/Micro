# MICRO — Remediation Plan v2

- **Date:** 29 August 2026
- **Based on:** `MICRO-REVIEW-FINDINGS.md` (64 unique findings, `main @ 8ee0832`)
- **Continues:** `docs/quality/system-review-remediation-plan-v1.md` (prior cards not restated; open items listed in §2.6)
- **Rule zero:** no fix may break the five financial boundaries — `collection ≠ profit`, `debt ≠ cash`, `purchase ≠ COGS`, `owner money ≠ sale/expense`, `missing ≠ zero` — and no fix may change any historical recorded value.

> Every card below carries: severity, effort (S ≤ half a day / M ≤ two days / L > two days), risk of the fix, dependencies, root cause, options considered with verdicts, chosen approach, implementation steps, acceptance criteria, and explicit out-of-scope. LOW-severity findings get compact cards. The full copy-change table from the language review is reproduced in Appendix A; the unified glossary in Appendix B.

---

## 1. Remediation cards

### Phase 0 — Documentation consistency (safe, immediate, no code)

#### [E-05] Align TRACKER L-04.2 courier events with contract 21 §3
- Severity: HIGH · Effort: S · Risk of the fix: low · Depends on: none

**Root cause:** TRACKER was written against the historical delivery spec (`dispatched/arrived/completed/failed/cancelled`) and never updated when contract 21 defined the governing machine (`booked/source_ready/picked_up/in_transit/arrived_or_completed` + exception states).

**Options considered**

| Option | Trade-off | Verdict |
|---|---|---|
| Fix TRACKER to cite contract 21 states verbatim | none — tracker is explicitly subordinate to contracts | ✅ chosen |
| Fix contract 21 to match TRACKER | rewrites accepted contract semantics without owner decision | ❌ rejected |
| Add a disclaimer "tracker is illustrative" | leaves the trap armed for agents told the tracker is «المصدر التنفيذي التفصيلي» | ❌ rejected |

**Chosen approach and why:** TRACKER is the execution source agents actually read; making it cite the contract's state names verbatim removes the trap at zero semantic risk.

**Implementation steps:** 1. Replace the L-04.2 event list with contract 21 §3's states, citing `docs/contracts/21` §3 by section. 2. Add one line: "أسماء الحالات تتبع العقد 21 حرفيًا؛ عند أي اختلاف يُصحّح هذا الملف."

**Acceptance criteria:** `grep -n "dispatched" docs/expansion/TRACKER.md` returns nothing; L-04.2 lists `source_ready`, `picked_up`, `in_transit`, `arrived_or_completed`.

**Out of scope:** contract 21 itself; any code; any other tracker line.

---

#### [E-06] Align TRACKER L-03.3 listing states with contract 20 §3.3
- Severity: HIGH · Effort: S · Risk: low · Depends on: none

**Root cause:** same as E-05 — tracker invents `under_review`/`submitted`, drops `changes_requested`/`update_required`.

**Options considered**

| Option | Trade-off | Verdict |
|---|---|---|
| Replace tracker's listing machine with contract 20 §3.3 states | none | ✅ chosen |
| Keep both, mark contract authoritative | the tracker is what executors copy from | ❌ rejected |

**Chosen approach and why:** identical reasoning to E-05; one mechanical edit restores the supplier correction loop (`changes_requested → submitted_for_review`) that L-03.3 currently erases.

**Implementation steps:** 1. Replace the L-03.3 state chain with: `draft → submitted_for_review → approved_for_publish | changes_requested | rejected`; `approved_for_publish → paused | archived | update_required`; `changes_requested → submitted_for_review`. 2. Cite contract 20 §3.3.

**Acceptance criteria:** `grep -n "under_review" docs/expansion/TRACKER.md` returns nothing; `changes_requested` present.

**Out of scope:** contract 20; moderation tooling (E-17 is separate).

---

#### [E-07] Re-number E00-EXECUTION-PROTOCOL §2 against TRACKER §2
- Severity: MEDIUM · Effort: S · Risk: low · Depends on: none

**Root cause:** the execution protocol predates tracker items E-00.7…E-00.14 and its contract-to-package assignments drifted.

**Options considered**

| Option | Trade-off | Verdict |
|---|---|---|
| Regenerate the protocol's §2 table from the tracker's current §2 | mechanical, restores the handoff gate | ✅ chosen |
| Deprecate the protocol | removes an active mandatory-reading document without replacement | ❌ rejected |

**Chosen approach and why:** the protocol is mandatory reading (README §4); a stale numbering table mis-scopes PRs, which is exactly its failure mode.

**Implementation steps:** 1. Rebuild the §2 mapping (E-00.2 = 18/23/24+matrix; E-00.3 = 19; E-00.4 = 20; E-00.5 = 21; E-00.6 = 22; E-00.7 = scenarios; …through E-00.14). 2. Add a maintenance rule: "يحدَّث هذا الجدول داخل نفس PR الذي يضيف بند Tracker جديدًا."

**Acceptance criteria:** protocol §2 row set equals tracker §2 row set for every shared package; no contract appears under two packages.

**Out of scope:** tracker content changes beyond E-05/E-06.

---

#### [E-08] Correct HISTORICAL-SOURCES §2 "current decision" column
- Severity: MEDIUM · Effort: S · Risk: low · Depends on: none

**Root cause:** a historical registry kept a live-sounding column header («القرار الحالي») without a sweep after E-00.14 changed the IA; the E-00.14 acceptance review's contradiction sweep missed it.

**Options considered**

| Option | Trade-off | Verdict |
|---|---|---|
| Rename the column to «القرار في حينه (مُلغى)» and fix the Market/Delivery row to the E-00.14 decision | preserves history, kills the false "current" claim | ✅ chosen |
| Delete the row | loses the historical record the doc exists to keep | ❌ rejected |

**Chosen approach and why:** the document's purpose is historical context; marking it as *not current* is both truthful and cheap.

**Implementation steps:** 1. Change the column header to «القرار في حينه — مُلغى بقرار لاحق». 2. Set the Market/Delivery row's value to «السوق في BottomNav بلا صفحة خدمات (E-00.14)» with a link to the IA contract.

**Acceptance criteria:** no cell in HISTORICAL-SOURCES asserts a current decision that contradicts current-state.md §14 or the IA contract.

**Out of scope:** other rows of the historical registry.

---

#### [E-20] Unify the delivery wireframe section naming
- Severity: LOW · Effort: S · Risk: low · Depends on: E-05
**Root cause:** two wireframe sources name the delivery page differently. **Chosen:** make L-00.4 cite the IA contract's section names («تحتاج إجراء» و«طلباتي») verbatim. **Steps:** 1 edit in TRACKER L-00.4. **Acceptance:** both sources use identical section names. **Out of scope:** wireframe content.

#### [E-21] Remove «ممثل مخول» from the expansion glossary Owner row
- Severity: LOW · Effort: S · Risk: low · Depends on: none
**Root cause:** glossary vocabulary seeded ahead of a capability contract 18 explicitly defers. **Chosen:** drop «أو ممثل مخول له داخل Workspace» from the Owner definition; add a pointer to contract 18 §7's delegation deferral. **Acceptance:** glossary Owner row matches contract 18's membership model. **Out of scope:** any delegation design.

---

### Phase 1 — Reversal-blind read paths (the two CRITICALs + their family)

#### [A-01] One derivation for "remaining payable on a commitment"
- Severity: CRITICAL · Effort: M · Risk of the fix: medium (touches three read paths; must not alter any write) · Depends on: none

**Root cause:** `createFinancialReversal` copies the source's `type` and `relatedEventId` onto the reversal (by design — reversals mirror their source). But "how much is still owed on this payable" is computed independently in three places, each with a different (all wrong) treatment of reversal events and reversed settlements. There is no single domain concept of *active* settlements against a commitment.

**Options considered**

| Option | Trade-off | Verdict |
|---|---|---|
| Single domain derivation `activeSettlementsAgainst(payable, events)` excluding (a) reversal events and (b) settlements whose original was reversed; used by all three readers | one rule, one place; no stored-data change; contracts 06/23 already specify this semantics | ✅ chosen |
| Patch each of the three sites with its own filter | fastest per-site; re-creates the divergent-duplication pattern (see A-07/C-04) | ❌ rejected |
| Store a `reversalOfEventId` marker on settlements at write time | changes event shape on new writes only — old reversals stay ambiguous; needs contract + migration thinking | ❌ rejected for this fix (revisit with X-01 migration work) |

**Chosen approach and why:** the defect is a *derivation* defect; the fix belongs in `src/domain/financial-event/` next to the existing summarise logic, consumed by `projectFinancialService.record`, `g5Service.payables`/`listLinkOptions`, and `FinancialEventEditor`. No stored value changes; restored/imported data is healed automatically because the number is derived at read time.

**Implementation steps:**
1. Add `activeSettlementsMinor(payableId, events)` (name per module conventions) to `src/domain/financial-event/policies.ts`: filter events to `type === "payable_settlement_cash" && relatedEventId === payableId`; drop events that are reversals (`correctionOfEventId`/reversal marker as the module already exposes); drop settlements whose own id is reversed by a live reversal event (the module's reversal bookkeeping already knows this — the store enforces it at write time).
2. Unit tests with the exact A-01 sequence: payable 10,000 → settle 6,000 → reverse → remaining **10,000**; settle 10,000 succeeds; settle 16,000+1 rejected.
3. Replace the inline `paid` reduction in `projectFinancialService.ts:827-830` with the domain call.
4. Replace the remaining-computation in `g5Service.ts:216-246` and `listLinkOptions` with the same call.
5. Replace `FinancialEventEditor.tsx:107-124` remaining computation with the same call (via its service).

**Acceptance criteria:** the A-01 reproducer script (Finance position / G5 / editor dropdown) shows remaining 100.00 on all three surfaces after the settlement reversal; the previously-hidden commitment reappears in the editor; settling the full 100.00 succeeds. `pnpm check` green; test count increases (≥ 87 + 264 + new).

**Out of scope:** any change to `createFinancialReversal` or the store's transactional validation (S-03 protected strength); event shape; schema/export versions; contract text.

---

#### [A-03] Reject reversal records and already-reversed payables as settlement sources
- Severity: HIGH · Effort: S · Risk: low · Depends on: A-01 (reuses its active/alive predicate)

**Root cause:** source validation checks only `source.type !== "operating_expense_payable"`; reversals keep the source type, and "already reversed" is never consulted at selection time.

**Options considered**

| Option | Trade-off | Verdict |
|---|---|---|
| Validation: source must be a live (non-reversed) `operating_expense_payable` and not itself a reversal | closes the negative-payable path; reuses A-01's predicate | ✅ chosen |
| Filter the dropdown only | validation stays open to any future caller | ❌ rejected (belt without braces) |

**Chosen approach and why:** the domain rule belongs at validation, the UX filter is a convenience on top. Both use the same A-01 predicate so they cannot disagree.

**Implementation steps:** 1. Extend the `payable_settlement_cash` validation block in `projectFinancialService.record` with the live-source check + Arabic message («اختر التزامًا فعالًا غير معكوس»). 2. Filter `payableOptions` in `FinancialEventEditor` to live payables. 3. Test: settle-the-reversal reproducer now returns `validation_error`; `summarizeFinancialEvents` of the A-03 sequence yields `payableMinor: 0, cashMinor: 0`.

**Acceptance criteria:** the A-03 reproducer cannot produce a negative payable; dropdown lists only live commitments. `pnpm check` green.

**Out of scope:** G5 payables display (A-01 covers), reversal mechanics, messages' broader copy pass (Phase 7).

---

#### [C-01] G5 expense inputs must exclude reversed originals (and not double-count unallocated reversals)
- Severity: CRITICAL · Effort: S · Risk: low · Depends on: none (pattern exists in the same file)

**Root cause:** `expenseInputs` filters on `operatingExpenseDeltaMinor > 0`, which structurally excludes reversal events (negative delta) while keeping the reversed originals; sibling functions in the same file (`payables`, `listLinkOptions`) already implement the correct exclusion, so the filter predates the reversal-awareness pattern.

**Options considered**

| Option | Trade-off | Verdict |
|---|---|---|
| Mirror the `payables()` exclusion: drop originals that have a live reversal, and drop reversal events themselves; for unallocated shares, net the reversal against its original | consistent with the file's own convention | ✅ chosen |
| Net all deltas (sum original + reversal) for fixed expenses | changes semantics when reversal lands in a different period (contract 14 §6 puts reversals in their own period) | ❌ rejected — would cross a documented contract |

**Chosen approach and why:** period-local exclusion keeps the G5 period reading consistent with the G3 period reading (which already nets per contract 14 §6 rules) without re-deriving allocation logic. The unallocated path dedupes by excluding reversed originals so the shared total is never counted twice.

**Implementation steps:** 1. In `g5Service.expenseInputs`, before the delta filter, exclude events with a live reversal and reversal events themselves (same predicate style as `payables()`). 2. Tests: the C-01 reproducer — after reversing the 1000-minor expense, `fixed: 0, margin: 4000, breakEven: 0/غير متاح` per the domain's status rules; unallocated reversal no longer duplicates gap reasons. 3. Add a regression test asserting G5 fixed expenses equal G3's netted figure for the same period on a fixture with reversals.

**Acceptance criteria:** reproducer output changes exactly as specified; a new test pins G5-vs-G3 agreement after reversals; `pnpm check` green.

**Out of scope:** G5 receivables (A-05), break-even labels (L-05), any domain change.

---

#### [A-02] Purchase-receipt quota must exclude reversed receipts *(absorbs C-02)*
- Severity: HIGH · Effort: S · Risk: low · Depends on: none

**Root cause:** `receivePurchase` sums *all* `purchase_receipt` movements for the purchase; reversals are recorded as a separate movement type and never subtract from the quota, so a reversed receipt permanently consumes the receivable allowance.

**Options considered**

| Option | Trade-off | Verdict |
|---|---|---|
| Compute quota from receipts with no live reversal (mirror `readOrderActualMaterialComparison`'s existing reversal handling in the same file) | consistent with the file's own convention; restores the documented correction loop | ✅ chosen |
| Allow quota overflow with a warning | breaks contract 11 barrier 4 | ❌ rejected |

**Chosen approach and why:** the same service already excludes reversed movements in two other readers; the quota check is the outlier. One predicate reuses that handling.

**Implementation steps:** 1. In `inventoryMaterialService.receivePurchase` (line ~296), compute `receivedValue` over receipts that have no live reversal (use the movement-reversal linkage the file's `reverse()` already maintains). 2. Tests: the A-02 reproducer — receive 10,000 → reverse → re-receive 10,000 **succeeds**; receiving beyond the purchase total still rejected. 3. Update the misleading error copy for the genuine-overflow case only if Phase 7 hasn't already (coordinate with L table).

**Acceptance criteria:** reproducer passes; existing quota tests (genuine overflow) unchanged; `pnpm check` green.

**Out of scope:** movement types, reversal write path, contract 11 text.

---

### Phase 2 — G5 semantics before G5 words

#### [A-05] Short-cash receivables must include only real debt
- Severity: MEDIUM · Effort: S · Risk: low · Depends on: none

**Root cause:** `receivables()` filters on `order.receivableMinor > 0`, which every order satisfies from creation (it equals the agreed price), so drafts and un-agreed quotes enter a reading contract 17 restricts to «الطلبات ذات الدين». `financialPulseService` already applies the correct filter.

**Options considered**

| Option | Trade-off | Verdict |
|---|---|---|
| Filter `settlementStatus === "debt"` (same predicate as financialPulse) | two surfaces agree on what a debt is; contract-conformant | ✅ chosen |
| Include delivered-with-remainder (same rule, expressed via receivable>0 AND status delivered) | equivalent outcome, another formulation to keep in sync | ❌ rejected |

**Chosen approach and why:** reuse the pulse predicate verbatim; the sync risk is the whole lesson of the reversal family.

**Implementation steps:** 1. Change the filter in `g5Service.receivables()` to the debt predicate (import/share if it exists in a shared spot; else extract to one helper both services call). 2. Tests: the سارة draft no longer appears in `undatedReceivablesMinor` nor forces `incomplete`; a genuine delivered-with-remainder debt still does.

**Acceptance criteria:** reproducer passes; a new test asserts pulse/G5 receivable agreement across draft/delivered/debt fixtures; `pnpm check` green.

**Out of scope:** the «ذمة»→«دين» copy (Phase 7), G5 expense fixes (Phase 1).

---

#### [L-01] Rename the «إعلان» family to «متوقع» *(after A-05 + C-01 land)*
- Severity: HIGH · Effort: M · Risk: low (copy-only; behaviour untouched) · Depends on: C-01, A-05 (numbers first, words second), glossary sign-off (Appendix B)

**Root cause:** the G5 declaration concept was named from the contract's internal vocabulary («إعلان») instead of the user's mental model (a dated expectation of money in/out); every surface inherited the word, and the derived metric label «بعد المعلن» compounded it.

**Options considered**

| Option | Trade-off | Verdict |
|---|---|---|
| «متوقع» family: «سجّل قبضًا أو دفعًا متوقعًا», «المتوقعات المحلية», «قبض متوقع / دفع متوقع», «الكاش المتوقع» (for بعد المعلن) | everyday word; names the epistemic status honestly (an expectation, not a fact) — aligns with missing ≠ zero | ✅ chosen |
| «موعد» family («موعد قبض») | collides with Schedule's «موعد» vocabulary (L-17/glossary) | ❌ rejected |
| Keep «إعلان», add explanations | the owner's own counter-example says the word is the problem | ❌ rejected |

**Chosen approach and why:** the full row set is in Appendix A (G5DeclarationEditor + Finance + g5Service strings). Honesty check: «متوقع» *narrows* the claim — it says plainly this is an expectation the system does not treat as fact, which is exactly what the code does.

**Implementation steps:** 1. Apply the Appendix A rows for `Finance.tsx:107-114,615,632,1024,1029,1036` and `G5DeclarationEditor.tsx:92,95,157,182,195,202,219` and `g5Service.ts:270,363,371,384,389,401,404,419,435,441`. 2. Keep the truth sentences verbatim otherwise («لن يفترض النظام مواعيد من تلقاء نفسه»). 3. Update contract 17's UI-facing terminology note if it names the screen word (docs wording only, no semantics).

**Acceptance criteria:** `grep -rn "إعلان" apps/prototype-web/client/src --include="*.tsx" --include="*.ts" | grep -v test` returns zero user-visible hits; live Finance screen shows the new labels; `pnpm check` green.

**Out of scope:** G5 arithmetic, declaration entity/fields, contract semantics.

---

### Phase 3 — Interruption safety and editor honesty

#### [U-01] Intercept history navigation; make the unsaved-work promise true *(pairs with L-06)*
- Severity: HIGH · Effort: M · Risk: medium (must not break the existing 3-choice drawer semantics) · Depends on: none

**Root cause:** the guard was built around a single in-app navigation API (`requestNavigation`); browser history navigation (popstate) and app/tab close (beforeunload/pagehide) were never wired, so the primary mobile exit paths bypass the guard entirely.

**Options considered**

| Option | Trade-off | Verdict |
|---|---|---|
| (a) popstate interception: push a sentinel history entry when a form is dirty; on pop, show the same 3-choice drawer; (b) add `pagehide`/`beforeunload` handler for tab close/PWA kill where browsers honour it; (c) fix the L-06 sentence to be truthful regardless | covers the real exits; copy becomes honest even on iOS Safari where beforeunload is ignored | ✅ chosen (all three) |
| Truthful copy only (accept data loss, say so) | honest but leaves the most common interruption path losing money-entry work | ❌ insufficient alone |
| Auto-persist drafts to storage on every keystroke | new storage surface + schema/contract implications; silent-save contradicts the explicit-save model the app teaches | ❌ rejected for this fix (product decision if ever) |

**Chosen approach and why:** the fix follows the app's own philosophy: ask explicitly, never save silently. The sentinel-entry pattern is the standard way to intercept back on the web; the copy fix makes the promise true on platforms where interception is impossible (iOS PWA kill).

**Implementation steps:** 1. In `UnsavedChangesGuard`, on dirty-state entry `history.pushState` a sentinel; on `popstate`, if dirty → `history.pushState` the sentinel back and open the existing drawer; on choose-stay → nothing; on choose-exit → `history.back()` twice (or `navigate(-2)`). 2. Add `pagehide` handler that triggers the same "unsaved changes lost" behaviour browsers allow (beforeunload string where honoured). 3. Reword `UnsavedChangesGuard.tsx:117` per Appendix A (L-06 row): «اختر كيف تتابع. لن يُحفظ شيء تلقائيًا، وإذا أغلقت الصفحة أو التطبيق قبل الحفظ يفقد ما لم تحفظه.» 4. Tests: jsdom test asserting popstate on a dirty guard opens the drawer and does not unmount the form; existing 3-choice tests still pass.

**Acceptance criteria:** the live-app reproducer (back mid-cost-entry → prompt appears; cancel → entries intact) passes on the deployed build; `pnpm check` green; the drawer string contains the honest close caveat.

**Out of scope:** auto-save, storage schema, the editors' internal state model.

---

#### [U-02] Financial event editor: navigate away on success; never let a no-op read as "saved"
- Severity: HIGH · Effort: S · Risk: low · Depends on: none

**Root cause:** one idempotency key per component mount (correct for retry-after-network-failure) combined with stay-on-screen after success (unlike `SupplierPurchaseEditor`) means a second save with edited values is silently treated as a retry. The `reused: true` message is styled like a save confirmation.

**Options considered**

| Option | Trade-off | Verdict |
|---|---|---|
| Navigate away on first success (match `SupplierPurchaseEditor`) + when `reused` ever surfaces, show a warning-styled message stating the edit was NOT saved and pointing to the documented correction path | removes the trap entirely; message becomes a safety net | ✅ chosen |
| Content-derived key (G5 pattern) | an edit creates a SECOND economic event → double-counting; correct for declarations, wrong for cash events | ❌ rejected |
| Disable the save button after first success | user who legitimately wants to record a similar second event is blocked | ❌ rejected |

**Chosen approach and why:** idempotency semantics stay untouched (immutability contract); the UI simply stops offering the misleading second tap, and if it ever occurs the message tells the truth.

**Implementation steps:** 1. After a successful (non-reused) save, navigate to the Finance ledger (match sibling editor's target). 2. Change the `reused` branch message to warning styling: «لم يُحفظ التعديل. هذا الحدث مسجل سابقًا بنفس المفتاح؛ للتصحيح اعكس الحدث الأصلي وسجّل حدثًا جديدًا.» 3. Test: mount → save 5.00 → (auto-navigate); direct second-save scenario (if reachable via tests) shows the warning and stores nothing new.

**Acceptance criteria:** the live reproducer (5.00 → edit to 8.00 → save) can no longer end with the user on the editor believing the edit persisted; `pnpm check` green.

**Out of scope:** idempotency implementation, event shape, other editors.

---

#### [U-04] Kill the English error family at the source
- Severity: MEDIUM · Effort: S · Risk: low · Depends on: none

**Root cause:** `assertNonBlank`-style guards throw English template strings (`` `${field} is required` ``) in five domain modules, while sibling policy errors in the same modules are already Arabic; services pass `error.message` through verbatim.

**Options considered**

| Option | Trade-off | Verdict |
|---|---|---|
| Make the assertion family throw Arabic messages naming the field in user terms (consistent with the domain's existing Arabic error convention, e.g. «لا يمكن توزيع قيمة المادة…»), plus mark the note field required in the editor UI | one convention; no mapping layer to maintain | ✅ chosen |
| Error-code enum + Arabic mapping table at the service boundary | cleaner layering, more machinery; domain already speaks Arabic elsewhere | ❌ deferred (revisit if the domain is ever made UI-free) |

**Chosen approach and why:** the codebase precedent is Arabic domain messages; following it is the smaller, consistent change. UI required-markers prevent the error in the common case.

**Implementation steps:** 1. In `src/domain/{financial-event,supplier-purchase,owner-entitlement,cash-continuity,shared/numeric}/policies.ts`, replace the `is required` / `must be a positive integer` family with Arabic equivalents naming the concept (e.g. «اكتب وصفًا للحدث قبل الحفظ», «أدخل رقمًا صحيحًا موجبًا»). 2. Mark «ما الذي حدث؟» required in `FinancialEventEditor` (asterisk + validation hint). 3. Grep-sweep for remaining English throw strings under `src/domain` and `application/` and Arabize those five modules' set.

**Acceptance criteria:** live expense editor with empty note shows the Arabic message; `grep -rn "is required" src apps/prototype-web/client/src | grep -v test` returns zero; `pnpm check` green (update any tests asserting the English strings).

**Out of scope:** error-code architecture, other message wording (Phase 7).

---

### Phase 4 — Rounding: guard first, then unify

#### [A-07] Finish D-02: one rounding policy, enforced *(absorbs C-04, C-05)*
- Severity: MEDIUM · Effort: M · Risk: medium (touches entitlement amounts by ±1 qirsh in edge cases — see step 5) · Depends on: none · **Precedes A-04**

**Root cause:** D-02's remedy (single policy in `shared/`) was applied to new modules only; the older modules kept local idioms, a page grew its own copy, and the ESLint rule that would freeze the policy was never added. Each copy is correct today only by coincidence of non-negative inputs.

**Options considered**

| Option | Trade-off | Verdict |
|---|---|---|
| (1) Add ESLint `no-restricted-syntax` banning `Math.round`/`Math.floor`/`Math.ceil` outside `src/domain/shared/` (allowlist the shared file); (2) migrate the six call sites to `roundHalfUp`/`floor`-with-reason; (3) move the Catalog per-output-unit preview into the domain function it mirrors; (4) document the entitlement rounding policy | mechanical, testable, ends the drift class | ✅ chosen |
| Migrate call sites only, no lint rule | next contributor reintroduces the idiom | ❌ rejected |

**Chosen approach and why:** the guard is the actual fix; the migrations are its proof. The owner-entitlement hourly case (151 vs 152) changes recorded entitlement by 1 qirsh in the 1-qirsh boundary case — that is a **user-visible meaning change**, so this card requires the contract note *before* migration ships (see §3 grouping): record in the O1 contract/docs that entitlement rounding is half-up minor units.

**Implementation steps:** 1. PR-1 (guard): add the ESLint rule with an explicit allowlist; run `pnpm lint` — expect exactly the 6 existing sites as errors; add them to a temporary inline-allowlist with `TODO(A-07)` markers so lint stays green. 2. PR-2 (craft-order): replace `Math.round` at `craft-order/policies.ts:134,147` with the shared rounding (this is A-04's fix — land here as the first migration). 3. PR-3 (owner-entitlement): replace `Math.floor` and hand-rolled half-up at `policies.ts:520,586,618,662` with shared `roundHalfUp`; add tests pinning 91min×100 → 152; update the O1 documentation note on rounding. 4. PR-4 (Catalog): replace `Catalog.tsx:158` preview math with a call to the domain's per-output-unit allocation (export it if needed) so preview and saved reading share one implementation. 5. Remove the temporary allowlists.

**Acceptance criteria:** `pnpm lint` passes with the rule active and **zero** allowlist markers; `grep -rn "Math.round\|Math.floor" src/domain --include="*.ts" | grep -v shared | grep -v test` returns nothing; Catalog preview equals domain output for a fixture set including the 2.475 boundary; entitlement boundary test pins 152.

**Out of scope:** negative-input semantics (all sites validate non-negative — leave as is); the shared functions themselves (S-05 protected).

---

#### [A-04] Integer-safe material/time cost rounding in craft-order
- Severity: MEDIUM · Effort: S · Risk: low · Depends on: A-07 PR-1 (guard lands first)

**Root cause:** `Math.round(quantity * unitPriceMinor)` computes a money value in float space; at exact `.5` boundaries the float product lands below .5 and rounds down, understating cost by 1 minor unit versus contract 05 §5.3.

**Options considered**

| Option | Trade-off | Verdict |
|---|---|---|
| Compute in integer space: quantities are already milli-integer in inputs — `roundHalfUp(quantityMilli * unitPriceMinor, 1000)` via shared helpers | exact; uses the guarded shared path | ✅ chosen |
| Keep float, add epsilon | trades one float bug class for another | ❌ rejected |

**Chosen approach and why:** the shared `roundHalfUp` exists for exactly this; A-07's guard makes the old idiom a lint error anyway.

**Implementation steps:** 1. Rewrite material line (policies.ts:134) and time line (:147) to integer-milli arithmetic through shared helpers. 2. Tests: `1.005 × 100 → 101`, `0.29 × 50 → 15` (the two executed counter-examples); existing snapshot tests unchanged elsewhere.

**Acceptance criteria:** both counter-examples return the hand-computed values; `pnpm check` green; no snapshot fixture changes beyond the two boundary cases.

**Out of scope:** price floor derivation, knowledge-state logic.

---

### Phase 5 — Small contract-conformance fixes (parallel-safe)

#### [A-10] Enforce contract 10 barrier: reject non-positive transfer amounts at the domain
- Severity: LOW · Effort: S · Risk: low · Depends on: none
**Root cause:** `createCashContinuityEntry` requires only non-zero; the contract's «لا يسمح» was implemented in the editor, not the policy. **Chosen:** domain validation rejects `amountMinor <= 0` for transfers with Arabic message; keep the editor guard. **Steps:** 1 predicate + 2 tests (service-level negative rejected; import of an old balanced negative pair now fails validation — check no legitimate legacy data can contain one, per the import validator's own rules). **Acceptance:** negative transfer impossible via any caller; `pnpm check` green. **Out of scope:** transfer editor UX, import schema.

#### [A-08] Allow `draft → postponed` per contract 02
- Severity: LOW · Effort: S · Risk: low · Depends on: none
**Root cause:** `ALLOWED_TRANSITIONS.draft` was never given the postponement target the contract's table grants from every pre-delivery state. **Chosen:** add `"postponed"` to `draft`'s allowed targets. **Steps:** 1-line change + test (`transitionOrder(draft, postponed)` succeeds; delivery-locked states still reject it). **Acceptance:** new test passes; no other transition changes. **Out of scope:** postponement UI, needs_review rules.

#### [A-09] Compare freshness as Amman-local dates, not UTC instants
- Severity: LOW · Effort: S · Risk: low · Depends on: none
**Root cause:** `Date.parse(priceDate)` (UTC midnight) compared against a UTC instant makes same-day morning snapshots "stale" once any surface sets `freshnessDays`. **Chosen:** compare the snapshot's Amman-local calendar date to the price date using the existing `Intl` Asia/Amman utilities; cutoff = Amman end-of-day. **Steps:** rewrite the comparison + test (priceDate 2026-05-10, createdAt 2026-05-10T01:30Z → `known` at freshnessDays 0; yesterday's price → `stale`). **Acceptance:** test passes; no current test depends on the old behaviour (field is latent — all surfaces null). **Out of scope:** exposing freshnessDays in UI, contract 03 wording.

#### [C-03] Call the domain's `calculateBreakEven` from the application layer
- Severity: MEDIUM · Effort: S · Risk: low · Depends on: none
**Root cause:** the coverage card re-implemented the formula locally, without the safe-integer guards and invalid-status honesty the domain version carries. **Chosen:** replace the arithmetic at `projectFinancialService.ts:601-604` with a call to `calculateBreakEven` (or a thin wrapper exported for this use), propagating `status: invalid` + reason instead of a silent number. **Steps:** swap implementation; map the invalid status to the existing «غير متاح + سبب» display path; tests: overflow fixture returns null/invalid, not a number. **Acceptance:** no local `Math.ceil` on the ratio remains; overflow case renders «غير متاح» with reason. **Out of scope:** G5 policy internals, coverage UI copy.

#### [C-06] Move the persistent-storage access out of the Settings page
- Severity: LOW · Effort: S · Risk: low · Depends on: none
**Root cause:** the page imported the storage-layer module directly because the boot-time wrapper was the only surface; the lint boundary guard bans adapter names only. **Chosen:** expose the persistence status/request through an application-level service (e.g. extend the preferences service), page imports only the service; extend the ESLint boundary rule to ban `@/storage/local/*` imports from `pages/**` (allowlist `app/` boot wiring). **Steps:** 1 service method + 1 import change + lint rule + tests. **Acceptance:** `grep -rn "storage/local" apps/prototype-web/client/src/pages` returns nothing; lint enforces it. **Out of scope:** StartupGate boot wiring, storage module itself.

---

### Phase 6 — UX completeness (each card independent)

#### [U-05] Validate the month range inline, keep Finance alive
- Severity: MEDIUM · Effort: S · Risk: low · Depends on: none
**Root cause:** range validation was modelled as a screen-level load failure (the error path for unreadable data) instead of a field-level constraint, so a filter typo nukes the whole surface. **Options:** inline error next to the two inputs + keep last-valid range rendered (chosen) vs whole-page error (status quo, rejected) vs auto-swap months (surprising, rejected). **Steps:** move the check beside the inputs; render a scoped message «اختر نطاقًا يبدأ قبل نهايته»; keep the previous valid reading on screen. **Acceptance:** live: inverting «من»/«إلى» shows inline message, month fields remain editable, rest of screen stays; recovery is one tap. **Out of scope:** period semantics, G5.

#### [U-06] Pass the quick-action intent through
- Severity: MEDIUM · Effort: S · Risk: low · Depends on: none
**Root cause:** `handleQuickAction` maps both intents to `/orders/new` without a parameter; NewDraft re-asks. **Options:** route param `?intent=` consumed by NewDraft (chosen); remove the duplicate choice from the sheet (alternative — pick at product sign-off with L-16 glossary); do nothing (rejected). **Steps:** add param, preselect intent in NewDraft, test both entries. **Acceptance:** FAB → «مسودة تصميم» lands on NewDraft with that option preselected; one tap and one screen saved. **Out of scope:** sheet contents (U-07).

#### [U-07] Add expense, purchase, and material actions to the quick sheet
- Severity: MEDIUM · Effort: S · Risk: low · Depends on: U-06 (same file), owner nod on sheet composition
**Root cause:** the sheet was scoped to the order family while the product's recording disciplines span five families; the other actions live behind Finance's collapsed layer. **Options:** add the three deep links («سجل مصروفًا مدفوعًا», «سجل شراء مواد», «مادة ورصيد بداية») — all routes exist (chosen); reorganize Home modules (bigger, G21 scope); do nothing (rejected — completeness of the ledger is the product's pitch). **Steps:** three sheet entries routing to existing deep routes; keep the sheet's own one-action-per-row rule; visual QA at 360. **Acceptance:** expense recording reachable in ≤2 taps from anywhere; sheet still fits 360×800 without scroll. **Out of scope:** new screens, Home module visibility rules.

#### [U-08] Give drafts a documented dismissal path and deprioritize them below money
- Severity: MEDIUM · Effort: M · Risk: low · Depends on: owner decision on mechanism (archive-with-reason vs delete)
**Root cause:** drafts were made instant to create (one tap) without the symmetric "not pursuing" exit, and attention priority was assigned by recency-of-intent (drafts first) rather than money-at-stake. **Options:** (a) «إلغاء المسودة» with a reason, logged, following the no-silent-delete principle (chosen — matches the product's correction philosophy); (b) hard delete (rejected — silent loss); (c) attention reorder only (insufficient). **Steps (after owner nod):** 1. `draftService.archiveDraft(id, reason)` + storage append; 2. Orders/DraftEditor entry point with confirm + reason; 3. archived drafts excluded from attention, visible under a collapsed «ملغاة» list; 4. reorder attention priorities debt(15)/cost(20) above drafts(10) → drafts last. 5. Tests: attention excludes archived; three archived drafts + one debt → debt visible in top-3. **Acceptance:** the live abandoned-draft scenario clears from Home in 2 taps; debt outranks drafts. **Out of scope:** order cancellation (U-03), schema versions (draft status field must ride an existing store shape decision — if a schema bump is required, this card stops and routes through the migration gate).

#### [U-09] Fix the two sub-44px touch targets
- Severity: MEDIUM · Effort: S · Risk: low · Depends on: none
**Root cause:** `.micro-period-range-fields input` lacks the min-height the standard fields have; `.micro-text-action` is width:fit-content with no minimum. **Steps:** add `min-height: 48px` to the period inputs (match `.micro-field input`); add `min-width: 48px; padding-inline` to `.micro-text-action`. **Acceptance:** measured boxes ≥44×44 at 360/390/430 for both controls (re-measure with the same agent-browser method); no visual regression at 430. **Out of scope:** other controls (sweep found none).

#### [U-10] Persist the install-banner dismissal
- Severity: MEDIUM · Effort: S · Risk: low · Depends on: none
**Root cause:** `isDismissed` is component state; the pattern for durable preferences (LocalPreferences) already exists. **Steps:** persist dismissal with a re-show policy (e.g. re-show after 30 days or after a version change — pick with owner; default 30 days); render nothing when dismissed. **Acceptance:** dismiss → reload → banner absent; after the re-show window it may return once. **Out of scope:** install prompt triggers, PWA plumbing.

#### [U-11] Text-label the backup actions
- Severity: LOW · Effort: S · Risk: low · Depends on: none
**Root cause:** the safest actions in the app use the least legible affordance (icon-only), inside a collapsed layer. **Steps:** replace the icon buttons in `StorageRow` with text buttons «تصدير» / «استيراد» (icon optional alongside); keep aria-labels; consider defaulting the data layer open (small product nod). **Acceptance:** live: both actions show Arabic labels at 360px; tap targets ≥44px. **Out of scope:** P-01 layers 1–3 (prior plan owns cadence/reminders).

#### [U-03] Expose order cancellation in OrderDetail *(owner decision gate, then M effort)*
- Severity: HIGH · Effort: M · Risk: medium (touches the lifecycle surface; deposit settlement must follow contract 02 exactly) · Depends on: **owner sign-off on scope**
**Root cause:** the UI was built along the happy lifecycle only; the domain's `cancelOrder` (with deposit settlement handling) and contract 02's cancellation path were never surfaced, unlike every other record family which got reversal editors. **Options:** (a) expose «إلغاء الطلب» from any pre-delivery status with reason + explicit deposit-settlement choice (refund-taken / keep-as-credit per contract rules) (chosen, contract-conformant); (b) also add price/deposit correction post-agreement (deferred — needs a correction contract decision; record as open question); (c) document the deferral only (rejected: the ledger keeps wrong orders forever). **Steps (after sign-off):** 1. OrderDetail action when status is pre-delivery; 2. confirm drawer states deposit handling verbatim from contract 02; 3. `fulfillmentService`/`agreementService` pass-through to domain `cancelOrder`; 4. tests: cancel with taken deposit settles per contract; cancelled order leaves attention and receivables; history immutable. **Acceptance:** the wrong-price scenario ends in a cancelled order with documented deposit settlement, gone from «لي عند العملاء». **Out of scope:** post-delivery correction (needs_review flows), price revision (open question).

---

### Phase 7 — Language pass (after glossary sign-off; Appendix A is the spec)

*Cards are compact; the Appendix A table is the authoritative per-string spec. Every card obeys the hard constraint: no wording widens what the system claims — where fluency and honesty conflict, the heavy-but-truthful wording stays (noted per row).*

#### [L-02] Purge English tokens from user-visible sentences
- Severity: HIGH · Effort: M · Risk: low · Depends on: glossary sign-off
**Root cause:** truth-lines were written from code identifiers (COGS, Snapshot, final, G5, G3, O1, Prototype, JSON, Store, milli, route names) instead of the glossary's Arabic terms; the app already owns Arabic names for most («تكلفة البيع المسجلة» in Finance.tsx:313, «نسخة التكلفة» in CostEditor). **Chosen:** mechanical replacement per Appendix A rows (≈40 locations) reusing the app's own existing Arabic names; «هذا الإصدار» for Prototype/internal codes. **Acceptance:** `grep -rnE "COGS|Snapshot|final|yield|G5|G3|O1|Prototype|JSON|immutable|Store|milli|basis points" apps/prototype-web/client/src --include="*.tsx" --include="*.ts" | grep -v test | grep -v "^.*//" ` returns no user-visible sentence (allowing code identifiers in code); live truth-lines fully Arabic. **Out of scope:** identifier names in code, contracts' internal terminology.

#### [L-03] Replace raw IDs/enums with names and Arabic statuses
- Severity: HIGH · Effort: S · Risk: low · Depends on: none (can precede glossary)
**Root cause:** `src/domain/g5/policies.ts:193-218` builds user sentences with `order.id` and raw `resultStatus` — the domain layer producing UI copy; OwnerEntitlement shows UUID fragments. **Chosen:** use `order.itemName` (fallback «طلب بلا وصف») and map resultStatus → «نهائية/تقديرية/غير مكتملة/تحتاج مراجعة»; drop chain/ID fragments from OwnerEntitlement (version + dates already shown); keep the audit link via navigation, not printed IDs. **Steps:** edit the four domain string builders (or move string construction to presentation — preferred long-term, see note); OwnerEntitlement rows. **Acceptance:** live G5 exclusion line reads «الطلب «صندوق خشبي» مستبعد لأن نتيجته تقديرية.»; no UUID renders to the user anywhere. **Out of scope:** ID display in Settings diagnostics (if any — verify none), audit storage format. *Note: moving sentence-building out of `src/domain` is the structural fix; if done, do it in this PR, else record as follow-up.*

#### [L-04] «المحتسب عند التسليم» replaces recognition jargon
- Severity: HIGH · Effort: S · Risk: low · Depends on: glossary sign-off
**Root cause:** accounting-recognition vocabulary («الإيراد المعترف به») states the delivery-timing boundary in a dialect the audience lacks. **Chosen:** «المحتسب عند التسليم — السعر / التكلفة» (OrderDetail.tsx:307-310, Review.tsx:85,92, recurringWorkService.ts:527) — preserves the counted-at-delivery ≠ collected-cash boundary verbatim in operational words. **Acceptance:** grep for «معترف» in user strings returns zero; boundary sentence survives («محتسب عند التسليم، وليس ما قبضته»). **Out of scope:** recognition timing itself (verified correct).

#### [L-05] Finance period/margin/break-even headings in shop words
- Severity: HIGH · Effort: M · Risk: low · Depends on: glossary sign-off
**Root cause:** textbook accounting names on the most dangerous numbers; the contract's own public name («نتيجة الفترة المسجلة») is already the correct label. **Chosen:** per Appendix A: «نتيجة الفترة المسجلة» (heading), «الهامش بعد الكلفة المباشرة», «كم وحدة تغطي المصاريف الثابتة», «الكلفة المباشرة للطلبات النهائية» / «المصاريف الثابتة المسجلة»; drop «المفككة» noise; keep «المزيج المسجل» only as the fallback-scale note. **Acceptance:** live headings match the glossary; no «صافي الربح» framing anywhere except where contract-mandated context lines (verify none — the contract forbids it). **Out of scope:** the numbers, their statuses, truth sentences' content.

#### [L-07] «توزيع» replaces «تحميل» for allocation
- Severity: MEDIUM · Effort: S · Risk: low · Depends on: glossary sign-off. **Root cause:** internal vocabulary for shared-expense allocation reads as "download". **Chosen:** swap the family per Appendix A (Catalog + Finance + FinancialEventEditor, ≈20 locations). **Acceptance:** grep «محمل|تحميل» in user strings returns zero (excluding genuine download contexts — verify none). **Out of scope:** allocation arithmetic.

#### [L-08] «حق المالك» everywhere (retire «استحقاق»)
- Severity: MEDIUM · Effort: S · Risk: low · Depends on: glossary sign-off. **Root cause:** two names for one concept, one of them jargon. **Chosen:** per Appendix A (≈20 OwnerEntitlement locations + Finance card labels). **Acceptance:** grep «استحقاق» in user strings returns zero. **Out of scope:** policy semantics, «خليفة» vocabulary (L-13).

#### [L-09] «دين» retires «ذمة»
- Severity: MEDIUM · Effort: S · Risk: low · Depends on: glossary sign-off. **Root cause:** accounting receivables term survives in four strings beside the app's canonical «دين مسجل». **Chosen:** four replacements (homeControlCenterService ×2, ActualTimePanel, g5Service). **Acceptance:** grep «ذم» in user strings returns zero (verify no false positives). **Out of scope:** debt semantics (A-05 owns the numbers).

#### [L-10] Canonical «الخطوة التالية»
- Severity: MEDIUM · Effort: S · Risk: low · Depends on: none. **Chosen:** replace «الفعل التالي» (≈7 locations) with «الخطوة التالية». **Acceptance:** one variant remains. **Out of scope:** the guidance content itself.

#### [L-11] «حالة الرقم: مؤكد / تقديري» replaces «درجة المعرفة»
- Severity: MEDIUM · Effort: S · Risk: low · Depends on: glossary sign-off. **Root cause:** the honesty control's label sounds like a school grade; «معروف» is odd for numbers. **Chosen:** label «حالة الرقم», options «مؤكد / تقديري», across CostEditor, FinancialEventEditor, G5DeclarationEditor, OrderDetail reference. **Acceptance:** all four surfaces use one wording; knowledge-state semantics untouched. **Out of scope:** KnowledgeState domain enum (internal).

#### [L-12] «تراجع موثق» replaces «عكس موثق»
- Severity: MEDIUM · Effort: M · Risk: low · Depends on: glossary sign-off. **Root cause:** «عكس» doesn't carry "keep the original, cancel the effect". **Chosen:** family swap per Appendix A across Finance/Cash/Inventory/ActualTime/OwnerEntitlement/G5 (≈30 locations); the confirm dialogs' excellent explanations stay verbatim. **Acceptance:** grep «عكس» in user strings returns zero (excluding unrelated uses — verify). **Out of scope:** reversal mechanics (protected S-03).

#### [L-13] Owner-entitlement page: «نسخة جديدة» retires «خليفة/السلسلة/قفل»
- Severity: MEDIUM · Effort: S · Risk: low · Depends on: L-08. **Chosen:** per Appendix A — reuse the page's own plain explanation («تنشأ نسخة جديدة بإعداداتك الجديدة»); replace «قفل الفترة» rules with their actual sentences («لا يُسجل الحق نفسه للفترة نفسها مرتين»). **Acceptance:** grep «خليفة|السلسلة|قفل» in user strings returns zero. **Out of scope:** successor semantics (verified intact).

#### [L-14] Home naming unified to «مشروعي الآن»
- Severity: MEDIUM · Effort: S · Risk: low · Depends on: none. **Chosen:** nav label wins; loading/error/truth copy drops «مركز قيادة/قراءة قيادة»; fix the ungrammatical «السعة غير حكم رفض تلقائي» → «السعة تحذير فقط، وليست رفضًا تلقائيًا». **Acceptance:** one Home name across nav/overline/loading/error. **Out of scope:** Home content structure.

#### [L-15] Readable dates everywhere
- Severity: MEDIUM · Effort: S · Risk: low · Depends on: none. **Root cause:** raw ISO strings render where `formatLocalDate(Long)`/`formatMonthLabel` exist and are used elsewhere. **Chosen:** route the ≈10 identified spots through the existing formatters; wrap any remaining numeric dates in `<bdi dir="ltr">`. **Acceptance:** grep `-20[0-9]{2}` in rendered user strings (Home/Finance/Catalog) returns zero; dates read «28 آب 2026». **Out of scope:** date input/storage formats.

#### [L-16] One name per action-concept
- Severity: MEDIUM · Effort: M · Risk: low · Depends on: glossary sign-off, U-06. **Chosen:** «طلب من عميل» (kill «طلب مخصص»); «تسجيل الاتفاق» + «احفظ الاسم» (تثبيت reserved for app install); «نسخة جديدة» for template revisions («مراجعة» reserved for the Review tab); «حدث مالي» (kill «الواقعة»). **Acceptance:** each concept greps to one name across pages/components/services. **Out of scope:** nav labels already consistent.

#### [L-17] Kill invented/internal words
- Severity: MEDIUM · Effort: S · Risk: low · Depends on: none. **Chosen:** «مواعيد قادمة» replaces «ظهورات» (×12, Schedule); «لا يمكن إخراج كمية أكبر من المتاحة» replaces «الشريحة»; «هذه الحالة موقوفة للمراجعة؛ راجع الطلب قبل أي خطوة مالية» replaces «الحارس»; delete the invented-archive claim in CashReversalEditor («قد يكون السجل حُذف من هذا الجهاز أو عُكس سابقًا» — coordinate with L-12 wording); Setup «حرفة مخصصة» → «مشغل حرفي». **Acceptance:** grep «ظهور|الشريحة|الحارس|أُرشف» in user strings returns zero. **Out of scope:** recurrence semantics.

#### [L-18] Arabic plurals through the helper
- Severity: LOW · Effort: S · Risk: low · Depends on: none. **Chosen:** route the four count templates through `formatArabicPlural`. **Acceptance:** «أثران محفوظان» renders at n=2. **Out of scope:** helper itself.

#### [L-19] Long-button diet
- Severity: LOW · Effort: S · Risk: low · Depends on: L-01, L-08, L-17 (their renames shorten most offenders). **Chosen:** apply the shortened labels from Appendix A; verify single-line render at 360. **Acceptance:** no primary button exceeds ~28 chars at 360px. **Out of scope:** button behaviour.

---

### Phase 8 — Expansion specification and decisions (documents/decisions, no product code)

#### [E-09] Extend the field dictionary (contract 24) to cover all defined entities
- Severity: HIGH · Effort: M · Risk: low (docs) · Depends on: none
**Root cause:** contract 24 enumerates 14 entities but contracts 18–21 define 20; the six missing include the failure-path record and the decision record. **Chosen:** add dictionary rows for `network_invitation`, `network_access_decision`, `external_reference`, `recording_suggestion`, `delivery_exception`, `market_decision`; add the «مستوى إلحاح مبرر» field to `network_attention` (or record the deliberate omission with the reason). **Steps:** draft rows with classification answers per contract 24's own template; cross-check each against its defining contract. **Acceptance:** every entity named in contracts 18–21 has a dictionary row or an explicit deferral note. **Out of scope:** any schema/code.

#### [E-01] Decide and specify the courier-silence path *(owner decision X-06 + spec)*
- Severity: HIGH · Effort: M (spec) · Risk: n/a (docs) · Depends on: owner decision
**Root cause:** the delivery contract covers every courier *action* but not courier *silence*; the historical spec's re-request loop was dropped without replacement. **Options (owner):** (a) request-level expiry after N hours → auto-state «لم تصل عروض» with explicit next actions (re-request / cancel / try another courier) — honest, matches missing ≠ zero; (b) manual-only cancel, no expiry — simplest, but the waiting state stays ambiguous; (c) broadcast with deadline pressure to couriers — changes the routing model (couples to E-03). **Chosen:** record the owner's pick as a contract 21 amendment + TRACKER update; write the timeout state, actor, transitions, and requester-facing copy («لا يوجد عرض حتى الآن — بيان مسجل، وليس عدم اهتمام»). **Acceptance:** the state machine text has an exit from every waiting state; grep «لم ترد/timeout/مهلة» finds the rule. **Out of scope:** implementation.

#### [E-02] Complete the delivery transition matrix with actors and exits *(spec)*
- Severity: HIGH · Effort: M · Risk: n/a (docs) · Depends on: E-01 (silence state feeds the matrix)
**Chosen:** extend contract 21 §3 with a full matrix (state × event → next state, actor, guard); define `delivery_exception` classification/status enums (coordinate with E-09); restore the historical re-request loop («إعادة المهمة إلى تحتاج عرضًا جديدًا»); define the dispute exit from `arrived_or_completed` (who asserts, who arbitrates, what evidence, what state results). **Acceptance:** every state has ≥1 exit or is explicitly terminal-with-reason; "both claim completion" is representable. **Out of scope:** dispute product policy (owner records preference).

#### [E-03] Decide request routing and define the courier profile entity *(owner decision + spec)*
- Severity: HIGH · Effort: M · Risk: n/a (docs) · Depends on: owner decision
**Options (owner):** (a) owner selects a courier from a directory (needs the profile entity: coverage area, service description, status); (b) broadcast to all wedge couriers (needs a visibility/competition rule — do couriers see each other's quotes?); (c) single courier per wedge (needs the dependence risk accepted explicitly, see E-12/unconsidered). **Chosen:** record the decision; add the courier-profile entity to contracts 21/24 accordingly; write the routing field on `delivery_request`. **Acceptance:** ROLE-ACCESS-MATRIX's «يرى ما وصل لجهته» is defined by a routing rule, not by implication. **Out of scope:** courier acquisition (X-05).

#### [E-04] Specify quote lifecycle rules
- Severity: HIGH · Effort: S (spec) · Risk: n/a (docs) · Depends on: E-14 (money representation)
**Chosen:** define: quote expiry behaviour (state + notification + extension rule), withdrawal windows (before/after acceptance), multi-quote cardinality and comparison UI rules, post-acceptance price change (new quote + owner re-consent, never silent). **Acceptance:** the four questions each have a rule a test could check. **Out of scope:** negotiation UX.

#### [E-10] Close the response contact loop
- Severity: HIGH · Effort: S (spec) · Risk: n/a (docs) · Depends on: owner decision (unlisted suppliers responding?)
**Options (owner):** (a) responses carry a moderated contact channel copied from the listing (chosen-candidate); (b) only suppliers with approved listings may respond (simplest, coldest start); (c) owner-contact-only via listing (status quo — trail goes cold). **Chosen:** record the decision; extend `market_response` fields in contract 24; extend moderation scope in contract 22 if (a). **Acceptance:** the accepted-response flow has an actionable next step and no unmoderated free-text channel. **Out of scope:** chat.

#### [E-11] Consent for the third-party data subject + owner-preview parity *(owner + legal)*
- Severity: HIGH · Effort: M · Risk: n/a (docs) · Depends on: E-18 (legal scope)
**Chosen:** (1) contract 24 §2 rule changes from «موافقة Owner أو طالب الحركة» to: consent of the data subject's *side* — owner consents for customer data; the receiving side consents for its own; supplier-requested deliveries to the owner require the owner's preview explicitly. (2) Add a consent record entity (E-13). (3) Defer customer-side consent mechanics to the legal review with an explicit open question. **Acceptance:** no flow remains where one party's consent exposes another party's contact data without their side's preview. **Out of scope:** in-app consent UX (Pilot B).

#### [E-12] Abuse controls decision *(owner decision, gate A prerequisite)*
**Chosen:** record rate limits (needs/responses/quotes per party per day), duplicate detection, and courier read-auditing of `delivery_scoped` data (add read events to contract 22 §4's audit list) as gate-A requirements in the readiness gate doc. **Acceptance:** ACTIVATION gate A lists them as blocking. **Out of scope:** implementation.

#### [E-13] Consent record entity *(spec, cheap)*
**Chosen:** add a `consent_record` entity (who, scope, subject ref, at, until, revoked-at) to contract 24 (fills E-09's gap simultaneously); retention content stays deferred to legal. **Acceptance:** dictionary row exists with lifecycle. **Out of scope:** retention policy numbers.

#### [E-14] Network money representation *(spec)*
**Chosen:** write the deferred currency/rounding mini-contract before any DTO: JOD minor units reusing `MoneyMinor` semantics (integer, no float) unless the owner explicitly wants multi-currency; quote ranges documented as two minor-unit bounds. **Acceptance:** contract exists; grep «يحدد عقد العملة/التقريب لاحقًا» replaced by a link. **Out of scope:** Manage money types (frozen).

#### [E-15] Decide L-phase storage location and draft export scope *(owner/architecture decision)*
**Options (owner):** (a) separate IndexedDB database for network data — honors the migration gate, drafts excluded from core export (must then be honestly documented in the SOP); (b) same DB with schema bump — breaks the gate's promise, requires full migration contract; (c) same DB, no version change via separate object stores — not possible safely, reject. **Chosen:** record decision; update MANAGE-NETWORK-MIGRATION-EXPORT-GATE + TRACKER L-01.2 + the SOP to agree with it. **Acceptance:** the three documents state one storage truth; the SOP's restore drill matches what export actually contains. **Out of scope:** implementation.

#### [E-16] Need auto-expiry and the honest zero-response state *(spec)*
**Chosen:** define the need's window-elapsed transition (actor + timing + state «انتهت نافذة النشر»), the zero-responses honest state («لا ردود بعد — بيان، لا حكم»), and the `market_response → expired` trigger. **Acceptance:** no immortal `published` needs; the liquidity signal E-00.13 wants is representable. **Out of scope:** notification plumbing (E-19).

#### [E-17] Listing lifecycle exits + backlog policy *(spec + owner decision)*
**Chosen:** draw `rejected → submitted_for_review` (resubmit path), `paused ↔ approved_for_publish`, `update_required → submitted_for_review`, add `expired`; give `listing_media` a state machine; record the moderation backlog expectation (review-time target, escalation at threshold) as a Pilot-B requirement — the tooling stays deferred, the *policy* does not. **Acceptance:** every listing state has an exit; backlog policy documented. **Out of scope:** moderation tooling (deferred by contract 22 §1).

#### [E-18] Enumerate the Jordan legal review domains *(owner + counsel)*
**Chosen:** expand OR-O04 into a named checklist: consumer protection, e-commerce law, personal data protection, courier/delivery licensing, supplier tax implications, marketplace intermediary liability. **Acceptance:** the gate names the domains; owner schedules counsel. **Out of scope:** the legal opinions themselves.

#### [E-19] Enumerate notification types and triggers *(spec)*
**Chosen:** add the type/trigger table to contract 19 (or a companion annex): at minimum quote-received, quote-expiring, quote-expired, response-received, status-changed, moderation-decision, attention-promotion; dedup rules; deep-link targets. **Acceptance:** S-15A testable; every state transition that requires a notification has one. **Out of scope:** push infrastructure.

---

## 2. Execution order and dependency graph

```text
PHASE 0 (docs, today)      E-05 → E-20   E-06   E-07   E-08   E-21
                             (parallel; zero code risk; unblocks every agent reading the tracker)

PHASE 1 (money read-paths)  A-01 ──→ A-03
                            C-01   A-02        (parallel with A-01; independent files)
PHASE 2 (G5 semantics)      A-05 ──→ L-01      (numbers before words on the same screen)
PHASE 3 (entry honesty)     U-01+L-06   U-02   U-04        (independent; U-02 before Phase 7 touches its message)
PHASE 4 (rounding)          A-07(PR-1 guard) ──→ A-04 ──→ A-07(PR-2/3/4 migrations)
PHASE 5 (small conformance) A-10   A-08   A-09   C-03   C-06      (all parallel; each < half day)
PHASE 6 (UX)                U-05 U-06 → U-07   U-09 U-10 U-11   U-08*   U-03*
PHASE 7 (language)          glossary sign-off ──→ L-03 ──→ {L-01†, L-02, L-04, L-05, L-07..L-17} ──→ L-18, L-19
PHASE 8 (expansion)         E-09 E-13 E-14 E-19 (specs, parallel)
                            owner decisions: X-06/E-01 → E-02 → E-03 → E-04 ;  E-10 E-11(+E-18) E-12 E-15 E-16 E-17
                             † L-01 also depends on C-01 + A-05 (Phase 1–2)
                             * U-03, U-08 execute only after owner sign-off (§3 group C)
```

**Ordering constraints and their reasons**

1. **Phase 1 before everything user-visible on money:** A-01/A-03/C-01/A-02 are read-path-only fixes to wrong numbers — highest user impact, zero stored-data risk, and every later screen copy pass (Phase 7) would otherwise polish sentences around numbers we know are wrong.
2. **A-01 before A-03:** A-03's validation reuses A-01's "live settlement/payable" predicate; building it twice recreates the divergent-duplication defect class this review found four times.
3. **A-05 before L-01:** renaming «إعلان» on a screen whose receivables still count drafts would rebrand a wrong number; fix the arithmetic, then the name (both land within days of each other).
4. **U-02 before Phase 7:** the language pass rewrites the «محفوظ سابقًا» message family; its final wording depends on U-02's behaviour fix.
5. **A-07 (guard PR) before A-04 (logic):** the prior review's own lesson (D-01 before D-02) — never mix a mechanical sweep with a behavioural change; the guard first makes every subsequent migration a small reviewable diff and a lint error if reverted.
6. **C-01 before any G5-dependent expansion work:** the expansion's honesty guarantees cite G5-style separation; building on a reversal-blind reader bakes the defect into new surfaces.
7. **E-05/E-06/E-07/E-08 before any expansion slice:** every L-phase agent reads the tracker and protocol as execution sources; fixing the maps is the cheapest de-risking in the whole plan.
8. **X-06/E-01 decision before any Delivery build:** without the silence state, the wedge's core flow has a dead end by construction.

---

## 3. Grouping by authorisation

### Group A — Safe to execute immediately (no contract change, no stored-data change, no product decision)

A-01, A-03, C-01, A-02, A-05, U-01, U-02, U-04, U-05, U-06, U-09, U-10, U-11, C-03, C-06, A-10, A-08, A-09, E-05, E-06, E-07, E-08, E-20, E-21, L-03 (raw IDs/English enums — no glossary dependency), L-15 (readable dates — formatters exist), L-18 (plural helper).

*Rationale: all are read-path derivations, UI wiring, CSS, or documentation corrections that conform code/docs to already-governing contracts. None changes a stored value, a schema/export version, or the meaning of a number.*

### Group B — Requires a written contract/documentation change FIRST (changes user-visible meaning of a number, or stored/derived data shape)

- **A-07** (owner-entitlement rounding 151→152 in the boundary case is a user-visible meaning change → record the half-up policy in the O1 documentation/contract note before PR-3 lands; PR-1 guard and PR-2 craft-order migration are Group A).
- **A-06** (see §1 Phase-note below — relaxing the dust-trap guard changes when consumption is permitted → amend contract 11's wording first).
- **U-08** (draft dismissal adds a lifecycle state → mini-spec in docs; if it needs a schema change it stops at the migration gate).
- **U-03** (exposing cancellation changes what the owner can do to an order → contract 02 already documents it, but the deposit-settlement drawer copy must be written into the spec first).
- **L-01, L-02, L-04, L-05, L-07, L-08, L-09, L-11, L-12, L-13, L-16** (term-system changes → the glossary (Appendix B) must be signed off as a docs artifact first; contracts 17/14 wording notes where they name UI terms).
- **E-09, E-13, E-14, E-19** (spec writing = contract amendments by definition).
- **A-04** (Group A technically — contract 05 §5.3 already mandates the correct rounding — but sequenced behind A-07's guard; treat as A with a dependency).

### Group C — Product decisions requiring the owner; NO code until decided

1. **X-06 / E-01** — courier silence policy (blocks Delivery).
2. **E-03** — request routing model (blocks Delivery).
3. **U-03** — expose order cancellation now vs document deferral (recommendation: expose — it is contract-supported and closes the ledger's biggest hole).
4. **U-08** — draft dismissal mechanism (recommendation: cancel-with-reason).
5. **Glossary adoption** (Appendix B) — one sign-off unlocks eleven L-cards.
6. **X-05 / E-10** — supplier acquisition, response contact loop (blocks Market slice).
7. **E-11 + E-18** — consent model + Jordan legal review scope (before any real party's data).
8. **E-12** — abuse-control requirements at gate A.
9. **E-15** — network storage location + draft export scope.
10. **Prior-plan open decisions, unchanged:** X-01 (second-profile migration path), X-03 (wedge selection), X-04 (profile exit), D-04 (surface multiple knowledge deficiencies — owner picks the UX), P-01 layers 1–3 (backup cadence UX), G-01/G-03 (governance volume / CI architecture tests).

> **A-06 note (deliberately not carded above at full length):** the dust-trap fix must change *when consumption is allowed* (accept the rounded value even when it equals the remainder, with a declared over-consumption path, or allow sub-minor remainders) — that is contract 11 policy territory. Recommended path: owner picks between "allow consuming to exactly the remaining value with reason" vs "keep refusal but fix the error message to state the boundary and next action". Until decided, only the error message may change (Group B, message-only).

---

## 4. Guardrails (apply to EVERY fix, no exceptions)

1. **The five financial boundaries** — `collection ≠ profit`, `debt ≠ cash`, `purchase ≠ COGS`, `owner money ≠ sale/expense`, `missing ≠ zero`. Any fix that improves usability by blurring one is rejected regardless of its other merits.
2. **No historical value changes.** Every Phase-1 fix is a read-path derivation change. Stored events, snapshots, and orders keep their recorded values; import/restored data heals automatically because the numbers are derived at read time.
3. **No silent deletion.** No fix introduces delete-without-trail; U-08's draft dismissal and U-03's cancellation both carry reasons and leave history.
4. **The write path of reversals is a protected strength (S-03).** Phase-1 fixes must not touch `createFinancialReversal`, the store's transactional validation, or any `reverse()` implementation. If a Phase-1 fix seems to need a write-path change, stop and re-scope.
5. **No `localSchemaVersion`/`localExportVersion` bump** in any Group-A fix. If a fix seems to need one, it is misgrouped — route it through the migration gate and a contract first.
6. **No format+logic mixing.** A-07's four PRs exist precisely to keep the mechanical sweep separate from behavioural changes; the same discipline applies to the L-phase string sweep (one PR may carry one glossary family, never copy + behaviour).
7. **One finding (or one homogeneous family) per PR**, with the finding ID in the description; a second problem found mid-implementation gets a new ID and its own PR.
8. **`pnpm check` green before every push** — and the test count never decreases: current floor is **87 + 264 tests** plus every new test this plan adds.
9. **No field-acceptance claims.** Sandbox/browser QA success is never reported as device/production/Pilot acceptance.
10. **Honesty outranks fluency in every L-card.** Where a smoother wording implies more than the system delivers, the heavy truthful wording stays (the Appendix A rows mark these cases).
11. **Update `docs/operations/current-state.md` in every PR** that changes an executable truth, per the repo's own closure protocol.

---

## 5. Reviewer verification checklist

For every PR claiming to close a card in this plan:

| # | Question | Evidence required |
|---|---|---|
| 1 | Does the PR carry one card (or one homogeneous family) with its ID in the description? | PR description |
| 2 | Is it in the claimed authorisation group? (A: no contract/data-shape change; B: contract updated first; C: owner decision recorded) | Contract link for group B/C |
| 3 | Does it satisfy the card's acceptance criteria verbatim? | Pasted command output / measured screenshots |
| 4 | Did the test count increase or hold (≥ 87 + 264 + prior new)? | `pnpm check` summary |
| 5 | Did `localSchemaVersion` / `localExportVersion` change? | If yes without a contract + migration gate → **reject** |
| 6 | Did any existing financial number in tests change? | If yes without a documented boundary-case justification (A-04's two cases, A-07's 151→152) → **reject** |
| 7 | Did any stored-value write path change? (guardrail 4) | diff of `src/domain/**/policies.ts` reversal functions must be empty |
| 8 | For Phase-1 fixes: does the three-surface agreement hold? (A-01: Finance position = G5 = editor) | Reproducer script output, all three numbers |
| 9 | For L-cards: does any new wording widen a claim? (guardrail 10) | Side-by-side old/new string table |
| 10 | Was `docs/operations/current-state.md` updated? | diff |
| 11 | Was the worklog appended (`/home/z/my-project/worklog.md` protocol during execution; repo docs after)? | Link |
| 12 | Do the five boundaries still hold on the touched surface? | Explicit statement in the PR mapping each boundary to the code path |

---

## Appendix A — Copy change table (language review, per-string spec)

*Honesty guardrail applied to every row: no proposal widens what the system claims. Where the heavy wording is also the accurate one, it is kept and the row says why.*

| Location (path:line) | Current text | Problem | Proposed text | Why it is better |
|---|---|---|---|---|
| Finance.tsx:632 | «أعلن تحصيلًا أو التزامًا قريبًا» | «إعلان» = advertisement; 31 chars | «سجّل قبضًا أو دفعًا متوقعًا» | States the action (register an expectation), everyday verbs, shorter |
| Finance.tsx:1024 | «الإعلانات المحلية» | advertisement reading | «المتوقعات المحلية» | Names what the list holds |
| Finance.tsx:1029 | «لا توجد إعلانات فعالة. لن يفترض النظام مواعيد من تلقاء نفسه.» | same | «لا توجد متوقعات مسجلة. لن يفترض النظام مواعيد من تلقاء نفسه.» | Keeps the honesty sentence intact |
| Finance.tsx:1036 | «تحصيل معلن» / «التزام معلن» | same | «قبض متوقع» / «دفع متوقع» | Everyday pairing with the button |
| Finance.tsx:107-114 | «توقع معلن مكتمل» / «توقع معلن يحتاج مراجعة» / «إعلان غير صالح» / «لا يكفي لبناء توقع» | mixed | «توقع مكتمل» / «توقع يحتاج مراجعة» / «السجل غير صالح» / «لا يكفي لبناء توقع» | Drops «إعلان», keeps statuses exact |
| Finance.tsx:615 | «بعد المعلن» | cryptic + «إعلان» echo | «الكاش المتوقع» | Says what the number is: current cash ± registered expectations |
| Finance.tsx:593 | «هذه قراءة معلنة، لا وعد بتدفق نقدي.» | «تدفق نقدي» = cash-flow jargon | «هذه قراءة من مسجلاتك، لا وعد بأموال قادمة.» | Same boundary, spoken Arabic |
| G5DeclarationEditor.tsx:92 | «إعلان لا يتحول إلى حركة مالية» | «إعلان» | «سجل متوقع لا يتحول إلى حركة مالية» | Keeps the guarantee |
| G5DeclarationEditor.tsx:95 | «سيظهر في توقع G5 منفصلًا عن الكاش الحالي…» | «إعلان»+G5 | «سيظهر في قراءة الكاش المتوقع منفصلًا عن الكاش الحالي، ويمكن التراجع عنه لاحقًا دون تعديل السجل القديم.» | Also replaces G5 and «عكس» |
| G5DeclarationEditor.tsx:157,182,195,202,219 | «تفاصيل الإعلان» / «بدون ربط — إعلان مستقل» / «…تعتبر هذا التحصيل أو الالتزام معلنًا؟» / «هذا الإعلان لا يزيد الكاش…» / «حفظ الإعلان المحلي» (+«جارٍ حفظ الإعلان…») | «إعلان» family | «تفاصيل المتوقع» / «بدون ربط — سجل مستقل» / «…تتوقع هذا القبض أو الدفع؟» / «هذا السجل المتوقع لا يزيد الكاش ولا ينقصه ولا يسجل قبضًا أو دفعًا.» / «حفظ المتوقع» (+«جارٍ حفظ المتوقع…») | One concept, one name |
| g5Service.ts:270,371,384,401 | «تعذر قراءة/حفظ إعلانات السيولة المحلية.» | «إعلان السيولة» double jargon | «تعذر قراءة/حفظ المتوقعات المحلية.» | Plain |
| g5Service.ts:389,441 | «إعلان السيولة غير صالح.» / «تصحيح إعلان السيولة غير صالح.» | same | «السجل المتوقع غير صالح.» / «تصحيح السجل المتوقع غير صالح.» | Plain |
| g5Service.ts:363 | «…وإعلانات المالك… لا تحول الإعلان إلى قبض أو دفع فعلي…» | same | «…وما سجلته المالك كمتوقع… لا يحول المتوقع إلى قبض أو دفع فعلي…» | Keeps boundary verbatim in structure |
| Home.tsx:224 | «Home قراءة قيادة محلية محدودة. لا تعرض صافي ربح المشروع ولا تستبدل Finance أو Orders؛ الأرقام الناقصة تبقى غير معروفة.» | English route names + «قيادة» | «هذه قراءة محلية محدودة. لا تعرض صافي ربح المشروع ولا تستبدل صفحة المال أو الطلبات؛ الأرقام الناقصة تبقى غير معروفة.» | Same scope statement, all-Arabic |
| homeControlCenterService.ts:116 | «ProjectFinancialService والسجل المحلي» | class name leak | «السجل المحلي» | It *is* the local store — truthful and readable |
| homeControlCenterService.ts:329 | «فتح Finance» | route name leak | «فتح الوضع المالي» | Matches nav label |
| homeControlCenterService.ts:348 | `Finance: ${event.note …}` | route name leak | `حدث مالي: ${event.note …}` | Canonical event name |
| homeControlCenterService.ts:175 | «Snapshot التكلفة غير مكتمل؛ لا تُعرض نتيجة نهائية مكتملة المعرفة.» | Snapshot + wording | «نسخة التكلفة غير مكتملة؛ لا تُعرض نتيجة نهائية مكتملة المعرفة.» | Matches CostEditor's own term |
| agreementService.ts:106,112 | «احفظ Snapshot تكلفة أولًا قبل تثبيت الاتفاق.» / «Snapshot التكلفة غير صالح؛ راجع التكلفة قبل تثبيت الاتفاق.» | Snapshot | «احفظ نسخة التكلفة أولًا قبل تسجيل الاتفاق.» / «نسخة التكلفة غير صالحة؛ راجع التكلفة قبل تسجيل الاتفاق.» | One term for snapshot; «تسجيل» for agreement |
| Finance.tsx:307 | «تكلفة مباشرة من Snapshot» | Snapshot | «تكلفة مباشرة من نسخة التكلفة» | Same |
| Finance.tsx:103,105,106,377,379,941,942 + projectFinancialService.ts:245,249,257,502,503,591,650 | «COGS…» / «Snapshot…» (all listed lines) | English acronyms | «COGS» → «تكلفة البيع المسجلة» (matches Finance.tsx:313's own wording); «Snapshot» → «نسخة التكلفة»; e.g. :106 → «لا توجد تكلفة بيع مؤهلة؛ نسخة التكلفة هي المصدر البديل المعلن» | The app already owns these Arabic names; reuse them |
| ActualTimePanel.tsx:42,215 | «الفرق يشرح الوقت المسجل مقابل خطة Snapshot…» / «لا يغيّر Snapshot أو الكاش أو الذمم.» | Snapshot + ذمم | «الفرق يشرح الوقت المسجل مقابل خطة التكلفة…» / «لا يغيّر نسخة التكلفة أو الكاش أو الديون.» | Same |
| inventoryMaterialService.ts:125,195,196 | «…لا يغير هذا الإصدار Snapshot…» / «مادة مخططة في Snapshot…» / «Snapshot التخطيط يحتاج مراجعة…» | Snapshot | «…لا يغير هذا الإصدار نسخة التكلفة…» / «مادة مخططة في نسخة التكلفة…» / «نسخة التخطيط تحتاج مراجعة…» | Same |
| recurringWorkService.ts:376,405,527 | «…لا يغيّر Snapshot أو الهامش المباشر أو COGS تلقائيًا.» / «…مقارنة بوقت Snapshot فقط…» / «الإيراد المعترف به للطلبات final… نتيجة G3.» | Snapshot/COGS/final/G3 | «…لا يغيّر نسخة التكلفة أو الهامش المباشر أو تكلفة البيع تلقائيًا.» / «…مقارنة بوقت نسخة التكلفة فقط…» / «سعر الطلبات المسلّمة النهائية… نتيجة الفترة المسجلة.» | Same |
| InventoryMovementEditor.tsx:231,301 | «دون تعديل Snapshot أو نتيجة فترة قديمة.» / «لا ينشئ مصروفًا ولا COGS تلقائيًا.» | Snapshot/COGS | «دون تعديل نسخة التكلفة أو نتيجة فترة قديمة.» / «لا ينشئ مصروفًا ولا تكلفة بيع تلقائيًا.» | Same |
| Catalog.tsx:594,1293,1294,142,1426,1514,369,1033,1209,416,1222 | «أي Snapshot» / «الطلبات final» / «وCOGS» / «كمية final» / «لا توجد طلبات final» / «لا نحول yield تلقائيًا» / «دون yield» / «بلا yield» / «قيد مالي» / «لا Purchase ولا Inventory ولا Consumption ولا COGS…» | English tokens | «أي نسخة تكلفة» / «الطلبات المسلّمة النهائية» / «وتكلفة البيع» / «كمية نهائية» / «لا توجد طلبات نهائية» / «لا نحوّل الناتج تلقائيًا» / «دون ناتج» / «بلا ناتج» / «أثر مالي» / «لا شراء مواد ولا مخزون ولا استهلاك ولا تكلفة بيع ولا إيراد ولا هامش ينشأ منه» | Every guarantee stays, in Arabic |
| Review.tsx:100 | «من الطلبات ذات النتيجة <bdi>final</bdi> فقط؛ ليست هذه قراءة كل طلب مسلّم.» | final | «من الطلبات ذات النتيجة النهائية فقط؛ ليست هذه قراءة كل طلب مسلّم.» | Same |
| OwnerEntitlement.tsx:725 | «تحفظ النسبة basis points صحيحة، وتحسب من نتيجة G3 المسجلة…» | basis points + G3 | «تُحفظ النسبة كما أدخلتها بدقة كاملة، وتحسب من نتيجة الفترة المسجلة أو البيع المكتمل حسب النوع.» | bps is an implementation detail; user enters % |
| OwnerEntitlement.tsx:36,871 + projectFinancialService.ts:650 | «نتيجة G3 المسجلة» | internal slice code | «نتيجة الفترة المسجلة» | The contract's own public name |
| Finance.tsx:414 | «قراءة G5 للفترة والمزيج والإعلانات المعلنة» | G5 + إعلان | «قراءة الهامش والمتوقعات للفترة» | No internal codes |
| g5Service.ts:338 | «تعذر قراءة بيانات G5 المحلية.» | G5 | «تعذر قراءة المتوقعات المحلية.» | Same |
| OwnerEntitlement.tsx:326 | «هذا النوع غير متاح في O1 لغياب الدليل التشغيلي…» | O1 | «هذا النوع غير متاح في هذا الإصدار لغياب الدليل التشغيلي…» | User-facing version wording |
| Finance.tsx:790 | «سيبقى الأصل immutable كما هو.» | English | «سيبقى السجل الأصلي كما هو دون تعديل.» | Same guarantee |
| OrderDetail.tsx:278 | «…متابعة التحصيل خارج نطاق Prototype الحالي.» | Prototype | «…متابعة التحصيل مع العميل تتم خارج التطبيق في هذا الإصدار؛ السجل بقي كما هو.» | Honest, actionable |
| OrderDetail.tsx:365 | «لا توجد مزامنة أو مشاركة خارجية في Prototype.» | Prototype | «لا توجد مزامنة أو مشاركة خارجية في هذا الإصدار.» | Same |
| Settings.tsx:250 | «ينشئ ملف JSON لبيانات Prototype الحالية دون أسرار أو مفاتيح.» | JSON+Prototype | «ينشئ ملف نسخة لبياناتك الحالية على هذا الجهاز، دون أسرار أو مفاتيح.» | The format is irrelevant to the promise |
| NotFound.tsx:10 | «هذه الصفحة ليست جزءًا من Prototype الحالي» | Prototype | «هذه الصفحة ليست جزءًا من هذا الإصدار» | Same |
| localTransferService.ts:1659 | «إصدار الملف غير مدعوم في هذا Prototype…» | Prototype | «إصدار الملف غير مدعوم في هذا الإصدار من التطبيق؛ بقيت بيانات هذا الجهاز دون تغيير.» | Same |
| Settings.tsx:436 | «مادة بكمية N milli» | internal unit | «مادة بكمية N (أجزاء من ألف)» | MaterialEditor.tsx:99 already says «تحفظ كأجزاء ألفية» — reuse |
| Settings.tsx:447 | «الاستيراد ذري على Store فارغ، وإعادة المحاولة لا تكرر الأثر.» | ذري + Store | «الإدخال يكتب مرة واحدة على بيانات فارغة، وإعادة المحاولة لا تكرر الأثر.» | Same behaviour, no jargon |
| src/domain/g5/policies.ts:193,196,215,218 | «طلب مسلّم مسجل: ${order.id}» / «الطلب ${order.id} مستبعد لأن نتيجته ${order.resultStatus}.» / «كمية الطلب ${order.id} غير صالحة…» | raw UUID + English enum in user copy | use `${order.itemName}` (fallback «طلب بلا وصف») and map resultStatus → «نهائية/تقديرية/غير مكتملة/تحتاج مراجعة»: «الطلب «صندوق خشبي» مستبعد لأن نتيجته تقديرية.» | The exclusion finally names the order and the reason in Arabic |
| Finance.tsx:749,753 | «الأصل: <bdi>{event.correctionOfEventId}</bdi>» / «العكس الموثق: <bdi>{reversal.id}</bdi>» | raw IDs | show the original event's date + label («الأصل: مصروف مدفوع · 12/08/2026») instead of the ID | The audit link becomes readable; original record still reachable via UI |
| OwnerEntitlement.tsx:649,656,1268,1314,1383,1388 | «السلسلة {seriesId.slice(0,8)}» / «خليفة لـ {id}» / «الأصل محفوظ: {uuid}» | raw ID fragments | drop the chain/ID fragments entirely (version number + dates already shown); «الأصل محفوظ كما هو · السبب: …» | Nothing is claimed beyond what's shown; IDs carry no user meaning |
| OrderDetail.tsx:307-310 | «الإيراد المعترف به (د.أ): X · التكلفة المعترف بها (د.أ): Y» | recognition jargon | «المحتسب عند التسليم — السعر (د.أ): X · التكلفة (د.أ): Y» | Keeps exact meaning (counted at delivery, not collected) in operational words |
| Review.tsx:85,92 | «إيراد معترف به» / «تكلفة معترف بها» | same | «سعر محتسب عند التسليم» / «تكلفة محتسبة عند التسليم» | Same |
| Finance.tsx:260 + projectFinancialService.ts:502,503 | «صافي الربح التشغيلي المسجل للفترة» | accounting + contradicts contract name | «نتيجة الفترة المسجلة» (contract 05 §3.2.1's own name) | Removes the «صافي ربح» framing the contract forbids |
| Finance.tsx:932 | «هامش المساهمة — قراءة ثانوية» | textbook term | «الهامش بعد الكلفة المباشرة — قراءة ثانوية» | Describes the arithmetic in shop words |
| Finance.tsx:973 | «نقطة التعادل المفككة من المزيج المسجل» | jargon + «المفككة» noise | «كم وحدة تغطي المصاريف الثابتة» | The owner's actual question |
| Finance.tsx:951,955 | «التكلفة المتغيرة» / «الثابت المسجل» | jargon / cryptic | «الكلفة المباشرة للطلبات النهائية» / «المصاريف الثابتة المسجلة» | Operational equivalents, same numbers |
| Finance.tsx:331,337,343,58,70,403 + FinancialEventEditor.tsx:470 | «حصص مشروع مشتركة محملة» / «مصروف مشترك غير محمل» / «استهلاك عام غير محمل» / «حصة مشروع مشتركة · …» / «الحصة المحملة… غير محمل» | تحميل jargon + garbled label | «حصة المشروع من مصروف مشترك موزّعة» / «مصروف مشترك غير موزّع» / «استهلاك عام غير موزّع» / «حصة المشروع من مصروف مشترك · …» / «الحصة الموزّعة… غير موزّع» | «توزيع» is the everyday word for splitting a shared bill |
| Catalog.tsx:346,362,416,1268,1278,1300,1345,1426,1558,1569 | «سياسة تحميل», «أساس التحميل», «أضف تحميلًا واضحًا», «الربح بعد التحميل», «معاينة التحميل» … | تحميل | same sentences with «توزيع» («سياسة توزيع», «أساس التوزيع», «الربح بعد التوزيع» …) | Same |
| UnsavedChangesGuard.tsx:117 | «اختر كيف تتابع. لن يُحفظ شيء تلقائيًا، ولن يُفقد عملك ما لم تختر الخروج.» | over-promise (no beforeunload) | «اختر كيف تتابع. لن يُحفظ شيء تلقائيًا، وإذا أغلقت الصفحة أو التطبيق قبل الحفظ يفقد ما لم تحفظه.» | Truthful today; no behaviour change required (U-01 adds the handler) |
| Finance.tsx:488,558,567 + OwnerEntitlement.tsx (49,243,619,621,631,932,940-1016,1237 labels) | «دفتر استحقاق المالك…», «استحقاق مسجل», «سياسات الاستحقاق», «تسوية استحقاق مسجل» … | استحقاق jargon + inconsistency with «حق المالك» | «دفتر حق المالك», «حق مسجل», «سياسات حق المالك», «تسوية حق مسجل» … | The page heading «ما حقي المسجل؟» and Finance card «حق المالك» already speak this language |
| homeControlCenterService.ts:128,229 + ActualTimePanel.tsx:215 + g5Service.ts:461 | «ذمة عميل مسجلة…» / «الذمة مسجلة بعد التسليم…» / «أو الذمم» / «الذمة المسجلة للطلب» | ذمة vs دين | «دين عميل مسجل…» / «الدين مسجل بعد التسليم…» / «أو الديون» / «الدين المسجل للطلب» | Matches the app's own «دين مسجل» everywhere else |
| Orders.tsx:99,142 · OrderDetail.tsx:230 · Finance.tsx:389,403,1155 | «الفعل التالي: …» | heavy MSA + inconsistent with DecisionPanel | «الخطوة التالية: …» | One canonical label, already used in DecisionPanel |
| CostEditor.tsx:474,689 · FinancialEventEditor.tsx:475 · G5DeclarationEditor.tsx:163 | label «درجة المعرفة» + options «معروف / تقديري» | jargon label; «معروف» odd for a number | label «حالة الرقم» + options «مؤكد / تقديري» | The question a shop owner answers; «مؤكد» is the everyday antonym of «تقديري» |
| OrderDetail.tsx:286 | «وفق درجة المعرفة أعلاه» | same | «حسب حالتها أعلاه (مؤكدة أو تقديرية)» | Same |
| Finance.tsx:778,838,1049,1074 · CashWallets.tsx:33,218 · InventoryMaterials.tsx:26,214 · ActualTimePanel.tsx:248,372 · OwnerEntitlement.tsx:285,1465 · g5Service.ts:406,419 · CashReversalEditor/InventoryReversalEditor (passim) | «عكس موثق», «أكّد العكس الموثق», «تنفيذ العكس بسبب موثق», «عكس كامل», «عُكست», «اعكس هذا الأثر», «حفظ العكس», «عكس» | «عكس» not everyday for corrections | «تراجع موثق», «أكّد التراجع الموثق», «تنفيذ التراجع بسبب موثق», «تراجع كامل», «تم التراجع», «تراجع عن هذا الأثر», «حفظ التراجع», «تراجع» | «تراجع» matches the actual behaviour (undo effect, keep original); no promise widened |
| OwnerEntitlement.tsx:304,320,326,335,336,341,345,369,370,798,826,832,843,852,863,889,907,925 | «خليفة مؤرخة», «نوع الخليفة», «مبلغ الخليفة», «تاريخ نفاذ الخليفة», «إجراء الخليفة» … | system-design vocabulary | «نسخة جديدة تبدأ من تاريخ», «نوع النسخة الجديدة», «مبلغ النسخة الجديدة», «تاريخ بدء النسخة الجديدة», «تعديل سياسة (نسخة جديدة)» … | The page itself already explains it as «نسخة جديدة»; reuse |
| OwnerEntitlement.tsx:945,547 | «الفترة والمصدر مقفولان ضد تكرار الحق» / «وقفل الفترة متاح لإعادة تسجيل صحيحة» | «قفل» jargon | «لا يُسجل الحق نفسه للفترة نفسها مرتين» / «يمكنك تسجيل حق جديد صحيح بعد التراجع» | Says the actual rule |
| Home.tsx:68,74,89 + homeControlCenterService.ts:84,369 | «مركز قيادة المشروع…» / «تعذر قراءة مركز قيادة المشروع المحلي» / «مشروعي اليوم» / «قراءة قيادة محلية» | command-center register + name split | «جارٍ تجهيز مشروعك…» / «تعذر قراءة بيانات مشروعك المحلية» / «مشروعي الآن» / «قراءة محلية» | Matches the nav label and the audience |
| homeControlCenterService.ts:278 | «السعة غير حكم رفض تلقائي.» | ungrammatical | «السعة تحذير فقط، وليست رفضًا تلقائيًا.» | Readable, same meaning |
| Home.tsx:93 + homeControlCenterService.ts:47,108,341,347,352,355 + Finance.tsx:284 + Catalog.tsx:1488,1582,1583 | raw `2026-08-28` / `2026-08` dates | unexplained ISO, bidi risk | run through existing `formatLocalDateLong`/`formatLocalDate`/`formatMonthLabel` («28 آب 2026», «آب 2026») | Formatters already exist and are used in date fields |
| QuickActionSheet.tsx:30 · Orders.tsx:120 · dailyFollowUpService.ts:107 | «طلب مخصص» / «إنشاء طلب مخصص» / «ابدأ بطلب مخصص واحد» | inconsistent with NewDraft's «طلب عميل»/«طلب من عميل» | «طلب من عميل» / «إنشاء طلب من عميل» / «ابدأ بطلب واحد من عميل» | One name for one intent |
| Setup.tsx:81 (+ isSaving label) | «ثبّت الاسم وابدأ أول طلب» / «جارٍ تثبيت الاسم…» | «تثبيت» overloaded; action is a local save | «احفظ الاسم وابدأ أول طلب» / «جارٍ حفظ الاسم…» | Button states exactly what happens (saves locally); «تثبيت» reserved for app install |
| AgreementEditor.tsx:304 (+110-127 error texts) + CostEditor.tsx:595 | «تثبيت الاتفاق» / «…قبل تثبيت الاتفاق» / «جارٍ تثبيت الاتفاق…» | «تثبيت» overloaded; action creates the order | «تسجيل الاتفاق» / «…قبل تسجيل الاتفاق» / «جارٍ تسجيل الاتفاق…» | «تسجيل» is Micro's own verb for creating records |
| Catalog.tsx:557,1029,1176,1184,1235,1594 + InventoryMovementEditor.tsx:353 | «مراجعة القالب», «أنشئ مراجعة», «احفظ المراجعة», «إلغاء المراجعة», «مراجعة {revision}» | collides with «المراجعة» (Review tab) | «تعديل القالب», «أنشئ نسخة جديدة», «احفظ النسخة الجديدة», «إلغاء التعديل», «نسخة {revision}» | «مراجعة» reserved for the Review screen |
| Finance.tsx:692,795,818 · G5DeclarationEditor.tsx:202 · FinancialEventEditor.tsx:274 | «صحح هذه الواقعة» / «الواقعة» / «تاريخ الواقعة» | «واقعة» MSA + inconsistent with «حدث مالي» | «صحّح هذا الحدث» / «الحدث» / «تاريخ الحدث» | One canonical: «حدث مالي» |
| Schedule.tsx:456,472,483,522,533,564,598,619,640,647 | «ظهورات» (e.g. «إيقاف الظهورات المستقبلية بسبب مكتوب») | invented word; 38-char button | «مواعيد قادمة» (e.g. «إيقاف المواعيد القادمة بسبب») | Real word, same meaning, fits the button |
| InventoryMovementEditor.tsx:244 | «لا تسمح الشريحة بخروج كمية أكبر من المتاح.» | internal «slice» leak | «لا يمكن إخراج كمية أكبر من المتاحة.» | The rule, in user words |
| orderAgreementPresentation.ts:118,125 | «الحالة محجوبة للمراجعة؛ لا تتجاوز الحارس بفعل مالي عام.» / «…لم يُخترع لها انتقال جديد.» | internal «guard» + developer-speak | «هذه الحالة موقوفة للمراجعة؛ راجع الطلب قبل أي خطوة مالية.» / «حالة غير معروفة للعرض؛ لم يتغير أي شيء.» | Same caution, no system words |
| CashReversalEditor.tsx:62 | «ربما أُرشف السجل أو عُكس سابقًا.» | invents an archive feature | «قد يكون السجل حُذف من هذا الجهاز أو عُكس سابقًا.» | No invented capabilities |
| Setup.tsx:35 | «حرفة مخصصة» | unmappable metadata | «مشغل حرفي» | Matches the placeholder «مشغل ليان»; a real-world category |
| CashWallets.tsx:149,168 · InventoryMaterials.tsx:167 · Catalog.tsx:1061,1206 | «${n} محافظ كاش» / «${n} آثار محفوظة» / «${n} حركات محفوظة» / «${n} مكوّن» | wrong Arabic plurals for 2/11+ | use `formatArabicPlural` (محفظة/محفظتان/محافظ/محفظة · أثر/أثران/آثار/أثرًا · حركة/حركتان/حركات/حركة · مكوّن/مكوّنان/مكونات/مكوّنًا) | Helper already exists; native plurals |
| Finance.tsx:483 | «دفتر استحقاق المالك والسحب الفعلي» (33 chars) | length + استحقاق | «دفتر حق المالك» | Fits one line; canonical term |

---

## Appendix B — Unified glossary (requires owner sign-off; then binding for all screens)

*Full table as delivered by the language review — reproduced in `MICRO-REVIEW-FINDINGS.md` §4.4.1. Sign-off of this single artifact authorises cards L-01, L-02, L-04, L-05, L-07–L-09, L-11–L-13, L-16. Two "KEEP" verdicts are binding too: «سعر الحماية» stays (coined term, consistently explained, protective framing), and «عربون / عليّ للموردين / رصيد / تسوية» stay (already living Jordanian usage).*

---

## 6. Prior-review open items (continuation, cards exist in v1 — not restated)

| Item | Current status | Next action owner |
|---|---|---|
| P-01 layers 1–3 | open (layer 0 shipped) | owner decision on cadence UX; U-11 removes one barrier meanwhile |
| X-01 | open | owner decision (migration path design when a second profile is scheduled) |
| X-02 | open (doc change never made) | owner decision tied to Profiles restart |
| D-02 completion | partially fixed → this plan's A-07 finishes it | implementer |
| D-04 | open (masking now contract-sanctioned) | owner decision on surfacing multiple deficiencies |
| G-01 / G-03 | open owner decisions | owner |
| X-03 / X-04 / X-05 / X-06 | open (X-05/X-06 have honest framing docs now) | owner — see §3 Group C |
