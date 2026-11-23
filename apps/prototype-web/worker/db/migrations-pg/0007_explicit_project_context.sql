-- 0007 — Post-Group 6 W1 (owner final decisions 2026-11-21 / EX-D24 / WS-251/DOC-041):
-- explicit project context + identity/role separation.
--
-- (1) One project per owner account (final decision أ-3/أ-4: "مشروع واحد لكل
--     حساب" and "صاحب واحد لكل مشروع — لا موظفين ولا شركاء"): a partial
--     unique index refusing a SECOND active 'owner' membership for the same
--     identity. Existing data satisfies it (the pre-0007 code auto-created at
--     most one personal workspace per identity); the application-level
--     explicit-creation path enforces the same rule before touching the index,
--     so a race degrades to an honest 409, never a silent second project.
-- (2) No schema change for sessions: the multi-device session list and the
--     server-side revoke-all (decision أ-7) operate on the existing
--     network_session columns (identity_id / token_hash / created_at /
--     expires_at / revoked_at).
--
-- Repository-only migration (synthetic data in tests; the operator applies it
-- with the documented operator steps — no live execution from this branch).

CREATE UNIQUE INDEX idx_workspace_member_one_owned
  ON workspace_member(identity_id)
  WHERE role = 'owner' AND status = 'active';
