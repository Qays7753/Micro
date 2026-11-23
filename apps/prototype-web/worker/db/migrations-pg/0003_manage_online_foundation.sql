-- M2 (EX-D23, owner order 2026-11-14): Manage Online server foundation.
-- Repository migration ONLY — never applied to the shared Neon project by
-- Z AI; the operator applies and verifies it (documented operator step).
-- The manage capability is DISABLED BY DEFAULT (0): every connected manage
-- surface fails closed until the operator enables it after verification.
ALTER TABLE workspace ADD COLUMN manage_enabled INTEGER NOT NULL DEFAULT 0;

-- The verified owner-identity link (migration gate §2-b / decision card §3-ب):
-- network-side ONLY, outside the local export envelope, proof stored as a
-- SHA-256 hash (never the raw secret), one pending attempt per
-- (workspace, identity), and — structurally, by the partial unique index
-- below — AT MOST ONE linked manage owner per workspace (card §3-أ).
CREATE TABLE manage_owner_link (
  workspace_id TEXT NOT NULL REFERENCES workspace(id),
  identity_id TEXT NOT NULL REFERENCES network_identity(id),
  proof_hash TEXT NOT NULL,
  nonce TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','linked')),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (workspace_id, identity_id)
);

CREATE UNIQUE INDEX idx_manage_owner_linked_one ON manage_owner_link(workspace_id) WHERE status = 'linked';
CREATE INDEX idx_manage_owner_identity ON manage_owner_link(identity_id);
