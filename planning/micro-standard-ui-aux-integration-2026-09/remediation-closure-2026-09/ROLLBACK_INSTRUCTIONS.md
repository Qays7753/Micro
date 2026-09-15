# ROLLBACK INSTRUCTIONS

## Global restore point

`ece7be3630739d551b9ba7caf37d30a9a63c872f` — the verified remote head before this resume run; the base restore point.

**Final pre-R7 head:** `77ede9a5adc73bfbec06a0e6a71cc81506bfa832` (R6 — evidence pack + permanent docs). The R7 evidence-and-documentation reconciliation commit is the single commit on top of it (`git log --oneline 77ede9a..HEAD` shows exactly one); a commit cannot embed its own SHA, so identify it as that single commit or read `git rev-parse origin/micro-standard-ui-aux-integration-20260914`.

**Mechanically rehearsed this run:** a detached scratch worktree at that commit resolved cleanly (0 modifications), confirmed the pre-dark state (no `theme-dark.css`; the v0 `.dark` block present), and was removed without touching the branch. The rehearsal used no reset, no force, no history rewrite.

## Option R7 — documentation-reconciliation rollback only

To withdraw only the R7 corrections (restore the R6 evidence pack byte-for-byte, leaving all implementation and the R0–R6 history untouched):

```bash
git status                                  # must be clean
git revert <R7>                             # the single commit directly on top of 77ede9a
git push origin micro-standard-ui-aux-integration-20260914
```

No implementation file is involved; the revert is pure documentation/manifest restoration.

## Option A — full rollback of this run (preferred)

The run's commits are small and revertible: the 7 commits `ece7be3..77ede9a` (R0, R1, R2, W5 implementation, W5 verification, scope-hygiene revert, R6 evidence), plus the R7 documentation commit on top if present. On a clean worktree of the target branch:

```bash
git status                       # must be clean
git revert --no-commit ece7be3..77ede9a    # reverts R0–R6 (7 commits) as one revert commit; revert R7 too if present
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

## Generation convention

`ROLLBACK_MANIFEST.json` is a flat, non-recursive record: it lists restore points, the run's commits (from `git rev-list --reverse ece7be3630739d551b9ba7caf37d30a9a63c872f..77ede9a5adc73bfbec06a0e6a71cc81506bfa832`), and rollback procedures directly — no file hashes, no references to other manifests. Integrity hashes for the evidence folder live solely in `SHA256SUMS.txt`.
