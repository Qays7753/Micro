/**
 * S10 (UNIT-032 — أمر b56967d8): «حساباتي المحفوظة» داخل الحاسبة فقط —
 * تظهر عند وجود محفوظ واحد على الأقل وتختفي بعد حذف الأخير (U032-AC02).
 * فتح الحساب يعيد مدخلاته في محرر الحاسبة نفسه لا محررًا ثانيًا؛ الحذف
 * بتأكيد صريح لا يمس طلبًا ولا منتجًا ولا أي سجل آخر (U032-AC09/AC10).
 */
import { Calculator, Trash2 } from "lucide-react";
import { useState } from "react";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { businessDateFromTimestamp, formatLocalDate } from "@/presentation/formatters";
import type { CostEstimate } from "@/storage/local/types";

export function SavedCalculations({
  estimates,
  onOpen,
  onDelete,
}: {
  estimates: readonly CostEstimate[];
  onOpen: (estimate: CostEstimate) => void;
  onDelete: (id: string) => Promise<string | null>;
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (estimates.length === 0) return null;

  return (
    <section className="micro-settings-list" aria-label="حساباتي المحفوظة">
      <div className="micro-section-title">
        <Calculator aria-hidden="true" />
        <div>
          <span className="micro-overline">داخل الحاسبة</span>
          <h2>حساباتي المحفوظة</h2>
        </div>
      </div>
      {estimates.map(estimate => (
        <article className="micro-setting-row" key={estimate.id} data-testid="saved-calculation-row">
          <span className="micro-setting-icon">
            <Calculator aria-hidden="true" />
          </span>
          <div>
            <button className="micro-text-action" type="button" onClick={() => onOpen(estimate)}>
              <strong>{estimate.title}</strong>
            </button>
            <small>
              {estimate.planning ? (
                <>
                  حساب تخطيط · تكلفة التسعير{" "}
                  <MoneyValue
                    minor={estimate.planning.savedResult.pricingCostMinor}
                    className="micro-inline-number"
                  />
                  {estimate.planning.savedResult.expectedProfitMinor !== null ? (
                    <>
                      {" "}
                      · ربح متوقع{" "}
                      <MoneyValue
                        minor={estimate.planning.savedResult.expectedProfitMinor}
                        className="micro-inline-number"
                      />
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  حساب سابق · سعر الحماية{" "}
                  <MoneyValue minor={estimate.priceFloorMinor} className="micro-inline-number" />
                </>
              )}{" "}
              · <bdi dir="ltr">{formatLocalDate(businessDateFromTimestamp(estimate.updatedAt))}</bdi>
            </small>
            {!estimate.planning ? (
              <small className="micro-cost-disclaimer">حساب سابق — راجع الأسعار قبل استخدامه.</small>
            ) : null}
          </div>
          <button
            className="micro-icon-button"
            type="button"
            aria-label={`حذف حساب ${estimate.title}`}
            onClick={() => setConfirmDeleteId(current => (current === estimate.id ? null : estimate.id))}
          >
            <Trash2 aria-hidden="true" />
          </button>
          {confirmDeleteId === estimate.id ? (
            <p className="micro-estimate-delete-confirm" role="alert">
              احذف «{estimate.title}» نهائيًا؟ لا يحذف هذا أي طلب أو منتج أو سجل مالي.
              <button
                className="micro-text-action"
                type="button"
                onClick={() => {
                  setConfirmDeleteId(null);
                  void onDelete(estimate.id).then(failure => setError(failure));
                }}
              >
                احذفه
              </button>
              <button className="micro-text-action" type="button" onClick={() => setConfirmDeleteId(null)}>
                تراجع
              </button>
            </p>
          ) : null}
        </article>
      ))}
      {error ? (
        <p className="micro-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
