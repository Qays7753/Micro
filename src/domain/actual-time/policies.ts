import type { ActualTimeComparison, ActualTimeKnowledge, ActualTimeRecord, CreateActualTimeRecordInput, ReverseActualTimeRecordInput } from "./types.js";

const required = (value: string, message: string) => { if (!value.trim()) throw new Error(message); };
const validMinutes = (minutes: number) => Number.isInteger(minutes) && minutes > 0;

export function createActualTimeRecord(input: CreateActualTimeRecordInput): ActualTimeRecord {
  required(input.id, "معرف سجل الوقت مطلوب."); required(input.orderId, "اختر طلبًا قبل تسجيل الوقت."); required(input.recordedOn, "تاريخ تسجيل الوقت مطلوب."); required(input.createdAt, "وقت إنشاء السجل مطلوب."); required(input.operationKey, "مفتاح العملية مطلوب.");
  if (!validMinutes(input.minutesDelta)) throw new Error("سجل الوقت يحتاج دقائق موجبة صحيحة.");
  return { ...input, note: input.note?.trim() || null, reversalOfId: null, reversalReason: null };
}

export function reverseActualTimeRecord(input: ReverseActualTimeRecordInput, existing: readonly ActualTimeRecord[] = []): ActualTimeRecord {
  required(input.id, "معرف عكس الوقت مطلوب."); required(input.recordedOn, "تاريخ العكس مطلوب."); required(input.createdAt, "وقت إنشاء العكس مطلوب."); required(input.operationKey, "مفتاح عملية العكس مطلوب."); required(input.reason, "عكس سجل الوقت يحتاج سببًا واضحًا.");
  if (input.target.reversalOfId !== null || input.target.minutesDelta <= 0) throw new Error("لا يمكن عكس سجل عكس أو سجل وقت غير صالح.");
  if (existing.some(record => record.reversalOfId === input.target.id)) throw new Error("تم عكس سجل الوقت هذا سابقًا.");
  return { id: input.id, orderId: input.target.orderId, minutesDelta: -input.target.minutesDelta, recordedOn: input.recordedOn, createdAt: input.createdAt, note: `عكس: ${input.target.note ?? "سجل وقت"}`, operationKey: input.operationKey, reversalOfId: input.target.id, reversalReason: input.reason.trim() };
}

export function summarizeActualTime(orderId: string, plannedMinutes: number | null, records: readonly ActualTimeRecord[], knowledge: ActualTimeKnowledge): ActualTimeComparison {
  if (plannedMinutes !== null && (!Number.isInteger(plannedMinutes) || plannedMinutes < 0)) throw new Error("وقت Snapshot المخطط غير صالح.");
  const orderRecords = records.filter(record => record.orderId === orderId);
  const reversedIds = new Set(orderRecords.filter(record => record.reversalOfId).map(record => record.reversalOfId));
  const active = orderRecords.filter(record => record.minutesDelta > 0 && !reversedIds.has(record.id));
  const reversedRecordCount = orderRecords.filter(record => record.reversalOfId !== null).length;
  if (active.length === 0) return { status: "not_recorded", plannedMinutes, actualMinutes: null, varianceMinutes: null, recordCount: 0, reversedRecordCount };
  const actualMinutes = active.reduce((total, record) => total + record.minutesDelta, 0);
  return { status: plannedMinutes !== null && knowledge === "known" ? "recorded" : "needs_review", plannedMinutes, actualMinutes, varianceMinutes: plannedMinutes === null ? null : actualMinutes - plannedMinutes, recordCount: active.length, reversedRecordCount };
}
