-- 0004 — Delivery mutual consent (contract 21 §3.2-3 / OD10) and the
-- reminder anchors for idempotent due-processing (contract 19 §9).
-- Forward-only; rollback for a LOCAL database is dropping it (no production
-- data exists yet — see EXECUTION-REPORT §17 rollback bounds).

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
  decided_at INTEGER,
  decision_note TEXT,
  applied_execution TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_consent_request_status ON delivery_consent_proposal(request_id, status);

-- When the requester's confirmation wait opened (for the single engineering
-- 24h reminder — contract 21 §3.2-5 / contract 19 §9; no auto-close ever).
ALTER TABLE delivery_execution ADD COLUMN confirmation_requested_at INTEGER;

CREATE INDEX idx_execution_confirmation_pending
  ON delivery_execution(confirmation_status, confirmation_requested_at);
