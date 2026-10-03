# ADR-012: Bundle-budget margin — profile first, reduce before any raise

**Status:** Accepted (Wave G — STR-608 — 2026-10-03)
**Owner:** Micro owner; the ceiling values themselves remain the D-034-approved 650,000 raw / 155,000 gzip decimal bytes.
**Context:** The last documented measurement was reproduced byte-exact at Wave G profiling (local Node-24): **649,871 raw / 154,754 gzip** — margins of 129 / 246 bytes. CI (Node-22) measures +112–117 raw over local (documented 4D RAW_OVER incident and its calculated retreat), leaving an effective CI margin of ~12–17 bytes. This margin gates all import-graph work (Wave B barrels, the deferred 4D delegation ≈ 42+ bytes for two barrels, STR-616).

**Decision:**
1. **Profile results (VERIFIED, Wave G session):** the entry chunk is a uniformly dense single bundle — no single bloat module; costs are distributed across all segments. The dominant identified duplication: result-code string literals repeated per call-site in the minified output — `storage_error` ×156 (38 sites in each adapter plus guard call-sites), `validation_error` ×143, `invalid_state` ×50, `needs_review` ×20. The `storage_error` family alone is ≈2.0 KB of repeated 13-byte literals across the two adapters, which carry identical 38-site guard patterns.
2. **Reduce first (Wave B slice 1, before any barrel work):** mechanically consolidate the storage adapters' result-code literals into a shared constants module consumed by both adapters — identical runtime values, identical messages, error/result identity byte-preserved. Expected recovery: ~0.7–2.0 KB raw — 40–100× the entire current CI margin. Proof obligations: full suites + goldens + byte-comparison of thrown/rejected error identities before/after; bundle re-measured and recorded in the wave card.
3. **Raise only as documented last resort:** if, after the reduction slice, an accepted program step still cannot fit, a ceiling increase requires ALL of: the real-contributor profile attached, a double-diff (code + docs + test), exact before/after bytes for raw and gzip, a stated reason, an owner record, and the ratchet preserved (the new ceiling remains a growth ceiling, never an invitation). A silent raise is forbidden; freezing the margin without reduction is equally rejected (any addition fails CI and blocks the program).
4. **Per-wave measurement rule:** every Wave B–F PR records its own before/after raw+gzip bytes in its wave card; `apps/prototype-web/scripts/check-bundle-budget.mjs` stays the single source of truth for the ceiling and the measurement method.

**Consequences:** STR-608 closes via an owned plan rather than a frozen risk. No ceiling value changes in this ADR. Rollback: revert the Wave B slice; the ceiling is untouched.

**Evidence class:** VERIFIED (local reproduction byte-exact at 649,871/154,754; duplication counts by direct scan of the built entry). CI delta: INFERRED from the documented 4D record (Node-22 unavailable in this environment).
