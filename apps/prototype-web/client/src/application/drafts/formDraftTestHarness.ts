/**
 * المجموعة ٥ (التحصين الكامل — كعب اختبار الحد): مصنع مخزن حقيقي + خدمة
 * مسودات حقيقية لاختبارات DOM على مستوى الصفحات. الصفحات (حتى اختباراتها)
 * لا تستورد طبقة التخزين مباشرة (قيد الطبقات في eslint) — هذا الكعب في طبقة
 * التطبيق هو الجسر القانوني: يستورده الاختبار وحده فلا يدخل بناء الإنتاج
 * أبدًا، ويمنح الاختبار مخزنًا حقيقيًا تُعاد قراءته لا كائنات وهمية.
 */
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { FormDraftService } from "./formDraftService";

export function createFormDraftHarness(now?: () => string): {
  store: MemoryLocalStore;
  drafts: FormDraftService;
} {
  const store = new MemoryLocalStore();
  return { store, drafts: new FormDraftService(store, now) };
}
