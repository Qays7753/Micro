/**
 * S10 (UNIT-032 — أمر b56967d8): الرابط القديم /tools/estimate/:id صار
 * إحالة إلى الحاسبة نفسها بهوية صالحة ورجوع موثوق — لا صفحة تقديرات
 * مستقلة بعد اليوم (U032-ACD06/AC12: «توجيه الرابط القديم لنفس الحساب
 * داخل الحاسبة؛ عودة سليمة وعدم فقد البيانات»). البيانات نفسها لم تُمس:
 * السجلات في بيتها والحاسبة تفتحها بمعرفتها.
 */
import { useLocation } from "wouter";
import { Redirect, useSearch } from "wouter";
import { appendQueryParams } from "@/app/navigationContract";

export default function EstimateDetail() {
  const [location] = useLocation();
  const search = useSearch();
  /* المسار الشكلي /tools/estimate/:id — المعرّف من مقطع المسار الأخير. */
  const segments = location.split("/").filter(Boolean);
  const estimateId = segments[segments.length - 1];
  const target = appendQueryParams(`/tools/calculator?estimate=${encodeURIComponent(estimateId)}`, {
    /* الرجوع يُحفظ كما دخل إن كان مسارًا داخليًا آمنًا (يقرأه عقد التنقل). */
    returnTo: new URLSearchParams(search).get("returnTo"),
  });
  return <Redirect to={target} />;
}
