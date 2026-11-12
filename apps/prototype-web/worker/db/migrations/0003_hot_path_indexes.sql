-- Micro network schema (D1) — migration 0003 — 2026-11-12
-- Hot-path indexes (reviewer 5 findings): media lookups per media id,
-- driver rating aggregates, and owner-side statement queries.

CREATE INDEX idx_listing_media_media ON listing_media(media_id);

CREATE INDEX idx_rating_driver ON task_rating(driver_profile_id);

CREATE INDEX idx_statement_requester ON daily_statement(requester_identity_id, created_at);
