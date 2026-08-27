/**
 * مبدأ Micro: يعرض التاريخ المحلي بقراءة عربية واضحة، مع إبقاء الإدخال ISO
 * وحارس التخزين في طبقة التطبيق لا في مكوّن الواجهة.
 */
import type { InputHTMLAttributes } from "react";
import { formatLocalDateLong } from "@/presentation/formatters";

type LocalDateFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  description?: string;
};

export function LocalDateField({ label, description, value, id, ...inputProps }: LocalDateFieldProps) {
  const localValue = typeof value === "string" ? value : "";
  const readableDate = formatLocalDateLong(localValue);
  const displayId = id ? `${id}-display` : undefined;
  const describedBy = [inputProps["aria-describedby"], displayId].filter(Boolean).join(" ") || undefined;

  return (
    <label className="micro-field">
      <span>
        {label}
        {description ? <small>{description}</small> : null}
      </span>
      <input {...inputProps} id={id} type="date" value={localValue} aria-describedby={describedBy} />
      <small id={displayId} className="micro-selected-date" data-empty={!readableDate} aria-live="polite">
        {readableDate ? <>التاريخ المحدد: <bdi dir="rtl">{readableDate}</bdi></> : "لم يُحدد تاريخ بعد."}
      </small>
    </label>
  );
}
