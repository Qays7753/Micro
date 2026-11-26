-- M2.4 (Manage v2 phase 2, wave F — spec §14.1, R-25, SRV-03): the Manage
-- v2 idempotency reservation table. The §3.7 `operation` table itself has no
-- request_id column in the spec, so the reservation lives in its own table
-- keyed by (project_id, request_id) — the database UNIQUE constraint is the
-- arbitration point SECURITY-EVIDENCE.md SRV-03 §2.1 demands ("قيد قاعدة:
-- UNIQUE على (project_id, request_id)").
--
-- Why a table of its own (not a column on `operation`): §3.7 is binding and
-- closed — adding a column to `operation` would deviate from the spec's
-- exact column list (M2.1 created `operation` with exactly the §3 columns).
-- A reservation table also holds the stored response for replay and the
-- reserved-state sentinel for in-flight arbitration, which have no home in
-- §3.7 at all.
--
-- Column semantics:
--  * request_hash       — SHA-256 of the canonicalized write intent; a
--                         DIFFERENT body under the same key is the explicit
--                         E-IDEMPOTENCY-CONFLICT (SRV-03 §2.5), never a
--                         silent replay or a second application.
--  * response_status    — 0 = RESERVED (in-flight, no response yet); any
--                         other value = a completed stored response.
--  * response_body      — the exact serialized result replayed verbatim on
--                         a duplicate request (byte-identical response).
--  * created_at         — epoch ms of the reservation (TTL housekeeping).
--  * reserved_at        — epoch ms of the in-flight reservation; a
--                         reservation older than the takeover TTL (a crashed
--                         worker that never stored its response) is honestly
--                         taken over by the next attempt.
--
-- The UNIQUE constraint is the atomic arbiter: two concurrent transactions
-- inserting the same (project_id, request_id) cannot both commit — the
-- loser's INSERT fails inside its transaction and the WHOLE transaction
-- (reservation + operation + entries + postings) rolls back (R-12), so a
-- duplicate can never half-apply. This is what makes the reservation
-- "inside the same transaction as the writes" (task M2.4 / SRV-03): there is
-- no pre-check read, and no separate connection.
--
-- Repository migration ONLY (same posture as 0018): applied by the two
-- repository migration runners on disposable databases (worker/tests/
-- harness.ts applyMigrations with its exact statement split, and scripts/
-- rtl-review-server.mjs applying each file as one call). Every statement is
-- a plain idempotent CREATE — no ALTER, no DROP, no DML, no legacy table
-- touched.

CREATE TABLE IF NOT EXISTS manage_v2_idempotency (
  project_id UUID NOT NULL,
  request_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INT NOT NULL,
  response_body TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  reserved_at BIGINT NOT NULL,
  CONSTRAINT manage_v2_idempotency_pkey PRIMARY KEY (project_id, request_id),
  CONSTRAINT manage_v2_idempotency_project_fkey FOREIGN KEY (project_id) REFERENCES project (id)
);

CREATE INDEX IF NOT EXISTS idx_manage_v2_idempotency_created
  ON manage_v2_idempotency (created_at);
