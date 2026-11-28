/**
 * M5.7 (Manage v2 phase 5 — UX P-50 «المطابقة: الأرصدة»): فروق المطابقة
 * قراءةً — لكل صندوق فعّال: المسجَّل (من موديول القراءة الواحد §8)،
 * الموجود (مدخل)، الفرق Δ بإشارته ونصه الجاهز، واقتراح التحويل §7.1-2
 * (min |Δ| من السالب إلى الموجب) — كله محسوبًا في الخادم ومنسّقًا
 * (العميل يعرض كما ورد؛ لا طرح في الواجهة).
 */
import type postgres from "postgres";
import { transferProposalOf } from "../../../../../src/domain/manage/operations/reconcile.js";
import { computeManageFigures } from "./readModel.js";
import { jodTextFromFils } from "../../../../../src/domain/manage/money/index.js";

function money(fils: number): string {
  return `${jodTextFromFils(fils)} د`;
}

export interface ReconcileBoxDiff {
  boxId: string;
  kind: "cash" | "account";
  /** المسجَّل من موديول القراءة (null لصندوق مجهول الافتتاح — §7.1). */
  recordedFils: number | null;
  recordedText: string | null;
  countedFils: number;
  countedText: string;
  /** Δ = الموجود − المسجَّل (المجهول: الإنهاء يحسم افتتاحه §7.3). */
  deltaFils: number;
  deltaText: string;
}

export interface ReconcileDiffResponse {
  boxes: ReconcileBoxDiff[];
  /** true إذا كان كل فرق صفرًا (الإنهاء المباشر ← P-53). */
  allZero: boolean;
  /** اقتراح §7.1-2 عند فرقين بعكس بعض (P-51) — المبلغ فلسًا ونصًا. */
  transferProposal: { fromBox: string; toBox: string; amountFils: number; amountText: string } | null;
}

/** فروق المطابقة (P-50 «التالي»): المسجَّل من موديول القراءة والفرق
 *  واقتراح التحويل — قراءة صرفة بلا كتابة. */
export async function readReconcileDiff(
  sql: postgres.Sql,
  projectId: string,
  today: string,
  counted: Array<{ boxId: string; countedFils: number }>,
): Promise<ReconcileDiffResponse> {
  const figures = await computeManageFigures(sql, projectId, today, "month");
  const active = figures.boxes
    .filter(box => box.status === "active")
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "cash" ? -1 : 1));
  const diffs: ReconcileBoxDiff[] = active.map(box => {
    const countedFils = counted.find(c => c.boxId === box.id)?.countedFils ?? 0;
    const known = box.openingStatus === "known";
    const recordedFils = known ? (box.balanceFils ?? 0) : null;
    /* المجهول: الموجود يصير افتتاحه §7.3 عند الإنهاء — لا Q19 ولا أسئلة،
     * ففرقه في التوجيه صفر (والسياق first_unknown_opening). */
    const deltaFils = known ? countedFils - (recordedFils ?? 0) : 0;
    return {
      boxId: box.id,
      kind: box.kind === "cash" ? "cash" : "account",
      recordedFils,
      recordedText: recordedFils === null ? null : money(recordedFils),
      countedFils,
      countedText: money(countedFils),
      deltaFils,
      deltaText: money(deltaFils),
    };
  });
  const proposal = transferProposalOf(
    diffs
      .filter(d => d.recordedFils !== null)
      .map(d => ({ box: d.kind, countedFils: d.countedFils, recordedFils: d.recordedFils! })),
  );
  return {
    boxes: diffs,
    allZero: diffs.every(d => d.deltaFils === 0),
    transferProposal:
      proposal === null
        ? null
        : {
            fromBox: proposal.fromBox,
            toBox: proposal.toBox,
            amountFils: proposal.amountFils,
            amountText: money(proposal.amountFils),
          },
  };
}
