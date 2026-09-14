# ADR-002: Runtime token mapping is the single bridge

**Status:** Accepted (W1, commit c81489a; verified closed in the completion run — 0 unresolved references, 0 multi-file token definitions)
**Context:** The Standard owns 18 approved hex values; Micro's runtime had its own legacy names. Two palettes would compete.
**Decision:** `styles/vf-tokens.css` is the ONE place Standard hex values live inside Micro, exposed as `--vf-*`. Legacy Micro names in `index.css` `:root` were rebound as aliases to `var(--vf-*)` (nothing deleted while consumers lived). The only derivatives are the disclosed functional composites (scrim, translucent header, elevation shadow tone) plus Micro-owned text-safe semantic inks (success/warning text pairs) recorded in the mapping header. The design-token guard (`scripts/design-token-guards.py`) enforces: no raw hex AND no rgb/hsl literals outside the sanctioned zones, in CSS and TSX alike (hardened in the completion run per the Agent-3 audit).
**Consequences:** Any new color must enter through the Standard first, then this file — never through a component or page. A second token source is a hard stop.
