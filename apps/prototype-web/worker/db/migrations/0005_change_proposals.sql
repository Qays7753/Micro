-- 0005 — Material change proposals for confirmed bookings (contract 21
-- §3.2-2, OD11): versioned proposal/acceptance. The accepted agreement stays
-- effective and immutable until the other party explicitly accepts; on
-- acceptance a NEW agreement version is written and the previous one stays in
-- history (events + the versioned copy). Forward-only; local rollback is
-- dropping the database (no production data exists yet).

CREATE TABLE delivery_change_proposal (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES delivery_request(id),
  proposed_by_identity_id TEXT NOT NULL REFERENCES network_identity(id),
  changes_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','withdrawn')),
  decided_by_identity_id TEXT,
  decided_at INTEGER,
  decision_note TEXT,
  resulting_agreement_version INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_change_request_status ON delivery_change_proposal(request_id, status);

-- The current effective agreement version (starts at 1 at confirmation).
ALTER TABLE delivery_request ADD COLUMN agreement_version INTEGER NOT NULL DEFAULT 1;
