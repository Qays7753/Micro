-- M6 (EX-D23): the guarded online-only cutover flag — DEFAULT OFF for every
-- workspace, and there is deliberately NO API route that can set it: the
-- actual cutover requires the later exact owner/Manus operator gate after the
-- final migration and recovery review (owner order 2026-11-14 §6-M6). This
-- column only makes the operator's future decision expressible; until then
-- the owner's local writing, export, and recovery stay exactly as they are.
ALTER TABLE workspace ADD COLUMN manage_online_only INTEGER NOT NULL DEFAULT 0;
