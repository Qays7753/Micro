# ROLLBACK INSTRUCTIONS

## Global restore point

`ece7be3630739d551b9ba7caf37d30a9a63c872f` — the verified remote head before this resume run.

**Mechanically rehearsed this run:** a detached scratch worktree at that commit resolved cleanly (0 modifications), confirmed the pre-dark state (no `theme-dark.css`; the v0 `.dark` block present), and was removed without touching the branch. The rehearsal used no reset, no force, no history rewrite.

## Option A — full rollback of this run (preferred)

The run's commits are small and revertible. On a clean worktree of the target branch:

```bash
git status                       # must be clean
git revert --no-commit <newest>..<oldest-range>   # or revert the run's commits individually
git commit -m "revert: remediation-closure run"
git push origin micro-standard-ui-aux-integration-20260914
```

Or, to rebuild the branch exactly at the restore point **without rewriting shared history**, create a revert commit series (same as above). Do NOT `reset --hard` + force-push the shared branch.

## Option B — per-wave rollback

Each wave is one commit (see `WAVE_STATUS_MATRIX.csv`): revert the specific commit to withdraw that wave only. Waves are ordered so R1/R2 (remediation) are independent of R3/R4 (dark mode), except R4's cascade fix belongs with R3.

## Option C — dark-layer-only rollback (light-only product)

See `ROLLBACK_MANIFEST.json` `darkLayerOnlyRollback`. This requires guard/test adjustments and is NOT preferred over the restore point.

## What rollback restores

- The v0 `.dark` block and the OS-following theme behavior (pre-run state) — including the values this run deliberately retired. This is why the full run, not the dark layer alone, is the recommended rollback unit.
- Light layer: identical in both directions (never modified — byte-for-byte verified).
