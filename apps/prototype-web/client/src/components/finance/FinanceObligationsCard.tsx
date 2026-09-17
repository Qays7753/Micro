/**
 * Wave 4.3 — P-4.3-3 (F09/D8): سطح «شو عليّ؟» الموحد في المالية.
 * ---------------------------------------------------------------------------
 * الرقم المجمع من قراءة المركز المالية الرسمية وحدها، مفسرًا بمصدرَيه:
 * مبالغ للموردين (شراء مواد لم يُسدد بعد) ومصاريف مستحقة (التزامات مسجلة لم
 * تُسدد بعد) — لكل نوع مسار تسديده بالكاتب الرسمي القائم نفسه؛ لا Writer
 * جديد ولا تسوية موازية ولا دمج كتابة (قرار F09).
 */
import { HandCoins, Landmark } from "lucide-react";
import type { ProjectFinancialPosition } from "@/application/finance/projectFinancialService";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { withReturnTo } from "@/app/navigationContract";

const NOT_RECORDED = "غير مسجل";

export function FinanceObligationsCard({
  position,
  onNavigate,
}: {
  position: ProjectFinancialPosition;
  onNavigate: (href: string) => void;
}) {
  const recorded = position.evidence.supplierPayables === "recorded";
  /* تحليل عرض فقط لمركز رسمي واحد: مصاريف مستحقة = إجمالي الالتزامات ناقص
   * التزامات المشتريات — الحقلان معًا في قراءة المركز نفسها، لا معادلة مالية
   * جديدة ولا مصدر ثانٍ. */
  const suppliersMinor = position.supplierMaterialPayablesMinor;
  const expensesMinor = position.supplierPayablesMinor - position.supplierMaterialPayablesMinor;
  const totalMinor = position.supplierPayablesMinor;
  return (
    <section
      className="micro-obligations-card"
      aria-labelledby="obligations-title"
      data-testid="finance-obligations"
    >
      <div className="micro-section-title">
        <HandCoins aria-hidden="true" />
        <div>
          <h2 id="obligations-title">شو عليّ؟</h2>
        </div>
      </div>
      {/* السطر المساعد المعتمد (F09): اسم السطح يشرح مصدرَيه بلا مصطلح محاسبي. */}
      <p className="micro-obligations-empty">مبالغ للموردين ومصاريف مستحقة</p>
      {!recorded ? (
        <p className="micro-obligations-empty" role="status">
          {NOT_RECORDED} —{" "}
          <button
            className="micro-text-action"
            type="button"
            onClick={() => onNavigate(withReturnTo("/finance/new/operating_expense_payable", "/finance"))}
          >
            سجّل أول التزام
          </button>
        </p>
      ) : totalMinor === 0 ? (
        <p className="micro-obligations-empty" role="status">
          لا التزامات مستحقة مسجلة الآن — ما تسجله لاحقًا يظهر هنا بمصدره.
        </p>
      ) : (
        <>
          <div className="micro-obligations-total">
            <span>الإجمالي المستحق</span>
            <strong>
              <MoneyValue minor={totalMinor} /> د.أ
            </strong>
          </div>
          <div className="micro-obligations-row">
            <div>
              <strong>
                <Landmark aria-hidden="true" /> مبالغ للموردين
              </strong>
              <small>
                <MoneyValue minor={suppliersMinor} /> د.أ — شراء مواد لم يُسدد بعد
              </small>
            </div>
            <button
              className="micro-text-action"
              type="button"
              onClick={() => onNavigate(withReturnTo("/suppliers", "/finance"))}
            >
              سجّل تسديد شراء
            </button>
          </div>
          <div className="micro-obligations-row">
            <div>
              <strong>
                <HandCoins aria-hidden="true" /> مصاريف مستحقة
              </strong>
              <small>
                <MoneyValue minor={expensesMinor} /> د.أ — التزامات مسجلة لم تُسدد بعد
              </small>
            </div>
            <button
              className="micro-text-action"
              type="button"
              onClick={() => onNavigate(withReturnTo("/finance/new/payable_settlement_cash", "/finance"))}
            >
              سجّل تسديد التزام
            </button>
          </div>
        </>
      )}
    </section>
  );
}
