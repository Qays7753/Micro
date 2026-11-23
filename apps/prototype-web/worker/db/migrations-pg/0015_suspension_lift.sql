-- Post-Group 6 continuous completion phase 2 (WS-251/DOC-041 — owner
-- supplement §10.1-2, 2026-11-22): the audited Admin action to LIFT an
-- identity suspension. Repository migration ONLY — never applied to the
-- shared Neon project by Z AI; tests run it on disposable local PostgreSQL
-- with synthetic fixtures exclusively.
--
--   * identity_suspension gains lift_reason: the lift records the reason
--     next to lifted_by (the Admin identity) and lifted_at (the timestamp)
--     — the three evidence fields the owner requires for the lift.
--   * Lifting restores access ONLY through roles that remain active and
--     approved: suspension never changed profile statuses, so the lift
--     simply ends the block; removed roles stay removed and bookings are
--     never touched. The enforcement points (resolveSession, the Google
--     sign-in refusal) already key on lifted_at IS NULL.

ALTER TABLE identity_suspension ADD COLUMN lift_reason TEXT;
