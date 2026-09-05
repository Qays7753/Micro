/**
 * «أدواتي» (owner principle 5.4): an independent top-level destination.
 * المجموعة ٣ (Scope A/B): الحاسبة صارت مسارًا عميقًا كاملًا (/tools/calculator) بزره هنا،
 * والتقديرات المحفوظة تفتح صفحتها (/tools/estimate/:id) — القراءة والفعل هناك.
 * الحاسبة تعمل بلا طلب وبلا مخزون، ولا تنشئ أي حركة مالية — القاعدة معلنة هنا وهناك.
 */
import { ArrowLeft, Calculator, Layers, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { withFrom } from "@/app/navigationContract";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { MoneyValue } from "@/components/presentation/DisplayValue";
import { formatLocalDate } from "@/presentation/formatters";
import type { CostEstimate } from "@/storage/local/types";

type ModuleState = "not_available" | "available_not_enabled" | "enabled" | "partially_configured";

const moduleStateLabel: Record<ModuleState, string> = {
  not_available: "غير متاح في هذه المرحلة",
  available_not_enabled: "متاح — غير مفعّل",
  enabled: "مفعّل",
  partially_configured: "مفعّل جزئيًا — أكمل بياناته",
  /* Q-003/D-006: حالة «متوقف مؤقتًا» أُزيلت — لم يكن لها مُنتِج حقيقي. */
};

export default function Tools() {
  const [, navigate] = useLocation();
  const {
    costEstimates,
    dataVersion,
    inventory,
    catalog,
    schedules,
    supplierPurchases,
    partyLedger,
    notifyDataChanged,
  } = usePrototypeServices();
  const [message, setMessage] = useState<string | null>(null);
  /* المجموعة ٦ (تدقيق A1 — UX-02): آلة الحالة القياسية (تحميل/خطأ/جاهز) كما في
   * الصفحات الأخرى — القراءة الفاشلة كانت تُبتلع صامتًا فتبدو «أدواتي» فارغة
   * وكأن تقديرات المالك ضاعت، والشاشة إحدى مقاعد التنقل الخمسة. */
  const [phase, setPhase] = useState<"loading" | "error" | "ready">("loading");
  const [reloadToken, setReloadToken] = useState(0);
  /* التقديرات المحفوظة + حالة الوحدات */
  const [savedEstimates, setSavedEstimates] = useState<readonly CostEstimate[]>([]);
  const [moduleStates, setModuleStates] = useState<
    readonly { label: string; state: ModuleState; href: string }[]
  >([]);

  useEffect(() => {
    let active = true;
    setPhase("loading");
    let failed = false;
    costEstimates.list().then(result => {
      if (!active) return;
      if (!result.ok) failed = true;
      else setSavedEstimates(result.value);
    });
    /* D-006: حالات الوحدات مشتقة من بيانات فعلية — لا سلسلة مثبتة تقول «غير مفعّل»
     * لما فيه بيانات. الوحدة بلا منتج للحالة لا تدّعي حالة. */
    Promise.all([
      inventory.readActivation(),
      catalog.listUnits(),
      catalog.list(),
      schedules.overview(),
      supplierPurchases.readSummary(),
      partyLedger.read(),
    ]).then(([activation, units, items, scheduleOverview, purchases, parties]) => {
      if (!active) return;
      if (!activation.ok || !units.ok || !items.ok || failed) {
        setPhase("error");
        return;
      }
      const catalogConfigured = items.items.length > 0;
      const scheduleConfigured =
        scheduleOverview.ok &&
        scheduleOverview.value.overdue.length +
          scheduleOverview.value.today.length +
          scheduleOverview.value.upcoming.length +
          scheduleOverview.value.completedOrClosed >
          0;
      const suppliersConfigured = purchases.ok && purchases.value.purchaseCount > 0;
      const partiesConfigured = parties.ok && parties.value.parties.length > 0;
      setModuleStates([
        {
          label: "حاسبة التكلفة",
          state: "enabled",
          href: "/tools/calculator",
        },
        /* المجموعة ١ (فحص سلامة مالي): متاح دائمًا — قراءة فقط لا يعتمد على
         * بيانات؛ حالته «مفعّل» صادقة من يومها الأول (D-006: مشتقة من حقيقة). */
        {
          label: "فحص سلامة مالي",
          state: "enabled",
          href: "/tools/integrity",
        },
        {
          label: "المخزون",
          state: activation.value.activatedOn ? "enabled" : "available_not_enabled",
          href: "/inventory",
        },
        {
          label: "الكتالوج والقوالب",
          state: catalogConfigured
            ? "enabled"
            : units.units.length > 0
              ? "partially_configured"
              : "available_not_enabled",
          href: "/catalog",
        },
        {
          label: "المواعيد والمتابعات",
          state: scheduleConfigured ? "enabled" : "available_not_enabled",
          href: "/schedule",
        },
        {
          label: "الموردون والمشتريات",
          state: suppliersConfigured ? "enabled" : "available_not_enabled",
          href: "/suppliers",
        },
        {
          label: "دفتر الناس",
          state: partiesConfigured ? "enabled" : "available_not_enabled",
          href: "/parties",
        },
        { label: "السوق والتوصيل", state: "not_available", href: "/tools" },
      ]);
      setPhase("ready");
    });
    return () => {
      active = false;
    };
  }, [
    costEstimates,
    inventory,
    catalog,
    schedules,
    supplierPurchases,
    partyLedger,
    dataVersion,
    reloadToken,
  ]);

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
        <p>حاسبة تفكير مستقلة: تعمل بلا طلب وبلا مخزون وبلا تسجيل منتج — والنتيجة تقديرية دومًا.</p>
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
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => setReloadToken(token => token + 1)}
          >
            إعادة المحاولة
          </button>
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
                    onClick={() => navigate(withFrom("/tools/calculator", "/tools"))}
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
                <strong>ما في تقديرات محفوظة بعد.</strong> احسب تكلفة منتج جديد وشوف كيف بتمشي.
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
                        navigate(withFrom(`/tools/estimate/${encodeURIComponent(estimate.id)}`, "/tools"))
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
                            withFrom(
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

          <section className="micro-settings-list" aria-label="حالة الوحدات">
            <div className="micro-section-title">
              <Layers aria-hidden="true" />
              <div>
                <span className="micro-overline">ما هو مفعّل الآن</span>
                <h2>حالة الوحدات</h2>
              </div>
            </div>
            {moduleStates.map(module => (
              <article className="micro-setting-row" key={module.label} data-state={module.state}>
                <span className="micro-setting-icon">
                  <Layers aria-hidden="true" />
                </span>
                <div>
                  <strong>{module.label}</strong>
                  <small>{moduleStateLabel[module.state]}</small>
                </div>
                <button
                  className="micro-text-action"
                  type="button"
                  onClick={() => navigate(withFrom(module.href, "/tools"))}
                  disabled={module.state === "not_available"}
                >
                  افتح <ArrowLeft aria-hidden="true" />
                </button>
              </article>
            ))}
          </section>
        </>
      ) : null}
    </section>
  );
}
