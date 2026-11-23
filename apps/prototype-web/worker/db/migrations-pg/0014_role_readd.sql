-- Post-Group 6 continuous completion phase 2 (WS-251/DOC-041 — owner
-- supplement §10.1-1, 2026-11-22): re-adding a removed role means a NEW
-- application. Repository migration ONLY — never applied to the shared Neon
-- project by Z AI; tests run it on disposable local PostgreSQL with
-- synthetic fixtures exclusively.
--
--   * driver_profile drops its UNIQUE(identity_id) constraint: the removed
--     application row stays as archived history (its vehicles/evidence and
--     every «مستخدم سابق» mask on old records stay exactly as they are),
--     and a fresh re-application inserts a NEW row that becomes the current
--     application (every read path picks the newest row by created_at).
--   * supplier_profile already allows multiple rows per identity (plain
--     index since 0001) — only its read paths needed deterministic newest
--     row selection, corrected in the same change set.
--   * NO approval or permission is restored automatically: the new row
--     starts at 'draft' and follows the normal flow from the beginning
--     (supplier auto-activation on completed profile + accepted terms;
--     driver requires admin approval), exactly like any first application.

ALTER TABLE driver_profile DROP CONSTRAINT driver_profile_identity_id_key;
CREATE INDEX idx_driver_profile_identity ON driver_profile(identity_id, created_at);
