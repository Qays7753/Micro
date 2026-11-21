/**
 * Ask Micro — the provider-neutral safety policy (Post-Group 6 continuous
 * completion — WS-251/DOC-041, owner order 7593b9c4 §5, BINDING):
 *
 *  1. The provider port receives ONLY the bounded per-role fact set
 *     (server-computed aggregates through the authorized read paths) — never
 *     a whole database, never cross-workspace data, never another person's
 *     personal/financial information (§5.1).
 *  2. Financial figures in an answer must be traceable to a CITED fact whose
 *     value came from the application's trusted server results — never model
 *     arithmetic or invented values (§5.2). An answer carrying an uncited
 *     figure fails CLOSED to the honest «لا أعرف».
 *  3. A write-intent message may produce a TYPED, EDITABLE draft card only —
 *     unknown required values stay visibly blank; the draft is never a saved
 *     transaction (§5.3). The only write path is the user's explicit
 *     confirmation through the existing canonical use case with server
 *     acceptance (§5.4) — this module NEVER writes anything.
 *
 * No provider is chosen, connected, configured, called, or paid for in this
 * repository: the runtime state stays honestly «not configured» until the
 * owner/Manus decision, and the mock provider exists ONLY inside tests.
 */

/** The closed draft-kind registry — the ONLY write-intent shapes Ask Micro
 * may propose. Adding a kind is an additive, owner-reviewed change. */
export const ASK_DRAFT_KINDS = ["delivery-booking"] as const;
export type AskDraftKind = (typeof ASK_DRAFT_KINDS)[number];

/** The closed field-type set of a draft card (typed, editable, no free JSON). */
export type AskDraftFieldType = "text" | "decimal" | "date" | "enum" | "governorate" | "count";

export interface AskDraftField {
  name: string;
  label: string;
  type: AskDraftFieldType;
  required: boolean;
  /** null/absent = unknown — the provider may NOT decide it (§5.3). */
  value: string | number | null;
  options?: string[];
}

export interface AskDraftProposal {
  kind: AskDraftKind;
  title: string;
  fields: AskDraftField[];
}

/** One server-computed, per-role fact — the ONLY data the provider sees. */
export interface AskContextFact {
  id: string;
  label: string;
  value: string | number | boolean;
  source: string;
}

export type AskRole = "owner" | "supplier" | "driver";

/** What the worker sends to the provider port (no identity, no raw records). */
export interface AskProviderInput {
  question: string;
  role: AskRole;
  facts: AskContextFact[];
}

/** What a provider returns — validated by the policy below before ANY use. */
export interface AskProviderResult {
  answerText: string;
  citedFactIds?: unknown;
  draft?: unknown;
}

/** The safe, validated answer the client renders. */
export interface AskSafeAnswer {
  answer: string;
  sources: AskContextFact[];
  draft: AskDraftProposal | null;
}

export const ASK_HONEST_UNKNOWN =
  "لا أعرف من سياقك المصرح ما يكفي للإجابة بدقة. الأرقام تأتي من سجلاتك وحدها — أعد صياغة سؤالك داخل نطاق دورك.";

/* ── The figure guard (§5.2) ───────────────────────────────────────────────
 * Every digit sequence in the answer (Western and Arabic-Indic digits) must
 * appear in the STRING FORM of at least one CITED fact value; otherwise the
 * figure is a model invention and the WHOLE answer fails closed to the honest
 * unknown (never a partial answer with an invented number left in). */
const FIGURE_PATTERN = /[0-9٠-٩][0-9٠-٩.,،]*/g;

function citedFactTexts(facts: AskContextFact[]): string {
  return facts.map(fact => String(fact.value)).join(" | ");
}

function normalizeFigures(text: string): string[] {
  const matches = text.match(FIGURE_PATTERN) ?? [];
  return matches.map(match =>
    match
      .replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
      .replace(/[.,،]+$/, "")
      .replace(/[.,،]/g, "."),
  );
}

export function answerCarriesUnbackedFigures(answerText: string, citedFacts: AskContextFact[]): boolean {
  const allowed = normalizeFigures(citedFactTexts(citedFacts));
  for (const figure of normalizeFigures(answerText)) {
    if (!allowed.includes(figure)) return true;
  }
  return false;
}

/* ── The draft policy (§5.3) ───────────────────────────────────────────────
 * A proposal is accepted only when: the kind is in the closed registry, the
 * fields follow the closed shape, and every PREFILLED value is backed by a
 * cited fact (a value the provider invented for a field the user never
 * stated is dropped to blank — unknown required values STAY unknown). */
function isDraftFieldShape(value: unknown): value is AskDraftField {
  if (value === null || typeof value !== "object") return false;
  const field = value as Record<string, unknown>;
  return (
    typeof field.name === "string" &&
    field.name.length > 0 &&
    typeof field.label === "string" &&
    field.label.length > 0 &&
    ["text", "decimal", "date", "enum", "governorate", "count"].includes(String(field.type)) &&
    typeof field.required === "boolean" &&
    (field.value === null ||
      field.value === undefined ||
      typeof field.value === "string" ||
      typeof field.value === "number") &&
    (field.options === undefined ||
      (Array.isArray(field.options) && field.options.every(o => typeof o === "string")))
  );
}

export function sanitizeDraftProposal(draft: unknown, citedFacts: AskContextFact[]): AskDraftProposal | null {
  if (draft === null || draft === undefined) return null;
  if (typeof draft !== "object") return null;
  const raw = draft as Record<string, unknown>;
  if (typeof raw.kind !== "string" || !(ASK_DRAFT_KINDS as readonly string[]).includes(raw.kind)) {
    return null;
  }
  if (typeof raw.title !== "string" || raw.title.trim().length === 0) return null;
  if (!Array.isArray(raw.fields) || raw.fields.length === 0 || raw.fields.length > 16) return null;
  const allowed = citedFactTexts(citedFacts);
  const fields: AskDraftField[] = [];
  for (const entry of raw.fields) {
    if (!isDraftFieldShape(entry)) return null;
    // A prefilled value survives ONLY when its string form is backed by a
    // cited fact — anything else is a provider-invented value → dropped to
    // blank (the user decides it, §5.3).
    let value: string | number | null =
      entry.value === undefined ? null : entry.value === null ? null : entry.value;
    if (value !== null && !allowed.includes(String(value))) {
      value = null;
    }
    if (entry.type === "enum" && (entry.options === undefined || entry.options.length === 0)) {
      return null;
    }
    fields.push({ ...entry, value });
  }
  return { kind: raw.kind as AskDraftKind, title: raw.title.trim().slice(0, 120), fields };
}

/* ── The full pipeline policy (§5.1–§5.4) ────────────────────────────────── */

/** Validate a provider result into the safe answer. Fail-closed everywhere:
 * unknown citations drop the source; an unbacked figure rejects the answer
 * text; a malformed draft drops the draft; nothing here can ever write. */
export function applyAskPolicy(result: AskProviderResult, facts: AskContextFact[]): AskSafeAnswer {
  const byId = new Map(facts.map(fact => [fact.id, fact]));
  const cited: AskContextFact[] = [];
  if (Array.isArray(result.citedFactIds)) {
    for (const id of result.citedFactIds) {
      if (typeof id === "string" && byId.has(id)) {
        const fact = byId.get(id)!;
        if (!cited.includes(fact)) cited.push(fact);
      }
    }
  }
  const answerText = typeof result.answerText === "string" ? result.answerText.trim().slice(0, 4000) : "";
  let answer = answerText;
  if (answerCarriesUnbackedFigures(answer, cited)) {
    answer = ASK_HONEST_UNKNOWN;
  }
  if (answer.length === 0) {
    answer = ASK_HONEST_UNKNOWN;
  }
  const draft = answer === ASK_HONEST_UNKNOWN ? null : sanitizeDraftProposal(result.draft, cited);
  return { answer, sources: cited, draft };
}
