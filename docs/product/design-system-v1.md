# Micro — Design System

Authority: this document. Source of truth for values: `apps/prototype-web/client/src/index.css` (`:root`, `.dark`, `@layer base`) and the shared shell components (`AppHeader.tsx`, `MicroAppShell.tsx`, `InfoCard.tsx`).

Rules for the implementing agent:

1. Every color in §1.1 is frozen. No hue, shade, opacity, or substitution changes. A missing state color is derived from an existing token with `color-mix()`, never invented.
2. Every numeric value in this document is a hard constraint. Values not listed here are prohibited.
3. Where §4 conflicts with current code, §4 wins. Where this document is silent, do nothing.

---

## 1. Foundations

### 1.1 Color tokens — frozen

Primitives, light theme (`:root`):

| Token | Value | Semantic role | Allowed uses |
|---|---|---|---|
| `--color-bg-canvas` | `#faf9f5` | Application background | `html`, `body`, `.micro-app`, header base before blur |
| `--color-bg-well` | `#f0eee6` | Recessed surface | Inset panels, icon-button hover, quiet stat tiles, loading blocks |
| `--color-surface` | `#ffffff` | Raised surface | Cards, sheets, popovers, list containers, inputs |
| `--color-border` | `#eae6dc` | Hairline border | 1px borders, row separators, input border |
| `--color-divider` | `#dad5c8` | Stronger separator | Sheet grabber, neutral 3px rails, table rules |
| `--color-text-primary` | `#1f1e1d` | Text — primary | h1, h2, values, `strong` |
| `--color-text-strong` | `#33322e` | Text — control label | Field labels, header icon glyphs |
| `--color-text-secondary` | `#6e6a60` | Text — muted | Body copy, captions, secondary meta |
| `--color-text-tertiary` | `#b7b2a6` | Text — placeholder | Empty values, placeholder text only |
| `--color-brand-primary` | `#cc785c` | Brand fill | FAB, primary fill (dark theme), 2px/3px brand rules |
| `--color-brand-pressed` | `#b4613f` | Brand pressed/hover | `:hover` and `:active` of brand fills only |
| `--color-brand-text` | `#964e33` | Brand on light | Eyebrows, primary button fill (light theme), brand glyphs |
| `--color-brand-soft` | `#f4e4db` | Brand tint | Icon medallions, empty-state symbol backgrounds |
| `--color-accent-primary` | `#079fa0` | Accent fill | 3px accent rails, focus ring source |
| `--color-accent-text` | `#057b7c` | Accent on light | Text actions, active nav item, links, focus outline |
| `--color-accent-soft` | `#e3f5f5` | Accent tint | Active nav pill, accent-tone cards, accent chips |
| `--color-success-text` / `--color-success-bg` | `#2e7d57` / `#e4f2ea` | Confirmed / saved | Truth banners, save notes |
| `--color-danger-text` / `--color-danger-bg` | `#b42318` / `#fbe7e6` | Error / destructive | Field errors, destructive confirmation |
| `--color-warning-text` / `--color-warning-bg` | `#8a6927` / `#f6eccf` | Needs review / estimated | Warning cards, cost guidance |
| `--color-withdrawal-text` / `--color-withdrawal-bg` | `#3e5c76` / `#e8eef3` | Owner withdrawal ledger | Owner-ledger rows only |
| `--color-ink-on-color` | `#1f1e1d` | Ink on colored fill (dark theme) | `--primary-foreground` in dark |

Primitives, dark theme (`.dark`) — independently authored, not computed from light:

`--color-bg-canvas #1c1917` · `--color-bg-well #332d27` · `--color-surface #27231f` · `--color-border #51473c` · `--color-divider #62564b` · `--color-text-primary #fff7ed` · `--color-text-strong #fff7ed` · `--color-text-secondary #d6c9ba` · `--color-text-tertiary #a89b8c` · `--color-brand-primary #d59172` · `--color-brand-pressed #cc785c` · `--color-brand-text #8fd5d6` · `--color-brand-soft #332d27` · `--color-accent-primary #5ec0c1` · `--color-accent-text #8fd5d6` · `--color-accent-soft #332d27` · `--color-success-text #7fc49e` · `--color-danger-text #e47975` · `--color-warning-text #e2c268` · `--color-withdrawal-text #8aa5b8` · all state backgrounds `#332d27`.

Semantic aliases (consume these in components; never a raw hex in TSX or a component rule):

`--background` → bg-canvas · `--foreground` → text-primary · `--card`/`--popover` → surface · `--muted` → bg-well · `--muted-foreground` → text-secondary · `--accent` → accent-soft · `--accent-foreground` → accent-text · `--border`/`--input` → border · `--ring` → accent-text · `--destructive` → danger-text.
`--primary` = `--color-brand-text` in light, `--color-brand-primary` in dark. `--secondary` = `--color-accent-text` in light, `--color-accent-primary` in dark.

Derivation rule for missing states — the only permitted forms:

- Disabled surface: `color-mix(in srgb, <token> 40%, var(--color-surface))`.
- Translucent chrome: `color-mix(in srgb, <token> 92%, transparent)`.
- Focus ring: `0 0 0 3px color-mix(in srgb, var(--color-accent-primary) 18%, transparent)`.
- Selected row: `color-mix(in srgb, var(--color-accent-soft) 60%, var(--color-surface))`.

Dark-theme state backgrounds are all `#332d27`; a state in dark mode is therefore carried by `--color-*-text` plus an icon or a word, never by background alone.

### 1.2 Typography

Families: `--font-arabic: "IBM Plex Sans Arabic", sans-serif` for all UI text. `--font-numeric: "IBM Plex Mono", monospace` for every money amount, date, time, quantity, and counter. Loaded weights: Arabic 400/500/600/700; Mono 500/600. No other family, no other weight.

| Role | Size | Weight | Line-height | Color |
|---|---|---|---|---|
| Page title `h1` | 28px | 700 | 1.32 | text-primary |
| Setup title (`.micro-setup-heading h1`) | 31px | 700 | 1.32 | text-primary |
| Section title `h2` | 17px | 600 | 1.45 | text-primary |
| Sheet title | 20px | 700 | 1.40 | text-primary |
| Card/row lead `strong` | 15px | 600 | 1.6 | text-primary |
| Body `p` | 15px | 400 | 1.80 | text-secondary |
| Dense body / helper | 13px | 400 | 1.60 | text-secondary |
| Field label | 14px | 600 | 1.5 | text-strong |
| Eyebrow / overline | 12px | 600 | 1.40 | brand-text |
| Header context | 12px | 400 | 1.35 | text-secondary |
| Caption / row meta | 12px | 400 | 1.5 | text-secondary |
| Nav label | 11px | 500 | 1.2 | text-secondary (600 + accent-text when active) |
| Amount — hero | 26px | 500 mono | 1.2 | text-primary |
| Amount — inline | 16px | 500 mono | 1.4 | text-primary |
| Amount — meta | 12px | 500 mono | 1.5 | text-secondary |

Base `line-height: 1.7` on `body`. Sizes permitted: 11 / 12 / 13 / 14 / 15 / 16 / 17 / 20 / 24 / 26 / 28 / 31px. Nothing else. 11px is permitted only for the bottom-nav label and the calendar cell time.

Numeric rule: every numeric run is wrapped in `bdi`/`span` carrying `direction: ltr; unicode-bidi: isolate; font-family: var(--font-numeric); font-variant-numeric: tabular-nums`. Western digits only. Currency unit (`د.أ`) is Arabic text, outside the isolate.

Measure caps: `h1` ≤ 17ch, body ≤ 32ch, empty-state copy ≤ 31ch, sub-section copy ≤ 30ch.

### 1.3 Spacing

`--space-1 4` · `--space-2 8` · `--space-3 12` · `--space-4 16` · `--space-5 20` · `--space-6 24` · `--space-7 32`.

Permitted spacing values: 4 / 8 / 12 / 16 / 20 / 24 / 32px, plus 2px reserved exclusively for the label↔value pair inside a stacked list cell. Arbitrary values, negative margins, and `margin` on layout children are prohibited — spacing is produced by `gap` on the parent.

Assignment (fixed):

- Page stack (`.micro-page`) gap: 24px.
- Section internal gap (`.micro-section`): 12px.
- Card internal gap: 12px; card padding: 16px.
- Panel padding (hero/priority/review): 20px.
- Row internal gap: 12px; label↔value gap: 4px (2px inside dense rows).
- Form field gap: 8px; form card gap: 16px.
- Screen horizontal padding: 16px at every breakpoint.

### 1.4 Radii

`--radius-control: 12px` (buttons, inputs, icon buttons, chips-with-corners, medallions, inset tiles) · `--radius-card: 16px` (cards, panels, empty states, list containers) · `--radius-sheet: 20px` (bottom sheet, top corners only) · `999px` (status chips, pills) · `50%` (FAB only) · `0` (rows inside a bordered list container).

No other radius value. Nested elements always step down: a 16px card contains 12px children only.

### 1.5 Elevation

`--elevation-1: 0 1px 2px rgba(60,50,40,.06), 0 4px 12px rgba(60,50,40,.06)` — resting cards, primary button.
`--elevation-2: 0 6px 20px rgba(60,50,40,.10)` — the ≥641px app frame.
`--elevation-3: 0 16px 40px rgba(60,50,40,.16)` — FAB and bottom sheet.
Dark: `0 1px 2px rgba(0,0,0,.12)` / `0 6px 20px rgba(0,0,0,.20)` / `0 16px 40px rgba(0,0,0,.28)`.

A surface carries elevation **or** a tint (`accent`/`warning`/`well`), never both — tinted surfaces set `box-shadow: none`. Maximum one elevation-3 element on screen at a time.

### 1.6 Motion

Durations: 160ms for state changes (background, color, transform), 260ms for route enter (`micro-enter`). Easing: `--motion-out: cubic-bezier(.23,1,.32,1)` for enter/state, `--motion-in-out: cubic-bezier(.77,0,.175,1)` for sheet transitions. Pressed feedback: `transform: scale(.97)` on tap targets, `scale(.99)` on full-width rows. No other animated property. `prefers-reduced-motion: reduce` forces all durations to 0.01ms — already implemented, must not be removed.

### 1.7 Breakpoints

- Base (mobile-first): 320–640px. Design target widths: 360 / 390 / 430px.
- `min-width: 641px`: page background switches to `--color-bg-well`, `.micro-app` becomes a centered 640px frame with `--elevation-2`; header and bottom nav are pinned to the same 640px column.
- Component down-steps already in the sheet: `max-width: 380px` (grids collapse to 1 column), `max-width: 430px` (status summaries collapse), `max-width: 520px` (owner grids collapse).

Permitted breakpoints: 380, 430, 520, 641px. No new breakpoint may be introduced.

### 1.8 Z-index layers

Fixed scale — no other value, no `z-index` on non-layer elements:

| Layer | Value |
|---|---|
| Page content | 0 |
| In-panel raised content (`.micro-priority-content`) | 1 |
| Sticky sub-headers | 20 |
| Bottom navigation + FAB | 30 |
| App header | 40 |
| Sheet / dialog overlay | 50 |
| Sheet / dialog surface | 60 |
| Toast | 70 |

---

## 2. Layout rules

- Column: `width: min(100%, 640px); margin-inline: auto` for header inner, main, bottom-nav inner, and sheet. No other max-width.
- Document direction is `dir="rtl"`. Use logical properties only (`padding-inline`, `border-inline-start`, `margin-inline`). `left`/`right` are permitted only for the fixed bottom-nav edges and the ≥641px centering transform.
- Main padding: `16px 16px calc(16px + env(safe-area-inset-bottom))`. On routes that show global chrome (`data-route-kind="surface"`): bottom padding `calc(116px + env(safe-area-inset-bottom))`, `scroll-padding-block-end: calc(80px + env(safe-area-inset-bottom))`.
- Main must reserve the header: `scroll-padding-block-start: calc(56px + env(safe-area-inset-top) + 8px)` and `min-height: calc(100dvh - 56px - env(safe-area-inset-top))`.
- Vertical rhythm: every gap between sibling blocks in a page is 24px. Inside a section, 12px. Inside a card, 12px. Three values only — no per-screen exceptions.
- Grids: `repeat(2, minmax(0,1fr))` for stat pairs, `repeat(5, minmax(0,1fr))` for the bottom nav. Every grid child sets `min-width: 0`. A 2-column grid with an odd item count makes the final child `grid-column: 1 / -1`; a centered orphan tile is prohibited.
- Whitespace: no empty spacer elements, no `<br>` for spacing, no decorative dividers where a 24px gap already separates blocks. A separator is either a 1px `--color-border` line or a 24px gap — never both.
- Lists of ≥3 uniform rows use one bordered container with `border-radius: 16px; overflow: hidden` and 0-radius rows separated by 1px `--color-border` (last row: no border). Detached cards with 8px gaps are prohibited for uniform lists.

---

## 3. Component specifications

Every component below defines: geometry, and the states `default / hover / active / focus-visible / disabled / loading / empty / error`. A component shipped without all applicable states is rejected.

Global interaction rules:

- Minimum touch target: 44×44px. Text-only actions get `min-height: 44px; min-inline-size: 48px`.
- All hover rules are wrapped in `@media (hover: hover) and (pointer: fine)`. Bare `:hover` is prohibited — on touch it sticks after tap (visible in the screenshots as permanently tinted header buttons).
- Focus: `outline: 2px solid var(--color-accent-text); outline-offset: 2px` on every focusable element; inputs additionally use the 3px accent focus ring.
- Disabled: `opacity: .5; cursor: not-allowed; pointer-events: auto` + `aria-disabled="true"`. Disabled elements never change hue.
- Loading: `aria-busy="true"`, label replaced by the same label plus a 16px spinner, geometry unchanged (no collapse, no width jump). Buttons keep their width.

### 3.1 App header (`.micro-app-header`)

Geometry: `position: sticky; top: 0; z-index: 40; border-bottom: 1px solid var(--color-border); background: color-mix(in srgb, var(--color-bg-canvas) 92%, transparent); backdrop-filter: blur(18px)`.
Inner: `width: min(100%,640px); margin-inline: auto; display: flex; align-items: center; justify-content: space-between; min-height: calc(56px + env(safe-area-inset-top)); padding: calc(8px + env(safe-area-inset-top)) 16px 8px`. Desktop (≥641px): `min-height: 64px`, padding block 12px.
Content: brand lockup (36×36 mark in a 12px-radius frame + 18px/700 wordmark + 12px context label, `gap: 8px`, `min-width: 0`, wordmark `white-space: nowrap`, context label `text-overflow: ellipsis`) at the inline start; exactly two 44×44 icon buttons at the inline end, `gap: 8px`. Maximum two header actions. No third action, no badge, no chip.
States: default transparent icon buttons; hover `background: var(--color-bg-well)` (hover-capable pointers only); active `transform: scale(.97)`; focus-visible 2px accent outline; disabled per global rule. The header has no loading, empty, or error state — it renders identically on every route; only the context label changes.
Context label rule: the label must not repeat the page `h1`. When `getNavigationLabel(location)` equals the page title, the header renders the brand wordmark only and the context line is omitted.

### 3.2 Bottom navigation + FAB

Nav: `position: fixed; inset-inline: 0; bottom: 0; z-index: 30; border-top: 1px solid var(--color-border); background: color-mix(in srgb, var(--color-surface) 94%, transparent); backdrop-filter: blur(18px); padding-bottom: env(safe-area-inset-bottom)`. Inner: 5-column grid, `min-height: 64px`, padding `8px 8px 0`.
Item: `min-height: 56px`, column layout, `gap: 4px`, 21px icon, 11px/500 label, radius 12px. Active: `color: var(--color-accent-text); background: var(--color-accent-soft); font-weight: 600` + `aria-current="page"`. Hover (fine pointers): `background: var(--color-bg-well)`. Active-press: `scale(.97)`. Disabled: not permitted — a nav item is either present or absent.
FAB: 56×56, `border-radius: 50%`, `translateY(-20px)`, `background: var(--primary)`, `color: var(--primary-foreground)`, `--elevation-3`, 22px icon + 11px/700 label. Hover: `--color-brand-pressed`. Active: `translateY(-20px) scale(.97)`. Disabled: prohibited — the sheet always opens and disables individual actions instead.
Content clearance: any screen showing the nav reserves 116px + safe-area at the bottom (see §2). Content overlapped by the FAB is a defect.

### 3.3 Bottom sheet (`.micro-bottom-sheet`)

`max-width: 640px; margin-inline: auto; border-radius: 20px 20px 0 0; background: var(--color-surface); box-shadow: var(--elevation-3); z-index: 60`; overlay `z-index: 50`, `background: color-mix(in srgb, #1f1e1d 45%, transparent)`.
Grabber: 36×4px, `--color-divider`, radius 999px, margin-top 8px, horizontally centered.
Header: padding `16px 16px 8px`; title 20px/700; description 13px/1.6 muted, margin-top 4px. The close control is a 44×44 icon button aligned to the title's first line (`align-items: start`) and is the only element on the opposite inline edge; it uses the same transparent-by-default treatment as header icon buttons — a tinted resting background is prohibited.
Actions list: `display: grid; gap: 8px; padding: 8px 16px calc(20px + env(safe-area-inset-bottom))`. Action row: `min-height: 64px`, 1px border, radius 12px, padding `8px 12px`, `gap: 12px`, 40×40 medallion (radius 12, `--color-brand-soft` / `--color-brand-text`, 20px icon), title 15px/600, subtitle 12px muted with `margin-top: 2px`.
States: hover `background: var(--color-bg-well)`; active `scale(.99)`; disabled `opacity: .68; filter: saturate(.65)` with the medallion falling back to `--color-bg-well` / `--color-text-secondary`; loading — row keeps geometry, subtitle replaced by status text; empty — the sheet does not open with zero actions; error — inline 13px `--color-danger-text` line below the list, sheet stays open.

### 3.4 Buttons (`.micro-button`)

`min-height: 48px; padding: 0 16px; radius 12px; font 15px/600; gap: 8px; icon 20px; width: fit-content`.
Primary: `background: var(--primary); color: var(--primary-foreground); box-shadow: var(--elevation-1)`. Hover `--color-brand-pressed`. Active `scale(.97)`.
Secondary: `background: var(--secondary); color: var(--secondary-foreground)`; hover `--color-accent-primary`; no shadow.
Text action (`.micro-text-action`): transparent, `min-height: 44px; min-width: 48px; padding-inline: 8px`, 13px/600, `--color-accent-text`, 18px icon.
States: focus-visible 2px accent outline, offset 2px; disabled `opacity: .5; cursor: not-allowed`, no color change; loading `aria-busy="true"`, 16px spinner replaces the leading icon, width frozen; error is not a button state — errors render adjacent.
A full-width button is permitted only inside a form footer (`width: 100%`), never in a card body.

### 3.5 Cards

Info card (`.micro-info-card`): `background: var(--color-surface); radius 16px; padding 16px; gap 12px; box-shadow: var(--elevation-1)`. Slots in fixed order: eyebrow (12px/600 brand-text) → `h2` (17px/600) → copy (grid, gap 8px) → action.
Tones: `default` (surface + elevation-1) · `accent` (`--color-accent-soft`, no shadow, heading and eyebrow in `--color-accent-text`) · `warning` (`--color-warning-bg`, no shadow, heading and eyebrow in `--color-warning-text`). No other tone.
Decision panel (`.micro-decision-panel`): 3px `border-inline-start`, `border-radius: 0 12px 12px 0`, padding 16px, gap 12px; rail color `--color-divider` (default), `--color-accent-primary` (accent), `--color-warning-text` (warning). Rail width is 3px in every case.
States: hover — only if the whole card is a link/button (`background: var(--color-bg-well)`, fine pointers); active `scale(.99)`; focus-visible outline on the card; disabled `opacity: .5`; loading — skeleton block at `--color-bg-well`, radius 16px, exact height of the loaded card; empty — see 3.7; error — 13px `--color-danger-text` line in the copy slot.
Responsive: cards are full-width at every breakpoint. Side-by-side cards are prohibited below 641px.

### 3.6 Fields (`.micro-field`)

Label 14px/600 `--color-text-strong`; optional hint `small` 11px/400 muted on the opposite baseline; control `min-height: 48px`, 1px `--color-border`, radius 12px, padding 12px, `background: var(--color-surface)`; textarea `min-height: 112px; resize: vertical`; gap 8px.
Numeric input: `direction: ltr; unicode-bidi: isolate; font-family: var(--font-numeric); font-variant-numeric: tabular-nums; text-align: left`.
States: focus `border-color: var(--color-accent-primary)` + `box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-accent-primary) 18%, transparent)`; hover `border-color: var(--color-divider)`; disabled `background: var(--color-bg-well); color: var(--color-text-tertiary); opacity: 1`; loading — control disabled + `aria-busy`; empty — placeholder in `--color-text-tertiary`; error — `border-color: var(--color-danger-text)` plus a 13px `--color-danger-text` message tied by `aria-describedby`. Error state is never color-only: the message text is mandatory.

### 3.7 Stat cells, empty states, banners

Stat cell: label 12px muted → value mono (26px hero / 16px inline) → qualifier 12px muted; `display: grid; gap: 4px; min-width: 0`; label and qualifier use `overflow-wrap: anywhere` and are never clipped. Cells sit in `repeat(2, minmax(0,1fr))` with 1px `--color-border` rules; odd final cell spans both columns.
Empty state (`.micro-empty-state`): centered column, radius 16px, padding `24px 16px`, gap 12px, 72×72 symbol (radius 16, `--color-brand-soft`, 32px icon, `--color-brand-text`), copy ≤31ch, at most one action. Exactly one empty state per screen region; nested empty states are prohibited.
Truth banner (`.micro-truth-banner`): radius 12px, padding 12px, gap 12px, 24px icon, 13px copy, success tokens. Local-truth variant: 3px `border-inline-start` in `--color-success-text`, transparent background, padding block 8px.
Status chip: `min-height: 28px`, radius 999px, `padding-inline: 8px`, 12px/600, state text token on state background token.

### 3.8 Button system — sizes, order, destructive

Sizes (three only): `sm` `min-height: 40px; padding-inline: 12px; font-size: 13px` (inside rows and toolbars) · `md` `min-height: 48px; padding-inline: 16px; font-size: 15px` (default) · `lg` `min-height: 56px; width: 100%; font-size: 16px` (form footer, sheet confirm).
Icon-only button: 44×44, radius 12px, transparent, `aria-label` mandatory, 20px glyph. A tinted resting background on an icon-only button is prohibited outside the active nav item.
Order in RTL: the primary action is the **first** child in DOM and sits at the inline start (right); secondary follows; a destructive action is placed last and separated by a 16px gap. Maximum two buttons in one action row; a third action becomes a text action or moves into a sheet.
Destructive: `background: var(--color-danger-bg); color: var(--color-danger-text)` at rest; solid `--color-destructive` with `--color-surface` text only inside a confirmation dialog. Every destructive action requires a confirmation dialog with the object name in the title.
Hit spacing: minimum 8px between adjacent tap targets; two 44px targets may not share an edge.

### 3.9 Dialog, toast, tooltip

Dialog: `width: min(100% - 32px, 420px)`, radius 16px, `--color-surface`, `--elevation-3`, padding 20px, gap 16px, overlay `z-index: 50` / surface `60`. Title 20px/700, body 15px muted, actions row bottom-aligned per §3.8. Focus is trapped; `Esc` closes non-destructive dialogs only; the initially focused control is the least destructive one.
Toast (`sonner`, `position: top-center`, `dir="rtl"`): `width: min(100% - 32px, 420px)`, radius 12px, padding `12px 16px`, 13px/1.6 text, `--elevation-2`, `z-index: 70`, offset `calc(56px + env(safe-area-inset-top) + 8px)` so it clears the header. Duration 4000ms, 6000ms with an action, persistent for errors. Tones: success / danger / warning tokens; text plus a 20px icon, never color alone. Maximum one toast visible; the second replaces the first.
Tooltip: desktop pointers only (`@media (hover: hover) and (pointer: fine)`), 12px text, radius 12px, padding `8px 12px`, `--color-text-primary` on `--color-surface` with 1px `--color-border`, 200ms delay. A tooltip never carries information required to complete a task; on touch the same content ships as a 12px helper line.

### 3.10 Loading & skeleton

Spinner: 16px inside controls, 24px standalone, 2px stroke, `currentColor`, 800ms linear rotation; suppressed under `prefers-reduced-motion` and replaced by static text.
Skeleton: `--color-bg-well` blocks at the exact geometry of the loaded content, radius matching the target (16px card / 12px control), no shimmer, no pulse. Route loading block: `min-height: 280px`, radius 16px, centered 15px muted label.
Any operation over 400ms shows a loading state; any state shown is held for at least 300ms to avoid flicker. Layout must not shift between skeleton and content.

### 3.11 Sticky form footer & unsaved-changes guard

Form footer: `position: sticky; bottom: 0; z-index: 20`, `background: var(--color-surface)`, `border-top: 1px solid var(--color-border)`, `padding: 12px 16px calc(12px + env(safe-area-inset-bottom))`, single `lg` primary button plus one text action. Forms are deep routes and do not render the bottom nav; the two must never coexist.
Unsaved-changes guard uses the dialog spec in §3.9: title names the record, primary action is "stay", destructive action discards.

### 3.12 Icons

`lucide-react` only. Sizes: 16 (inline text), 18 (text action), 20 (button, medallion, header), 21 (nav, section heading), 22 (FAB), 24 (banner), 32 (empty-state symbol). Stroke width 2 at every size; 1.75 permitted at 32px only. `aria-hidden="true"` whenever a text label is adjacent. Icons take `currentColor` — never a hard-coded fill. Hand-drawn SVG, emoji, and imported icon sets are prohibited.

---

## 4. Issues found & required fixes

Observations are from the supplied mobile screenshots; causes are from the CSS and shell components named above.

| # | Observed in screenshot | Cause | Required fix |
|---|---|---|---|
| 1 | Header icon buttons render with a persistent tinted square background on some screens and a grey one on others | `.micro-icon-button:hover` is unguarded; touch keeps `:hover` after tap | Wrap all `:hover` rules in `@media (hover: hover) and (pointer: fine)`. Resting header/sheet icon buttons: `background: transparent` |
| 2 | Header consumes ~13% of a 360×800 viewport | `min-height: calc(56px + safe-area)` plus `8px` block padding stacks on top of the safe area | Header inner: `min-height: calc(56px + env(safe-area-inset-top))`, `padding: calc(8px + env(safe-area-inset-top)) 16px 8px`, total content box exactly 56px + inset; 64px at ≥641px |
| 3 | First card is clipped by the sticky header when the page is scrolled or restored | `.micro-main` has no `scroll-padding-block-start` and `min-height` subtracts a bare 56px | Add `scroll-padding-block-start: calc(56px + env(safe-area-inset-top) + 8px)`; `min-height: calc(100dvh - 56px - env(safe-area-inset-top))` |
| 4 | Header and bottom nav can overlap sheets and toasts unpredictably | Both are `z-index: 30`; no declared scale | Apply §1.8 exactly: nav 30, header 40, overlay 50, sheet 60, toast 70 |
| 5 | Header context label repeats the page title verbatim ("مالي" over "مالي", "العمل" over "العمل") | `AppHeader` always renders `getNavigationLabel(location)` | Omit the context line when it equals the page `h1`; render the wordmark alone |
| 6 | Vertical gaps between cards differ across screens (≈8px in the sheet, ≈24px in the finance list, ≈32px elsewhere) | Per-screen gaps set locally instead of by the three-tier rhythm | Enforce §2: page 24px, section 12px, card 12px. Remove all other gap declarations |
| 7 | Uniform list rows render as detached cards with unequal gaps and inconsistent corners | Mixed use of `.micro-info-card` and `.micro-intent-card` for the same content class | Uniform lists use one 16px-radius bordered container with 0-radius rows and 1px separators (§2) |
| 8 | Stat labels are clipped at the cell edge ("دين مسجل بعد التسليم") | Grid children lack `min-width: 0` and wrapping | Stat cells: `min-width: 0; overflow-wrap: anywhere`; no `white-space: nowrap` on labels |
| 9 | Three-tile stat block leaves one centered orphan tile on the second row | `repeat(2, minmax(0,1fr))` with 3 children | Final child in an odd 2-column grid: `grid-column: 1 / -1` |
| 10 | Bottom content sits under the FAB and the final paragraph is partly hidden | Bottom clearance applied only to `data-route-kind="surface"` | Apply `--main-bottom-space: calc(116px + env(safe-area-inset-bottom))` on every route that renders the bottom nav |
| 11 | Bottom sheet close button is a tinted square pushed to the far inline edge, visually heavier than the title | Tinted background on the sheet close control; `justify-content: space-between` with no max title measure | Close control: transparent 44×44 icon button, `align-self: start`, aligned to the title's first line; title `max-width: 24ch` |
| 12 | Eyebrow → title → paragraph repeats up to three times per screen, flattening hierarchy | Eyebrow used on both page headings and cards without limit | Maximum one eyebrow per screen region: page heading **or** cards, never both |
| 13 | Radii are inconsistent within one card (16px shell, 12px tiles, 0 rows, 999px chips visible together) | No nesting rule | A 16px card contains only 12px children; chips 999px; rows inside a bordered container 0. No other combination |
| 14 | Mixed surface treatments in one column: white + shadow, tinted + rail, tinted + shadow | Tone variants applied on top of elevated cards | Tinted surfaces set `box-shadow: none` (already true for `data-tone`); never add a rail to an elevated card |
| 15 | Bottom-nav labels at 11px against `--color-text-secondary` on a translucent surface are the least legible text on screen | Inherited from the 11px nav scale | Keep 11px, raise inactive label weight to 500 and color to `--color-text-strong`; active stays `--color-accent-text` 600 |
| 16 | Header hairline is invisible over the blurred canvas on light backgrounds | `--color-border` at 92% canvas mix | Header border: `1px solid var(--color-divider)` when scrolled (`[data-scrolled="true"]`), `--color-border` at rest |
| 17 | In dark mode, `--color-accent-soft`, `--color-brand-soft`, and every state background are all `#332d27` — the active nav pill, accent cards, warning cards, and success banners become indistinguishable from `--color-bg-well` | Single shared dark tint token value | Keep the hex values frozen; separate the states structurally instead — dark mode adds `1px solid var(--color-<state>-text)` at 40% mix to tinted surfaces and marks the active nav item with `color: var(--color-accent-text)` plus `font-weight: 600`. No new hex is introduced |
| 18 | Bottom nav and FAB stay pinned over the on-screen keyboard on form screens | `position: fixed` with no visual-viewport handling | Global chrome is hidden while a field is focused (`visualViewport.height < window.innerHeight - 120`); forms are deep routes with no bottom nav (§3.11) |
| 19 | `<meta name="theme-color">` is hard-coded to `#CC785C`, so the system status bar does not follow the theme | Single static meta tag | Two tags: `media="(prefers-color-scheme: light)" content="#faf9f5"` and `media="(prefers-color-scheme: dark)" content="#1c1917"`, updated on manual theme toggle |
| 20 | `--color-text-tertiary` (`#b7b2a6` on `#faf9f5`) is used for values, not only placeholders | Token applied beyond its role | Restrict `--color-text-tertiary` to placeholder and empty-value text; any meaningful text uses `--color-text-secondary` or darker |

---

## 5. Prohibitions

1. No new color value of any kind. No hue rotation, no lightening, no darkening, no opacity substitutes for the tokens in §1.1. Missing states use only the four derivations listed there.
2. No gradients. The two existing legibility scrims (`.micro-review-intro-copy`, priority overlay) are the complete permitted set; no gradient may be added to a button, card, header, nav, or background.
3. No shadow other than `--elevation-1/2/3`. No colored shadows, no glows, no `filter: drop-shadow`, no shadow on tinted surfaces.
4. No emoji anywhere in the UI. Icons are `lucide-react` only, at 16 / 18 / 20 / 21 / 22 / 24 / 32px.
5. No radius outside 0 / 12 / 16 / 20 / 999px / 50%. No `border-radius` shorthand that mixes unlisted values.
6. No spacing value outside 4 / 8 / 12 / 16 / 20 / 24 / 32px (2px only for label↔value pairs). No arbitrary Tailwind values (`p-[13px]`, `gap-[18px]`), no negative margins, no `margin` for inter-block spacing.
7. No font other than IBM Plex Sans Arabic and IBM Plex Mono. No font-size outside §1.2. No weight outside 400/500/600/700.
8. No animation beyond 160ms state transitions and the 260ms route enter. No looping, pulsing, bouncing, floating, parallax, shimmer, or entrance animation on cards, icons, or numbers.
9. No `:hover` rule outside `@media (hover: hover) and (pointer: fine)`.
10. No component without a defined default / hover / active / focus-visible / disabled / loading / empty / error state. A component missing an applicable state does not ship.
11. No touch target below 44×44px. No text action below `min-height: 44px; min-inline-size: 48px`.
12. No `z-index` value outside §1.8. No `z-index: 9999`.
13. No physical-direction CSS (`left`, `right`, `margin-left`, `text-align: left`) except the two exemptions in §2 and the `direction: ltr` numeric isolates.
14. No raw hex in `.tsx` or in component-level CSS when a semantic token exists.
15. No color-only state signalling. `estimated`, `missing`, `needs_review`, error, and success states carry text or an icon in addition to color.
16. No third header action, no decorative header badge, no duplicated brand mark inside page content.
17. No dark theme derived by inverting light values; every dark token is authored explicitly.
18. No new breakpoint beyond 380 / 430 / 520 / 641px, and no layout wider than 640px.
19. No decorative divider where a 24px gap already separates blocks; no empty spacer elements or `<br>` used for spacing.
20. No unlabelled icon-only control, no tooltip carrying task-critical information, no third action in an action row.
21. No external UI kit (Material, Figma community kits, template themes) imported as identity. Behaviour may be reimplemented with Micro tokens; assets and styles may not be copied in.

---

## 6. Content, numbers, and dates

- Currency: two decimals always (`13.20`, `0.00`), Western digits, `.` decimal separator, `,` thousands separator, unit `د.أ` rendered as Arabic text after the isolated numeric run, separated by one space. Negative values use a leading `-` inside the isolate, never parentheses, never color alone.
- Unknown vs zero: an unrecorded value renders `—` in `--color-text-tertiary` plus a 12px qualifier. `0.00` means a recorded zero and is never substituted for unknown.
- Estimated or partial values carry a 12px qualifier line and, where the state is financial, the warning tone. Never a bare number.
- Dates: `DD MMM YYYY` with Arabic month names and the numeric parts isolated LTR in mono. Times `HH:mm`, 24-hour.
- Counters and quantities use mono + `tabular-nums` so columns align across rows.
- Labels: nominal phrases, no trailing punctuation, no ALL-CAPS, no exclamation marks. Sentence copy ends with a full stop.
- Maximum lengths: `h1` 40 chars, card `h2` 48, eyebrow 24, nav label 10, button label 24. Longer strings are rewritten, not truncated. Only user-entered data may ellipsize, and only on one line.

## 7. Accessibility

- Contrast minimums: 4.5:1 for text below 24px, 3:1 for text ≥24px/700 and for meaning-bearing icons and borders. Every pair is measured in both themes before use; a failing pair is fixed by choosing a different existing token, never by editing a hex.
- `--color-text-tertiary` is placeholder-only in both themes and is prohibited for any text a user must read.
- Focus-visible is mandatory and never removed: `outline: 2px solid var(--color-accent-text); outline-offset: 2px`. Focus order follows DOM order; dialogs and sheets trap focus and restore it to the trigger on close.
- Every icon-only control has `aria-label`; every color-carried state also has text or an icon; every input has a `<label>` and, on error, `aria-invalid` + `aria-describedby`.
- Touch targets 44×44px minimum, 8px minimum separation.
- Layout survives 200% text zoom at 360px width with no clipping and no horizontal scroll; all fixed heights are `min-height`.
- `prefers-reduced-motion: reduce` disables all transitions and route animation.
- `lang="ar" dir="rtl"` declared at document level; Latin and numeric runs bidi-isolated.

## 8. Mobile runtime

- Safe areas: `env(safe-area-inset-top)` on the header; `env(safe-area-inset-bottom)` on the bottom nav, sheet actions, form footer, and main padding. Hard-coded 20/34px insets are prohibited.
- Keyboard: while a field is focused, global chrome is hidden and the sticky form footer rides the visual viewport; content must never sit under the keyboard.
- Viewport heights use `100dvh` only; `100vh` is prohibited.
- `theme-color` follows the active theme (issue 19). Theme switching applies instantly with no color cross-fade.
- Scroll: one scroll container per screen (`main`). Nested vertical scroll areas are prohibited; horizontal scroll is permitted only for the month calendar (`min-width: 332px`, `overscroll-behavior-inline: contain`).
- `backdrop-filter` degrades to the opaque token (`--color-bg-canvas` / `--color-surface`) where unsupported — never to a transparent bar.

## 9. Governance and enforcement

Definition of done for any UI change:

1. No raw hex, rgb, or hsl literal in `.tsx` or component CSS — enforced by a lint rule that fails the build.
2. No spacing, radius, font-size, or z-index value outside §1 — enforced by a stylelint allow-list.
3. Every new component ships all applicable states from §3 plus a dark-theme check.
4. Verified at 360 / 390 / 430px, both themes, RTL, long Arabic strings, 200% zoom.
5. Adding a token requires a canonical decision record; a token is added only when no existing token carries the meaning, never for a visual preference.
6. This document is updated in the same change that alters a value; code and document may not diverge.

---

## 10. Text density — truth in the number, not in the sentence

The system's honesty is enforced in types and numbers, never narrated on
screen. A card that explains itself is a defect.

Measured on the merged build, 2026-08: `Finance.tsx` 99 user-visible strings,
`OrderDetail.tsx` 59, the Home service 84. Home cards carried the five
financial boundaries as printed sentences — "…؛ ليس ربحًا", "…، وليس كاشًا
محصلًا". The boundaries belong in the domain and in the numbers, not on the
card face.

### 10.1 Hard caps — enforced in CI

| Surface | Max user-visible strings |
|---|---|
| Home | 15 |
| Any single screen | 30 |
| Any card | 3 — label, value, at most one qualifier |
| Any screen region | 1 full sentence |

Counted as: distinct user-visible string literals rendered at rest, in the
page module and in the service that feeds it. A count script runs inside
`pnpm check` and fails the build over the cap. Without an automated guard the
prose returns — it returned once already, against ten written principles.

### 10.2 Rules

1. A card never explains itself. Label plus value. The explanation lives
   behind a 44×44 `ⓘ` control, never on the surface.
2. The five financial boundaries are never printed. They are enforced in the
   domain and expressed through label precision. Strings of the form
   "…، وليس كذا" or "…؛ ليس ربحًا" are prohibited.
3. Unknown renders as `—` in `--color-text-tertiary` plus at most a 12px
   qualifier (§6). It never renders as a sentence.
4. Guidance appears once, at the moment of the action, and dies. A hint that
   survives a reload is screen furniture and a defect.
5. An action is a button, never a paragraph.
6. If an explanation is needed twice, the label is wrong. Fix the label and
   delete the explanation.
7. Read the screen aloud. Over 15 seconds means it carries surplus words.

Removing prose must not remove truth. Every fact deleted from a sentence
stays readable from the label, the state chip, or the `ⓘ`.

### 10.3 Prohibitions — continuing §5

22. No explanatory sentence on a card face.
23. No printed statement of what a value is *not*.
24. No persistent instructional copy on any surface.
25. No sentence where a label, a state chip, or an `ⓘ` carries the meaning.
