/**
 * Ask Micro financial draft service (owner supplement §10.2-5, 2026-11-22 —
 * WS-251/DOC-041): the application-layer constructor for a manage-financial-
 * event draft record. The record is built by the DOMAIN's own
 * createFinancialEvent (every canonical shape/value guard — no schema
 * duplication anywhere); the card only collects the user's values and calls
 * this service, then saves through the EXISTING single-record connected
 * write. No new write path, no financial-meaning change.
 *
 * The amount travels as the user's raw money TEXT and is converted by the
 * canonical input-boundary parser (parseEnglishNumericText kind="money" —
 * JOD minor units directly, no float rounding anywhere).
 */
import { createFinancialEvent } from "@micro-domain/financial-event/index.js";
import type { FinancialEvent } from "@micro-domain/financial-event/index.js";
import { parseEnglishNumericText } from "@/application/input";

export interface AskFinancialEventDraftInput {
  eventType: string;
  /** The user's raw amount text in JOD (e.g. "12.5") — parsed canonically. */
  amountJodText: string;
  occurredOn: string;
  note: string;
  counterparty: string;
}

/** The canonical minor-unit parse of the user's amount text, or null when
 * the text is not a valid money amount. */
export function askDraftAmountMinor(amountJodText: string): number | null {
  return parseEnglishNumericText(amountJodText.trim(), "money");
}

/** Construct the canonical financial-event record from the user-completed
 * draft values — the domain validates every value (positive amount, valid
 * date, non-blank note) and freezes the record with its computed deltas. */
export function constructFinancialEventRecord(input: AskFinancialEventDraftInput): FinancialEvent {
  const amountMinor = askDraftAmountMinor(input.amountJodText);
  if (amountMinor === null || amountMinor <= 0 || !Number.isSafeInteger(amountMinor)) {
    throw new Error("أدخل مبلغًا صحيحًا بالدينار (منزلتان كحد أقصى).");
  }
  return createFinancialEvent({
    id: globalThis.crypto?.randomUUID?.() ?? `financial-${Date.now()}`,
    type: input.eventType as Parameters<typeof createFinancialEvent>[0]["type"],
    amountMinor,
    occurredOn: input.occurredOn,
    recordedAt: new Date().toISOString(),
    idempotencyKey: globalThis.crypto?.randomUUID?.() ?? `ask-${Date.now()}`,
    note: input.note.trim(),
    counterparty: input.counterparty.trim() === "" ? null : input.counterparty.trim(),
  });
}
