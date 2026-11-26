/**
 * M2.2 (§4 — مانج-في₂، الموجة E): بناة الأنواع المركّبة الأربعة التي يفصّلها
 * §4 تحت جدوله: Q5 (التسليم)، Q15 (الإلغاء مع دفعات مقدمة)، Q16 (الإرجاع)،
 * Q17 (الشطب) — ترحيلاتها مشروطة بمدخلات تمررها طبقة العمليات (الدفعات
 * المقدمة القائمة، المستحق القائم، نوع السطر، اختيار الاسترداد).
 *
 * لا شيء هنا يحسب شكلًا من §8/§8.2: قيم الحالة (المستحق القائم لسطر الباقي
 * مثلًا) تدخل مدخلات محسوبةً من خارج الموديول، وx = min(r, outstanding)
 * وقسمة الاسترداد (الآن/لاحقًا) هما نصّ §4 نفسه لترحيلات Q16، وقسمة §4
 * نفسها لترحيلات Q15 — لا جمع §8 ولا نسبة فيهما.
 */
import { subFils } from "../money/fils.js";
import type { MoneyFils } from "../money/types.js";
import { finishEntry, nonEmptyRef, requireType } from "./buildSupport.js";
import type { BuiltLedgerEntry, LedgerEntryBuildInput, LedgerPosting, LedgerRefundChoice } from "./types.js";

/** فحص ملاءمة اختيار الاسترداد للباقي المسترد (Q15/Q16 — §4): الباقي > 0 يتطلب «الآن/لاحقًا» بمرجعه الصحيح، والباقي 0 يتطلب «لا شيء». */
function requireRefundChoice(refundFils: MoneyFils, refund: LedgerRefundChoice): void {
  if (refundFils > 0) {
    if (refund.mode === "none") {
      throw new Error(
        "الباقي المسترد أكبر من صفر — يتطلب §4 اختيارًا: استرداد الآن أو لاحقًا (سطر customer_refund).",
      );
    }
    if (refund.mode === "now" && !nonEmptyRef(refund.boxId)) {
      throw new Error("استرداد «الآن» يتطلب معرّف الصندوق (box_id) — §4.");
    }
    if (refund.mode === "later" && !nonEmptyRef(refund.lineId)) {
      throw new Error("استرداد «لاحقًا» يتطلب معرّف سطر customer_refund الجديد (line_id) — §4.");
    }
  } else if (refund.mode !== "none") {
    throw new Error("الباقي المسترد صفر — لا استرداد ولا اختيار استرداد (يجب أن يكون «لا شيء») — §4.");
  }
}

/** Q5 — التسليم (§4): REV[s] +P ثم PRE[s] −p (إن p>0)، وسطر الباقي أو الاسترداد حسب فرق السعر والعربون. */
export function buildQ5(input: LedgerEntryBuildInput): BuiltLedgerEntry {
  const { saleId, priceFils, prepaymentFils, effectiveOn, remainderLineId, refundLineId } = requireType(
    input,
    "Q5",
  );
  if (!(priceFils > 0)) {
    throw new Error(`سعر التسليم النهائي (Q5) يجب أن يكون موجبًا بالفلس (§3.4) — وُجد ${priceFils}.`);
  }
  if (prepaymentFils < 0) {
    throw new Error(`العربون القائم (Q5) لا يجوز أن يكون سالبًا — وُجد ${prepaymentFils}.`);
  }
  const postings: LedgerPosting[] = [
    { account: "REV", refId: saleId, revKind: "delivery", deltaFils: priceFils },
  ];
  if (prepaymentFils > 0) {
    postings.push({ account: "PRE", refId: saleId, deltaFils: -prepaymentFils });
  }
  if (priceFils > prepaymentFils) {
    if (!nonEmptyRef(remainderLineId)) {
      throw new Error("السعر أكبر من العربون — يتطلب §4 معرّف سطر sale_remainder الجديد (remainderLineId).");
    }
    postings.push({
      account: "AR",
      refId: remainderLineId,
      deltaFils: subFils(priceFils, prepaymentFils),
    });
  }
  if (prepaymentFils > priceFils) {
    if (!nonEmptyRef(refundLineId)) {
      throw new Error("العربون أكبر من السعر — يتطلب §4 معرّف سطر customer_refund الجديد (refundLineId).");
    }
    postings.push({
      account: "AP",
      refId: refundLineId,
      deltaFils: subFils(prepaymentFils, priceFils),
    });
  }
  return finishEntry({ entryType: "Q5", effectiveOn, postings });
}

/** Q15 — الإلغاء مع دفعات مقدمة (§4): p = PRE[s]، m محتفَظ به، r = p − m يُسترد الآن أو لاحقًا. */
export function buildQ15(input: LedgerEntryBuildInput): BuiltLedgerEntry {
  const { saleId, prepaymentFils, keptFils, refund, effectiveOn } = requireType(input, "Q15");
  if (prepaymentFils < 0) {
    throw new Error(`العربون القائم (Q15) لا يجوز أن يكون سالبًا — وُجد ${prepaymentFils}.`);
  }
  if (keptFils < 0 || keptFils > prepaymentFils) {
    throw new Error(
      `المحتفَظ به (m) يجب أن يحقق 0 ≤ m ≤ p حيث p = ${prepaymentFils} (§4) — وُجد ${keptFils}.`,
    );
  }
  const refundFils = subFils(prepaymentFils, keptFils);
  requireRefundChoice(refundFils, refund);
  const postings: LedgerPosting[] = [];
  if (keptFils > 0) {
    postings.push({ account: "PRE", refId: saleId, deltaFils: -keptFils });
    postings.push({ account: "REV", refId: saleId, revKind: "kept_prepayment", deltaFils: keptFils });
  }
  if (refundFils > 0) {
    if (refund.mode === "now") {
      postings.push({ account: "BOX", refId: refund.boxId, deltaFils: -refundFils });
      postings.push({ account: "PRE", refId: saleId, deltaFils: -refundFils });
    } else if (refund.mode === "later") {
      postings.push({ account: "PRE", refId: saleId, deltaFils: -refundFils });
      postings.push({ account: "AP", refId: refund.lineId, deltaFils: refundFils });
    }
  }
  return finishEntry({ entryType: "Q15", effectiveOn, postings });
}

/** Q16 — الإرجاع (§4): x = min(r, outstanding لباقي البيع) يُخصم من السطر، والباقي y يُسترد الآن أو لاحقًا. */
export function buildQ16(input: LedgerEntryBuildInput): BuiltLedgerEntry {
  const { saleId, returnFils, remainderOutstandingFils, refund, effectiveOn, remainderLineId } = requireType(
    input,
    "Q16",
  );
  if (!(returnFils > 0)) {
    throw new Error(`مقدار الإرجاع (Q16) يجب أن يكون موجبًا بالفلس — وُجد ${returnFils}.`);
  }
  if (remainderOutstandingFils < 0) {
    throw new Error(`المستحق القائم لسطر الباقي لا يجوز أن يكون سالبًا — وُجد ${remainderOutstandingFils}.`);
  }
  const appliedFils = returnFils <= remainderOutstandingFils ? returnFils : remainderOutstandingFils;
  const refundFils = subFils(returnFils, appliedFils);
  requireRefundChoice(refundFils, refund);
  const postings: LedgerPosting[] = [
    { account: "REV", refId: saleId, revKind: "return", deltaFils: -returnFils },
  ];
  if (appliedFils > 0) {
    if (!nonEmptyRef(remainderLineId)) {
      throw new Error("خصم الإرجاع من سطر الباقي يتطلب معرّف السطر (remainderLineId) — §4.");
    }
    postings.push({ account: "AR", refId: remainderLineId, deltaFils: -appliedFils });
  }
  if (refundFils > 0) {
    if (refund.mode === "now") {
      postings.push({ account: "BOX", refId: refund.boxId, deltaFils: -refundFils });
    } else if (refund.mode === "later") {
      postings.push({ account: "AP", refId: refund.lineId, deltaFils: refundFils });
    }
  }
  return finishEntry({ entryType: "Q16", effectiveOn, postings });
}

/** أنواع أسطر الشطب الثلاثة المفتوحة على to_me (§4/§3.6) — حرس تشغيلي للمداخل غير المُدقَّقة. */
const WRITE_OFF_LINE_KINDS = ["sale_remainder", "prior_receivable", "loan_given"] as const;

/** Q17 — الشطب (§4): AR[L] −a ثم حسب نوع السطر — باقي بيع يخصم الإيراد، ومستحق سابق يخصم الافتتاح، وقرض يُحمل على سحوبات المالك. */
export function buildQ17(input: LedgerEntryBuildInput): BuiltLedgerEntry {
  const { lineId, lineKind, amountFils, effectiveOn, saleId } = requireType(input, "Q17");
  if (!(amountFils > 0)) {
    throw new Error(`مقدار الشطب (Q17) يجب أن يكون موجبًا بالفلس — وُجد ${amountFils}.`);
  }
  if (!(WRITE_OFF_LINE_KINDS as readonly string[]).includes(lineKind)) {
    throw new Error(
      `نوع سطر الشطب «${String(lineKind)}» مجهول — المسموح sale_remainder وprior_receivable وloan_given حصرًا (§4).`,
    );
  }
  const postings: LedgerPosting[] = [{ account: "AR", refId: lineId, deltaFils: -amountFils }];
  if (lineKind === "sale_remainder") {
    if (!nonEmptyRef(saleId)) {
      throw new Error("شطب باقي بيع يتطلب معرّف البيع (saleId) — سطر sale_remainder مربوط ببيعه (§3.6).");
    }
    postings.push({
      account: "REV",
      refId: saleId,
      revKind: "write_off",
      deltaFils: -amountFils,
    });
  } else {
    if (saleId !== undefined) {
      throw new Error(
        "saleId لا يُمرر إلا لشطب باقي بيع (sale_remainder) — أنواع السطور الأخرى غير مربوطة ببيع (§3.6).",
      );
    }
    postings.push(
      lineKind === "prior_receivable"
        ? { account: "OPEN", deltaFils: -amountFils }
        : { account: "OWN_OUT", deltaFils: amountFils },
    );
  }
  return finishEntry({ entryType: "Q17", effectiveOn, postings });
}
