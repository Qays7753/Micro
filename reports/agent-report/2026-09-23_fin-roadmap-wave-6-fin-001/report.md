# Financial Roadmap — Wave 6 Delivery Report (FIN-001, WS-178)

**Branch:** `feat/fin-001-received-loans-20260923` (base: verified main `c3b68c6aae351b640a0882a6af00381c3a4b60b5` — Wave 5 closed)
**Scope:** received loans and liabilities (incoming borrowing) as an independent liability/cash layer. **Schema/export 37→38 / 29→30** (guarded store creation, no existing-record migration). Outgoing-loan machinery reconciled from main and NOT reimplemented (W6-AUDIT).

## What was built

1. **Event kinds and an independent liability column** (`src/domain/financial-event`): `loan_received_cash` (cash +1, loan payable +1) and `loan_received_repayment_cash` (cash −1, loan payable −1) as a ninth delta-table column — **never mixed into operating payables, outgoing loans, owner capital, or revenue**. Old events read the new column as 0 (amanah/asset precedent). Reversals negate it; totals gain `loanPayableMinor`. `LoanEventContext.lender` is required for received kinds and forbidden on outgoing ones (no data migration; old records stay valid).
2. **Received-loan domain** (`src/domain/received-loan`): record carries principal, lender name, **explicit user-chosen lender type (`owner`/`person`/`institution` — no default, never guessed)**, receivedOn, optional dueOn (**display-only: no expense, no mandatory alert**), note, wallet label, idempotent operation key. Outstanding is derived from active repayments — never stored. Partial principal repayment through zero with over-repayment and post-settle guards; corrections are documented; reversals keep history.
3. **Storage/export (D-037 guarded pattern, FIN-002 precedent)**: new `received-loans` store (schema 37→38, guarded creation — old DBs open and find it empty, no data migration); atomic commit + AV-02 concurrency guard mirror; both adapters (IndexedDB + Memory parity); snapshot read/replace/counts/digest; export family `receivedLoans` (29→30) with **released legacy pair 29/37** (old files import with an empty family — no invented history); import migration + family validation incl. received-kind delta semantics; reject-before-write preserved; touchpoints registered (36→37 manifest count).
4. **Service and surface**: `receivedLoanService` (create/overview/read/recordRepayment/reverseRepayment/correctLoan) with idempotency keys (`${loanId}:principal`, `:repayment:${repaymentId}`) — **dynamically imported (lazy chunk) per the FIN-002/EXE-014 pattern, never in the boot context**. Loans page gains a **separate liability layer («قروض أخذتها (التزام)»)** with independent outstanding totals and display-only due dates; `ReceivedLoanEditor` enforces the explicit lender-type choice before saving with honest non-income wording; `ReceivedLoanDetail` + repayment sheet support partial repayment and documented reversal.
5. **Honest readers**: bridge `loan_flows` line now nets all four loan kinds (balanced by construction — the measured side sums all cash deltas); `readPosition` gains `borrowedLoansOutstandingMinor` + evidence; statement deep-finance liability line + two cash-flow families; MIC-4/MIC-11 integrity coverage incl. `loanPayableDeltaMinor` rebuild checks; activity and correction-history mappings with `/loans/received/:id` deep links.
6. **Entry-bundle discipline (the W5 lesson applied)**: `LoanService` demoted from eager instantiation to post-boot dynamic provision (transfers/recurring precedent — `loans: LoanService | null`, honest "preparing" states); the received service never touches the boot context. **CI-parity measurement (GITHUB_SHA set — mandatory rule from W5): raw=648,772/650,000 (headroom 1,228) + gzip=153,862/155,000 — PASS**, after a local null build of 648,660. CI/Cloudflare on the PR head is the closing authority.

## Tests (new matrix: 8 domain + 12 service + 15 store + 12 transfer + 4 DOM)

- **Domain** (`tests/domain/receivedLoan.test.ts`): create validation (blank lender, invalid lender type, dueOn before receivedOn), derived reading with partial→settle, over-repayment and post-settle rejection, reversal marking + double-reversal rejection, correction guards.
- **Service** (`receivedLoanService.test.ts`): multiple independent loans; partial repayment to zero; **idempotency replay (create + repayment) with no duplicate effects**; repayment reversal restores liability; **separation proof — revenue/operatingExpense/ownerCapital deltas are 0 for received events and the recorded period result is unchanged by borrowing + repayment**; dueOn creates no expense.
- **Storage/adapters** (`IndexedDbLocalStore.receivedLoan.test.ts`, `adapterConformance.receivedLoan.test.ts`): store round-trip, atomic commits, idempotency replay, reversal + correction commits, adapter parity.
- **Export/import** (`localTransferService.receivedLoan.test.ts`): family + counts in export; deep-equal round-trip; **reject-before-write for malformed family (data untouched)**; legacy pair 29/37 accepted with empty family.
- **DOM** (`ReceivedLoanEditor.w178.dom.test.tsx`): explicit lender-type selector with **no default selection**, submission blocked without it; honest non-income wording; dueOn display-only wording.

## Gates

- Full CI-equivalent pipeline green: operations-control 8/8 + validator PASS (1 active claim); typecheck (root + workspace); lint 0 errors / **37 warnings (budget 37 — held by refactoring new code, not by raising the budget)**; prettier; **text-density all caps — documented raises: Loans 73→82, Finance 330→332, Statement 216→224, ToolsIntegrity 86→88, FinanceUpcoming 49→51 (dated §4.7 comments) + ReceivedLoanEditor 32 / ReceivedLoanDetail 78 registered from day one**; design-guards; guards; root suite **473/473** (+8); prototype suite **268 files / 1889/1889** (+5 files, +24); build + PWA; bundle **648,660 local / 648,772 CI-parity** — PASS.
- Route classifier + knowledge sync extended for the two new deep routes (editors hide bottom nav like their outgoing siblings); ErrorBoundary schema literal 38.

## Owner-review items (vetoable)

1. Density raises listed above (all dated, minimal mandated strings).
2. Schema/export bump 37/29 → 38/30 (guarded, no-loss, released pair registered — FIN-002/WS-174 precedent).
3. LoanService demotion to post-boot dynamic provision (process change to protect the D-034 entry budget; no behavior change — pages treat null as "preparing" honestly).

## Not changed (intentionally)

Outgoing-loan machinery (domain/service/UI — reconciled, not reimplemented); transfers and capital injection journeys (the explicit lender-type choice prevents conflation); interest/financing fees (**out of scope by policy — require a separate contract**); no alert/upcoming wiring for dueOn; G5/FIN-005 horizons (borrowed liability disclosure in safe-withdrawal is a possible later reading, not this wave).

## Rollback boundary

`c3b68c6aae351b640a0882a6af00381c3a4b60b5` (verified main immediately before this wave). Revert = single revert of the wave squash merge (self-contained: domain + storage + transfers + service + surface + tests + tracker updates).
