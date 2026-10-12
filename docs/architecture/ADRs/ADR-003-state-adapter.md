# ADR-003: The central State Adapter preserves Micro's words

**Status:** Accepted (W1; reaffirmed in the completion run — 0 raw data-tone bypasses)
**Context:** The Standard defines state presentation contracts (markers, tones, families), but Micro's Arabic state words are product-owned and frozen by tests. Renaming them to match Standard examples was forbidden by the owner.
**Decision:** `presentation/stateAdapter.ts` maps Micro states to presentation only (markerRole + tone + family + isKnowledge). It never produces words. StatusChip and markers consume the adapter; screens pass their own product words as children. Pending is never success; unknown is never failure; knowledge states are always neutral; honest voids (unrecorded / unavailable / measured zero / no-data / no-results) stay distinct.
**Consequences:** A state-word rename requires an explicit owner decision and a coordinated update (adapter + consumers + frozen-word tests). Direct tone assignment in pages is a contract violation.

**Dated note (2026-10-11 — R10-B4/F-018, API-honesty rename):** the presentation field `markerRole` and its type `StateMarkerRole` were renamed `markerKind` / `StateMarkerKind`, and the `StateMarker` primitive's prop `role` became `marker`. The mapping semantics, values, and consumers are unchanged — the old names falsely suggested an ARIA role while every marker output is decorative `aria-hidden` (the announcement channel is the adjacent word, never the marker). This note records the rename so the historical name above stays legible; no ADR decision changed.
