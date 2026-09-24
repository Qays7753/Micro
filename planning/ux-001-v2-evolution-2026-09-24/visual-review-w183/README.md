# Visual Review — WS-183 full-surface adaptation wave (2026-09-24)

Production build (`vite build`, budget PASS: raw 649,628 / gzip 154,067 B —
identical to the merged foundation baseline; CSS-only wave) served locally and
captured at 360×760 through the REAL first-run journey (Setup wizard → Home)
with real interactions. Dark mode was switched through the real Settings
appearance toggle (`document.documentElement.className === "dark"` verified).
The catalog item was created through the real product form (no fixtures).

## What this wave changed visually (WS-183, over the merged WS-182 foundation)

1. **Form controls now carry the V2 structural boundary** — `#78868D` visible
   border on every input/select/textarea (370+ `.micro-field` usages + the
   primitive field), replacing the near-invisible decorative divider. V2 field
   spec (tokens.css @ 1c990544 `--p-boundary`).
2. **Field focus halo = the approved V2 Information surface** `#DFEDF1`
   (`--vf-info-surface`, new in the bridge; dark keeps its current warm halo
   via a documented preservation rebind).
3. **Icon buttons are quiet again** — the accidental cascade that rendered
   every `.micro-icon-button` (header actions, sheet close, month nav…) as an
   accent-soft chip is fixed; single quiet definition (transparent + ink).
   Verified live: sheet close button computed `rgba(0,0,0,0)` + `#1D2930` +
   16px radius + 44px height.
4. **Unified list base** — `.micro-list` / `.micro-list-item` (8 TSX consumers)
   now have a real row-group base with internal 1px dividers (were completely
   unstyled); compact variant stays quiet inside cards.
5. **`.micro-field-hint` defined** (12 consumers previously unstyled).
6. **Six dual-definition selectors consolidated** (sheet-form, section-title,
   finance-event-list, local-truth, setup-page/heading) — final computed
   values preserved exactly; one cascade hazard removed from each.
7. **Header height tokenized** (`--vf-topbar-height`), **9 dead rule families
   removed** (proven 0 TSX consumers).

## VLM verification summary (glm-5v-turbo on the captures)

| Capture | Surface | Theme | Result |
|---|---|---|---|
| 01–03 | Setup wizard (name → wallet → select) | light | PASS — boundary-bordered select/inputs, readable ink, no glitches |
| 04 | Home (OVR-NOW) | light | PASS |
| 05 | Finance overview (full page) | light | PASS — white cards, tabular numbers RTL-aligned, no clipping |
| 06–07 | Orders + direct sale editor | light | PASS (fields/boundaries) — see note below on button semantics |
| 08–09 | Settings before/after real theme toggle | light→dark | PASS |
| 10–11 | Home + Finance | dark | PASS — warm dark preserved (`#211D18` family), NOT the cool light palette |
| 12 | Sale editor | dark | PASS |
| 13–14 | Catalog empty + with one real item | dark | PASS — clean list rows, readable Arabic |
| 15 | Catalog with item | light | PASS |
| 16 | Logo menu open | light | PASS — header icon buttons QUIET (no chips), clean white menu card |
| 17–18 | Quick action sheet (sale form) | light | sheet PASS — rounded top + grabber + readable rows; close button verified via computed style (transparent + ink) |

**Honest notes:**
- The VLM twice flagged "primary button is not terracotta" / "orange circle
  with a number". Both are false positives against Micro's OWN frozen button
  contract, not V2 violations: `save` actions are deliberately
  warm-ground + ink ("pressing is not success" — Button.tsx contract); only
  `create` actions carry the solid `#A94630` action (OD-01). The "orange
  circle" is the documented `.micro-sheet-action-icon` brand-soft tile
  (40px, #FBE9E2). Confirmed via live computed-style inspection.
- Captures cover 7 route families × both themes at one width (360px) and
  default text scale on desktop Chromium — NOT a substitute for the
  320/360/390/412 × 150/200% × real-device matrix, TalkBack/VoiceOver,
  daylight or UAT (external gates `DEVICE-001` / `UAT-001`).
- No console errors were emitted during any session.
