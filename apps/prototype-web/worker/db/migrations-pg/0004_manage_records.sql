-- M3 (EX-D23): the connected Manage record store (migration-gate decision
-- card §3-ج). Repository migration ONLY — never applied to the shared Neon
-- project by Z AI, and populated with SYNTHETIC data exclusively in this
-- repository work (real data stays blocked until retention/deletion/export/
-- privacy/recovery are explicitly resolved by the owner).
--
-- Shape: keyset document rows mirroring the local export families. Values
-- are stored as exact JSON text — contract 25's dated note: integers stay
-- integers, no computation or conversion ever happens in the network layer.
-- Access is enforced at the API layer (requireManageOwner), isolation by the
-- composite key (workspace_id, family, record_id).
CREATE TABLE manage_record (
  workspace_id TEXT NOT NULL REFERENCES workspace(id),
  family TEXT NOT NULL,
  record_id TEXT NOT NULL,
  data_json TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (workspace_id, family, record_id)
);

CREATE INDEX idx_manage_record_family ON manage_record(workspace_id, family);
