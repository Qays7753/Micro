/**
 * M2.2 (§3.8 + §9/INV-10 — مانج-في₂، الموجة E): معادلة التوازن لكل قيد —
 * `ΣBOX + ΣAR − ΣAP − ΣPRE = ΣOPEN + ΣOWN_IN − ΣOWN_OUT + ΣREV − ΣEXP + ΣUNEXP`
 * على ترحيلات القيد الواحد (§3.8 «قاعدة توازن القيد، مفروضة عند الكتابة»).
 *
 * هذا هو المكان الذي أوَلت إليه M2.1 فرض المعادلة (بندها الهارب: «otherwise
 * in M2.2 with a test proving the database rejects a bad entry»): التجميع
 * عبر صفوف القيد لا يعبَّر عنه بقيد إعلاني في القاعدة، فيُرفض القيد السيئ
 * هنا — في المجال الصرف — قبل أي وصول إلى القاعدة، بجمع صحيح خالص عبر
 * دوال الفلس (فشل مغلق عند الفائض).
 */
import { addFils } from "../money/fils.js";
import type { MoneyFils } from "../money/types.js";
import type { LedgerAccountId, LedgerPosting } from "./types.js";

/**
 * معامل كل حساب في المعادلة (حرفيًا من §3.8): الفرق المحسوب = (الطرف الأيسر)
 * − (الطرف الأيمن)، أي ΣBOX + ΣAR − ΣAP − ΣPRE − ΣOPEN − ΣOWN_IN + ΣOWN_OUT
 * − ΣREV + ΣEXP − ΣUNEXP — فحسابات الطرف الأيمن تدخل بإشارة معكوسة.
 */
const EQUATION_COEFFICIENTS: Readonly<Record<LedgerAccountId, 1 | -1>> = {
  BOX: 1,
  AR: 1,
  AP: -1,
  PRE: -1,
  OPEN: -1,
  OWN_IN: -1,
  OWN_OUT: 1,
  REV: -1,
  EXP: 1,
  UNEXP: -1,
};

/**
 * فرق معادلة التوازن لترحيلات قيد واحد (§3.8/INV-10): صفر = قيد متوازن،
 * وكل ما عداه قيد مرفوض. جمع صحيح خالص بدوال الفلس (فشل مغلق)؛ لا تقريب
 * ولا قسمة هنا أصلًا — جمع إشارات فقط.
 */
export function entryBalanceDifferenceFils(postings: readonly LedgerPosting[]): MoneyFils {
  let difference: MoneyFils = 0;
  for (const posting of postings) {
    difference = addFils(
      difference,
      EQUATION_COEFFICIENTS[posting.account] > 0 ? posting.deltaFils : -posting.deltaFils,
    );
  }
  return difference;
}
