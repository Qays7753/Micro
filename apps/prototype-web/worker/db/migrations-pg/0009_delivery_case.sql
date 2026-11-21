-- 0009 — Delivery recipient-privacy Wave 3 slice (Post-Group 6 continuation,
-- owner order POST-GROUP6-REMEDIATION-EXECUTION-PROMPT-EN.md @ ab08ec74;
-- final decisions 2026-11-21 ج-بيانات المستلم + Q115/Q238).
--
-- (1) MD-02 (gap-analysis §4 row 5): the admin reads a delivery request's
--     recipient data ONLY through an OPEN case — the case filed by a party
--     (بلاغ على الحجز, final decision د-8) is the specific support purpose
--     that unlocks the administrative read until closure. This table is that
--     case record: reporter, request, reason, details, open/closed lifecycle,
--     closure actor + note. No recipient data is copied into the case — only
--     the reference.
-- (2) The 48-hour driver cutoff and the immediate cancellation cutoff (final
--     decision ج-بيانات المستلم) are COMPUTED read-time rules over the
--     existing delivery_request.status and delivery_execution.confirmation_
--     requested_at columns — no schema change, no retention job (the
--     one-year database deletion and 30-day backup rules remain the
--     documented operator/legal gates, never executed from this branch).
--
-- Repository-only migration (synthetic data in tests; the operator applies it
-- with the documented operator steps — no live execution from this branch).

CREATE TABLE delivery_case (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES delivery_request(id),
  reporter_identity_id TEXT NOT NULL REFERENCES network_identity(id),
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  resolution_note TEXT,
  closed_by TEXT,
  closed_at BIGINT,
  created_at BIGINT NOT NULL
);

CREATE INDEX idx_delivery_case_request ON delivery_case(request_id, status);
CREATE INDEX idx_delivery_case_reporter ON delivery_case(reporter_identity_id, created_at);
