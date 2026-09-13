# AUX CONTRACT — Micro Application Shell (W3)

The AUX shell owns chrome, placement, clearance, and overlay discipline. It never owns sale/expense business workflows or any product policy.

## Structure (verified at W3, commit 7e76e63)

| Piece | Location | Contract |
|---|---|---|
| App shell | `components/layout/MicroAppShell.tsx` | composes Header + router outlet + BottomNav + lazy QuickActionSheet (idle-prefetch); visualViewport keyboard heuristic sets `data-keyboard-open` |
| Header | `.micro-app-header` (index.css) | sticky, z 40, scroll border (`data-scrolled` → hairline + divider + frosted canvas 92%), context label from `navigation.ts` (17 contextual branches, 4 primary items); context label suppression when it would duplicate the screen heading |
| Bottom nav | `.micro-bottom-nav` + `BottomNav.tsx` | fixed, z 30, safe-area `env(safe-area-inset-bottom)`, frosted surface 94%, 5-column grid (4 destinations + FAB cell); items min-width 44px, min-height 56px, labels 13px with ellipsis guard (W3) |
| FAB | `.micro-fab` (inside BottomNav) | labeled in-grid «سجّل» (U-09 product-owned variant), 56px, translated −20px into its grid cell, Clay `--primary` (W1: text-bearing create class), label 13px (W3), never covers amount/action columns |
| Keyboard chrome hiding | `[data-keyboard-open="true"]` rules | header + bottom nav hide while the software keyboard is open; content, focused control, labels, and helper/error text never hide; chrome returns on close (Standard AUX addendum) |
| Route-kind chrome | `app/routeClassifier.ts` (`setup\|deep\|surface`) + `showsGlobalChrome` | surface-like reading/list screens keep the persistent nav; deep work/flow screens hide it to protect focus (U-10); bottom padding follows route depth (`.micro-main[data-route-kind]`) |
| Route transition | `.micro-page` | `micro-enter` at `--vf-motion-normal` (200ms) with `--vf-ease-out` (W3; was 260ms) — no page-wide layout animation; incoming screen states render immediately |
| Quick-action sheet | `components/layout/QuickActionSheet.tsx` | **shell only** (W3): mode dispatch (menu / sale-form / expense-form / receipt), open/close lifecycle, forms-protection discard guard, receipt display, wallets/suggestions prefetch (read-only). Field state, validation, and submission live in the Finance feature patterns |

## QuickActionSheet boundary (W3 separation)

```
AUX shell (QuickActionSheet)          Finance feature patterns
──────────────────────────────        ─────────────────────────────────
mode dispatch + titles                QuickSaleForm  — fields, validation,
open/close + discard question            submit (directSales), wallet
receipt (data only)                     attribution, idempotency key
wallets/suggestions prefetch          QuickExpenseForm — fields, category
refs: isDirty() / submit()              chips, submit (projectFinance)
```

- Forms stay mounted (via the `hidden` attribute) for the whole sheet session — **no silent reset** of typed input when navigating menu ↔ form (the forms-protection stack).
- The discard guard delegates dirtiness to the active form via its handle; "سجّله الآن" delegates submission the same way.
- Both flows end in the shell's receipt (`role="status"`) — the honest inline confirmation channel (U-07).
- Idempotency keys, wallet attribution notes, and error threading are byte-for-byte the pre-separation behavior (all 15 sheet tests green unchanged).

## Overlay discipline (contract; convergence scheduled W6)

- One active modal surface at a time; shared scrim `--vf-scrim` (warm ink 45%, W1) for the dialog family; vaul drawer carries its own token-driven scrim (same value).
- Z-ladder (§1.8, guard-enforced): content 0 · in-panel 1 · sticky 20 · nav+FAB 30 · header 40 · cover 50 · sheet 60 · toast 70 (toast tier reserved, none implemented — inline feedback is the ratified regime).
- Filter surfaces stage until Apply; Cancel/drag-away discards the draft (existing sheet family behavior).
- Destructive actions require confirmation and use the high-consequence contract (word + icon + explanation + independent path) — owned by the consuming surface, not the shell.

## Safe areas & geometry

`env(safe-area-inset-*)` on header, main scroll paddings, bottom nav, sheets, sticky footers (existing, verified); 320–430px phone widths; no horizontal overflow (guard + stylelint ladders).
