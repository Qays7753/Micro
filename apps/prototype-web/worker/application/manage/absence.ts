/**
 * M4.3 (Manage v2 phase 4 — spec §7.2-1; tests T33, T58): the absence
 * DETECTION — on app open, if the last operation's `created_at` is ≥ 14
 * days before today, record `absence_event` (started_on = the last
 * operation's date, ended_on = today, complete NULL).
 *
 * NOT an operation (§5.0's table has no kind for it): the absence event
 * is flow state, not a financial movement — no operation row, no ledger
 * entry. The direct-write posture of M3.1's products / M3.2's field
 * edits: idempotent BY STATE (the same inputs write the same rows — no
 * request id, no reservation).
 *
 * The 14-day gap and the re-detection rules:
 *  - The last operation is the one with the max created_at (the day the
 *    user last recorded — not effective_on, which a backdated entry can
 *    push further back without the user having been active then).
 *  - An ALREADY-OPEN event (complete IS NULL — the card is still up)
 *    EXTENDS (ended_on = the new today) instead of duplicating: the
 *    user keeps dismissing the card without recording anything, so the
 *    absence continues. By construction at most one open event exists
 *    (recording anything makes the last operation recent, which stops
 *    the detection until another 14-day gap).
 *  - A COMPLETED event never re-triggers for the same gap: the return
 *    flow's own OP-RECONCILE is the last operation by then.
 *
 * §7.2's remaining steps are NOT new server logic: step 2/3's actions
 * call the existing operations (OP-DELIVER / OP-CANCEL-SALE /
 * OP-COLLECT / OP-PAY), and step 4 is OP-RECONCILE's
 * `return_after_absence` context (the reconcile planner owns it).
 */
import type postgres from "postgres";

/** The detection's answer: the open/new event, or null (recently active). */
export interface AbsenceEvent {
  id: string;
  startedOn: string;
  endedOn: string;
  complete: boolean | null;
}

/** days between two ISO dates (b − a), both 'YYYY-MM-DD'. */
function daysBetween(a: string, b: string): number {
  const day = 86_400_000;
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / day);
}

/** §7.2-1: detect and record the absence. Returns the open event (created
 * or extended), or null when the user was recently active. */
export async function detectAbsence(
  sql: postgres.Sql,
  input: { projectId: string; today: string },
): Promise<AbsenceEvent | null> {
  const { projectId, today } = input;
  const lastOperation = (await sql`
    SELECT created_at::text AS created_at FROM operation
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
    LIMIT 1`) as Array<{ created_at: string }>;
  if (lastOperation.length === 0) return null;
  // The last operation's DAY (created_at, not effective_on).
  const lastDay = String(lastOperation[0]!.created_at).slice(0, 10);
  // §7.2-1's condition: the last recording is ≥ 14 days before today.
  if (daysBetween(lastDay, today) < 14) return null;

  // An already-open event extends instead of duplicating (the card stays
  // until the flow is finished).
  const open = (await sql`
    SELECT id, started_on::text AS started_on, ended_on::text AS ended_on, complete
    FROM absence_event
    WHERE project_id = ${projectId} AND complete IS NULL
    ORDER BY ended_on DESC
    LIMIT 1`) as Array<{ id: string; started_on: string; ended_on: string; complete: null }>;
  if (open.length > 0) {
    const row = open[0]!;
    const updated = (await sql`
      UPDATE absence_event SET ended_on = ${today}
      WHERE id = ${row.id} AND complete IS NULL
      RETURNING id, started_on::text AS started_on, ended_on::text AS ended_on, complete`) as Array<{
      id: string;
      started_on: string;
      ended_on: string;
      complete: null;
    }>;
    const event = updated[0] ?? row;
    return {
      id: String(event.id),
      startedOn: String(event.started_on),
      endedOn: String(event.ended_on),
      complete: event.complete,
    };
  }

  const inserted = (await sql`
    INSERT INTO absence_event (id, project_id, started_on, ended_on, complete)
    VALUES (${crypto.randomUUID()}, ${projectId}, ${lastDay}, ${today}, NULL)
    RETURNING id, started_on::text AS started_on, ended_on::text AS ended_on, complete`) as Array<{
    id: string;
    started_on: string;
    ended_on: string;
    complete: null;
  }>;
  const event = inserted[0]!;
  return {
    id: String(event.id),
    startedOn: String(event.started_on),
    endedOn: String(event.ended_on),
    complete: event.complete,
  };
}
