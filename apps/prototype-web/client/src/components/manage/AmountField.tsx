/**
 * M5.1 (Manage v2 phase 5 — UX §2.0 C-01 «حقل المبلغ»): لوحة أرقام بفاصلة
 * عشرية لأسطح مانج — يبدأ فارغًا، أرقام إنجليزية حصرًا (R-20)، ولاحقة
 * العملة «د» ثابتة على الحقل (R-22)، ويعرض بـ٣ منازل عند الالتزام.
 *
 * عقد المكوّن (خارج أي معنى مالي):
 *  - نص خام يملكه الأب (مسودة C-08: الخطأ لا يمسح المدخلات)؛ المكوّن لا
 *    يحلل ولا يحسب — التحليل للإرسال عبر presentation.parseJodInputToFils
 *    عند الأب حصرًا.
 *  - التعطيل (خيار «لا أعرف الآن») يجمّد الحقل بصريًا ويحفظ نصه.
 *  - الخطأ يمرر نصًا جاهزًا (رسالة §11 من الكتالوج عند الأب) — نفس عقد
 *    Field الأولي (role=alert).
 */
import { useId } from "react";
import clsx from "clsx";
import { Field } from "@/components/primitives";
import { t } from "@/application/manage/strings";

export interface AmountFieldProps {
  /** تسمية الحقل — نص كتالوج جاهز من الأب. */
  label: string;
  /** النص الخام كما كتبه المستخدم (ملكية الأب). */
  value: string;
  onTextChange: (text: string) => void;
  /** نص خطأ §11 جاهز — وجوده يعرض الحقل بالوضع الخاطئ. */
  error?: string;
  /** بيانات وصفية غير مالية (تلميح). */
  hint?: string;
  /** تعطيل (مثل «لا أعرف الآن») — يجمّد الحقل ويحفظ النص. */
  disabled?: boolean;
  /** تركيز تلقائي عند الفتح. */
  autoFocus?: boolean;
  /** اسم برمجي للاختبار (data-testid). */
  testId?: string;
}

/** C-01: حقل المبلغ — عرض خالص، التحليل عند الأب، العملة لاحقة ثابتة. */
export function AmountField({
  label,
  value,
  onTextChange,
  error,
  hint,
  disabled = false,
  autoFocus = false,
  testId,
}: AmountFieldProps) {
  const suffixId = useId();
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      controlId={testId}
      className={clsx(disabled && "micro-manage-amount--disabled")}
    >
      <span className="micro-manage-amount">
        <input
          id={testId}
          data-testid={testId}
          type="text"
          inputMode="decimal"
          dir="ltr"
          lang="en"
          autoComplete="off"
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-describedby={disabled ? suffixId : undefined}
          onChange={event => onTextChange(event.target.value)}
          className="micro-manage-amount__input"
        />
        <span className="micro-manage-amount__suffix" id={suffixId} aria-hidden="true">
          {t("l.currency")}
        </span>
      </span>
    </Field>
  );
}
