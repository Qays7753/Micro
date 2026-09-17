/**
 * «أدواتي» (owner principle 5.4): an independent top-level destination.
 * المجموعة ٣ (Scope A/B): الحاسبة صارت مسارًا عميقًا كاملًا (/tools/calculator) بزره هنا،
 * والتقديرات المحفوظة تفتح صفحتها (/tools/estimate/:id) — القراءة والفعل هناك.
 * الحاسبة تعمل بلا طلب وبلا مخزون، ولا تنشئ أي حركة مالية — القاعدة معلنة هنا وهناك.
 *
 * Wave 4.2 — P-4.2-2 (قرارات المالك F03 + T4/T5/T6): أدوات مستقلة فقط.
 * - حُذف قسم «حالة الوحدات» كاملًا — الإعدادات هي بيت التهيئة والقدرات الوحيد (F03).
 * - حُذفت بطاقة النسخ الاحتياطي (T4) — بيتها «البيانات والنسخ الاحتياطي» في الإعدادات (P-4.2-3).
 * - حُذفت قراءات partyLedger/supplierPurchases وشاراتهما (T5) — حالة كل وحدة تُقرأ من بيتها.
 * - حُذف صف «السوق والتوصيل» الميت (T6) — تمثيل السوق مقعده والنقل لوحة ترويسته.
 * لا خدمات حُذفت ولا مسارات — تنظيف سطح قارئ فقط.
 */
import { ArrowLeft, Calculator, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { withReturnTo } from "@/app/navigationContract";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { formatLocalDate } from "@/presentation/formatters";
import type { CostEstimate } from "@/storage/local/types";

import { Button } from "@/components/primitives";

export default function Tools() {
  const [, navigate] = useLocation();
  const { costEstimates, dataVersion, notifyDataChanged } = usePrototypeServices();
  const [message, setMessage] = useState<string | null>(null);
  /* المجموعة ٦ (تدقيق A1 — UX-02): آلة الحالة القياسية (تحميل/خطأ/جاهز) كما في
   * الصفحات الأخرى — القراءة الفاشلة كانت تُبتلع صامتًا فتبدو «أدواتي» فارغة
   * وكأن تقديرات المالك ضاعت، والشاشة إحدى مقاعد التنقل الخمسة. */
  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");
  const [reloadToken, setReloadToken] = useState(0);
  /* التقديرات المحفوظة — مخزن الأداة المستقل وحده (عقد 40 §3). */
  const [savedEstimates, setSavedEstimates] = useState<readonly CostEstimate[]>([]);

  useEffect(() => {
    let active = true;
    setPhase("loading");
    costEstimates.list().then(result => {
      if (!active) return;
      if (!result.ok) setPhase("error");
      else {
        setSavedEstimates(result.value);
        setPhase("ready");
      }
    });
    return () => {
      active = false;
    };
  }, [costEstimates, dataVersion, reloadToken]);

  async function removeEstimate(id: string) {
    const result = await costEstimates.remove(id);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    notifyDataChanged();
    const list = await costEstimates.list();
    if (list.ok) setSavedEstimates(list.value);
  }

  /* S3-01: حذف تقدير فعل تدميري — خطوة تأكيد ثانية تسمّي التقدير نفسه في القائمة
   * كما في صفحة التقدير (عقد التصميم §3.8) لا نقرة واحدة عابرة. */
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  return (
    <section className="micro-page micro-tools-page">
      <div className="micro-page-heading">
        <span className="micro-overline">أدواتي</span>
        <h1>احسب قبل أن تلتزم</h1>
        <p>أدوات مستقلة للحساب والتقدير، لا تغيّر سجلات مشروعك — والنتيجة تقديرية دومًا.</p>
      </div>

      {phase === "loading" ? (
        <p className="micro-route-loading" role="status" aria-live="polite">
          جارٍ قراءة أدواتك المحلية…
        </p>
      ) : null}
      {phase === "error" ? (
        <div className="micro-storage-error" role="alert">
          <strong>تعذر قراءة أدواتك المحلية.</strong>
          <p>لم يتغير أي شيء — بياناتك كما هي على هذا الجهاز. أعد المحاولة.</p>
          <Button
            action="save"

            onClick={() => setReloadToken(token => token + 1)}
          >
            إعادة المحاولة
          </Button>
        </div>
      ) : null}

      {phase === "ready" ? (
        <>
          <section className="micro-decision-card" aria-label="قاعدة الأداة">
            <span>قاعدة هذه الأداة</span>
            <strong>هذا حساب تقديري. ما انحفظت أي حركة مالية ولا مخزون.</strong>
            <p>الحاسبة لا تمس الكاش ولا الأرصدة ولا التقارير. قرار التسجيل يبقى فعلًا منفصلًا ومقصودًا.</p>
          </section>

          <section className="micro-settings-list" aria-label="حاسبة التكلفة والسعر">
            <article className="micro-setting-row">
              <span className="micro-setting-icon">
                <Calculator aria-hidden="true" />
              </span>
              <div>
                <strong>حاسبة التكلفة والسعر</strong>
                <small>مواد ووقت وبنود اختيارية → سعر حماية حي</small>
                <div className="micro-form-actions">
                  <button
                    className="micro-text-action"
                    type="button"
                    onClick={() => navigate(withReturnTo("/tools/calculator", "/tools"))}
                  >
                    افتح الحاسبة <ArrowLeft aria-hidden="true" />
                  </button>
                </div>
              </div>
            </article>
          </section>

          <section className="micro-settings-list" aria-label="التقديرات المحفوظة">
            <div className="micro-section-title">
              <Calculator aria-hidden="true" />
              <div>
                <span className="micro-overline">للمراجعة لاحقًا</span>
                <h2>تقديراتي المحفوظة</h2>
              </div>
            </div>
            {savedEstimates.length === 0 ? (
              <p className="micro-home-quiet">
                <strong>لا توجد تقديرات محفوظة بعد.</strong> احسب تكلفة منتج جديد وشاهد كيف تسير الأرقام.
              </p>
            ) : (
              savedEstimates.map(estimate => (
                <article className="micro-setting-row" key={estimate.id}>
                  <span className="micro-setting-icon">
                    <Calculator aria-hidden="true" />
                  </span>
                  <div>
                    <button
                      className="micro-text-action"
                      type="button"
                      onClick={() =>
                        navigate(withReturnTo(`/tools/estimate/${encodeURIComponent(estimate.id)}`, "/tools"))
                      }
                    >
                      <strong>{estimate.title}</strong>
                    </button>
                    <small>
                      تقديري · سعر الحماية{" "}
                      <MoneyValue minor={estimate.priceFloorMinor} className="micro-inline-number" /> ·{" "}
                      <bdi dir="ltr">{formatLocalDate(estimate.updatedAt.slice(0, 10))}</bdi>
                    </small>
                    {/* U-004: جسر التقدير → المسودة — نسخ قيم مقترحة قابلة للتعديل؛ التقدير لا يتغير
                    ولا تُنشأ أي حركة مالية، والمسودة تُحفظ عند تأكيد المالك فقط. */}
                    <div className="micro-form-actions">
                      <button
                        className="micro-text-action"
                        type="button"
                        onClick={() =>
                          navigate(
                            withReturnTo(
                              `/orders/draft/new?intent=planned_design&estimate=${encodeURIComponent(estimate.id)}`,
                              "/tools",
                            ),
                          )
                        }
                      >
                        ابدأ مسودة من هذا التقدير
                      </button>
                    </div>
                  </div>
                  <button
                    className="micro-icon-button"
                    type="button"
                    aria-label={`حذف تقدير ${estimate.title}`}
                    onClick={() =>
                      setConfirmDeleteId(current => (current === estimate.id ? null : estimate.id))
                    }
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                  {confirmDeleteId === estimate.id ? (
                    <p className="micro-estimate-delete-confirm" role="alert">
                      احذف «{estimate.title}» نهائيًا؟ لا يمكن التراجع.
                      <button
                        className="micro-text-action"
                        type="button"
                        onClick={() => {
                          setConfirmDeleteId(null);
                          void removeEstimate(estimate.id);
                        }}
                      >
                        احذفه
                      </button>
                      <button
                        className="micro-text-action"
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        تراجع
                      </button>
                    </p>
                  ) : null}
                </article>
              ))
            )}
            {message ? (
              <p className="micro-field-error" role="status">
                {message}
              </p>
            ) : null}
          </section>
        </>
      ) : null}
    </section>
  );
}
