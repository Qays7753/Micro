/**
 * Delivery domain (contract 21 §3.2 rewrite — six separate axes).
 * Pure transition rules with actor + guard per event; no time-based
 * auto-transitions (deadlines are evaluated read-time; owner silence NEVER
 * auto-closes — OD16). Money here is recording-only (OD12/OD13).
 */

import { HttpError } from "../http.ts";

export type RequestStatus =
  | "draft"
  | "awaiting_driver_response"
  | "awaiting_requester_decision"
  | "confirmed"
  | "driver_declined"
  | "quote_rejected"
  | "withdrawn"
  | "response_expired"
  | "cancelled";

export type ExecutionStatus =
  | "not_started"
  | "heading_to_pickup"
  | "arrived_at_source"
  | "picked_up"
  | "in_transit"
  | "delivered_declared"
  | "undeliverable_declared"
  | "awaiting_instructions"
  | "holding_agreed"
  | "retry_scheduled"
  | "returning"
  | "return_declared";

export type ConfirmationStatus =
  "none" | "awaiting_requester_confirmation" | "confirmed_by_requester" | "objected";
export type ContactStatus =
  "not_attempted" | "attempt_no_answer" | "contact_reported" | "contact_confirmed" | "contact_denied";
export type GoodsLocation =
  "at_source" | "with_driver" | "delivery_declared" | "return_declared_location" | "location_disputed";
export type MoneyStatus =
  | "none"
  | "agreed"
  | "collection_declared"
  | "statement_submitted"
  | "full_receipt_confirmed"
  | "difference_under_review";

export interface RequestState {
  status: RequestStatus;
  responseDeadlineAt: number | null;
  quoteValidUntil: number | null;
}

/** Legal request-axis transitions (contract 21 §3.2-2). */
const REQUEST_TRANSITIONS: Record<string, Record<string, RequestStatus>> = {
  draft: { submit: "awaiting_driver_response" },
  awaiting_driver_response: {
    driver_accept_prepriced: "confirmed",
    driver_submit_quote: "awaiting_requester_decision",
    driver_decline: "driver_declined",
    requester_withdraw: "withdrawn",
  },
  awaiting_requester_decision: {
    requester_accept_quote: "confirmed",
    requester_reject_quote: "quote_rejected",
    // The driver may replace the pending quote before the requester decides
    // (contract 21 §3.2-2: استبدال العرض قبل قبوله يبطل نسخته القديمة).
    driver_replace_quote: "awaiting_requester_decision",
  },
  confirmed: { requester_cancel: "cancelled" },
};

export function transitionRequest(state: RequestState, event: string, now: number): RequestStatus {
  const table = REQUEST_TRANSITIONS[state.status];
  const next = table?.[event];
  if (next === undefined) {
    throw new HttpError(409, "conflict", { reason: `request_event_${event}_invalid_for_${state.status}` });
  }
  if (
    (event === "driver_accept_prepriced" ||
      event === "driver_submit_quote" ||
      event === "driver_replace_quote") &&
    state.responseDeadlineAt !== null &&
    state.responseDeadlineAt <= now
  ) {
    // The server re-checks the window atomically at acceptance (spec §8).
    throw new HttpError(410, "gone", { reason: "response_window_expired" });
  }
  if (event === "requester_accept_quote" && state.quoteValidUntil !== null && state.quoteValidUntil <= now) {
    throw new HttpError(410, "gone", { reason: "quote_expired" });
  }
  return next;
}

/** Read-time deadline evaluation (no background timers; spec §3.2-7). */
export function effectiveRequestStatus(
  status: RequestStatus,
  deadlineAt: number | null,
  now: number,
): RequestStatus {
  if (status !== "awaiting_driver_response" && status !== "awaiting_requester_decision") return status;
  if (deadlineAt !== null && deadlineAt <= now) return "response_expired";
  return status;
}

export interface ExecutionState {
  execution: ExecutionStatus;
  confirmation: ConfirmationStatus;
  contact: ContactStatus;
  goods: GoodsLocation;
  money: MoneyStatus;
}

/** Legal execution-axis transitions (contract 21 §3.2-3). */
const EXECUTION_TRANSITIONS: Record<string, Record<string, ExecutionStatus>> = {
  not_started: { start: "heading_to_pickup" },
  heading_to_pickup: { arrive: "arrived_at_source" },
  arrived_at_source: { pickup_declared: "picked_up", pickup_failed: "undeliverable_declared" },
  picked_up: { transit_started: "in_transit" },
  in_transit: {
    delivery_declared: "delivered_declared",
    delivery_failed: "undeliverable_declared",
    awaiting_instructions: "awaiting_instructions",
  },
  undeliverable_declared: {
    retry_agreed: "retry_scheduled",
    holding_agreed: "holding_agreed",
    return_agreed: "returning",
  },
  retry_scheduled: { retry_started_pickup: "heading_to_pickup", retry_started_transit: "in_transit" },
  holding_agreed: { return_started: "returning", transit_resumed: "in_transit" },
  returning: { return_declared: "return_declared" },
  awaiting_instructions: {
    instructions_transit: "in_transit",
    instructions_return: "returning",
    instructions_holding: "holding_agreed",
  },
};

export function transitionExecution(state: ExecutionState, event: string): ExecutionStatus {
  const next = EXECUTION_TRANSITIONS[state.execution]?.[event];
  if (next === undefined) {
    throw new HttpError(409, "conflict", {
      reason: `execution_event_${event}_invalid_for_${state.execution}`,
    });
  }
  return next;
}

/**
 * OD15 contact-attempt guard: before an undeliverable/failure declaration the
 * driver must have recorded a contact attempt with its outcome.
 */
export function assertContactAttemptBeforeFailure(
  state: ExecutionState,
  event: "pickup_failed" | "delivery_failed",
): void {
  if (state.contact === "not_attempted") {
    throw new HttpError(409, "conflict", { reason: "contact_attempt_required_before_failure", od: "OD15" });
  }
}

/** Goods-location side effects per execution transition. */
export function goodsAfterExecution(execution: ExecutionStatus, current: GoodsLocation): GoodsLocation {
  if (execution === "picked_up" || execution === "in_transit") return "with_driver";
  if (execution === "delivered_declared") return "delivery_declared";
  if (execution === "return_declared") return "return_declared_location";
  return current;
}

/** Confirmation axis: declarations open requester confirmation (OD14). */
export function confirmationAfterDeclaration(
  execution: ExecutionStatus,
  current: ConfirmationStatus,
): ConfirmationStatus {
  if (["delivered_declared", "undeliverable_declared", "return_declared"].includes(execution)) {
    return "awaiting_requester_confirmation";
  }
  return current;
}

/** Contact axis transitions (contract 21 §3.2-4). */
const CONTACT_TRANSITIONS: Record<string, Record<string, ContactStatus>> = {
  not_attempted: { attempt_no_answer: "attempt_no_answer", contact_reported: "contact_reported" },
  attempt_no_answer: { requester_answered: "contact_confirmed", requester_denied: "contact_denied" },
  contact_reported: { requester_confirmed: "contact_confirmed", requester_denied: "contact_denied" },
};

export function transitionContact(current: ContactStatus, event: string): ContactStatus {
  const next = CONTACT_TRANSITIONS[current]?.[event];
  if (next === undefined) {
    throw new HttpError(409, "conflict", { reason: `contact_event_${event}_invalid_for_${current}` });
  }
  return next;
}

/** Delivery money is minor-units ×100 carried as decimal strings (contract 25 §2). */
export function parseMinorAmount(value: unknown, field: string, maxMinor = 10_000_000): string {
  if (typeof value !== "string" || !/^\d{1,9}$/.test(value)) {
    throw new HttpError(400, "bad_request", { field });
  }
  const amount = Number(value);
  if (amount > maxMinor) throw new HttpError(400, "bad_request", { field, reason: "too_large" });
  return value;
}

export interface StatementItem {
  requestId: string;
  description: string;
  amountMinor: string;
}

/** Daily statement invariants (contract 21 §3.2-6): full confirmation only. */
export function statementTotal(items: StatementItem[]): string {
  return items.reduce((total, item) => total + BigInt(item.amountMinor), 0n).toString();
}
