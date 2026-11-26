/**
 * M2.2 (§4 Q20 + §3.8 + §9/INV-4 + §11 E-REVERSE-REVERSAL — مانج-في₂،
 * الموجة E): بناء قيد العكس Q20 — «كل ترحيلات القيد q بإشارة معكوسة،
 * بتاريخ فعليته هو تاريخه، وreverses_entry_id = معرّفه» (§4 حرفيًا).
 *
 * قاعدة الرفض (نص المهمة): «عكسُ عكسٍ» — Q20 على قيد هو نفسه Q20 مرفوض
 * بـE-REVERSE-REVERSAL (§5 OP-CANCEL-OPERATION: «Q20 entries cannot be
 * reversed»). وترحيلات المعكوس نفسها تُعاد فحوصها أولًا فشلًا مغلقًا (قيد
 * مفسد لا يُعكس) — القيد وعكسه يتصفّيان على كل حساب (INV-4).
 */
import { validateLedgerEntry } from "./validateEntry.js";
import type { BuiltLedgerEntry, LedgerEntryBuildInput, LedgerPosting, ReversedLedgerEntry } from "./types.js";

/** عكس ترحيل واحد: كل حقوله كما هي والمقدار بإشارة معكوسة (§4 Q20). */
function negatePosting(posting: LedgerPosting): LedgerPosting {
  return { ...posting, deltaFils: -posting.deltaFils };
}

/** إعادة فحص القيد المعكوس تحت نوعه قبل عكسه (فشل مغلق — لا يُعكس مفسد). */
function requireReversibleEntry(reversed: ReversedLedgerEntry): void {
  if (reversed.entryType === "Q20") {
    throw new Error(
      "لا يمكن عكس قيد هو نفسه عكس (Q20 على Q20) — E-REVERSE-REVERSAL (§5 OP-CANCEL-OPERATION).",
    );
  }
  validateLedgerEntry({
    entryType: reversed.entryType,
    effectiveOn: reversed.effectiveOn,
    postings: reversed.postings,
  });
}

/** Q20 — العكس (§4): مرآة ترحيلات q المعكوسة بإشاراتها، بتاريخ q ومعرّفه. */
export function buildReversalEntry(input: LedgerEntryBuildInput): BuiltLedgerEntry {
  if (input.type !== "Q20") {
    throw new Error(`باني العكس (Q20) استُدعي بمدخل نوعه ${input.type} — خطأ برمجي لا يُمرر بصمت.`);
  }
  const reversed = input.reversed;
  requireReversibleEntry(reversed);
  const entry: BuiltLedgerEntry = {
    entryType: "Q20",
    effectiveOn: reversed.effectiveOn,
    reversesEntryId: reversed.id,
    postings: reversed.postings.map(negatePosting),
  };
  validateLedgerEntry({
    entryType: "Q20",
    effectiveOn: entry.effectiveOn,
    reversesEntryId: reversed.id,
    reversedEntryType: reversed.entryType,
    postings: entry.postings,
  });
  return entry;
}
