# Financial Roadmap — Wave 7 Delivery Report (FIN-008, WS-179)

**Branch:** `feat/fin-008-depreciation-contract-20260923` (base: verified main `dc8818bcef55ec64425257fd058343f6609df6b6` — Wave 6 closed)
**Scope:** the mandated explicit asset/depreciation **contract first**, then the approved first slice (residual value + reference/note). Schema/export **unchanged 38/30** (optional fields on existing records — categoryLabel precedent). The recorded-event depreciation machinery (straight-line, first-full-month, proposal→explicit record, injectable clock, reversal, non-cash statement lines) was reconciled from main and NOT reimplemented (coordinator audit).

## What was built

1. **Contract 43** (`docs/contracts/43-asset-depreciation-prototype-contract.md`) — the gate deliverable: owner-approved §4.8 defaults verbatim (physical business assets only; straight-line; five inputs; first-full-month rule; non-cash separate line; documented reversal corrections; injectable clock); **the mandated read-derived-vs-persisted tradeoff documented in §4** — both options' migration/idempotency/correction consequences, choosing the already-implemented recorded-event hybrid («الاقتراح مشتق، والتسجيل صريح») with the reasoning (no silent history rewrites; documented corrections; stable recorded period result); optionality semantics for residual (absent = 0) and note; out-of-scope declarations (tax depreciation, revaluation, group depreciation, interest capitalization, monthly automation); **the 10-item acceptance matrix**.
2. **Residual value** (`src/domain/asset`): `residualValueMinor` optional on the record — **legacy assets read 0 and the math is literally unchanged** (tested); monthly = floor((cost − residual) ÷ life); scheduled cap = cost − residual; **the book settles AT residual after full life, never below it**; guards reject r < 0 or r ≥ cost before any write; documented contract revisions carry the new values with reason/time; recorded events are never touched by revisions (tested).
3. **Reference/note**: display-only label ≤ 500 chars on the record + editor field (existing note input now also lands on the record) + detail display.
4. **Surface**: residual field on the editor's long-use path with the floor-rounding hint; declared residual + note shown in the detail heading; the revision form supports residual with the documented-revision wording.
5. **Export integrity**: optional-field validator branches (categoryLabel/lifeMonths precedent — no store/envelope structural change, **no version bump**); round-trip deep-equal with the fields; legacy import lossless; malformed residual/note rejected before any replacement with local data untouched (tested).

## Tests (19 new it-blocks: 10 domain + 3 service + 3 round-trip + 3 DOM)

Domain: straight-line on (cost−residual) with floor; cap and residual-settled book; **legacy identical**; first-full-month unchanged; **two synthetic asOf dates crossing a month (injectable clock — no real waiting)**; out-of-bounds rejection; display-only note; documented revisions with recorded events untouched; undefined-vs-null revision semantics; unknown inputs stay explicit. Service: fields carried on create with acquisition event untouched; **book settles at residual** with a fully-depreciated stop and non-cash deltas asserted; documented revision leaves recorded depreciation untouched. Round-trip: verbatim deep-equal; legacy lossless; reject-before-write (r ≥ cost / negative / long note) with snapshot unchanged. DOM: residual field appears only on the long-use path and saves; save blocked when r ≥ cost; detail shows declared residual + note.

## Gates

- Full CI-equivalent pipeline green: typecheck (root + workspace); lint 0 errors / **37 warnings (budget 37 — held by extracting `assertCreateAssetInput` and splitting test describes, not by raising anything)**; prettier; **text-density all caps — documented raises: AssetEditor 57→59, AssetDetail 44→45 (dated §4.8 comments)**; design-guards; guards; root suite; prototype suite; build + PWA; bundle **649,628 local / 649,740 CI-parity — PASS (headroom 260, prediction byte-exact per the proven W5 rule)**.
- Contract review: contract 43 checked against the current contracts (05 §3.3, 29, 06, 34, 39, 35) and the owner-approved §4.8 register — **no unresolved policy changes financial meaning → no OWNER_DECISION_REQUIRED**; the wave proceeded to the approved first slice.

## Owner-review items (vetoable)

1. Density raises listed above (dated, minimal mandated strings).
2. Optional-field addition without schema/export version bump (categoryLabel/lifeMonths validator precedent; no structural change; legacy imports proven lossless — recorded here for owner visibility).

## Not changed (intentionally)

The recorded-event machinery (proposal→explicit record, reversal, statement lines, bridge add-back — reconciled); interest/fees anywhere; tax depreciation, revaluation, group depreciation (declared out of scope in contract 43); monthly automation of recording; assets store/export structure.

## Rollback boundary

`dc8818bcef55ec64425257fd058343f6609df6b6` (verified main immediately before this wave). Revert = single revert of the wave squash merge (self-contained: contract + domain + service + surface + tests + tracker updates).
