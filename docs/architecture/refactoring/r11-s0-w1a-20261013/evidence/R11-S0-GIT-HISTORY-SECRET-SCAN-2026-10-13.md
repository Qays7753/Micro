# R11 S0 — Git-History Secret Scan Evidence (Sanitized)

**Scan ID:** R11-S0-GIT-HISTORY-SECRET-SCAN-2026-10-13
**Execution date:** 2026-10-14 (UTC) — authoritative re-scan of the repository state as of branch head `1fbbe3663ba1260204cc84d9bb01cb5ba1363fab` (the repair commit; see §0)
**Decision authority:** OD-SEC Option A (owner-approved 2026-10-13): one-time full-history scan, fingerprint-only evidence, no history rewrite, no automatic rotation, no working-tree guard modification. The recurring workflow belongs to W1b and is explicitly NOT part of this execution.

---

## 0. Repair record (2026-10-14) — R11-REV-NF-001 / R11-REV-NF-002

The independent PR review of 2026-10-14 reproduced two HIGH S0 acceptance blockers against the first implementation at `98d22362`. Both were confirmed, fixed on this same branch/PR, and closed with adversarial regression proof:

- **R11-REV-NF-001 — blob-path alias under-coverage (HIGH):** `git rev-list --objects --all` associates a deduplicated blob with only the first path it encounters. A blob with identical content reachable at both `README.txt` and `keys/id_rsa` reported `ZERO_FINDINGS` and missed the sensitive-filename rule. **Fix:** every reachable tree object is now read raw and parsed (`<mode> <name> \0 <20-byte sha>` entries), and path prefixes are propagated from every commit root tree (plus annotated tags pointing at trees) — the resulting map carries **every (blob, path) pair in every reachable tree**, while content scanning remains once per unique blob SHA (all alias paths attributed to the one content finding).
- **R11-REV-NF-002 — commit-message delimiter under-coverage (HIGH):** the `git log --format=%H%x1f%B%x1e` delimiter split dropped any message segment after an embedded `0x1e` (returning `ZERO_FINDINGS`) or mis-attributed it when `0x1f` was also present. **Fix:** commit messages are extracted from the **raw commit objects** via the same length-framed `cat-file --batch` reader — message = bytes after the first blank line, the provably unambiguous header/message boundary of the git commit-object format (header lines are never empty; continuation lines such as gpgsig start with a space). No delimiter or line-splitting is involved anywhere in message extraction.

**Regression proof (deterministic, adversarial):** five new tests, all with runtime-assembled synthetic sentinels (no literal credential-like value exists in the test file — the working-tree secrets guard scans it):
1. one deduplicated blob reachable at `README.txt` and `keys/id_rsa` → exactly one `blob-path` finding at `keys/id_rsa` (the scanner also proves `scanned.blobs === 1`: one object, two names);
2. the same blob aliased at `docs/readme.txt` + `archive/creds.pem` with token-bearing content → one `blob-content` finding whose path lists **both** aliases, plus the `.pem` path finding;
3. a commit message containing `0x1e` before a runtime-built token (no `0x1f`) → found, attributed to the exact commit SHA;
4. a commit message containing both `0x1e` and `0x1f` before the sentinel → found, attributed to the exact commit SHA (the old parser mis-attributed);
5. a commit message mimicking `cat-file` batch framing plus both separators → framing survives, exact attribution.

Verified against the pre-repair implementation: **all five fail (5/5)** — reproducing both review blockers exactly; against the repair commit: **14/14 green** (the nine original tests included). The scanner schema moved `/1` → `/2` (enumeration semantics hardened; additive `scanned.trees` + `scanned.blob_path_entries` fields). The pattern table was NOT touched (still imported mechanically from `scripts/check-secrets.mjs`). Ratchet ledger entry `R11-REV-S0-SCANNER-COMPLETE-ENUMERATION` (303 → 458 nbLOC, ocRef ARCH-008) documents the scanner growth.

The first scan's numbers (1,556 commits / 10,804 blobs at head `49f8968a`) are superseded by this re-scan; the §8 raw output below is the authoritative record.

## 1. Result

```text
S0_RESULT: ZERO_FINDINGS
REDUCTION_ASSERTED: yes (in-emitter redaction check executed against every captured value)
NO_SECRET_TEXT_IN_ANY_OUTPUT: verified by the redaction assertion + the self-test suite
NO_HISTORY_MUTATION: the scan is read-only (rev-list / cat-file / for-each-ref only)
NO_CREDENTIAL_ROTATION_OR_REVOCATION: performed by this scan, by design
```

The result holds under the complete adversarial enumeration: all 11,006 blob-path entries (including 154 alias associations beyond the 10,852 unique blobs that the first implementation could have missed) and all 1,568 commit messages parsed from raw commit objects.

## 2. Method (exactly reproducible)

| Item | Value |
|---|---|
| Scanner | `scripts/security/scan-git-history-secrets.mjs` — scanner git blob SHA `df5f77919a72ec7917af9988c2e32a34000a4490` (schema `micro-r11-s0-history-secret-scan/2`; committed in this PR; the blob SHA is stable and verifiable with `git hash-object`) |
| Self-test | `scripts/security/scan-git-history-secrets.test.mjs` — git blob SHA `6942e0cf3fc8f49e711e8aaa81aed2607706354f`; **14/14 tests green** (`npx vitest run scripts/security/scan-git-history-secrets.test.mjs`), including the five R11-REV adversarial regressions of §0 |
| Pattern-table source | `scripts/check-secrets.mjs` — the working-tree guard's own table, imported mechanically (`SECRET_PATTERNS` = 15 content patterns, `SECRET_FILE_NAMES` = 6 file-name rules). No weaker or divergent table is used; any future change to the guard's table automatically governs this scanner. |
| Scan target | Fresh mirror clone `git clone --mirror https://github.com/Qays7753/Micro.git` (created immediately before the scan, after pushing the repair commit; includes `refs/pull/*/head` which ordinary clones do not fetch) |
| Enumeration | `git rev-list --objects --all` for the reachable-object universe (all refs in the mirror: heads, pull refs, tags); `git cat-file --batch-check` for object typing (blobs + trees); **every tree object read raw via `cat-file --batch` with byte-exact length-framing and parsed binary** (`<mode> <name> \0 <20-byte sha>`), with path prefixes propagated from every commit root tree and every annotated tag pointing at a tree — the complete (blob → all paths) map; **commit objects read raw** (same framing): root tree from the mandatory first `tree` header, message = bytes after the first blank line (the provably unambiguous boundary); blob contents via `cat-file --batch` sliced by announced size (never line-split), once per unique blob SHA; `git cat-file -p` for annotated-tag messages; every enumerated path measured against the file-name rules. Gitlinks (mode `160000`) are external submodules and not targets; a tag pointing at a tree missing from the enumeration fails closed. |
| Text decoding | latin1 (byte-permissive), identical to the working-tree guard's approach; tree-entry names are handled as raw bytes (latin1-safe paths) |
| Output sanitization | Only rule ID, object SHA, kind, path (paths are safe-to-emit per the working-tree guard's precedent of printing file+line), non-reversible fingerprint (first 16 hex of SHA-256 over the matched region), and containing commits (`git log --all --find-object`, first/last/count). The matched text and the secret value are NEVER printed, stored, or emitted. An in-emitter redaction assertion verifies the serialized report contains no captured value (≥8 chars) before any write; a hit aborts with `REDACTION_FAILURE` |
| Command | `node scripts/security/scan-git-history-secrets.mjs <mirror-path> --report <out.json>` → exit 0 |

## 3. Self-test evidence (synthetic repository, temp dirs)

The self-test suite (`scripts/security/scan-git-history-secrets.test.mjs`) proves, on temporary synthetic git repositories created with explicit CI-safe identities:

1. **Planted-then-removed detection:** a fake classic token (`ghp_` + 36×`A`, **assembled at runtime — never written literally in the test file**, because the working-tree secrets guard scans this very file) is committed and then deleted in a later commit; the history scan detects it (`kind=blob-content`), reports the containing commits, and the serialized report contains neither the full value nor any suffix of it.
2. **Clean repository:** `ZERO_FINDINGS`, exit 0, schema/`redaction: ASSERTED` fields verified.
3. **Secret file names:** a committed-then-removed `id_rsa` file is caught via the `blob-path` kind.
4. **Commit messages:** a commit message carrying a runtime-built fine-grained token is caught (`kind=commit-message`) without leaking the value.
5. **Byte-exact framing:** blob content that mimics `cat-file` header lines does not break the parser.
6. **Redaction checker (direct):** `redactionViolations` detects a planted leak in a synthetic serialized text and passes clean output.
7. **Fingerprint:** non-reversible (16 hex of SHA-256), stable, and distinct per value.
8. **Pattern-sharing:** the scanner's helpers reproduce the working-tree guard's table semantics.
9. **CLI exit codes:** 0 clean / 1 findings / 2 usage error.
10–14. **The five R11-REV adversarial regressions** (§0): deduplicated-blob alias paths (two forms), `0x1e`-separated message text, `0x1e`+`0x1f` attribution integrity, and framing-mimicking messages — all failing against the pre-repair implementation (5/5 reproduced), all green on the repair commit.

## 4. Scanned surface (live measurements)

| Measure | Value |
|---|---|
| Refs scanned | **367** = 5 `refs/heads/*` + 362 `refs/pull/*` + 0 `refs/tags/*` |
| Branch heads included | `main` @ `5ef4ce08…`, `audit/r11-wave0-structure-scan-20261013` @ `c8fa57e3…`, `docs/r11-s0-w1a-execution-contract-20261013` @ `96100590…`, `docs/r11-wave0-prompt-20261013` @ `6f97fa96…`, `refactoring/r11-s0-w1a-20261013` @ `1fbbe366…` (the repair head) |
| Commits reachable | **1,568** (oldest `24cb03e7e6312821527dfd13be28330267b49abe`) |
| Tree objects read + parsed | **10,775** (every reachable tree, raw binary parse) |
| Blobs scanned | **10,852** (every reachable blob, content scanned once per unique SHA) |
| Blob-path entries enumerated | **11,006** distinct (blob, path) pairs — 154 alias associations beyond the unique-blob count, all measured against the file-name rules |
| Annotated tag objects | 0 (the repository has no tags) |
| Commit messages scanned | all 1,568 (raw commit objects; complete, untruncated) |
| Duration | ~3.9 s (local, read-only) |

## 5. Findings

```text
ZERO_FINDINGS
```

No content-pattern match and no secret-file-name match exists anywhere in the reachable history of the scanned refs — **under the complete enumeration** (all alias paths of every deduplicated blob, and raw untruncated commit messages). A pre-verification run of the same fixed scanner against the mirror state at the pre-push head `98d22362` (1,567 commits / 10,849 blobs / 11,003 path entries) and against the local working clone (1,187 commits / 9,971 blobs / 10,121 path entries) also returned zero findings; the authoritative run documented here is the post-repair mirror scan above.

## 6. Blind spots (what this scan does NOT cover)

- **Unreachable objects:** objects reachable only via reflogs or `ORIG_HEAD`-style references that a fresh mirror does not carry (a mirror has no reflogs). Server-side gc candidates are invisible here.
- **Deleted PR refs:** GitHub may garbage-collect or hide refs for deleted/closed PRs; only the 362 pull refs the server currently advertises were scanned.
- **GitHub Actions artifacts and logs:** build logs, uploaded artifacts, and cache contents live outside the git object store and were not scanned.
- **Cloudflare Pages build logs:** provider-side, not in the repository.
- **Issue/PR text, comments, reviews, wikis, releases:** GitHub content outside git objects; not scanned.
- **Forks:** network forks of this repository were not scanned.
- **Working tree:** out of S0 scope by design — `scripts/check-secrets.mjs` (the registered working-tree guard) owns that surface and runs in CI on every push.
- **Non-reachable historical CI inputs:** secrets entered only into GitHub Environments/Secrets settings are outside any git scan by definition.

The two enumeration gaps that the PR review exposed (alias paths of deduplicated blobs; commit-message text after an embedded `0x1e`) are **closed by the repair** and pinned by the §0 regressions; they are no longer blind spots.

## 7. Incident policy (not triggered)

Had a likely real credential been found, the execution contract required: stop safely, write only a sanitized incident marker (rule ID + object SHA + fingerprint — never the value), and report `R11_S0_SECURITY_INCIDENT — OWNER_RUNBOOK_REQUIRED`. No rotation, revocation, or history rewrite would have been performed by the executor. This path was not taken: the result is `ZERO_FINDINGS`.

## 8. Raw output (sanitized, complete)

```json
{
  "schema": "micro-r11-s0-history-secret-scan/2",
  "scanner": "scripts/security/scan-git-history-secrets.mjs",
  "pattern_source": "scripts/check-secrets.mjs (SECRET_PATTERNS + SECRET_FILE_NAMES — the working-tree guard's table, shared mechanically)",
  "date": "2026-10-14",
  "repo": "micro-history-mirror.git",
  "scanned": {
    "refs": 367,
    "ref_names": {
      "count": 367,
      "breakdown": {
        "refs/heads/*": [
          "refs/heads/audit/r11-wave0-structure-scan-20261013",
          "refs/heads/docs/r11-s0-w1a-execution-contract-20261013",
          "refs/heads/docs/r11-wave0-prompt-20261013",
          "refs/heads/main",
          "refs/heads/refactoring/r11-s0-w1a-20261013"
        ],
        "refs/pull/*": 362,
        "refs/tags/*": 0
      }
    },
    "commits": 1568,
    "trees": 10775,
    "blobs": 10852,
    "blob_path_entries": 11006,
    "tag_objects": 0
  },
  "result": "ZERO_FINDINGS",
  "findings": [],
  "redaction": "ASSERTED"
}
```
