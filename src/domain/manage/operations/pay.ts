/**
 * M2.8 (Manage v2 phase 2, wave H — spec §5 OP-PAY, §4 Q3/Q7, R-12, R-14,
 * R-26; tests T13, S6 pay half): the payment operation — the mirror of
 * OP-COLLECT on the `by_me` side.
 *
 * Contract (§5 OP-PAY): inputs `balance_line_id` or `counterparty_name`;
 * amount; box; effective_on (default today, ≤ today — R-26). Allocation by
 * name: open `by_me` lines (supplier, prior_payable, borrowed,
 * customer_refund) with that exact name, oldest first — the same rule and
 * the same order as OP-COLLECT (allocation.ts, the one place it lives).
 *
 * Validation: amount ≤ total outstanding (`E-OVERPAY`) — there is NO kept
 * excess for payments (no Q18 on the payable side).
 *
 * Prior payable not yet recorded: `priorBalance: true` with a name that has
 * no open `by_me` lines → Q3 (new `prior_payable` line, origin today) then
 * Q7 («التزام سابق»). A name with no open lines and not marked prior →
 * `E-NO-OPEN-BALANCE` — §5 does not restate the collect-side error for the
 * pay side, but the option and the message (§11: «لا يوجد مستحق مفتوح بهذا
 * الاسم») are direction-agnostic; refusing silently or inventing a second
 * code would be worse. Checked before the overpay rule, exactly as collect.
 *
 * No shortfall question: a payable stays open until paid; there is no
 * write-off for `by_me` lines (§5 OP-WRITE-OFF is available on open `to_me`
 * lines only).
 *
 * The box the money LEAVES can end below zero: that is the w.negative_box
 * WARNING (the T8 box-state rule), decided inside the transaction after the
 * writes and stored with the idempotent response.
 *
 * PURE PLANNER (M1.6 boundary): same posture as OP-COLLECT — the box, the
 * lines and the outstanding sums load inside the handler's transaction; a
 * rejection rolls back the reservation (R-12). No §8 figure here.
 */
import { buildLedgerEntry, type BuiltLedgerEntry } from "../ledger/index.js";
import {
  allocateOldestFirst,
  loadOpenLineById,
  loadOpenLinesByName,
  lockActiveBox,
  openLineOfPrior,
  type LineAllocation,
  type OpenBalanceLine,
} from "./allocation.js";
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

/** The pay target: exactly one of a balance line id or a name. */
type PayTarget = { balanceLineId: string } | { counterpartyName: string };

export interface PayInput extends OperationContextInput {
  amountFils: unknown;
  box?: unknown;
  balanceLineId?: unknown;
  counterpartyName?: unknown;
  effectiveOn?: unknown;
  priorBalance?: unknown;
}

/** The validated pay form: every field confirmed, defaults applied. */
interface PayForm {
  amountFils: number;
  box: "cash" | "account";
  target: PayTarget;
  effectiveOn: string;
  priorBalance: boolean;
}

function requireBoxKind(box: unknown): "cash" | "account" {
  if (box !== "cash" && box !== "account") reject("E-AMOUNT");
  return box;
}

function requireEffectiveOn(effectiveOn: unknown, today: string): string {
  if (effectiveOn === undefined) return today;
  const date = requireDate(effectiveOn);
  if (date > today) reject("E-FUTURE-DATE");
  return date;
}

function validatePay(input: PayInput, today: string): PayForm {
  const amountFils = requirePositiveFils(input.amountFils);
  const box = requireBoxKind(input.box);
  const effectiveOn = requireEffectiveOn(input.effectiveOn, today);
  const hasLine = input.balanceLineId !== undefined;
  const hasName = input.counterpartyName !== undefined;
  if (hasLine === hasName) reject("E-AMOUNT");
  const priorBalance = input.priorBalance === undefined ? false : input.priorBalance === true;
  if (priorBalance && !hasName) reject("E-AMOUNT");
  const target: PayTarget = hasLine
    ? { balanceLineId: typeof input.balanceLineId === "string" ? input.balanceLineId : reject("E-AMOUNT") }
    : { counterpartyName: requireName(input.counterpartyName) };
  return { amountFils, box, target, effectiveOn, priorBalance };
}

/** The loaded target and the prior line the operation may open. */
interface PayTargets {
  lines: OpenBalanceLine[];
  priorLine: PlanBalanceLine | undefined;
}

/** Load the target lines inside the transaction — the pay-side mirror of
 * the collect loader: by explicit id (an OPEN by_me balance or
 * E-NO-OPEN-BALANCE) or by exact trimmed name; the empty name result is the
 * «التزام سابق» prior-payable option (Q3) or E-NO-OPEN-BALANCE. */
async function payTargets(
  tx: TxQuery,
  ctx: { projectId: string; today: string },
  form: PayForm,
  write: OperationWritePlan,
): Promise<PayTargets> {
  if ("balanceLineId" in form.target) {
    const line = await loadOpenLineById(tx, ctx.projectId, "by_me", "AP", form.target.balanceLineId);
    if (line === null) reject("E-NO-OPEN-BALANCE");
    return { lines: [line!], priorLine: undefined };
  }
  const lines = await loadOpenLinesByName(tx, ctx.projectId, "by_me", "AP", form.target.counterpartyName);
  if (lines.length > 0) return { lines, priorLine: undefined };
  if (!form.priorBalance) reject("E-NO-OPEN-BALANCE");
  // «التزام سابق»: a new prior_payable line, origin TODAY (§5), paid
  // immediately in the same operation (Q3 then Q7).
  const priorLine: PlanBalanceLine = {
    id: crypto.randomUUID(),
    direction: "by_me",
    kind: "prior_payable",
    counterpartyName: form.target.counterpartyName,
    originOn: ctx.today,
  };
  write.balanceLineId = priorLine.id;
  write.balanceLines = [priorLine];
  return { lines: [openLineOfPrior(priorLine, form.amountFils)], priorLine };
}

/** The Q3 (prior) and Q7 (per allocated line) entries, in order, with the
 * §5 validation: no excess for payments (E-OVERPAY — there is no Q18 on
 * the payable side). */
function payEntries(
  form: PayForm,
  boxId: string,
  targets: PayTargets,
  allocations: LineAllocation[],
  excessFils: number,
): BuiltLedgerEntry[] {
  if (excessFils > 0) reject("E-OVERPAY");
  const entries: BuiltLedgerEntry[] = [];
  if (targets.priorLine !== undefined) {
    entries.push(
      buildLedgerEntry({
        type: "Q3",
        effectiveOn: targets.priorLine.originOn,
        lineId: targets.priorLine.id,
        amountFils: form.amountFils,
      }),
    );
  }
  for (const { line, amountFils } of allocations) {
    entries.push(
      buildLedgerEntry({ type: "Q7", effectiveOn: form.effectiveOn, boxId, lineId: line.id, amountFils }),
    );
  }
  return entries;
}

/** Plan OP-PAY. */
export function planPay(input: PayInput): OperationPlan {
  const ctx = requireContext(input);
  const form = validatePay(input, ctx.today);

  const intent = {
    amountFils: form.amountFils,
    box: form.box,
    ...form.target,
    effectiveOn: form.effectiveOn,
    ...(form.priorBalance ? { priorBalance: true } : {}),
  };
  const write: OperationWritePlan = {
    projectId: ctx.projectId,
    createdByAccountId: ctx.createdByAccountId,
    requestId: ctx.requestId,
    kind: "OP-PAY",
    effectiveOn: form.effectiveOn,
    amountFils: form.amountFils,
    ...("counterpartyName" in form.target ? { counterpartyName: form.target.counterpartyName } : {}),
    payload: intent,
    intent,
    entries: [],
  };

  return {
    write,
    loadState: async (tx: TxQuery): Promise<void> => {
      // The box the money leaves (locked, active — E-BOX-STATE).
      const boxId = await lockActiveBox(tx, ctx.projectId, form.box);
      write.boxId = boxId;
      // The target lines (§14.1: after the reservation, before writes).
      const targets = await payTargets(tx, ctx, form, write);
      // The §5 allocation, its validation and the entries.
      const { allocations, excessFils } = allocateOldestFirst(targets.lines, form.amountFils);
      write.entries = payEntries(form, boxId, targets, allocations, excessFils);
      // The operation row's line reference (§3.7).
      if (write.balanceLineId === undefined && targets.lines.length === 1) {
        write.balanceLineId = targets.lines[0]!.id;
      }
    },
    // w.negative_box: the box the money leaves may end below zero (the T8
    // box-state rule; R-12 — a warning, never a rejection).
    resultData: async ({ tx }: { tx: TxQuery }): Promise<Record<string, unknown> | undefined> => {
      const boxId = write.boxId;
      return boxId === undefined ? undefined : negativeBoxWarning(tx, ctx.projectId, boxId);
    },
  };
}
