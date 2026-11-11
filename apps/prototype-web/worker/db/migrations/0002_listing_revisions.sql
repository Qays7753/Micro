-- Micro network schema (D1) — migration 0002 — 2026-11-12
-- Market listing revision lifecycle (OD-09/OD-11/OD-16 refinements):
--  * revision_status: content-revision state for an ALREADY-published listing
--    (the approved public copy stays visible while a revision is in review),
--    plus the "content approved, other parts pending" state from the
--    approved spec §7 (publication requires the approved supplier file AND
--    every attached image — the gate publishes atomically once all parts
--    are approved).
--  * status CHECK gains 'admin_suspended' (listing-level admin suspension;
--    profile-level suspension already exists on supplier_profile).
-- Applied pre-deployment on the handoff branch (migration 0001 was never
-- applied to any remote database); a full table rebuild is required because
-- SQLite cannot alter CHECK constraints.

CREATE TABLE supplier_listing_v2 (
  id TEXT PRIMARY KEY,
  supplier_profile_id TEXT NOT NULL REFERENCES supplier_profile(id),
  identity_id TEXT NOT NULL REFERENCES network_identity(id),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  governorate TEXT NOT NULL,
  description TEXT NOT NULL,
  work_copy_json TEXT NOT NULL,
  public_copy_json TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','approved_for_publish','changes_requested',
                      'rejected','paused','archived','expired','admin_suspended')),
  revision_status TEXT NOT NULL DEFAULT 'none'
    CHECK (revision_status IN ('none','submitted','changes_requested','content_approved','renewal_requested')),
  price_mode TEXT NOT NULL CHECK (price_mode IN ('fixed','tiered','quote_required')),
  price_micro_jod TEXT,
  price_basis_json TEXT,
  quantity_unit TEXT NOT NULL,
  min_quantity_milli TEXT NOT NULL,
  quantity_step_milli TEXT NOT NULL,
  availability_status TEXT NOT NULL
    CHECK (availability_status IN ('available','made_to_order','temporarily_unavailable')),
  availability_confirmed_at INTEGER NOT NULL,
  freshness_state TEXT NOT NULL DEFAULT 'fresh'
    CHECK (freshness_state IN ('fresh','needs_confirmation','hidden_stale')),
  contact_channel_json TEXT NOT NULL,
  published_at INTEGER,
  hidden_at INTEGER,
  submitted_at INTEGER,
  reviewed_by TEXT,
  reviewed_at INTEGER,
  review_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO supplier_listing_v2 (
  id, supplier_profile_id, identity_id, title, category, governorate, description,
  work_copy_json, public_copy_json, status, revision_status, price_mode, price_micro_jod,
  price_basis_json, quantity_unit, min_quantity_milli, quantity_step_milli,
  availability_status, availability_confirmed_at, freshness_state, contact_channel_json,
  published_at, hidden_at, submitted_at, reviewed_by, reviewed_at, review_reason,
  created_at, updated_at
)
SELECT
  id, supplier_profile_id, identity_id, title, category, governorate, description,
  work_copy_json, public_copy_json, status, 'none', price_mode, price_micro_jod,
  price_basis_json, quantity_unit, min_quantity_milli, quantity_step_milli,
  availability_status, availability_confirmed_at, freshness_state, contact_channel_json,
  published_at, hidden_at, submitted_at, reviewed_by, reviewed_at, review_reason,
  created_at, updated_at
FROM supplier_listing;

DROP TABLE supplier_listing;
ALTER TABLE supplier_listing_v2 RENAME TO supplier_listing;

CREATE INDEX idx_listing_vendor ON supplier_listing(identity_id, updated_at);
CREATE INDEX idx_listing_public ON supplier_listing(status, governorate, category);
