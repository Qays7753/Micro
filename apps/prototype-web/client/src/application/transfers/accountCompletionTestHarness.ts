/**
 * S14 (DOC-023 / UNIT-002 — أمر ba2ce7b4 §5): كعب اختبار حد الرحلة — مصنع
 * مخزن حقيقي وخدمتي مسودات ومنسق حقيقيتين لاختبارات DOM على مستوى الصفحات.
 * الصفحات (حتى اختباراتها) لا تستورد طبقة التخزين مباشرة (قيد الطبقات في
 * eslint وحدود STR-615) — هذا الكعب في طبقة التطبيق هو الجسر القانوني:
 * يستورده الاختبار وحده فلا يدخل بناء الإنتاج أبدًا (نمط formDraftTestHarness
 * وscheduleReadsTestHarness القائمين).
 */
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { FormDraftService } from "@/application/drafts";
import { AccountCompletionService } from "./accountCompletionService";

export function createAccountCompletionHarness(now?: () => string): {
  store: MemoryLocalStore;
  drafts: FormDraftService;
  coordinator: AccountCompletionService;
} {
  const store = new MemoryLocalStore();
  return {
    store,
    drafts: new FormDraftService(store, now),
    coordinator: new AccountCompletionService(store, now),
  };
}
