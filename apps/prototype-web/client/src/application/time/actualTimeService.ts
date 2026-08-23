import { createActualTimeRecord, reverseActualTimeRecord, summarizeActualTime, type ActualTimeComparison, type ActualTimeRecord } from "@micro-domain/actual-time/index.js";
import { localPreferencesId, type OperatingWorkMode, type PrototypeLocalStore } from "@/storage/local/types";

type ServiceFailure = { ok: false; code: "validation_error" | "storage_error" | "not_found"; message: string };
type ServiceSuccess<T> = { ok: true; value: T; reused?: boolean };
export type ActualTimeResult<T> = ServiceSuccess<T> | ServiceFailure;
export type OperatingModeValue = { workMode: OperatingWorkMode | null; actualTimeTrackingEnabled: boolean };
export type RecordActualTimeInput = { orderId: string; minutes: number; recordedOn: string; note: string | null; operationKey: string };
export type ReverseActualTimeInput = { targetId: string; recordedOn: string; reason: string; operationKey: string };

const createId = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `time-${Date.now()}-${Math.random().toString(16).slice(2)}`;
const mode = (value: unknown): OperatingWorkMode | null => value === "material_focused" || value === "time_focused" || value === "mixed" ? value : null;
const knowledge = (value: string): "known" | "estimated" | "needs_review" => value === "known" ? "known" : value === "estimated" ? "estimated" : "needs_review";

export class ActualTimeService {
  constructor(private readonly store: PrototypeLocalStore, private readonly now: () => string = () => new Date().toISOString()) {}

  async readOperatingMode(): Promise<ActualTimeResult<OperatingModeValue>> {
    const current = await this.store.getPreferences();
    if (!current.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة طريقة العمل المحلية." };
    return { ok: true, value: { workMode: mode(current.value?.workMode), actualTimeTrackingEnabled: current.value?.actualTimeTrackingEnabled ?? false } };
  }

  async saveOperatingMode(input: OperatingModeValue): Promise<ActualTimeResult<OperatingModeValue>> {
    const current = await this.store.getPreferences();
    if (!current.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة طريقة العمل المحلية." };
    const saved = await this.store.savePreferences({ id: localPreferencesId, theme: current.value?.theme ?? "system", dailyScheduleCapacityMinutes: current.value?.dailyScheduleCapacityMinutes ?? null, workMode: input.workMode, actualTimeTrackingEnabled: input.actualTimeTrackingEnabled, updatedAt: this.now() });
    return saved.ok ? { ok: true, value: { workMode: saved.value.workMode, actualTimeTrackingEnabled: saved.value.actualTimeTrackingEnabled } } : { ok: false, code: "storage_error", message: "تعذر حفظ طريقة العمل محليًا." };
  }

  async record(input: RecordActualTimeInput): Promise<ActualTimeResult<ActualTimeRecord>> {
    const [order, records] = await Promise.all([this.store.getOrder(input.orderId), this.store.listActualTimeRecords()]);
    if (!order.ok || !records.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة الطلب أو سجل الوقت محليًا." };
    if (!order.value) return { ok: false, code: "not_found", message: "الطلب غير متاح محليًا لتسجيل الوقت." };
    const retried = records.value.find(record => record.operationKey === input.operationKey);
    if (retried) return { ok: true, value: retried, reused: true };
    try {
      const record = createActualTimeRecord({ id: createId(), orderId: input.orderId, minutesDelta: input.minutes, recordedOn: input.recordedOn, createdAt: this.now(), note: input.note, operationKey: input.operationKey });
      const saved = await this.store.saveActualTimeRecord(record);
      return saved.ok ? { ok: true, value: saved.value } : { ok: false, code: "storage_error", message: "تعذر حفظ وقت التنفيذ محليًا." };
    } catch (error) { return { ok: false, code: "validation_error", message: error instanceof Error ? error.message : "بيانات الوقت غير صالحة." }; }
  }

  async reverse(input: ReverseActualTimeInput): Promise<ActualTimeResult<ActualTimeRecord>> {
    const records = await this.store.listActualTimeRecords();
    if (!records.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة سجل الوقت محليًا." };
    const target = records.value.find(record => record.id === input.targetId);
    if (!target) return { ok: false, code: "not_found", message: "سجل الوقت غير متاح محليًا." };
    const retried = records.value.find(record => record.operationKey === input.operationKey);
    if (retried) return { ok: true, value: retried, reused: true };
    try {
      const record = reverseActualTimeRecord({ id: createId(), target, recordedOn: input.recordedOn, createdAt: this.now(), reason: input.reason, operationKey: input.operationKey }, records.value);
      const saved = await this.store.saveActualTimeRecord(record);
      return saved.ok ? { ok: true, value: saved.value } : { ok: false, code: "storage_error", message: "تعذر حفظ عكس الوقت محليًا." };
    } catch (error) { return { ok: false, code: "validation_error", message: error instanceof Error ? error.message : "تعذر عكس سجل الوقت." }; }
  }

  async readOrderActualTimeComparison(orderId: string): Promise<ActualTimeResult<ActualTimeComparison>> {
    const [order, records] = await Promise.all([this.store.getOrder(orderId), this.store.listActualTimeRecords()]);
    if (!order.ok || !records.ok) return { ok: false, code: "storage_error", message: "تعذر قراءة مقارنة الوقت محليًا." };
    if (!order.value) return { ok: false, code: "not_found", message: "الطلب غير متاح محليًا." };
    const snapshotTime = order.value.order.costSnapshot.input.time;
    if (!snapshotTime) return { ok: true, value: { status: "needs_review", plannedMinutes: 0, actualMinutes: null, varianceMinutes: null, recordCount: 0, reversedRecordCount: 0 } };
    return { ok: true, value: summarizeActualTime(orderId, snapshotTime.minutes, records.value, knowledge(order.value.order.costSnapshot.knowledgeState)) };
  }
}
