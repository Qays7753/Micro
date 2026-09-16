/**
 * EXE-009 (OWN-001): بطاقة حارس التكرار التقاطعي — توقف الحفظ عند اكتشاف
 * مكافئة للعملية في النموذج الآخر (حدث مالي عام × حركة دفتر مالك) وتطلب
 * تأكيدًا صريحًا أن هذه عملية جديدة مختلفة، أو مراجعة الدفتر الموحد أولًا.
 * عرض فقط — قرار المتابعة يبقى بيد المالك بعد الإفصاح الكامل.
 */
import { AlertTriangle } from "lucide-react";
import { formatLocalDate, formatMoneyMinor } from "@/presentation/formatters";
import type { CrossModelOwnerDuplicate } from "@/application/finance/ownerEntitlementService";

import { Button } from "@/components/primitives";

export function CrossModelDuplicateNotice({
  duplicate,
  onReviewLedger,
  onConfirmDistinct,
}: {
  duplicate: CrossModelOwnerDuplicate;
  onReviewLedger: () => void;
  onConfirmDistinct: () => void;
}) {
  const operationNoun = duplicate.direction === "injection" ? "إدخال مال للمشروع" : "سحبًا شخصيًا";
  return (
    <section className="micro-decision-card" data-owner-duplicate-guard={duplicate.direction} role="alert">
      <AlertTriangle aria-hidden="true" />
      <div>
        <span>تطابق محتمل بين نموذجي مال المالك</span>
        <strong>وجدنا {operationNoun} بنفس المبلغ والتاريخ مسجلًا في النموذج الآخر.</strong>
        <p>
          سجل «مال المالك» يقرأ من مصدرين تاريخيين (حدث مالي عام وحركة دفتر)، وتسجيل العملية نفسها
          فيهما معًا يضاعف أثرها بصمت. راجع الدفتر الموحد أولًا؛ وإن كانت هذه عملية جديدة مختلفة
          فعلًا فأكّد للمتابعة.
        </p>
        <p>
          <bdi dir="ltr">
            {formatLocalDate(duplicate.occurredOn)} · {formatMoneyMinor(duplicate.amountMinor)} د.أ
          </bdi>
        </p>
        <div className="micro-form-actions micro-contextual-actions">
          <Button action="secondary" onClick={onReviewLedger}>
            راجع الدفتر الموحد
          </Button>
          <Button action="save" onClick={onConfirmDistinct}>
            هذه عملية جديدة مختلفة — تابع الحفظ
          </Button>
        </div>
      </div>
    </section>
  );
}
