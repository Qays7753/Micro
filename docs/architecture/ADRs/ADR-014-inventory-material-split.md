# ADR-014: inventoryMaterialService — internal responsibility split in its existing home

**Status:** Accepted (Wave G — STR-612 — 2026-10-03)
**Owner:** Micro owner; executor: Wave F card.
**Context:** `application/inventory/inventoryMaterialService.ts` is the only non-UI SPLIT_NOW file without a resolution (1,428 nbLOC; 24 exports; 68 consumers; 56 tests per the v1.4 register). Its home (`application/inventory/`) is already correct — the storage group (9 methods + 2 activation) and the domain area (`domain/inventory-material`) align with it. The unresolved problem is **internal**: multiple responsibility families inside one file (material consumption recording, activation, suggestions, queries, movement views).

**Decision:**
1. **Split internally, stay in `application/inventory/`** — the Wave F card moves the responsibility families into sibling files in the same home, preserving the service's public surface via its existing exports (or mechanically migrating the enumerated consumers where a clean boundary exists).
2. Mandatory preconditions per the operational skill: full consumer inventory (68 consumers from the register plus the live import graph), characterization coverage of current behaviors before any movement (56 direct tests plus the 3C coverage), byte-identical public behavior, register re-measure in the same PR.
3. A cohesion exception without a split is explicitly **rejected** — the file carries at least four distinguishable responsibility families; deferring again would repeat the SPLIT_NOW-without-resolution pattern this program exists to close.
4. **Growth bound:** post-split files stay below WATCH; the ratchet enforces. **Review trigger:** the Wave F slice; any new responsibility-family addition. **Rollback:** revert the split commit (pure file surgery, no data effect).

**Consequences:** STR-612 closes with a decided root-cause path (Wave F executes). No code changes in this ADR.

**Evidence class:** VERIFIED (register row, live size, export/consumer/test counts).
