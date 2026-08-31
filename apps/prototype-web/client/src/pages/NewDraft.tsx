/** F-003 (قرار المالك): زر الإضافة (FAB) هو المدخل الأساسي لإنشاء البيع/الطلب —
 * ومسار «/orders/new» القديم يصبح تحويل عمق واحد يحفظ التوافق مع الروابط القديمة
 * بلا شاشة اختيار منافسة: النية الافتراضية «طلب عميل»، وتُحفظ نية «مسودة تصميم»
 * إن جاءت في الرابط. لا قدرة تُزال؛ كلا المحررين يبقيان متاحين من FAB ومن الروابط. */
import { Redirect, useLocation } from "wouter";
import type { DraftIntent } from "@/storage/local/types";

function intentFromLocation(location: string): DraftIntent {
  const value = new URLSearchParams(location.split("?")[1] ?? "").get("intent");
  return value === "planned_design" ? "planned_design" : "customer_order";
}

export default function NewDraft() {
  const [location] = useLocation();
  return <Redirect to={`/orders/draft/new?intent=${intentFromLocation(location)}`} />;
}
