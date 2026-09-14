# ADR-007: Dark Mode remains a separate semantic boundary

**Status:** Accepted (W7 of the foundation run; unchanged by the completion run)
**Context:** The Standard is light-first. Micro carries a legacy `.dark` block predating the integration. Activating dark mode mid-run would couple an unaudited palette to a production surface.
**Decision:** Dark Mode is NOT activated in either integration run. The `.dark` block stays preserved Micro-local. `DARK_MODE_BOUNDARY.md` (run folder) documents the future semantic-role layer proposal, parity-testing rules, and six owner-gate rules. Activation requires: semantic roles extended only inside the isolated boundary, parity tests across all surfaces/states/overlays, and a separate owner gate.
**Consequences:** No dark tokens enter the Standard; no default changes; any dark-styles PR before the gate is out of scope. Superseding this ADR requires the owner-approved dark wave and its own ADR.
