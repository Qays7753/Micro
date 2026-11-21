-- Post-Group 6 continuous completion (WS-251/DOC-041 — owner order
-- 7593b9c4 §4 G01): the role-removal states from the 2026-11-21 final
-- decisions (ب — دورة الدور Q5). Repository migration ONLY — never applied
-- to the shared Neon project by Z AI; tests run it on disposable local
-- PostgreSQL with synthetic fixtures exclusively.
--
--   * supplier_profile gains 'removed' (إزالة دور مورد مفعّل بطلب: تُخفى
--     إعلاناته فورًا وتُؤرشف — the listing rows are preserved, only their
--     status moves to the pre-existing 'archived' value; nothing is deleted).
--   * driver_profile gains 'removed' (إزالة دور سائق مفعّل بطلب — only when
--     NO ongoing booking exists; the removal endpoint enforces that, the
--     status itself carries it). Records that concern the other party stay
--     and render as «مستخدم سابق».
--   * removed_at records WHEN the role was removed (audit evidence; the
--     full actor/action trail stays in network_audit_event).
--
-- Removal is NOT silently reversible: the role save/submit paths refuse a
-- removed profile (409 role_removed) — re-adding after removal is an
-- unspecified recovery semantic and stays an owner decision.

ALTER TABLE supplier_profile DROP CONSTRAINT supplier_profile_status_check;
ALTER TABLE supplier_profile ADD CONSTRAINT supplier_profile_status_check
  CHECK (status IN ('draft','active','submitted','approved','changes_requested','rejected','suspended','removed'));
ALTER TABLE supplier_profile ADD COLUMN removed_at BIGINT;

ALTER TABLE driver_profile DROP CONSTRAINT driver_profile_status_check;
ALTER TABLE driver_profile ADD CONSTRAINT driver_profile_status_check
  CHECK (status IN ('draft','submitted','under_review','approved','changes_requested','rejected','suspended_new','removed'));
ALTER TABLE driver_profile ADD COLUMN removed_at BIGINT;
