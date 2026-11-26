/**
 * M2.3 (§9/INV-1–INV-3 + §3.8/§3.11 + §8 — مانج-في₂، الموجة E): التجميعات
 * الصرفة المشتركة لفحوص الثوابت — سلامة الترحيلات قبل أي حساب، ثم مجاميع
 * الحسابات وضلعي معادلة INV-1 والمستحقات والعربون وأرصدة الصناديق.
 *
 * حدود موثّقة (لا اجتهاد صامت):
 *  - ضلعا INV-1 هما معادلتا §8 لصافي الثروة ومصادره بنص المهمة نفسها
 *    («INV-1 = صافي الثروة = مصادره»): تنفيذهما هنا هو وجه التأكيد
 *    للمعادلة، وموديول القراءة (M2.11) يبقى التنفيذ الوحيد لعرض الأشكال.
 *    اشتقاق الربح «منذ البداية» = صافي المبيعات − المصروفات = Σ REV (كل
 *    الأنواع) − Σ EXP — لأن المبيعات تطرح المرتجعات والخصومات (§8) فتجمع
 *    REV كلها بإشاراتها.
 *  - فحص سلامة الترحيلات (حساب معروف، مقدار صحيح آمن، مرجع واجب لـ
 *    BOX/AR/AP/PRE حسب §3.8) هو مقدمة كل فحص رقمي — فشلًا مغلقًا: الحالة
 *    المفسدة تُرفض بالتسمية لا أن تُحسب بصمت. المقدار الصفري شكلٌ تملكه
 *    الكتابة (§3.8 + قيد القاعدة 0018 — M2.2/M2.1)، لا يغيّر مجموعًا فهو
 *    خارج المعادلات هنا.
 *  - مرجع BOX (صندوق معروف) ملك قيد القاعدة (FK في 0018) — لا ثابت من
 *    العشرة يحتاجه، فلا يُفحص هنا.
 */
import { addFils, subFils } from "../money/fils.js";
import { LEDGER_ACCOUNTS } from "../ledger/accounts.js";
import type { LedgerAccountId } from "../ledger/types.js";
import type { InvariantEntry, InvariantPosting, LedgerCheckState } from "./types.js";

/** الحسابات التي يوجب §3.8 لها مرجعًا (ref_id) في كل ترحيل. */
const REF_ID_REQUIRED_ACCOUNTS: ReadonlySet<string> = new Set(["BOX", "AR", "AP", "PRE"]);

/** هل الحساب من العشرة حرفيًا من §3.8؟ */
function isLedgerAccount(account: string): boolean {
  return (LEDGER_ACCOUNTS as readonly string[]).includes(account);
}

/** كل ترحيل غير قابل للثقة به في قيد: حساب مجهول، أو مقدار غير صحيح آمن، أو مرجع واجب مفقود. */
export function entryPostingIntegrityViolations(entry: InvariantEntry): string[] {
  const violations: string[] = [];
  for (const posting of entry.postings) {
    if (!isLedgerAccount(posting.account)) {
      violations.push(
        `القيد «${entry.id}» (النوع ${entry.entryType}): ترحيل إلى حساب مجهول «${posting.account}» — الحسابات العشرة (§3.8) هي وحدها القابلة للحساب.`,
      );
    }
    if (!Number.isSafeInteger(posting.deltaFils)) {
      violations.push(
        `القيد «${entry.id}»: مقدار الترحيل (${posting.account}) ليس عددًا صحيحًا آمنًا بالفلس — الحالة مفسدة قبل أي جمع.`,
      );
    }
    if (
      REF_ID_REQUIRED_ACCOUNTS.has(posting.account) &&
      (posting.refId === undefined || posting.refId === "")
    ) {
      violations.push(
        `القيد «${entry.id}»: ترحيل ${posting.account} بلا مرجع (ref_id) — §3.8 يوجب المرجع لهذا الحساب.`,
      );
    }
  }
  return violations;
}

/** فحص سلامة ترحيلات الحالة كلها (مقدمة كل فحص رقمي — فشل مغلق). */
export function postingIntegrityViolations(state: LedgerCheckState): string[] {
  return state.entries.flatMap(entryPostingIntegrityViolations);
}

/** مجاميع الحسابات العشرة من كل الترحيلات (القيد وعكسه كلاهما يُحتسب — §8: المرآة تُصفّر الأصل). */
export function accountTotalsFils(state: LedgerCheckState): Record<LedgerAccountId, number> {
  const totals = Object.fromEntries(LEDGER_ACCOUNTS.map(a => [a, 0])) as Record<LedgerAccountId, number>;
  for (const entry of state.entries) {
    for (const posting of entry.postings) {
      totals[posting.account as LedgerAccountId] = addFils(
        totals[posting.account as LedgerAccountId],
        posting.deltaFils,
      );
    }
  }
  return totals;
}

/**
 * صافي الثروة (§8): Σ BOX + Σ AR − Σ AP − Σ PRE — الضلع الأيسر لمعادلة
 * INV-1. يشمل كل الترحيلات (صناديق مدمجة أيضًا: دمجها تحويل لا محو — §5).
 */
export function netWorthFils(totals: Record<LedgerAccountId, number>): number {
  return subFils(subFils(addFils(totals.BOX, totals.AR), totals.AP), totals.PRE);
}

/**
 * مصادر صافي الثروة (§8): Σ OPEN + Σ OWN_IN − Σ OWN_OUT + الربح منذ
 * البداية + Σ UNEXP — الضلع الأيمن لمعادلة INV-1، وربح منذ البداية
 * = Σ REV − Σ EXP (الاشتقاق في رأس الملف).
 */
export function netWorthSourcesFils(totals: Record<LedgerAccountId, number>): number {
  const profitSinceStart = subFils(totals.REV, totals.EXP);
  const beforeUnexplained = addFils(addFils(totals.OPEN, totals.OWN_IN), profitSinceStart);
  return subFils(addFils(beforeUnexplained, totals.UNEXP), totals.OWN_OUT);
}

/**
 * المستحق القائم لكل سطر (§8.2): Σ AR[L] لسطر to_me وΣ AP[L] لسطر by_me.
 * ترحيل الاتجاه المتقاطع على السطر لا يدخل مجموعه — INV-2 تفحصه وتسمّيه.
 */
export function outstandingByLineFils(state: LedgerCheckState): Map<string, number> {
  const lineDirection = new Map(state.balanceLines.map(line => [line.id, line.direction]));
  const outstanding = new Map<string, number>();
  for (const entry of state.entries) {
    for (const posting of entry.postings) {
      const account = posting.account;
      if (account !== "AR" && account !== "AP") continue;
      const direction = lineDirection.get(posting.refId ?? "");
      if (direction === undefined) continue;
      const matches = direction === "to_me" ? account === "AR" : account === "AP";
      if (!matches) continue;
      outstanding.set(
        posting.refId ?? "",
        addFils(outstanding.get(posting.refId ?? "") ?? 0, posting.deltaFils),
      );
    }
  }
  return outstanding;
}

/** الدفعة المقدمة لكل بيع (§8.2): Σ PRE[s] من كل الترحيلات. */
export function prepaymentBySaleFils(state: LedgerCheckState): Map<string, number> {
  const prepayments = new Map<string, number>();
  for (const entry of state.entries) {
    for (const posting of entry.postings) {
      if (posting.account !== "PRE") continue;
      prepayments.set(
        posting.refId ?? "",
        addFils(prepayments.get(posting.refId ?? "") ?? 0, posting.deltaFils),
      );
    }
  }
  return prepayments;
}

/** رصيد كل صندوق (§8): Σ BOX[k] من كل الترحيلات إلى اليوم. */
export function boxBalanceByBoxFils(state: LedgerCheckState): Map<string, number> {
  const balances = new Map<string, number>();
  for (const entry of state.entries) {
    for (const posting of entry.postings) {
      if (posting.account !== "BOX") continue;
      balances.set(posting.refId ?? "", addFils(balances.get(posting.refId ?? "") ?? 0, posting.deltaFils));
    }
  }
  return balances;
}

/** مفتاح ترحيل قانوني للمقارنة الكمية (الحساب والمرجع والفئة والنوع والمقدار). */
export function postingComparisonKey(posting: InvariantPosting): string {
  return `${posting.account}|${posting.refId ?? ""}|${posting.category ?? ""}|${posting.revKind ?? ""}|${posting.deltaFils}`;
}
