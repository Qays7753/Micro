-- Post-Group 6 continuous completion (WS-251/DOC-041 — owner order
-- 7593b9c4 §4 G02): the Q129-defined Platform Admin panel pieces that need
-- schema — «إيقاف هوية كاملة بسبب» (full identity suspension with a reason).
-- Repository migration ONLY — never applied to the shared Neon project by Z
-- AI; tests run it on disposable local PostgreSQL with synthetic fixtures.
--
--   * One ACTIVE suspension per identity (partial unique index); lifting is
--     not part of the specified Q129 closed set — the columns exist for a
--     future owner-decided lift path, no endpoint invents it.
--   * Suspension semantics (final decision ج): a suspended driver's ONGOING
--     booking completes — suspension never auto-cancels anything; the
--     administrative cancel is a separate explicit admin action.
--   * Enforcement: resolveSession fails closed for a suspended identity and
--     the suspension revokes every active session at suspension time; the
--     Google sign-in refuses with the honest reason (no new session).
--   * An active ADMIN identity is never a suspension target (lockout
--     protection — the admin account is the recovery path).

CREATE TABLE identity_suspension (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL REFERENCES network_identity(id),
  reason TEXT NOT NULL,
  suspended_by TEXT NOT NULL REFERENCES network_identity(id),
  suspended_at BIGINT NOT NULL,
  lifted_at BIGINT,
  lifted_by TEXT
);

CREATE UNIQUE INDEX idx_identity_suspension_active ON identity_suspension(identity_id) WHERE lifted_at IS NULL;
CREATE INDEX idx_identity_suspension_identity ON identity_suspension(identity_id, suspended_at);
