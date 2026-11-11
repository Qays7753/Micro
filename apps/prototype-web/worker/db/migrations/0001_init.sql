-- Micro network schema (D1) — migration 0001 — 2026-11-12
-- EX-D18: D1 holds Market/Delivery network data ONLY. Never Manage financial
-- data (MANAGE-NETWORK-MIGRATION-EXPORT-GATE stays in force; local
-- the Manage schema/export pair (41/34) is untouched by design).
-- Image/document BYTES live in R2 (MEDIA bucket); D1 stores metadata + keys only.
-- All timestamps are epoch-ms integers (server time). Money/network amounts are
-- decimal-digit STRINGS (contract 25): delivery minors ×100, MarketPrice ×1e6,
-- quantities ×1e3 — never floats, never 0-for-unknown.

CREATE TABLE network_identity (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  display_name TEXT NOT NULL,
  picture_url TEXT,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

-- Roles beyond "authenticated" are explicit: admin (reviewer) via membership;
-- vendor/driver capabilities derive from their approved profile records.
CREATE TABLE network_membership (
  identity_id TEXT NOT NULL REFERENCES network_identity(id),
  role TEXT NOT NULL CHECK (role IN ('admin')),
  status TEXT NOT NULL DEFAULT 'active',
  granted_by TEXT,
  granted_at INTEGER NOT NULL,
  PRIMARY KEY (identity_id, role)
);

CREATE TABLE network_session (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL REFERENCES network_identity(id),
  token_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX idx_session_identity ON network_session(identity_id);

CREATE TABLE oauth_flow (
  state_hash TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  return_to TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE network_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT
);

CREATE TABLE network_audit_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_identity_id TEXT,
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT,
  result TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  meta_json TEXT
);

CREATE INDEX idx_audit_object ON network_audit_event(object_type, object_id);

-- In-app notifications only (contract 19 §9 closed type set).
CREATE TABLE network_notification (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identity_id TEXT NOT NULL,
  type TEXT NOT NULL,
  target_path TEXT NOT NULL,
  payload_json TEXT,
  read_at INTEGER,
  created_at INTEGER NOT NULL,
  idempotency_key TEXT UNIQUE
);

CREATE INDEX idx_notification_recipient ON network_notification(identity_id, created_at);

CREATE TABLE idempotency (
  key TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE rate_counter (
  bucket TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
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
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_media_owner ON media_object(owner_identity_id);

-- ───────────────────────── Market (contract 20) ─────────────────────────

CREATE TABLE supplier_profile (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL REFERENCES network_identity(id),
  work_copy_json TEXT NOT NULL,
  public_copy_json TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','approved','changes_requested','rejected','suspended')),
  submitted_at INTEGER,
  reviewed_by TEXT,
  reviewed_at INTEGER,
  review_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_supplier_identity ON supplier_profile(identity_id);

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
                      'rejected','paused','archived','expired')),
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

CREATE INDEX idx_listing_vendor ON supplier_listing(identity_id, updated_at);
CREATE INDEX idx_listing_public ON supplier_listing(status, governorate, category);

-- Link table: which media objects belong to a listing (draft or public copy).
CREATE TABLE listing_media (
  listing_id TEXT NOT NULL REFERENCES supplier_listing(id),
  media_id TEXT NOT NULL REFERENCES media_object(id),
  kind TEXT NOT NULL DEFAULT 'gallery' CHECK (kind IN ('cover','gallery')),
  PRIMARY KEY (listing_id, media_id)
);

CREATE TABLE market_moderation_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  object_type TEXT NOT NULL CHECK (object_type IN ('supplier_profile','supplier_listing','listing_media')),
  object_id TEXT NOT NULL,
  actor_identity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_moderation_object ON market_moderation_event(object_type, object_id);

CREATE TABLE market_saved_item (
  identity_id TEXT NOT NULL REFERENCES network_identity(id),
  listing_id TEXT NOT NULL REFERENCES supplier_listing(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (identity_id, listing_id)
);

CREATE TABLE market_report (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_identity_id TEXT NOT NULL REFERENCES network_identity(id),
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolution_note TEXT,
  resolved_by TEXT,
  resolved_at INTEGER,
  created_at INTEGER NOT NULL
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
  submitted_at INTEGER,
  reviewed_by TEXT,
  reviewed_at INTEGER,
  review_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE driver_vehicle (
  id TEXT PRIMARY KEY,
  driver_profile_id TEXT NOT NULL REFERENCES driver_profile(id),
  info_json TEXT NOT NULL,
  ownership_proof_media_id TEXT REFERENCES media_object(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_vehicle_driver ON driver_vehicle(driver_profile_id);

CREATE TABLE driver_evidence (
  id TEXT PRIMARY KEY,
  driver_profile_id TEXT NOT NULL REFERENCES driver_profile(id),
  category TEXT NOT NULL CHECK (category IN ('identity','license','vehicle_ownership')),
  media_id TEXT NOT NULL REFERENCES media_object(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','expired')),
  expires_at INTEGER,
  reviewed_by TEXT,
  reviewed_at INTEGER,
  review_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_evidence_driver ON driver_evidence(driver_profile_id);

CREATE TABLE saved_driver (
  owner_identity_id TEXT NOT NULL REFERENCES network_identity(id),
  driver_profile_id TEXT NOT NULL REFERENCES driver_profile(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (owner_identity_id, driver_profile_id)
);

CREATE TABLE delivery_request (
  id TEXT PRIMARY KEY,
  requester_identity_id TEXT NOT NULL REFERENCES network_identity(id),
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
  response_deadline_at INTEGER,
  quote_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_request_requester ON delivery_request(requester_identity_id, updated_at);
CREATE INDEX idx_request_driver ON delivery_request(driver_profile_id, updated_at);

CREATE TABLE delivery_quote (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES delivery_request(id),
  driver_profile_id TEXT NOT NULL,
  fare_minor TEXT NOT NULL,
  scope_json TEXT NOT NULL,
  valid_until INTEGER NOT NULL,
  superseded_by TEXT,
  created_at INTEGER NOT NULL
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
  updated_at INTEGER NOT NULL
);

CREATE TABLE delivery_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL REFERENCES delivery_request(id),
  actor_identity_id TEXT,
  axis TEXT NOT NULL
    CHECK (axis IN ('request','execution','confirmation','contact','goods','money','agreement')),
  event_type TEXT NOT NULL,
  from_value TEXT,
  to_value TEXT,
  reason TEXT,
  created_at INTEGER NOT NULL
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
  confirmed_at INTEGER,
  difference_note TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_statement_pair_day ON daily_statement(driver_profile_id, requester_identity_id, statement_date, status);

CREATE TABLE task_rating (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE REFERENCES delivery_request(id),
  rater_identity_id TEXT NOT NULL REFERENCES network_identity(id),
  driver_profile_id TEXT NOT NULL REFERENCES driver_profile(id),
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','published','rejected')),
  created_at INTEGER NOT NULL
);

CREATE TABLE driver_invitation (
  code TEXT PRIMARY KEY,
  created_by_identity_id TEXT NOT NULL REFERENCES network_identity(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  used_at INTEGER,
  used_by_identity_id TEXT
);
