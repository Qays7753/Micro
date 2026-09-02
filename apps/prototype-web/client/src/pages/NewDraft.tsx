/** F-003 (قرار المالك): زر الإضافة (FAB) هو المدخل الأساسي لإنشاء البيع/الطلب —
 * ومسار «/orders/new» القديم يصبح تحويل عمق واحد يحفظ التوافق مع الروابط القديمة
 * بلا شاشة اختيار منافسة: النية الافتراضية «طلب عميل»، وتُحفظ نية «مسودة تصميم»
 * إن جاءت في الرابط. لا قدرة تُزال؛ كلا المحررين يبقيان متاحين من FAB ومن الروابط. */
import { Redirect, useSearch } from "wouter";
import type { DraftIntent } from "@/storage/local/types";

/* و٥-ب (مجموعة ٣): النية تُقرأ من useSearch — المسار الحقيقي يصل بلا استعلام. */
function intentFromSearch(search: string): DraftIntent {
  const value = new URLSearchParams(search).get("intent");
  return value === "planned_design" ? "planned_design" : "customer_order";
}

export default function NewDraft() {
  const search = useSearch();
  return <Redirect to={`/orders/draft/new?intent=${intentFromSearch(search)}`} />;
}
