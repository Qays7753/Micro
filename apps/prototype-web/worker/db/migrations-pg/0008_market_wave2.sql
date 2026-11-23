-- 0008 — Market Wave 2 (Post-Group 6 continuation, owner order
-- POST-GROUP6-REMEDIATION-EXECUTION-PROMPT-EN.md @ ab08ec74; final decisions
-- 2026-11-21 EX-D24 + the four approved decisions in the prompt §8).
--
-- (1) Supplier activation WITHOUT profile moderation (final decision ب-قواعد /
--     Q4+Q28): the supplier activates on profile completion + terms acceptance
--     — no profile review. The status CHECK gains 'active' (the review states
--     'submitted'/'changes_requested'/'rejected' stay in the CHECK for schema
--     compatibility with the suspend/unsuspend history, but no code path
--     creates them anymore). Recorded consent: terms_accepted_at (decision د-10
--     — a recorded acceptance when the role is added).
-- (2) Supplier type + delivery option (Q49/Q146 final decision): supplier_type
--     in ('manufacturer','wholesale','importer','shop') and delivery_option in
--     ('delivery','pickup_only') — both NULL until the vendor declares them;
--     both are required for activation and both are browse filters.
-- (3) First-listing verification call (final decision ب-قواعد: "أول إعلان
--     يرافقه اتصال تحقق من المشرف"): verification_call_at + note recorded by
--     the reviewer at the FIRST listing approval; the launch-threshold counting
--     rule (prompt §8 decision 4) requires it for a supplier to count.
-- (4) Phone-reveal daily ledger (prompt §8 decision 3): one row per
--     (identity, supplier, UTC day) — the primary key makes repeat reveals of
--     the same supplier idempotent, so COUNT(*) IS the distinct-supplier count
--     for the server-side limit of 10 distinct supplier numbers per account
--     per day. No phone numbers and no raw IPs are stored here — only who,
--     which supplier, and the day window.
--
-- Repository-only migration (synthetic data in tests; the operator applies it
-- with the documented operator steps — no live execution from this branch).

ALTER TABLE supplier_profile DROP CONSTRAINT supplier_profile_status_check;

ALTER TABLE supplier_profile ADD CONSTRAINT supplier_profile_status_check
  CHECK (status IN ('draft','active','submitted','approved','changes_requested','rejected','suspended'));

ALTER TABLE supplier_profile ADD COLUMN terms_accepted_at BIGINT;

ALTER TABLE supplier_profile ADD COLUMN activated_at BIGINT;

ALTER TABLE supplier_profile ADD COLUMN supplier_type TEXT
  CHECK (supplier_type IS NULL OR supplier_type IN ('manufacturer','wholesale','importer','shop'));

ALTER TABLE supplier_profile ADD COLUMN delivery_option TEXT
  CHECK (delivery_option IS NULL OR delivery_option IN ('delivery','pickup_only'));

ALTER TABLE supplier_listing ADD COLUMN verification_call_at BIGINT;

ALTER TABLE supplier_listing ADD COLUMN verification_call_note TEXT;

CREATE TABLE market_phone_reveal (
  identity_id TEXT NOT NULL REFERENCES network_identity(id),
  supplier_profile_id TEXT NOT NULL REFERENCES supplier_profile(id),
  window_start BIGINT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (identity_id, supplier_profile_id, window_start)
);

CREATE INDEX idx_phone_reveal_window ON market_phone_reveal(identity_id, window_start);
