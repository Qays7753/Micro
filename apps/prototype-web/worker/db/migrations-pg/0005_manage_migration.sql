-- M5 (EX-D23): the migration ledger — receipts for the export→PostgreSQL
-- migration path. Repository migration ONLY; Z AI never applies it to the
-- shared Neon project and never executes a real migration. The path is tested
-- exclusively with synthetic fixtures; the LOCAL export remains the recovery
-- source at all times (the server copy is derived, never primary).
CREATE TABLE manage_migration (
  workspace_id TEXT NOT NULL REFERENCES workspace(id),
  export_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('applied','rolled_back')),
  schema_version INTEGER NOT NULL,
  export_version INTEGER NOT NULL,
  family_counts_json TEXT NOT NULL,
  total_records INTEGER NOT NULL,
  content_checksum TEXT NOT NULL,
  applied_at BIGINT NOT NULL,
  applied_by_identity_id TEXT NOT NULL REFERENCES network_identity(id),
  rolled_back_at BIGINT,
  PRIMARY KEY (workspace_id, export_fingerprint)
);

CREATE INDEX idx_manage_migration_workspace ON manage_migration(workspace_id, status);
