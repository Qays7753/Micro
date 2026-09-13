# SCREEN COMPOSITION MAP — Pilots and Screen Contracts (W4)

Pilot selection per the wave plan: **Home first** (exercises shell, value zone, rows, states, composition), then **Finance** (high-sensitivity financial screen). Both pilots' financial meaning is unchanged (verified by the journey/DOM suites asserting the same copy and flows).

## Pilot 1 — Home (`pages/Home.tsx`)

| Contract element | Value |
|---|---|
| One goal | Answer "what needs me now?" — today's items and the honest state of the owner's money |
| Primary action | Contextual per block: fact roads («سجّله»), today-item actions, section navigation |
| Hierarchy | fact triad (known/unknown/unrecorded) → today list → away digest → recent activity; sections in one scroll owner (`.micro-main`) |
| Scroll ownership | the page (`data-route-kind="surface"` bottom padding keeps the nav clear) |
| States | loading = honest text (stale-while-revalidate, no flicker); error = explanation + retry; empty facts = void words with roads |
| Keyboard behavior | chrome hides on keyboard; inputs are few (none at rest) |
| Exit paths | every journey saves its source (return navigation contract); bottom nav + FAB always available |
| Primitives/patterns consumed | W4: `Button` (retry + 2 section actions → ordinary `save` class — they are navigation/retry, not create); `MoneyValue` (kept); honest-void fact triad (Micro-owned pattern, preserved — richer than the Standard's void chips) |
| Deliberately NOT changed | the fact triad's presentation (Micro pattern), the away digest, `MoneyValue + د.أ` literal composition (density-gate measurement — see W4 report) |

## Pilot 2 — Finance (`pages/Finance.tsx`)

| Contract element | Value |
|---|---|
| One goal | The financial truth of the project: position, events, corrections — with explicit knowledge states |
| Primary action | Contextual: record/review/correct within layers (`<details>` disclosure grammar — Micro-owned composition device) |
| Hierarchy | position summary → review pulse → decision surfaces → events layer (collapsible) |
| Scroll ownership | the page; layers disclose in-flow (overlay-vs-in-flow contract: continuous reading stays in-flow) |
| States | loading (honest), error (explanation + retry), knowledge states on values («تقديري», «غير محدد بعد»), correction trails preserved |
| Primitives/patterns consumed | W4: `MoneyWithUnit` for the unallocated-cash note (unit beside the bidi-isolated number); position cards keep `MoneyValue` compositions |
| Deliberately NOT changed | EventsLayer/CorrectionsLayer structure, decision-card grammar, all financial copy and semantics |

## Adoption notes (recorded for the migration matrix)

- Home error retry: was filled-primary (post-W1: Clay create class) → `Button action="save"` (ordinary action). Correct per the action ladder: retry/navigation are not creation.
- Home finance-unit and catalog-unit actions: same reclassification.
- Finance unallocated note: `MoneyValue + " د.أ"` → `MoneyWithUnit` — the value-zone composition contract (unit never inside the isolated number).
- Home recent-amount keeps the literal composition: the text-density gate counts the unit string as a distinct at-rest literal on Home (it was historically uncounted JSX text there); the MoneyWithUnit adoption is demonstrated on Finance instead. Recorded honestly, not silently.

## Visual review evidence (W4 gate)

`visual-review/` — real Chromium captures of the production build (vite preview, light theme, RTL):
`home-320.png`, `home-390.png`, `finance-320.png`, `finance-390.png`, `capture-log.json`.

Programmatically verified per capture: **zero horizontal overflow at 320px and 390px; zero console/page errors; four distinct screens; Clay identity (#D97757) present in the FAB region.** First-run setup was completed by the driver (project name «مشروع المراجعة») so real screens render. Labeled: review evidence only — not product truth.
