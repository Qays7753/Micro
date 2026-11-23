-- Post-Group 6 Wave 3 (product slice — final decisions 2026-11-21 Q75/Q100/
-- Q268/Q242/Q106 + MD-01/MD-04/MD-05/SRV-03 + G09):
-- - Load classes, piece count, and weight bands on the booking (Q75).
-- - The third booking type «حجز لفترة» (Q100) and the booking time window
--   used by the atomic capacity/overlap check (Q268).
-- - The driver-declared max concurrent overlapping confirmed bookings (Q268).
-- - Scoped recipient-data consent per booking (MD-01) with revocation.
-- - The DB-enforced one-pending-statement-per-pair-day (MD-05).
-- - Best-effort Web Push subscriptions (G09 — provider explicitly NOT
--   configured; subscriptions only, no provider write, no secrets).
-- - No-show reports with the manual-review trigger (Q242).
-- - The atomic idempotency-key reservation column (SRV-03).
-- Repository migration only — no live database is touched by this file.

ALTER TABLE delivery_request ADD COLUMN load_class TEXT
  CHECK (load_class IN ('small','medium','large','extra_large'));
ALTER TABLE delivery_request ADD COLUMN piece_count INTEGER
  CHECK (piece_count IS NULL OR piece_count BETWEEN 1 AND 200);
ALTER TABLE delivery_request ADD COLUMN weight_band TEXT
  CHECK (weight_band IN ('under_10kg','10_to_50kg','over_50kg'));
ALTER TABLE delivery_request ADD COLUMN scheduled_start_at BIGINT;
ALTER TABLE delivery_request ADD COLUMN scheduled_end_at BIGINT;

ALTER TABLE delivery_request DROP CONSTRAINT delivery_request_need_type_check;
ALTER TABLE delivery_request ADD CONSTRAINT delivery_request_need_type_check
  CHECK (need_type IN ('deliver_to_customer','fetch_ready_goods','period_booking'));

ALTER TABLE driver_profile ADD COLUMN max_concurrent_bookings INTEGER
  CHECK (max_concurrent_bookings IS NULL OR max_concurrent_bookings BETWEEN 1 AND 20);

CREATE INDEX idx_request_driver_window ON delivery_request(driver_profile_id, scheduled_start_at, scheduled_end_at)
  WHERE status = 'confirmed';

CREATE TABLE recipient_data_consent (
  request_id TEXT PRIMARY KEY REFERENCES delivery_request(id),
  granted_by_identity_id TEXT NOT NULL REFERENCES network_identity(id),
  fields_json TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  granted_at BIGINT NOT NULL,
  revoked_at BIGINT
);

CREATE UNIQUE INDEX uq_statement_pending_pair_day
  ON daily_statement(driver_profile_id, requester_identity_id, statement_date)
  WHERE status = 'awaiting_confirmation';

CREATE TABLE web_push_subscription (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL REFERENCES network_identity(id),
  endpoint TEXT NOT NULL,
  keys_json TEXT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE UNIQUE INDEX uq_push_identity_endpoint ON web_push_subscription(identity_id, endpoint);

CREATE TABLE no_show_report (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE REFERENCES delivery_request(id),
  reporter_identity_id TEXT NOT NULL REFERENCES network_identity(id),
  driver_profile_id TEXT NOT NULL REFERENCES driver_profile(id),
  scheduled_start_at BIGINT NOT NULL,
  reported_at BIGINT NOT NULL
);

CREATE INDEX idx_no_show_driver_time ON no_show_report(driver_profile_id, reported_at);

ALTER TABLE idempotency ADD COLUMN reserved_at BIGINT;
