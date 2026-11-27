/**
 * M2.8 (Manage v2 phase 2, wave H — spec §5 OP-COLLECT, §4 Q2/Q6/Q17/Q18,
 * R-12, R-14, R-26; tests S5, T6, T7, T22 numbers, T23 mechanism, T27, T36,
 * T51): the collection operation.
 *
 * Contract (§5 OP-COLLECT): inputs either `balance_line_id` (from a sale or
 * a line) or `counterparty_name`; amount; box; effective_on (default today,
 * ≤ today — R-26). Allocation by name: open `to_me` lines with that exact
 * name, ordered by `origin_on`, then the origin operation's `created_at`
 * (§3.6 — balance_line has no created_at), oldest first.
 *
 * Shortfall (amount < outstanding), single target line only (an explicit
 * line, or the name has exactly one open line): the «يبقى مستحقاً» /
 * «لن يُحصَّل» answer — `shortfall: "keep_outstanding"` (default: nothing
 * more) or `"write_off"` (Q17 on that line for the rest). Otherwise the
 * rest stays open, no question.
 *
 * Excess (amount > total outstanding): allowed only if the LAST allocated
 * line is a `sale_remainder` → Q18 for the excess on that sale; the
 * operation's result carries the `S-OVERPAY-KEPT` message. Otherwise
 * `E-OVERPAY`.
 *
 * Prior receivable not yet recorded: `priorBalance: true` with a name that
 * has no open `to_me` lines → Q2 (new `prior_receivable` line, origin
 * today) then Q6. A name with no open lines and not marked prior →
 * `E-NO-OPEN-BALANCE`, checked BEFORE the overpayment rule.
 *
 * T6 (E-NAME-REQUIRED-FOR-DEBT): a partial collection on the
 * `sale_remainder` line of an UNNAMED sale is rejected — an unnamed open
 * debt cannot stay unnamed (§5 OP-DELIVER: a same-day sale without a
 * customer name must collect the full remaining). Both shortfall answers
 * are refused; only the full amount is accepted.
 *
 * PURE PLANNER (M1.6 boundary) whose decision needs LIVE state: the box,
 * the open lines and their outstanding sums are loaded inside the handler's
 * transaction (`loadState`, §14.1) — after the reservation, before any
 * write; a rejection rolls back the reservation (R-12). The entries are
 * built in the contract's order: Q2 (prior) first, then Q6 per allocated
 * line (oldest first), then Q17 (chosen write-off), then Q18 (kept excess).
 * No §8 figure is computed here.
 */
import { buildLedgerEntry, type BuiltLedgerEntry } from "../ledger/index.js";
import type { LedgerWriteOffLineKind } from "../ledger/index.js";
import {
  allocateOldestFirst,
  lastAllocatedLine,
  loadOpenLineById,
  loadOpenLinesByName,
  lockActiveBox,
  openLineOfPrior,
  type LineAllocation,
  type OpenBalanceLine,
} from "./allocation.js";
import {
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

/** The shortfall answer of the single-line «يبقى مستحقاً» question (§5). */
export type CollectShortfall = "keep_outstanding" | "write_off";

/** The collect target: exactly one of a balance line id or a name. */
type CollectTarget = { balanceLineId: string } | { counterpartyName: string };

export interface CollectInput extends OperationContextInput {
  amountFils: unknown;
  box?: unknown;
  balanceLineId?: unknown;
  counterpartyName?: unknown;
  effectiveOn?: unknown;
  shortfall?: unknown;
  priorBalance?: unknown;
}

/** The validated collect form: every field confirmed, defaults applied. */
interface CollectForm {
  amountFils: number;
  box: "cash" | "account";
  target: CollectTarget;
  effectiveOn: string;
  shortfall: CollectShortfall | undefined;
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

/** Validate: amount > 0; exactly one of line id | name; the prior option
 * only with a name; the shortfall answer from the closed vocabulary. */
function validateCollect(input: CollectInput, today: string): CollectForm {
  const amountFils = requirePositiveFils(input.amountFils);
  const box = requireBoxKind(input.box);
  const effectiveOn = requireEffectiveOn(input.effectiveOn, today);
  const hasLine = input.balanceLineId !== undefined;
  const hasName = input.counterpartyName !== undefined;
  if (hasLine === hasName) reject("E-AMOUNT");
  const priorBalance = input.priorBalance === undefined ? false : input.priorBalance === true;
  if (priorBalance && !hasName) reject("E-AMOUNT");
  const shortfall =
    input.shortfall === undefined
      ? undefined
      : input.shortfall === "keep_outstanding" || input.shortfall === "write_off"
        ? (input.shortfall as CollectShortfall)
        : reject("E-AMOUNT");
  const target: CollectTarget = hasLine
    ? { balanceLineId: typeof input.balanceLineId === "string" ? input.balanceLineId : reject("E-AMOUNT") }
    : { counterpartyName: requireName(input.counterpartyName) };
  return { amountFils, box, target, effectiveOn, shortfall, priorBalance };
}

/** An unnamed sale (§3.4): no customer name at all (null or blank). */
function isUnnamed(name: string | null): boolean {
  return name === null || name.trim().length === 0;
}

/** A to_me line kind Q17 may write off (§4) — the M2.2 builder's guard,
 * mirrored for narrowing an OpenBalanceLine's kind. */
function isWriteOffLineKind(kind: string): kind is LedgerWriteOffLineKind {
  return kind === "sale_remainder" || kind === "prior_receivable" || kind === "loan_given";
}

/** The loaded target and the prior line the operation may open. */
interface CollectTargets {
  lines: OpenBalanceLine[];
  priorLine: PlanBalanceLine | undefined;
}

/** Load the target lines inside the transaction: by explicit id (must be an
 * OPEN to_me balance — E-NO-OPEN-BALANCE otherwise) or by exact trimmed
 * name; an empty name result is the prior-receivable option (Q2) or
 * E-NO-OPEN-BALANCE, checked before the overpay rule (§5). Registers the
 * prior line on the write when it opens one. */
async function collectTargets(
  tx: TxQuery,
  ctx: { projectId: string; today: string },
  form: CollectForm,
  write: OperationWritePlan,
): Promise<CollectTargets> {
  if ("balanceLineId" in form.target) {
    const line = await loadOpenLineById(tx, ctx.projectId, "to_me", "AR", form.target.balanceLineId);
    if (line === null) reject("E-NO-OPEN-BALANCE");
    return { lines: [line!], priorLine: undefined };
  }
  const lines = await loadOpenLinesByName(tx, ctx.projectId, "to_me", "AR", form.target.counterpartyName);
  if (lines.length > 0) return { lines, priorLine: undefined };
  if (!form.priorBalance) reject("E-NO-OPEN-BALANCE");
  // «مستحق سابق»: a new prior_receivable line, origin TODAY (§5), collected
  // immediately in the same operation (Q2 then Q6).
  const priorLine: PlanBalanceLine = {
    id: crypto.randomUUID(),
    direction: "to_me",
    kind: "prior_receivable",
    counterpartyName: form.target.counterpartyName,
    originOn: ctx.today,
  };
  write.balanceLineId = priorLine.id;
  write.balanceLines = [priorLine];
  return { lines: [openLineOfPrior(priorLine, form.amountFils)], priorLine };
}

/** The §5 rejection rules over the allocation: the kept excess (sale_remainder
 * only) and the single-line shortfall question — T6's name requirement
 * first. Returns the single target line when there is exactly one. */
function assertCollectRules(
  targets: CollectTargets,
  form: CollectForm,
  allocations: LineAllocation[],
  excessFils: number,
): OpenBalanceLine | undefined {
  if (excessFils > 0) {
    const last = lastAllocatedLine(allocations);
    if (last === undefined || last.kind !== "sale_remainder" || last.saleId === null) {
      reject("E-OVERPAY");
    }
  }
  const single = targets.lines.length === 1 ? targets.lines[0]! : undefined;
  if (
    single !== undefined &&
    form.amountFils < single.outstandingFils &&
    targets.priorLine === undefined &&
    single.kind === "sale_remainder" &&
    isUnnamed(single.counterpartyName)
  ) {
    // T6: an unnamed sale must be collected in full — neither shortfall
    // answer is offered (E-NAME-REQUIRED-FOR-DEBT).
    reject("E-NAME-REQUIRED-FOR-DEBT");
  }
  return single;
}

/** The Q2 (prior) and Q6 (per allocated line) entries, in order. */
function collectBaseEntries(
  form: CollectForm,
  boxId: string,
  priorLine: PlanBalanceLine | undefined,
  allocations: LineAllocation[],
): BuiltLedgerEntry[] {
  const entries: BuiltLedgerEntry[] = [];
  if (priorLine !== undefined) {
    entries.push(
      buildLedgerEntry({
        type: "Q2",
        effectiveOn: priorLine.originOn,
        lineId: priorLine.id,
        amountFils: form.amountFils,
      }),
    );
  }
  for (const { line, amountFils } of allocations) {
    entries.push(
      buildLedgerEntry({ type: "Q6", effectiveOn: form.effectiveOn, boxId, lineId: line.id, amountFils }),
    );
  }
  return entries;
}

/** The Q17 (chosen shortfall write-off) and Q18 (kept excess) entries, when
 * the answers ask for them. */
function collectTailEntries(
  today: string,
  form: CollectForm,
  boxId: string,
  single: OpenBalanceLine | undefined,
  allocations: LineAllocation[],
  excessFils: number,
): BuiltLedgerEntry[] {
  const entries: BuiltLedgerEntry[] = [];
  if (
    single !== undefined &&
    form.shortfall === "write_off" &&
    form.amountFils < single.outstandingFils &&
    isWriteOffLineKind(single.kind)
  ) {
    entries.push(
      buildLedgerEntry({
        type: "Q17",
        // §4: a sale_remainder write-off is effective today; the other
        // kinds follow the collection's effective date.
        effectiveOn: single.kind === "sale_remainder" ? today : form.effectiveOn,
        lineId: single.id,
        lineKind: single.kind,
        amountFils: single.outstandingFils - form.amountFils,
        ...(single.kind === "sale_remainder" && single.saleId !== null ? { saleId: single.saleId } : {}),
      }),
    );
  }
  const last = lastAllocatedLine(allocations);
  if (excessFils > 0 && last?.kind === "sale_remainder" && last.saleId !== null) {
    entries.push(
      buildLedgerEntry({
        type: "Q18",
        effectiveOn: form.effectiveOn,
        boxId,
        saleId: last.saleId,
        excessFils,
      }),
    );
  }
  return entries;
}

/** Plan OP-COLLECT. */
export function planCollect(input: CollectInput): OperationPlan {
  const ctx = requireContext(input);
  const form = validateCollect(input, ctx.today);

  // Idempotency identity (R-25) and the persisted payload: the validated
  // inputs only — the prior line id is generated per planning.
  const intent = {
    amountFils: form.amountFils,
    box: form.box,
    ...form.target,
    effectiveOn: form.effectiveOn,
    ...(form.shortfall === undefined ? {} : { shortfall: form.shortfall }),
    ...(form.priorBalance ? { priorBalance: true } : {}),
  };
  const write: OperationWritePlan = {
    projectId: ctx.projectId,
    createdByAccountId: ctx.createdByAccountId,
    requestId: ctx.requestId,
    kind: "OP-COLLECT",
    effectiveOn: form.effectiveOn,
    amountFils: form.amountFils,
    ...("counterpartyName" in form.target ? { counterpartyName: form.target.counterpartyName } : {}),
    payload: intent,
    intent,
    // The box, the allocation and the entries are resolved inside the
    // transaction.
    entries: [],
  };

  // Set when the Q18 kept-excess fires (T23): the operation result carries
  // the S-OVERPAY-KEPT message, stored with the idempotent response.
  let overpaymentKept = false;

  return {
    write,
    loadState: async (tx: TxQuery): Promise<void> => {
      // The box the money enters (locked, active — E-BOX-STATE).
      const boxId = await lockActiveBox(tx, ctx.projectId, form.box);
      write.boxId = boxId;
      // The target lines (§14.1: after the reservation, before writes).
      const targets = await collectTargets(tx, ctx, form, write);
      // The §5 allocation and its rules.
      const { allocations, excessFils } = allocateOldestFirst(targets.lines, form.amountFils);
      const single = assertCollectRules(targets, form, allocations, excessFils);
      overpaymentKept = excessFils > 0;
      // The entries, in the contract's order.
      write.entries = [
        ...collectBaseEntries(form, boxId, targets.priorLine, allocations),
        ...collectTailEntries(ctx.today, form, boxId, single, allocations, excessFils),
      ];
      // The operation row's line/sale references (§3.7).
      if (write.balanceLineId === undefined && single !== undefined) {
        write.balanceLineId = single.id;
        if (single.kind === "sale_remainder" && single.saleId !== null) {
          write.saleId = single.saleId;
        }
      }
    },
    // S-OVERPAY-KEPT (T23): decided inside the transaction, stored with the
    // idempotent response — a replay returns it verbatim (R-25).
    resultData: async (): Promise<Record<string, unknown> | undefined> =>
      overpaymentKept ? { messages: ["S-OVERPAY-KEPT"] } : undefined,
  };
}
