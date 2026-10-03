# ADR-016: withdrawalWalletGuard compatibility unit — truthful lifecycle and removal

**Status:** Accepted (Wave G — STR-614 — 2026-10-03)
**Owner:** Micro owner; executor: Wave E slice.
**Context:** The `finance/withdrawalWalletGuard.ts` compatibility unit's documented removal premise («removal follows the UI track») is **false for this unit**: its only live consumer is non-UI — `application/owner-money/ownerEntitlementService.ts:27`. No UI file imports it. (Verified live at Wave G by full consumer inventory.)

**Decision:**
1. **Migrate the single non-UI consumer** to the canonical home `application/owner-money/withdrawalWalletGuard.ts` (a mechanical import rewrite; the units are re-export-identical — parity proven by the direct withdrawal tests).
2. **Remove the `finance/` compatibility unit in the same slice** once the consumer inventory (live grep, recorded in the wave card) shows zero remaining importers.
3. **Correct the lifecycle statement** wherever it claims UI-track dependency for this unit (the registry row and the unit's own header if it repeats the false premise).
4. The other eight compatibility units keep their truthful UI-track removal conditions (their consumers ARE frozen-UI files) — this ADR changes nothing for them.

**Consequences:** STR-614 closes with the misleading lifecycle statement eliminated and the compatibility-unit count 9 → 8 (Wave E). Rollback: revert the slice. No behavior change (re-export identity).

**Evidence class:** VERIFIED (consumer inventory re-executed live at Wave G: exactly one non-UI importer, zero UI importers).
