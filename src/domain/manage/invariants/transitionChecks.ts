/**
 * M2.3 (§9/INV-7 وINV-8 وINV-9 — مانج-في₂، الموجة E): الفحوص الانتقالية —
 * كلها دوال صرفة فوق حالتين (قبل، بعد) كما يلي استدعاؤها من الاختبارات ومن
 * مسار الكتابة حيث يكون رخيصًا (تحميل الحالة قبل الكتابة ومقارنتها بعدها):
 *  - INV-7: تعديل منتج لا يغيّر بند بيع قائمًا — اللقطة مصدر ذاتي للبند
 *    (§3.5)، وتعديل المنتج لا يمسّ حالة الدفتر بشيء (لا قيد ولا عملية ولا
 *    صف): كل ما في الحالة عدا المنتجات نفسه (المنتجات ليست من الحالة).
 *  - INV-8: تصحيح عملية (عكس وإعادة ترحيل — §5 OP-CORRECT) يغيّر فترات
 *    التواريخ المتأثرة وحدها: القيود السابقة لا تُمسّ (append-only)،
 *    والفترات المتأثرة = تواريخ القيود المعكوسة (مرآة Q20 بتاريخ أصلها)
 *    وتواريخ قيود البديل المصحِّح — وكل ترحيل خارجها مطابق بين الحالتين.
 *  - INV-9: تاريخا التسجيل والتسليم المخطط بلا أثر مالي (§3.4): تغييرهما
 *    يترك الدفتر والعمليات والأسطر المالية كما هي بالضبط.
 * كل فحص يبدأ بسلامة الترحيلات في الحالتين فشلًا مغلقًا.
 */
import { postingComparisonKey, postingIntegrityViolations } from "./aggregate.js";
import type { InvariantCheckResult, InvariantId, LedgerCheckState } from "./types.js";

function pass(id: InvariantId): InvariantCheckResult {
  return { invariantId: id, outcome: "pass" };
}

function violation(id: InvariantId, violations: string[]): InvariantCheckResult {
  return { invariantId: id, outcome: "violation", violations };
}

/** مفتاح مقارنة قيد كامل: معرّفه وبياناته وترحيلاته كمجموعة (لا بترتيبها). */
function entryComparisonKey(entry: LedgerCheckState["entries"][number]): string {
  const postings = entry.postings.map(postingComparisonKey).sort().join(";");
  return `${entry.id}|${entry.operationId}|${entry.entryType}|${entry.effectiveOn}|${entry.reversesEntryId ?? ""}|${postings}`;
}

function toCountMap(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

/** فروق مجموعتين كميتين: عناصر زائدة وناقصة بأسمائها (للرسائل لا للحساب). */
function countMapDifferences(
  label: string,
  before: Map<string, number>,
  after: Map<string, number>,
): string[] {
  const differences: string[] = [];
  for (const [key, count] of before) {
    const afterCount = after.get(key) ?? 0;
    if (afterCount < count) {
      differences.push(`${label} ناقص: «${key}» (كان ${count} وبات ${afterCount})`);
    } else if (afterCount > count) {
      differences.push(`${label} زائد: «${key}» (كان ${count} وبات ${afterCount})`);
    }
  }
  for (const [key, count] of after) {
    if (!before.has(key) && count > 0) {
      differences.push(`${label} دخيل: «${key}» (${count})`);
    }
  }
  return differences;
}

/** فروق صفوف بنيوية بين حالتين بمفاتيحها الكاملة. */
function structuralRowDifferences<T>(
  label: string,
  before: T[],
  after: T[],
  keyOf: (row: T) => string,
): string[] {
  return countMapDifferences(label, toCountMap(before.map(keyOf)), toCountMap(after.map(keyOf)));
}

/** مفاتيح مقارنة الصفوف البنيوية (كل صف بمفتاحه الكامل — بلا ترتيب). */
function saleLineComparisonKey(line: LedgerCheckState["saleLines"][number]): string {
  return [
    line.id,
    line.saleId,
    line.position,
    line.productId ?? "null",
    line.description,
    line.quantityMilli,
    line.unitPriceFils ?? "null",
    line.unitCostFils ?? "null",
  ].join("|");
}

function operationComparisonKey(op: LedgerCheckState["operations"][number]): string {
  return [op.id, op.kind, op.status, op.correctsOperationId ?? "", op.reversedByOperationId ?? ""].join("|");
}

function boxComparisonKey(box: LedgerCheckState["boxes"][number]): string {
  return [box.id, box.status, box.openingStatus].join("|");
}

function lineComparisonKey(line: LedgerCheckState["balanceLines"][number]): string {
  return [line.id, line.direction].join("|");
}

function saleComparisonKey(sale: LedgerCheckState["sales"][number]): string {
  return [sale.id, sale.registeredOn, sale.plannedDeliveryOn].join("|");
}

/** فروق القيود بين حالتين كمجموعة كمية (بلا ترتيب). */
function entryRowDifferences(before: LedgerCheckState, after: LedgerCheckState): string[] {
  return structuralRowDifferences("قيد", before.entries, after.entries, entryComparisonKey);
}

/** خرق append-only عبر الانتقال: قيد سابق لا يُحذف ولا يُعدّل. */
function appendOnlyViolations(
  beforeKeyById: Map<string, string>,
  afterKeyById: Map<string, string>,
): string[] {
  const violations: string[] = [];
  for (const [id, key] of beforeKeyById) {
    if (!afterKeyById.has(id)) {
      violations.push(`قيد سابق حُذف: «${id}» — لا حذف في دفتر append-only (§3.8).`);
    } else if (afterKeyById.get(id) !== key) {
      violations.push(`قيد سابق تغيّر: «${id}» — لا تعديل في دفتر append-only (§3.8).`);
    }
  }
  return violations;
}

/** عمليات البديل المصحِّح: corrects_operation_id مضبوط (§3.7/§5 OP-CORRECT). */
function correctsOperationIds(state: LedgerCheckState): Set<string> {
  return new Set(
    state.operations
      .filter(op => op.correctsOperationId !== undefined && op.correctsOperationId !== "")
      .map(op => op.id),
  );
}

/** الفترات المتأثرة: تواريخ القيود المعكوسة (ومرآتها Q20 بتاريخ أصلها) وقيود البديل المصحِّح. */
function affectedDatesOf(beforeKeyById: Map<string, string>, after: LedgerCheckState): Set<string> {
  const affected = new Set<string>();
  const afterEntryById = new Map(after.entries.map(entry => [entry.id, entry]));
  const correctsOps = correctsOperationIds(after);
  for (const entry of after.entries) {
    if (beforeKeyById.has(entry.id)) {
      continue;
    }
    if (entry.entryType === "Q20") {
      affected.add(entry.effectiveOn);
      const reversed = afterEntryById.get(entry.reversesEntryId ?? "");
      if (reversed !== undefined) {
        affected.add(reversed.effectiveOn);
      }
    } else if (correctsOps.has(entry.operationId)) {
      affected.add(entry.effectiveOn);
    }
  }
  return affected;
}

/** قيد أُضيف خارج نطاق التصحيح وفتراته المتأثرة — خرق حصر الفترات. */
function outOfScopeAdditionViolations(
  beforeKeyById: Map<string, string>,
  after: LedgerCheckState,
  affected: ReadonlySet<string>,
): string[] {
  const violations: string[] = [];
  const correctsOps = correctsOperationIds(after);
  for (const entry of after.entries) {
    if (beforeKeyById.has(entry.id)) {
      continue;
    }
    if (entry.entryType === "Q20" || correctsOps.has(entry.operationId)) {
      continue;
    }
    if (!affected.has(entry.effectiveOn)) {
      violations.push(
        `قيد أُضيف خارج الفترات المتأثرة: «${entry.id}» بتاريخ ${entry.effectiveOn} تحت عملية خارج نطاق التصحيح — التصحيح يغيّر فترات التواريخ المتأثرة وحدها (§9 INV-8).`,
      );
    }
  }
  return violations;
}

/** ترحيلات خارج الفترات المتأثرة: مطابقة بين الحالتين كمجموعة كمية مؤرخة. */
function outsideAffectedPostingsViolations(
  before: LedgerCheckState,
  after: LedgerCheckState,
  affected: ReadonlySet<string>,
): string[] {
  const postingsOutside = (state: LedgerCheckState): Map<string, number> =>
    toCountMap(
      state.entries
        .filter(entry => !affected.has(entry.effectiveOn))
        .flatMap(entry => entry.postings.map(p => `${entry.effectiveOn}|${postingComparisonKey(p)}`)),
    );
  return countMapDifferences("ترحيل خارج الفترات المتأثرة", postingsOutside(before), postingsOutside(after));
}

/** INV-7: تعديل منتج لا يغيّر بند بيع قائمًا ولا أي شيء في حالة الدفتر. */
export function checkInv7(before: LedgerCheckState, after: LedgerCheckState): InvariantCheckResult {
  const integrity = [...postingIntegrityViolations(before), ...postingIntegrityViolations(after)];
  if (integrity.length > 0) {
    return violation("INV-7", integrity);
  }
  const violations = [
    ...entryRowDifferences(before, after),
    ...structuralRowDifferences("بند بيع", before.saleLines, after.saleLines, saleLineComparisonKey),
    ...structuralRowDifferences("عملية", before.operations, after.operations, operationComparisonKey),
    ...structuralRowDifferences("صندوق", before.boxes, after.boxes, boxComparisonKey),
    ...structuralRowDifferences("سطر رصيد", before.balanceLines, after.balanceLines, lineComparisonKey),
    ...structuralRowDifferences("بيع", before.sales, after.sales, saleComparisonKey),
  ];
  if (violations.length === 0) {
    return pass("INV-7");
  }
  return violation("INV-7", [
    `تعديل منتج لا يجوز أن يغيّر شيئًا مما تغيّر (اللقطة مصدر ذاتي للبند — §3.5، والمنتج بلا أثر دفتري على البيعة القائمة): ${violations.join("؛ ")}.`,
  ]);
}

/** INV-8: تصحيح عملية يغيّر فترات التواريخ المتأثرة وحدها. */
export function checkInv8(before: LedgerCheckState, after: LedgerCheckState): InvariantCheckResult {
  const integrity = [...postingIntegrityViolations(before), ...postingIntegrityViolations(after)];
  if (integrity.length > 0) {
    return violation("INV-8", integrity);
  }
  const beforeKeyById = new Map(before.entries.map(entry => [entry.id, entryComparisonKey(entry)]));
  const afterKeyById = new Map(after.entries.map(entry => [entry.id, entryComparisonKey(entry)]));
  const affected = affectedDatesOf(beforeKeyById, after);
  const violations = [
    ...appendOnlyViolations(beforeKeyById, afterKeyById),
    ...outOfScopeAdditionViolations(beforeKeyById, after, affected),
    ...outsideAffectedPostingsViolations(before, after, affected),
  ];
  return violations.length > 0 ? violation("INV-8", violations) : pass("INV-8");
}

/** INV-9: تاريخا التسجيل والتسليم المخطط بلا أثر مالي (§3.4). */
export function checkInv9(before: LedgerCheckState, after: LedgerCheckState): InvariantCheckResult {
  const integrity = [...postingIntegrityViolations(before), ...postingIntegrityViolations(after)];
  if (integrity.length > 0) {
    return violation("INV-9", integrity);
  }
  const violations = [
    ...entryRowDifferences(before, after),
    ...structuralRowDifferences("عملية", before.operations, after.operations, operationComparisonKey),
    ...structuralRowDifferences("صندوق", before.boxes, after.boxes, boxComparisonKey),
    ...structuralRowDifferences("سطر رصيد", before.balanceLines, after.balanceLines, lineComparisonKey),
  ];
  if (violations.length === 0) {
    return pass("INV-9");
  }
  return violation("INV-9", [
    `تغيير تاريخي التسجيل والتسليم المخطط بلا أثر مالي (§3.4): ما تغيّر من الحالة المالية والبنيوية: ${violations.join("؛ ")}.`,
  ]);
}
