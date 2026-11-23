-- Micro network schema (PostgreSQL) — migration 0001 — 2026-11-14
-- EX-D20 (owner decision 2026-11-13): ONE PostgreSQL target (Neon Free via
-- Cloudflare Hyperdrive) for Market/Delivery network data. PostgreSQL holds
-- Market/Delivery network data ONLY. Never Manage financial data
-- (MANAGE-NETWORK-MIGRATION-EXPORT-GATE stays in force; the Manage
-- schema/export pair 41/34 and the 29 accepted import pairs are untouched).
-- Image/document BYTES live in R2 (MEDIA bucket); PostgreSQL stores metadata
-- + keys only. All timestamps are epoch-ms BIGINT (server time).
-- Money/network amounts are decimal-digit STRINGS (contract 25): delivery
-- minors ×100, MarketPrice ×1e6, quantities ×1e3 — never floats, never
-- 0-for-unknown.
--
-- Lineage: this migration reproduces the FINAL state of the superseded D1
-- history (db/migrations/0001..0005 — kept untouched as labelled history):
--   * 0001 base schema (29 live tables at cutover)
--   * 0002 supplier_listing with revision_status + 'admin_suspended'
--   * 0003 hot-path indexes
--   * 0004 delivery_consent_proposal + confirmation_requested_at anchor
--   * 0005 delivery_change_proposal + agreement_version
-- New in the PostgreSQL target (EX-D19): the Workspace layer
-- (workspace + workspace_member) and workspace scoping columns on the two
-- business aggregate roots (supplier_profile, delivery_request). Driver
-- records stay identity-scoped (contract 18 §2 — driver profile is linked to
-- the identity, not a business entity).

CREATE TABLE network_identity (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  display_name TEXT NOT NULL,
  picture_url TEXT,
  created_at BIGINT NOT NULL,
  last_seen_at BIGINT NOT NULL
);

-- Platform-level roles: admin (قيس reviewer) via membership. Business roles
-- live in workspace_member; vendor/driver capabilities still derive from
-- their approved profile records (authorization.ts).
CREATE TABLE network_membership (
  identity_id TEXT NOT NULL REFERENCES network_identity(id),
  role TEXT NOT NULL CHECK (role IN ('admin')),
  status TEXT NOT NULL DEFAULT 'active',
  granted_by TEXT,
  granted_at BIGINT NOT NULL,
  PRIMARY KEY (identity_id, role)
);

-- ─────────────── Workspace layer (EX-D19, contract 18 §2/§9) ───────────────
-- One workspace per business. A person may belong to several workspaces with
-- different roles (contract 18 §2). v1 auto-creates one personal workspace
-- per identity on first business action (no module choice at registration);
-- capability flags govern where business actions/data exist — they never
-- create separate accounts and never hide the shared product entry points.
CREATE TABLE workspace (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_by_identity_id TEXT NOT NULL REFERENCES network_identity(id),
  market_enabled INTEGER NOT NULL DEFAULT 1,
  delivery_enabled INTEGER NOT NULL DEFAULT 1,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE workspace_member (
  workspace_id TEXT NOT NULL REFERENCES workspace(id),
  identity_id TEXT NOT NULL REFERENCES network_identity(id),
  role TEXT NOT NULL CHECK (role IN ('owner','supplier','driver')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  granted_by_identity_id TEXT,
  granted_at BIGINT NOT NULL,
  PRIMARY KEY (workspace_id, identity_id)
);

CREATE INDEX idx_workspace_member_identity ON workspace_member(identity_id);

CREATE TABLE network_session (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL REFERENCES network_identity(id),
  token_hash TEXT NOT NULL UNIQUE,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL,
  revoked_at BIGINT
);

CREATE INDEX idx_session_identity ON network_session(identity_id);

CREATE TABLE oauth_flow (
  state_hash TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  return_to TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL
);

CREATE TABLE network_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  updated_by TEXT
);

CREATE TABLE network_audit_event (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_identity_id TEXT,
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT,
  result TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  meta_json TEXT
);

CREATE INDEX idx_audit_object ON network_audit_event(object_type, object_id);

-- In-app notifications only (contract 19 §9 closed type set).
CREATE TABLE network_notification (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identity_id TEXT NOT NULL,
  type TEXT NOT NULL,
  target_path TEXT NOT NULL,
  payload_json TEXT,
  read_at BIGINT,
  created_at BIGINT NOT NULL,
  idempotency_key TEXT UNIQUE
);

CREATE INDEX idx_notification_recipient ON network_notification(identity_id, created_at);

CREATE TABLE idempotency (
  key TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE rate_counter (
  bucket TEXT PRIMARY KEY,
  window_start BIGINT NOT NULL,
  count INTEGER NOT NULL
);

-- Media metadata; bytes are in the private R2 bucket under random keys.
CREATE TABLE media_object (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL UNIQUE,
  owner_identity_id TEXT NOT NULL REFERENCES network_identity(id),
  purpose TEXT NOT NULL CHECK (purpose IN ('market_listing_media','driver_evidence','driver_vehicle_proof')),
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at BIGINT NOT NULL
);

CREATE INDEX idx_media_owner ON media_object(owner_identity_id);

-- ───────────────────────── Market (contract 20) ─────────────────────────

CREATE TABLE supplier_profile (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL REFERENCES network_identity(id),
  workspace_id TEXT NOT NULL REFERENCES workspace(id),
  work_copy_json TEXT NOT NULL,
  public_copy_json TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','approved','changes_requested','rejected','suspended')),
  submitted_at BIGINT,
  reviewed_by TEXT,
  reviewed_at BIGINT,
  review_reason TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX idx_supplier_identity ON supplier_profile(identity_id);
CREATE INDEX idx_supplier_workspace ON supplier_profile(workspace_id);

CREATE TABLE supplier_listing (
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
  availability_confirmed_at BIGINT NOT NULL,
  freshness_state TEXT NOT NULL DEFAULT 'fresh'
    CHECK (freshness_state IN ('fresh','needs_confirmation','hidden_stale')),
  contact_channel_json TEXT NOT NULL,
  published_at BIGINT,
  hidden_at BIGINT,
  submitted_at BIGINT,
  reviewed_by TEXT,
  reviewed_at BIGINT,
  review_reason TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX idx_listing_vendor ON supplier_listing(identity_id, updated_at);
CREATE INDEX idx_listing_public ON supplier_listing(status, governorate, category);

-- Link table: which media objects belong to a listing (draft or public copy).
CREATE TABLE listing_media (
  listing_id TEXT NOT NULL REFERENCES supplier_listing(id),
  media_id TEXT NOT NULL REFERENCES media_object(id),
  kind TEXT NOT NULL DEFAULT 'gallery' CHECK (kind IN ('cover','gallery')),
  PRIMARY KEY (listing_id, media_id)
);

CREATE INDEX idx_listing_media_media ON listing_media(media_id);

CREATE TABLE market_moderation_event (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  object_type TEXT NOT NULL CHECK (object_type IN ('supplier_profile','supplier_listing','listing_media')),
  object_id TEXT NOT NULL,
  actor_identity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX idx_moderation_object ON market_moderation_event(object_type, object_id);

CREATE TABLE market_saved_item (
  identity_id TEXT NOT NULL REFERENCES network_identity(id),
  listing_id TEXT NOT NULL REFERENCES supplier_listing(id),
  created_at BIGINT NOT NULL,
  PRIMARY KEY (identity_id, listing_id)
);

CREATE TABLE market_report (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reporter_identity_id TEXT NOT NULL REFERENCES network_identity(id),
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolution_note TEXT,
  resolved_by TEXT,
  resolved_at BIGINT,
  created_at BIGINT NOT NULL
);

-- ─────────────────────── Delivery (contract 21) ───────────────────────

CREATE TABLE driver_profile (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL UNIQUE REFERENCES network_identity(id),
  work_copy_json TEXT NOT NULL,
  public_copy_json TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','under_review','approved','changes_requested','rejected','suspended_new')),
  accepting_new INTEGER NOT NULL DEFAULT 0,
  submitted_at BIGINT,
  reviewed_by TEXT,
  reviewed_at BIGINT,
  review_reason TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE TABLE driver_vehicle (
  id TEXT PRIMARY KEY,
  driver_profile_id TEXT NOT NULL REFERENCES driver_profile(id),
  info_json TEXT NOT NULL,
  ownership_proof_media_id TEXT REFERENCES media_object(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX idx_vehicle_driver ON driver_vehicle(driver_profile_id);

CREATE TABLE driver_evidence (
  id TEXT PRIMARY KEY,
  driver_profile_id TEXT NOT NULL REFERENCES driver_profile(id),
  category TEXT NOT NULL CHECK (category IN ('identity','license','vehicle_ownership')),
  media_id TEXT NOT NULL REFERENCES media_object(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','expired')),
  expires_at BIGINT,
  reviewed_by TEXT,
  reviewed_at BIGINT,
  review_reason TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX idx_evidence_driver ON driver_evidence(driver_profile_id);

CREATE TABLE saved_driver (
  owner_identity_id TEXT NOT NULL REFERENCES network_identity(id),
  driver_profile_id TEXT NOT NULL REFERENCES driver_profile(id),
  created_at BIGINT NOT NULL,
  PRIMARY KEY (owner_identity_id, driver_profile_id)
);

CREATE TABLE delivery_request (
  id TEXT PRIMARY KEY,
  requester_identity_id TEXT NOT NULL REFERENCES network_identity(id),
  workspace_id TEXT NOT NULL REFERENCES workspace(id),
  driver_profile_id TEXT NOT NULL REFERENCES driver_profile(id),
  need_type TEXT NOT NULL CHECK (need_type IN ('deliver_to_customer','fetch_ready_goods')),
  payload_json TEXT NOT NULL,
  collection_minor TEXT,
  collection_content TEXT CHECK (collection_content IN ('product','product_and_fare')),
  pricing_mode TEXT NOT NULL CHECK (pricing_mode IN ('prepriced','quote_request')),
  offered_fare_minor TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','awaiting_driver_response','awaiting_requester_decision',
                      'confirmed','driver_declined','quote_rejected','withdrawn','response_expired','cancelled')),
  agreement_copy_json TEXT,
  agreement_version INTEGER NOT NULL DEFAULT 1,
  response_deadline_at BIGINT,
  quote_id TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX idx_request_requester ON delivery_request(requester_identity_id, updated_at);
CREATE INDEX idx_request_driver ON delivery_request(driver_profile_id, updated_at);
CREATE INDEX idx_request_workspace ON delivery_request(workspace_id, updated_at);

CREATE TABLE delivery_quote (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES delivery_request(id),
  driver_profile_id TEXT NOT NULL,
  fare_minor TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  valid_until BIGINT NOT NULL,
  superseded_by TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX idx_quote_request ON delivery_quote(request_id);

-- Six-axis execution/confirmation state (contract 21 §3.2 rewrite).
CREATE TABLE delivery_execution (
  request_id TEXT PRIMARY KEY REFERENCES delivery_request(id),
  execution_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (execution_status IN ('not_started','heading_to_pickup','arrived_at_source','picked_up',
                                'in_transit','delivered_declared','undeliverable_declared',
                                'awaiting_instructions','holding_agreed','retry_scheduled',
                                'returning','return_declared')),
  confirmation_status TEXT NOT NULL DEFAULT 'none'
    CHECK (confirmation_status IN ('none','awaiting_requester_confirmation','confirmed_by_requester','objected')),
  contact_status TEXT NOT NULL DEFAULT 'not_attempted'
    CHECK (contact_status IN ('not_attempted','attempt_no_answer','contact_reported',
                              'contact_confirmed','contact_denied')),
  goods_location TEXT NOT NULL DEFAULT 'at_source'
    CHECK (goods_location IN ('at_source','with_driver','delivery_declared',
                              'return_declared_location','location_disputed')),
  money_status TEXT NOT NULL DEFAULT 'none'
    CHECK (money_status IN ('none','agreed','collection_declared','statement_submitted',
                            'full_receipt_confirmed','difference_under_review')),
  confirmation_requested_at BIGINT,
  updated_at BIGINT NOT NULL
);

CREATE INDEX idx_execution_confirmation_pending
  ON delivery_execution(confirmation_status, confirmation_requested_at);

CREATE TABLE delivery_event (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES delivery_request(id),
  actor_identity_id TEXT,
  axis TEXT NOT NULL
    CHECK (axis IN ('request','execution','confirmation','contact','goods','money','agreement')),
  event_type TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  reason TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX idx_delivery_event_request ON delivery_event(request_id, created_at);

CREATE TABLE daily_statement (
  id TEXT PRIMARY KEY,
  driver_profile_id TEXT NOT NULL REFERENCES driver_profile(id),
  requester_identity_id TEXT NOT NULL REFERENCES network_identity(id),
  statement_date TEXT NOT NULL,
  items_json TEXT NOT NULL,
  total_minor TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_confirmation'
    CHECK (status IN ('awaiting_confirmation','full_receipt_confirmed','difference_recorded')),
  supplement_of TEXT,
  confirmed_at BIGINT,
  difference_note TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX idx_statement_pair_day ON daily_statement(driver_profile_id, requester_identity_id, statement_date, status);
CREATE INDEX idx_statement_requester ON daily_statement(requester_identity_id, created_at);

CREATE TABLE task_rating (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE REFERENCES delivery_request(id),
  rater_identity_id TEXT NOT NULL REFERENCES network_identity(id),
  driver_profile_id TEXT NOT NULL REFERENCES driver_profile(id),
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','published','rejected')),
  created_at BIGINT NOT NULL
);

CREATE INDEX idx_rating_driver ON task_rating(driver_profile_id);

CREATE TABLE driver_invitation (
  code TEXT PRIMARY KEY,
  created_by_identity_id TEXT NOT NULL REFERENCES network_identity(id),
  created_at BIGINT NOT NULL,
  expires_at BIGINT,
  used_at BIGINT,
  used_by_identity_id TEXT
);

-- ─────────────── Delivery mutual consent (OD10) + change proposals (OD11) ───────────────

-- A consent proposal: one party proposes retry/holding/return after a
-- declared undeliverable outcome; the OTHER party must explicitly accept
-- before anything becomes effective (OD10 — never automatic, silence or
-- disagreement leaves a clear pending state).
CREATE TABLE delivery_consent_proposal (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES delivery_request(id),
  proposed_by_identity_id TEXT NOT NULL REFERENCES network_identity(id),
  kind TEXT NOT NULL CHECK (kind IN ('retry','holding','return')),
  terms_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','withdrawn')),
  decided_by_identity_id TEXT,
  decided_at BIGINT,
  decision_note TEXT,
  applied_execution TEXT,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX idx_consent_request_status ON delivery_consent_proposal(request_id, status);

-- Material change proposals for confirmed bookings (OD11): versioned
-- proposal/acceptance. The accepted agreement stays effective and immutable
-- until the other party explicitly accepts; on acceptance a NEW agreement
-- version is written and the previous one stays in history.
CREATE TABLE delivery_change_proposal (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES delivery_request(id),
  proposed_by_identity_id TEXT NOT NULL REFERENCES network_identity(id),
  changes_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','withdrawn')),
  decided_by_identity_id TEXT,
  decided_at BIGINT,
  decision_note TEXT,
  resulting_agreement_version INTEGER,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX idx_change_request_status ON delivery_change_proposal(request_id, status);
