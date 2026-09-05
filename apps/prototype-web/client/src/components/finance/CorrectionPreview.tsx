/* المجموعة ٢ (§10.2 — CorrectionPreview): النمط الموحد لمعاينة أثر أي تصحيح مالي
 * قبل التأكيد — الأصل، الفعل، القيم قبل/بعد، الأثر الصافي بالأبعاد المالية، ما
 * يبقى دون تغيير، الرصيد الناتج، السبب المطلوب، وقابلية التراجع. مكوّن عرض فقط:
 * التنفيذ يبقى في سطحه المالك، وهذا يضمن ألا يُنفَّذ أثر مالي بلا معاينة صادقة. */
import type { ReactNode } from "react";
import { MoneyValue } from "@/components/presentation/DisplayValue";

export type CorrectionPreviewDimension = {
  /** اسم البعد المالي بالعربية: كاش، التزام، أمانات، مصروف… */
  label: string;
  /** القيمة الحالية (قبل التصحيح) — صفر يُعرض «لا أثر». */
  beforeMinor: number;
  /** القيمة بعد التصحيح — null = البعد لا ينطبق. */
  afterMinor: number | null;
};

export type CorrectionPreviewResulting = {
  label: string;
  amountMinor: number | null;
  /** «غير محدد بعد» حيث القيمة مجهولة — لا تُعرض صفرًا مختلقًا. */
  unknown?: boolean;
};

export function CorrectionPreview({
  action,
  originalLabel,
  originalDetail,
  intro,
  dimensions,
  unchanged,
  resulting,
  reversibleNote,
  reason,
  onReasonChange,
  reasonPlaceholder,
  children,
  error,
  busy,
  confirmLabel,
  busyLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  action: string;
  originalLabel: string;
  originalDetail?: string | null;
  intro: string;
  dimensions: readonly CorrectionPreviewDimension[];
  unchanged: readonly string[];
  resulting?: readonly CorrectionPreviewResulting[];
  reversibleNote: string;
  reason: string | null;
  onReasonChange: (value: string) => void;
  reasonPlaceholder?: string;
  children?: ReactNode;
  error: string | null;
  busy: boolean;
  confirmLabel: string;
  busyLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const changed = dimensions.filter(
    dimension => dimension.afterMinor !== null && dimension.afterMinor !== dimension.beforeMinor,
  );
  const untouched = dimensions.filter(
    dimension => dimension.afterMinor !== null && dimension.afterMinor === dimension.beforeMinor,
  );
  return (
    <div className="micro-finance-reversal-editor micro-correction-preview">
      <div className="micro-finance-reversal-review">
        <strong>{action}</strong>
        <p>{intro}</p>
        <dl>
          <div>
            <dt>السجل الأصلي</dt>
            <dd>
              {originalLabel}
              {originalDetail ? ` · ${originalDetail}` : ""}
            </dd>
          </div>
          {changed.length > 0 ? (
            <div>
              <dt>القيم قبل وبعد التصحيح</dt>
              <dd>
                {changed.map(dimension => (
                  <span key={dimension.label}>
                    {dimension.label} <MoneyValue minor={dimension.beforeMinor} /> →{" "}
                    <MoneyValue minor={dimension.afterMinor ?? 0} showPlus /> د.أ
                  </span>
                ))}
              </dd>
            </div>
          ) : null}
          {untouched.length > 0 ? (
            <div>
              <dt>لا يتغير</dt>
              <dd>
                {untouched.map(dimension => (
                  <span key={dimension.label}>{dimension.label}</span>
                ))}
              </dd>
            </div>
          ) : null}
          {unchanged.length > 0 ? (
            <div>
              <dt>يبقى كما هو</dt>
              <dd>{unchanged.join(" · ")}</dd>
            </div>
          ) : null}
          {resulting && resulting.length > 0 ? (
            <div>
              <dt>بعد التصحيح</dt>
              <dd>
                {resulting.map(item => (
                  <span key={item.label}>
                    {item.label}{" "}
                    {item.unknown || item.amountMinor === null ? (
                      "غير محدد بعد"
                    ) : (
                      <MoneyValue minor={item.amountMinor} />
                    )}
                  </span>
                ))}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>
      {reason !== null ? (
        <label className="micro-field">
          <span>
            سبب التصحيح <small>مطلوب · لا يُقبل فارغًا</small>
          </span>
          <textarea
            value={reason}
            onChange={input => onReasonChange(input.target.value)}
            placeholder={reasonPlaceholder ?? "مثال: سُجّل المبلغ خطأً"}
            autoFocus
          />
        </label>
      ) : null}
      {children}
      <p className="micro-local-truth">{reversibleNote}</p>
      {error ? (
        <p className="micro-field-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="micro-form-actions">
        <button
          className={`micro-button ${danger ? "micro-button-danger" : "micro-button-primary"}`}
          type="button"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? busyLabel : confirmLabel}
        </button>
        <button
          className="micro-button micro-button-secondary"
          type="button"
          disabled={busy}
          onClick={onCancel}
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
