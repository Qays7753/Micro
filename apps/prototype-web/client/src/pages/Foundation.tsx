/* مبدأ Micro: صفحة الأساس سؤال موقف لا معالج إجباري — تمرّر بحرية، وكل قسم قابل للتخطي (القرارات ٤–٧). */
/* §2.5: ثلاثة أسطح لا واحد — هذه صفحة تأسيس تمرّر بحرية؛ الكاش مفتوح والباقي مطوي،
 * وكل قسم مطوي يعرض حالته بسطر واحد. لا إجبار إلا الاسم. */
import { ArrowLeft, Boxes, CircleDollarSign, FileUp, Landmark, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { CashContinuityOverview } from "@/application/cash/cashContinuityService";
import type { OwnerEntitlementOverview } from "@/application/finance/ownerEntitlementService";
import type { SupplierPurchaseSummary } from "@/application/suppliers/supplierPurchaseService";
import type { InventoryOverview } from "@/application/inventory/inventoryMaterialService";
import { IntegerValue, MoneyValue } from "@/components/presentation/DisplayValue";

type FoundationState =
  | { phase: "loading" }
  | { phase: "error" }
  | {
      phase: "ready";
      cash: CashContinuityOverview;
      owner: OwnerEntitlementOverview;
      suppliers: SupplierPurchaseSummary;
      materials: InventoryOverview;
    };

export default function Foundation() {
  const [, navigate] = useLocation();
  const { cashContinuity, ownerEntitlement, supplierPurchases, inventory, dataVersion } =
    usePrototypeServices();
  const [state, setState] = useState<FoundationState>({ phase: "loading" });
  useEffect(() => {
    let active = true;
    Promise.all([
      cashContinuity.overview(),
      ownerEntitlement.readOverview(),
      supplierPurchases.readSummary(),
      inventory.overview(),
    ]).then(([cash, owner, suppliers, materials]) => {
      if (!active) return;
      if (!cash.ok || !owner.ok || !suppliers.ok || !materials.ok) {
        setState({ phase: "error" });
        return;
      }
      setState({
        phase: "ready",
        cash: cash.value,
        owner: owner.value,
        suppliers: suppliers.value,
        materials: materials.value,
      });
    });
    return () => {
      active = false;
    };
  }, [cashContinuity, ownerEntitlement, supplierPurchases, inventory, dataVersion]);
  if (state.phase === "loading")
    return (
      <div className="micro-route-loading" role="status">
        جارٍ قراءة موقف البداية…
      </div>
    );
  if (state.phase === "error")
    return (
      <section className="micro-page micro-not-found">
        <h1>تعذر قراءة الموقف</h1>
        <p>لم يتم تغيير بياناتك. أعد فتح التطبيق للمحاولة.</p>
        <button
          className="micro-button micro-button-primary"
          type="button"
          onClick={() => navigate("/")}
        >
          مشروعي الآن
        </button>
      </section>
    );
  const { cash, owner, suppliers, materials } = state;
  return (
    <section className="micro-page micro-foundation-page">
      <div className="micro-page-heading">
        <span className="micro-overline">خطوة التأسيس · اختيارية بالكامل</span>
        <h1>شو عندك هلق؟</h1>
        <p>سجل ما تعرفه الآن فقط. ما تخطّاه يظهر لاحقًا في «مشروعي الآن» كطريق، لا كصفر.</p>
      </div>
      <section className="micro-foundation-truth" aria-label="سطر الحقيقة">
        <span className="micro-overline">سطر الحقيقة</span>
        <p>
          هذه الأرقام أساس كل ما سيقوله التطبيق. ما لا تسجّله الآن تُسلّطه لاحقًا من المكان نفسه — يظهر
          «غير متاح» بسببه ولا يُخترع له صفر. والتعديل لاحقًا يكون تراجعًا موثقًا، لا حذفًا.
        </p>
      </section>
      <details className="micro-foundation-section" open>
        <summary className="micro-foundation-summary">
          <span>
            <b>الكاش</b>
            <small>
              {cash.wallets.length > 0
                ? `${cash.wallets.length} محفظة · كاش المحافظ: `
                : "لم تسجل محفظة بعد"}
              {cash.wallets.length > 0 ? <MoneyValue minor={cash.totalWalletCashMinor} /> : null}
            </small>
          </span>
          <strong>{cash.wallets.length > 0 ? "أضف محفظة أخرى" : "ابدأ من هنا"}</strong>
        </summary>
        <div className="micro-foundation-body">
          <p>
            <WalletCards aria-hidden="true" /> رصيد البداية ليس مال مالك ولا دخلًا؛ إنه نقطة معلنة تبدأ
            منها مراجعة الكاش. تاريخ البداية يقبل يومًا سابقًا ويُعلن أنه أُدخل لاحقًا.
          </p>
          <button
            className="micro-button micro-button-primary"
            type="button"
            onClick={() => navigate("/cash/wallet/new")}
          >
            محفظة ورصيد بداية <ArrowLeft aria-hidden="true" />
          </button>
        </div>
      </details>
      <details className="micro-foundation-section" open>
        <summary className="micro-foundation-summary">
          <span>
            <b>رأس مالك</b>
            <small>
              {owner.approvedEntitlementMinor > 0 || owner.openingBalanceMinor !== 0 ? (
                <>
                  حق مسجل: <MoneyValue minor={owner.approvedEntitlementMinor} className="micro-inline-number" />
                </>
              ) : (
                "لم يسجل رأس مال بعد — اختياري بالكامل"
              )}
            </small>
          </span>
          <strong>استثمار أو رصيد سابق</strong>
        </summary>
        <div className="micro-foundation-body">
          <p>
            <CircleDollarSign aria-hidden="true" /> مال المالك لا يدخل نتيجة الفترة ولا يتحول إلى بيع أو
            مصروف. ابدأ باستثمار نقدي، أو برصيد سابق لحقك عند المشروع.
          </p>
          <div className="micro-foundation-actions">
            <button
              className="micro-button micro-button-secondary"
              type="button"
              onClick={() => navigate("/finance/new/owner_investment_cash")}
            >
              سجل استثمارًا نقديًا
            </button>
            <button
              className="micro-button micro-button-secondary"
              type="button"
              onClick={() => navigate("/finance/owner-entitlement")}
            >
              رصيد سابق لحق المالك
            </button>
          </div>
        </div>
      </details>
      <details className="micro-foundation-section">
        <summary className="micro-foundation-summary">
          <span>
            <b>ديون قائمة</b>
            <small>
              {suppliers.purchaseCount > 0 ? (
                <>
                  عليك للموردين:{" "}
                  <MoneyValue minor={suppliers.supplierPayablesMinor} className="micro-inline-number" /> من{" "}
                  <IntegerValue value={suppliers.purchaseCount} className="micro-inline-number" /> شراء
                </>
              ) : (
                "الديون: لم يُسجَّل شيء"
              )}
            </small>
          </span>
          <strong>اختياري — افتحه عند الحاجة</strong>
        </summary>
        <div className="micro-foundation-body">
          <p>
            <Landmark aria-hidden="true" /> الدين التزام مسجل وليس كاشًا محصلًا، ولا يدخل نتيجة الفترة
            حتى يُسدَّد أو يُوزَّع بقاعدة معلنة.
          </p>
          <div className="micro-foundation-actions">
            <button
              className="micro-button micro-button-secondary"
              type="button"
              onClick={() => navigate("/finance/new/operating_expense_payable")}
            >
              سجل التزامًا لمورد
            </button>
            <button
              className="micro-button micro-button-secondary"
              type="button"
              onClick={() => navigate("/suppliers/purchase/new")}
            >
              شراء مواد قائم
            </button>
          </div>
        </div>
      </details>
      <details className="micro-foundation-section">
        <summary className="micro-foundation-summary">
          <span>
            <b>مواد متوفرة</b>
            <small>
              {materials.materials.length > 0 ? (
                <>
                  <IntegerValue value={materials.materials.length} /> مادة مسجلة في المخزون المحلي
                </>
              ) : (
                "المواد: لم تسجل مادة بعد"
              )}
            </small>
          </span>
          <strong>اختياري — افتحه عند الحاجة</strong>
        </summary>
        <div className="micro-foundation-body">
          <p>
            <Boxes aria-hidden="true" /> قيمة المادة المتاحة ليست مصروفًا ولا تكلفة بيع؛ ينتقل المستهلك
            أو المهدر فقط إلى أثر واضح.
          </p>
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => navigate("/inventory/material/new")}
          >
            مادة ورصيد بداية <ArrowLeft aria-hidden="true" />
          </button>
        </div>
      </details>
      <section className="micro-foundation-file">
        <FileUp aria-hidden="true" />
        <div>
          <b>عندي ملف موقف جاهز</b>
          <p>إن كنت تصدّر موقفًا كاملًا من جهاز آخر، أدخله من الإعدادات بدل إدخاله يدويًا.</p>
        </div>
        <button
          className="micro-text-action"
          type="button"
          onClick={() => navigate("/settings")}
        >
          فتح الاستيراد <ArrowLeft aria-hidden="true" />
        </button>
      </section>
      <section className="micro-foundation-exit" aria-label="الخروج من صفحة الأساس">
        <p>
          التخطي فعل واعٍ: كل ما تركته فارغًا يظهر في «مشروعي الآن» كطريق «سجّله»، ولا يتحول إلى صفر.
        </p>
        <div className="micro-foundation-actions">
          <button
            className="micro-button micro-button-secondary"
            type="button"
            onClick={() => navigate("/")}
          >
            تخطَّ وأكمل لاحقًا
          </button>
          <button
            className="micro-button micro-button-primary"
            type="button"
            onClick={() => navigate("/")}
          >
            ادخل إلى مشروعي <ArrowLeft aria-hidden="true" />
          </button>
        </div>
      </section>
    </section>
  );
}
