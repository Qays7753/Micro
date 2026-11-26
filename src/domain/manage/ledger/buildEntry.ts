/**
 * M2.2 (§4 + §3.8 — مانج-في₂، الموجة E): بناء قيود الدفتر — الدالة الواحدة
 * التي تبني قيدًا وتتحقق منه (نص المهمة: «دالة واحدة تبني قيدًا وتَتحقق:
 * ترفض النوع المجهول، والترحيل إلى حساب غير مسموح، والمجموع غير الصافي،
 * وعكسَ العكس»).
 *
 * البنية: مرسل واحد (`buildLedgerEntry`) على خريطة بناة مكتملة الأنواع، لكل
 * نوع بانيه الصغير الصرف؛ الأنواع المركّبة (Q5/Q15/Q16/Q17) في
 * `buildCompoundEntry.ts` والعكس (Q20) في `buildReversalEntry.ts`. كل باني
 * يبني ترحيلات §4 الحرفية بتواريخها ومعاملاتها ثم يمررها إلى التحقق قبل
 * إعادتها — لا قيد يعود بلا فحص (فشل مغلق).
 *
 * قواعد المدخلات الحرفية من §4: «a، p، m، r، e مقادير موجبة بالفلس ما لم
 * يُذكر غير ذلك» — وQ1 يذكر «a ≥ 0»، وQ15 يذكر «0 ≤ m ≤ p»، وQ19 يذكر
 * «diff ≠ 0 مُوقَّعًا». القيم المتوقعة للسطور الجديدة والخيارات يمررها
 * المستدعي (طبقة العمليات M2.4+) — المجال صرف ولا يحمل حالة.
 */
import type { MoneyFils } from "../money/types.js";
import { isLedgerEntryTypeId } from "./registry.js";
import { finishEntry, requireType } from "./buildSupport.js";
import type { BuiltLedgerEntry, LedgerEntryBuildInput, LedgerEntryTypeId } from "./types.js";
import { buildQ5, buildQ15, buildQ16, buildQ17 } from "./buildCompoundEntry.js";
import { buildReversalEntry } from "./buildReversalEntry.js";

function buildQ1(input: LedgerEntryBuildInput): BuiltLedgerEntry {
  const { boxId, amountFils, effectiveOn } = requireType(input, "Q1");
  if (amountFils < 0) {
    throw new Error(`مقدار افتتاح Q1 يجب أن يكون ≥ 0 بالفلس (§4: a ≥ 0) — وُجد ${amountFils}.`);
  }
  /* a = 0: لا ترحيلات (كل ترحيل صفري ممنوع بـ§3.8) — قرار إنشاء صف القيد لطبقة العمليات */
  if (amountFils === 0) {
    return finishEntry({ entryType: "Q1", effectiveOn, postings: [] });
  }
  return finishEntry({
    entryType: "Q1",
    effectiveOn,
    postings: [
      { account: "BOX", refId: boxId, deltaFils: amountFils },
      { account: "OPEN", deltaFils: amountFils },
    ],
  });
}

function buildQ2(input: LedgerEntryBuildInput): BuiltLedgerEntry {
  const { lineId, amountFils, effectiveOn } = requireType(input, "Q2");
  requirePositive("Q2", amountFils);
  return finishEntry({
    entryType: "Q2",
    effectiveOn,
    postings: [
      { account: "AR", refId: lineId, deltaFils: amountFils },
      { account: "OPEN", deltaFils: amountFils },
    ],
  });
}

function buildQ3(input: LedgerEntryBuildInput): BuiltLedgerEntry {
  const { lineId, amountFils, effectiveOn } = requireType(input, "Q3");
  requirePositive("Q3", amountFils);
  return finishEntry({
    entryType: "Q3",
    effectiveOn,
    postings: [
      { account: "AP", refId: lineId, deltaFils: amountFils },
      { account: "OPEN", deltaFils: -amountFils },
    ],
  });
}

function buildQ4(input: LedgerEntryBuildInput): BuiltLedgerEntry {
  const { boxId, saleId, amountFils, effectiveOn } = requireType(input, "Q4");
  requirePositive("Q4", amountFils);
  return finishEntry({
    entryType: "Q4",
    effectiveOn,
    postings: [
      { account: "BOX", refId: boxId, deltaFils: amountFils },
      { account: "PRE", refId: saleId, deltaFils: amountFils },
    ],
  });
}

function buildQ6(input: LedgerEntryBuildInput): BuiltLedgerEntry {
  const { boxId, lineId, amountFils, effectiveOn } = requireType(input, "Q6");
  requirePositive("Q6", amountFils);
  return finishEntry({
    entryType: "Q6",
    effectiveOn,
    postings: [
      { account: "BOX", refId: boxId, deltaFils: amountFils },
      { account: "AR", refId: lineId, deltaFils: -amountFils },
    ],
  });
}

function buildQ7(input: LedgerEntryBuildInput): BuiltLedgerEntry {
  const { boxId, lineId, amountFils, effectiveOn } = requireType(input, "Q7");
  requirePositive("Q7", amountFils);
  return finishEntry({
    entryType: "Q7",
    effectiveOn,
    postings: [
      { account: "BOX", refId: boxId, deltaFils: -amountFils },
      { account: "AP", refId: lineId, deltaFils: -amountFils },
    ],
  });
}

function buildQ8(input: LedgerEntryBuildInput): BuiltLedgerEntry {
  const { boxId, category, amountFils, effectiveOn } = requireType(input, "Q8");
  requirePositive("Q8", amountFils);
  return finishEntry({
    entryType: "Q8",
    effectiveOn,
    postings: [
      { account: "BOX", refId: boxId, deltaFils: -amountFils },
      { account: "EXP", category, deltaFils: amountFils },
    ],
  });
}

function buildQ9(input: LedgerEntryBuildInput): BuiltLedgerEntry {
  const { lineId, category, amountFils, effectiveOn } = requireType(input, "Q9");
  requirePositive("Q9", amountFils);
  return finishEntry({
    entryType: "Q9",
    effectiveOn,
    postings: [
      { account: "AP", refId: lineId, deltaFils: amountFils },
      { account: "EXP", category, deltaFils: amountFils },
    ],
  });
}

function buildQ10(input: LedgerEntryBuildInput): BuiltLedgerEntry {
  const { boxId, amountFils, effectiveOn } = requireType(input, "Q10");
  requirePositive("Q10", amountFils);
  return finishEntry({
    entryType: "Q10",
    effectiveOn,
    postings: [
      { account: "BOX", refId: boxId, deltaFils: amountFils },
      { account: "OWN_IN", deltaFils: amountFils },
    ],
  });
}

function buildQ11(input: LedgerEntryBuildInput): BuiltLedgerEntry {
  const { boxId, lineId, amountFils, effectiveOn } = requireType(input, "Q11");
  requirePositive("Q11", amountFils);
  return finishEntry({
    entryType: "Q11",
    effectiveOn,
    postings: [
      { account: "BOX", refId: boxId, deltaFils: amountFils },
      { account: "AP", refId: lineId, deltaFils: amountFils },
    ],
  });
}

function buildQ12(input: LedgerEntryBuildInput): BuiltLedgerEntry {
  const { boxId, amountFils, effectiveOn } = requireType(input, "Q12");
  requirePositive("Q12", amountFils);
  return finishEntry({
    entryType: "Q12",
    effectiveOn,
    postings: [
      { account: "BOX", refId: boxId, deltaFils: -amountFils },
      { account: "OWN_OUT", deltaFils: amountFils },
    ],
  });
}

function buildQ13(input: LedgerEntryBuildInput): BuiltLedgerEntry {
  const { boxId, lineId, amountFils, effectiveOn } = requireType(input, "Q13");
  requirePositive("Q13", amountFils);
  return finishEntry({
    entryType: "Q13",
    effectiveOn,
    postings: [
      { account: "BOX", refId: boxId, deltaFils: -amountFils },
      { account: "AR", refId: lineId, deltaFils: amountFils },
    ],
  });
}

function buildQ14(input: LedgerEntryBuildInput): BuiltLedgerEntry {
  const { fromBoxId, toBoxId, amountFils, effectiveOn } = requireType(input, "Q14");
  requirePositive("Q14", amountFils);
  return finishEntry({
    entryType: "Q14",
    effectiveOn,
    postings: [
      { account: "BOX", refId: fromBoxId, deltaFils: -amountFils },
      { account: "BOX", refId: toBoxId, deltaFils: amountFils },
    ],
  });
}

function buildQ18(input: LedgerEntryBuildInput): BuiltLedgerEntry {
  const { boxId, saleId, excessFils, effectiveOn } = requireType(input, "Q18");
  requirePositive("Q18", excessFils);
  return finishEntry({
    entryType: "Q18",
    effectiveOn,
    postings: [
      { account: "BOX", refId: boxId, deltaFils: excessFils },
      { account: "REV", refId: saleId, revKind: "overpayment", deltaFils: excessFils },
    ],
  });
}

function buildQ19(input: LedgerEntryBuildInput): BuiltLedgerEntry {
  const { boxId, differenceFils, effectiveOn } = requireType(input, "Q19");
  if (differenceFils === 0) {
    throw new Error("فرق تسوية المطابقة (Q19) يجب أن يكون ≠ 0 بالفلس — §4: diff ≠ 0 مُوقَّعًا.");
  }
  return finishEntry({
    entryType: "Q19",
    effectiveOn,
    postings: [
      { account: "BOX", refId: boxId, deltaFils: differenceFils },
      { account: "UNEXP", deltaFils: differenceFils },
    ],
  });
}

/** «مقدار موجب بالفلس» — نص §4: a، p، m، r، e موجبة ما لم يُذكر غير ذلك. */
function requirePositive(entryTypeId: string, amount: MoneyFils): void {
  if (!(amount > 0)) {
    throw new Error(
      `مقدار ${entryTypeId} يجب أن يكون عددًا موجبًا بالفلس (§4: المقادير موجبة ما لم يُذكر غير ذلك) — وُجد ${amount}.`,
    );
  }
}

/** خريطة البناة — الأنواع العشرون كاملة (اكتمال الأنواع مفروض نوعيًا). */
const ENTRY_BUILDERS: Readonly<
  Record<LedgerEntryTypeId, (input: LedgerEntryBuildInput) => BuiltLedgerEntry>
> = {
  Q1: buildQ1,
  Q2: buildQ2,
  Q3: buildQ3,
  Q4: buildQ4,
  Q5: buildQ5,
  Q6: buildQ6,
  Q7: buildQ7,
  Q8: buildQ8,
  Q9: buildQ9,
  Q10: buildQ10,
  Q11: buildQ11,
  Q12: buildQ12,
  Q13: buildQ13,
  Q14: buildQ14,
  Q15: buildQ15,
  Q16: buildQ16,
  Q17: buildQ17,
  Q18: buildQ18,
  Q19: buildQ19,
  Q20: buildReversalEntry,
};

/**
 * الدالة الواحدة: تبني قيدًا من مدخل مميَّز النوع وتتحقق منه قبل إعادته —
 * ترفض النوع المجهول (حرس تشغيلي للمداخل غير المُدقَّقة) وكل ما يرفضه
 * التحقق (الحساب غير المسموح، الإشارة المخالفة، المجموع غير الصافي،
 * عكس العكس…) — لا قيد يعود بلا فحص.
 */
export function buildLedgerEntry(input: LedgerEntryBuildInput): BuiltLedgerEntry {
  if (!isLedgerEntryTypeId(input.type)) {
    throw new Error(`نوع قيد مجهول: «${input.type}» — أنواع القيود هي Q1–Q20 حصرًا (§4).`);
  }
  return ENTRY_BUILDERS[input.type](input);
}
