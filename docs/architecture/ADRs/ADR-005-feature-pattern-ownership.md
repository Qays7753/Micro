# ADR-005: Feature patterns are Micro-owned; the Standard stays contracts-only

**Status:** Accepted (W5; reaffirmed in the completion run)
**Context:** Micro has richer compositions than the generic Standard (fact triad, documented-correction lifecycle, decision-card grammar, finance-event card rows, knowledge-state surfaces). Pushing them into the 31-file Standard package would couple product meaning to contracts.
**Decision:** Feature patterns live in `components/<family>/` and own Micro-specific composition: they consume shared primitives and define their own state matrices (data/loading/empty/error/pending/unknown). Nothing feature-specific ever enters `micro-standard-v2/`. Confirmed patterns include the finance quick forms, CorrectionPreview (preview-before-confirm with an independent confirmation path), OrderDepositPanels, ActualTimePanel, and the catalog sections.
**Consequences:** Adding a pattern requires its state matrix and consumers; a pattern without tests is incomplete. The Row primitive's convergence with the finance-event card family is deliberately deferred (owner visual decision) rather than force-migrated.
