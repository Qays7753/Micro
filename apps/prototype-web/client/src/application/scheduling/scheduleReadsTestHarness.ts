/**
 * S13 (DOC-022 — أمر 2158b0fc §6): عدة اختبار لقراءات المواعيد النقية —
 * الصفحات لا تستورد طبقة التخزين (حدود المجموعة ٦)؛ هذا البيت التطبيقي
 * يبني المخزن ويزرعه لاختبارات الصفحات (نمط formDraftTestHarness نفسه).
 */
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

export function createScheduleReadsHarness(): { store: MemoryLocalStore } {
  return { store: new MemoryLocalStore() };
}
