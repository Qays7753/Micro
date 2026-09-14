/*
 * Micro design reminder: every quick action must end in a real path or be
 * clearly marked as unavailable; the sheet never creates a financial effect.
 */
/* §٥-١٤ (المرحلة أ — م٣): البيع والمصروف فعلان عابران — يتمان داخل الورقة فوق
 * شاشة الوقوف بحدودهما الدنيا، والنموذج الكامل يبقى باب التصحيح والعمق.
 * W3 (حدود القشرة): هذه الورقة تملك التوزيع ودورة الحياة والوصل وحماية
 * المدخل فقط؛ حقول البيع/المصروف ومنطق تسجيلها في طبقة أنماط المالية
 * (components/finance/QuickSaleForm + QuickExpenseForm). النموذجان يبقيان
 * محمّلين طوال جلسة الورقة (مخفيان بـ hidden) حتى لا يضيع المكتوب بالتنقل
 * بين القائمة والنموذج — لا إعادة تعيين صامتة. */
import {
  ArrowRight,
  BadgeDollarSign,
  CircleDollarSign,
  ClipboardPlus,
  HandCoins,
  PackagePlus,
  X,
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { formatMoneyMinor } from "@/presentation/formatters";
import { deriveExpenseCategorySuggestions } from "@/application/finance/expenseCategorySuggestions";
import { QuickExpenseForm } from "@/components/finance/QuickExpenseForm";
import { QuickSaleForm } from "@/components/finance/QuickSaleForm";
import type {
  QuickActionFormHandle,
  QuickActionReceipt,
  QuickActionWalletOption,
} from "@/components/finance/quickActionFormTypes";

import { Button } from "@/components/primitives";
export type QuickAction = "sale" | "expense" | "order" | "estimate" | "collection";
export type QuickActionItem = {
  action: QuickAction;
  label: string;
  description: string;
  icon: typeof ClipboardPlus;
  disabled?: boolean;
};
type QuickActionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (action: QuickAction) => void;
};
type SheetMode = "menu" | "sale-form" | "expense-form" | "receipt";
/* المجموعة ٢ (Scope A): الوصل يفتح السجل المصدر — بيعًا أو حدثًا ماليًا. */
type Receipt = QuickActionReceipt;

/* القرار ٢٣-ب: الأفعال المتكررة يوميًا — تسجيل بيع · تسجيل مصروف · إضافة طلب.
 * البيع المباشر أولًا (R-1 أعلى الورقة)، والمصروف لحظته (م1 — F-036 في موضعه الجديد). */
export const actionItems: readonly QuickActionItem[] = [
  {
    action: "sale",
    label: "تسجيل بيع",
    description: "احفظ بيعًا مباشرًا من دون إنشاء طلب.",
    icon: BadgeDollarSign,
  },
  {
    action: "expense",
    label: "تسجيل مصروف",
    description: "سجّل مصروفًا مدفوعًا في لحظته، من أي مكان.",
    icon: CircleDollarSign,
  },
  { action: "order", label: "طلب من عميل", description: "ابدأ مسودة طلب واتفاق أولي.", icon: ClipboardPlus },
  {
    action: "estimate",
    label: "مسودة تصميم",
    description: "ابدأ مسودة تصميم قبل أن تتحول إلى اتفاق.",
    icon: PackagePlus,
  },
  {
    action: "collection",
    label: "عربون أو تحصيل",
    description: "ورقة تحصيل: مين عليه إلك وكم قبضت — بالوجهة التي تختارها.",
    icon: HandCoins,
  },
];

export function QuickActionSheet({ open, onOpenChange, onAction }: QuickActionSheetProps) {
  const [, navigate] = useLocation();
  const { cashContinuity, projectFinance, dataVersion } = usePrototypeServices();
  const [mode, setMode] = useState<SheetMode>("menu");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  /* المجموعة ١ (حماية المدخل العابر): إغلاق الورقة وبها مدخل مكتوب يمرّ بسؤال
   * هادئ من خيارين — سجّله أو تتجاهله — لا إعادة تعيين صامتة. */
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  /* ٥.٢ / المجموعة ١: المحافظ ومقترحات الوسم تجلبها القشرة عند الفتح —
   * قراءة فقط تُمرَّر للنموذجين كخصائص (لا سلوك مالي في القشرة). */
  const [wallets, setWallets] = useState<readonly QuickActionWalletOption[]>([]);
  const [saleDefaultWalletId, setSaleDefaultWalletId] = useState("");
  const [categorySuggestions, setCategorySuggestions] = useState<readonly string[]>([]);
  const saleFormRef = useRef<QuickActionFormHandle>(null);
  const expenseFormRef = useRef<QuickActionFormHandle>(null);

  useEffect(() => {
    if (!open) return;
    cashContinuity.overview().then(result => {
      if (!result.ok) return;
      setWallets(result.value.wallets.map(wallet => ({ id: wallet.id, name: wallet.name })));
      /* المجموعة ٢ (Scope A): الدرج وجهة القبض الافتراضية حين يوجد — غير الموزع
       * خيار صريح لا اختيارًا صامتًا. المصروف: من غير الموزع افتراضيًا صادقًا
       * (لا نختار محفظة نيابةً عن الصرف)، وتغطية المحفظة خيار معلن. */
      const drawer = result.value.wallets.find(wallet => wallet.kind === "cash_drawer");
      setSaleDefaultWalletId(drawer?.id ?? "");
    });
    /* المجموعة ١ (تصنيفي للمصاريف): مقترحات مشتقة من الاستعمال — قراءة فقط. */
    projectFinance.listEvents().then(result => {
      if (result.ok) setCategorySuggestions(deriveExpenseCategorySuggestions(result.value, 6));
    });
  }, [open, cashContinuity, projectFinance, dataVersion]);

  function reset() {
    setMode("menu");
    setReceipt(null);
    setConfirmDiscard(false);
    setFormSaving(false);
  }

  /* الوسخ = أي مدخل مكتوب أو مختار في نموذجي البيع/المصروف — يسأل النموذج
   * الفعّال عبر مقبضه؛ الفراغ النظيف يغلق بلا سؤال. */
  function isFormDirty(): boolean {
    if (mode === "sale-form") return saleFormRef.current?.isDirty() ?? false;
    if (mode === "expense-form") return expenseFormRef.current?.isDirty() ?? false;
    return false;
  }

  function requestClose() {
    if (mode === "sale-form" || mode === "expense-form") {
      /* السؤال معروض: الإغلاق المتكرر/X يعني «ابقَ» — الأقل تدميرًا هو الافتراضي. */
      if (confirmDiscard) return;
      if (isFormDirty()) {
        setConfirmDiscard(true);
        return;
      }
    }
    setConfirmDiscard(false);
    reset();
    onOpenChange(false);
  }

  function discardTypedInput() {
    setConfirmDiscard(false);
    reset();
    onOpenChange(false);
  }

  async function confirmBySaving() {
    setConfirmDiscard(false);
    if (mode === "sale-form") await saleFormRef.current?.submit();
    else if (mode === "expense-form") await expenseFormRef.current?.submit();
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      onOpenChange(true);
      return;
    }
    requestClose();
  }

  function handleSubmitted(nextReceipt: QuickActionReceipt) {
    setFormSaving(false);
    setConfirmDiscard(false);
    setReceipt(nextReceipt);
    setMode("receipt");
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange} direction="bottom">
      <DrawerContent className="micro-bottom-sheet" dir="rtl">
        <DrawerHeader className="micro-sheet-header">
          <div className="micro-sheet-title-row">
            <div>
              {mode === "menu" ? (
                <>
                  <DrawerTitle className="micro-sheet-title">ماذا تريد أن تسجّل؟</DrawerTitle>
                  <DrawerDescription className="micro-sheet-description">
                    اختر حدثًا واحدًا لنكمل الخطوة المناسبة.
                  </DrawerDescription>
                </>
              ) : mode === "sale-form" ? (
                <>
                  <DrawerTitle className="micro-sheet-title">سجّل بيعًا الآن</DrawerTitle>
                  <DrawerDescription className="micro-sheet-description">
                    المبلغ هو الحقل الإلزامي الوحيد — يتم التسجيل هنا فوق شاشتك من دون انتقال.
                  </DrawerDescription>
                </>
              ) : mode === "expense-form" ? (
                <>
                  <DrawerTitle className="micro-sheet-title">سجّل مصروفًا الآن</DrawerTitle>
                  <DrawerDescription className="micro-sheet-description">
                    مبلغ وبند اختياري — يتم التسجيل هنا فوق شاشتك من دون انتقال.
                  </DrawerDescription>
                </>
              ) : (
                <>
                  <DrawerTitle className="micro-sheet-title">وصل التسجيل</DrawerTitle>
                  <DrawerDescription className="micro-sheet-description">
                    فعل مالي مسجل محليًا؛ لم تغادر مكانك.
                  </DrawerDescription>
                </>
              )}
            </div>
            <button className="micro-icon-button" type="button" aria-label="إغلاق" onClick={requestClose}>
              <X aria-hidden="true" />
            </button>
          </div>
        </DrawerHeader>
        {confirmDiscard && (mode === "sale-form" || mode === "expense-form") ? (
          <section
            className="micro-sheet-confirm"
            role="alertdialog"
            aria-labelledby="sheet-discard-question"
          >
            <strong id="sheet-discard-question">في رقم مكتوب — تسجّله أو تتجاهله؟</strong>
            <p>الإغلاق الآن يفقد ما كتبته في هذه الورقة؛ لا يوجد حفظ تلقائي.</p>
            <div className="micro-form-actions">
              <Button
                action="save"

                disabled={formSaving}
                onClick={() => {
                  void confirmBySaving();
                }}
              >
                سجّله الآن
              </Button>
              <Button action="destructive" onClick={discardTypedInput}>
                تجاهل ما كتبت
              </Button>
            </div>
          </section>
        ) : null}
        {mode !== "receipt" ? (
          <>
            <div className="micro-sheet-actions" hidden={mode !== "menu" || undefined}>
              {actionItems.map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.action}
                    className="micro-sheet-action"
                    type="button"
                    disabled={item.disabled}
                    aria-disabled={item.disabled || undefined}
                    onClick={() => {
                      if (item.disabled) return;
                      /* م٣: البيع والمصروف يحدثان داخل الورقة — فعل عابر فوق شاشة الوقوف.
                       * بقية الأفعال بداية مسارات أعمق فتُسلَّم للموجه. */
                      if (item.action === "sale") {
                        setMode("sale-form");
                        return;
                      }
                      if (item.action === "expense") {
                        setMode("expense-form");
                        return;
                      }
                      onAction(item.action);
                    }}
                  >
                    <span className="micro-sheet-action-icon">
                      <Icon aria-hidden="true" />
                    </span>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                  </button>
                );
              })}
            </div>
            <QuickSaleForm
              ref={saleFormRef}
              wallets={wallets}
              defaultWalletId={saleDefaultWalletId}
              hidden={mode !== "sale-form"}
              onSubmitted={handleSubmitted}
              onBackToMenu={() => setMode("menu")}
              onSavingChange={setFormSaving}
            />
            <QuickExpenseForm
              ref={expenseFormRef}
              wallets={wallets}
              categorySuggestions={categorySuggestions}
              hidden={mode !== "expense-form"}
              onSubmitted={handleSubmitted}
              onBackToMenu={() => setMode("menu")}
              onSavingChange={setFormSaving}
            />
          </>
        ) : (
          <div className="micro-sheet-receipt" role="status">
            {receipt ? (
              <>
                <strong>
                  {receipt.title} {formatMoneyMinor(receipt.amountMinor)} د.أ
                  {receipt.cashMinor !== null ? (
                    <> — الكاش المسجل الآن {formatMoneyMinor(receipt.cashMinor)} د.أ</>
                  ) : null}
                  .
                </strong>
                {receipt.detail ? <p>{receipt.detail}</p> : null}
                {/* (إصلاح تكاملي — مجموعة ٤): فشل نسبة المحفظة بعد التسجيل يظهر
                    في الوصل — المال محفوظ غير موزع، لا كذب على الكتابة ولا تجاهل. */}
                {receipt.attributionNote ? <p>{receipt.attributionNote}</p> : null}
                <p>أُغلق التسجيل فوق شاشتك؛ صحّح من «العمل» أو «مالي» عند الحاجة.</p>
                {receipt.recordHref ? (
                  <Button
                    action="secondary"

                    onClick={() => {
                      const href = receipt.recordHref ?? "";
                      handleOpenChange(false);
                      navigate(href);
                    }}
                  >
                    افتح السجل
                  </Button>
                ) : null}
              </>
            ) : null}
            <Button
              action="secondary"

              onClick={() => handleOpenChange(false)}
            >
              تم
            </Button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
