/**
 * S10 (UNIT-031/032 — أمر b56967d8): كعب اختبار الحد لحاسبة التخطيط —
 * مصنع مخزن حقيقي + خدمتا التقديرات الحقيقيتان (القارئ الكنوني + دورة
 * حساب T01 المحفوظ الكسولة) لاختبارات DOM على مستوى الصفحات (نمط
 * formDraftTestHarness القائم في المجموعة ٥). الصفحات واختباراتها لا
 * تستورد طبقة التخزين مباشرة (قيد الطبقات في eslint) — هذا الكعب في طبقة
 * التطبيق هو الجسر القانوني: يستورده الاختبار وحده فلا يدخل بناء الإنتاج
 * أبدًا.
 */
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { CostEstimateService } from "./costEstimateService";
import { PlanningCalculationLifecycleService } from "./planningCalculationLifecycle";

export function createPlanningCalculatorHarness(now?: () => string): {
  store: MemoryLocalStore;
  costEstimates: CostEstimateService;
  planningCalculations: PlanningCalculationLifecycleService;
} {
  const store = new MemoryLocalStore();
  return {
    store,
    costEstimates: new CostEstimateService(store, now),
    planningCalculations: new PlanningCalculationLifecycleService(store, now),
  };
}
