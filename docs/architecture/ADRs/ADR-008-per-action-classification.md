# ADR-008: Per-action classification of every legacy action (completion run)

**Status:** Accepted (2026-09-14, completion run W2; re-executed with the all-roots scope after session loss)
**Context:** After the foundation run, 150 legacy `micro-button-primary` usages all rendered identity-Clay (the W1 rebinding of `--primary`), flattening the action hierarchy the Standard requires. Blanket-converting them to one class would repeat the same mistake in a new form.
**Decision:** Every usage was classified by actual product meaning, then migrated to the Button primitive:
- **create (17)** — opens a new-record journey (`/new` routes, add/register actions, dedicated entry sheets).
- **commit (8 + 1 conditional)** — high-consequence confirmation behind an independent path (delivery review, correction dialogs, data replacement, reversal editors with documented reason); the CorrectionPreview confirm is `destructive` when its correction is dangerous, else `commit`.
- **destructive (1 + danger family 8)** — order cancellation with reason; legacy danger entries.
- **save (72 + 1)** — ordinary saves/confirms, retries (including the StartupGate storage-recovery reload, per the Home pilot precedent), run/report actions, in-flow section actions.
- **secondary (45 + legacy 113)** — navigation and neutral dialog choices; navigation is never a commit.
- **quiet (36)** — documented correction/reversal entry points (MR-03/U09 touch floor), added to the primitive as a proven action class.
- **ChoiceRow (9 toggles)** — selection pairs use the edge contract, never fills.
**Consequences:** Visual hierarchy now matches meaning (create Clay, save warm+edge, commit ink, destructive error-ink, navigation neutral). One-tap lifecycle transitions without confirmation paths deliberately use `save`, not `commit` — the commit class requires an independent confirmation path per the Standard; inventing dialogs is a product decision (registered in MIGRATION_STATUS, not taken). The census covers all source roots and is guarded by `legacyClassCensus.test.ts`.
