/**
 * M2.2 (§4 + §3.8 + §9/INV-10 + §11 E-REVERSE-REVERSAL — مانج-في₂، الموجة
 * E): التحقق من قيد الدفتر — كل قواعد الرفض في مكان واحد، فشلًا مغلقًا.
 *
 * قواعد الرفض (اختبار سالب لكل واحدة منها في الاختبار):
 *  1. نوع مجهول خارج Q1–Q20 (السجل §4 هو المقياس الوحيد).
 *  2. تاريخ فارغ (§3.8: effective_on NOT NULL).
 *  3. ترحيل إلى حساب لا يسمح به النوع (قائمة الحسابات المسموحة للنوع).
 *  4. مخالفة قاعدة الإشارة للنوع على حساب معيّن (إشارات §4 الحرفية).
 *  5. مقدار صفري أو غير عدد صحيح آمن (§3.8: delta_minor ≠ 0 بالفلس الصحيح).
 *  6. شكل الترحيل حسب الحساب (§3.8 حرفيًا كما في قيد القاعدة 0018):
 *     ref_id واجب لـBOX/AR/AP/PRE، ممنوع لغير REV، اختياري لـREV؛
 *     category لـEXP حصرًا بتعداد R-10؛ rev_kind لـREV حصرًا بتعداده الخمسي.
 *  7. المعادلة §3.8 لا تساوي صفرًا على ترحيلات القيد (INV-10 — البند
 *     المؤجَّل من M2.1: القيد السيئ يُرفض هنا قبل الوصول إلى القاعدة).
 *  8. شكل العكس: reverses_entry_id على Q20 حصرًا وبالعكس (§3.8)؛ عكس العكس
 *     (Q20 على Q20) مرفوض بـE-REVERSE-REVERSAL (§5 OP-CANCEL-OPERATION)؛
 *     نوع المعكوس واجب ومعروف لكل Q20 (فشل مغلق).
 */
import { isExpenseCategory, isRevenueKind, LEDGER_ACCOUNT_SHAPES } from "./accounts.js";
import { entryBalanceDifferenceFils } from "./balanceRule.js";
import { isLedgerEntryTypeId, LEDGER_ENTRY_TYPES } from "./registry.js";
import type {
  LedgerEntryTypeId,
  LedgerEntryValidationInput,
  LedgerPosting,
  LedgerPostingSignRule,
} from "./types.js";

/** هل النص غير فارغ بعد التقليم؟ */
function nonEmpty(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** شكل مرجع الترحيل حسب حسابه (§3.8: BOX/AR/AP/PRE واجب، REV اختياري، البقية ممنوع). */
function validateRefIdShape(account: string, refId: string | undefined, rule: string): void {
  if (rule === "required" && !nonEmpty(refId)) {
    throw new Error(`ترحيل الحساب ${account} يتطلب مرجعًا (ref_id) غير فارغ — §3.8.`);
  }
  if (rule === "forbidden" && refId !== undefined) {
    throw new Error(`ترحيل الحساب ${account} لا يجوز أن يحمل مرجعًا (ref_id) — §3.8.`);
  }
}

/** شكل فئة المصروف: EXP حصرًا، بفئة واجبة من تعداد R-10 (§3.8/R-10). */
function validateCategoryShape(account: string, allowed: boolean, category: string | undefined): void {
  if (!allowed && category !== undefined) {
    throw new Error(`الفئة (category) لحساب ${account} ممنوعة — §3.8: الفئة لـEXP حصرًا.`);
  }
  if (allowed && category === undefined) {
    throw new Error(`ترحيل الحساب ${account} يتطلب فئة مصروف من تعداد R-10 — §3.8.`);
  }
  if (allowed && category !== undefined && !isExpenseCategory(category)) {
    throw new Error(`الفئة «${category}» خارج تعداد R-10 لفئات المصروف — §3.8/R-10.`);
  }
}

/** شكل نوع الإيراد: REV حصرًا، بنوع واجب من تعداده الخمسي (§3.8). */
function validateRevKindShape(account: string, allowed: boolean, revKind: string | undefined): void {
  if (!allowed && revKind !== undefined) {
    throw new Error(`نوع الإيراد (rev_kind) لحساب ${account} ممنوع — §3.8: rev_kind لـREV حصرًا.`);
  }
  if (allowed && revKind === undefined) {
    throw new Error(`ترحيل الحساب ${account} يتطلب نوع إيراد من تعداده الخمسي — §3.8.`);
  }
  if (allowed && revKind !== undefined && !isRevenueKind(revKind)) {
    throw new Error(`نوع الإيراد «${revKind}» خارج تعداده الخمسي — §3.8.`);
  }
}

/** شكل الترحيل الواحد حسب حسابه (القاعدة 6) — يرمي عند المخالفة. */
function validatePostingShape(posting: LedgerPosting): void {
  const shape = LEDGER_ACCOUNT_SHAPES[posting.account];
  validateRefIdShape(posting.account, posting.refId, shape.refId);
  validateCategoryShape(posting.account, shape.categoryAllowed, posting.category);
  validateRevKindShape(posting.account, shape.revKindAllowed, posting.revKind);
}

/** مطابقة إشارة ترحيل لقاعدة إشارة النوع (القاعدة 4). */
function signMatches(rule: LedgerPostingSignRule, deltaFils: number): boolean {
  if (rule === "positive") return deltaFils > 0;
  if (rule === "negative") return deltaFils < 0;
  return true;
}

/** شكل الترحيل الواحد مقابل نوع القيد: الحساب المسموح وإشارة §4 (القاعدتان 3 و4 و5). */
function validatePostingAgainstType(
  entryTypeId: LedgerEntryTypeId,
  spec: (typeof LEDGER_ENTRY_TYPES)[LedgerEntryTypeId],
  posting: LedgerPosting,
): void {
  if (!spec.allowedAccounts.includes(posting.account)) {
    throw new Error(
      `نوع القيد ${entryTypeId} لا يجوز أن يرحّل إلى الحساب ${posting.account} — حساباته المسموحة حصرًا: ${spec.allowedAccounts.join("، ")} (§4).`,
    );
  }
  if (!Number.isSafeInteger(posting.deltaFils)) {
    throw new Error(
      `مقدار الترحيل على ${posting.account} في ${entryTypeId} يجب أن يكون عددًا صحيحًا آمنًا بالفلس — §3.8.`,
    );
  }
  if (posting.deltaFils === 0) {
    throw new Error(`مقدار الترحيل على ${posting.account} في ${entryTypeId} لا يجوز أن يكون صفرًا — §3.8.`);
  }
  const signRule = spec.signRules[posting.account];
  if (signRule === undefined || !signMatches(signRule, posting.deltaFils)) {
    throw new Error(
      `إشارة ترحيل ${posting.account} في ${entryTypeId} تخالف قاعدة إشارة النوع (${signRule ?? "لا قاعدة"}) — §4.`,
    );
  }
}

/** شكل العكس (القاعدة 8) — يرمي عند المخالفة. */
function validateReversalShape(input: LedgerEntryValidationInput): void {
  if (input.entryType === "Q20") {
    if (input.reversesEntryId === undefined) {
      throw new Error("قيد Q20 (عكس) يتطلب reverses_entry_id للقيد المعكوس — §3.8.");
    }
    if (input.reversedEntryType === undefined) {
      throw new Error(
        "قيد Q20 (عكس) يتطلب نوع القيد المعكوس (reversedEntryType) للتحقق — فشل مغلق، لا تحقق بلا دليل.",
      );
    }
    if (!isLedgerEntryTypeId(input.reversedEntryType)) {
      throw new Error(`نوع القيد المعكوس «${input.reversedEntryType}» مجهول — المسموح Q1–Q19 حصرًا (§4).`);
    }
    if (input.reversedEntryType === "Q20") {
      throw new Error(
        "لا يمكن عكس قيد هو نفسه عكس (Q20 على Q20) — E-REVERSE-REVERSAL (§5 OP-CANCEL-OPERATION).",
      );
    }
  } else if (input.reversesEntryId !== undefined) {
    throw new Error(`reverses_entry_id على ${input.entryType} ممنوع — §3.8: عمود العكس على Q20 حصرًا.`);
  }
}

/**
 * التحقق الكامل من قيد (المدخل الخام أو ناتج الباني): يرمي عند أول مخالفة،
 * ويعود صامتًا إذا كان القيد سليمًا على القواعد الثماني كلها أعلاه.
 */
export function validateLedgerEntry(input: LedgerEntryValidationInput): void {
  if (!isLedgerEntryTypeId(input.entryType)) {
    throw new Error(`نوع قيد مجهول: «${input.entryType}» — أنواع القيود هي Q1–Q20 حصرًا (§4).`);
  }
  if (!nonEmpty(input.effectiveOn)) {
    throw new Error("تاريخ القيد (effective_on) واجب غير فارغ — §3.8.");
  }
  const spec = LEDGER_ENTRY_TYPES[input.entryType];
  validateReversalShape(input);
  for (const posting of input.postings) {
    validatePostingAgainstType(input.entryType, spec, posting);
    validatePostingShape(posting);
  }
  const difference = entryBalanceDifferenceFils(input.postings);
  if (difference !== 0) {
    throw new Error(
      `ترحيلات القيد ${input.entryType} لا تتصفّى على معادلة التوازن §3.8 — الفرق ${difference} فلسًا؛ القيد السيئ يُرفض قبل الوصول إلى القاعدة (INV-10).`,
    );
  }
}
