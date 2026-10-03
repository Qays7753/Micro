# ADR-010: Ratification of the executed remediation-program decisions as architecture decision records

**Status:** Accepted (Wave G of the A-to-Z structural completion program — STR-610 — 2026-10-03)
**Owner:** Micro owner (Qays7753), execution: Z AI (WS-214)
**Context:** Plan §7.1-4 requires an ADR for any unit-boundary, source-of-truth, public-surface, port, or exception change. The remediation program (WS-212, PRs #299–#308, closed VERIFIED at `04895f2`) executed five such decision classes through documented wave cards that the owner accepted as containers («عبر بطاقات الموجات الموثقة فقط» — plan footer, 2026-10-03), without separate ADR files. STR-610 requires the decision history to be unambiguous: either retrospective ADRs or an explicit ratification that the cards are the accepted ADR artifacts.

**Decision:**
1. The following wave cards are **ratified as the accepted ADR artifacts** for their decisions, by this ADR, on 2026-10-03:
   - **Wave 4A (worklog Entry 8, PR #302, merge `c4b3a59`)** — canonical naming `g5` → `financial-analysis` (Domain + Application) with two compatibility barrels preserving frozen-UI specifiers; decision class: naming/public-surface.
   - **Wave 4B (Entry 7, PR #302) + follow-up (Entry 11, PR #307, merge `4a4e317`)** — Owner Money, Financial Records, and Budgets/Planning clusters moved to their canonical homes (`application/owner-money/`, `application/financial-records/`, `application/budgets/`) with compatibility units and contract-40 dated notes; decision class: unit boundary + source-of-truth residence.
   - **Wave 4C (Entry 8, PR #304, merge `aa7a78d`)** — first storage capability port `OrderLifecycleStore` (Pick-derived from the authoritative interface; both adapters conform); decision class: port extraction.
   - **Wave 4D (Entry 9, PR #305, merge `efb61ca`)** — transfer-validator acceptance-source completion (`transferCompatibilityValues.ts` as the sole historical-compatibility registry; acceptance-source map DOMAIN_RUNTIME_LIST / GUARDED_UNION / HISTORICAL_REGISTRY); decision class: source of truth.
   - **Wave 4E (Entry 10, PR #306, merge `b02e939`)** — boundary freeze + ratchet guards (`check-module-boundaries.mjs`, `check-file-size-ratchet.mjs`) with accepted baselines; decision class: executable rule + registered exceptions.
2. The five cards' full decision content lives in `AGENT-SEQUENTIAL-WORKLOG.md` Entries 7–12 and the referenced PRs; this ADR does not restate their technical content and adds no new rule.
3. Any **future** decision of those classes requires its own ADR **before** the wave executes (prospective rule, unchanged).

**Consequences:** The decision history is now unambiguous: cards + this ratification = the ADR record for 4A–4E+#307. No file moves, no code, no contract change results from this ADR. Rollback: revert this file.

**Evidence class:** VERIFIED (cards, PRs, merge SHAs, and contract-40 dated notes re-verified live at base `04895f2` during Wave A).
