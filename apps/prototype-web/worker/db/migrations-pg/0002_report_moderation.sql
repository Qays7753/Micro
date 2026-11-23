-- 0002 (Phase E, F-12 — S12 scan): report follow-up decisions are recorded in
-- the moderation history. Extends the closed object-type set of
-- market_moderation_event with 'market_report' so contract 22 §2 decisions
-- (acknowledge / request_information / restrict / close) carry the same
-- actor/action/reason/time trail as every other moderation decision.
-- No column or table changes; the D1 history under db/migrations/ is
-- superseded labelled history and is intentionally untouched.
-- Phase F hardening (reviewer 4): IF EXISTS makes a partial re-run
-- self-healing instead of erroring on the absent constraint.
ALTER TABLE market_moderation_event DROP CONSTRAINT IF EXISTS market_moderation_event_object_type_check;
ALTER TABLE market_moderation_event ADD CONSTRAINT market_moderation_event_object_type_check
  CHECK (object_type IN ('supplier_profile','supplier_listing','listing_media','market_report'));
