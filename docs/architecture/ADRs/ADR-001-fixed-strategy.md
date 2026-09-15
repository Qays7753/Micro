# ADR-001: The fixed integration strategy

**Status:** Accepted (2026-09-14, integration run; re-ratified unchanged in the completion run)
**Context:** Micro needed a controlled way to adopt the Micro Standard v2 visual contracts without redesigning product meaning or disturbing financial semantics.
**Decision:** The strategy chain is fixed and non-negotiable: **Contract-first → Token-driven → Component-driven → Feature-oriented → Composition-based**, with the 7-layer authority ladder (Standard → runtime mapping → primitives → AUX → feature patterns → screens → domain) documented in `UI_AUX_ARCHITECTURE.md`. Every visual/behavioral rule has exactly one authoritative definition; all other layers consume via mapping or composition.
**Consequences:** New abstractions require proven repeated behavior with the same meaning and lifecycle; visual similarity alone never justifies extraction. This ADR may only be superseded by an explicit owner decision recorded as a new ADR.
