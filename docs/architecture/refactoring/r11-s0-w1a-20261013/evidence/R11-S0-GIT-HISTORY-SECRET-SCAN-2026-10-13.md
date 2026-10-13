# R11 S0 — Git-History Secret Scan Evidence (Sanitized)

**Scan ID:** R11-S0-GIT-HISTORY-SECRET-SCAN-2026-10-13
**Execution date:** 2026-10-14 (UTC) — scan of the repository state as of branch head `49f8968aa759d245747a3b3f2eee4d408116543d`
**Decision authority:** OD-SEC Option A (owner-approved 2026-10-13): one-time full-history scan, fingerprint-only evidence, no history rewrite, no automatic rotation, no working-tree guard modification. The recurring workflow belongs to W1b and is explicitly NOT part of this execution.

---

## 1. Result

```text
S0_RESULT: ZERO_FINDINGS
REDUCTION_ASSERTED: yes (in-emitter redaction check executed against every captured value)
NO_SECRET_TEXT_IN_ANY_OUTPUT: verified by the redaction assertion + the self-test suite
NO_HISTORY_MUTATION: the scan is read-only (rev-list / cat-file / log / for-each-ref only)
NO_CREDENTIAL_ROTATION_OR_REVOCATION: performed by this scan, by design
```

## 2. Method (exactly reproducible)

| Item | Value |
|---|---|
| Scanner | `scripts/security/scan-git-history-secrets.mjs` — scanner git blob SHA `3091d8acf0a994c1bbb17036f86fa66c3b458381` (committed in this PR; the blob SHA is stable and verifiable with `git hash-object`) |
| Self-test | `scripts/security/scan-git-history-secrets.test.mjs` — git blob SHA `35d93829ff91a570ec89c62829177c222067e7d4`; 9/9 tests green (`npx vitest run scripts/security/scan-git-history-secrets.test.mjs`) |
| Pattern-table source | `scripts/check-secrets.mjs` — the working-tree guard's own table, imported mechanically (`SECRET_PATTERNS` = 15 content patterns, `SECRET_FILE_NAMES` = 6 file-name rules). No weaker or divergent table is used; any future change to the guard's table automatically governs this scanner. |
| Scan target | Fresh mirror clone `git clone --mirror https://github.com/Qays7753/Micro.git` (created immediately before the scan; includes `refs/pull/*/head` which ordinary clones do not fetch) |
| Enumeration | `git rev-list --objects --all` (all refs in the mirror: heads, pull refs, tags) → every reachable blob with all its recorded paths; `git cat-file --batch-check` for object typing; `git cat-file --batch` with byte-exact length-prefixed framing for blob contents (bodies sliced by announced size — never line-split); `git log --all --format=%H%x1f%B%x1e` for commit messages; `git cat-file -p` for annotated-tag messages; blob paths measured against the file-name rules |
| Text decoding | latin1 (byte-permissive), identical to the working-tree guard's approach |
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

## 4. Scanned surface (live measurements)

| Measure | Value |
|---|---|
| Refs scanned | **367** = 5 `refs/heads/*` + 362 `refs/pull/*` + 0 `refs/tags/*` |
| Branch heads included | `main` @ `5ef4ce08…`, `audit/r11-wave0-structure-scan-20261013` @ `c8fa57e3…`, `docs/r11-s0-w1a-execution-contract-20261013` @ `96100590…`, `docs/r11-wave0-prompt-20261013` @ `6f97fa96…`, `refactoring/r11-s0-w1a-20261013` @ `49f8968a…` |
| Commits reachable | **1,556** (oldest `24cb03e7e6312821527dfd13be28330267b49abe`) |
| Blobs scanned | **10,804** (every reachable blob, content + all recorded paths) |
| Annotated tag objects | 0 (the repository has no tags) |
| Commit messages scanned | all 1,556 |
| Duration | ~3.4 s (local, read-only) |

## 5. Findings

```text
ZERO_FINDINGS
```

No content-pattern match and no secret-file-name match exists anywhere in the reachable history of the scanned refs. A read-only pre-verification dry run of the same scan shape over the working clone (1,185 commits / 9,953 blobs, before the execution branch push) also returned zero findings; the authoritative run documented here is the mirror scan above.

## 6. Blind spots (what this scan does NOT cover)

- **Unreachable objects:** objects reachable only via reflogs or `ORIG_HEAD`-style references that a fresh mirror does not carry (a mirror has no reflogs). Server-side gc candidates are invisible here.
- **Deleted PR refs:** GitHub may garbage-collect or hide refs for deleted/closed PRs; only the 362 pull refs the server currently advertises were scanned.
- **GitHub Actions artifacts and logs:** build logs, uploaded artifacts, and cache contents live outside the git object store and were not scanned.
- **Cloudflare Pages build logs:** provider-side, not in the repository.
- **Issue/PR text, comments, reviews, wikis, releases:** GitHub content outside git objects; not scanned.
- **Forks:** network forks of this repository were not scanned.
- **Working tree:** out of S0 scope by design — `scripts/check-secrets.mjs` (the registered working-tree guard) owns that surface and runs in CI on every push.
- **Non-reachable historical CI inputs:** secrets entered only into GitHub Environments/Secrets settings are outside any git scan by definition.

## 7. Incident policy (not triggered)

Had a likely real credential been found, the execution contract required: stop safely, write only a sanitized incident marker (rule ID + object SHA + fingerprint — never the value), and report `R11_S0_SECURITY_INCIDENT — OWNER_RUNBOOK_REQUIRED`. No rotation, revocation, or history rewrite would have been performed by the executor. This path was not taken: the result is `ZERO_FINDINGS`.

## 8. Raw output (sanitized, complete)

```json
{
  "schema": "micro-r11-s0-history-secret-scan/1",
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
    "commits": 1556,
    "blobs": 10804,
    "tag_objects": 0
  },
  "result": "ZERO_FINDINGS",
  "findings": [],
  "redaction": "ASSERTED"
}
```
