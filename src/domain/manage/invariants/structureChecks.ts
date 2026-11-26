/**
 * M2.3 (§9/INV-4 وINV-5 وINV-6 — مانج-في₂، الموجة E): الفحوص البنيوية فوق
 * حالة دفتر واحدة:
 *  - INV-4: الدفتر append-only والقيد مع عكسه يتصفّيان على كل حساب —
 *    فرض append-only على مستوى القاعدة هو حارسَي الهجرة 0018 (M2.1)؛ فحص
 *    الحالة هنا يثبت عقد العكس: كل Q20 يعكس قيدًا موجودًا غير عكسٍ، ومرآته
 *    بالضبط (كل ترحيلات المعكوس بإشارة معكوسة — فمجموعهما صفر على كل
 *    حساب)، ولا قيد يُعكس مرتين. أما «لا تعديل ولا حذف عبر الزمن» فتثبته
 *    فحوص الانتقال (INV-7/8/9) بمقارنة القيود السابقة.
 *  - INV-5: الأنواع المحايدة Q1,Q2,Q3,Q4,Q6,Q7,Q10,Q11,Q12,Q13,Q14,Q19
 *    وجزء الاسترداد في Q15 لا تغيّر صافي الربح — أي لا ترحّل إلى REV أو
 *    EXP (حسابا صافي الربح: صافي المبيعات − المصروفات)، وتعديلات المنتج
 *    والمتتبّع ليست عمليات أصلًا فلا نوع لها في السجل المغلق (§3.3/§5
 *    OP-TRACKER-*: بلا أثر دفتري) — وكل قيد بنوع مجهول خرقٌ يُسمّى.
 *  - INV-6: الكلفة/الربح المتوقعان لا يُرحَّلان إلى REV/EXP — فترحيلات
 *    REV/EXP لا تكون إلا من الأنواع التي تحققها §4 (ولها ولعكساتها)،
 *    بفئة من تعداد R-10 ونوع إيراد من تعداد §3.8 حصرًا: لا فئة «متوقعة»
 *    ولا نوع «متوقع» زائف يدخل الحسابين.
 * الفحوص الثلاثة تبدأ بسلامة الترحيلات فشلًا مغلقًا.
 */
import { isExpenseCategory, isRevenueKind } from "../ledger/accounts.js";
import { isLedgerEntryTypeId } from "../ledger/registry.js";
import {
  entryPostingIntegrityViolations,
  postingComparisonKey,
  postingIntegrityViolations,
} from "./aggregate.js";
import type { InvariantCheckResult, InvariantEntry, InvariantId, LedgerCheckState } from "./types.js";

function pass(id: InvariantId): InvariantCheckResult {
  return { invariantId: id, outcome: "pass" };
}

function violation(id: InvariantId, violations: string[]): InvariantCheckResult {
  return { invariantId: id, outcome: "violation", violations };
}

/** خريطة القيود بالمعرّف (للبحث عن المعكوس). */
function entryById(state: LedgerCheckState): Map<string, InvariantEntry> {
  return new Map(state.entries.map(entry => [entry.id, entry]));
}

/** عدد تكرارات القيم في خريطة كمية (لمقارنة المجموعات متعددة العناصر). */
function countMap(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

/** مفتاح ترحيل معكوس: نفس الحقول بمقدار معكوس الإشارة (مرآة §4 Q20). */
function mirroredPostingKey(key: string): string {
  const parts = key.split("|");
  parts[4] = String(-Number(parts[4]));
  return parts.join("|");
}

/** فروق المرآة: ترحيلات المعكوس بإشارة معكوسة كمجموعة كمية متساوية. */
function mirrorMismatchViolations(reversal: InvariantEntry, reversed: InvariantEntry): string[] {
  const expected = countMap(reversed.postings.map(postingComparisonKey));
  const actual = countMap(reversal.postings.map(p => mirroredPostingKey(postingComparisonKey(p))));
  const mismatched: string[] = [];
  for (const [key, count] of expected) {
    const actualCount = actual.get(key) ?? 0;
    if (actualCount !== count) {
      mismatched.push(`يتوقع ${count} × ترحيل «${key.replace("|", " / ")}» ويجد ${actualCount}`);
    }
  }
  for (const [key, count] of actual) {
    if (!expected.has(key) && count > 0) {
      mismatched.push(`ترحيل دخيل «${key.replace("|", " / ")}» ليس في مرآة الأصل`);
    }
  }
  if (mismatched.length === 0) {
    return [];
  }
  return [
    `القيد «${reversal.id}» (Q20) ليس مرآة معكوسة بالضبط للقيد «${reversed.id}» — القيد وعكسه يجب أن يتصفّيا على كل حساب (§9 INV-4): ${mismatched.join("؛ ")}.`,
  ];
}

/** عقد القيد العاكس: هدف واجب موجود غير عكسٍ (يُحصى الهدف للفحص المزدوج). */
function reversalContractViolations(
  reversal: InvariantEntry,
  byId: Map<string, InvariantEntry>,
  targetCounts: Map<string, number>,
): string[] {
  const targetId = reversal.reversesEntryId;
  if (targetId === undefined || targetId === "") {
    return [`القيد «${reversal.id}»: Q20 بلا reverses_entry_id — §3.8 يوجبه على Q20 حصرًا وبالعكس.`];
  }
  targetCounts.set(targetId, (targetCounts.get(targetId) ?? 0) + 1);
  const reversed = byId.get(targetId);
  if (reversed === undefined) {
    return [`القيد «${reversal.id}» (Q20) يعكس قيدًا غير موجود «${targetId}» — مرآة قيد غائب خرق للعقد.`];
  }
  if (reversed.entryType === "Q20") {
    return [
      `القيد «${reversal.id}» (Q20) يعكس عكسًا «${reversed.id}» — عكس العكس ممنوع (E-REVERSE-REVERSAL، §5 OP-CANCEL-OPERATION).`,
    ];
  }
  return mirrorMismatchViolations(reversal, reversed);
}

/** INV-4: عقد العكس — قيد مع عكسه يتصفّيان على كل حساب، وعكس واحد لكل قيد. */
export function checkInv4(state: LedgerCheckState): InvariantCheckResult {
  const integrity = postingIntegrityViolations(state);
  if (integrity.length > 0) {
    return violation("INV-4", integrity);
  }
  const byId = entryById(state);
  const targetCounts = new Map<string, number>();
  const violations: string[] = [];
  for (const entry of state.entries) {
    if (entry.entryType !== "Q20") {
      continue;
    }
    violations.push(...reversalContractViolations(entry, byId, targetCounts));
  }
  for (const [targetId, count] of targetCounts) {
    if (count > 1) {
      violations.push(`القيد «${targetId}» معكوس أكثر من مرة (${count} مرايا) — قيد واحد عكس واحد.`);
    }
  }
  return violations.length > 0 ? violation("INV-4", violations) : pass("INV-4");
}

/** الأنواع المحايدة لصافي الربح حرفيًا من §9/INV-5. */
const PROFIT_NEUTRAL_TYPES: ReadonlySet<string> = new Set([
  "Q1",
  "Q2",
  "Q3",
  "Q4",
  "Q6",
  "Q7",
  "Q10",
  "Q11",
  "Q12",
  "Q13",
  "Q14",
  "Q19",
]);

/** الأنواع التي ترحّل REV حرفيًا من ترحيلات §4 (وعكساتها مراياها). */
const REV_REALIZING_TYPES: ReadonlySet<string> = new Set(["Q5", "Q15", "Q16", "Q17", "Q18"]);

/** الأنواع التي ترحّل EXP حرفيًا من ترحيلات §4 (وعكساتها مراياها). */
const EXP_REALIZING_TYPES: ReadonlySet<string> = new Set(["Q8", "Q9"]);

/** خرق ترحيل الربح لنوع محايد: لا REV ولا EXP أبدًا. */
function profitPostingViolations(entry: InvariantEntry): string[] {
  const violations: string[] = [];
  for (const posting of entry.postings) {
    if (posting.account === "REV" || posting.account === "EXP") {
      violations.push(
        `القيد «${entry.id}» (النوع ${entry.entryType}) يرحّل إلى ${posting.account} — هذا النوع لا يغيّر صافي الربح (§9 INV-5).`,
      );
    }
  }
  return violations;
}

/** خرق ترحيل الربح في Q15: لا EXP، ولا REV إلا الجزء المحتفَظ به. */
function q15ProfitPostingViolations(entry: InvariantEntry): string[] {
  const violations: string[] = [];
  for (const posting of entry.postings) {
    if (posting.account === "EXP") {
      violations.push(
        `القيد «${entry.id}» (Q15) يرحّل إلى EXP — حتى جزء الاسترداد لا يغيّر صافي الربح (§9 INV-5).`,
      );
    }
    if (posting.account === "REV" && posting.revKind !== "kept_prepayment") {
      violations.push(
        `القيد «${entry.id}» (Q15) يرحّل REV بنوع «${posting.revKind ?? "بلا نوع"}» — لا REV في Q15 إلا الجزء المحتفَظ به (kept_prepayment)، وجزء الاسترداد يرحّل BOX/AP حصرًا (§4/§9 INV-5).`,
      );
    }
  }
  return violations;
}

/** أثر Q20 على الربح مرآة أثر معكوسه: محايد لمحايد وقواعد Q15 لقواعدها. */
function q20NeutralityViolations(entry: InvariantEntry, byId: Map<string, InvariantEntry>): string[] {
  const reversed = entry.reversesEntryId === undefined ? undefined : byId.get(entry.reversesEntryId);
  if (reversed === undefined) {
    return [
      `القيد «${entry.id}» (Q20) يعكس قيدًا غير موجود «${entry.reversesEntryId ?? ""}» — لا يُصنَّف أثره على الربح (رفض مغلق).`,
    ];
  }
  if (PROFIT_NEUTRAL_TYPES.has(reversed.entryType)) {
    return profitPostingViolations(entry);
  }
  if (reversed.entryType === "Q15") {
    return q15ProfitPostingViolations(entry);
  }
  return [];
}

/** خرق حياد الربح لقيد واحد بحسب نوعه (وتصنيف Q20 بمعكوسه). */
function profitNeutralityViolations(entry: InvariantEntry, byId: Map<string, InvariantEntry>): string[] {
  if (!isLedgerEntryTypeId(entry.entryType)) {
    return [
      `القيد «${entry.id}» بنوع مجهول «${entry.entryType}» — السجل المغلق Q1–Q20 هو المقياس (§4)، ولا نوع فيه لتعديل منتج أو متتبّع (§3.3/§5 OP-TRACKER-*: بلا أثر دفتري).`,
    ];
  }
  if (PROFIT_NEUTRAL_TYPES.has(entry.entryType)) {
    return profitPostingViolations(entry);
  }
  if (entry.entryType === "Q15") {
    return q15ProfitPostingViolations(entry);
  }
  if (entry.entryType === "Q20") {
    return q20NeutralityViolations(entry, byId);
  }
  return [];
}

/** INV-5: الأنواع المحايدة وجزء الاسترداد في Q15 لا ترحّل REV/EXP أبدًا. */
export function checkInv5(state: LedgerCheckState): InvariantCheckResult {
  const integrity = postingIntegrityViolations(state);
  if (integrity.length > 0) {
    return violation("INV-5", integrity);
  }
  const byId = entryById(state);
  const violations: string[] = [];
  for (const entry of state.entries) {
    violations.push(...profitNeutralityViolations(entry, byId));
  }
  return violations.length > 0 ? violation("INV-5", violations) : pass("INV-5");
}

/** خرق تحقيق النوع لقيد غير Q20: REV من أنواع الإيراد وEXP من أنواع المصروف بتعداداتها الحقيقية. */
function realizationViolations(entry: InvariantEntry): string[] {
  const violations: string[] = [];
  for (const posting of entry.postings) {
    if (posting.account === "REV") {
      if (!REV_REALIZING_TYPES.has(entry.entryType)) {
        violations.push(
          `القيد «${entry.id}» (النوع ${entry.entryType}) يرحّل REV — لا إيراد إلا من أنواع التحقيق (Q5/Q15/Q16/Q17/Q18، §4) — المتوقَّع لا يُرحَّل (§9 INV-6).`,
        );
      }
      if (!isRevenueKind(posting.revKind ?? "")) {
        violations.push(
          `القيد «${entry.id}»: ترحيل REV بنوع «${posting.revKind ?? "بلا نوع"}» خارج تعداد §3.8 — لا نوع إيراد «متوقعًا» يدخل الحساب (§9 INV-6).`,
        );
      }
    }
    if (posting.account === "EXP") {
      if (!EXP_REALIZING_TYPES.has(entry.entryType)) {
        violations.push(
          `القيد «${entry.id}» (النوع ${entry.entryType}) يرحّل EXP — لا مصروف إلا من أنواع التحقيق (Q8/Q9، §4) — الكلفة المتوقعة لا تُرحَّل (§9 INV-6).`,
        );
      }
      if (!isExpenseCategory(posting.category ?? "")) {
        violations.push(
          `القيد «${entry.id}»: ترحيل EXP بفئة «${posting.category ?? "بلا فئة"}» خارج تعداد R-10 — لا فئة مصروف «متوقعة» تدخل الحساب (§9 INV-6).`,
        );
      }
    }
  }
  return violations;
}

/** خرق تحقيق Q20: يُقيَّد بأصل معكوسه لا بنوعه هو (مرآة الأصل). */
function realizationViolationsForQ20(
  entry: InvariantEntry,
  reversedId: string,
  reversedType: string,
): string[] {
  const violations: string[] = [];
  for (const posting of entry.postings) {
    if (posting.account === "REV") {
      if (!REV_REALIZING_TYPES.has(reversedType)) {
        violations.push(
          `القيد «${entry.id}» (Q20 عاكس «${reversedId}»/${reversedType}) يرحّل REV — لا إيراد إلا بمرآة أنواع التحقيق (§9 INV-6).`,
        );
      }
      if (!isRevenueKind(posting.revKind ?? "")) {
        violations.push(
          `القيد «${entry.id}»: ترحيل REV بنوع «${posting.revKind ?? "بلا نوع"}» خارج تعداد §3.8 — لا نوع إيراد «متوقعًا» يدخل الحساب (§9 INV-6).`,
        );
      }
    }
    if (posting.account === "EXP") {
      if (!EXP_REALIZING_TYPES.has(reversedType)) {
        violations.push(
          `القيد «${entry.id}» (Q20 عاكس «${reversedId}»/${reversedType}) يرحّل EXP — لا مصروف إلا بمرآة أنواع التحقيق (§9 INV-6).`,
        );
      }
      if (!isExpenseCategory(posting.category ?? "")) {
        violations.push(
          `القيد «${entry.id}»: ترحيل EXP بفئة «${posting.category ?? "بلا فئة"}» خارج تعداد R-10 — لا فئة مصروف «متوقعة» تدخل الحساب (§9 INV-6).`,
        );
      }
    }
  }
  return violations;
}

/** INV-6: المتوقَّع لا يُرحَّل إلى REV/EXP — لا إلا من أنواع §4 المحققة بفئاتها الحقيقية. */
export function checkInv6(state: LedgerCheckState): InvariantCheckResult {
  const integrity = postingIntegrityViolations(state);
  if (integrity.length > 0) {
    return violation("INV-6", integrity);
  }
  const byId = entryById(state);
  const violations: string[] = [];
  for (const entry of state.entries) {
    if (entry.entryType !== "Q20") {
      violations.push(...realizationViolations(entry));
      continue;
    }
    const reversed = entry.reversesEntryId === undefined ? undefined : byId.get(entry.reversesEntryId);
    if (reversed === undefined) {
      violations.push(
        `القيد «${entry.id}» (Q20) يعكس قيدًا غير موجود «${entry.reversesEntryId ?? ""}» — لا يُعرف مصدر ترحيلاته (رفض مغلق).`,
      );
      continue;
    }
    violations.push(...realizationViolationsForQ20(entry, reversed.id, reversed.entryType));
  }
  return violations.length > 0 ? violation("INV-6", violations) : pass("INV-6");
}
