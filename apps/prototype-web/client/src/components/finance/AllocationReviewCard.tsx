/**
 * المجموعة ١ (توزيع المصروف المشترك): بطاقة مراجعة قبل الحفظ — صفوف
 * «تسمية: قيمة» لا معادلات داخلية (سلامة الاتجاه ثنائي الاتجاه)، والقيم
 * بالوسم المالي الموحد (MoneyValue — أرقام إنجليزية داخل bdi ltr).
 * الحصة تُشتق بالدالة نفسها التي يحفظ بها السجل (`calculateSharedProjectShareMinor`)
 * — المعاينة والحفظ مصدر واحد، والتقريب نصف الأعلى نفسه.
 */
import { calculateSharedProjectShareMinor } from "@micro-domain/financial-event/index.js";
import { MoneyValue } from "@/components/presentation/DisplayValue";

export type AllocationReviewMode = "fixed" | "percentage" | "estimate" | "defer";

export type AllocationReviewCardProps = {
  mode: AllocationReviewMode;
  /** حصة المشروع المُدخلة (fixed/estimate) أو إجمالي المصدر (defer). */
  amountMinor: number;
  /** إجمالي المصروف المشترك (percentage فقط). */
  sharedTotalAmountMinor: number;
  /** نسبة حصة المشروع بالمئة 0–100 (percentage فقط). */
  sharedPercentage: number;
  valid: boolean;
};

export function AllocationReviewCard(props: AllocationReviewCardProps) {
  const { mode, amountMinor, sharedTotalAmountMinor, sharedPercentage, valid } = props;
  let percentageRows: readonly { label: string; minor: number; note?: string }[] | null = null;
  if (mode === "percentage" && valid && sharedTotalAmountMinor > 0 && sharedPercentage > 0) {
    try {
      const shareMinor = calculateSharedProjectShareMinor(
        sharedTotalAmountMinor,
        Math.round(sharedPercentage * 100),
      );
      percentageRows = [
        { label: "إجمالي المصروف المشترك", minor: sharedTotalAmountMinor },
        { label: `حصة المشروع (${sharedPercentage}%)`, minor: shareMinor },
        {
          label: "الباقي خارج حصة المشروع — بيت أو نشاط آخر",
          minor: sharedTotalAmountMinor - shareMinor,
        },
      ];
    } catch {
      percentageRows = null;
    }
  }
  return (
    <section className="micro-allocation-review" aria-label="مراجعة التوزيع قبل الحفظ">
      <span className="micro-overline">مراجعة قبل الحفظ</span>
      <h3>توزيع المصروف المشترك</h3>
      {mode === "percentage" ? (
        percentageRows ? (
          <dl>
            {percentageRows.map(row => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>
                  <MoneyValue minor={row.minor} /> د.أ
                </dd>
              </div>
            ))}
            <div>
              <dt>المتبقي غير موزّع</dt>
              <dd>
                <MoneyValue minor={0} /> د.أ — الحصة موزعة بالكامل
              </dd>
            </div>
          </dl>
        ) : (
          <p>أدخل الإجمالي والنسبة لترى المراجعة — لا تُحفظ نسبة بلا إجمالي معلن.</p>
        )
      ) : mode === "defer" ? (
        <dl>
          <div>
            <dt>إجمالي المصروف المصدر</dt>
            <dd>
              <MoneyValue minor={amountMinor} /> د.أ
            </dd>
          </div>
          <div>
            <dt>المتبقي غير موزّع</dt>
            <dd>
              <MoneyValue minor={amountMinor} /> د.أ — كامل المبلغ
            </dd>
          </div>
        </dl>
      ) : (
        <dl>
          <div>
            <dt>حصة المشروع التي ستُحفظ</dt>
            <dd>
              <MoneyValue minor={amountMinor} /> د.أ
            </dd>
          </div>
          <div>
            <dt>إجمالي المصدر</dt>
            <dd>غير محفوظ — أدخل حصة المشروع فقط</dd>
          </div>
        </dl>
      )}
      <p className="micro-expense-route-note">
        {mode === "percentage" || mode === "fixed"
          ? "حصة مؤكدة تدخل نتيجة الفترة مرة واحدة، والباقي خارج المشروع لا يُحمّل عليه."
          : mode === "estimate"
            ? "تقدير المالك — الصورة تبقى ناقصة وتُصرَّح النتيجة بأنها تقديرية."
            : "الحصة مؤجلة — لا تصير صفرًا ولا تدخل النتيجة حتى توزّعها بقرار موثق."}
      </p>
    </section>
  );
}
