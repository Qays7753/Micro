-- Post-Group 6 continuous completion phase 2 (WS-251/DOC-041 — owner
-- supplement §10.1-3, 2026-11-22): the project export-before-deletion
-- lifecycle. Repository migration ONLY — never applied to the shared Neon
-- project by Z AI; tests run it on disposable local PostgreSQL with
-- synthetic fixtures exclusively. NO live user data is ever deleted in this
-- task — the deletion endpoint exists for the owner's own explicit,
-- export-first confirmation and is proven ONLY on synthetic fixtures in
-- disposable local tests.
--
--   * project_export: the export ledger — every export of a workspace's
--     owner-accessible data (settings, financial records, bookings, file
--     metadata) is recorded with its record count and content digest; the
--     deletion REQUIRES a prior export of the same workspace (export first,
--     explicit confirmation second).
--   * workspace.deleted_at/deleted_by: the deletion tombstone. Deletion
--     removes the PRIVATE project data (manage_record rows, unshared
--     drafts, the membership) and tombstones the workspace; the completed
--     shared counterparty records (submitted+ deliveries, statements) stay
--     exactly as they are — the tombstone drives the «مستخدم سابق» mask on
--     the counterparty's view of the former owner (the same honest masking
--     pattern the removed-driver lifecycle uses). The workspace row itself
--     stays (FK integrity for the retained shared records) as the
--     tombstone carrier. Backups follow the existing declared retention
--     policy (repository-declared only; no live backup job here).

CREATE TABLE project_export (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace(id),
  requested_by TEXT NOT NULL REFERENCES network_identity(id),
  requested_at BIGINT NOT NULL,
  record_count INTEGER NOT NULL DEFAULT 0,
  digest TEXT NOT NULL
);

CREATE INDEX idx_project_export_workspace ON project_export(workspace_id, requested_at);

ALTER TABLE workspace ADD COLUMN deleted_at BIGINT;
ALTER TABLE workspace ADD COLUMN deleted_by TEXT;
