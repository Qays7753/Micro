# FINAL LIMITATIONS — honest NOT_RUN register

## Not performed in this run (claims stay NOT_RUN)

- **Physical-device capture** — no real phone/tablet was used; all captures are desktop Chromium (headless) with a mobile viewport (390x844, touch, ar-JO, Asia/Amman).
- **Screen-reader capture** — no NVDA/VoiceOver/TalkBack session; ARIA contracts are code- and jsdom-verified only.
- **Real-notch testing** — no device notch / safe-area-inset on real hardware; env() usage is inherited from prior accepted runs.
- **Hardware-keyboard testing** — keyboard contracts are jsdom/user-event + Chromium software keyboard events only.
- **OS 130%/200% text scaling** — not captured; responsive widths verified at 390px (plus the prior run's 320/360/430 matrix, unchanged surfaces).

## Evidence-level caveats

- Pixel verification samples background surfaces and identity colors at stride; it proves family membership (approved surfaces only, dark renders dark, clay present, no teal) — not a full per-pixel diff of every screen.
- The render-smoke harness walks routes with a fresh empty ledger; data-bearing states rely on the targeted behavioral tests and the captured real states (no-data, not-found, pressed, sheet, discard question).
- The dark palette's semantic-mark hues (info/status/success/error) were brightened for dark-mode floors; they were verified mechanically against the floors but not yet reviewed by the owner's eye on a physical device.
- `prefers-reduced-motion` rules are inherited from prior runs and were not re-captured this run (static verification only).
- The `:root.dark` cascade fix was proven in the real browser; any future reordering of token imports should keep the specificity contract test green (it will fail the build otherwise).

## Known accepted behaviors (documented, not defects)

- The unset theme preference is stored as "system" by the application service; the UI resolves it to LIGHT (product default). A stored "dark"/"light" always wins. There is no OS-following mode anymore — an owner decision (D1).
- The dark commit fill is the documented single inversion (warm paper fill + dark ink).
