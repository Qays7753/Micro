/**
 * M2.3 (§9/INV-1 وINV-2 وINV-3 وINV-10 — مانج-في₂، الموجة E): الفحوص
 * الرقمية فوق حالة دفتر واحدة:
 *  - INV-1: صافي الثروة = مصادره في كل لحظة (§8) — ومع فتح مجهول نشط
 *    النتيجة `unknown` (الطرفان مجهولان — التفسير المُلزم 6)، والتحقق
 *    الرقمي واجب حين يكون فتح كل صندوق نشط معروفًا.
 *  - INV-2: كل مستحق قائم ≥ 0 وكل دفعة مقدمة ≥ 0 — مع تسمية الترحيلات
 *    المرجعية الفاسدة (مرجع مجهول أو اتجاه متقاطع) لأنها مقدمة جمعه.
 *  - INV-3: كل قيمة مخزّنة مؤقتًا تساوي إعادة حسابها من الترحيلات (§3.11)
 *    — بلا كاش النتيجة pass (التخزين جائز لا مفروض).
 *  - INV-10: كل قيد يحقق معادلة §3.8 على ترحيلاته — إعادة استخدام دالة
 *    معادلة التوازن نفسها من M2.2 (المكان الواحد) بعد فحص سلامة الترحيلات.
 * كل فحص يبدأ بسلامة الترحيلات فشلًا مغلقًا، ويعمل بمعادلات M1.7 للفلس.
 */
import { entryBalanceDifferenceFils } from "../ledger/balanceRule.js";
import type { LedgerPosting } from "../ledger/types.js";
import { subFils } from "../money/fils.js";
import {
  accountTotalsFils,
  boxBalanceByBoxFils,
  entryPostingIntegrityViolations,
  netWorthFils,
  netWorthSourcesFils,
  outstandingByLineFils,
  postingIntegrityViolations,
  prepaymentBySaleFils,
} from "./aggregate.js";
import type {
  InvariantCheckResult,
  InvariantEntry,
  InvariantId,
  InvariantPosting,
  LedgerCheckState,
} from "./types.js";

function pass(id: InvariantId): InvariantCheckResult {
  return { invariantId: id, outcome: "pass" };
}

function violation(id: InvariantId, violations: string[]): InvariantCheckResult {
  return { invariantId: id, outcome: "violation", violations };
}

/** INV-1: صافي الثروة = مصادره (§8/§9) — الطرفان مجهولان مع فتح مجهول نشط. */
export function checkInv1(state: LedgerCheckState): InvariantCheckResult {
  const integrity = postingIntegrityViolations(state);
  if (integrity.length > 0) {
    return violation("INV-1", integrity);
  }
  const unknownOpenings = state.boxes.filter(
    box => box.status === "active" && box.openingStatus === "unknown",
  );
  if (unknownOpenings.length > 0) {
    return {
      invariantId: "INV-1",
      outcome: "unknown",
      reason: `فتح مجهول نشط: ${unknownOpenings.map(box => `«${box.id}»`).join(" و")} — الطرفان مجهولان قبل أول مطابقة (§7.3)، والتحقق الرقمي واجب حين يكون فتح كل صندوق نشط معروفًا.`,
    };
  }
  const totals = accountTotalsFils(state);
  const netWorth = netWorthFils(totals);
  const sources = netWorthSourcesFils(totals);
  const difference = subFils(netWorth, sources);
  if (difference !== 0) {
    return violation("INV-1", [
      `صافي الثروة (${netWorth} فلس) لا يساوي مصادره (${sources} فلس) — الفرق ${difference} فلس (§8/§9 INV-1).`,
    ]);
  }
  return pass("INV-1");
}

/** خرق مرجع ترحيل سطر رصيد: سطر غائب أو اتجاه متقاطع (AR لـto_me وAP لـby_me). */
function balanceLineReferenceViolation(
  lineById: Map<string, LedgerCheckState["balanceLines"][number]>,
  entry: InvariantEntry,
  posting: InvariantPosting,
): string[] {
  if (posting.account !== "AR" && posting.account !== "AP") {
    return [];
  }
  const line = lineById.get(posting.refId ?? "");
  if (line === undefined) {
    return [
      `ترحيل ${posting.account} يشير إلى سطر رصيد غير موجود «${posting.refId ?? ""}» (القيد «${entry.id}») — لا يُحسب مستحق سطر غائب.`,
    ];
  }
  const expectedDirection = posting.account === "AR" ? "to_me" : "by_me";
  if (line.direction !== expectedDirection) {
    return [
      `ترحيل ${posting.account} على السطر «${line.id}» باتجاهه المتقاطع ${line.direction} (القيد «${entry.id}») — to_me على AR وby_me على AP حصرًا (§3.6/§4).`,
    ];
  }
  return [];
}

/** خرق مرجع ترحيل دفعة مقدمة: بيع غائب — لا تُحسب دفعة بيع غائب. */
function prepaymentReferenceViolation(
  saleIds: ReadonlySet<string>,
  entry: InvariantEntry,
  posting: InvariantPosting,
): string[] {
  if (posting.account !== "PRE") {
    return [];
  }
  if (saleIds.has(posting.refId ?? "")) {
    return [];
  }
  return [
    `ترحيل PRE يشير إلى بيع غير موجود «${posting.refId ?? ""}» (القيد «${entry.id}») — لا تُحسب دفعة بيع غائب.`,
  ];
}

/** خرق INV-2 المرجعي: كل ترحيل AR/AP/PRE يشير إلى سطر/بيع موجود باتجاهه. */
function referentialPostingViolations(state: LedgerCheckState): string[] {
  const lineById = new Map(state.balanceLines.map(line => [line.id, line]));
  const saleIds = new Set(state.sales.map(sale => sale.id));
  const violations: string[] = [];
  for (const entry of state.entries) {
    for (const posting of entry.postings) {
      violations.push(...balanceLineReferenceViolation(lineById, entry, posting));
      violations.push(...prepaymentReferenceViolation(saleIds, entry, posting));
    }
  }
  return violations;
}

/** INV-2: كل مستحق قائم ≥ 0 وكل دفعة مقدمة ≥ 0 (§9) — فشلًا مغلقًا في المراجع. */
export function checkInv2(state: LedgerCheckState): InvariantCheckResult {
  const integrity = postingIntegrityViolations(state);
  if (integrity.length > 0) {
    return violation("INV-2", integrity);
  }
  const violations = referentialPostingViolations(state);
  const outstanding = outstandingByLineFils(state);
  for (const line of state.balanceLines) {
    const value = outstanding.get(line.id) ?? 0;
    if (value < 0) {
      violations.push(
        `السطر «${line.id}» (${line.direction}): المستحق القائم ${value} فلس سالب — كل مستحق قائم ≥ 0 (§9 INV-2).`,
      );
    }
  }
  const prepayments = prepaymentBySaleFils(state);
  for (const sale of state.sales) {
    const value = prepayments.get(sale.id) ?? 0;
    if (value < 0) {
      violations.push(`البيع «${sale.id}»: الدفعة المقدمة ${value} فلس سالبة — كل PRE[s] ≥ 0 (§9 INV-2).`);
    }
  }
  return violations.length > 0 ? violation("INV-2", violations) : pass("INV-2");
}

/** خرق عائلة كاش واحدة: كيان غير موجود، أو قيمة غير آمنة، أو تخالف إعادة الحساب. */
function cachedFamilyViolations(
  family: string,
  cachedValues: Record<string, number>,
  knownIds: ReadonlySet<string>,
  recomputedOf: (entity: string) => number,
): string[] {
  const violations: string[] = [];
  for (const [entity, cached] of Object.entries(cachedValues)) {
    if (!knownIds.has(entity)) {
      violations.push(`كاش ${family} لكيان غير موجود «${entity}» — رفض مغلق.`);
      continue;
    }
    if (!Number.isSafeInteger(cached)) {
      violations.push(`كاش ${family} للكيان «${entity}» ليس عددًا صحيحًا آمنًا بالفلس.`);
      continue;
    }
    const recomputed = recomputedOf(entity);
    if (cached !== recomputed) {
      violations.push(
        `كاش ${family} للكيان «${entity}» = ${cached} فلس وإعادة الحساب من الترحيلات = ${recomputed} فلس — الكاش يجب أن يساوي إعادة الحساب (§3.11/§9 INV-3).`,
      );
    }
  }
  return violations;
}

/** INV-3: كل قيمة مخزّنة مؤقتًا تساوي إعادة حسابها من الترحيلات (§3.11/§9). */
export function checkInv3(state: LedgerCheckState): InvariantCheckResult {
  const cache = state.cachedFigures;
  if (cache === undefined) {
    return pass("INV-3");
  }
  const integrity = postingIntegrityViolations(state);
  if (integrity.length > 0) {
    return violation("INV-3", integrity);
  }
  const boxBalances = boxBalanceByBoxFils(state);
  const outstanding = outstandingByLineFils(state);
  const prepayments = prepaymentBySaleFils(state);
  const violations = [
    ...cachedFamilyViolations(
      "رصيد الصندوق",
      cache.boxBalances ?? {},
      new Set(state.boxes.map(box => box.id)),
      id => boxBalances.get(id) ?? 0,
    ),
    ...cachedFamilyViolations(
      "المستحق القائم",
      cache.lineOutstanding ?? {},
      new Set(state.balanceLines.map(line => line.id)),
      id => outstanding.get(id) ?? 0,
    ),
    ...cachedFamilyViolations(
      "الدفعة المقدمة",
      cache.salePrepayments ?? {},
      new Set(state.sales.map(sale => sale.id)),
      id => prepayments.get(id) ?? 0,
    ),
  ];
  return violations.length > 0 ? violation("INV-3", violations) : pass("INV-3");
}

/** INV-10: كل قيد يحقق معادلة §3.8 على ترحيلاته (§9) — بدالة التوازن نفسها من M2.2. */
export function checkInv10(state: LedgerCheckState): InvariantCheckResult {
  const violations: string[] = [];
  for (const entry of state.entries) {
    violations.push(...entryViolationsForInv10(entry));
  }
  return violations.length > 0 ? violation("INV-10", violations) : pass("INV-10");
}

/** سلامة قيد واحد ثم معادلته — الحساب معروف مضمون بفحص السلامة قبل الاستدعاء. */
function entryViolationsForInv10(entry: InvariantEntry): string[] {
  const integrity = entryPostingIntegrityViolations(entry);
  if (integrity.length > 0) {
    return integrity;
  }
  const difference = entryBalanceDifferenceFils(entry.postings as unknown as readonly LedgerPosting[]);
  if (difference !== 0) {
    return [
      `القيد «${entry.id}» (النوع ${entry.entryType}): معادلة §3.8 لا تساوي صفرًا — الفرق ${difference} فلس (§9 INV-10).`,
    ];
  }
  return [];
}
