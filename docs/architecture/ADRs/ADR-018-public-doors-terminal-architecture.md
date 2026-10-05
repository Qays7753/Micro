# ADR-018: Public Doors terminal architecture — feature consumers through doors, composition root as the documented wiring exception

**Status:** Accepted (post-scan correction program Step 6 — STR-615 system-wide — 2026-10-06)
**Owner:** Micro owner (correction-program commission 2026-10-06); measured evidence and terminal state below.
**Relates to:** ADR-011 (dependency direction), STR-615 (Public Doors), FIN-001/OPS-003 (entry-chunk lazy-loading protocol), ADR-017 (gzip ceiling 155,300 — no later raise).

**Context:** STR-615 required system-wide closure after the W4 cash pilot (127 live UI deep imports into application interiors across 32 houses; 83 value / 44 type / 8 dynamic). Two boundary questions had to be decided with evidence: (a) does the composition root (`PrototypeServicesContext` — the designated wiring layer that instantiates every service) also migrate through doors, and (b) what happens to the frozen Wave B/W2 compat-shim consumers.

**Decision:**

1. **Every application house with feature-surface UI consumers has a door** (`application/<house>/index.ts`) exporting exactly the live consumer surface (PC-3): 29 doors after this program (6 Wave B/W4 + 23 new). Doors split `export` (values) from `export type` (types) — a door that becomes a dynamic-import chunk entry needs a complete runtime export table; re-exporting type-only names as runtime bindings is a build-breaking latent defect (fixed in the six existing doors; `PayableDueRow` was the witness).
2. **The composition root keeps direct deep imports as a documented retained exception.** It is the designated wiring layer (the one place that must know every concrete implementation — the modular-monolith DI pattern), and it is the entry-chunk budget owner: measured on this tree, routing 3 static sites through doors cost the entry chunk **+89 gzip**, and routing the dynamic service load **+78 gzip with a PWA-precache regression**; the 204-byte margin (ADR-017) cannot absorb ~30 entry-graph door facades. Feature consumers (pages/components/presentation/pwa) migrate through doors unconditionally.
3. **Frozen compat-shim consumers remain retained with their track-T removal conditions** (finance/expenseBudgetService consumer, g5/g5Service type consumers, the three presentation re-export shims). The shims stay byte-identical; their deep re-export specifiers are part of the frozen surface.
4. **Houses whose only UI consumer is the composition root need no door** (direct-sales, financial-analysis, owner, profile): nothing to isolate.
5. **Enforcement is structural, not procedural:** rule R6 in `scripts/check-module-boundaries.mjs` ratchets UI-to-application-interior imports against `scripts/ui-application-import-baseline.json` — terminal state 43 documented keys (36 composition root + 7 frozen shims). New deep imports, reverted migrations, and stale rows all fail CI; the exact value surface of every door is pinned by `applicationDoors.contract.test.ts`.

**Measured terminal state (authoritative guard, local Node 24; CI Node-22 drift documented in ADR-012/4D):** entry 630,529 raw / 155,085 gzip (baseline 630,510 / 155,096 → **−11 gzip**, margin 204 → **215** under the untouched 155,300 ceiling); lazy surfaces 102 chunks / 1,415,921 raw / 435,338 gzip (−9,450 raw / −3,215 gzip vs baseline); precache 187 entries / 2,743,872 bytes (−177). No ceiling change, no baseline raise, no guard weakened.

**Review trigger:** any proposal to import application interiors from new UI code (R6 will reject it — the review happens at the guard); any change to the composition root's import set (the 36-key pin fails until updated deliberately); any frozen-shim removal in the UI track (its retained key dies with it).

**Migration/removal condition (for the composition-root exception):** if the entry-chunk margin recovers materially (e.g., a future budget-relief change lands), the composition root can migrate through doors slice-by-slice — each site's baseline key is removed in the same PR; R6 keeps the direction irreversible.

**Rollback:** revert the Step 6 commit (doors + migrations + baseline are one self-contained slice; the R6 rule reverts with the enforcement commit). No data, schema, export/import, history, or UI-visual impact anywhere in this architecture.

**Evidence class:** VERIFIED (double-measured isolation experiments recorded in the program worklog Entry 46; all suites 2,220/2,220 + 619/619 green; guards 13/13 PASS).
