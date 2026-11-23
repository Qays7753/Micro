-- Post-Group 6 Wave 4 (SRV-07 — security finding over the concurrent Manage
-- migration apply): the DB-level guarantee that ONE applied migration exists
-- per workspace at a time. The pre-transaction reads (same-fingerprint
-- replay, different-fingerprint conflict) could race between two concurrent
-- applies; this partial UNIQUE index makes the second different-fingerprint
-- receipt INSERT fail inside its transaction — rolling back its record
-- DELETE/INSERTs with it — so no mixed state can ever commit. The same
-- fingerprint stays idempotent through the existing (workspace_id,
-- export_fingerprint) primary-key ON CONFLICT path. Repository migration
-- only; never applied to a live database by this file.

CREATE UNIQUE INDEX uq_manage_migration_applied
  ON manage_migration(workspace_id)
  WHERE status = 'applied';
