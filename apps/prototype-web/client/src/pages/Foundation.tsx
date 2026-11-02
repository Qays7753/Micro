/* مبدأ Micro: صفحة الأساس سؤال موقف لا معالج إجباري — تمرّر بحرية، وكل قسم قابل للتخطي (القرارات ٤–٧). */
/* §2.5: ثلاثة أسطح لا واحد — هذه صفحة تأسيس تمرّر بحرية؛ الكاش مفتوح والباقي مطوي،
 * وكل قسم مطوي يعرض حالته بسطر واحد. لا إجبار إلا الاسم. */
import {
  ArrowLeft,
  Boxes,
  CircleDollarSign,
  ClipboardList,
  FileUp,
  Landmark,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { withReturnTo } from "@/app/navigationContract";
import { getPrototypeLocalStore, usePrototypeServices } from "@/app/PrototypeServicesContext";
import { useDisabledCapabilities } from "@/app/useDisabledCapabilities";
import { CashContinuityOverview } from "@/application/cash";
import type { OwnerEntitlementOverview } from "@/application/owner-money";
import type { SupplierPurchaseSummary } from "@/application/suppliers";
import type { InventoryOverview } from "@/application/inventory";
import { IntegerValue, MoneyValue } from "@/components/presentation/DisplayValue";
import {
  AccountCompletionService,
  type AccountCompletionInput,
  type AccountCompletionPreview,
} from "@/application/transfers";
import { parseEnglishNumericText } from "@/application/input";
import { isValidLocalDate } from "@/presentation/formatters";

import { Button } from "@/components/primitives";
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
  const { disabled: disabledCapabilities } = useDisabledCapabilities();
  /* G-004: الأساس يبقى دائم الوصول؛ مداخل الإدخال للقدرات المتوقفة
   * تختفي والشرح يبقى (قرار الإعدادات: الأساس لا يُوقف). */
  const suppliersEntryEnabled = !disabledCapabilities.includes("suppliers");
  const inventoryEntryEnabled = !disabledCapabilities.includes("inventory");
  const [state, setState] = useState<FoundationState>({ phase: "loading" });
  const [retryCount, setRetryCount] = useState(0);
  useEffect(() => {
    let active = true;
    /* S07 (سابقة transfers/loans): خدمة المشتريات كسولة — null = «جارٍ
     * التجهيز» فيبقى الأساس على حالة التحميل الصادقة وتُعاد القراءة فور
     * جاهزيتها (dependency على الخدمة نفسها). */
    if (!supplierPurchases) return undefined;
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
  }, [cashContinuity, ownerEntitlement, supplierPurchases, inventory, dataVersion, retryCount]);
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
        <p role="alert">لم يتم تغيير بياناتك. أعد فتح التطبيق للمحاولة.</p>
        <div className="micro-form-actions">
          <Button action="save" onClick={() => setRetryCount(count => count + 1)}>
            إعادة المحاولة
          </Button>
        </div>
        <Button action="secondary" onClick={() => navigate("/")}>
          مشروعي الآن
        </Button>
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
          هذه الأرقام أساس كل ما سيقوله التطبيق. ما لا تسجّله الآن تُسلّطه لاحقًا من المكان نفسه — يظهر «غير
          متاح» بسببه ولا يُخترع له صفر. والتعديل لاحقًا يكون تراجعًا موثقًا، لا حذفًا.
        </p>
      </section>
      <details className="micro-foundation-section" open>
        <summary className="micro-foundation-summary">
          <span>
            <b>الكاش</b>
            <small>
              {cash.wallets.length > 0 ? `${cash.wallets.length} محفظة · كاش المحافظ: ` : "لم تسجل محفظة بعد"}
              {cash.wallets.length > 0 ? <MoneyValue minor={cash.totalWalletCashMinor} /> : null}
            </small>
          </span>
          <strong>{cash.wallets.length > 0 ? "أضف محفظة أخرى" : "ابدأ من هنا"}</strong>
        </summary>
        <div className="micro-foundation-body">
          <p>
            <WalletCards aria-hidden="true" /> رصيد البداية ليس مال مالك ولا دخلًا؛ إنه نقطة معلنة تبدأ منها
            مراجعة الكاش. تاريخ البداية يقبل يومًا سابقًا ويُعلن أنه أُدخل لاحقًا.
          </p>
          {/* SET-002: لماذا؟ ما الذي يتأثر؟ هل للأثر المالي؟ أين تظهر النتيجة؟ */}
          <dl className="micro-foundation-explain">
            <div>
              <dt>لماذا يفيدك؟</dt>
              <dd>بدونه يبقى الكاش «غير مسجل» ولا تستطيع مراجعة مصروفك من محفظة معلنة.</dd>
            </div>
            <div>
              <dt>ما الذي يتأثر؟</dt>
              <dd>بطاقة الكاش في «مشروعي الآن» وقسم «المالية» ودفتر المحفظة.</dd>
            </div>
            <div>
              <dt>الأثر المالي</dt>
              <dd>تسجيل الرصيد الافتتاحي وحده لا يخلق مصروفًا ولا إيرادًا ولا ربحًا.</dd>
            </div>
            <div>
              <dt>أين تظهر النتيجة؟</dt>
              <dd>في «الكاش المسجل» وفي دفتر كل محفظة وحركاتها.</dd>
            </div>
          </dl>
          <Button
            action="create"

            onClick={() => navigate("/cash/wallet/new")}
          >
            محفظة ورصيد بداية <ArrowLeft aria-hidden="true" />
          </Button>
        </div>
      </details>
      <details className="micro-foundation-section" open>
        <summary className="micro-foundation-summary">
          <span>
            <b>رأس مالك</b>
            <small>
              {owner.approvedEntitlementMinor > 0 || owner.openingBalanceMinor !== 0 ? (
                <>
                  حق مسجل:{" "}
                  <MoneyValue minor={owner.approvedEntitlementMinor} className="micro-inline-number" />
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
          {/* SET-002: رأس المالك — لماذا/ما يتأثر/الأثر المالي/أين تظهر النتيجة. */}
          <dl className="micro-foundation-explain">
            <div>
              <dt>لماذا يفيدك؟</dt>
              <dd>يفرق حقك في المشروع عن ربحه، فتعرف ما يخصك عند السحب.</dd>
            </div>
            <div>
              <dt>ما الذي يتأثر؟</dt>
              <dd>بطاقة «مال المالك المسجل» في الرئيسية ودفتر مال المالك في المالية.</dd>
            </div>
            <div>
              <dt>الأثر المالي</dt>
              <dd>الاستثمار المسجل وحده ليس إيرادًا ولا ربحًا؛ يظهر حقًا لك فقط.</dd>
            </div>
            <div>
              <dt>أين تظهر النتيجة؟</dt>
              <dd>في دفتر مال المالك وفي فروقه مع النتيجة.</dd>
            </div>
          </dl>

          <div className="micro-foundation-actions">
            <Button
              action="secondary"

              onClick={() => navigate("/finance/new/owner_investment_cash")}
            >
              سجّل استثمارًا نقديًا
            </Button>
            <Button
              action="secondary"

              onClick={() => navigate("/finance/owner-entitlement")}
            >
              رصيد سابق لحق المالك
            </Button>
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
            <Landmark aria-hidden="true" /> الدين التزام مسجل وليس كاشًا محصلًا، ولا يدخل نتيجة الفترة حتى
            يُسدَّد أو يُوزَّع بقاعدة معلنة.
          </p>
          {/* SET-002: ديون قائمة — لماذا/ما يتأثر/الأثر المالي/أين تظهر النتيجة. */}
          <dl className="micro-foundation-explain">
            <div>
              <dt>لماذا يفيدك؟</dt>
              <dd>يلتزم التطبيق بأرقامك القائمة من أول يوم بدل البدء كأنها غير موجودة.</dd>
            </div>
            <div>
              <dt>ما الذي يتأثر؟</dt>
              <dd>«عليّ للموردين» في المالية ودفتر الموردين.</dd>
            </div>
            <div>
              <dt>الأثر المالي</dt>
              <dd>تسجيل الالتزام لا يخصم كاشًا؛ الدفع لاحقًا هو الذي يحركه.</dd>
            </div>
            <div>
              <dt>أين تظهر النتيجة؟</dt>
              <dd>في ذمة المورد وتفاصيل شرائه ودفعاته.</dd>
            </div>
          </dl>

          <div className="micro-foundation-actions">
            <Button
              action="secondary"

              onClick={() => navigate("/finance/new/operating_expense_payable")}
            >
              سجّل التزامًا لمورد
            </Button>
            {suppliersEntryEnabled ? (
              <Button action="secondary" onClick={() => navigate("/suppliers/purchase/new")}>
                شراء مواد قائم
              </Button>
            ) : null}
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
            <Boxes aria-hidden="true" /> رصيد مادتك المعلن يغذي مقترحات التكلفة ومتابعة الكميات.
          </p>
          {/* SET-002: مواد متوفرة — لماذا/ما يتأثر/الأثر المالي/أين تظهر النتيجة. */}
          <dl className="micro-foundation-explain">
            <div>
              <dt>لماذا يفيدك؟</dt>
              <dd>تحسب تكلفة أعمالك القادمة من أرصدتك الفعلية لا من الذاكرة.</dd>
            </div>
            <div>
              <dt>ما الذي يتأثر؟</dt>
              <dd>مقترحات المواد في محرر التكلفة وسطح المخزون من «العمل».</dd>
            </div>
            <div>
              <dt>الأثر المالي</dt>
              <dd>تسجيل الرصيد وحده لا يخلق مصروفًا؛ الاستهلاك والهدر هما الأثر.</dd>
            </div>
            <div>
              <dt>أين تظهر النتيجة؟</dt>
              <dd>في أرصدة المواد وحركاتها وقيمة المخزون.</dd>
            </div>
          </dl>
          {inventoryEntryEnabled ? (
            <Button action="secondary" onClick={() => navigate("/inventory/material/new")}>
              مادة ورصيد بداية <ArrowLeft aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </details>
      <AccountCompletionJourney />

      <section className="micro-foundation-file">
        <FileUp aria-hidden="true" />
        <div>
          <b>عندي ملف موقف جاهز</b>
          <p>إن كنت تصدّر موقفًا كاملًا من جهاز آخر، أدخله من الإعدادات بدل إدخاله يدويًا.</p>
        </div>
        <button
          className="micro-text-action"
          type="button"
          onClick={() => navigate(withReturnTo("/settings?focus=guided-import", "/foundation"))}
        >
          فتح الاستيراد <ArrowLeft aria-hidden="true" />
        </button>
      </section>
      <section className="micro-foundation-exit" aria-label="الخروج من صفحة الأساس">
        <p>التخطي فعل واعٍ: كل ما تركته فارغًا يظهر في «مشروعي الآن» كطريق «سجّله»، ولا يتحول إلى صفر.</p>
        <div className="micro-foundation-actions">
          <Button action="secondary" onClick={() => navigate("/")}>
            تخطَّ وأكمل لاحقًا
          </Button>
          <Button action="secondary" onClick={() => navigate("/")}>
            ادخل إلى مشروعي <ArrowLeft aria-hidden="true" />
          </Button>
        </div>
      </section>
    </section>
  );
}

/* ─── S14 (DOC-023 / UNIT-002 + ACC-01/JRN-010 — أمر ba2ce7b4 §5): رحلة
 * استكمال الحسابات — منسق اختياري في بيته القائم (خريطة P3.4): المساران
 * (جديد: اليوم أو تاريخ سابق بالتقويم؛ عائد: فترة غير مسجلة)، وأسئلة
 * المجاميع بحالات معرفة مستقلة، ورصد النقد الحالي الاختياري، ومعاينة
 * صادقة قبل الالتزام المنسق، والإلغاء بلا كتابة أبدًا. لا سياسة مالية
 * هنا ولا تخزين مباشر — الخدمة التطبيقية هي الجسر الوحيد. ─── */

type KnowledgeChoice = "known" | "estimated" | "none" | "unknown" | "skipped";

type JourneyState =
  | { phase: "closed" }
  | { phase: "choosing" }
  | { phase: "answering" }
  | { phase: "preview"; preview: AccountCompletionPreview }
  | { phase: "committing" }
  | { phase: "done" };

type SummaryDraft = {
  amountText: string;
  knowledge: KnowledgeChoice;
};

const KNOWLEDGE_LABELS: Record<KnowledgeChoice, string> = {
  known: "معلوم",
  estimated: "تقريبي",
  none: "لا يوجد",
  unknown: "لا أعرف المبلغ",
  skipped: "أتخطى الآن",
};

const AMOUNT_QUESTIONS = [
  { kind: "direct_sales", label: "مبيعاتك التي لم تسجلها" },
  { kind: "purchases", label: "مشترياتك التي لم تسجلها" },
  { kind: "expenses", label: "مصاريف مشروعك التي لم تسجلها" },
] as const;

function dimensionValueOf(draft: SummaryDraft, kind: string) {
  const amountMinor = parseEnglishNumericText(draft.amountText, "money");
  if (draft.knowledge === "known" || draft.knowledge === "estimated") {
    if (amountMinor === null || amountMinor < 0) return null; /* خطأ حقل يُعلن */
    return { state: "entered" as const, amountMinor, knowledge: draft.knowledge };
  }
  if (draft.knowledge === "none") return { state: "none" as const };
  if (draft.knowledge === "unknown") return { state: "unknown" as const };
  return { state: "skipped" as const };
}

function AccountCompletionJourney() {
  const { formDrafts, dataVersion, notifyDataChanged } = usePrototypeServices();
  const [state, setState] = useState<JourneyState>({ phase: "closed" });
  const [error, setError] = useState<string | null>(null);
  /* مسودة الرحلة — نوعها المسجل بجيلها الحي (SDF-029/050/072). */
  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
  const [sales, setSales] = useState<SummaryDraft>({ amountText: "", knowledge: "skipped" });
  const [purchases, setPurchases] = useState<SummaryDraft>({ amountText: "", knowledge: "skipped" });
  const [expenses, setExpenses] = useState<SummaryDraft>({ amountText: "", knowledge: "skipped" });
  const [cashText, setCashText] = useState("");
  const [cashKnown, setCashKnown] = useState(true);

  const drafts = useMemo(
    () => ({ fromText, toText, sales, purchases, expenses, cashText, cashKnown }),
    [fromText, toText, sales, purchases, expenses, cashText, cashKnown],
  );

  /* استعادة المسودة عند الفتح — نفس المدخلات بلا أثر مالي (SDF-029). */
  useEffect(() => {
    if (!formDrafts) return;
    void formDrafts.read("account_completion", null).then(read => {
      if (!read.ok || read.value === null) return;
      const values = read.value.values as typeof drafts | null;
      if (!values) return;
      setFromText(values.fromText ?? "");
      setToText(values.toText ?? "");
      setSales(values.sales ?? { amountText: "", knowledge: "skipped" });
      setPurchases(values.purchases ?? { amountText: "", knowledge: "skipped" });
      setExpenses(values.expenses ?? { amountText: "", knowledge: "skipped" });
      setCashText(values.cashText ?? "");
      setCashKnown(values.cashKnown ?? true);
    });
  }, [formDrafts]);

  /* حفظ المسودة عند كل تغيير داخل الرحلة — عابرة بلا أثر مالي. */
  useEffect(() => {
    if (!formDrafts || state.phase === "closed") return;
    void formDrafts.save("account_completion", null, drafts).then(saved => {
      if (!saved.ok && saved.code !== "conflict") setError(saved.message);
    });
  }, [formDrafts, drafts, state.phase]);

  const closeJourney = () => {
    setState({ phase: "closed" });
    setError(null);
  };

  const buildPreview = async () => {
    setError(null);
    const from = fromText.trim();
    const to = toText.trim();
    if (!isValidLocalDate(from) || !isValidLocalDate(to) || from > to) {
      setError("الفترة غير صالحة — «من» قبل «إلى» بتاريخ تقويمي حقيقي.");
      return;
    }
    const answers: ReadonlyArray<{
      key: "direct_sales" | "purchases" | "expenses";
      draft: SummaryDraft;
    }> = [
      { key: "direct_sales", draft: sales },
      { key: "purchases", draft: purchases },
      { key: "expenses", draft: expenses },
    ];
    const summaries: Array<AccountCompletionInput["summaries"][number]> = [];
    for (const { key, draft } of answers) {
      if (draft.knowledge === "skipped" && draft.amountText.trim() === "") continue;
      const value = dimensionValueOf(draft, key);
      if (value === null) {
        setError("أدخل المبلغ بالأرقام 0–9 (دينار) أو اختر حالة معرفة صريحة.");
        return;
      }
      const dimension = key === "expenses" ? "paid" : key === "purchases" ? "cost" : "revenue";
      summaries.push({
        kind: key,
        from,
        to,
        dimensions: { [dimension]: value },
        coverage: [],
      });
    }
    const cashCounted = cashText.trim() === "" ? null : parseEnglishNumericText(cashText, "money");
    if (cashText.trim() !== "" && (cashCounted === null || cashCounted < 0)) {
      setError("رصد النقد الحالي: أدخل المبلغ بالأرقام 0–9 أو اتركه فارغًا.");
      return;
    }
    const service = new AccountCompletionService(getPrototypeLocalStore());
    const plan = await service.buildPlan(
      {
        from,
        to,
        summaries,
        cashObservation:
          cashCounted === null
            ? null
            : { countedMinor: cashCounted, knowledge: cashKnown ? "known" : "estimated", observedOn: to },
      },
      `completion-${Date.now().toString(36)}`,
    );
    if (!plan.ok) {
      setError(plan.message);
      return;
    }
    setState({ phase: "preview", preview: plan.value.preview });
  };

  const commitPreview = async (preview: AccountCompletionPreview) => {
    setState({ phase: "committing" });
    const service = new AccountCompletionService(getPrototypeLocalStore());
    const rebuilt = await service.buildPlan(
      {
        from: preview.summaries[0]?.from ?? fromText,
        to: preview.summaries[0]?.to ?? toText,
        summaries: preview.summaries.map(summary => ({
          kind: summary.kind,
          from: summary.from,
          to: summary.to,
          dimensions: summary.dimensions,
          coverage: summary.coverageLinks.map(link => ({
            detailRef: link.detailRef,
            dimension: link.dimension,
            amountMinor: link.amountMinor,
          })),
        })),
        cashObservation: preview.cashObservation
          ? {
              countedMinor: preview.cashObservation.countedMinor,
              knowledge: preview.cashObservation.knowledge,
              observedOn: preview.cashObservation.observedOn,
            }
          : null,
      },
      preview.command.commandId,
    );
    if (!rebuilt.ok) {
      setError(rebuilt.message);
      setState({ phase: "preview", preview });
      return;
    }
    const committed = await service.commit(rebuilt.value);
    if (!committed.ok) {
      setError(committed.message);
      setState({ phase: "preview", preview });
      return;
    }
    if (formDrafts) void formDrafts.discard("account_completion", null);
    setState({ phase: "done" });
    notifyDataChanged();
  };

  if (state.phase === "closed")
    return (
      <details className="micro-foundation-section">
        <summary className="micro-foundation-summary">
          <span>
            <b>استكمال فترة سابقة</b>
            <small>سجل ما تعرفه فقط: مجموعات بحالتها، ورصد النقد الحالي — اختياري بالكامل</small>
          </span>
          <strong>اختياري — افتحه عند الحاجة</strong>
        </summary>
        <div className="micro-foundation-body">
          <p>
            <ClipboardList aria-hidden="true" /> لمن بدأ تسجيله من اليوم أو يعود بعد انقطاع: الفترة تختارها
            أنت بحرية، و«لا أعرف» معلومة محفوظة لا صفرًا، وآخر زيارة ليست إقفالًا ماليًا.
          </p>
          <Button action="create" onClick={() => setState({ phase: "choosing" })}>
            ابدأ رحلة الاستكمال <ArrowLeft aria-hidden="true" />
          </Button>
        </div>
      </details>
    );

  return (
    <section className="micro-foundation-section" aria-label="رحلة استكمال الحسابات">
      <div className="micro-foundation-body">
        <div className="micro-section-title">
          <ClipboardList aria-hidden="true" />
          <div>
            <h2>استكمال الحسابات</h2>
          </div>
        </div>
        {error ? (
          <p className="micro-field-error" role="alert">
            {error}
          </p>
        ) : null}
        {(state.phase === "choosing" || state.phase === "answering") && (
          <>
            <fieldset>
              <legend>الفترة التي تريد تسجيلها</legend>
              <label className="micro-field">
                <span>من (YYYY-MM-DD)</span>
                <input type="date" value={fromText} onChange={event => setFromText(event.target.value)} />
              </label>
              <label className="micro-field">
                <span>إلى (YYYY-MM-DD)</span>
                <input type="date" value={toText} onChange={event => setToText(event.target.value)} />
              </label>
              <p className="micro-field-hint">
                البداية من اليوم أو أي تاريخ سابق تختاره — التقويم لا يكتب عملًا ماليًا، واختيار تاريخ لا يعيد
                بناء ما قبله.
              </p>
            </fieldset>
            <fieldset>
              <legend>أدخل العمليات التي لم تسجلها فقط</legend>
              {AMOUNT_QUESTIONS.map(question => {
                const current =
                  question.kind === "direct_sales"
                    ? sales
                    : question.kind === "purchases"
                      ? purchases
                      : expenses;
                const set =
                  question.kind === "direct_sales"
                    ? setSales
                    : question.kind === "purchases"
                      ? setPurchases
                      : setExpenses;
                return (
                  <div key={question.kind} className="micro-foundation-question">
                    <label className="micro-field">
                      <span>كم بلغت {question.label}؟</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        dir="ltr"
                        value={current.amountText}
                        onChange={event => {
                          /* إدخال مبلغ = إجابة معلومة: الكتابة في حقل المبلغ
                           * تنقل حالة المعرفة من المتخطى/المجهول إلى «معلوم»
                           * (المستخدم يختار «تقريبي» صراحة إن أراد) — الفراغ
                           * يبقى على حالته الأصلية بلا صفر افتراضي. */
                          const typed = event.target.value;
                          const knowledge =
                            typed.trim() !== "" &&
                            current.knowledge !== "estimated" &&
                            current.knowledge !== "none"
                              ? "known"
                              : current.knowledge;
                          set({ amountText: typed, knowledge });
                        }}
                        placeholder="0.00"
                      />
                    </label>
                    <fieldset>
                      <legend className="micro-sr-only">حالة المعرفة</legend>
                      {(["known", "estimated", "none", "unknown", "skipped"] as const).map(choice => (
                        <label className="micro-radio-choice" key={choice}>
                          <input
                            type="radio"
                            name={`knowledge-${question.kind}`}
                            checked={current.knowledge === choice}
                            onChange={() => set({ ...current, knowledge: choice })}
                          />
                          <span>{KNOWLEDGE_LABELS[choice]}</span>
                        </label>
                      ))}
                    </fieldset>
                  </div>
                );
              })}
            </fieldset>
            <fieldset>
              <legend>كم معك الآن من مال المشروع؟ (اختياري)</legend>
              <label className="micro-field">
                <span>الموجود في الصندوق والحسابات التي تستخدمها للمشروع</span>
                <input
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={cashText}
                  onChange={event => setCashText(event.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label className="micro-radio-choice">
                <input
                  type="checkbox"
                  checked={cashKnown}
                  onChange={event => setCashKnown(event.target.checked)}
                />
                <span>عدّة معلومة (لا تقدريًا)</span>
              </label>
              <p className="micro-field-hint">
                الرصد قياس مؤرخ لا تمويل ولا إيراد؛ القبض القديم الذي يغطيه لا يضاف إليه.
              </p>
            </fieldset>
            <div className="micro-form-actions">
              <Button action="save" onClick={() => void buildPreview()}>
                راجع واحفظ
              </Button>
              <Button action="quiet" onClick={closeJourney}>
                إلغاء (لا يُكتب شيء)
              </Button>
            </div>
          </>
        )}
        {state.phase === "preview" && (
          <div aria-live="polite">
            <h3>راجع قبل الحفظ</h3>
            <ul className="micro-foundation-preview">
              {state.preview.summaries.map(summary => (
                <li key={summary.id}>
                  {summary.kind === "direct_sales"
                    ? "مبيعات"
                    : summary.kind === "purchases"
                      ? "مشتريات"
                      : "مصاريف"}{" "}
                  <LocalDateRange from={summary.from} to={summary.to} />
                  {Object.entries(summary.dimensions).map(([dimension, value]) => (
                    <small key={dimension}>
                      {" "}
                      · {dimension}:{" "}
                      {value.state === "entered" ? (
                        <>
                          <MoneyValue minor={value.amountMinor} /> (
                          {value.knowledge === "estimated" ? "تقريبي" : "معلوم"})
                        </>
                      ) : (
                        KNOWLEDGE_LABELS[value.state as KnowledgeChoice]
                      )}
                    </small>
                  ))}
                </li>
              ))}
              {state.preview.cashObservation ? (
                <li>
                  رصد النقد الحالي: <MoneyValue minor={state.preview.cashObservation.countedMinor} />{" "}
                  <small>
                    (قياس {state.preview.cashObservation.knowledge === "known" ? "معلوم" : "تقريبي"} —{" "}
                    {state.preview.cashObservation.observedOn})
                  </small>
                </li>
              ) : null}
            </ul>
            {state.preview.unknownDimensions.length > 0 ? (
              <p className="micro-field-hint">
                النتائج مبنية على المبالغ التي أدخلتها — يمكنك تعديلها لاحقًا. المجهول محفوظ بحالته ولا يصير
                صفرًا.
              </p>
            ) : null}
            {state.preview.alreadyRepresented.length > 0 ? (
              <p className="micro-field-error" role="alert">
                هذا النطاق مسجل سابقًا في ملخص قائم — صحّح المدة أو أزله؛ لا تُضاف القيمة فوق الأصل.
              </p>
            ) : null}
            {state.preview.coveredByObservation.length > 0 ? (
              <p className="micro-field-hint">
                مجموعات هذه الفترة يغطيها رصد اليوم — تبقى تاريخًا في كشف فترتها ولا تضاف إلى النقد الحالي.
              </p>
            ) : null}
            {state.preview.timingUnresolved.length > 0 ? (
              <p className="micro-field-hint">
                فترة تعبر يوم الرصد — تُحفظ بمجموعها الكامل بلا توزيع أيام، والترتيب الزمني يبقى غير محسوم.
              </p>
            ) : null}
            <div className="micro-form-actions">
              <Button
                action="save"
                disabled={state.preview.alreadyRepresented.length > 0}
                onClick={() => void commitPreview(state.preview)}
              >
                حفظ ومتابعة
              </Button>
              <Button action="quiet" onClick={() => setState({ phase: "answering" })}>
                رجوع للتعديل
              </Button>
              <Button action="quiet" onClick={closeJourney}>
                إلغاء (لا يُكتب شيء)
              </Button>
            </div>
          </div>
        )}
        {state.phase === "committing" ? <p role="status">جارٍ حفظ إدخالاتك…</p> : null}
        {state.phase === "done" ? (
          <div>
            <p role="status">تم حفظ إدخالاتك.</p>
            {state.phase === "done" && (
              <p className="micro-field-hint">
                يمكنك استكمال المبالغ الناقصة لاحقًا من هنا أو من أصحابها — لا شيء أُغلق.
              </p>
            )}
            <div className="micro-form-actions">
              <Button action="quiet" onClick={closeJourney}>
                تم
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function LocalDateRange({ from, to }: { from: string; to: string }) {
  return (
    <small>
      {" "}
      ({from} ← {to})
    </small>
  );
}
