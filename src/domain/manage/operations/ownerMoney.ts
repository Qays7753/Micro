/**
 * M2.7 (Manage v2 phase 2, wave G — spec §5 OP-OWNER-DEPOSIT /
 * OP-OWNER-WITHDRAWAL, §4 Q10–Q13, R-9, R-12, R-13, R-26; tests S6, S9,
 * T25 start state): owner money movements — a deposit from the owner's
 * personal money or borrowed money (the deposit that creates a payable),
 * and a withdrawal for personal use or a loan given (which never counts as
 * a personal withdrawal unless written off, §5).
 *
 * Contract (§5):
 *   OP-OWNER-DEPOSIT — inputs amount, box, source: personal | borrowed(name).
 *     Entries: personal → Q10(box, a); borrowed → Q11(box, NEW line L kind
 *     `borrowed`, a) — cash +a, payable a, profit 0 (S6).
 *   OP-OWNER-WITHDRAWAL — inputs amount, box, type: personal | loan_given(name).
 *     Entries: personal → Q12(box, a); loan_given → Q13(box, NEW line L kind
 *     `loan_given`, a) — the receivable is tracked, withdrawals unchanged
 *     (T25 start).
 *
 * Both accept effective_on (default today, ≤ today — R-26/R-13).
 *
 * PURE PLANNER (M1.6 boundary) whose entries need LIVE state: the box is
 * identified by its kind (R-9: one box per kind per project) and only
 * exists in the database. The plan therefore resolves it inside the
 * handler's transaction (`loadState`): the box row is locked FOR UPDATE, a
 * box that is not active is E-BOX-STATE — and the entries are built there
 * against the resolved id. A rejection rolls back the reservation too.
 *
 * w.negative_box (the T8 box-state rule, applied to the withdrawal — the
 * owner movement that can leave a box below zero): a WARNING, never a
 * rejection (R-12). Decided inside the same transaction AFTER the entries
 * are written (`resultData`), from the box's resulting balance, stored with
 * the idempotent response. A box whose opening is unknown has an unknown
 * balance: it never warns. A deposit only adds to a box — it never warns.
 */
import { buildLedgerEntry } from "../ledger/index.js";
import {
  negativeBoxWarning,
  reject,
  requireContext,
  requireDate,
  requireName,
  requirePositiveFils,
  type OperationContextInput,
  type OperationPlan,
  type OperationWritePlan,
  type PlanBalanceLine,
  type TxQuery,
} from "./support.js";

/** Where the deposited money comes from (§5): the owner's personal money,
 * or money borrowed from a named lender (which opens a `borrowed` line). */
export type OwnerDepositSource = { type: "personal" } | { type: "borrowed"; name: string };

/** Why the money leaves the project (§5): personal use, or a loan given to
 * a named borrower (which opens a `loan_given` line). */
export type OwnerWithdrawalType = { type: "personal" } | { type: "loan_given"; name: string };

export interface OwnerDepositInput extends OperationContextInput {
  amountFils: unknown;
  box?: unknown;
  source: unknown;
  effectiveOn?: unknown;
}

export interface OwnerWithdrawalInput extends OperationContextInput {
  amountFils: unknown;
  box?: unknown;
  type: unknown;
  effectiveOn?: unknown;
}

/** The §5 input contract names the box: a box kind (R-9: one box per
 * kind per project) — "cash" | "account", required. */
function requireBoxKind(box: unknown): "cash" | "account" {
  if (box !== "cash" && box !== "account") reject("E-AMOUNT");
  return box;
}

/** effective_on: default today, never in the future (R-26 / R-13). */
function requireEffectiveOn(effectiveOn: unknown, today: string): string {
  if (effectiveOn === undefined) return today;
  const date = requireDate(effectiveOn);
  if (date > today) reject("E-FUTURE-DATE");
  return date;
}

/** Validate the deposit's source: personal, or borrowed from a NAMED
 * lender (§5 — the name is the line's counterparty, R-14). */
function requireDepositSource(source: unknown): OwnerDepositSource {
  if (source === null || typeof source !== "object") reject("E-AMOUNT");
  const { type, name } = source as { type?: unknown; name?: unknown };
  if (type === "personal") {
    if (name !== undefined) reject("E-AMOUNT");
    return { type: "personal" };
  }
  if (type !== "borrowed") reject("E-AMOUNT");
  return { type: "borrowed", name: requireName(name) };
}

/** Validate the withdrawal's type: personal, or a loan given to a NAMED
 * borrower (§5). */
function requireWithdrawalType(type: unknown): OwnerWithdrawalType {
  if (type === null || typeof type !== "object") reject("E-AMOUNT");
  const { type: kind, name } = type as { type?: unknown; name?: unknown };
  if (kind === "personal") {
    if (name !== undefined) reject("E-AMOUNT");
    return { type: "personal" };
  }
  if (kind !== "loan_given") reject("E-AMOUNT");
  return { type: "loan_given", name: requireName(name) };
}

/** «Load state in the transaction» (§14.1) for a one-box owner movement:
 * resolve — and lock — the box by its kind (not active → E-BOX-STATE),
 * register the borrowed/loan_given line the movement opens, then let the
 * caller build its entries against the RESOLVED ids. The handler reads the
 * write AFTER this hook. */
function ownerMoneyLoadState(
  projectId: string,
  kind: "cash" | "account",
  line: PlanBalanceLine | undefined,
  write: OperationWritePlan,
  buildEntries: (boxId: string, lineId: string | undefined) => void,
) {
  return async (tx: TxQuery): Promise<void> => {
    const boxes = (await tx`
      SELECT id FROM box
      WHERE project_id = ${projectId} AND kind = ${kind} AND status = 'active'
      FOR UPDATE`) as Array<{ id: string }>;
    if (boxes.length === 0) reject("E-BOX-STATE");
    const boxId = String(boxes[0]?.id);
    write.boxId = boxId;
    if (line !== undefined) {
      write.balanceLineId = line.id;
      write.balanceLines = [line];
    }
    buildEntries(boxId, line?.id);
  };
}

/** Plan OP-OWNER-DEPOSIT: Q10 (personal) or Q11 + a new `borrowed` line. */
export function planOwnerDeposit(input: OwnerDepositInput): OperationPlan {
  const ctx = requireContext(input);
  const amountFils = requirePositiveFils(input.amountFils);
  const box = requireBoxKind(input.box);
  const source = requireDepositSource(input.source);
  const effectiveOn = requireEffectiveOn(input.effectiveOn, ctx.today);

  // Idempotency identity (R-25) and the persisted payload: the validated
  // inputs only — the borrowed line id is generated per planning.
  const intent = { amountFils, box, source, effectiveOn };
  const write: OperationWritePlan = {
    projectId: ctx.projectId,
    createdByAccountId: ctx.createdByAccountId,
    requestId: ctx.requestId,
    kind: "OP-OWNER-DEPOSIT",
    effectiveOn,
    amountFils,
    ...(source.type === "borrowed" ? { counterpartyName: source.name } : {}),
    payload: intent,
    intent,
    // The box (and the borrowed line) are resolved inside the transaction.
    entries: [],
  };

  if (source.type === "personal") {
    return {
      write,
      loadState: ownerMoneyLoadState(ctx.projectId, box, undefined, write, boxId => {
        write.entries = [buildLedgerEntry({ type: "Q10", effectiveOn, boxId, amountFils })];
      }),
    };
  }

  const lineId = crypto.randomUUID();
  return {
    write,
    loadState: ownerMoneyLoadState(
      ctx.projectId,
      box,
      {
        id: lineId,
        direction: "by_me",
        kind: "borrowed",
        counterpartyName: source.name,
        originOn: effectiveOn,
      },
      write,
      boxId => {
        write.entries = [buildLedgerEntry({ type: "Q11", effectiveOn, boxId, lineId, amountFils })];
      },
    ),
  };
}

/** Plan OP-OWNER-WITHDRAWAL: Q12 (personal) or Q13 + a new `loan_given`
 * line. The withdrawal can leave its box below zero: that is the
 * w.negative_box WARNING (the T8 box-state rule), decided after the writes
 * from the box's resulting balance. */
export function planOwnerWithdrawal(input: OwnerWithdrawalInput): OperationPlan {
  const ctx = requireContext(input);
  const amountFils = requirePositiveFils(input.amountFils);
  const box = requireBoxKind(input.box);
  const type = requireWithdrawalType(input.type);
  const effectiveOn = requireEffectiveOn(input.effectiveOn, ctx.today);

  const intent = { amountFils, box, type, effectiveOn };
  const write: OperationWritePlan = {
    projectId: ctx.projectId,
    createdByAccountId: ctx.createdByAccountId,
    requestId: ctx.requestId,
    kind: "OP-OWNER-WITHDRAWAL",
    effectiveOn,
    amountFils,
    ...(type.type === "loan_given" ? { counterpartyName: type.name } : {}),
    payload: intent,
    intent,
    entries: [],
  };

  if (type.type === "personal") {
    return {
      write,
      loadState: ownerMoneyLoadState(ctx.projectId, box, undefined, write, boxId => {
        write.entries = [buildLedgerEntry({ type: "Q12", effectiveOn, boxId, amountFils })];
      }),
      resultData: async ({ tx }: { tx: TxQuery }) => {
        const boxId = write.boxId;
        return boxId === undefined ? undefined : negativeBoxWarning(tx, ctx.projectId, boxId);
      },
    };
  }

  const lineId = crypto.randomUUID();
  return {
    write,
    loadState: ownerMoneyLoadState(
      ctx.projectId,
      box,
      {
        id: lineId,
        direction: "to_me",
        kind: "loan_given",
        counterpartyName: type.name,
        originOn: effectiveOn,
      },
      write,
      boxId => {
        write.entries = [buildLedgerEntry({ type: "Q13", effectiveOn, boxId, lineId, amountFils })];
      },
    ),
    resultData: async ({ tx }: { tx: TxQuery }) => {
      const boxId = write.boxId;
      return boxId === undefined ? undefined : negativeBoxWarning(tx, ctx.projectId, boxId);
    },
  };
}
