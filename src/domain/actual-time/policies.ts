import { isValidLocalDate, isValidTimestamp } from "../shared/index.js";
import type {
  ActualTimeComparison,
  ActualTimeKnowledge,
  ActualTimeRecord,
  CreateActualTimeRecordInput,
  ReverseActualTimeRecordInput,
} from "./types.js";

const required = (value: string, message: string) => {
  if (!value.trim()) throw new Error(message);
};
/* R2 (M-04/D7، 2026-10-08): العقد الفعلي للحقول — recordedOn تاريخ محلي
 * (كان نصًا غير فارغ فقط بينما الاستيراد يشدد بـisLocalDate)؛ createdAt
 * طابع زمني. محاذاة صرامة الإنشاء بصرامة الاستيراد — رسائل عربية صادقة. */
const validLocalDate = (value: string, message: string) => {
  if (!isValidLocalDate(value)) throw new Error(message);
};
const validTimestamp = (value: string, message: string) => {
  if (!isValidTimestamp(value)) throw new Error(message);
};
const validMinutes = (minutes: number) => Number.isInteger(minutes) && minutes > 0;

export function createActualTimeRecord(input: CreateActualTimeRecordInput): ActualTimeRecord {
  required(input.id, "معرف سجل الوقت مطلوب.");
  required(input.orderId, "اختر طلبًا قبل تسجيل الوقت.");
  validLocalDate(input.recordedOn, "أدخل تاريخ تسجيل الوقت تاريخًا محليًا صحيحًا.");
  validTimestamp(input.createdAt, "أدخل وقت إنشاء السجل وقتًا صحيحًا.");
  required(input.operationKey, "مفتاح العملية مطلوب.");
  if (!validMinutes(input.minutesDelta)) throw new Error("سجل الوقت يحتاج دقائق موجبة صحيحة.");
  return { ...input, note: input.note?.trim() || null, reversalOfId: null, reversalReason: null };
}

export function reverseActualTimeRecord(
  input: ReverseActualTimeRecordInput,
  existing: readonly ActualTimeRecord[] = [],
): ActualTimeRecord {
  required(input.id, "معرف تراجع الوقت مطلوب.");
  validLocalDate(input.recordedOn, "أدخل تاريخ التراجع تاريخًا محليًا صحيحًا.");
  validTimestamp(input.createdAt, "أدخل وقت إنشاء التراجع وقتًا صحيحًا.");
  required(input.operationKey, "مفتاح عملية التراجع مطلوب.");
  required(input.reason, "التراجع عن سجل الوقت يحتاج سببًا واضحًا.");
  if (input.target.reversalOfId !== null || input.target.minutesDelta <= 0)
    throw new Error("لا يمكن التراجع عن سجل تراجع أو سجل وقت غير صالح.");
  if (existing.some(record => record.reversalOfId === input.target.id))
    throw new Error("تم التراجع عن سجل الوقت هذا سابقًا.");
  return {
    id: input.id,
    orderId: input.target.orderId,
    minutesDelta: -input.target.minutesDelta,
    recordedOn: input.recordedOn,
    createdAt: input.createdAt,
    note: `تراجع: ${input.target.note ?? "سجل وقت"}`,
    operationKey: input.operationKey,
    reversalOfId: input.target.id,
    reversalReason: input.reason.trim(),
  };
}

export function summarizeActualTime(
  orderId: string,
  plannedMinutes: number | null,
  records: readonly ActualTimeRecord[],
  knowledge: ActualTimeKnowledge,
): ActualTimeComparison {
  if (plannedMinutes !== null && (!Number.isInteger(plannedMinutes) || plannedMinutes < 0))
    throw new Error("وقت نسخة التكلفة المخطط غير صالح.");
  const orderRecords = records.filter(record => record.orderId === orderId);
  const reversedIds = new Set(
    orderRecords.filter(record => record.reversalOfId).map(record => record.reversalOfId),
  );
  const active = orderRecords.filter(record => record.minutesDelta > 0 && !reversedIds.has(record.id));
  const reversedRecordCount = orderRecords.filter(record => record.reversalOfId !== null).length;
  if (active.length === 0)
    return {
      status: "not_recorded",
      plannedMinutes,
      actualMinutes: null,
      varianceMinutes: null,
      recordCount: 0,
      reversedRecordCount,
    };
  const actualMinutes = active.reduce((total, record) => total + record.minutesDelta, 0);
  return {
    status: plannedMinutes !== null && knowledge === "known" ? "recorded" : "needs_review",
    plannedMinutes,
    actualMinutes,
    varianceMinutes: plannedMinutes === null ? null : actualMinutes - plannedMinutes,
    recordCount: active.length,
    reversedRecordCount,
  };
}
