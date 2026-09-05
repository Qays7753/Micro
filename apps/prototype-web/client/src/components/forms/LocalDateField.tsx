/**
 * مبدأ Micro: يعرض التاريخ المحلي بقراءة واضحة، مع إبقاء الإدخال ISO
 * وحارس التخزين في طبقة التطبيق لا في مكوّن الواجهة.
 * المجموعة ٦ (البند ٥): القراءة رقمية DD/MM/YYYY بجدار LTR — ترتيب اليوم/الشهر
 * محفوظ حتميًا داخل الواجهة العربية RTL — وحقا الإدخال الأصلي بوسم لغة إنجليزية
 * فتُعرض منقّطته الأصلية بلا تحويل محلي.
 */
import type { InputHTMLAttributes } from "react";
import { formatLocalDate } from "@/presentation/formatters";

type LocalDateFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  description?: string;
};

export function LocalDateField({ label, description, value, id, ...inputProps }: LocalDateFieldProps) {
  const localValue = typeof value === "string" ? value : "";
  const readableDate = formatLocalDate(localValue);
  const displayId = id ? `${id}-display` : undefined;
  const describedBy = [inputProps["aria-describedby"], displayId].filter(Boolean).join(" ") || undefined;

  return (
    <label className="micro-field">
      <span>
        {label}
        {description ? <small>{description}</small> : null}
      </span>
      <input
        {...inputProps}
        id={id}
        type="date"
        value={localValue}
        aria-describedby={describedBy}
        lang="en"
      />
      <small id={displayId} className="micro-selected-date" data-empty={!readableDate} aria-live="polite">
        {readableDate ? (
          <>
            التاريخ المحدد: <bdi dir="ltr">{readableDate}</bdi>
          </>
        ) : (
          "لم يُحدد تاريخ بعد."
        )}
      </small>
    </label>
  );
}
