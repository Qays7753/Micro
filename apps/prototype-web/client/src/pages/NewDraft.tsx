/** F-003 (قرار المالك): زر الإضافة (FAB) هو المدخل الأساسي لإنشاء البيع/الطلب —
 * ومسار «/orders/new» القديم يصبح تحويل عمق واحد يحفظ التوافق مع الروابط القديمة
 * بلا شاشة اختيار منافسة: النية الافتراضية «طلب عميل»، وتُحفظ نية «مسودة تصميم»
 * إن جاءت في الرابط. لا قدرة تُزال؛ كلا المحررين يبقيان متاحين من FAB ومن الروابط.
 *
 * EXE-016 (NAV-003): التحويل يحفظ سياق الرجوع — وجهة `?returnTo=` تمر كما هي،
 * والرابط القديم `?from=` يُمرَّر بترقيته إلى العقد الجديد، فلا يضيع المصدر
 * بعد التحويل أبدًا (التحويل يحفظ المعاملات الأخرى والسياق). */
import { Redirect, useSearch } from "wouter";
import { appendQueryParams } from "@/app/navigationContract";
import type { DraftIntent } from "@/storage/local/types";

/* و٥-ب (مجموعة ٣): النية تُقرأ من useSearch — المسار الحقيقي يصل بلا استعلام. */
function intentFromSearch(search: string): DraftIntent {
  const value = new URLSearchParams(search).get("intent");
  return value === "planned_design" ? "planned_design" : "customer_order";
}

export default function NewDraft() {
  const search = useSearch();
  const query = new URLSearchParams(search);
  /* وجهة الرجوع: returnTo الجديد أو from القديم يُرقّى — لا مصدر يضيع. */
  const source = query.get("returnTo") ?? query.get("from");
  const target = appendQueryParams("/orders/draft/new", {
    intent: intentFromSearch(search),
    returnTo: source && source.startsWith("/") ? source : null,
  });
  return <Redirect to={target} />;
}
