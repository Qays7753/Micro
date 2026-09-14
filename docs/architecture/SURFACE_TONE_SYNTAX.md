# SURFACE TONE SYNTAX — the UI/AUX display-attribute grammar

**Status:** Normative for `apps/prototype-web/client/src` (R2/D4 — centralized documentation of the approved surface tone syntax as UI/AUX semantics).
**Authority:** this document describes and binds the display grammar only. Meaning ownership (words, state semantics, financial truth) stays in domain/application and the Micro word dictionaries. Nothing here may change a state's meaning — only how a declared state is presented.

## 1. Why this document exists

Screens declare truth through attributes; CSS renders those attributes through semantic tokens. The chain is one-directional:

```
screen (owns words + declares state)
  → display attribute (this grammar)
    → CSS rule → semantic token (--vf-* / --color-*)
      → value (styles/vf-tokens.css light · styles/theme-dark.css dark)
```

No page may style a state with a raw color, and no CSS rule may invent a state the screen never declared. The grammar below is the complete approved vocabulary; additions require a change entry in `CHANGE_PROTOCOL.md`.

## 2. The attribute vocabulary

### 2.1 `data-tone` — surface knowledge accentuation

| Value | Meaning (UI/AUX semantics) | Token binding | Used by |
|---|---|---|---|
| `accent` | current/chosen-period accentuation of a knowledge surface | `--color-accent-*` family | `micro-info-card`, `micro-decision-panel`, `micro-schedule-section` |
| `warning` | attention/knowledge weight — never an outcome, never an error | `--color-warning-text/bg` (Micro-owned pair) | same surfaces + `micro-decision-surface`, `micro-actual-time-comparison` |

Rules: `data-tone` never colors an outcome (success/error flows through `StatusChip`/`Notice` instead); knowledge tones stay neutral-marked; the same attribute renders correctly in both themes because it resolves only through semantic tokens.

### 2.2 `data-status` — record-state slot

Carried by rows/chips whose record state is declared by the state adapter family (`stateAdapter.ts`). Values come from the record's status union (e.g. `warn`, `incomplete`, delivered/collection statuses). The **word** is always present and is the primary signal; the attribute only modulates the marker hue (see `primitives.css` `.micro-prim-chip[data-tone=…] > .micro-prim-marker` — note the chip's marker hue is keyed off the adapter's `tone`, not the raw status string).

### 2.3 `data-knowledge` — knowledge quality of a computed reading

| Value | Meaning |
|---|---|
| `incomplete` | the reading is missing mandatory inputs — displayed, not hidden |
| `stale` | inputs changed after the reading was computed |

Never rendered as failure; affects framing/labels only.

### 2.4 `data-void` — the honest void family (rendered void screens)

| Value | Meaning | Distinct from |
|---|---|---|
| `no-data` | nothing of this kind is recorded at all | `no-results` |
| `no-results` | records exist but the active filter/range excludes them all | `no-data` |
| `error` | the read itself failed — retry offered, nothing changed | both |

A void screen must declare exactly one `data-void` value, must not invent numbers, and must not borrow outcome colors. `no-data` vs `no-results` requires an unfiltered existence read (see `FinanceActivity`'s silent census, R2/D8); `error` vs `not_found` requires separating the failed read from the successful read of a missing id (see `OrderDetail`, R1).

### 2.5 Chosen/current — `aria-pressed` + `data-selected`

Interactive choices carry `aria-pressed` (or `data-selected` for non-button cells like `micro-month-cell`). The chosen presentation is **visually explicit** in both themes: the clay-interactive edge/underline (`--vf-clay-interactive`) for text actions (`.micro-text-action[aria-pressed="true"]`), the same edge + weight for `ChoiceRow` selections, and the segment-edge grammar for `data-selected` cells. Selection is never conveyed by color alone.

### 2.6 The typed feedback channel — `FeedbackKind`

Moment-of-action feedback is declared at the event source, never inferred from wording (R1/D6):

| Kind | Renders | Truth |
|---|---|---|
| `completion` | `QuietCompletion` (check marker + past-tense word) | a documented action happened |
| `advisory` | `Notice` (neutral) | knowledge about the display, not an outcome |
| `error` | `InlineError` (alert marker + error ink) | the action failed or is blocked pending correction |

Mixed outcomes (part succeeded, part failed) declare `error` — the residual failure is the actionable truth. The word is owned by the screen and never edited to fit the channel.

## 3. State-semantic invariants (binding)

- pending ≠ success · unknown ≠ failure · zero ≠ no-data · unavailable ≠ not-recorded
- no-data ≠ no-results · error ≠ not-found
- knowledge states never borrow outcome colors
- the non-color marker (word + marker shape) is the primary signal; hue is reinforcement

## 4. Theme rules

Every attribute above resolves exclusively through the semantic token layer: `--vf-*` contracts (single light source `styles/vf-tokens.css`, single dark source `styles/theme-dark.css`) and the Micro alias names in `index.css`. There are no theme-specific attributes, no dark-only components, and no page-local raw colors — `scripts/design-token-guards.py` fails the build otherwise, including the retired-value ban (`#964E33`, `#5F3120`, `#CC785C`, `#079FA0`, the v0 dark set) and the single-owner rule for dark hexes.

## 5. Verification hooks

- `primitives.test.tsx` — channel contract (kind → presentation), chip tone/word contract, ChoiceRow pressed/selected contract
- `U09.css.test.ts` — the pressed presentation carries the clay-interactive underline
- `R1.orderDetailVoid.test.tsx` — error vs not-found separation
- `R2.financeActivityVoid.test.tsx` — no-data vs no-results separation
- `scripts/design-token-guards.py` — no raw color outside token zones; retired values banned
