-- Post-Group 6 continuous completion phase 2 (WS-251/DOC-041 — owner
-- supplement §10.2-7, 2026-11-22): the Ask Micro governance tables.
-- Repository migration ONLY — never applied to the shared Neon project by Z
-- AI; tests run it on disposable local PostgreSQL with synthetic fixtures.
--
--   * ask_consent: the per-user revocable consent (§10.2-7-1). Asking
--     requires an ACTIVE consent (revoked_at IS NULL); the user can revoke
--     at any time and the revocation is immediate. One row per identity —
--     re-granting after a revoke re-activates the same row (granted_at
--     moves forward, the history stays in the audit trail).
--   * ask_daily_usage: the two daily caps (§10.2-7-3/4). The 20-question
--     daily cap per user (final decision أ-2) and the SEPARATE
--     10,000-Neurons/day free-quota stop with NO paid fallback. The window
--     is the repository's fixed UTC-day convention (the same server-clock
--     window the audited phone reveal uses) so the caps reset together at
--     the day boundary.

CREATE TABLE ask_consent (
  identity_id TEXT PRIMARY KEY REFERENCES network_identity(id),
  granted_at BIGINT NOT NULL,
  revoked_at BIGINT
);

CREATE TABLE ask_daily_usage (
  identity_id TEXT NOT NULL REFERENCES network_identity(id),
  window_start BIGINT NOT NULL,
  question_count INTEGER NOT NULL DEFAULT 0,
  neurons_used INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (identity_id, window_start)
);
