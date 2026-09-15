# FEATURE PATTERN CATALOG — Micro-owned patterns (W5)

Micro's six runtime feature patterns are **richer than what the Standard can express** and are preserved as Micro-owned (register U-20). None of this logic enters the 29-file Standard. Documentation below is the pattern index the architecture scan asked for (GAP-34), with the W1–W6 integration state of each.

## The six Micro-owned patterns (preserved)

| # | Pattern | Evidence (representative) | Integration state |
|---|---|---|---|
| 1 | **Fact-state triad + road chips** — known value / «غير مسجل — سجّله» (unrecorded → action road) / «غير محدد بعد» (unknown, declared) | `pages/Home.tsx` FactCard; `homeService` | preserved as-is; knowledge presentations available via `StatusChip` (`unconfirmed`/`incomplete`) where surfaces choose them |
| 2 | **Documented-correction lifecycle** — reverse / atomic edit / documented delete / undo-of-correction with impact previews and audit lines | `components/finance/CorrectionsLayer.tsx`, `pages/InventoryReversalEditor.tsx` | untouched (product-owned meaning); visual contracts (word + marker) satisfied by W1 tokens |
| 3 | **Next-action state machine + always-present priority DecisionPanel** (incl. honest empty) | `pages/Orders.tsx`, `components/presentation/DecisionPanel.tsx` | untouched; empty states can adopt `EmptyState` in later waves |
| 4 | **Knowledge states** distinct from the outcome matrix | `stateAdapter.ts` (knowledge family), `InventoryMaterials` chips | **adapter-backed** (W1/W2): neutral tone + non-color marker enforced by contract + tests |
| 5 | **Decision-card grammar** (truth + next action) + away-digest | `pages/Finance.tsx` OwnerDecisionCard, Home away section | untouched (Micro grammar) |
| 6 | **Inline no-toast feedback regime** (110 `role="status"` sites, receipt/outcome cards, `micro-local-truth`) | throughout editors | ratified (U-07); `Notice`/`QuietCompletion`/`InlineError` primitives available for new surfaces |

## Composition patterns (Standard-contract consumers)

| Pattern | Contract source | Micro carrier | State |
|---|---|---|---|
| Finance value zone (label/value/unit/period/delta slots, honest voids) | `component-contracts.md` | `MoneyValue` + `MoneyWithUnit` (W2) + the position/summary cards | adopted on Finance (W4); slot grammar documented |
| Period control | period variants (U-08) | native month inputs + quick ranges (product-owned semantics — **kept**); period chip documented as the optional variant | chip variant deferred to a consumer-driven wave (no speculative abstraction without a real consumer) |
| Order rows / detail | operational row slots | existing `.micro-activity-row` / `.micro-event-row` families | `Row` primitive available (W2); per-surface migration planned post-run (matrix) |
| Tables for phone scanning | W5 mandate | Orders list anatomy | documented; restructure needs per-surface tests — planned |
| Charts | chart floors (one question, data/zero/no-data/loading, text alternative) | no production chart yet | floors recorded as acceptance criteria for Micro's first chart (product decision pending — U-16) |
| Filters | staged apply/clear/pending | sheet-family filter surfaces | overlay contract documented in AUX_CONTRACT.md |
| Tools / inventory / detail / ledger | feature-oriented layer | existing feature modules | boundaries preserved; knowledge/integrity presentations adapter-backed |

## Feature boundary rules (enforced)

- Feature patterns may depend on primitives + application/domain interfaces; primitives never depend on patterns or pages.
- The AUX shell dispatches but does not own feature forms (W3 separation: `QuickSaleForm`/`QuickExpenseForm` own their fields and submission).
- No product policy inside primitives; no visual decisions inside domain/application/storage.
