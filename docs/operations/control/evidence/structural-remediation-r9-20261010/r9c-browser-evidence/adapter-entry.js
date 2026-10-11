// apps/prototype-web/client/src/storage/local/types.ts
var localSchemaVersion = 38;
var localSecurityId = "local-security";
var localOwnerProfileId = "local-owner-profile";
var localInventoryActivationId = "local-inventory-activation";

// apps/prototype-web/client/src/storage/local/loanCommitGuard.ts
var STALE_CONFLICT_MESSAGE = "\u0633\u062C\u0644 \u0627\u0644\u0642\u0631\u0636 \u062A\u063A\u064A\u0651\u0631 \u0645\u0646 \u0645\u0633\u0627\u0631 \u0622\u062E\u0631 \u0628\u0639\u062F \u0641\u062A\u062D\u0643 \u0644\u0647 \u2014 \u0644\u0645 \u064A\u064F\u0633\u062C\u064E\u0651\u0644 \u0634\u064A\u0621\u061B \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.";
function validateLoanCommitRelation(stored, record, event) {
  if (stored === void 0) {
    if (event.type === "loan_outgoing_cash" && !event.correctionType) return { ok: true };
    return { ok: false, message: "\u0627\u0644\u0642\u0631\u0636 \u0644\u0645 \u064A\u0639\u062F \u0645\u0648\u062C\u0648\u062F\u064B\u0627 \u0645\u062D\u0644\u064A\u064B\u0627\u061B \u0644\u0645 \u064A\u064F\u0633\u062C\u064E\u0651\u0644 \u0634\u064A\u0621." };
  }
  const storedRepaymentIds = new Set(stored.repayments.map((repayment) => repayment.id));
  if (event.type === "loan_repayment_cash" && !event.correctionType) {
    const added = record.repayments.filter((repayment) => !storedRepaymentIds.has(repayment.id));
    const valid = record.repayments.length === stored.repayments.length + 1 && added.length === 1 && added[0].eventId === event.id;
    return valid ? { ok: true } : { ok: false, message: STALE_CONFLICT_MESSAGE };
  }
  if (event.correctionType === "reverse") {
    const storedById = new Map(stored.repayments.map((repayment) => [repayment.id, repayment]));
    const newlyReversed = record.repayments.filter(
      (repayment) => repayment.reversal !== null && repayment.reversal.reversalEventId === event.id && (storedById.get(repayment.id)?.reversal ?? null) === null
    );
    const valid = record.repayments.length === stored.repayments.length && newlyReversed.length === 1 && record.repayments.every((repayment) => storedRepaymentIds.has(repayment.id));
    return valid ? { ok: true } : { ok: false, message: STALE_CONFLICT_MESSAGE };
  }
  return { ok: false, message: STALE_CONFLICT_MESSAGE };
}
function findLoanEventByKey(events, idempotencyKey, excludeId) {
  return events.find((candidate) => candidate.id !== excludeId && candidate.idempotencyKey === idempotencyKey);
}

// apps/prototype-web/client/src/storage/local/receivedLoanCommitGuard.ts
var STALE_CONFLICT_MESSAGE2 = "\u0633\u062C\u0644 \u0627\u0644\u0642\u0631\u0636 \u0627\u0644\u0645\u0633\u062A\u0644\u0645 \u062A\u063A\u064A\u0651\u0631 \u0645\u0646 \u0645\u0633\u0627\u0631 \u0622\u062E\u0631 \u0628\u0639\u062F \u0641\u062A\u062D\u0643 \u0644\u0647 \u2014 \u0644\u0645 \u064A\u064F\u0633\u062C\u064E\u0651\u0644 \u0634\u064A\u0621\u061B \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.";
function validateReceivedLoanCommitRelation(stored, record, event) {
  if (stored === void 0) {
    if (event.type === "loan_received_cash" && !event.correctionType) return { ok: true };
    return { ok: false, message: "\u0627\u0644\u0642\u0631\u0636 \u0627\u0644\u0645\u0633\u062A\u0644\u0645 \u0644\u0645 \u064A\u0639\u062F \u0645\u0648\u062C\u0648\u062F\u064B\u0627 \u0645\u062D\u0644\u064A\u064B\u0627\u061B \u0644\u0645 \u064A\u064F\u0633\u062C\u064E\u0651\u0644 \u0634\u064A\u0621." };
  }
  const storedRepaymentIds = new Set(stored.repayments.map((repayment) => repayment.id));
  if (event.type === "loan_received_repayment_cash" && !event.correctionType) {
    const added = record.repayments.filter((repayment) => !storedRepaymentIds.has(repayment.id));
    const valid = record.repayments.length === stored.repayments.length + 1 && added.length === 1 && added[0].eventId === event.id;
    return valid ? { ok: true } : { ok: false, message: STALE_CONFLICT_MESSAGE2 };
  }
  if (event.correctionType === "reverse") {
    const storedById = new Map(stored.repayments.map((repayment) => [repayment.id, repayment]));
    const newlyReversed = record.repayments.filter(
      (repayment) => repayment.reversal !== null && repayment.reversal.reversalEventId === event.id && (storedById.get(repayment.id)?.reversal ?? null) === null
    );
    const valid = record.repayments.length === stored.repayments.length && newlyReversed.length === 1 && record.repayments.every((repayment) => storedRepaymentIds.has(repayment.id));
    return valid ? { ok: true } : { ok: false, message: STALE_CONFLICT_MESSAGE2 };
  }
  return { ok: false, message: STALE_CONFLICT_MESSAGE2 };
}
function findReceivedLoanEventByKey(events, idempotencyKey, excludeId) {
  return events.find((candidate) => candidate.id !== excludeId && candidate.idempotencyKey === idempotencyKey);
}

// apps/prototype-web/client/src/storage/local/recurringExpenseCommitGuard.ts
var RECURRING_EXPENSE_STALE_MESSAGE = "\u0633\u0644\u0633\u0644\u0629 \u0627\u0644\u0645\u0635\u0631\u0648\u0641 \u0627\u0644\u0645\u062A\u0643\u0631\u0631 \u0623\u0648 \u0641\u062A\u0631\u0627\u062A\u0647\u0627 \u062A\u063A\u064A\u0651\u0631\u062A \u0645\u0646 \u0645\u0633\u0627\u0631 \u0622\u062E\u0631 \u0628\u0639\u062F \u0641\u062A\u062D\u0643 \u0644\u0647\u0627 \u2014 \u0644\u0645 \u064A\u064F\u0633\u062C\u064E\u0651\u0644 \u0634\u064A\u0621\u061B \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.";
function recurringExpenseSeriesUnchanged(stored, base) {
  return stored !== void 0 && JSON.stringify(stored) === JSON.stringify(base);
}
function validateRecurringExpenseDraftCommit(storedSeries, storedRevision, series, revision) {
  if (storedSeries === void 0 && storedRevision === void 0) return { ok: true };
  if (storedSeries !== void 0 && storedRevision !== void 0 && JSON.stringify(storedSeries) === JSON.stringify(series) && JSON.stringify(storedRevision) === JSON.stringify(revision))
    return { ok: true, reused: true };
  return { ok: false, message: RECURRING_EXPENSE_STALE_MESSAGE };
}
function validateRecurringExpenseSeriesChange(storedSeries, storedRevisions, storedOccurrences, seriesBase, seriesNext, revision, occurrenceUpdates) {
  if (!recurringExpenseSeriesUnchanged(storedSeries, seriesBase))
    return { ok: false, message: RECURRING_EXPENSE_STALE_MESSAGE };
  if (revision !== null) {
    if (storedRevisions.some((existing) => existing.id === revision.id))
      return { ok: false, message: RECURRING_EXPENSE_STALE_MESSAGE };
    if (seriesNext.currentRevision !== revision.revision)
      return { ok: false, message: "\u0631\u0642\u0645 \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u062E\u0644\u0641 \u0644\u0627 \u064A\u0637\u0627\u0628\u0642 \u0631\u0623\u0633 \u0627\u0644\u0633\u0644\u0633\u0644\u0629 \u2014 \u0644\u0645 \u064A\u064F\u0633\u062C\u064E\u0651\u0644 \u0634\u064A\u0621." };
  }
  const storedById = new Map(storedOccurrences.map((occurrence) => [occurrence.id, occurrence]));
  for (const update of occurrenceUpdates) {
    const stored = storedById.get(update.next.id);
    if (stored === void 0 || JSON.stringify(stored) !== JSON.stringify(update.base))
      return { ok: false, message: RECURRING_EXPENSE_STALE_MESSAGE };
  }
  return { ok: true };
}
function validateRecurringExpenseMaterialization(stored, occurrence) {
  if (stored === void 0) return { ok: true };
  if (JSON.stringify(stored) === JSON.stringify(occurrence)) return { ok: true, reused: true };
  return { ok: false, message: RECURRING_EXPENSE_STALE_MESSAGE };
}
function validateRecurringExpenseOccurrenceDecision(stored, base, next) {
  if (stored === void 0) return { ok: false, message: RECURRING_EXPENSE_STALE_MESSAGE };
  if (JSON.stringify(stored) === JSON.stringify(next)) return { ok: true, reused: true };
  if (JSON.stringify(stored) !== JSON.stringify(base))
    return { ok: false, message: RECURRING_EXPENSE_STALE_MESSAGE };
  return { ok: true };
}
function findRecurringExpenseEventByKey(events, idempotencyKey, excludeId) {
  return events.find((candidate) => candidate.id !== excludeId && candidate.idempotencyKey === idempotencyKey);
}
function validateRecurringExpenseKeyEventCollision(existing, expectedType, expectedAmountMinor) {
  if (existing.type !== expectedType || existing.amountMinor !== expectedAmountMinor)
    return {
      ok: false,
      message: "\u0645\u0641\u062A\u0627\u062D \u062A\u0623\u0643\u064A\u062F \u0647\u0630\u0647 \u0627\u0644\u0641\u062A\u0631\u0629 \u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u062D\u062F\u062B \u0645\u062E\u062A\u0644\u0641 (\u0627\u0644\u0646\u0648\u0639 \u0623\u0648 \u0627\u0644\u0645\u0628\u0644\u063A \u0644\u0627 \u064A\u0637\u0627\u0628\u0642 \u0646\u064A\u0629 \u0627\u0644\u062A\u0623\u0643\u064A\u062F) \u2014 \u0644\u0645 \u064A\u064F\u0633\u062C\u064E\u0651\u0644 \u0634\u064A\u0621\u061B \u0631\u0627\u062C\u0639 \u0627\u0644\u062D\u062F\u062B \u0627\u0644\u0642\u0627\u0626\u0645."
    };
  return { ok: true, reused: true };
}
function validateRecurringExpenseOccurrenceRecordCommit(storedOccurrence, base, next, replay, committedEventId) {
  if (replay !== void 0) {
    if (storedOccurrence === void 0 || storedOccurrence.recordedFinancialEventId !== replay.id)
      return { ok: false, message: RECURRING_EXPENSE_STALE_MESSAGE };
    return { ok: true, reused: true };
  }
  if (storedOccurrence === void 0) return { ok: false, message: RECURRING_EXPENSE_STALE_MESSAGE };
  if (JSON.stringify(storedOccurrence) === JSON.stringify(next)) return { ok: true, reused: true };
  if (JSON.stringify(storedOccurrence) !== JSON.stringify(base))
    return { ok: false, message: RECURRING_EXPENSE_STALE_MESSAGE };
  if (storedOccurrence.recordedFinancialEventId !== null)
    return {
      ok: false,
      message: "\u0647\u0630\u0647 \u0627\u0644\u0641\u062A\u0631\u0629 \u0645\u0642\u064E\u0631\u064E\u0651\u0631\u0629 \u0633\u0644\u0641\u064B\u0627 \u0628\u062D\u062F\u062B \u0622\u062E\u0631 \u2014 \u0627\u0633\u062A\u062E\u062F\u0645 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062A\u0623\u0643\u064A\u062F \u0628\u0646\u0641\u0633 \u0627\u0644\u0645\u0641\u062A\u0627\u062D \u0623\u0648 \u0631\u0627\u062C\u0639 \u0627\u0644\u062D\u062F\u062B \u0627\u0644\u0642\u0627\u0626\u0645."
    };
  if (next.recordedFinancialEventId !== committedEventId)
    return {
      ok: false,
      message: "\u0646\u062A\u064A\u062C\u0629 \u0627\u0644\u062A\u0633\u062C\u064A\u0644 \u0644\u0627 \u062A\u0631\u0628\u0637 \u0627\u0644\u062D\u062F\u062B \u0627\u0644\u0645\u0644\u062A\u0632\u0645 \u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 \u0646\u0641\u0633\u0647\u0627 \u2014 \u0644\u0645 \u064A\u064F\u0633\u062C\u064E\u0651\u0644 \u0634\u064A\u0621."
    };
  return { ok: true };
}

// apps/prototype-web/client/src/storage/local/expenseBudgetCommitGuard.ts
var EXPENSE_BUDGET_STALE_MESSAGE = "\u0633\u062C\u0644 \u0627\u0644\u0645\u064A\u0632\u0627\u0646\u064A\u0629 \u062A\u063A\u064A\u0651\u0631 \u0645\u0646 \u0645\u0633\u0627\u0631 \u0622\u062E\u0631 \u0628\u0639\u062F \u0641\u062A\u062D\u0643 \u0644\u0647 \u2014 \u0644\u0645 \u064A\u064F\u0633\u062C\u064E\u0651\u0644 \u0634\u064A\u0621\u061B \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.";
var EXPENSE_BUDGET_BROKEN_PAIR_MESSAGE = "\u0632\u0648\u062C \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0645\u064A\u0632\u0627\u0646\u064A\u0629 \u0645\u0643\u0633\u0648\u0631: \u0627\u0644\u0633\u0627\u0628\u0642\u0629 \u0644\u0627 \u062A\u0631\u0628\u0637 \u0628\u062E\u0644\u0641\u0647\u0627 (supersededById) \u2014 \u0644\u0645 \u064A\u064F\u0633\u062C\u064E\u0651\u0644 \u0634\u064A\u0621.";
var identical = (left, right) => JSON.stringify(left) === JSON.stringify(right);
function validateExpenseBudgetSave(stored, record, expected) {
  if (stored === void 0) return { ok: true };
  if (identical(stored, record)) return { ok: true, reused: true };
  if (expected !== void 0 && identical(stored, expected)) return { ok: true };
  return { ok: false, message: EXPENSE_BUDGET_STALE_MESSAGE };
}
function expenseBudgetPairLinksForward(successor, supersededPrevious) {
  return supersededPrevious.supersededById === successor.id && successor.id !== supersededPrevious.id;
}
var activeFormOf = (supersededPrevious) => ({
  ...supersededPrevious,
  status: "active",
  supersededById: null
});
function validateExpenseBudgetRevisionPair(storedSuccessor, storedPrevious, successor, supersededPrevious) {
  if (!expenseBudgetPairLinksForward(successor, supersededPrevious))
    return { ok: false, message: EXPENSE_BUDGET_BROKEN_PAIR_MESSAGE };
  if (storedSuccessor !== void 0 && storedPrevious !== void 0) {
    if (identical(storedSuccessor, successor) && identical(storedPrevious, supersededPrevious))
      return { ok: true, reused: true };
    return { ok: false, message: EXPENSE_BUDGET_STALE_MESSAGE };
  }
  if (storedSuccessor === void 0 && storedPrevious !== void 0) {
    if (identical(storedPrevious, activeFormOf(supersededPrevious))) return { ok: true };
    return { ok: false, message: EXPENSE_BUDGET_STALE_MESSAGE };
  }
  return { ok: false, message: EXPENSE_BUDGET_STALE_MESSAGE };
}

// apps/prototype-web/client/src/storage/local/cashContinuityCommitGuard.ts
var SECOND_WALLET_OPENING_MESSAGE = "\u0644\u0643\u0644 \u0645\u062D\u0641\u0638\u0629 \u0642\u064A\u062F \u0627\u0641\u062A\u062A\u0627\u062D \u0648\u0627\u062D\u062F \u0641\u0642\u0637. \u0631\u0641\u0636 \u0627\u0644\u0645\u062E\u0632\u0646 \u0642\u064A\u062F \u0627\u0641\u062A\u062A\u0627\u062D \u062B\u0627\u0646\u064A\u064B\u0627 \u0644\u0646\u0641\u0633 \u0627\u0644\u0645\u062D\u0641\u0638\u0629 \u2014 \u0627\u0644\u062A\u0633\u0648\u064A\u0629 \u0627\u0644\u0644\u0627\u062D\u0642\u0629 \u062A\u064F\u0633\u062C\u0644 \u0636\u0628\u0637 \u0643\u0627\u0634 \u0645\u0648\u062B\u0642\u064B\u0627 \u0628\u0633\u0628\u0628\u060C \u0644\u0627 \u0627\u0641\u062A\u062A\u0627\u062D\u064B\u0627 \u062B\u0627\u0646\u064A\u064B\u0627.";
function findSecondWalletOpening(existingEntries, incomingEntries) {
  const openedWalletIds = new Set(
    existingEntries.filter((entry) => entry.type === "opening_balance").map((entry) => entry.walletId)
  );
  const batchOpenedWalletIds = /* @__PURE__ */ new Set();
  for (const entry of incomingEntries) {
    if (entry.type !== "opening_balance") continue;
    if (openedWalletIds.has(entry.walletId) || batchOpenedWalletIds.has(entry.walletId)) return entry;
    batchOpenedWalletIds.add(entry.walletId);
  }
  return null;
}

// apps/prototype-web/client/src/storage/local/deliveryReversalCommitGuard.ts
var STALE_MESSAGE = "\u0633\u062C\u0644 \u0627\u0644\u0637\u0644\u0628 \u062A\u063A\u064A\u0651\u0631 \u0645\u0646 \u0645\u0633\u0627\u0631 \u0622\u062E\u0631 \u0628\u0639\u062F \u0641\u062A\u062D\u0643 \u0644\u0647 \u2014 \u0644\u0645 \u064A\u064F\u0633\u062C\u064E\u0651\u0644 \u0634\u064A\u0621\u061B \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.";
var REVERSAL_NEXT_ACTION = "\u0631\u0627\u062C\u0639 \u0627\u0644\u0637\u0644\u0628 \u0628\u0639\u062F \u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0627\u0644\u0645\u0648\u062B\u0642 \u0639\u0646 \u0627\u0644\u062A\u0633\u0644\u064A\u0645 \u2014 \u0623\u0639\u0650\u062F \u0627\u0644\u062A\u0646\u0641\u064A\u0630 \u0623\u0648 \u0623\u0644\u063A\u0650 \u0645\u0648\u062B\u0642\u064B\u0627";
function deepEqual(left, right) {
  if (left === right) return true;
  if (left == null || right == null) return left == null && right == null;
  if (typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => deepEqual(item, right[index]));
  }
  const leftRecord = left;
  const rightRecord = right;
  const keys = /* @__PURE__ */ new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
  return Array.from(keys).every((key) => deepEqual(leftRecord[key], rightRecord[key]));
}
function sameOrderEvent(left, right) {
  return left.id === right.id && left.type === right.type && left.idempotencyKey === right.idempotencyKey && left.createdAt === right.createdAt && (left.note ?? null) === (right.note ?? null) && (left.amountMinor ?? null) === (right.amountMinor ?? null) && (left.fromStatus ?? null) === (right.fromStatus ?? null) && (left.toStatus ?? null) === (right.toStatus ?? null) && (left.fromPriceMinor ?? null) === (right.fromPriceMinor ?? null) && (left.toPriceMinor ?? null) === (right.toPriceMinor ?? null) && (left.reversesEventId ?? null) === (right.reversesEventId ?? null);
}
function eventsIdentical(stored, incoming) {
  return stored.length === incoming.length && stored.every((event, index) => sameOrderEvent(event, incoming[index]));
}
function orderBasicsIdentical(stored, incoming) {
  const strip = (order) => {
    const {
      events: _events,
      status: _status,
      recognizedRevenueMinor: _recognizedRevenueMinor,
      recognizedCostMinor: _recognizedCostMinor,
      profitIndicatorMinor: _profitIndicatorMinor,
      resultStatus: _resultStatus,
      nextAction: _nextAction,
      ...rest
    } = order;
    return rest;
  };
  return deepEqual(strip(stored), strip(incoming));
}
function wrapperIdentical(stored, incoming) {
  const strip = (record) => {
    const { updatedAt: _updatedAt, order: _order, ...rest } = record;
    return rest;
  };
  return deepEqual(strip(stored), strip(incoming));
}
function decodeReversalTail(order) {
  const events = order.events;
  const last = events.length > 0 ? events[events.length - 1] : null;
  if (!last || last.type !== "delivery_reversed" || !last.reversesEventId) return null;
  const key = last.idempotencyKey;
  if (last.id !== `${order.id}:${key}`) return null;
  const secondLast = events.length > 1 ? events[events.length - 2] : null;
  const statusEvent = secondLast !== null && secondLast.type === "status_changed" && secondLast.idempotencyKey === `status:${key}:status` ? secondLast : null;
  if (statusEvent) {
    if (statusEvent.id !== `${order.id}:status:${key}:status` || statusEvent.toStatus !== "needs_review" || !statusEvent.fromStatus || statusEvent.fromStatus === "needs_review")
      return null;
    return {
      key,
      deliveryEventId: last.reversesEventId,
      tailLength: 2,
      statusFrom: statusEvent.fromStatus
    };
  }
  return { key, deliveryEventId: last.reversesEventId, tailLength: 1, statusFrom: null };
}
function reversalPostValuesIntact(order) {
  return order.status === "needs_review" && order.recognizedRevenueMinor === 0 && order.recognizedCostMinor === 0 && order.profitIndicatorMinor === null && order.resultStatus === "review_required" && order.nextAction === REVERSAL_NEXT_ACTION;
}
function lastDeliveredEventId(events) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type === "status_changed" && event.toStatus === "delivered") return event.id;
  }
  return null;
}
function isReversalStatusEvent(event) {
  return event.type === "status_changed" && event.toStatus === "needs_review";
}
function validateDeliveryReversalCommitInternal(stored, incoming) {
  if (stored === void 0) return { ok: false, message: STALE_MESSAGE };
  const tail = decodeReversalTail(incoming.order);
  if (tail === null) return { ok: false, message: STALE_MESSAGE };
  if (!reversalPostValuesIntact(incoming.order)) return { ok: false, message: STALE_MESSAGE };
  const storedEvents = stored.order.events;
  const incomingEvents = incoming.order.events;
  const baseLength = incomingEvents.length - tail.tailLength;
  if (storedEvents.some((event) => event.type === "delivery_reversed" && event.idempotencyKey === tail.key)) {
    return { ok: true, reused: true, deliveryEventId: tail.deliveryEventId };
  }
  const storedTargetsSameDelivery = storedEvents.some(
    (event) => event.type === "delivery_reversed" && event.reversesEventId === tail.deliveryEventId
  );
  if (storedTargetsSameDelivery) {
    if (baseLength < 0 || storedEvents.length !== incomingEvents.length)
      return { ok: false, message: STALE_MESSAGE };
    if (!eventsIdentical(storedEvents.slice(0, baseLength), incomingEvents.slice(0, baseLength)))
      return { ok: false, message: STALE_MESSAGE };
    const storedLast = storedEvents[storedEvents.length - 1];
    if (storedLast.type !== "delivery_reversed" || storedLast.reversesEventId !== tail.deliveryEventId)
      return { ok: false, message: STALE_MESSAGE };
    if (tail.tailLength === 2 && !isReversalStatusEvent(storedEvents[storedEvents.length - 2]))
      return { ok: false, message: STALE_MESSAGE };
    if (!orderBasicsIdentical(stored.order, incoming.order)) return { ok: false, message: STALE_MESSAGE };
    if (!wrapperIdentical(stored, incoming)) return { ok: false, message: STALE_MESSAGE };
    return { ok: true, reused: true, deliveryEventId: tail.deliveryEventId };
  }
  if (baseLength !== storedEvents.length) return { ok: false, message: STALE_MESSAGE };
  if (baseLength >= 0 && !eventsIdentical(storedEvents, incomingEvents.slice(0, baseLength)))
    return { ok: false, message: STALE_MESSAGE };
  if (tail.tailLength === 2) {
    if (tail.statusFrom !== stored.order.status) return { ok: false, message: STALE_MESSAGE };
    if (stored.order.status !== "delivered" && stored.order.status !== "settled")
      return { ok: false, message: STALE_MESSAGE };
  } else if (stored.order.status !== "needs_review") {
    return { ok: false, message: STALE_MESSAGE };
  }
  if (lastDeliveredEventId(storedEvents) !== tail.deliveryEventId)
    return { ok: false, message: STALE_MESSAGE };
  if (!orderBasicsIdentical(stored.order, incoming.order)) return { ok: false, message: STALE_MESSAGE };
  if (!wrapperIdentical(stored, incoming)) return { ok: false, message: STALE_MESSAGE };
  return { ok: true, reused: false, deliveryEventId: tail.deliveryEventId };
}
function validateDeliveryReversalCommit(stored, incoming) {
  try {
    return validateDeliveryReversalCommitInternal(stored, incoming);
  } catch {
    return { ok: false, message: STALE_MESSAGE };
  }
}
function validateDeliveryReversalMovements(orderId, deliveryEventId, incoming, storedMovements) {
  try {
    const seenKeys = /* @__PURE__ */ new Set();
    for (const movement of incoming) {
      if (movement.type !== "reversal") return { ok: false, message: STALE_MESSAGE };
      if (!movement.reversesMovementId) return { ok: false, message: STALE_MESSAGE };
      const target = storedMovements.find((candidate) => candidate.id === movement.reversesMovementId);
      if (!target) return { ok: false, message: STALE_MESSAGE };
      if (target.type !== "consumption" || target.orderId !== orderId || !target.operationKey.startsWith(`${orderId}:deliver:${deliveryEventId}:`)) {
        return { ok: false, message: STALE_MESSAGE };
      }
      if (movement.operationKey !== `${target.operationKey}:reversal` || movement.id !== `delivery-reversal-${target.id}` || movement.materialId !== target.materialId || movement.quantityDeltaMilli !== -target.quantityDeltaMilli || movement.valueDeltaMinor !== -target.valueDeltaMinor || (movement.costKnowledge ?? "known") !== (target.costKnowledge ?? "known")) {
        return { ok: false, message: STALE_MESSAGE };
      }
      if (seenKeys.has(movement.operationKey)) return { ok: false, message: STALE_MESSAGE };
      seenKeys.add(movement.operationKey);
    }
    return { ok: true };
  } catch {
    return { ok: false, message: STALE_MESSAGE };
  }
}
function committedReversalMovements(incoming, stored) {
  const byKey = new Map(stored.map((movement) => [movement.operationKey, movement]));
  return incoming.map((movement) => byKey.get(movement.operationKey) ?? movement);
}
function storedReversalMovementsFor(incoming, stored) {
  const byKey = new Map(stored.map((movement) => [movement.operationKey, movement]));
  return incoming.flatMap((movement) => {
    const matching = byKey.get(movement.operationKey);
    return matching ? [matching] : [];
  });
}

// apps/prototype-web/client/src/storage/local/supplierScheduleCommitGuard.ts
var STALE_MESSAGE2 = "\u0633\u062C\u0644 \u0627\u0644\u0634\u0631\u0627\u0621 \u062A\u063A\u064A\u0651\u0631 \u0645\u0646 \u0645\u0633\u0627\u0631 \u0622\u062E\u0631 \u0628\u0639\u062F \u0641\u062A\u062D\u0643 \u0644\u0647 \u2014 \u0644\u0645 \u064A\u064F\u0633\u062C\u064E\u0651\u0644 \u0634\u064A\u0621\u061B \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.";
var MISSING_MESSAGE = "\u0633\u062C\u0644 \u0627\u0644\u0634\u0631\u0627\u0621 \u0644\u0645 \u064A\u0639\u062F \u0645\u0648\u062C\u0648\u062F\u064B\u0627 \u0645\u062D\u0644\u064A\u064B\u0627\u061B \u0644\u0645 \u064A\u064F\u0633\u062C\u064E\u0651\u0644 \u0634\u064A\u0621.";
var samePayment = (a, b) => a.id === b.id && a.amountMinor === b.amountMinor && a.occurredOn === b.occurredOn && a.recordedAt === b.recordedAt && a.idempotencyKey === b.idempotencyKey && a.note === b.note;
var sameReversal = (a, b) => a.id === b.id && a.paymentId === b.paymentId && a.amountMinor === b.amountMinor && a.reason === b.reason && a.occurredOn === b.occurredOn && a.recordedAt === b.recordedAt && a.idempotencyKey === b.idempotencyKey;
var sameRevision = (a, b) => a.kind === b.kind && a.idempotencyKey === b.idempotencyKey && a.createdAt === b.createdAt && a.reason === b.reason && a.beforeTotalMinor === b.beforeTotalMinor && a.beforeInitialPaidMinor === b.beforeInitialPaidMinor && a.beforeSupplierName === b.beforeSupplierName && a.beforeNote === b.beforeNote && a.beforePurchasedOn === b.beforePurchasedOn && a.beforeDueOn === b.beforeDueOn && (a.beforeMaterialId ?? null) === (b.beforeMaterialId ?? null) && (a.beforeExpectedQuantityMilli ?? null) === (b.beforeExpectedQuantityMilli ?? null);
var totalPaidOf = (payments) => payments.reduce((sum, payment) => sum + payment.amountMinor, 0);
var totalReversedOf = (reversals) => (reversals ?? []).reduce((sum, reversal) => sum + reversal.amountMinor, 0);
var statusFor = (totalMinor, paidMinor) => paidMinor <= 0 ? "unpaid" : paidMinor >= totalMinor ? "paid" : "partially_paid";
function derivedFieldsConsistent(purchase) {
  const paidMinor = totalPaidOf(purchase.payments) - totalReversedOf(purchase.paymentReversals);
  return purchase.paidMinor === paidMinor && purchase.payableMinor === purchase.totalMinor - paidMinor && purchase.status === statusFor(purchase.totalMinor, paidMinor) && paidMinor >= 0 && paidMinor <= purchase.totalMinor;
}
function headerIdentical(stored, incoming) {
  return stored.id === incoming.id && stored.idempotencyKey === incoming.idempotencyKey && stored.supplierName === incoming.supplierName && stored.note === incoming.note && stored.purchasedOn === incoming.purchasedOn && stored.dueOn === incoming.dueOn && stored.totalMinor === incoming.totalMinor && (stored.materialId ?? null) === (incoming.materialId ?? null) && (stored.expectedQuantityMilli ?? null) === (incoming.expectedQuantityMilli ?? null) && stored.createdAt === incoming.createdAt;
}
function paymentsIdentical(stored, incoming) {
  return stored.payments.length === incoming.payments.length && stored.payments.every((payment, index) => samePayment(payment, incoming.payments[index]));
}
function reversalsIdentical(stored, incoming) {
  const storedReversals = stored.paymentReversals ?? [];
  const incomingReversals = incoming.paymentReversals ?? [];
  return storedReversals.length === incomingReversals.length && storedReversals.every((reversal, index) => sameReversal(reversal, incomingReversals[index]));
}
function revisionsAppendable(stored, incoming) {
  const storedRevisions = stored.revisions ?? [];
  const incomingRevisions = incoming.revisions ?? [];
  if (incomingRevisions.length !== storedRevisions.length + 1) return null;
  if (!storedRevisions.every((revision, index) => sameRevision(revision, incomingRevisions[index])))
    return null;
  return incomingRevisions[incomingRevisions.length - 1];
}
function validateSupplierPurchaseCommit(stored, commit) {
  const { kind, purchase, idempotencyKey } = commit;
  if (kind === "create") {
    if (stored === void 0) return { ok: true, reused: false };
    if (stored.idempotencyKey === idempotencyKey) return { ok: true, reused: true };
    return { ok: false, message: STALE_MESSAGE2 };
  }
  if (stored === void 0) return { ok: false, message: MISSING_MESSAGE };
  if (!derivedFieldsConsistent(purchase)) return { ok: false, message: STALE_MESSAGE2 };
  if (kind === "payment") {
    if (stored.payments.some((payment) => payment.idempotencyKey === idempotencyKey))
      return { ok: true, reused: true };
    if (purchase.payments.length !== stored.payments.length + 1) return { ok: false, message: STALE_MESSAGE2 };
    const incomingById = new Map(purchase.payments.map((payment) => [payment.id, payment]));
    if (incomingById.size !== purchase.payments.length) return { ok: false, message: STALE_MESSAGE2 };
    const added = purchase.payments.filter(
      (payment) => !stored.payments.some((candidate) => candidate.id === payment.id)
    );
    if (added.length !== 1 || added[0].idempotencyKey !== idempotencyKey || !stored.payments.every((payment) => {
      const counterpart = incomingById.get(payment.id);
      return counterpart !== void 0 && samePayment(payment, counterpart);
    }))
      return { ok: false, message: STALE_MESSAGE2 };
    if (!reversalsIdentical(stored, purchase)) return { ok: false, message: STALE_MESSAGE2 };
    if ((purchase.revisions ?? []).length !== (stored.revisions ?? []).length)
      return { ok: false, message: STALE_MESSAGE2 };
    if (!headerIdentical(stored, purchase)) return { ok: false, message: STALE_MESSAGE2 };
    return { ok: true, reused: false };
  }
  if (kind === "payment_reversal") {
    if ((stored.paymentReversals ?? []).some((reversal) => reversal.idempotencyKey === idempotencyKey))
      return { ok: true, reused: true };
    const storedReversals = stored.paymentReversals ?? [];
    const incomingReversals = purchase.paymentReversals ?? [];
    if (incomingReversals.length !== storedReversals.length + 1) return { ok: false, message: STALE_MESSAGE2 };
    const newReversal = incomingReversals[incomingReversals.length - 1];
    if (newReversal.idempotencyKey !== idempotencyKey) return { ok: false, message: STALE_MESSAGE2 };
    const targetPayment = stored.payments.find((payment) => payment.id === newReversal.paymentId);
    if (!targetPayment || targetPayment.id === `${stored.id}:initial` || storedReversals.some((reversal) => reversal.paymentId === newReversal.paymentId) || newReversal.amountMinor !== targetPayment.amountMinor)
      return { ok: false, message: STALE_MESSAGE2 };
    if (!paymentsIdentical(stored, purchase)) return { ok: false, message: STALE_MESSAGE2 };
    if (!storedReversals.every((reversal, index) => sameReversal(reversal, incomingReversals[index])))
      return { ok: false, message: STALE_MESSAGE2 };
    if ((purchase.revisions ?? []).length !== (stored.revisions ?? []).length)
      return { ok: false, message: STALE_MESSAGE2 };
    if (!headerIdentical(stored, purchase)) return { ok: false, message: STALE_MESSAGE2 };
    return { ok: true, reused: false };
  }
  if ((stored.revisions ?? []).some((revision) => revision.idempotencyKey === idempotencyKey))
    return { ok: true, reused: true };
  const newRevision = revisionsAppendable(stored, purchase);
  if (!newRevision || newRevision.idempotencyKey !== idempotencyKey)
    return { ok: false, message: STALE_MESSAGE2 };
  const initialPayment = stored.payments.find((payment) => payment.id === `${stored.id}:initial`);
  if (newRevision.beforeTotalMinor !== stored.totalMinor || newRevision.beforeInitialPaidMinor !== (initialPayment?.amountMinor ?? 0) || newRevision.beforeSupplierName !== stored.supplierName || newRevision.beforeNote !== stored.note || newRevision.beforePurchasedOn !== stored.purchasedOn || newRevision.beforeDueOn !== stored.dueOn || (newRevision.beforeMaterialId ?? null) !== (stored.materialId ?? null) || (newRevision.beforeExpectedQuantityMilli ?? null) !== (stored.expectedQuantityMilli ?? null))
    return { ok: false, message: STALE_MESSAGE2 };
  const storedLater = stored.payments.filter((payment) => payment.id !== `${stored.id}:initial`);
  const incomingLater = purchase.payments.filter((payment) => payment.id !== `${stored.id}:initial`);
  if (incomingLater.length !== storedLater.length || !incomingLater.every((payment, index) => samePayment(payment, storedLater[index])))
    return { ok: false, message: STALE_MESSAGE2 };
  const incomingInitial = purchase.payments.find((payment) => payment.id === `${stored.id}:initial`);
  const expectedInitialKey = initialPayment?.idempotencyKey ?? `${idempotencyKey}:initial`;
  if (incomingInitial && incomingInitial.idempotencyKey !== expectedInitialKey)
    return { ok: false, message: STALE_MESSAGE2 };
  if (!reversalsIdentical(stored, purchase)) return { ok: false, message: STALE_MESSAGE2 };
  if (stored.id !== purchase.id || stored.idempotencyKey !== purchase.idempotencyKey || stored.createdAt !== purchase.createdAt)
    return { ok: false, message: STALE_MESSAGE2 };
  return { ok: true, reused: false };
}
var sameScheduleEvent = (a, b) => a.id === b.id && a.type === b.type && a.idempotencyKey === b.idempotencyKey && a.createdAt === b.createdAt && a.previousScheduledFor === b.previousScheduledFor && a.scheduledFor === b.scheduledFor && a.previousScheduledTime === b.previousScheduledTime && a.scheduledTime === b.scheduledTime && a.previousDurationMinutes === b.previousDurationMinutes && a.durationMinutes === b.durationMinutes && a.reason === b.reason;
var SCHEDULE_STALE_MESSAGE = "\u0627\u0644\u0645\u0648\u0639\u062F \u062A\u063A\u064A\u0651\u0631 \u0645\u0646 \u0645\u0633\u0627\u0631 \u0622\u062E\u0631 \u0628\u0639\u062F \u0641\u062A\u062D\u0643 \u0644\u0647 \u2014 \u0644\u0645 \u064A\u064F\u0633\u062C\u064E\u0651\u0644 \u0634\u064A\u0621\u061B \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.";
var SCHEDULE_MISSING_MESSAGE = "\u0627\u0644\u0645\u0648\u0639\u062F \u0644\u0645 \u064A\u0639\u062F \u0645\u0648\u062C\u0648\u062F\u064B\u0627 \u0645\u062D\u0644\u064A\u064B\u0627\u061B \u0644\u0645 \u064A\u064F\u0633\u062C\u064E\u0651\u0644 \u0634\u064A\u0621.";
function validateScheduleCreate(stored) {
  return stored === void 0 ? { ok: true, reused: false } : { ok: true, reused: true };
}
function validateScheduleUpdate(stored, incoming) {
  if (stored === void 0) return { ok: false, message: SCHEDULE_MISSING_MESSAGE };
  if (incoming.events.length < 1) return { ok: false, message: SCHEDULE_STALE_MESSAGE };
  const newEvent = incoming.events[incoming.events.length - 1];
  if (stored.events.some((event) => event.idempotencyKey === newEvent.idempotencyKey))
    return { ok: true, reused: true };
  if (incoming.events.length !== stored.events.length + 1)
    return { ok: false, message: SCHEDULE_STALE_MESSAGE };
  if (!stored.events.every((event, index) => sameScheduleEvent(event, incoming.events[index])))
    return { ok: false, message: SCHEDULE_STALE_MESSAGE };
  if (stored.id !== incoming.id || stored.orderId !== incoming.orderId || stored.kind !== incoming.kind || stored.createdAt !== incoming.createdAt || (stored.recurrenceId ?? null) !== (incoming.recurrenceId ?? null) || (stored.recurrenceIndex ?? null) !== (incoming.recurrenceIndex ?? null))
    return { ok: false, message: SCHEDULE_STALE_MESSAGE };
  if (newEvent.previousScheduledFor !== stored.scheduledFor || newEvent.previousScheduledTime !== stored.scheduledTime || newEvent.previousDurationMinutes !== stored.durationMinutes)
    return { ok: false, message: SCHEDULE_STALE_MESSAGE };
  if (incoming.scheduledFor !== newEvent.scheduledFor || incoming.scheduledTime !== newEvent.scheduledTime || incoming.durationMinutes !== newEvent.durationMinutes)
    return { ok: false, message: SCHEDULE_STALE_MESSAGE };
  if (newEvent.type === "completed") {
    if (incoming.status !== "completed" || incoming.scheduledFor !== stored.scheduledFor || incoming.scheduledTime !== stored.scheduledTime || incoming.durationMinutes !== stored.durationMinutes || incoming.postponeReason !== stored.postponeReason)
      return { ok: false, message: SCHEDULE_STALE_MESSAGE };
    return { ok: true, reused: false };
  }
  if (newEvent.type === "cancelled") {
    if (incoming.status !== "cancelled" || incoming.scheduledFor !== stored.scheduledFor || incoming.scheduledTime !== stored.scheduledTime || incoming.durationMinutes !== stored.durationMinutes)
      return { ok: false, message: SCHEDULE_STALE_MESSAGE };
    return { ok: true, reused: false };
  }
  if (newEvent.type === "postponed") {
    if (incoming.status !== "postponed" || incoming.scheduledFor === stored.scheduledFor || incoming.postponeReason !== newEvent.reason)
      return { ok: false, message: SCHEDULE_STALE_MESSAGE };
    return { ok: true, reused: false };
  }
  if (newEvent.type === "timing_changed") {
    if (incoming.status !== stored.status || incoming.scheduledFor !== stored.scheduledFor || incoming.postponeReason !== stored.postponeReason)
      return { ok: false, message: SCHEDULE_STALE_MESSAGE };
    return { ok: true, reused: false };
  }
  return { ok: false, message: SCHEDULE_STALE_MESSAGE };
}

// apps/prototype-web/client/src/storage/local/orderCommitGuard.ts
var STALE_MESSAGE3 = "\u0633\u062C\u0644 \u0627\u0644\u0637\u0644\u0628 \u062A\u063A\u064A\u0651\u0631 \u0645\u0646 \u0645\u0633\u0627\u0631 \u0622\u062E\u0631 \u0628\u0639\u062F \u0641\u062A\u062D\u0643 \u0644\u0647 \u2014 \u0644\u0645 \u064A\u064F\u0633\u062C\u064E\u0651\u0644 \u0634\u064A\u0621\u061B \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.";
var MISSING_MESSAGE2 = "\u0633\u062C\u0644 \u0627\u0644\u0637\u0644\u0628 \u0644\u0645 \u064A\u0639\u062F \u0645\u0648\u062C\u0648\u062F\u064B\u0627 \u0645\u062D\u0644\u064A\u064B\u0627\u061B \u0644\u0645 \u064A\u064F\u0633\u062C\u064E\u0651\u0644 \u0634\u064A\u0621.";
function deepEqual2(left, right) {
  if (left === right) return true;
  if (left == null || right == null) return left == null && right == null;
  if (typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => deepEqual2(item, right[index]));
  }
  const leftRecord = left;
  const rightRecord = right;
  const keys = /* @__PURE__ */ new Set([...Object.keys(leftRecord), ...Object.keys(rightRecord)]);
  return Array.from(keys).every((key) => deepEqual2(leftRecord[key], rightRecord[key]));
}
function sameOrderEvent2(left, right) {
  return left.id === right.id && left.type === right.type && left.idempotencyKey === right.idempotencyKey && left.createdAt === right.createdAt && (left.note ?? null) === (right.note ?? null) && (left.amountMinor ?? null) === (right.amountMinor ?? null) && (left.fromStatus ?? null) === (right.fromStatus ?? null) && (left.toStatus ?? null) === (right.toStatus ?? null) && (left.fromPriceMinor ?? null) === (right.fromPriceMinor ?? null) && (left.toPriceMinor ?? null) === (right.toPriceMinor ?? null) && (left.reversesEventId ?? null) === (right.reversesEventId ?? null);
}
function orderRecordIdentical(live, base) {
  return deepEqual2(live, base);
}
function eventsExtendBase(baseEvents, nextEvents) {
  if (nextEvents.length < baseEvents.length) return false;
  return baseEvents.every((event, index) => sameOrderEvent2(event, nextEvents[index]));
}
function validateOrderCommit(live, base, next, idempotencyKeys) {
  try {
    if (live === void 0) return { ok: false, message: MISSING_MESSAGE2 };
    if (next.id !== base.id || live.id !== base.id) return { ok: false, message: STALE_MESSAGE3 };
    if (idempotencyKeys.length > 0 && live.order.events.some(
      (event) => event.idempotencyKey != null && idempotencyKeys.includes(event.idempotencyKey)
    )) {
      return { ok: true, reused: true };
    }
    if (!orderRecordIdentical(live, base)) return { ok: false, message: STALE_MESSAGE3 };
    if (!eventsExtendBase(base.order.events, next.order.events)) return { ok: false, message: STALE_MESSAGE3 };
    return { ok: true, reused: false };
  } catch {
    return { ok: false, message: STALE_MESSAGE3 };
  }
}

// apps/prototype-web/client/src/storage/local/supplierAttributionCommitGuard.ts
function storedPaymentFor(kind, purchase, idempotencyKey) {
  if (kind === "create") return purchase.payments.find((payment) => payment.id === `${purchase.id}:initial`);
  if (kind === "payment") return purchase.payments.find((payment) => payment.idempotencyKey === idempotencyKey);
  return void 0;
}
function resolveSupplierPaymentAttribution(input) {
  const { kind, idempotencyKey, attribution, purchase, storedEntries } = input;
  if (attribution === null) return { action: "skip" };
  const existing = storedEntries.find((entry) => entry.operationKey === attribution.operationKey);
  if (existing) return { action: "existing", entry: existing };
  const payment = storedPaymentFor(kind, purchase, idempotencyKey);
  if (!payment) return { action: "skip" };
  const walletId = payment.walletId?.trim() || null;
  if (!walletId) return { action: "skip" };
  return {
    action: "write",
    entry: {
      ...attribution,
      walletId,
      cashDeltaMinor: -payment.amountMinor,
      occurredOn: payment.occurredOn,
      sourceRefId: purchase.id,
      sourceRefKind: "supplier_purchase"
    }
  };
}

// apps/prototype-web/client/src/storage/local/indexedDbStores.ts
var databaseName = "micro-prototype-local";
var profileStore = "activity-profile";
var ownerProfileStore = "owner-profile";
var preferencesStore = "local-preferences";
var draftStore = "order-drafts";
var orderStore = "craft-orders";
var directSaleStore = "direct-sales";
var scheduleStore = "schedule-entries";
var recurrenceStore = "schedule-recurrences";
var financialEventStore = "financial-events";
var supplierPurchaseStore = "supplier-purchases";
var RECURRENCE_STALE_MESSAGE = "\u0642\u0627\u0644\u0628 \u0627\u0644\u062A\u0643\u0631\u0627\u0631 \u0623\u0648 \u0645\u0648\u0627\u0639\u062F\u0647 \u062A\u063A\u064A\u0651\u0631\u062A \u0645\u0646 \u0645\u0633\u0627\u0631 \u0622\u062E\u0631 \u0628\u0639\u062F \u0641\u062A\u062D\u0643 \u0644\u0647\u0627 \u2014 \u0644\u0645 \u064A\u064F\u0633\u062C\u064E\u0651\u0644 \u0634\u064A\u0621\u061B \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.";
var cashWalletStore = "cash-wallets";
var cashContinuityEntryStore = "cash-continuity-entries";
var materialStore = "materials";
var inventoryMovementStore = "inventory-movements";
var inventoryActivationStore = "inventory-activations";
var inventoryShortageStore = "inventory-shortages";
var catalogItemStore = "catalog-items";
var measurementUnitStore = "measurement-units";
var directConversionStore = "direct-conversions";
var catalogTemplateStore = "catalog-templates";
var actualTimeStore = "actual-time-records";
var shortCashDeclarationStore = "short-cash-declarations";
var ownerEntitlementPolicyStore = "owner-entitlement-policies";
var ownerEntitlementRecordStore = "owner-entitlement-records";
var ownerEntitlementOpeningBalanceStore = "owner-entitlement-opening-balances";
var ownerMovementStore = "owner-movements";
var allocationPolicyStore = "allocation-policies";
var costEstimateStore = "cost-estimates";
var assetStore = "assets";
var loanStore = "loans";
var formDraftStore = "form-drafts";
var securityStore = "local-security";
var recurringExpenseSeriesStore = "recurring-expense-series";
var recurringExpenseRevisionStore = "recurring-expense-revisions";
var recurringExpenseOccurrenceStore = "recurring-expense-occurrences";
var expenseBudgetStore = "expense-budgets";
var receivedLoanStore = "received-loans";

// apps/prototype-web/client/src/storage/local/resultCodes.ts
var STORAGE_ERROR = "storage_error";
var STORAGE_STALE = "storage_stale";
var STORAGE_UNAVAILABLE = "storage_unavailable";
var STORAGE_UPGRADE_FAILED = "storage_upgrade_failed";
var STORAGE_BLOCKED = "storage_blocked";

// apps/prototype-web/client/src/storage/local/indexedDbMigrations.ts
var StorageOpenError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "StorageOpenError";
  }
  code;
};
var staleConnections = /* @__PURE__ */ new WeakSet();
var upgradeErrors = /* @__PURE__ */ new WeakMap();
function guardUpgradeCursor(cursor, request, label) {
  cursor.onerror = () => {
    let cause = "\u0633\u0628\u0628 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641";
    try {
      const cursorError = cursor.error;
      if (cursorError) cause = cursorError.message;
    } catch {
    }
    upgradeErrors.set(
      request,
      new StorageOpenError(
        STORAGE_UPGRADE_FAILED,
        `\u062A\u0639\u0630\u0631 \u062A\u0631\u0642\u064A\u0629 \u0627\u0644\u062A\u062E\u0632\u064A\u0646 \u0627\u0644\u0645\u062D\u0644\u064A \u0623\u062B\u0646\u0627\u0621 \u062A\u0631\u062D\u064A\u0644 ${label}: ${cause}. \u0623\u063A\u0644\u0642 \u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0623\u062E\u0631\u0649 \u062B\u0645 \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.`
      )
    );
    try {
      request.transaction?.abort();
    } catch {
    }
  };
  return cursor;
}
function applySchemaUpgrade(request, event) {
  const database = request.result;
  if (!database.objectStoreNames.contains(profileStore))
    database.createObjectStore(profileStore, { keyPath: "id" });
  if (!database.objectStoreNames.contains(ownerProfileStore))
    database.createObjectStore(ownerProfileStore, { keyPath: "id" });
  if (!database.objectStoreNames.contains(preferencesStore))
    database.createObjectStore(preferencesStore, { keyPath: "id" });
  if (!database.objectStoreNames.contains(draftStore)) {
    const drafts = database.createObjectStore(draftStore, { keyPath: "id" });
    drafts.createIndex("updatedAt", "updatedAt");
  }
  if (!database.objectStoreNames.contains(orderStore)) {
    const orders = database.createObjectStore(orderStore, { keyPath: "id" });
    orders.createIndex("updatedAt", "updatedAt");
  }
  if (!database.objectStoreNames.contains(directSaleStore)) {
    const sales = database.createObjectStore(directSaleStore, { keyPath: "id" });
    sales.createIndex("occurredOn", "occurredOn");
    sales.createIndex("recordedAt", "recordedAt");
    sales.createIndex("idempotencyKey", "idempotencyKey", { unique: true });
  }
  if (!database.objectStoreNames.contains(scheduleStore)) {
    const schedules = database.createObjectStore(scheduleStore, { keyPath: "id" });
    schedules.createIndex("scheduledFor", "scheduledFor");
    schedules.createIndex("orderId", "orderId");
  }
  if (!database.objectStoreNames.contains(recurrenceStore)) {
    const recurrences = database.createObjectStore(recurrenceStore, { keyPath: "id" });
    recurrences.createIndex("sourceScheduleId", "sourceScheduleId");
    recurrences.createIndex("orderId", "orderId");
    recurrences.createIndex("status", "status");
    recurrences.createIndex("createdAt", "createdAt");
  }
  if (!database.objectStoreNames.contains(financialEventStore)) {
    const events = database.createObjectStore(financialEventStore, { keyPath: "id" });
    events.createIndex("recordedAt", "recordedAt");
    events.createIndex("occurredOn", "occurredOn");
  }
  if (!database.objectStoreNames.contains(supplierPurchaseStore)) {
    const purchases = database.createObjectStore(supplierPurchaseStore, { keyPath: "id" });
    purchases.createIndex("purchasedOn", "purchasedOn");
    purchases.createIndex("supplierName", "supplierName");
  }
  if (!database.objectStoreNames.contains(cashWalletStore))
    database.createObjectStore(cashWalletStore, { keyPath: "id" });
  if (!database.objectStoreNames.contains(cashContinuityEntryStore)) {
    const entries = database.createObjectStore(cashContinuityEntryStore, { keyPath: "id" });
    entries.createIndex("walletId", "walletId");
    entries.createIndex("occurredOn", "occurredOn");
    entries.createIndex("operationKey", "operationKey");
    entries.createIndex("transferId", "transferId");
  }
  if (!database.objectStoreNames.contains(materialStore))
    database.createObjectStore(materialStore, { keyPath: "id" });
  if (!database.objectStoreNames.contains(inventoryMovementStore)) {
    const movements = database.createObjectStore(inventoryMovementStore, { keyPath: "id" });
    movements.createIndex("materialId", "materialId");
    movements.createIndex("occurredOn", "occurredOn");
    movements.createIndex("operationKey", "operationKey");
    movements.createIndex("purchaseId", "purchaseId");
    movements.createIndex("orderId", "orderId");
  }
  if (!database.objectStoreNames.contains(inventoryActivationStore))
    database.createObjectStore(inventoryActivationStore, { keyPath: "id" });
  if (!database.objectStoreNames.contains(inventoryShortageStore)) {
    const shortages = database.createObjectStore(inventoryShortageStore, { keyPath: "id" });
    shortages.createIndex("materialId", "materialId");
    shortages.createIndex("operationKey", "operationKey");
    shortages.createIndex("status", "status");
  }
  if (!database.objectStoreNames.contains(catalogItemStore)) {
    const catalogItems = database.createObjectStore(catalogItemStore, { keyPath: "id" });
    catalogItems.createIndex("active", "active");
    catalogItems.createIndex("createdOperationKey", "createdOperationKey");
  }
  if (!database.objectStoreNames.contains(measurementUnitStore)) {
    const units = database.createObjectStore(measurementUnitStore, { keyPath: "id" });
    units.createIndex("dimension", "dimension");
    units.createIndex("active", "active");
    units.createIndex("createdOperationKey", "createdOperationKey");
  }
  if (!database.objectStoreNames.contains(directConversionStore)) {
    const conversions = database.createObjectStore(directConversionStore, { keyPath: "id" });
    conversions.createIndex("fromUnitId", "fromUnitId");
    conversions.createIndex("toUnitId", "toUnitId");
    conversions.createIndex("active", "active");
    conversions.createIndex("createdOperationKey", "createdOperationKey");
  }
  if (!database.objectStoreNames.contains(catalogTemplateStore)) {
    const templates = database.createObjectStore(catalogTemplateStore, { keyPath: "id" });
    templates.createIndex("catalogItemId", "catalogItemId");
    templates.createIndex("active", "active");
    templates.createIndex("createdOperationKey", "createdOperationKey");
  }
  if (!database.objectStoreNames.contains(actualTimeStore)) {
    const records = database.createObjectStore(actualTimeStore, { keyPath: "id" });
    records.createIndex("orderId", "orderId");
    records.createIndex("recordedOn", "recordedOn");
    records.createIndex("operationKey", "operationKey");
    records.createIndex("reversalOfId", "reversalOfId");
  }
  if (!database.objectStoreNames.contains(shortCashDeclarationStore)) {
    const declarations = database.createObjectStore(shortCashDeclarationStore, { keyPath: "id" });
    declarations.createIndex("dueOn", "dueOn");
    declarations.createIndex("createdAt", "createdAt");
    declarations.createIndex("idempotencyKey", "idempotencyKey");
    declarations.createIndex("reversalOfId", "reversalOfId");
  }
  if (!database.objectStoreNames.contains(ownerEntitlementPolicyStore)) {
    const policies = database.createObjectStore(ownerEntitlementPolicyStore, { keyPath: "id" });
    policies.createIndex("startsOn", "startsOn");
    policies.createIndex("status", "status");
    policies.createIndex("idempotencyKey", "idempotencyKey");
  }
  if (!database.objectStoreNames.contains(ownerEntitlementRecordStore)) {
    const records = database.createObjectStore(ownerEntitlementRecordStore, { keyPath: "id" });
    records.createIndex("occurredOn", "occurredOn");
    records.createIndex("policyId", "policyId");
    records.createIndex("idempotencyKey", "idempotencyKey");
  }
  if (!database.objectStoreNames.contains(ownerEntitlementOpeningBalanceStore)) {
    const balances = database.createObjectStore(ownerEntitlementOpeningBalanceStore, { keyPath: "id" });
    balances.createIndex("occurredOn", "occurredOn");
    balances.createIndex("idempotencyKey", "idempotencyKey");
  }
  if (!database.objectStoreNames.contains(ownerMovementStore)) {
    const movements = database.createObjectStore(ownerMovementStore, { keyPath: "id" });
    movements.createIndex("occurredOn", "occurredOn");
    movements.createIndex("walletId", "walletId");
    movements.createIndex("idempotencyKey", "idempotencyKey");
    movements.createIndex("relatedEntitlementId", "relatedEntitlementId");
    movements.createIndex("relatedMovementId", "relatedMovementId");
    movements.createIndex("reversalOfId", "reversalOfId");
  }
  if (!database.objectStoreNames.contains(allocationPolicyStore)) {
    const policies = database.createObjectStore(allocationPolicyStore, { keyPath: "id" });
    policies.createIndex("catalogItemId", "catalogItemId");
    policies.createIndex("startsOn", "startsOn");
    policies.createIndex("status", "status");
    policies.createIndex("idempotencyKey", "idempotencyKey");
    policies.createIndex("seriesId", "seriesId");
  }
  if (!database.objectStoreNames.contains(costEstimateStore)) {
    const costEstimates = database.createObjectStore(costEstimateStore, { keyPath: "id" });
    costEstimates.createIndex("updatedAt", "updatedAt");
  }
  if (!database.objectStoreNames.contains(assetStore)) {
    const assets = database.createObjectStore(assetStore, { keyPath: "id" });
    assets.createIndex("updatedAt", "updatedAt");
  }
  if (!database.objectStoreNames.contains(loanStore)) {
    const loans = database.createObjectStore(loanStore, { keyPath: "id" });
    loans.createIndex("updatedAt", "updatedAt");
  }
  if (!database.objectStoreNames.contains(formDraftStore)) {
    const formDrafts = database.createObjectStore(formDraftStore, { keyPath: "id" });
    formDrafts.createIndex("updatedAt", "updatedAt");
    formDrafts.createIndex("formKind", "formKind");
  }
  if (!database.objectStoreNames.contains(securityStore))
    database.createObjectStore(securityStore, { keyPath: "id" });
  if (!database.objectStoreNames.contains(recurringExpenseSeriesStore)) {
    const series = database.createObjectStore(recurringExpenseSeriesStore, { keyPath: "id" });
    series.createIndex("status", "status");
    series.createIndex("updatedAt", "updatedAt");
  }
  if (!database.objectStoreNames.contains(recurringExpenseRevisionStore)) {
    const revisions = database.createObjectStore(recurringExpenseRevisionStore, { keyPath: "id" });
    revisions.createIndex("seriesId", "seriesId");
  }
  if (!database.objectStoreNames.contains(recurringExpenseOccurrenceStore)) {
    const occurrences = database.createObjectStore(recurringExpenseOccurrenceStore, { keyPath: "id" });
    occurrences.createIndex("seriesId", "seriesId");
    occurrences.createIndex("periodKey", "periodKey");
    occurrences.createIndex("status", "status");
  }
  if (!database.objectStoreNames.contains(expenseBudgetStore)) {
    const budgets = database.createObjectStore(expenseBudgetStore, { keyPath: "id" });
    budgets.createIndex("periodKey", "periodKey");
    budgets.createIndex("status", "status");
    budgets.createIndex("operationKey", "operationKey");
  }
  if (!database.objectStoreNames.contains(receivedLoanStore)) {
    const receivedLoans = database.createObjectStore(receivedLoanStore, { keyPath: "id" });
    receivedLoans.createIndex("updatedAt", "updatedAt");
  }
  const policyStore = request.transaction?.objectStore(ownerEntitlementPolicyStore);
  if (policyStore && !policyStore.indexNames.contains("seriesId"))
    policyStore.createIndex("seriesId", "seriesId");
  if (policyStore && !policyStore.indexNames.contains("successorOfPolicyId"))
    policyStore.createIndex("successorOfPolicyId", "successorOfPolicyId");
  const recordStore = request.transaction?.objectStore(ownerEntitlementRecordStore);
  if (recordStore && !recordStore.indexNames.contains("reversalOfId"))
    recordStore.createIndex("reversalOfId", "reversalOfId");
  const openingStore = request.transaction?.objectStore(ownerEntitlementOpeningBalanceStore);
  if (openingStore && !openingStore.indexNames.contains("reversalOfId"))
    openingStore.createIndex("reversalOfId", "reversalOfId");
  const movementStore = request.transaction?.objectStore(ownerMovementStore);
  if (movementStore && !movementStore.indexNames.contains("relatedOpeningBalanceId"))
    movementStore.createIndex("relatedOpeningBalanceId", "relatedOpeningBalanceId");
  if (event.oldVersion < 23) {
    if (policyStore) {
      const cursor = guardUpgradeCursor(policyStore.openCursor(), request, "\u0633\u064A\u0627\u0633\u0627\u062A \u062D\u0642 \u0627\u0644\u0645\u0627\u0644\u0643");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        const value = current.value;
        current.update({
          ...value,
          seriesId: typeof value.seriesId === "string" && value.seriesId ? value.seriesId : value.id,
          successorOfPolicyId: typeof value.successorOfPolicyId === "string" ? value.successorOfPolicyId : null
        });
        current.continue();
      };
    }
    if (recordStore) {
      const cursor = guardUpgradeCursor(recordStore.openCursor(), request, "\u0633\u062C\u0644\u0627\u062A \u062D\u0642 \u0627\u0644\u0645\u0627\u0644\u0643");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        const value = current.value;
        current.update({
          ...value,
          sourceKeys: Array.isArray(value.sourceKeys) && value.sourceKeys.length > 0 ? value.sourceKeys : [`legacy:record:${value.id}`],
          reversalOfId: typeof value.reversalOfId === "string" ? value.reversalOfId : null,
          reversalReason: typeof value.reversalReason === "string" ? value.reversalReason : null
        });
        current.continue();
      };
    }
    if (openingStore) {
      const cursor = guardUpgradeCursor(openingStore.openCursor(), request, "\u0623\u0631\u0635\u062F\u0629 \u0627\u0641\u062A\u062A\u0627\u062D \u062D\u0642 \u0627\u0644\u0645\u0627\u0644\u0643");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        const value = current.value;
        current.update({
          ...value,
          reversalOfId: typeof value.reversalOfId === "string" ? value.reversalOfId : null,
          reversalReason: typeof value.reversalReason === "string" ? value.reversalReason : null
        });
        current.continue();
      };
    }
    if (movementStore) {
      const cursor = guardUpgradeCursor(movementStore.openCursor(), request, "\u062D\u0631\u0643\u0627\u062A \u0627\u0644\u0645\u0627\u0644\u0643");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        const value = current.value;
        current.update({
          ...value,
          relatedOpeningBalanceId: typeof value.relatedOpeningBalanceId === "string" ? value.relatedOpeningBalanceId : null,
          openingBalanceDeltaMinor: typeof value.openingBalanceDeltaMinor === "number" ? value.openingBalanceDeltaMinor : 0,
          reversalOfId: typeof value.reversalOfId === "string" ? value.reversalOfId : null,
          reversalReason: typeof value.reversalReason === "string" ? value.reversalReason : null
        });
        current.continue();
      };
    }
  }
  if (event.oldVersion < 25) {
    const movements = request.transaction?.objectStore(inventoryMovementStore);
    if (movements) {
      const cursor = guardUpgradeCursor(movements.openCursor(), request, "\u062D\u0631\u0643\u0627\u062A \u0627\u0644\u0645\u062E\u0632\u0648\u0646");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        const legacy = current.value;
        current.update({
          ...legacy,
          wasteContext: legacy.type === "waste" ? legacy.wasteContext ?? { kind: "general_project" } : null
        });
        current.continue();
      };
    }
  }
  if (event.oldVersion < 26) {
    const allocationPolicies = request.transaction?.objectStore(allocationPolicyStore);
    if (allocationPolicies) {
      const cursor = guardUpgradeCursor(allocationPolicies.openCursor(), request, "\u0633\u064A\u0627\u0633\u0627\u062A \u0627\u0644\u062A\u0648\u0632\u064A\u0639");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        const legacy = current.value;
        const isPerOutputUnit = legacy.kind === "per_output_unit";
        current.update({
          ...legacy,
          rateMinorPerWholeUnit: isPerOutputUnit ? typeof legacy.rateMinorPerWholeUnit === "number" ? legacy.rateMinorPerWholeUnit : typeof legacy.rateMinor === "number" ? legacy.rateMinor : null : null,
          rateMinor: isPerOutputUnit ? null : typeof legacy.rateMinor === "number" ? legacy.rateMinor : null
        });
        current.continue();
      };
    }
  }
  if (event.oldVersion < 24) {
    const catalogItems = request.transaction?.objectStore(catalogItemStore);
    if (catalogItems) {
      const cursor = guardUpgradeCursor(catalogItems.openCursor(), request, "\u0639\u0646\u0627\u0635\u0631 \u0627\u0644\u0643\u062A\u0627\u0644\u0648\u062C");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        const legacy = current.value;
        current.update({
          ...legacy,
          unitId: typeof legacy.unitId === "string" && legacy.unitId ? legacy.unitId : null
        });
        current.continue();
      };
    }
  }
  if (event.oldVersion < 17) {
    const drafts = request.transaction?.objectStore(draftStore);
    if (drafts) {
      const cursor = guardUpgradeCursor(drafts.openCursor(), request, "\u0627\u0644\u0645\u0633\u0648\u062F\u0627\u062A");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        const legacy = current.value;
        current.update({
          ...legacy,
          ...event.oldVersion < 4 ? {
            costSnapshots: Array.isArray(legacy.costSnapshots) ? legacy.costSnapshots : [],
            activeCostSnapshotId: legacy.activeCostSnapshotId ?? null,
            linkedOrderId: legacy.linkedOrderId ?? null
          } : {},
          ...event.oldVersion < 17 ? { catalogItemId: legacy.catalogItemId ?? null } : {}
        });
        current.continue();
      };
    }
  }
  if (event.oldVersion < 8) {
    const transaction = request.transaction;
    const schedules = transaction?.objectStore(scheduleStore);
    if (schedules) {
      const cursor = guardUpgradeCursor(schedules.openCursor(), request, "\u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        const legacy = current.value;
        current.update({
          ...legacy,
          scheduledTime: legacy.scheduledTime ?? null,
          durationMinutes: legacy.durationMinutes ?? null,
          events: Array.isArray(legacy.events) ? legacy.events.map((entry) => ({
            ...entry,
            previousScheduledTime: entry.previousScheduledTime ?? null,
            scheduledTime: entry.scheduledTime ?? null,
            previousDurationMinutes: entry.previousDurationMinutes ?? null,
            durationMinutes: entry.durationMinutes ?? null
          })) : []
        });
        current.continue();
      };
    }
  }
  if (event.oldVersion < 17) {
    const orders = request.transaction?.objectStore(orderStore);
    if (orders) {
      const cursor = guardUpgradeCursor(orders.openCursor(), request, "\u0627\u0644\u0637\u0644\u0628\u0627\u062A");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        current.update({ ...current.value, catalogItemId: current.value.catalogItemId ?? null });
        current.continue();
      };
    }
  }
  if (event.oldVersion < 20) {
    const schedules = request.transaction?.objectStore(scheduleStore);
    if (schedules) {
      const cursor = guardUpgradeCursor(schedules.openCursor(), request, "\u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        current.update({
          ...current.value,
          scheduledTime: current.value.scheduledTime ?? null,
          durationMinutes: current.value.durationMinutes ?? null,
          events: Array.isArray(current.value.events) ? current.value.events.map((entry) => ({
            ...entry,
            previousScheduledTime: entry.previousScheduledTime ?? null,
            scheduledTime: entry.scheduledTime ?? null,
            previousDurationMinutes: entry.previousDurationMinutes ?? null,
            durationMinutes: entry.durationMinutes ?? null
          })) : [],
          recurrenceId: current.value.recurrenceId ?? null,
          recurrenceIndex: current.value.recurrenceIndex ?? null
        });
        current.continue();
      };
    }
    const orders = request.transaction?.objectStore(orderStore);
    if (orders) {
      const cursor = guardUpgradeCursor(orders.openCursor(), request, "\u0627\u0644\u0637\u0644\u0628\u0627\u062A");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        current.update({
          ...current.value,
          catalogItemId: current.value.catalogItemId ?? null,
          followUpSummary: current.value.followUpSummary ?? null,
          followUpDate: current.value.followUpDate ?? null,
          followUpReason: current.value.followUpReason ?? null,
          followUpEvents: Array.isArray(current.value.followUpEvents) ? current.value.followUpEvents : []
        });
        current.continue();
      };
    }
  }
  if (event.oldVersion < 18) {
    const preferences = request.transaction?.objectStore(preferencesStore);
    if (preferences) {
      const cursor = guardUpgradeCursor(preferences.openCursor(), request, "\u0627\u0644\u062A\u0641\u0636\u064A\u0644\u0627\u062A");
      cursor.onsuccess = () => {
        const current = cursor.result;
        if (!current) return;
        current.update({
          ...current.value,
          ...event.oldVersion < 8 ? { dailyScheduleCapacityMinutes: current.value.dailyScheduleCapacityMinutes ?? null } : {},
          ...event.oldVersion < 18 ? {
            workMode: current.value.workMode ?? null,
            actualTimeTrackingEnabled: current.value.actualTimeTrackingEnabled ?? false
          } : {}
        });
        current.continue();
      };
    }
  }
}

// apps/prototype-web/client/src/storage/local/indexedDbLifecycle.ts
var cachedConnection = null;
function connection() {
  if (cachedConnection === null) {
    const promise = openDatabase();
    promise.catch(() => {
      if (cachedConnection === promise) cachedConnection = null;
    });
    cachedConnection = promise;
  }
  return cachedConnection;
}
function failure(error, database) {
  if (database && staleConnections.has(database)) {
    return {
      ok: false,
      code: STORAGE_STALE,
      message: "\u0647\u0630\u0647 \u0627\u0644\u0646\u0633\u062E\u0629 \u0642\u062F\u064A\u0645\u0629. \u0623\u0639\u062F \u062A\u062D\u0645\u064A\u0644 Micro \u0642\u0628\u0644 \u0625\u062F\u062E\u0627\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u062C\u062F\u064A\u062F\u0629."
    };
  }
  if (error instanceof StorageOpenError) return { ok: false, code: error.code, message: error.message };
  if (error instanceof Error && error.name === "VersionError") {
    return {
      ok: false,
      code: STORAGE_STALE,
      message: "\u0647\u0630\u0647 \u0627\u0644\u0646\u0633\u062E\u0629 \u0642\u062F\u064A\u0645\u0629. \u0623\u0639\u062F \u062A\u062D\u0645\u064A\u0644 Micro \u0642\u0628\u0644 \u0625\u062F\u062E\u0627\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u062C\u062F\u064A\u062F\u0629."
    };
  }
  return {
    ok: false,
    code: typeof indexedDB === "undefined" ? STORAGE_UNAVAILABLE : STORAGE_ERROR,
    message: error instanceof Error ? error.message : "\u062A\u0639\u0630\u0631 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0627\u0644\u062A\u062E\u0632\u064A\u0646 \u0627\u0644\u0645\u062D\u0644\u064A."
  };
}
function attachVersionChangeRecovery(database) {
  database.onversionchange = () => {
    staleConnections.add(database);
    cachedConnection = null;
    database.close();
  };
  return database;
}
function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("\u0627\u0644\u062A\u062E\u0632\u064A\u0646 \u0627\u0644\u0645\u062D\u0644\u064A \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0645\u062A\u0635\u0641\u062D."));
      return;
    }
    const request = indexedDB.open(databaseName, localSchemaVersion);
    let settled = false;
    request.onerror = () => {
      if (settled) return;
      settled = true;
      reject(upgradeErrors.get(request) ?? request.error ?? new Error("\u062A\u0639\u0630\u0631 \u0641\u062A\u062D \u0627\u0644\u062A\u062E\u0632\u064A\u0646 \u0627\u0644\u0645\u062D\u0644\u064A."));
    };
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(
        new StorageOpenError(
          STORAGE_BLOCKED,
          "Micro \u0645\u0641\u062A\u0648\u062D \u0641\u064A \u0646\u0627\u0641\u0630\u0629 \u0623\u062E\u0631\u0649. \u0623\u063A\u0644\u0642 \u0627\u0644\u0646\u0648\u0627\u0641\u0630 \u0627\u0644\u0623\u062E\u0631\u0649 \u062B\u0645 \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629."
        )
      );
    };
    request.onupgradeneeded = (event) => {
      applySchemaUpgrade(request, event);
    };
    request.onsuccess = () => {
      if (settled) {
        try {
          request.result.close();
        } catch {
        }
        return;
      }
      settled = true;
      resolve(attachVersionChangeRecovery(request.result));
    };
  });
}
function __openDatabaseForTesting() {
  return openDatabase();
}
function __cachedConnectionForTesting() {
  return cachedConnection;
}

// apps/prototype-web/client/src/storage/local/indexedDbPrimitives.ts
async function readOne(storeName, key) {
  try {
    const database = await connection();
    return await new Promise((resolve) => {
      const transaction = database.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).get(key);
      request.onerror = () => resolve(failure(request.error, database));
      request.onsuccess = () => resolve({ ok: true, value: request.result ?? null });
      transaction.oncomplete = () => {
      };
    });
  } catch (error) {
    return failure(error);
  }
}
async function writeOne(storeName, value) {
  try {
    const database = await connection();
    return await new Promise((resolve) => {
      const transaction = database.transaction(storeName, "readwrite");
      const request = transaction.objectStore(storeName).put(value);
      request.onerror = () => resolve(failure(request.error, database));
      transaction.onabort = () => resolve(failure(transaction.error, database));
      transaction.oncomplete = () => {
        resolve({ ok: true, value });
      };
    });
  } catch (error) {
    return failure(error);
  }
}
async function writeOneIdempotent(storeName, value, isDuplicate) {
  try {
    const database = await connection();
    return await new Promise((resolve) => {
      const transaction = database.transaction(storeName, "readwrite");
      const store = transaction.objectStore(storeName);
      const scanRequest = store.getAll();
      scanRequest.onerror = () => resolve(failure(scanRequest.error, database));
      scanRequest.onsuccess = () => {
        try {
          const existing = scanRequest.result.find(isDuplicate);
          if (existing) {
            resolve({ ok: true, value: existing });
            return;
          }
          const putRequest = store.put(value);
          putRequest.onerror = () => resolve(failure(putRequest.error, database));
        } catch (error) {
          resolve(failure(error, database));
          try {
            transaction.abort();
          } catch {
          }
        }
      };
      transaction.onabort = () => resolve(failure(transaction.error, database));
      transaction.onerror = () => resolve(failure(transaction.error, database));
      transaction.oncomplete = () => {
        resolve({ ok: true, value });
      };
    });
  } catch (error) {
    return failure(error);
  }
}
async function deleteOne(storeName, key) {
  try {
    const database = await connection();
    return await new Promise((resolve) => {
      const transaction = database.transaction(storeName, "readwrite");
      const request = transaction.objectStore(storeName).delete(key);
      request.onerror = () => resolve(failure(request.error, database));
      transaction.onabort = () => resolve(failure(transaction.error, database));
      transaction.oncomplete = () => {
        resolve({ ok: true, value: null });
      };
    });
  } catch (error) {
    return failure(error);
  }
}
async function listAll(storeName, sort) {
  try {
    const database = await connection();
    return await new Promise((resolve) => {
      const transaction = database.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).getAll();
      request.onerror = () => resolve(failure(request.error, database));
      request.onsuccess = () => {
        try {
          resolve({ ok: true, value: request.result.sort(sort) });
        } catch (error) {
          resolve(failure(error, database));
        }
      };
      transaction.oncomplete = () => {
      };
    });
  } catch (error) {
    return failure(error);
  }
}

// apps/prototype-web/client/src/storage/local/indexedDbSnapshot.ts
async function readIndexedDbSnapshot() {
  try {
    const database = await connection();
    return await new Promise((resolve) => {
      const transaction = database.transaction(
        [
          profileStore,
          ownerProfileStore,
          preferencesStore,
          draftStore,
          orderStore,
          directSaleStore,
          scheduleStore,
          recurrenceStore,
          financialEventStore,
          supplierPurchaseStore,
          cashWalletStore,
          cashContinuityEntryStore,
          materialStore,
          inventoryMovementStore,
          inventoryShortageStore,
          inventoryActivationStore,
          catalogItemStore,
          measurementUnitStore,
          directConversionStore,
          catalogTemplateStore,
          actualTimeStore,
          shortCashDeclarationStore,
          ownerEntitlementPolicyStore,
          ownerEntitlementRecordStore,
          ownerEntitlementOpeningBalanceStore,
          ownerMovementStore,
          allocationPolicyStore,
          costEstimateStore,
          assetStore,
          loanStore,
          receivedLoanStore,
          recurringExpenseSeriesStore,
          recurringExpenseRevisionStore,
          recurringExpenseOccurrenceStore,
          expenseBudgetStore
        ],
        "readonly"
      );
      const profile = transaction.objectStore(profileStore).get("local-profile");
      const ownerProfile = transaction.objectStore(ownerProfileStore).get(localOwnerProfileId);
      const preferences = transaction.objectStore(preferencesStore).get("local-preferences");
      const drafts = transaction.objectStore(draftStore).getAll();
      const orders = transaction.objectStore(orderStore).getAll();
      const directSales = transaction.objectStore(directSaleStore).getAll();
      const schedules = transaction.objectStore(scheduleStore).getAll();
      const recurrences = transaction.objectStore(recurrenceStore).getAll();
      const financialEvents = transaction.objectStore(financialEventStore).getAll();
      const supplierPurchases = transaction.objectStore(supplierPurchaseStore).getAll();
      const cashWallets = transaction.objectStore(cashWalletStore).getAll();
      const cashContinuityEntries = transaction.objectStore(cashContinuityEntryStore).getAll();
      const materials = transaction.objectStore(materialStore).getAll();
      const inventoryMovements = transaction.objectStore(inventoryMovementStore).getAll();
      const inventoryShortages = transaction.objectStore(inventoryShortageStore).getAll();
      const inventoryActivation = transaction.objectStore(inventoryActivationStore).get(localInventoryActivationId);
      const catalogItems = transaction.objectStore(catalogItemStore).getAll();
      const measurementUnits = transaction.objectStore(measurementUnitStore).getAll();
      const directConversions = transaction.objectStore(directConversionStore).getAll();
      const catalogTemplates = transaction.objectStore(catalogTemplateStore).getAll();
      const actualTimeRecords = transaction.objectStore(actualTimeStore).getAll();
      const shortCashDeclarations = transaction.objectStore(shortCashDeclarationStore).getAll();
      const ownerEntitlementPolicies = transaction.objectStore(ownerEntitlementPolicyStore).getAll();
      const ownerEntitlementRecords = transaction.objectStore(ownerEntitlementRecordStore).getAll();
      const ownerEntitlementOpeningBalances = transaction.objectStore(ownerEntitlementOpeningBalanceStore).getAll();
      const ownerMovements = transaction.objectStore(ownerMovementStore).getAll();
      const allocationPolicies = transaction.objectStore(allocationPolicyStore).getAll();
      const costEstimates = transaction.objectStore(costEstimateStore).getAll();
      const assets = transaction.objectStore(assetStore).getAll();
      const loans = transaction.objectStore(loanStore).getAll();
      const receivedLoans = transaction.objectStore(receivedLoanStore).getAll();
      const recurringExpenseSeries = transaction.objectStore(recurringExpenseSeriesStore).getAll();
      const recurringExpenseRevisions = transaction.objectStore(recurringExpenseRevisionStore).getAll();
      const recurringExpenseOccurrences = transaction.objectStore(recurringExpenseOccurrenceStore).getAll();
      const expenseBudgets = transaction.objectStore(expenseBudgetStore).getAll();
      transaction.onerror = () => resolve(failure(transaction.error, database));
      transaction.onabort = () => resolve(failure(transaction.error, database));
      transaction.oncomplete = () => {
        resolve({
          ok: true,
          value: {
            profile: profile.result ?? null,
            ownerProfile: ownerProfile.result ?? null,
            preferences: preferences.result ?? null,
            drafts: drafts.result,
            orders: orders.result,
            directSales: directSales.result,
            schedules: schedules.result,
            recurrences: recurrences.result,
            financialEvents: financialEvents.result,
            supplierPurchases: supplierPurchases.result,
            cashWallets: cashWallets.result,
            cashContinuityEntries: cashContinuityEntries.result,
            materials: materials.result,
            inventoryMovements: inventoryMovements.result,
            inventoryShortages: inventoryShortages.result,
            inventoryActivation: inventoryActivation.result ?? null,
            catalogItems: catalogItems.result,
            measurementUnits: measurementUnits.result,
            directConversions: directConversions.result,
            catalogTemplates: catalogTemplates.result,
            actualTimeRecords: actualTimeRecords.result,
            shortCashDeclarations: shortCashDeclarations.result,
            ownerEntitlementPolicies: ownerEntitlementPolicies.result,
            ownerEntitlementRecords: ownerEntitlementRecords.result,
            ownerEntitlementOpeningBalances: ownerEntitlementOpeningBalances.result,
            ownerMovements: ownerMovements.result,
            allocationPolicies: allocationPolicies.result,
            costEstimates: costEstimates.result,
            assets: assets.result,
            loans: loans.result,
            receivedLoans: receivedLoans.result,
            recurringExpenseSeries: recurringExpenseSeries.result,
            recurringExpenseRevisions: recurringExpenseRevisions.result,
            recurringExpenseOccurrences: recurringExpenseOccurrences.result,
            expenseBudgets: expenseBudgets.result
          }
        });
      };
    });
  } catch (error) {
    return failure(error);
  }
}
async function replaceIndexedDbSnapshot(snapshot) {
  try {
    const database = await connection();
    const normalized = {
      ...snapshot,
      ownerProfile: snapshot.ownerProfile ?? null,
      schedules: snapshot.schedules ?? [],
      directSales: snapshot.directSales ?? [],
      recurrences: snapshot.recurrences ?? [],
      financialEvents: snapshot.financialEvents ?? [],
      supplierPurchases: snapshot.supplierPurchases ?? [],
      cashWallets: snapshot.cashWallets ?? [],
      cashContinuityEntries: snapshot.cashContinuityEntries ?? [],
      materials: snapshot.materials ?? [],
      inventoryMovements: snapshot.inventoryMovements ?? [],
      inventoryShortages: snapshot.inventoryShortages ?? [],
      inventoryActivation: snapshot.inventoryActivation ?? null,
      catalogItems: snapshot.catalogItems ?? [],
      measurementUnits: snapshot.measurementUnits ?? [],
      directConversions: snapshot.directConversions ?? [],
      catalogTemplates: snapshot.catalogTemplates ?? [],
      actualTimeRecords: snapshot.actualTimeRecords ?? [],
      shortCashDeclarations: snapshot.shortCashDeclarations ?? [],
      ownerEntitlementPolicies: snapshot.ownerEntitlementPolicies ?? [],
      ownerEntitlementRecords: snapshot.ownerEntitlementRecords ?? [],
      ownerEntitlementOpeningBalances: snapshot.ownerEntitlementOpeningBalances ?? [],
      ownerMovements: snapshot.ownerMovements ?? [],
      allocationPolicies: snapshot.allocationPolicies ?? [],
      costEstimates: snapshot.costEstimates ?? [],
      assets: snapshot.assets ?? [],
      loans: snapshot.loans ?? [],
      receivedLoans: snapshot.receivedLoans ?? [],
      recurringExpenseSeries: snapshot.recurringExpenseSeries ?? [],
      recurringExpenseRevisions: snapshot.recurringExpenseRevisions ?? [],
      recurringExpenseOccurrences: snapshot.recurringExpenseOccurrences ?? [],
      /* FIN-002 (عقد ٤٢): تطبيع عائلة الميزانيات — الغياب = قائمة فارغة آمنة. */
      expenseBudgets: snapshot.expenseBudgets ?? []
    };
    return await new Promise((resolve) => {
      const transaction = database.transaction(
        [
          profileStore,
          ownerProfileStore,
          preferencesStore,
          draftStore,
          orderStore,
          directSaleStore,
          scheduleStore,
          recurrenceStore,
          financialEventStore,
          supplierPurchaseStore,
          cashWalletStore,
          cashContinuityEntryStore,
          materialStore,
          inventoryMovementStore,
          inventoryActivationStore,
          inventoryShortageStore,
          catalogItemStore,
          measurementUnitStore,
          directConversionStore,
          catalogTemplateStore,
          actualTimeStore,
          shortCashDeclarationStore,
          ownerEntitlementPolicyStore,
          ownerEntitlementRecordStore,
          ownerEntitlementOpeningBalanceStore,
          ownerMovementStore,
          allocationPolicyStore,
          costEstimateStore,
          assetStore,
          loanStore,
          receivedLoanStore,
          recurringExpenseSeriesStore,
          recurringExpenseRevisionStore,
          recurringExpenseOccurrenceStore,
          expenseBudgetStore
        ],
        "readwrite"
      );
      try {
        const profiles = transaction.objectStore(profileStore);
        const ownerProfiles = transaction.objectStore(ownerProfileStore);
        const preferences = transaction.objectStore(preferencesStore);
        const drafts = transaction.objectStore(draftStore);
        const orders = transaction.objectStore(orderStore);
        const directSales = transaction.objectStore(directSaleStore);
        const schedules = transaction.objectStore(scheduleStore);
        const recurrences = transaction.objectStore(recurrenceStore);
        const financialEvents = transaction.objectStore(financialEventStore);
        const supplierPurchases = transaction.objectStore(supplierPurchaseStore);
        const cashWallets = transaction.objectStore(cashWalletStore);
        const cashContinuityEntries = transaction.objectStore(cashContinuityEntryStore);
        const materials = transaction.objectStore(materialStore);
        const inventoryMovements = transaction.objectStore(inventoryMovementStore);
        const inventoryShortages = transaction.objectStore(inventoryShortageStore);
        const inventoryActivation = transaction.objectStore(inventoryActivationStore);
        const catalogItems = transaction.objectStore(catalogItemStore);
        const measurementUnits = transaction.objectStore(measurementUnitStore);
        const directConversions = transaction.objectStore(directConversionStore);
        const catalogTemplates = transaction.objectStore(catalogTemplateStore);
        const actualTimeRecords = transaction.objectStore(actualTimeStore);
        const shortCashDeclarations = transaction.objectStore(shortCashDeclarationStore);
        const ownerEntitlementPolicies = transaction.objectStore(ownerEntitlementPolicyStore);
        const ownerEntitlementRecords = transaction.objectStore(ownerEntitlementRecordStore);
        const ownerEntitlementOpeningBalances = transaction.objectStore(ownerEntitlementOpeningBalanceStore);
        const ownerMovements = transaction.objectStore(ownerMovementStore);
        const allocationPolicies = transaction.objectStore(allocationPolicyStore);
        const costEstimates = transaction.objectStore(costEstimateStore);
        const assets = transaction.objectStore(assetStore);
        const loans = transaction.objectStore(loanStore);
        const receivedLoans = transaction.objectStore(receivedLoanStore);
        const recurringSeries = transaction.objectStore(recurringExpenseSeriesStore);
        const recurringRevisions = transaction.objectStore(recurringExpenseRevisionStore);
        const recurringOccurrences = transaction.objectStore(recurringExpenseOccurrenceStore);
        const expenseBudgets = transaction.objectStore(expenseBudgetStore);
        profiles.clear();
        ownerProfiles.clear();
        preferences.clear();
        drafts.clear();
        orders.clear();
        directSales.clear();
        schedules.clear();
        recurrences.clear();
        financialEvents.clear();
        supplierPurchases.clear();
        cashWallets.clear();
        cashContinuityEntries.clear();
        materials.clear();
        inventoryMovements.clear();
        inventoryShortages.clear();
        inventoryActivation.clear();
        catalogItems.clear();
        measurementUnits.clear();
        directConversions.clear();
        catalogTemplates.clear();
        actualTimeRecords.clear();
        shortCashDeclarations.clear();
        ownerEntitlementPolicies.clear();
        ownerEntitlementRecords.clear();
        ownerEntitlementOpeningBalances.clear();
        ownerMovements.clear();
        allocationPolicies.clear();
        costEstimates.clear();
        assets.clear();
        loans.clear();
        receivedLoans.clear();
        recurringSeries.clear();
        recurringRevisions.clear();
        recurringOccurrences.clear();
        expenseBudgets.clear();
        if (normalized.profile) profiles.put(normalized.profile);
        if (normalized.ownerProfile) ownerProfiles.put(normalized.ownerProfile);
        if (normalized.preferences) preferences.put(normalized.preferences);
        normalized.drafts.forEach((draft) => drafts.put(draft));
        normalized.orders.forEach((order) => orders.put(order));
        normalized.directSales?.forEach((sale) => directSales.put(sale));
        normalized.schedules.forEach((schedule) => schedules.put(schedule));
        normalized.recurrences?.forEach((recurrence) => recurrences.put(recurrence));
        normalized.financialEvents.forEach((event) => financialEvents.put(event));
        normalized.supplierPurchases?.forEach((purchase) => supplierPurchases.put(purchase));
        normalized.cashWallets?.forEach((wallet) => cashWallets.put(wallet));
        normalized.cashContinuityEntries?.forEach((entry) => cashContinuityEntries.put(entry));
        normalized.materials?.forEach((material) => materials.put(material));
        normalized.inventoryMovements?.forEach((movement) => inventoryMovements.put(movement));
        normalized.inventoryShortages?.forEach((shortage) => inventoryShortages.put(shortage));
        if (normalized.inventoryActivation) inventoryActivation.put(normalized.inventoryActivation);
        normalized.catalogItems?.forEach((item) => catalogItems.put(item));
        normalized.measurementUnits?.forEach((unit) => measurementUnits.put(unit));
        normalized.directConversions?.forEach((conversion) => directConversions.put(conversion));
        normalized.catalogTemplates?.forEach((template) => catalogTemplates.put(template));
        normalized.actualTimeRecords?.forEach((record) => actualTimeRecords.put(record));
        normalized.shortCashDeclarations?.forEach((declaration) => shortCashDeclarations.put(declaration));
        normalized.ownerEntitlementPolicies?.forEach((policy) => ownerEntitlementPolicies.put(policy));
        normalized.ownerEntitlementRecords?.forEach((record) => ownerEntitlementRecords.put(record));
        normalized.ownerEntitlementOpeningBalances?.forEach(
          (balance) => ownerEntitlementOpeningBalances.put(balance)
        );
        normalized.ownerMovements?.forEach((movement) => ownerMovements.put(movement));
        normalized.allocationPolicies?.forEach((policy) => allocationPolicies.put(policy));
        normalized.costEstimates?.forEach((estimate) => costEstimates.put(estimate));
        normalized.assets?.forEach((asset) => assets.put(asset));
        normalized.loans?.forEach((loan) => loans.put(loan));
        normalized.receivedLoans?.forEach((loan) => receivedLoans.put(loan));
        normalized.recurringExpenseSeries?.forEach((series) => recurringSeries.put(series));
        normalized.recurringExpenseRevisions?.forEach((revision) => recurringRevisions.put(revision));
        normalized.recurringExpenseOccurrences?.forEach((occurrence) => recurringOccurrences.put(occurrence));
        normalized.expenseBudgets?.forEach((budget) => expenseBudgets.put(budget));
        transaction.onerror = () => resolve(failure(transaction.error, database));
        transaction.onabort = () => resolve(failure(transaction.error, database));
        transaction.oncomplete = () => {
          resolve({ ok: true, value: normalized });
        };
      } catch (error) {
        try {
          transaction.abort();
        } catch {
        }
        throw error;
      }
    });
  } catch (error) {
    return failure(error);
  }
}

// apps/prototype-web/client/src/storage/local/IndexedDbLocalStore.ts
function guardedSuccessListener(onThrow, listener) {
  return () => {
    try {
      listener();
    } catch (error) {
      onThrow(error);
    }
  };
}
var IndexedDbLocalStore = class {
  getProfile() {
    return readOne(profileStore, "local-profile");
  }
  saveProfile(profile) {
    return writeOne(profileStore, profile);
  }
  getOwnerProfile() {
    return readOne(ownerProfileStore, localOwnerProfileId);
  }
  saveOwnerProfile(profile) {
    return writeOne(ownerProfileStore, profile);
  }
  getPreferences() {
    return readOne(preferencesStore, "local-preferences");
  }
  savePreferences(preferences) {
    return writeOne(preferencesStore, preferences);
  }
  /* المجموعة ٥: مسودات النماذج وسجل القفل — عمليات سجل واحد كالتفضيلات؛
   * لا مس لهما داخل readSnapshot/replaceSnapshot فتبقى عند الاستعادة. */
  getFormDraft(id) {
    return readOne(formDraftStore, id);
  }
  saveFormDraft(draft) {
    return writeOne(formDraftStore, draft);
  }
  deleteFormDraft(id) {
    return deleteOne(formDraftStore, id);
  }
  /* المجموعة ٥ (التحصين الكامل): تعداد المسودات العابرة (الأحدث أولًا) ومسحها
   * كاملًا في معاملة واحدة ذرّية — سياسة إعادة التعيين المعلنة. */
  listFormDrafts() {
    return listAll(
      formDraftStore,
      (left, right) => right.updatedAt.localeCompare(left.updatedAt)
    );
  }
  async clearFormDrafts() {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction(formDraftStore, "readwrite");
        const request = transaction.objectStore(formDraftStore).clear();
        request.onerror = () => resolve(failure(request.error, database));
        transaction.onabort = () => resolve(failure(transaction.error, database));
        transaction.oncomplete = () => {
          resolve({ ok: true, value: null });
        };
      });
    } catch (error) {
      return failure(error);
    }
  }
  getLocalSecurity() {
    return readOne(securityStore, localSecurityId);
  }
  saveLocalSecurity(security) {
    return writeOne(securityStore, security);
  }
  deleteLocalSecurity() {
    return deleteOne(securityStore, localSecurityId);
  }
  listDrafts() {
    return listAll(draftStore, (left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }
  getDraft(id) {
    return readOne(draftStore, id);
  }
  saveDraft(draft) {
    return writeOne(draftStore, draft);
  }
  deleteDraft(id) {
    return deleteOne(draftStore, id);
  }
  listOrders() {
    return listAll(
      orderStore,
      (left, right) => right.updatedAt.localeCompare(left.updatedAt)
    );
  }
  getOrder(id) {
    return readOne(orderStore, id);
  }
  /* F-053 (W4-F): كتابة خام آخر-كاتب-يفوز — للإنشاء والبذور فقط. أي تحديث
   * لطلب قائم (حقول مالية أو أحداث) يجب أن يمر على commitOrderUpdate
   * (مفتاح الحتمية + مطابقة القاعدة داخل حد الكتابة) وإلا أسقط مسارٌ
   * متزامن أثر الآخر بصمت. الحارس الاستاتيكي saveOrderGuard.contract.test.ts
   * يمنع أي مستدعٍ جديد خارج طبقة التخزين. */
  saveOrder(order) {
    return writeOne(orderStore, order);
  }
  /* G-003 (تدقيق الإدارة المالية المتدرجة 2026-09-19): كتابة الطلب المحروسة —
   * الحارس النقي داخل معاملة الكتابة نفسها (نمط المورد/الموعد/عكس التسليم):
   * مفتاح الحتمية أولًا (إعادة التشغيل إعادة استخدام بلا كتابة)، ثم مطابقة
   * السجل الحي للقاعدة المقروءة (أي تغيّر بين القراءة والكتابة = storage_stale
   * ولا يُكتب شيء)، ثم امتداد الأحداث فوق القاعدة حرفيًا. */
  async commitOrderUpdate(base, next, idempotencyKeys) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction([orderStore], "readwrite");
        const orders = transaction.objectStore(orderStore);
        let pending = null;
        const finish = (result) => {
          resolve(result);
        };
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const storedRequest = orders.get(next.id);
        storedRequest.onerror = () => {
          pending = failure(storedRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        storedRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          const live = storedRequest.result;
          const guard = validateOrderCommit(live, base, next, idempotencyKeys);
          if (!guard.ok) {
            pending = { ok: false, code: STORAGE_STALE, message: guard.message };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (guard.reused) {
            pending = { ok: true, value: { order: live ?? next, reused: true } };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          orders.put(next);
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { order: next, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* المجموعة ٦ (S2-04أ): تراجع القبضة والتخصيص في معاملة IndexedDB واحدة —
   * الطلب وأثر الكاش معًا أو لا شيء. فحص الهوية داخل المعاملة (نمط حركة المالك):
   * حدث التراجع موجود سلفًا → مسار إعادة استخدام مع أثر الكاش المطابق أو رفض
   * الحالة النصفية؛ أثر تراجع سابق لنفس التخصيص → رفض؛ وإلا كتابة الحالتين. */
  async commitDepositRefundSettlement(order, allocationReversals, refundEventKey, eventType = "deposit_refunded") {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction([orderStore, cashContinuityEntryStore], "readwrite");
        const orders = transaction.objectStore(orderStore);
        const cashEntries = transaction.objectStore(cashContinuityEntryStore);
        let pending = null;
        const finish = (result) => {
          resolve(result);
        };
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const orderRequest = orders.get(order.id);
        orderRequest.onerror = () => {
          pending = failure(orderRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        orderRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          const existing = orderRequest.result;
          if (!existing) {
            pending = {
              ok: false,
              code: STORAGE_ERROR,
              message: "\u0644\u0645 \u0646\u062C\u062F \u0627\u0644\u0637\u0644\u0628 \u0627\u0644\u0645\u062D\u0644\u064A \u0644\u0631\u062F \u0627\u0644\u0639\u0631\u0628\u0648\u0646."
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          const alreadyRefunded = existing.order.events.some(
            (event) => event.type === eventType && event.idempotencyKey === refundEventKey
          );
          if (alreadyRefunded) {
            const cashRequest2 = cashEntries.getAll();
            cashRequest2.onerror = () => {
              pending = failure(cashRequest2.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            cashRequest2.onsuccess = guardedSuccessListener(failFromListener, () => {
              const operationKeys = new Set(allocationReversals.map((entry) => entry.operationKey));
              const matching = cashRequest2.result.filter(
                (entry) => operationKeys.has(entry.operationKey)
              );
              pending = {
                ok: true,
                value: { order: existing, cashEntries: matching, reused: true }
              };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            });
            return;
          }
          const cashRequest = cashEntries.getAll();
          cashRequest.onerror = () => {
            pending = failure(cashRequest.error, database);
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
          };
          cashRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
            const all = cashRequest.result;
            const originalById = new Map(all.map((entry) => [entry.id, entry]));
            const reversedPerEntry = /* @__PURE__ */ new Map();
            for (const entry of all) {
              if (entry.type === "reversal" && entry.reversesEntryId) {
                reversedPerEntry.set(
                  entry.reversesEntryId,
                  (reversedPerEntry.get(entry.reversesEntryId) ?? 0) - entry.cashDeltaMinor
                );
              }
            }
            let conflict = allocationReversals.some((reversal) => all.some((entry) => entry.id === reversal.id));
            if (!conflict) {
              for (const reversal of allocationReversals) {
                if (!reversal.reversesEntryId) continue;
                const original = originalById.get(reversal.reversesEntryId);
                const reversedSoFar = reversedPerEntry.get(reversal.reversesEntryId) ?? 0;
                const additional = -reversal.cashDeltaMinor;
                const cap = original ? original.cashDeltaMinor : Number.POSITIVE_INFINITY;
                if (reversedSoFar + additional > cap) {
                  conflict = true;
                  break;
                }
                reversedPerEntry.set(reversal.reversesEntryId, reversedSoFar + additional);
              }
            }
            if (conflict) {
              pending = {
                ok: false,
                code: STORAGE_ERROR,
                message: "\u0641\u0643 \u0627\u0644\u062A\u062E\u0635\u064A\u0635 \u064A\u062A\u062C\u0627\u0648\u0632 \u0645\u0628\u0644\u063A \u0627\u0644\u062A\u062E\u0635\u064A\u0635 \u0627\u0644\u0623\u0635\u0644\u064A\u061B \u0644\u0645 \u064A\u062A\u063A\u064A\u0631 \u0627\u0644\u0633\u062C\u0644."
              };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
              return;
            }
            orders.put(order);
            for (const reversal of allocationReversals) cashEntries.put(reversal);
          });
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { order, cashEntries: allocationReversals, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  async commitOrderCollectionReversal(order, allocationReversal, reversalEventKey) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction([orderStore, cashContinuityEntryStore], "readwrite");
        const orders = transaction.objectStore(orderStore);
        const cashEntries = transaction.objectStore(cashContinuityEntryStore);
        let pending = null;
        const finish = (result) => {
          resolve(result);
        };
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const orderRequest = orders.get(order.id);
        orderRequest.onerror = () => {
          pending = failure(orderRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        orderRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          const existing = orderRequest.result;
          if (!existing) {
            pending = {
              ok: false,
              code: STORAGE_ERROR,
              message: "\u0644\u0645 \u0646\u062C\u062F \u0627\u0644\u0637\u0644\u0628 \u0627\u0644\u0645\u062D\u0644\u064A \u0644\u062A\u0631\u0627\u062C\u0639 \u0627\u0644\u0642\u0628\u0636\u0629."
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          const alreadyReversed = existing.order.events.some(
            (event) => event.type === "collection_reversed" && event.idempotencyKey === reversalEventKey
          );
          if (alreadyReversed) {
            if (!allocationReversal) {
              pending = { ok: true, value: { order: existing, cashEntry: null, reused: true } };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
              return;
            }
            const cashRequest = cashEntries.getAll();
            cashRequest.onerror = () => {
              pending = failure(cashRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            cashRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
              const matching = cashRequest.result.find(
                (entry) => entry.operationKey === allocationReversal.operationKey
              );
              if (!matching) {
                pending = {
                  ok: false,
                  code: STORAGE_ERROR,
                  message: "\u0648\u062C\u062F\u062A \u062A\u0631\u0627\u062C\u0639 \u0642\u0628\u0636\u0629 \u0628\u0644\u0627 \u0623\u062B\u0631 \u062A\u062E\u0635\u064A\u0635 \u0645\u0637\u0627\u0628\u0642\u061B \u0644\u0645 \u064A\u062A\u063A\u064A\u0631 \u0627\u0644\u0633\u062C\u0644."
                };
              } else {
                pending = {
                  ok: true,
                  value: { order: existing, cashEntry: matching, reused: true }
                };
              }
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            });
            return;
          }
          if (allocationReversal) {
            const cashRequest = cashEntries.getAll();
            cashRequest.onerror = () => {
              pending = failure(cashRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            cashRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
              const conflict = cashRequest.result.some(
                (entry) => entry.reversesEntryId === allocationReversal.reversesEntryId
              );
              if (conflict) {
                pending = {
                  ok: false,
                  code: STORAGE_ERROR,
                  message: "\u062A\u0645 \u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0639\u0646 \u062A\u062E\u0635\u064A\u0635 \u0647\u0630\u0647 \u0627\u0644\u0642\u0628\u0636\u0629 \u0633\u0627\u0628\u0642\u064B\u0627\u061B \u0644\u0645 \u064A\u062A\u063A\u064A\u0631 \u0627\u0644\u0633\u062C\u0644."
                };
                try {
                  transaction.abort();
                } catch {
                  if (pending) finish(pending);
                }
                return;
              }
              orders.put(order);
              cashEntries.put(allocationReversal);
            });
            return;
          }
          orders.put(order);
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { order, cashEntry: allocationReversal, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* المجموعة ٣ (عقد D4): معاملة تسليم ذرّية — الطلب وحركات الاستهلاك وسجلات
   * النقص وتخصيص الكاش معًا أو لا شيء. مسار إعادة الاستخدام يقرأ الحالة القائمة
   * ويكمل ما نقص فقط (مفاتيح عمليات حتمية) فلا تكرار عند إعادة المحاولة. */
  async commitOrderDelivery(base, order, movements, shortages, wallet, cashEntry) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction(
          [
            orderStore,
            inventoryMovementStore,
            inventoryShortageStore,
            cashWalletStore,
            cashContinuityEntryStore
          ],
          "readwrite"
        );
        const orders = transaction.objectStore(orderStore);
        const movementStore = transaction.objectStore(inventoryMovementStore);
        const shortageStore = transaction.objectStore(inventoryShortageStore);
        const wallets = transaction.objectStore(cashWalletStore);
        const cashEntries = transaction.objectStore(cashContinuityEntryStore);
        let pending = null;
        const finish = (result) => resolve(result);
        let deliveryReused = false;
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const orderRequest = orders.get(order.id);
        orderRequest.onerror = () => {
          pending = failure(orderRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        orderRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          const existing = orderRequest.result;
          if (!existing) {
            pending = {
              ok: false,
              code: STORAGE_ERROR,
              message: "\u0644\u0645 \u0646\u062C\u062F \u0627\u0644\u0637\u0644\u0628 \u0627\u0644\u0645\u062D\u0644\u064A \u0644\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062A\u0633\u0644\u064A\u0645."
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          const lastDeliveryKey = [...order.order.events].reverse().find((event) => event.type === "status_changed" && event.toStatus === "delivered")?.idempotencyKey;
          const alreadyDelivered = lastDeliveryKey !== void 0 && existing.order.events.some(
            (event) => event.type === "status_changed" && event.toStatus === "delivered" && event.idempotencyKey === lastDeliveryKey
          );
          deliveryReused = alreadyDelivered;
          if (!alreadyDelivered && !orderRecordIdentical(existing, base)) {
            pending = {
              ok: false,
              code: STORAGE_STALE,
              message: "\u0633\u062C\u0644 \u0627\u0644\u0637\u0644\u0628 \u062A\u063A\u064A\u0651\u0631 \u0645\u0646 \u0645\u0633\u0627\u0631 \u0622\u062E\u0631 \u0628\u0639\u062F \u0641\u062A\u062D\u0643 \u0644\u0647 \u2014 \u0644\u0645 \u064A\u064F\u0633\u062C\u064E\u0651\u0644 \u0634\u064A\u0621\u061B \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629."
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          const movementRequest = movementStore.getAll();
          movementRequest.onerror = () => {
            pending = failure(movementRequest.error, database);
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
          };
          movementRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
            const storedMovements = movementRequest.result;
            const storedKeys = new Set(storedMovements.map((movement) => movement.operationKey));
            const movementsToWrite = movements.filter((movement) => !storedKeys.has(movement.operationKey));
            const shortageRequest = shortageStore.getAll();
            shortageRequest.onerror = () => {
              pending = failure(shortageRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            shortageRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
              const storedShortages = shortageRequest.result;
              const shortageKeys = new Set(storedShortages.map((shortage) => shortage.operationKey));
              const shortagesToWrite = shortages.filter((shortage) => !shortageKeys.has(shortage.operationKey));
              const writeAll = () => {
                if (!alreadyDelivered) orders.put(order);
                movementsToWrite.forEach((movement) => movementStore.put(movement));
                shortagesToWrite.forEach((shortage) => shortageStore.put(shortage));
                if (cashEntry) {
                  const cashRequest = cashEntries.getAll();
                  cashRequest.onerror = () => {
                    pending = failure(cashRequest.error, database);
                    try {
                      transaction.abort();
                    } catch {
                      if (pending) finish(pending);
                    }
                  };
                  cashRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
                    const cashKeys = new Set(
                      cashRequest.result.map((entry) => entry.operationKey)
                    );
                    if (!cashKeys.has(cashEntry.operationKey)) {
                      cashEntries.put(cashEntry);
                      if (wallet) wallets.put(wallet);
                    }
                  });
                } else if (wallet) {
                  wallets.put(wallet);
                }
              };
              writeAll();
            });
          });
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({
          ok: true,
          value: { order, movements, shortages, cashEntry, reused: deliveryReused }
        });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* المجموعة ٣ (عقد D4) + رقعة إغلاق المجموعة ٣ (D-031، مراجعة مستقلة):
   * عكس التسليم ذرّيًا داخل معاملة واحدة — لا كتابة عمياء فوق السجل الحي.
   * الحارس يقرأ الطلب والحركات الحية داخل المعاملة نفسها (تسلسل معاملات
   * IndexedDB يمنع أي تداخل بين القراءة والكتابة): إعادة التشغيل بالمفتاح
   * نفسه تُعاد كما هي، وعلاقة التصحيح نفسها (نفس حدث التسليم) بمفتاح آخر
   * إعادة استخدام صادقة بلا كتابة، وأي تغيّر متزامن يُرفض بـ storage_stale
   * ولا يُكتب شيء — الطلب وحركاته يُكتبان معًا أو لا يُكتبان. حركات المرآة
   * تُتحقق ضد الاستهلاك الحي قبل أي put. التحقق كله متزامن داخل استدعاءات
   * الطلب فلا يفلت استثناء ولا يُختم نجاحًا كاذبًا. */
  async commitOrderDeliveryReversal(order, reversalMovements) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction([orderStore, inventoryMovementStore], "readwrite");
        const orders = transaction.objectStore(orderStore);
        const movementStore = transaction.objectStore(inventoryMovementStore);
        let committedMovements = reversalMovements;
        let pending = null;
        const finish = (result) => resolve(result);
        const abortWith = (result) => {
          pending = result;
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const failFromListener = (error) => abortWith(failure(error, database));
        const orderRequest = orders.get(order.id);
        orderRequest.onerror = () => {
          pending = failure(orderRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        orderRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          const existing = orderRequest.result;
          if (!existing) {
            abortWith({ ok: false, code: STORAGE_ERROR, message: "\u0644\u0645 \u0646\u062C\u062F \u0627\u0644\u0637\u0644\u0628 \u0627\u0644\u0645\u062D\u0644\u064A \u0644\u0639\u0643\u0633 \u062A\u0633\u0644\u064A\u0645\u0647." });
            return;
          }
          const guard = validateDeliveryReversalCommit(existing, order);
          if (!guard.ok) {
            abortWith({ ok: false, code: STORAGE_STALE, message: guard.message });
            return;
          }
          const movementRequest = movementStore.getAll();
          movementRequest.onerror = () => {
            pending = failure(movementRequest.error, database);
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
          };
          movementRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
            const storedMovements = movementRequest.result;
            if (guard.reused) {
              const matching = storedReversalMovementsFor(reversalMovements, storedMovements);
              abortWith({ ok: true, value: { order: existing, reversalMovements: matching, reused: true } });
              return;
            }
            const movementGuard = validateDeliveryReversalMovements(
              order.id,
              guard.deliveryEventId,
              reversalMovements,
              storedMovements
            );
            if (!movementGuard.ok) {
              abortWith({ ok: false, code: STORAGE_STALE, message: movementGuard.message });
              return;
            }
            orders.put(order);
            const storedKeys = new Set(storedMovements.map((movement) => movement.operationKey));
            reversalMovements.filter((movement) => !storedKeys.has(movement.operationKey)).forEach((movement) => movementStore.put(movement));
            committedMovements = committedReversalMovements(reversalMovements, storedMovements);
          });
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { order, reversalMovements: committedMovements, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  listDirectSales() {
    return listAll(
      directSaleStore,
      (left, right) => right.occurredOn.localeCompare(left.occurredOn) || right.recordedAt.localeCompare(left.recordedAt)
    );
  }
  /* P0 (إرسال متزامن): مفتاح الحتمية يُفحص داخل المعاملة — بيع بنفس المفتاح
   * محفوظ سلفًا يُعاد كما هو فلا يتكرر السجل ولا يتضاعف الكاش. */
  saveDirectSale(sale) {
    return writeOneIdempotent(
      directSaleStore,
      sale,
      (existing) => existing.id !== sale.id && existing.idempotencyKey === sale.idempotencyKey
    );
  }
  /* EXE-010 (AUD-NEW-04): عكس تحصيل البيع وتخصيص محفظته في معاملة IndexedDB
   * واحدة — البيع وقيد العكس معًا أو لا شيء. فحص الهوية داخل المعاملة بنمط
   * تراجع القبضة: مراجعة العكس موجودة سلفًا → إعادة استخدام مع أثر الكاش
   * المطابق أو رفض الحالة النصفية؛ أثر عكس سابق لنفس التخصيص → رفض. */
  async commitDirectSaleCollectionReversal(sale, allocationReversal, revisionKey) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction([directSaleStore, cashContinuityEntryStore], "readwrite");
        const sales = transaction.objectStore(directSaleStore);
        const cashEntries = transaction.objectStore(cashContinuityEntryStore);
        let pending = null;
        const finish = (result) => {
          resolve(result);
        };
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const saleRequest = sales.get(sale.id);
        saleRequest.onerror = () => {
          pending = failure(saleRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        saleRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          const existing = saleRequest.result;
          if (!existing) {
            pending = {
              ok: false,
              code: STORAGE_ERROR,
              message: "\u0644\u0645 \u0646\u062C\u062F \u0627\u0644\u0628\u064A\u0639 \u0627\u0644\u0645\u0628\u0627\u0634\u0631 \u0627\u0644\u0645\u062D\u0644\u064A \u0644\u0639\u0643\u0633 \u0627\u0644\u062A\u062D\u0635\u064A\u0644."
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          const alreadyReversed = (existing.revisions ?? []).some(
            (revision) => revision.idempotencyKey === revisionKey
          );
          if (alreadyReversed) {
            if (!allocationReversal) {
              pending = { ok: true, value: { sale: existing, cashEntry: null, reused: true } };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
              return;
            }
            const cashRequest = cashEntries.getAll();
            cashRequest.onerror = () => {
              pending = failure(cashRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            cashRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
              const matching = cashRequest.result.find(
                (entry) => entry.operationKey === allocationReversal.operationKey
              );
              if (!matching) {
                pending = {
                  ok: false,
                  code: STORAGE_ERROR,
                  message: "\u0648\u062C\u062F\u062A \u0639\u0643\u0633 \u062A\u062D\u0635\u064A\u0644 \u0628\u0644\u0627 \u0623\u062B\u0631 \u0643\u0627\u0634 \u0645\u0637\u0627\u0628\u0642\u061B \u0644\u0645 \u064A\u062A\u063A\u064A\u0631 \u0627\u0644\u0633\u062C\u0644."
                };
              } else {
                pending = { ok: true, value: { sale: existing, cashEntry: matching, reused: true } };
              }
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            });
            return;
          }
          const cashScan = cashEntries.getAll();
          cashScan.onerror = () => {
            pending = failure(cashScan.error, database);
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
          };
          cashScan.onsuccess = guardedSuccessListener(failFromListener, () => {
            const allCash = cashScan.result;
            if (allocationReversal) {
              if (allCash.some((entry) => entry.id === allocationReversal.id)) {
                pending = {
                  ok: false,
                  code: STORAGE_ERROR,
                  message: "\u0623\u062B\u0631 \u0639\u0643\u0633 \u062A\u062E\u0635\u064A\u0635 \u0645\u0643\u0631\u0631 \u2014 \u0644\u0645 \u064A\u062A\u063A\u064A\u0631 \u0627\u0644\u0633\u062C\u0644."
                };
                try {
                  transaction.abort();
                } catch {
                  if (pending) finish(pending);
                }
                return;
              }
              const original = allCash.find((entry) => entry.id === allocationReversal.reversesEntryId);
              const reversedSoFar = allCash.filter(
                (entry) => entry.type === "reversal" && entry.reversesEntryId === allocationReversal.reversesEntryId
              ).reduce((sum, entry) => sum - entry.cashDeltaMinor, 0);
              const additional = -allocationReversal.cashDeltaMinor;
              if (original && reversedSoFar + additional > original.cashDeltaMinor) {
                pending = {
                  ok: false,
                  code: STORAGE_ERROR,
                  message: "\u0639\u0643\u0633 \u0627\u0644\u062A\u062E\u0635\u064A\u0635 \u064A\u062A\u062C\u0627\u0648\u0632 \u0645\u0628\u0644\u063A \u0627\u0644\u062A\u062E\u0635\u064A\u0635 \u0627\u0644\u0623\u0635\u0644\u064A\u061B \u0644\u0645 \u064A\u062A\u063A\u064A\u0631 \u0627\u0644\u0633\u062C\u0644."
                };
                try {
                  transaction.abort();
                } catch {
                  if (pending) finish(pending);
                }
                return;
              }
              cashEntries.put(allocationReversal);
            }
            sales.put(sale);
          });
        });
        transaction.onerror = () => resolve(pending ?? failure(transaction.error, database));
        transaction.onabort = () => resolve(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => {
          resolve({ ok: true, value: { sale, cashEntry: allocationReversal, reused: false } });
        };
      });
    } catch (error) {
      return failure(error);
    }
  }
  listSchedules() {
    return listAll(
      scheduleStore,
      (left, right) => left.scheduledFor.localeCompare(right.scheduledFor) || right.updatedAt.localeCompare(left.updatedAt)
    );
  }
  getSchedule(id) {
    return readOne(scheduleStore, id);
  }
  saveSchedule(schedule) {
    return writeOne(scheduleStore, schedule);
  }
  /* المجموعة ٢ (التحصين الكامل — HIGH-001): إنشاء موعد داخل معاملة واحدة —
   * القراءة والكتابة معًا فلا يُنشأ فوق موعد موجود (المحتوى الحتمي يتقارب)،
   * وإعادة التشغيل تعيد المخزّن كما هو. */
  async commitScheduleCreate(schedule) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction([scheduleStore], "readwrite");
        const schedules = transaction.objectStore(scheduleStore);
        let pending = null;
        const finish = (result) => {
          resolve(result);
        };
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const storedRequest = schedules.get(schedule.id);
        storedRequest.onerror = () => {
          pending = failure(storedRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        storedRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          const stored = storedRequest.result;
          const guard = validateScheduleCreate(stored);
          if (!guard.ok) {
            pending = { ok: false, code: STORAGE_STALE, message: guard.message };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (guard.reused) {
            pending = { ok: true, value: { schedule: stored, reused: true } };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          schedules.put(schedule);
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { schedule, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* المجموعة ٢ (التحصين الكامل — HIGH-001): تحديث موعد داخل معاملة واحدة —
   * العلاقة تُفحص على الحالة الحية داخل المعاملة (حدث واحد جديد بالضبط
   * والأحداث السابقة حرفية وحقول «قبل» مطابقة)؛ التعارض storage_stale بلا
   * كتابة، وإعادة التشغيل بالمفتاح نفسه تعيد المخزّن. */
  async commitScheduleUpdate(schedule) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction([scheduleStore], "readwrite");
        const schedules = transaction.objectStore(scheduleStore);
        let pending = null;
        const finish = (result) => {
          resolve(result);
        };
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const storedRequest = schedules.get(schedule.id);
        storedRequest.onerror = () => {
          pending = failure(storedRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        storedRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          const stored = storedRequest.result;
          const guard = validateScheduleUpdate(stored, schedule);
          if (!guard.ok) {
            pending = { ok: false, code: STORAGE_STALE, message: guard.message };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (guard.reused) {
            pending = { ok: true, value: { schedule: stored, reused: true } };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          schedules.put(schedule);
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { schedule, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  listRecurrences() {
    return listAll(
      recurrenceStore,
      (left, right) => left.createdAt.localeCompare(right.createdAt)
    );
  }
  getRecurrence(id) {
    return readOne(recurrenceStore, id);
  }
  saveRecurrence(recurrence) {
    return writeOne(recurrenceStore, recurrence);
  }
  /* المجموعة ٢ (التحصين الكامل — HIGH-001): التزامن الذرّي لقالب التكرار
   * ومواعيده — الحارس يقرأ الحالة الحية داخل المعاملة نفسها: إنشاء القالب
   * كتابة أولى فقط (إعادة تشغيل تُعاد كما هي)، والإيقاف يمر بقالب نشط ويضيف
   * لكل موعد متأثر حدث «إلغاء» واحدًا بالضبط بمفتاح حتمي. أي تعارض مع مسار
   * متزامن (موعد تأجل أو أُكمل بعد قراءة الخدمة) يُرفض بـ storage_stale
   * ولا يُكتب شيء — لا إعادة كتابة الجدول كاملًا فوق كتابات الآخرين. */
  async commitRecurrence(recurrence, schedules) {
    const result = {
      recurrence,
      schedules: []
    };
    try {
      const database = await connection();
      const settled = await new Promise((resolve) => {
        const transaction = database.transaction([recurrenceStore, scheduleStore], "readwrite");
        const recurrences = transaction.objectStore(recurrenceStore);
        const scheduleObjects = transaction.objectStore(scheduleStore);
        let pending = null;
        const finish = (value) => resolve(value);
        const abortWith = (value) => {
          pending = value;
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const writeSchedule = (schedule) => {
          const newEventKey = schedule.events[schedule.events.length - 1]?.idempotencyKey ?? "";
          const storedRequest = scheduleObjects.get(schedule.id);
          storedRequest.onerror = () => {
            if (!pending) pending = failure(storedRequest.error, database);
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
          };
          storedRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
            const stored = storedRequest.result;
            if (stored === void 0) {
              scheduleObjects.put(schedule);
              result.schedules = [...result.schedules, schedule];
              return;
            }
            if (stored.events.some((event) => event.idempotencyKey === newEventKey)) {
              result.schedules = [...result.schedules, stored];
              return;
            }
            const guard = validateScheduleUpdate(stored, schedule);
            if (!guard.ok) {
              abortWith({ ok: false, code: STORAGE_STALE, message: guard.message });
              return;
            }
            if (guard.reused) {
              result.schedules = [...result.schedules, stored];
              return;
            }
            scheduleObjects.put(schedule);
            result.schedules = [...result.schedules, schedule];
          });
        };
        const failFromListener = (error) => abortWith(failure(error, database));
        const storedRecurrenceRequest = recurrences.get(recurrence.id);
        storedRecurrenceRequest.onerror = () => {
          pending = failure(storedRecurrenceRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        storedRecurrenceRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          const storedRecurrence = storedRecurrenceRequest.result;
          if (storedRecurrence === void 0) {
            if (recurrence.status !== "active") {
              abortWith({ ok: false, code: STORAGE_STALE, message: RECURRENCE_STALE_MESSAGE });
              return;
            }
            recurrences.put(recurrence);
            result.recurrence = recurrence;
            schedules.forEach(writeSchedule);
            return;
          }
          if (storedRecurrence.idempotencyKey !== recurrence.idempotencyKey) {
            abortWith({ ok: false, code: STORAGE_STALE, message: RECURRENCE_STALE_MESSAGE });
            return;
          }
          if (storedRecurrence.status === recurrence.status) {
            result.recurrence = storedRecurrence;
            schedules.forEach(writeSchedule);
            return;
          }
          if (storedRecurrence.status !== "active" || recurrence.status !== "cancelled") {
            abortWith({ ok: false, code: STORAGE_STALE, message: RECURRENCE_STALE_MESSAGE });
            return;
          }
          recurrences.put(recurrence);
          result.recurrence = recurrence;
          schedules.forEach(writeSchedule);
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => {
          if (pending) {
            resolve(pending);
            return;
          }
          resolve(failure(transaction.error, database));
        };
        transaction.oncomplete = () => resolve({ ok: true, value: null });
      });
      if (!settled.ok) return { ok: false, code: settled.code, message: settled.message };
      return { ok: true, value: result };
    } catch (error) {
      return failure(error);
    }
  }
  listFinancialEvents() {
    return listAll(
      financialEventStore,
      (left, right) => right.recordedAt.localeCompare(left.recordedAt)
    );
  }
  getFinancialEvent(id) {
    return readOne(financialEventStore, id);
  }
  /* P0 (إرسال متزامن): حدث مالي بنفس مفتاح الحتمية محفوظ سلفًا يُعاد كما هو —
   * المفاتيح المتضاربة مرفوضة أصلًا في الخدمة، فلا مسار شرعي لتكرار المفتاح. */
  saveFinancialEvent(event) {
    return writeOneIdempotent(
      financialEventStore,
      event,
      (existing) => existing.id !== event.id && existing.idempotencyKey === event.idempotencyKey
    );
  }
  async commitFinancialEventCorrection(sourceEventId, reversal) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction(financialEventStore, "readwrite");
        const store = transaction.objectStore(financialEventStore);
        let settled = false;
        let pendingAbortResult = null;
        const finish = (result) => {
          if (settled) return;
          settled = true;
          resolve(result);
        };
        const abortWith = (result) => {
          pendingAbortResult = result;
          try {
            transaction.abort();
          } catch {
            finish(result);
          }
        };
        const failFromListener = (error) => abortWith(failure(error, database));
        const request = store.getAll();
        request.onerror = () => abortWith(failure(request.error, database));
        request.onsuccess = guardedSuccessListener(failFromListener, () => {
          const events = request.result;
          const source = events.find((event) => event.id === sourceEventId);
          if (!source) {
            abortWith({
              ok: false,
              code: STORAGE_ERROR,
              message: "\u0644\u0645 \u064A\u0639\u062F \u0627\u0644\u062D\u062F\u062B \u0627\u0644\u0645\u0635\u062F\u0631 \u0645\u0648\u062C\u0648\u062F\u064B\u0627\u061B \u0644\u0645 \u064A\u064F\u062D\u0641\u0638 \u0627\u0644\u062A\u0631\u0627\u062C\u0639."
            });
            return;
          }
          if (source.correctionType === "reverse" || source.correctionOfEventId) {
            abortWith({ ok: false, code: STORAGE_ERROR, message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0639\u0646 \u062D\u062F\u062B \u062A\u0631\u0627\u062C\u0639 \u0633\u0627\u0628\u0642." });
            return;
          }
          const existing = events.find(
            (event) => event.correctionOfEventId === sourceEventId && event.correctionType === "reverse"
          );
          if (existing) {
            abortWith(
              existing.idempotencyKey === reversal.idempotencyKey ? { ok: true, value: existing } : {
                ok: false,
                code: STORAGE_ERROR,
                message: "\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0644\u0623\u0646 \u0647\u0630\u0627 \u0627\u0644\u062D\u062F\u062B \u062A\u0645 \u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0639\u0646\u0647 \u0633\u0627\u0628\u0642\u064B\u0627 \u0628\u0645\u0641\u062A\u0627\u062D \u0645\u062E\u062A\u0644\u0641."
              }
            );
            return;
          }
          if (events.some((event) => event.id === reversal.id)) {
            abortWith({
              ok: false,
              code: STORAGE_ERROR,
              message: "\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0628\u0633\u0628\u0628 \u062A\u0639\u0627\u0631\u0636 \u0647\u0648\u064A\u0629 \u0645\u062D\u0644\u064A\u0629."
            });
            return;
          }
          if (reversal.correctionType !== "reverse" || reversal.correctionOfEventId !== source.id || reversal.type !== source.type || reversal.amountMinor !== source.amountMinor || reversal.relatedEventId !== source.relatedEventId || reversal.cashDeltaMinor !== -source.cashDeltaMinor || reversal.payableDeltaMinor !== -source.payableDeltaMinor || reversal.ownerCapitalDeltaMinor !== -source.ownerCapitalDeltaMinor || reversal.operatingExpenseDeltaMinor !== -source.operatingExpenseDeltaMinor) {
            abortWith({
              ok: false,
              code: STORAGE_ERROR,
              message: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0644\u0627 \u062A\u0637\u0627\u0628\u0642 \u0627\u0644\u062D\u062F\u062B \u0627\u0644\u0623\u0635\u0644\u064A\u061B \u0644\u0645 \u064A\u062A\u063A\u064A\u0631 \u0627\u0644\u0633\u062C\u0644."
            });
            return;
          }
          store.put(reversal);
        });
        transaction.onerror = () => {
          if (!pendingAbortResult) pendingAbortResult = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pendingAbortResult ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: reversal });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /** تعديل موثق ذرّي: التراجع والبديل في معاملة IndexedDB واحدة — لا حالة بينية أبدًا. */
  async commitFinancialEventReplacement(sourceEventId, reversal, replacement) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction(financialEventStore, "readwrite");
        const store = transaction.objectStore(financialEventStore);
        let settled = false;
        let pendingAbortResult = null;
        const finish = (result) => {
          if (settled) return;
          settled = true;
          resolve(result);
        };
        const abortWith = (result) => {
          pendingAbortResult = result;
          try {
            transaction.abort();
          } catch {
            finish(result);
          }
        };
        const failFromListener = (error) => abortWith(failure(error, database));
        const request = store.getAll();
        request.onerror = () => abortWith(failure(request.error, database));
        request.onsuccess = guardedSuccessListener(failFromListener, () => {
          const events = request.result;
          const source = events.find((event) => event.id === sourceEventId);
          if (!source) {
            abortWith({
              ok: false,
              code: STORAGE_ERROR,
              message: "\u0644\u0645 \u064A\u0639\u062F \u0627\u0644\u062D\u062F\u062B \u0627\u0644\u0623\u0635\u0644\u064A \u0645\u0648\u062C\u0648\u062F\u064B\u0627\u061B \u0644\u0645 \u064A\u062A\u063A\u064A\u0631 \u0627\u0644\u0633\u062C\u0644."
            });
            return;
          }
          if (source.correctionType === "reverse" || source.correctionOfEventId) {
            abortWith({ ok: false, code: STORAGE_ERROR, message: "\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0639\u0646 \u062D\u062F\u062B \u062A\u0631\u0627\u062C\u0639 \u0633\u0627\u0628\u0642." });
            return;
          }
          const existing = events.find(
            (event) => event.correctionOfEventId === sourceEventId && event.correctionType === "reverse"
          );
          if (existing) {
            abortWith(
              existing.idempotencyKey === reversal.idempotencyKey ? { ok: true, value: { reversal: existing, replacement } } : {
                ok: false,
                code: STORAGE_ERROR,
                message: "\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0627\u0644\u062A\u0639\u062F\u064A\u0644 \u0644\u0623\u0646 \u0647\u0630\u0627 \u0627\u0644\u062D\u062F\u062B \u0639\u064F\u062F\u0651\u0644 \u0633\u0627\u0628\u0642\u064B\u0627 \u0628\u0645\u0641\u062A\u0627\u062D \u0645\u062E\u062A\u0644\u0641."
              }
            );
            return;
          }
          if (events.some((event) => event.id === reversal.id || event.id === replacement.id)) {
            abortWith({
              ok: false,
              code: STORAGE_ERROR,
              message: "\u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0627\u0644\u062A\u0639\u062F\u064A\u0644 \u0628\u0633\u0628\u0628 \u062A\u0639\u0627\u0631\u0636 \u0647\u0648\u064A\u0629 \u0645\u062D\u0644\u064A\u0629."
            });
            return;
          }
          if (reversal.correctionType !== "reverse" || reversal.correctionOfEventId !== source.id || reversal.type !== source.type || reversal.amountMinor !== source.amountMinor || reversal.cashDeltaMinor !== -source.cashDeltaMinor || reversal.payableDeltaMinor !== -source.payableDeltaMinor || reversal.ownerCapitalDeltaMinor !== -source.ownerCapitalDeltaMinor || reversal.operatingExpenseDeltaMinor !== -source.operatingExpenseDeltaMinor) {
            abortWith({
              ok: false,
              code: STORAGE_ERROR,
              message: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0644\u0627 \u062A\u0637\u0627\u0628\u0642 \u0627\u0644\u062D\u062F\u062B \u0627\u0644\u0623\u0635\u0644\u064A\u061B \u0644\u0645 \u064A\u062A\u063A\u064A\u0631 \u0627\u0644\u0633\u062C\u0644."
            });
            return;
          }
          store.put(reversal);
          store.put(replacement);
        });
        transaction.onerror = () => {
          if (!pendingAbortResult)
            pendingAbortResult = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pendingAbortResult ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { reversal, replacement } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  listSupplierPurchases() {
    return listAll(
      supplierPurchaseStore,
      (left, right) => right.purchasedOn.localeCompare(left.purchasedOn) || right.updatedAt.localeCompare(left.updatedAt)
    );
  }
  getSupplierPurchase(id) {
    return readOne(supplierPurchaseStore, id);
  }
  saveSupplierPurchase(purchase) {
    return writeOne(supplierPurchaseStore, purchase);
  }
  /* المجموعة ٢ (التحصين الكامل — HIGH-001): كتابة ذرّية مُحروسة لسجل الشراء —
   * فحص مفتاح الحتمية داخل المعاملة ثم علاقة «عملية مجال واحدة بالضبط» بين
   * المخزّن والوارد؛ التعارض يُرفض بـ storage_stale ولا يُكتب شيء، وإعادة
   * التشغيل بنفس المفتاح تعيد السجل الحالي كما هو. الإنشاء يفحص المفتاح على
   * مستوى المتجر كله (مفتاح الشراء فريد عالميًا في مسار الكتابة). */
  async commitSupplierPurchase(commit) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction([supplierPurchaseStore], "readwrite");
        const purchases = transaction.objectStore(supplierPurchaseStore);
        let pending = null;
        const finish = (result) => {
          resolve(result);
        };
        const settleGuard = (stored) => {
          const guard = validateSupplierPurchaseCommit(stored, commit);
          if (!guard.ok) {
            pending = { ok: false, code: STORAGE_STALE, message: guard.message };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (guard.reused) {
            pending = { ok: true, value: { purchase: stored ?? commit.purchase, reused: true } };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          purchases.put(commit.purchase);
        };
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const storedRequest = purchases.get(commit.purchase.id);
        storedRequest.onerror = () => {
          pending = failure(storedRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        storedRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          const stored = storedRequest.result;
          if (commit.kind !== "create") {
            settleGuard(stored);
            return;
          }
          const scanRequest = purchases.getAll();
          scanRequest.onerror = () => {
            pending = failure(scanRequest.error, database);
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
          };
          scanRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
            const replay = scanRequest.result.find(
              (candidate) => candidate.idempotencyKey === commit.idempotencyKey && candidate.id !== commit.purchase.id
            );
            if (replay) {
              pending = { ok: true, value: { purchase: replay, reused: true } };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
              return;
            }
            settleGuard(stored);
          });
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { purchase: commit.purchase, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* G-002 (تدقيق الإدارة المالية المتدرجة 2026-09-19): دفعة المورد وتخصيص
   * محفظتها في معاملة IndexedDB واحدة — الشراء/الدفعة بفحص علاقة المورد
   * نفسه، وقيد التخصيص يُحل داخل المعاملة من الحقيقة المقروءة فيها: القيد
   * الموجود بمفتاحه اكتمال، والناقص يُشتق من الدفعة المخزّنة ويُكتب في
   * المعاملة نفسها (شفاء حتمي)، أو لا يُكتب شيء مع رفض التعارض. */
  async commitSupplierPurchaseWithAttribution(commit, attribution) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction(
          [supplierPurchaseStore, cashContinuityEntryStore],
          "readwrite"
        );
        const purchases = transaction.objectStore(supplierPurchaseStore);
        const entriesStore = transaction.objectStore(cashContinuityEntryStore);
        let pending = null;
        const finish = (result) => resolve(result);
        const abortWith = (result) => {
          pending = result;
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const settle = (stored, replay) => {
          let reference;
          let reused;
          if (replay) {
            reference = replay;
            reused = true;
          } else {
            const guard = validateSupplierPurchaseCommit(stored, commit);
            if (!guard.ok) {
              abortWith({ ok: false, code: STORAGE_STALE, message: guard.message });
              return;
            }
            reused = guard.reused;
            reference = guard.reused ? stored ?? commit.purchase : commit.purchase;
          }
          let resolved = null;
          const entriesRequest = entriesStore.getAll();
          entriesRequest.onerror = () => {
            pending = failure(entriesRequest.error, database);
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
          };
          entriesRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
            resolved = resolveSupplierPaymentAttribution({
              kind: commit.kind,
              idempotencyKey: commit.idempotencyKey,
              attribution,
              purchase: reference,
              storedEntries: entriesRequest.result
            });
            if (resolved.action === "write") entriesStore.put(resolved.entry);
            if (!reused) purchases.put(commit.purchase);
          });
          transaction.oncomplete = () => {
            const resolution = resolved ?? { action: "skip" };
            finish({
              ok: true,
              value: {
                purchase: reused ? reference : commit.purchase,
                attributionEntry: resolution.action === "skip" ? null : resolution.entry,
                reused
              }
            });
          };
        };
        const failFromListener = (error) => abortWith(failure(error, database));
        const storedRequest = purchases.get(commit.purchase.id);
        storedRequest.onerror = () => {
          pending = failure(storedRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        storedRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          const stored = storedRequest.result;
          if (commit.kind !== "create") {
            settle(stored, void 0);
            return;
          }
          const scanRequest = purchases.getAll();
          scanRequest.onerror = () => {
            pending = failure(scanRequest.error, database);
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
          };
          scanRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
            const replay = scanRequest.result.find(
              (candidate) => candidate.idempotencyKey === commit.idempotencyKey && candidate.id !== commit.purchase.id
            );
            settle(stored, replay);
          });
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
      });
    } catch (error) {
      return failure(error);
    }
  }
  listCashWallets() {
    return listAll(
      cashWalletStore,
      (left, right) => left.createdAt.localeCompare(right.createdAt)
    );
  }
  listCashContinuityEntries() {
    return listAll(
      cashContinuityEntryStore,
      (left, right) => left.occurredOn.localeCompare(right.occurredOn) || left.recordedAt.localeCompare(right.recordedAt)
    );
  }
  async commitCashContinuity(wallet, entries) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction([cashWalletStore, cashContinuityEntryStore], "readwrite");
        const entriesStore = transaction.objectStore(cashContinuityEntryStore);
        let rejection = null;
        const failFromListener = (error) => {
          rejection = failure(error, database);
          try {
            transaction.abort();
          } catch {
            resolve(rejection);
          }
        };
        const scanRequest = entriesStore.getAll();
        scanRequest.onerror = () => resolve(failure(scanRequest.error, database));
        scanRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          const existingKeys = new Set(
            scanRequest.result.map((entry) => entry.operationKey)
          );
          const newEntries = entries.filter((entry) => !existingKeys.has(entry.operationKey));
          const secondOpening = findSecondWalletOpening(
            scanRequest.result,
            newEntries
          );
          if (secondOpening) {
            rejection = { ok: false, code: STORAGE_STALE, message: SECOND_WALLET_OPENING_MESSAGE };
            try {
              transaction.abort();
            } catch {
              resolve(rejection);
            }
            return;
          }
          newEntries.forEach((entry) => entriesStore.put(entry));
          if (wallet && (newEntries.length > 0 || entries.length === 0)) {
            transaction.objectStore(cashWalletStore).put(wallet);
          }
        });
        transaction.onerror = () => resolve(failure(transaction.error, database));
        transaction.onabort = () => resolve(rejection ?? failure(transaction.error, database));
        transaction.oncomplete = () => {
          resolve({ ok: true, value: { wallet, entries } });
        };
      });
    } catch (error) {
      return failure(error);
    }
  }
  listMaterials() {
    return listAll(materialStore, (left, right) => left.createdAt.localeCompare(right.createdAt));
  }
  getInventoryActivation() {
    return readOne(inventoryActivationStore, localInventoryActivationId);
  }
  saveInventoryActivation(activation) {
    return writeOne(inventoryActivationStore, activation);
  }
  listInventoryMovements() {
    return listAll(
      inventoryMovementStore,
      (left, right) => right.occurredOn.localeCompare(left.occurredOn) || right.recordedAt.localeCompare(left.recordedAt)
    );
  }
  async commitInventory(material, movements) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction([materialStore, inventoryMovementStore], "readwrite");
        if (material) transaction.objectStore(materialStore).put(material);
        movements.forEach((movement) => transaction.objectStore(inventoryMovementStore).put(movement));
        transaction.onerror = () => resolve(failure(transaction.error, database));
        transaction.onabort = () => resolve(failure(transaction.error, database));
        transaction.oncomplete = () => {
          resolve({ ok: true, value: { material, movements } });
        };
      });
    } catch (error) {
      return failure(error);
    }
  }
  listInventoryShortages() {
    return listAll(
      inventoryShortageStore,
      (left, right) => right.occurredOn.localeCompare(left.occurredOn) || right.recordedAt.localeCompare(left.recordedAt)
    );
  }
  /* المجموعة ٢ (عقد ٢٨ / D-027): معاملة ذرّية واحدة على المتاجر الثلاثة —
   * المادة وحركاتها وسجل النقص معًا أو لا شيء. */
  async commitInventoryWithShortage(material, movements, shortage) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction(
          [materialStore, inventoryMovementStore, inventoryShortageStore],
          "readwrite"
        );
        if (material) transaction.objectStore(materialStore).put(material);
        movements.forEach((movement) => transaction.objectStore(inventoryMovementStore).put(movement));
        if (shortage) transaction.objectStore(inventoryShortageStore).put(shortage);
        transaction.onerror = () => resolve(failure(transaction.error, database));
        transaction.onabort = () => resolve(failure(transaction.error, database));
        transaction.oncomplete = () => {
          resolve({ ok: true, value: { material, movements, shortage } });
        };
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* عقد الإغلاق العميق (العقد ١ — الهدر): حركة مخزون وحدث مالي في معاملة
   * واحدة ذرّية — الحركة وحدث خسارة الهدر غير النقدية معًا أو لا شيء،
   * والتراجع يعكس الاثنين معًا. الحتمية داخل المعاملة بمفتاحي العملية،
   * والمخزّن سلفًا يُعاد كما هو (reused). */
  async commitInventoryWithEvents(material, movements, events) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction(
          [materialStore, inventoryMovementStore, financialEventStore],
          "readwrite"
        );
        const movementStore = transaction.objectStore(inventoryMovementStore);
        const eventStore = transaction.objectStore(financialEventStore);
        let reused = false;
        let resultMovements = movements;
        let resultEvents = events;
        const failFromListener = (error) => {
          resolve(failure(error, database));
          try {
            transaction.abort();
          } catch {
          }
        };
        const movementScan = movementStore.getAll();
        movementScan.onerror = () => resolve(failure(movementScan.error, database));
        movementScan.onsuccess = guardedSuccessListener(failFromListener, () => {
          const storedMovements = movementScan.result;
          const movementByKey = new Map(
            storedMovements.map((movement) => [movement.operationKey, movement])
          );
          resultMovements = movements.map((movement) => movementByKey.get(movement.operationKey) ?? movement);
          const newMovements = movements.filter((movement) => !movementByKey.has(movement.operationKey));
          const eventScan = eventStore.getAll();
          eventScan.onerror = () => resolve(failure(eventScan.error, database));
          eventScan.onsuccess = guardedSuccessListener(failFromListener, () => {
            const storedEvents = eventScan.result;
            const eventByKey = new Map(storedEvents.map((event) => [event.idempotencyKey, event]));
            resultEvents = events.map((event) => eventByKey.get(event.idempotencyKey) ?? event);
            const newEvents = events.filter((event) => !eventByKey.has(event.idempotencyKey));
            reused = newMovements.length < movements.length || newEvents.length < events.length;
            if (material) transaction.objectStore(materialStore).put(material);
            newMovements.forEach((movement) => movementStore.put(movement));
            newEvents.forEach((event) => eventStore.put(event));
          });
        });
        transaction.onerror = () => resolve(failure(transaction.error, database));
        transaction.onabort = () => resolve(failure(transaction.error, database));
        transaction.oncomplete = () => {
          resolve({
            ok: true,
            value: { material, movements: resultMovements, events: resultEvents, reused }
          });
        };
      });
    } catch (error) {
      return failure(error);
    }
  }
  listCatalogItems() {
    return listAll(
      catalogItemStore,
      (left, right) => left.name.localeCompare(right.name) || left.createdAt.localeCompare(right.createdAt)
    );
  }
  getCatalogItem(id) {
    return readOne(catalogItemStore, id);
  }
  saveCatalogItem(item) {
    return writeOne(catalogItemStore, item);
  }
  listMeasurementUnits() {
    return listAll(
      measurementUnitStore,
      (left, right) => left.nameAr.localeCompare(right.nameAr)
    );
  }
  getMeasurementUnit(id) {
    return readOne(measurementUnitStore, id);
  }
  saveMeasurementUnit(unit) {
    return writeOne(measurementUnitStore, unit);
  }
  listDirectConversions() {
    return listAll(
      directConversionStore,
      (left, right) => left.createdAt.localeCompare(right.createdAt)
    );
  }
  getDirectConversion(id) {
    return readOne(directConversionStore, id);
  }
  saveDirectConversion(conversion) {
    return writeOne(directConversionStore, conversion);
  }
  async listCatalogTemplates(catalogItemId) {
    const result = await listAll(
      catalogTemplateStore,
      (left, right) => left.catalogItemId.localeCompare(right.catalogItemId) || right.revision - left.revision
    );
    return result.ok ? {
      ok: true,
      value: result.value.filter((template) => !catalogItemId || template.catalogItemId === catalogItemId)
    } : result;
  }
  getCatalogTemplate(id) {
    return readOne(catalogTemplateStore, id);
  }
  saveCatalogTemplate(template) {
    return writeOne(catalogTemplateStore, template);
  }
  async commitCatalogTemplateRevision(previous, next) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction(catalogTemplateStore, "readwrite");
        const store = transaction.objectStore(catalogTemplateStore);
        let pending = null;
        const finish = (result) => {
          resolve(result);
        };
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const request = store.getAll();
        request.onerror = () => {
          pending = failure(request.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        request.onsuccess = guardedSuccessListener(failFromListener, () => {
          const templates = request.result;
          const current = templates.find((template) => template.id === previous.id);
          const repeated = templates.find(
            (template) => template.createdOperationKey === next.createdOperationKey
          );
          if (repeated) {
            pending = { ok: true, value: { previous: current ?? previous, next: repeated } };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (!current || !current.active) {
            pending = {
              ok: false,
              code: STORAGE_ERROR,
              message: "\u0644\u0645 \u064A\u0639\u062F \u0627\u0644\u0642\u0627\u0644\u0628 \u0627\u0644\u0633\u0627\u0628\u0642 \u0641\u0639\u0627\u0644\u064B\u0627\u061B \u0644\u0645 \u062A\u064F\u062D\u0641\u0638 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u062C\u062F\u064A\u062F\u0629."
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (templates.some((template) => template.id === next.id)) {
            pending = {
              ok: false,
              code: STORAGE_ERROR,
              message: "\u062A\u0639\u0627\u0631\u0636 \u0647\u0648\u064A\u0629 \u0646\u0633\u062E\u0629 \u0627\u0644\u0642\u0627\u0644\u0628\u061B \u0644\u0645 \u062A\u062A\u063A\u064A\u0631 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A."
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          store.put(previous);
          store.put(next);
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { previous, next } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  listActualTimeRecords() {
    return listAll(
      actualTimeStore,
      (left, right) => right.recordedOn.localeCompare(left.recordedOn) || right.createdAt.localeCompare(left.createdAt)
    );
  }
  saveActualTimeRecord(record) {
    return writeOne(actualTimeStore, record);
  }
  listShortCashDeclarations() {
    return listAll(
      shortCashDeclarationStore,
      (left, right) => right.createdAt.localeCompare(left.createdAt)
    );
  }
  async listAllocationPolicies(catalogItemId) {
    const result = await listAll(
      allocationPolicyStore,
      (left, right) => right.startsOn.localeCompare(left.startsOn) || right.version - left.version
    );
    return result.ok ? {
      ok: true,
      value: result.value.filter((policy) => !catalogItemId || policy.catalogItemId === catalogItemId)
    } : result;
  }
  getAllocationPolicy(id) {
    return readOne(allocationPolicyStore, id);
  }
  saveAllocationPolicy(policy) {
    return writeOne(allocationPolicyStore, policy);
  }
  listCostEstimates() {
    return listAll(
      costEstimateStore,
      (left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id)
    );
  }
  getCostEstimate(id) {
    return readOne(costEstimateStore, id);
  }
  saveCostEstimate(estimate) {
    return writeOne(costEstimateStore, estimate);
  }
  deleteCostEstimate(id) {
    return deleteOne(costEstimateStore, id);
  }
  async commitAllocationPolicySuccessor(previous, successor) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction(allocationPolicyStore, "readwrite");
        const store = transaction.objectStore(allocationPolicyStore);
        let pending = null;
        const finish = (result) => {
          resolve(result);
        };
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const request = store.getAll();
        request.onerror = () => {
          pending = failure(request.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        request.onsuccess = guardedSuccessListener(failFromListener, () => {
          const policies = request.result;
          const repeated = policies.find((policy) => policy.idempotencyKey === successor.idempotencyKey);
          if (repeated) {
            pending = {
              ok: true,
              value: {
                previous: policies.find((policy) => policy.id === previous.id) ?? previous,
                successor: repeated
              }
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          const current = policies.find((policy) => policy.id === previous.id);
          if (!current || current.status !== "active") {
            pending = {
              ok: false,
              code: STORAGE_ERROR,
              message: "\u0644\u0645 \u062A\u0639\u062F \u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u062A\u0648\u0632\u064A\u0639 \u0627\u0644\u0623\u0635\u0644\u064A\u0629 \u0641\u0639\u0627\u0644\u0629\u061B \u0644\u0645 \u064A\u062A\u063A\u064A\u0631 \u0623\u064A \u0634\u064A\u0621."
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (policies.some((policy) => policy.id === successor.id)) {
            pending = {
              ok: false,
              code: STORAGE_ERROR,
              message: "\u062A\u0639\u0627\u0631\u0636 \u0647\u0648\u064A\u0629 \u0646\u0633\u062E\u0629 \u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u062A\u0648\u0632\u064A\u0639\u061B \u0644\u0645 \u062A\u062A\u063A\u064A\u0631 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A."
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          store.put(previous);
          store.put(successor);
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { previous, successor } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  getShortCashDeclaration(id) {
    return readOne(shortCashDeclarationStore, id);
  }
  saveShortCashDeclaration(declaration) {
    return writeOne(shortCashDeclarationStore, declaration);
  }
  async commitShortCashDeclarationReversal(sourceId, reversal) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction(shortCashDeclarationStore, "readwrite");
        const store = transaction.objectStore(shortCashDeclarationStore);
        let pending = null;
        const finish = (result) => {
          resolve(result);
        };
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const request = store.getAll();
        request.onerror = () => {
          pending = failure(request.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        request.onsuccess = guardedSuccessListener(failFromListener, () => {
          const declarations = request.result;
          const source = declarations.find(
            (candidate) => candidate.id === sourceId && candidate.kind === "declaration"
          );
          if (!source) {
            pending = {
              ok: false,
              code: STORAGE_ERROR,
              message: "\u0644\u0645 \u064A\u0639\u062F \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u0623\u0635\u0644\u064A \u0645\u0648\u062C\u0648\u062F\u064B\u0627\u061B \u0644\u0645 \u064A\u064F\u062D\u0641\u0638 \u0627\u0644\u062A\u0631\u0627\u062C\u0639."
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          const existing = declarations.find(
            (candidate) => candidate.kind === "reversal" && candidate.reversalOfId === sourceId
          );
          if (existing) {
            pending = existing.idempotencyKey === reversal.idempotencyKey ? { ok: true, value: existing } : {
              ok: false,
              code: STORAGE_ERROR,
              message: "\u062A\u0645 \u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0639\u0646 \u0647\u0630\u0627 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u0645\u062A\u0648\u0642\u0639 \u0633\u0627\u0628\u0642\u064B\u0627 \u0628\u0645\u0641\u062A\u0627\u062D \u0645\u062E\u062A\u0644\u0641\u061B \u0644\u0645 \u064A\u062A\u063A\u064A\u0631 \u0627\u0644\u0633\u062C\u0644."
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          const repeated = declarations.find(
            (candidate) => candidate.kind === "reversal" && candidate.idempotencyKey === reversal.idempotencyKey
          );
          if (repeated) {
            pending = { ok: true, value: repeated };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (declarations.some((candidate) => candidate.id === reversal.id)) {
            pending = {
              ok: false,
              code: STORAGE_ERROR,
              message: "\u062A\u0639\u0627\u0631\u0636 \u0647\u0648\u064A\u0629 \u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0639\u0646 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u0645\u062A\u0648\u0642\u0639\u061B \u0644\u0645 \u064A\u062A\u063A\u064A\u0631 \u0627\u0644\u0633\u062C\u0644."
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          store.put(reversal);
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: reversal });
      });
    } catch (error) {
      return failure(error);
    }
  }
  listOwnerEntitlementPolicies() {
    return listAll(
      ownerEntitlementPolicyStore,
      (left, right) => right.startsOn.localeCompare(left.startsOn) || right.version - left.version
    );
  }
  getOwnerEntitlementPolicy(id) {
    return readOne(ownerEntitlementPolicyStore, id);
  }
  saveOwnerEntitlementPolicy(policy) {
    return writeOne(ownerEntitlementPolicyStore, policy);
  }
  async commitOwnerEntitlementPolicySuccessor(previous, successor) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction(ownerEntitlementPolicyStore, "readwrite");
        const store = transaction.objectStore(ownerEntitlementPolicyStore);
        let pending = null;
        const finish = (result) => {
          resolve(result);
        };
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const request = store.getAll();
        request.onerror = () => {
          pending = failure(request.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        request.onsuccess = guardedSuccessListener(failFromListener, () => {
          const policies = request.result;
          const repeated = policies.find((policy) => policy.idempotencyKey === successor.idempotencyKey);
          if (repeated) {
            const current2 = policies.find((policy) => policy.id === previous.id) ?? previous;
            pending = { ok: true, value: { previous: current2, successor: repeated } };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          const current = policies.find((policy) => policy.id === previous.id);
          if (!current || current.status !== "active") {
            pending = {
              ok: false,
              code: STORAGE_ERROR,
              message: "\u0644\u0645 \u062A\u0639\u062F \u0627\u0644\u0633\u064A\u0627\u0633\u0629 \u0627\u0644\u0623\u0635\u0644\u064A\u0629 \u0641\u0639\u0627\u0644\u0629\u061B \u0644\u0645 \u062A\u064F\u062D\u0641\u0638 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u062C\u062F\u064A\u062F\u0629."
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (policies.some((policy) => policy.id === successor.id)) {
            pending = {
              ok: false,
              code: STORAGE_ERROR,
              message: "\u062A\u0639\u0627\u0631\u0636 \u0647\u0648\u064A\u0629 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u0645\u0646 \u0627\u0644\u0633\u064A\u0627\u0633\u0629\u061B \u0644\u0645 \u064A\u062A\u063A\u064A\u0631 \u0623\u064A \u0634\u064A\u0621."
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          store.put(previous);
          store.put(successor);
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { previous, successor } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  listOwnerEntitlementRecords() {
    return listAll(
      ownerEntitlementRecordStore,
      (left, right) => right.occurredOn.localeCompare(left.occurredOn) || right.recordedAt.localeCompare(left.recordedAt)
    );
  }
  getOwnerEntitlementRecord(id) {
    return readOne(ownerEntitlementRecordStore, id);
  }
  saveOwnerEntitlementRecord(record) {
    return writeOne(ownerEntitlementRecordStore, record);
  }
  async commitOwnerEntitlementRecordReversal(sourceId, reversal) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction(ownerEntitlementRecordStore, "readwrite");
        const store = transaction.objectStore(ownerEntitlementRecordStore);
        let pending = null;
        const finish = (result) => {
          resolve(result);
        };
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const request = store.getAll();
        request.onerror = () => {
          pending = failure(request.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        request.onsuccess = guardedSuccessListener(failFromListener, () => {
          const records = request.result;
          const source = records.find((record) => record.id === sourceId);
          if (!source) {
            pending = {
              ok: false,
              code: STORAGE_ERROR,
              message: "\u0644\u0645 \u064A\u0639\u062F \u0633\u062C\u0644 \u0627\u0644\u062D\u0642 \u0627\u0644\u0645\u0635\u062F\u0631 \u0645\u0648\u062C\u0648\u062F\u064B\u0627\u061B \u0644\u0645 \u064A\u064F\u062D\u0641\u0638 \u0627\u0644\u062A\u0631\u0627\u062C\u0639."
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          const existing = records.find((record) => record.reversalOfId === sourceId);
          if (existing) {
            pending = existing.idempotencyKey === reversal.idempotencyKey ? { ok: true, value: existing } : {
              ok: false,
              code: STORAGE_ERROR,
              message: "\u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0639\u0646 \u0627\u0644\u062D\u0642 \u0645\u0648\u062C\u0648\u062F \u0628\u0645\u0641\u062A\u0627\u062D \u0645\u062E\u062A\u0644\u0641\u061B \u0644\u0645 \u062A\u062A\u063A\u064A\u0631 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A."
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (records.some((record) => record.id === reversal.id)) {
            pending = {
              ok: false,
              code: STORAGE_ERROR,
              message: "\u062A\u0639\u0627\u0631\u0636 \u0647\u0648\u064A\u0629 \u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0639\u0646 \u0627\u0644\u062D\u0642\u061B \u0644\u0645 \u062A\u062A\u063A\u064A\u0631 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A."
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          store.put(reversal);
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: reversal });
      });
    } catch (error) {
      return failure(error);
    }
  }
  listOwnerEntitlementOpeningBalances() {
    return listAll(
      ownerEntitlementOpeningBalanceStore,
      (left, right) => right.occurredOn.localeCompare(left.occurredOn) || right.recordedAt.localeCompare(left.recordedAt)
    );
  }
  saveOwnerEntitlementOpeningBalance(balance) {
    return writeOne(ownerEntitlementOpeningBalanceStore, balance);
  }
  async commitOwnerEntitlementOpeningBalanceReversal(sourceId, reversal) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction(ownerEntitlementOpeningBalanceStore, "readwrite");
        const store = transaction.objectStore(ownerEntitlementOpeningBalanceStore);
        let pending = null;
        const finish = (result) => {
          resolve(result);
        };
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const request = store.getAll();
        request.onerror = () => {
          pending = failure(request.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        request.onsuccess = guardedSuccessListener(failFromListener, () => {
          const balances = request.result;
          const source = balances.find((balance) => balance.id === sourceId);
          if (!source) {
            pending = {
              ok: false,
              code: STORAGE_ERROR,
              message: "\u0644\u0645 \u064A\u0639\u062F \u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0627\u0641\u062A\u062A\u0627\u062D\u064A \u0627\u0644\u0645\u0635\u062F\u0631 \u0645\u0648\u062C\u0648\u062F\u064B\u0627\u061B \u0644\u0645 \u064A\u064F\u062D\u0641\u0638 \u0627\u0644\u062A\u0631\u0627\u062C\u0639."
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          const existing = balances.find((balance) => balance.reversalOfId === sourceId);
          if (existing) {
            pending = existing.idempotencyKey === reversal.idempotencyKey ? { ok: true, value: existing } : {
              ok: false,
              code: STORAGE_ERROR,
              message: "\u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0639\u0646 \u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0627\u0641\u062A\u062A\u0627\u062D\u064A \u0645\u0648\u062C\u0648\u062F \u0628\u0645\u0641\u062A\u0627\u062D \u0645\u062E\u062A\u0644\u0641\u061B \u0644\u0645 \u062A\u062A\u063A\u064A\u0631 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A."
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (balances.some((balance) => balance.id === reversal.id)) {
            pending = {
              ok: false,
              code: STORAGE_ERROR,
              message: "\u062A\u0639\u0627\u0631\u0636 \u0647\u0648\u064A\u0629 \u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0639\u0646 \u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0627\u0641\u062A\u062A\u0627\u062D\u064A\u061B \u0644\u0645 \u062A\u062A\u063A\u064A\u0631 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A."
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          store.put(reversal);
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: reversal });
      });
    } catch (error) {
      return failure(error);
    }
  }
  listOwnerMovements() {
    return listAll(
      ownerMovementStore,
      (left, right) => right.recordedAt.localeCompare(left.recordedAt)
    );
  }
  getOwnerMovement(id) {
    return readOne(ownerMovementStore, id);
  }
  async commitOwnerMovement(movement, cashEntry) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction([ownerMovementStore, cashContinuityEntryStore], "readwrite");
        const movements = transaction.objectStore(ownerMovementStore);
        const cashEntries = transaction.objectStore(cashContinuityEntryStore);
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const existingRequest = movements.getAll();
        let pending = null;
        const finish = (result) => {
          resolve(result);
        };
        existingRequest.onerror = () => {
          pending = failure(existingRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        existingRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          const existing = existingRequest.result.find(
            (candidate) => candidate.idempotencyKey === movement.idempotencyKey
          );
          if (existing) {
            const cashRequest = cashEntries.getAll();
            cashRequest.onerror = () => {
              pending = failure(cashRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            cashRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
              const matching = cashRequest.result.find(
                (entry) => entry.operationKey === cashEntry.operationKey
              );
              if (!matching) {
                pending = {
                  ok: false,
                  code: STORAGE_ERROR,
                  message: "\u0648\u062C\u062F\u062A \u062D\u0631\u0643\u0629 \u0645\u0627\u0644\u0643 \u0628\u0644\u0627 \u0623\u062B\u0631 \u0643\u0627\u0634 \u0645\u0637\u0627\u0628\u0642\u061B \u0644\u0645 \u064A\u062A\u063A\u064A\u0631 \u0627\u0644\u0633\u062C\u0644."
                };
                try {
                  transaction.abort();
                } catch {
                  if (pending) finish(pending);
                }
              } else {
                pending = { ok: true, value: { movement: existing, cashEntry: matching } };
                try {
                  transaction.abort();
                } catch {
                  if (pending) finish(pending);
                }
              }
            });
            return;
          }
          movements.put(movement);
          cashEntries.put(cashEntry);
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { movement, cashEntry } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  async commitOrderFromDraft(order, draft, schedule) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const stores = schedule ? [orderStore, draftStore, scheduleStore] : [orderStore, draftStore];
        const transaction = database.transaction(stores, "readwrite");
        transaction.objectStore(orderStore).put(order);
        transaction.objectStore(draftStore).put(draft);
        if (schedule) transaction.objectStore(scheduleStore).put(schedule);
        transaction.onabort = () => resolve(failure(transaction.error, database));
        transaction.onerror = () => resolve(failure(transaction.error, database));
        transaction.oncomplete = () => {
          resolve({ ok: true, value: { order, draft, schedule: schedule ?? null } });
        };
      });
    } catch (error) {
      return failure(error);
    }
  }
  async readSnapshot() {
    return readIndexedDbSnapshot();
  }
  async replaceSnapshot(snapshot) {
    return replaceIndexedDbSnapshot(snapshot);
  }
  /* المجموعة ٤ (عقد ٢٩ — الأصول): قراءة سجل الأصول. */
  listAssets() {
    return listAll(
      assetStore,
      (left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
    );
  }
  getAsset(id) {
    return readOne(assetStore, id);
  }
  /* كتابة ذرّية: سجل الأصل مع حدثه المالي أو بلا حدث (مراجعة عقد) — فحص
   * الهوية داخل المعاملة: الحدث موجود سلفًا أو المراجعة محفوظة → إعادة
   * استخدام صادقة؛ سجل مختلف بمعرف مشغول → رفض لا كتابة فوقه. */
  async commitAssetRecord(record, event) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction([assetStore, financialEventStore], "readwrite");
        const assets = transaction.objectStore(assetStore);
        const events = transaction.objectStore(financialEventStore);
        let pending = null;
        const finish = (result) => {
          resolve(result);
        };
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const assetRequest = assets.get(record.id);
        assetRequest.onerror = () => {
          pending = failure(assetRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        assetRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          const existing = assetRequest.result;
          const eventCheck = event ? events.get(event.id) : null;
          const proceed = () => {
            if (event) {
              const request = eventCheck;
              request.onsuccess = guardedSuccessListener(failFromListener, () => {
                if (request.result) {
                  pending = {
                    ok: true,
                    value: {
                      record: existing ?? record,
                      event: request.result,
                      reused: true
                    }
                  };
                  try {
                    transaction.abort();
                  } catch {
                    if (pending) finish(pending);
                  }
                  return;
                }
                assets.put(record);
                events.put(event);
              });
              request.onerror = () => {
                pending = failure(request.error, database);
                try {
                  transaction.abort();
                } catch {
                  if (pending) finish(pending);
                }
              };
              return;
            }
            if (existing && existing.contractRevisions.length >= record.contractRevisions.length && record.contractRevisions.length > 0) {
              pending = { ok: true, value: { record: existing, event: null, reused: true } };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
              return;
            }
            assets.put(record);
          };
          if (existing && existing.operationKey !== record.operationKey) {
            pending = {
              ok: false,
              code: STORAGE_ERROR,
              message: "\u0633\u062C\u0644 \u0623\u0635\u0644 \u0645\u062E\u062A\u0644\u0641 \u064A\u062D\u0645\u0644 \u0647\u0630\u0627 \u0627\u0644\u0645\u0639\u0631\u0641\u061B \u0644\u0645 \u064A\u062A\u063A\u064A\u0631 \u0634\u064A\u0621."
            };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          proceed();
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { record, event, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* تصحيح اقتناء أصل: التراجع والبديل والسجل في معاملة واحدة. */
  async commitAssetAcquisitionCorrection(record, reversal, replacement) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction([assetStore, financialEventStore], "readwrite");
        const assets = transaction.objectStore(assetStore);
        const events = transaction.objectStore(financialEventStore);
        let pending = null;
        const finish = (result) => {
          resolve(result);
        };
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const reversalRequest = events.get(reversal.id);
        reversalRequest.onerror = () => {
          pending = failure(reversalRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        reversalRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          if (reversalRequest.result) {
            const replacementRequest = events.get(replacement.id);
            replacementRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
              pending = {
                ok: true,
                value: {
                  record,
                  reversal: reversalRequest.result,
                  replacement: replacementRequest.result ?? replacement,
                  reused: true
                }
              };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            });
            replacementRequest.onerror = () => {
              pending = failure(replacementRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            return;
          }
          assets.put(record);
          events.put(reversal);
          events.put(replacement);
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { record, reversal, replacement, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* المجموعة ٤ (عقد ٢٩ — القروض): قراءة سجل القروض. */
  listLoans() {
    return listAll(
      loanStore,
      (left, right) => left.loanDate.localeCompare(right.loanDate) || left.id.localeCompare(right.id)
    );
  }
  getLoan(id) {
    return readOne(loanStore, id);
  }
  /* كتابة ذرّية: سجل القرض مع حدثه (إنشاء/سداد/تراجع سداد) — الحدث موجود
   * سلفًا أو مفتاحه مستعمل → إعادة استخدام؛ العلاقة بين السجل المخزّن
   * والوارد يجب أن تطابق عملية مجال واحدة (AV-02: تزامن الدفعات)، وإلا
   * يُرفض الالتزام ويبقى السجل والأحداث متسقين. */
  async commitLoanRecord(record, event) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction([loanStore, financialEventStore], "readwrite");
        const loans = transaction.objectStore(loanStore);
        const events = transaction.objectStore(financialEventStore);
        let pending = null;
        const finish = (result) => {
          resolve(result);
        };
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const eventRequest = events.get(event.id);
        eventRequest.onerror = () => {
          pending = failure(eventRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        eventRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          const existingEvent = eventRequest.result;
          if (existingEvent) {
            const loanRequest = loans.get(record.id);
            loanRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
              const existingLoan = loanRequest.result;
              pending = {
                ok: true,
                value: { record: existingLoan ?? record, event: existingEvent, reused: true }
              };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            });
            loanRequest.onerror = () => {
              pending = failure(loanRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            return;
          }
          const keyScanRequest = events.getAll();
          keyScanRequest.onerror = () => {
            pending = failure(keyScanRequest.error, database);
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
          };
          keyScanRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
            const keyReplay = findLoanEventByKey(
              keyScanRequest.result,
              event.idempotencyKey,
              event.id
            );
            if (keyReplay) {
              const loanRequest2 = loans.get(record.id);
              loanRequest2.onsuccess = guardedSuccessListener(failFromListener, () => {
                const existingLoan = loanRequest2.result;
                pending = {
                  ok: true,
                  value: { record: existingLoan ?? record, event: keyReplay, reused: true }
                };
                try {
                  transaction.abort();
                } catch {
                  if (pending) finish(pending);
                }
              });
              loanRequest2.onerror = () => {
                pending = failure(loanRequest2.error, database);
                try {
                  transaction.abort();
                } catch {
                  if (pending) finish(pending);
                }
              };
              return;
            }
            const loanRequest = loans.get(record.id);
            loanRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
              const storedLoan = loanRequest.result;
              const relation = validateLoanCommitRelation(storedLoan, record, event);
              if (!relation.ok) {
                pending = { ok: false, code: STORAGE_STALE, message: relation.message };
                try {
                  transaction.abort();
                } catch {
                  if (pending) finish(pending);
                }
                return;
              }
              loans.put(record);
              events.put(event);
            });
            loanRequest.onerror = () => {
              pending = failure(loanRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
          });
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { record, event, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* تصحيح قرض: التراجع والبديل والسجل في معاملة واحدة. */
  async commitLoanCorrection(record, reversal, replacement) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction([loanStore, financialEventStore], "readwrite");
        const loans = transaction.objectStore(loanStore);
        const events = transaction.objectStore(financialEventStore);
        let pending = null;
        const finish = (result) => {
          resolve(result);
        };
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const reversalRequest = events.get(reversal.id);
        reversalRequest.onerror = () => {
          pending = failure(reversalRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        reversalRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          if (reversalRequest.result) {
            const replacementRequest = events.get(replacement.id);
            replacementRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
              pending = {
                ok: true,
                value: {
                  record,
                  reversal: reversalRequest.result,
                  replacement: replacementRequest.result ?? replacement,
                  reused: true
                }
              };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            });
            replacementRequest.onerror = () => {
              pending = failure(replacementRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            return;
          }
          loans.put(record);
          events.put(reversal);
          events.put(replacement);
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { record, reversal, replacement, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* FIN-001 (WS-178 — Wave 6 — القروض المستلمة): قراءة سجل القروض المستلمة. */
  listReceivedLoans() {
    return listAll(
      receivedLoanStore,
      (left, right) => left.receivedOn.localeCompare(right.receivedOn) || left.id.localeCompare(right.id)
    );
  }
  getReceivedLoan(id) {
    return readOne(receivedLoanStore, id);
  }
  /* كتابة ذرّية: سجل القرض المستلم مع حدثه (قبض أصل/سداد أصل/تراجع سداد) —
   * الحدث موجود سلفًا أو مفتاحه مستعمل → إعادة استخدام؛ العلاقة بين السجل
   * المخزّن والوارد يجب أن تطابق عملية مجال واحدة (AV-02: تزامن تسديد
   * القروض المستلمة)، وإلا يُرفض الالتزام ويبقى السجل والأحداث متسقين. */
  async commitReceivedLoanRecord(record, event) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction([receivedLoanStore, financialEventStore], "readwrite");
        const receivedLoans = transaction.objectStore(receivedLoanStore);
        const events = transaction.objectStore(financialEventStore);
        let pending = null;
        const finish = (result) => {
          resolve(result);
        };
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const eventRequest = events.get(event.id);
        eventRequest.onerror = () => {
          pending = failure(eventRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        eventRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          const existingEvent = eventRequest.result;
          if (existingEvent) {
            const loanRequest = receivedLoans.get(record.id);
            loanRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
              const existingLoan = loanRequest.result;
              pending = {
                ok: true,
                value: { record: existingLoan ?? record, event: existingEvent, reused: true }
              };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            });
            loanRequest.onerror = () => {
              pending = failure(loanRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            return;
          }
          const keyScanRequest = events.getAll();
          keyScanRequest.onerror = () => {
            pending = failure(keyScanRequest.error, database);
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
          };
          keyScanRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
            const keyReplay = findReceivedLoanEventByKey(
              keyScanRequest.result,
              event.idempotencyKey,
              event.id
            );
            if (keyReplay) {
              const loanRequest2 = receivedLoans.get(record.id);
              loanRequest2.onsuccess = guardedSuccessListener(failFromListener, () => {
                const existingLoan = loanRequest2.result;
                pending = {
                  ok: true,
                  value: { record: existingLoan ?? record, event: keyReplay, reused: true }
                };
                try {
                  transaction.abort();
                } catch {
                  if (pending) finish(pending);
                }
              });
              loanRequest2.onerror = () => {
                pending = failure(loanRequest2.error, database);
                try {
                  transaction.abort();
                } catch {
                  if (pending) finish(pending);
                }
              };
              return;
            }
            const loanRequest = receivedLoans.get(record.id);
            loanRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
              const storedLoan = loanRequest.result;
              const relation = validateReceivedLoanCommitRelation(storedLoan, record, event);
              if (!relation.ok) {
                pending = { ok: false, code: STORAGE_STALE, message: relation.message };
                try {
                  transaction.abort();
                } catch {
                  if (pending) finish(pending);
                }
                return;
              }
              receivedLoans.put(record);
              events.put(event);
            });
            loanRequest.onerror = () => {
              pending = failure(loanRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
          });
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { record, event, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* تصحيح قرض مستلم: التراجع والبديل والسجل في معاملة واحدة. */
  async commitReceivedLoanCorrection(record, reversal, replacement) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction([receivedLoanStore, financialEventStore], "readwrite");
        const receivedLoans = transaction.objectStore(receivedLoanStore);
        const events = transaction.objectStore(financialEventStore);
        let pending = null;
        const finish = (result) => {
          resolve(result);
        };
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const reversalRequest = events.get(reversal.id);
        reversalRequest.onerror = () => {
          pending = failure(reversalRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        reversalRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          if (reversalRequest.result) {
            const replacementRequest = events.get(replacement.id);
            replacementRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
              pending = {
                ok: true,
                value: {
                  record,
                  reversal: reversalRequest.result,
                  replacement: replacementRequest.result ?? replacement,
                  reused: true
                }
              };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            });
            replacementRequest.onerror = () => {
              pending = failure(replacementRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            return;
          }
          receivedLoans.put(record);
          events.put(reversal);
          events.put(replacement);
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { record, reversal, replacement, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* المجموعة ٤ (عقد ٢٩ — العربون المحتفظ): تصنيف الطلب وحدثه المالي معًا. */
  async commitDepositClassification(order, event) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction([orderStore, financialEventStore], "readwrite");
        const orders = transaction.objectStore(orderStore);
        const events = transaction.objectStore(financialEventStore);
        let pending = null;
        const finish = (result) => {
          resolve(result);
        };
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const eventRequest = events.get(event.id);
        eventRequest.onerror = () => {
          pending = failure(eventRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        eventRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          const existingEvent = eventRequest.result;
          if (existingEvent) {
            const orderRequest = orders.get(order.id);
            orderRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
              const existingOrder = orderRequest.result;
              pending = {
                ok: true,
                value: { order: existingOrder ?? order, event: existingEvent, reused: true }
              };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            });
            orderRequest.onerror = () => {
              pending = failure(orderRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            return;
          }
          orders.put(order);
          events.put(event);
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { order, event, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* تصحيح تصنيف عربون: تراجع الحدث القائم وبديله والطلب معًا. */
  async commitDepositClassificationCorrection(order, reversal, replacement) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction([orderStore, financialEventStore], "readwrite");
        const orders = transaction.objectStore(orderStore);
        const events = transaction.objectStore(financialEventStore);
        let pending = null;
        const finish = (result) => {
          resolve(result);
        };
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const reversalRequest = events.get(reversal.id);
        reversalRequest.onerror = () => {
          pending = failure(reversalRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        reversalRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          if (reversalRequest.result) {
            const replacementRequest = events.get(replacement.id);
            replacementRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
              pending = {
                ok: true,
                value: {
                  order,
                  reversal: reversalRequest.result,
                  replacement: replacementRequest.result ?? replacement,
                  reused: true
                }
              };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            });
            replacementRequest.onerror = () => {
              pending = failure(replacementRequest.error, database);
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
            };
            return;
          }
          orders.put(order);
          events.put(reversal);
          events.put(replacement);
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { order, reversal, replacement, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* OPS-003 (عقد ٤١ — المصروف المتكرر): قراءة العائلات الثلاث. */
  listRecurringExpenseSeries() {
    return listAll(
      recurringExpenseSeriesStore,
      (left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
    );
  }
  getRecurringExpenseSeries(id) {
    return readOne(recurringExpenseSeriesStore, id);
  }
  listRecurringExpenseRevisions() {
    return listAll(
      recurringExpenseRevisionStore,
      (left, right) => left.revision - right.revision || left.id.localeCompare(right.id)
    );
  }
  listRecurringExpenseOccurrences() {
    return listAll(
      recurringExpenseOccurrenceStore,
      (left, right) => left.periodKey.localeCompare(right.periodKey) || left.id.localeCompare(right.id)
    );
  }
  getRecurringExpenseOccurrence(id) {
    return readOne(recurringExpenseOccurrenceStore, id);
  }
  /* إنشاء المسودة: سلسلة + مراجعتها الأولى في معاملة واحدة — الوجود المسبق
   * المطابق = إعادة استخدام؛ أي انحراف = storage_stale بلا كتابة. */
  async commitRecurringExpenseDraft(series, revision) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction(
          [recurringExpenseSeriesStore, recurringExpenseRevisionStore],
          "readwrite"
        );
        const serieses = transaction.objectStore(recurringExpenseSeriesStore);
        const revisions = transaction.objectStore(recurringExpenseRevisionStore);
        let pending = null;
        const finish = (result) => resolve(result);
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const seriesRequest = serieses.get(series.id);
        seriesRequest.onerror = () => {
          pending = failure(seriesRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        seriesRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          const storedSeries = seriesRequest.result;
          const revisionRequest = revisions.get(revision.id);
          revisionRequest.onerror = () => {
            pending = failure(revisionRequest.error, database);
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
          };
          revisionRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
            const storedRevision = revisionRequest.result;
            const guard = validateRecurringExpenseDraftCommit(storedSeries, storedRevision, series, revision);
            if (!guard.ok) {
              pending = { ok: false, code: STORAGE_STALE, message: guard.message };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
              return;
            }
            if (guard.reused) {
              pending = {
                ok: true,
                value: {
                  series: storedSeries ?? series,
                  revision: storedRevision ?? revision,
                  reused: true
                }
              };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
              return;
            }
            serieses.put(series);
            revisions.put(revision);
          });
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { series, revision, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* تغيير محروس على السلسلة مع مراجعة خلف وتحديثات فترات اختيارية — كله أو لا شيء. */
  async commitRecurringExpenseSeriesChange(seriesBase, seriesNext, revision, occurrenceUpdates) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction(
          [recurringExpenseSeriesStore, recurringExpenseRevisionStore, recurringExpenseOccurrenceStore],
          "readwrite"
        );
        const serieses = transaction.objectStore(recurringExpenseSeriesStore);
        const revisions = transaction.objectStore(recurringExpenseRevisionStore);
        const occurrences = transaction.objectStore(recurringExpenseOccurrenceStore);
        let pending = null;
        const finish = (result) => resolve(result);
        const abortWith = (result) => {
          pending = result;
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const failFromListener = (error) => abortWith(failure(error, database));
        const seriesRequest = serieses.get(seriesBase.id);
        seriesRequest.onerror = () => abortWith(failure(seriesRequest.error, database));
        seriesRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          const storedSeries = seriesRequest.result;
          const revisionsRequest = revisions.getAll();
          revisionsRequest.onerror = () => abortWith(failure(revisionsRequest.error, database));
          revisionsRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
            const storedRevisions = revisionsRequest.result;
            const occurrencesRequest = occurrences.getAll();
            occurrencesRequest.onerror = () => abortWith(failure(occurrencesRequest.error, database));
            occurrencesRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
              const storedOccurrences = occurrencesRequest.result;
              const guard = validateRecurringExpenseSeriesChange(
                storedSeries,
                storedRevisions,
                storedOccurrences,
                seriesBase,
                seriesNext,
                revision,
                occurrenceUpdates
              );
              if (!guard.ok) {
                abortWith({ ok: false, code: STORAGE_STALE, message: guard.message });
                return;
              }
              serieses.put(seriesNext);
              if (revision !== null) revisions.put(revision);
              for (const update of occurrenceUpdates) occurrences.put(update.next);
            });
          });
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({
          ok: true,
          value: {
            series: seriesNext,
            revision,
            occurrences: occurrenceUpdates.map((update) => update.next),
            reused: false
          }
        });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* توليد الفترات أماميًا (إضافة فقط) — الغائب يُنشأ والمطابق يُتخطى والمختلف
   * تعارض بلا كتابة؛ دفعة واحدة ذرّية داخل معاملة واحدة. */
  async commitRecurringExpenseOccurrences(occurrences) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction([recurringExpenseOccurrenceStore], "readwrite");
        const store = transaction.objectStore(recurringExpenseOccurrenceStore);
        let createdCount = 0;
        let skippedCount = 0;
        let pending = null;
        const finish = (result) => resolve(result);
        const abortWith = (result) => {
          pending = result;
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const failFromListener = (error) => abortWith(failure(error, database));
        const allRequest = store.getAll();
        allRequest.onerror = () => abortWith(failure(allRequest.error, database));
        allRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          const storedById = new Map(
            allRequest.result.map((occurrence) => [
              occurrence.id,
              occurrence
            ])
          );
          for (const occurrence of occurrences) {
            const guard = validateRecurringExpenseMaterialization(storedById.get(occurrence.id), occurrence);
            if (!guard.ok) {
              abortWith({ ok: false, code: STORAGE_STALE, message: guard.message });
              return;
            }
            if (guard.reused) {
              skippedCount += 1;
            } else {
              store.put(occurrence);
              createdCount += 1;
            }
          }
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish(pending ?? { ok: true, value: { created: createdCount, skipped: skippedCount } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* قرار فترة مفرد (تأجيل/تخطٍ/علامة محاولة/فشل معروف) — محروس داخل الحد. */
  async commitRecurringExpenseOccurrenceDecision(base, next) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction([recurringExpenseOccurrenceStore], "readwrite");
        const occurrences = transaction.objectStore(recurringExpenseOccurrenceStore);
        let pending = null;
        const finish = (result) => resolve(result);
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const occurrenceRequest = occurrences.get(next.id);
        occurrenceRequest.onerror = () => {
          pending = failure(occurrenceRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        occurrenceRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          const stored = occurrenceRequest.result;
          const guard = validateRecurringExpenseOccurrenceDecision(stored, base, next);
          if (!guard.ok) {
            pending = { ok: false, code: STORAGE_STALE, message: guard.message };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (guard.reused) {
            pending = { ok: true, value: { occurrence: stored ?? next, reused: true } };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          occurrences.put(next);
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { occurrence: next, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* التسجيل الذرّي (عقد ٤١ §٨): الفرة والحدث في معاملة واحدة — إعادة المفتاح
   * إعادة استخدام، واصطدام المفتاح بحدث مختلف رفض صادر بلا كتابة. */
  async commitRecurringExpenseOccurrenceRecord(base, next, event) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction(
          [recurringExpenseOccurrenceStore, financialEventStore],
          "readwrite"
        );
        const occurrences = transaction.objectStore(recurringExpenseOccurrenceStore);
        const events = transaction.objectStore(financialEventStore);
        let pending = null;
        const finish = (result) => resolve(result);
        const abortWith = (result) => {
          pending = result;
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const failFromListener = (error) => abortWith(failure(error, database));
        const eventRequest = events.get(event.id);
        eventRequest.onerror = () => abortWith(failure(eventRequest.error, database));
        eventRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          const existingEvent = eventRequest.result;
          const keyScanRequest = events.getAll();
          keyScanRequest.onerror = () => abortWith(failure(keyScanRequest.error, database));
          keyScanRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
            const keyReplay = findRecurringExpenseEventByKey(
              keyScanRequest.result,
              event.idempotencyKey,
              event.id
            );
            const replay = keyReplay ?? existingEvent;
            if (replay) {
              const collision = validateRecurringExpenseKeyEventCollision(
                replay,
                event.type,
                event.amountMinor
              );
              if (!collision.ok) {
                abortWith({ ok: false, code: STORAGE_STALE, message: collision.message });
                return;
              }
            }
            const occurrenceRequest = occurrences.get(next.id);
            occurrenceRequest.onerror = () => abortWith(failure(occurrenceRequest.error, database));
            occurrenceRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
              const storedOccurrence = occurrenceRequest.result;
              const guard = validateRecurringExpenseOccurrenceRecordCommit(
                storedOccurrence,
                base,
                next,
                replay,
                event.id
              );
              if (!guard.ok) {
                abortWith({ ok: false, code: STORAGE_STALE, message: guard.message });
                return;
              }
              if (guard.reused) {
                pending = {
                  ok: true,
                  value: {
                    occurrence: storedOccurrence ?? next,
                    event: replay ?? event,
                    reused: true
                  }
                };
                try {
                  transaction.abort();
                } catch {
                  if (pending) finish(pending);
                }
                return;
              }
              occurrences.put(next);
              events.put(event);
            });
          });
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { occurrence: next, event, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* FIN-002 (عقد ٤٢ — الميزانيات): قراءة سجلات الميزانية كما كُتبت. */
  listExpenseBudgets() {
    return listAll(
      expenseBudgetStore,
      (left, right) => left.periodKey.localeCompare(right.periodKey) || left.id.localeCompare(right.id)
    );
  }
  /* حفظ محروس لسجل واحد: المطابق الحرفي إعادة استخدام بلا كتابة ثانية،
   * والمختلف على المعرّف نفسه رفض صادر (storage_stale) داخل حد الكتابة. */
  async saveExpenseBudget(record, expected) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction([expenseBudgetStore], "readwrite");
        const budgets = transaction.objectStore(expenseBudgetStore);
        let pending = null;
        const finish = (result) => resolve(result);
        const failFromListener = (error) => {
          pending = failure(error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const storedRequest = budgets.get(record.id);
        storedRequest.onerror = () => {
          pending = failure(storedRequest.error, database);
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        storedRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          const stored = storedRequest.result;
          const guard = validateExpenseBudgetSave(stored, record, expected);
          if (!guard.ok) {
            pending = { ok: false, code: STORAGE_STALE, message: guard.message };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          if (guard.reused) {
            pending = { ok: true, value: { record: stored ?? record, reused: true } };
            try {
              transaction.abort();
            } catch {
              if (pending) finish(pending);
            }
            return;
          }
          budgets.put(record);
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { record, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
  /* زوج المراجعة الذرّي (عقد ٤٢ §٥): الخلف والسابقة في معاملة تخزين واحدة —
   * كلاهما أو لا شيء؛ إعادة تشغيل الزوج كاملًا إعادة استخدام، وأي انحراف أو
   * رابط مكسور رفض صادر بلا كتابة. */
  async saveExpenseBudgetRevisionPair(successor, supersededPrevious) {
    try {
      const database = await connection();
      return await new Promise((resolve) => {
        const transaction = database.transaction([expenseBudgetStore], "readwrite");
        const budgets = transaction.objectStore(expenseBudgetStore);
        let pending = null;
        const finish = (result) => resolve(result);
        const abortWith = (result) => {
          pending = result;
          try {
            transaction.abort();
          } catch {
            if (pending) finish(pending);
          }
        };
        const failFromListener = (error) => abortWith(failure(error, database));
        const successorRequest = budgets.get(successor.id);
        successorRequest.onerror = () => abortWith(failure(successorRequest.error, database));
        successorRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
          const storedSuccessor = successorRequest.result;
          const previousRequest = budgets.get(supersededPrevious.id);
          previousRequest.onerror = () => abortWith(failure(previousRequest.error, database));
          previousRequest.onsuccess = guardedSuccessListener(failFromListener, () => {
            const storedPrevious = previousRequest.result;
            const guard = validateExpenseBudgetRevisionPair(
              storedSuccessor,
              storedPrevious,
              successor,
              supersededPrevious
            );
            if (!guard.ok) {
              abortWith({ ok: false, code: STORAGE_STALE, message: guard.message });
              return;
            }
            if (guard.reused) {
              pending = {
                ok: true,
                value: {
                  successor: storedSuccessor ?? successor,
                  supersededPrevious: storedPrevious ?? supersededPrevious,
                  reused: true
                }
              };
              try {
                transaction.abort();
              } catch {
                if (pending) finish(pending);
              }
              return;
            }
            budgets.put(successor);
            budgets.put(supersededPrevious);
          });
        });
        transaction.onerror = () => {
          if (!pending) pending = failure(transaction.error, database);
        };
        transaction.onabort = () => finish(pending ?? failure(transaction.error, database));
        transaction.oncomplete = () => finish({ ok: true, value: { successor, supersededPrevious, reused: false } });
      });
    } catch (error) {
      return failure(error);
    }
  }
};
export {
  IndexedDbLocalStore,
  __cachedConnectionForTesting,
  __openDatabaseForTesting
};
