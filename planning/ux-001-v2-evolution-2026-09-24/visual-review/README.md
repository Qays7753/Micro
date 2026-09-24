# Visual Review — UX-001 Phase 2 V2 evolution (2026-09-24)

Production build (`vite build`, budget PASS: raw 649,628 / gzip 154,069 B)
served locally and captured at a 360×760 phone viewport through the full
first-run journey (Setup wizard → Home) with real interactions; dark mode was
switched through the real Settings appearance toggle (not a class hack), and
the runtime `meta[name=theme-color]` rewrite was verified live (`#211d18`).

Automated vision verification (VLM) on the captures confirmed:

1. **Home (light)** — cool gray-blue canvas (#F0F3F4 family), dark blue-black
   ink, solid terracotta action buttons with white text, no glitches. `PASS`
2. **Finance (light vs dark)** — light carries the V2 cool palette; dark
   keeps the ORIGINAL warm dark palette (#211D18 family, warm off-white ink,
   terracotta identity accents) exactly as the preservation boundary requires.
   Both readable, no broken cards. `PASS`
3. **Sale editor (light) + Orders (dark)** — fields with visible borders and
   readable labels; solid terracotta primary with white text; warm dark rows
   readable; bottom nav shows 5 tabs with the selected tab distinguished by
   color + weight, no filled pill. `PASS`

Captures (360×760, Chromium headless):

| File | Surface | Theme |
|---|---|---|
| `01-setup-step1-light.png` | Setup — project name | light |
| `02-setup-step2-light.png` | Setup — wallet | light |
| `03-home-light.png` | Home (OVR-NOW) | light |
| `04-finance-light.png` | Finance (FIN-OVERVIEW, full page) | light |
| `05-orders-light.png` | Orders | light |
| `06-sale-editor-light.png` | Direct sale editor (OPS-SALE-CREATE deep form) | light |
| `07-settings-light.png` | Settings | light |
| `08-settings-dark.png` | Settings (after real theme toggle) | dark |
| `09-home-dark.png` | Home (full page) | dark |
| `10-finance-dark.png` | Finance | dark |
| `11-orders-dark.png` | Orders | dark |
| `12-sale-editor-dark.png` | Direct sale editor | dark |

**Honest limitations:** captures cover 5 route families × both themes at one
width (360px) and default text scale on desktop Chromium — NOT a substitute
for the 320/360/390/412 × 150/200% × real-device matrix, TalkBack/VoiceOver,
daylight or UAT, which remain external gates (`DEVICE-001`, `UAT-001`) as
recorded in the Phase 1 map. No console errors were emitted during the
session.
