# ADR-015: Storage-capability extraction order — six groups, dependency-first

**Status:** Accepted (Wave G — STR-613 — 2026-10-03)
**Owner:** Micro owner; per-group cards in Wave C.
**Context:** Wave 4C proved the extraction pattern (RC-7: a Pick-derived capability port from the authoritative `PrototypeLocalStore`; type anchors; contract tests run against BOTH adapters together; mechanical consumer migration to the narrow type; the facade intact until separately accepted removal). Six groups meet the extraction criterion today (independent owner, lifecycle, consumer set, test contract). The order respects the bundle-margin plan (ADR-012): capability ports narrow consumer types with zero-to-minimal runtime bytes (types erase; the 4C pilot was bundle-neutral).

**Decision — extraction order (Wave C, one card per group):**
1. **Recurring expenses** (10 methods; guard `recurringExpenseCommitGuard`; contract 41; single primary application consumer) — first: it aligns with ADR-013's `application/recurring/` home and the contract-41 sub-domain.
2. **Expense budgets** (3 methods; conformance suite exists; contract 42; consumer `budgets/expenseBudgetService` already in its home).
3. **Loans + received loans** (10 methods across two domain areas; guards `loanCommitGuard`/`receivedLoanCommitGuard`).
4. **Distribution policies** (4 methods; allocation-successor guard; **exe017 lock preserved**: finance remains the sole writer).
5. **Short-cash declarations** (4 methods; reversal guard; stored-record ownership per the 4A note).
6. **Owner entitlement** (15 methods; exe017-reviewed — extract only what the ownership lock permits; the `owner-money/` home already exists).

Post-Wave-C evaluation (not before): assets/actual-time after a conformance-lens pass, then schedules. The remaining groups (financial events, cash liquidity, transfer-snapshot, shared read groups) **stay behind the facade by design** — recorded as design decisions, not deferrals.

**Per-card requirements (non-negotiable):** a stable card ID; a consumer inventory; the authoritative type source = the store port (Pick); IndexedDB+Memory conformance; parity tests; a rollback boundary; bundle bytes recorded; facade-method removal only with no-consumer proof plus separate acceptance. A card failing conformance or budget stops at its boundary (stop condition) — it never weakens a test.

**Growth bound / review trigger:** each extracted capability owns its own growth record in the register; reviews trigger on any signature change to the authoritative interface. **Rollback:** each card reverts independently (no data effect).

**Consequences:** STR-613 becomes an execution checklist with a decided order; "pilot" language is retired. No code changes in this ADR.

**Evidence class:** VERIFIED (§23 Q5 table; registry §2 rows; the 4C precedent artifacts).

---

**تصويب مؤرخ 2026-10-08 (R3/R3-N1 — بعد تنفيذ موجة R3 كاملة):**
1. مجموعة 6 أعلاه تقول «Owner entitlement (15 طريقة)» — العدد الحي للقدرة **14** (`ownerEntitlementStore.ts` — جرد آلي). لا أثر قرارًا؛ تصويب عدّ فقط.
2. أنجزت R3 ما أجّله هذا الـADR: عدسة المطابقة للأصول والوقت الفعلي ثم الجداول، **واستُخرجت أيضًا** (بأمر المالك «Full R3 Storage Execution») مجموعات كانت مصنفة هنا «تبقى خلف الـfacade by design»: الأحداث المالية، ومشتريات المورّد، والبيع المباشر، والتقديرات، والمخزون، والكتالوج — قررتها بطاقات R3 (`EXTRACT_NOW` بأدلة مستهلكين حية)، وبقيت السيولة النقدية والمسودات والهوية/التفضيلات/الأمان خلف الـfacade ببطاقات استثناء موثقة (R3-SC-17/18/19) وحدود نمو ومحفزات مراجعة. التفصيل: `docs/operations/control/evidence/structural-remediation-r3-20261008/R3-REPAIR-CARDS.md` وتقرير R3.
