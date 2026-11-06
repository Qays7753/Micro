/**
 * UNIT-013 / AF-B (تنفيذ S15 بالأمر الموحد §5): لوحة وظائف المالية — وصول
 * واحد عند الطلب بست مجموعات و15 مدخلًا مسمى، بدل قوائم السجلات الكاملة
 * أسفل جذر المالية ودليل «المزيد» المستقل (014 ملغى الاستقلال).
 *
 * العقد:
 * - لوحة مغلقة أولًا؛ تفتح صراحة من زر «وظائف المالية» وتغلق بالزر أو
 *   رجوع الهاتف أو Escape — الإغلاق يعيد التركيز لزر اللوحة ولا يغير الفترة
 *   أو المال ولا ينتقل وجهة أخرى (AF-C).
 * - كل مدخل يفتح الأصل بتعريفه ونيته نفسيهما (withReturnTo إلى /finance)؛
 *   فتح اللوحة لا يستدعي ملخصات الوظائف ولا يكتب شيئًا (AF-AC02/03).
 * - كشف الفترة يحمل نطاق 013 المطبق نفسه (AF-AC05) — يمرَّر من الصفحة.
 * - لا قروض أو مشاركة أو توقعات مؤجلة أو أدوات تخطيط داخل اللوحة
 *   (AF-AC09)؛ الإعدادات والنسخ وفحص البيانات خارجها بواباتها.
 * - ميزانيات المصروف مدخل سياقي إلى قسمها في الصفحة نفسها (013B سطحها
 *   القائم بموضع واحد لا مكرر).
 */
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { withReturnTo } from "@/app/navigationContract";
import { ArrowLeft, ReceiptText, Scale, Users, WalletCards, Wrench, X } from "lucide-react";

export type FinanceFunctionsBoardProps = {
  open: boolean;
  onClose: () => void;
  /** نطاق 013 المطبق (أشهر) — كشف الفترة يفتح عليه نفسه لا على الافتراضي. */
  statementHref: string;
  /** F-002 (UXR-03/UXR-D09): مدخل المصروف الموحد — يسأل حالة الدفع ثم
   * يوجه لمحرري المدفوع/المستحق القائمين؛ لا كاتب ثالث ولا تحويل تلقائي. */
  onOpenExpenseEntry: () => void;
  /* F-005/F-016 (UXR-03 — أمر W02/عقد 02-FIN): مداخل سياقية تكشف مساحة
   * الوظيفة المختارة داخل الصفحة بعد استقرار المساحة الفرعية (نمط 013B):
   * «مستحقات عليك» سطح الالتزامات الموحد (المالك الجامع لمصدرَيه — بوابة
   * ربط مهمة عقد 02-FIN)، والجسر/التغطية والتعادل/السياسات/الميزانيات
   * أقسام الطبقة الثانية؛ كلها إظهار لا كتابة ولا وجهات جديدة. */
  onOpenObligations: () => void;
  onOpenBridge: () => void;
  onOpenBreakeven: () => void;
  onOpenPolicies: () => void;
  /** مدخل ميزانيات المصروف يكشف قسمها في الصفحة نفسها لا وجهة جديدة. */
  onOpenBudgets: () => void;
};

type BoardEntry = {
  label: string;
  description: string;
  href?: string;
  onOpen?: () => void;
};

type BoardGroup = {
  title: string;
  icon: typeof WalletCards;
  entries: BoardEntry[];
};

export function FinanceFunctionsBoard({
  open,
  onClose,
  statementHref,
  onOpenExpenseEntry,
  onOpenObligations,
  onOpenBridge,
  onOpenBreakeven,
  onOpenPolicies,
  onOpenBudgets,
}: FinanceFunctionsBoardProps) {
  const [, navigate] = useLocation();
  const closeRef = useRef<HTMLButtonElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  /* S15-MR-001: board-owned single history sentinel (the standing Setup.tsx
   * pattern). Ref mirrors because the popstate listener installs once for the
   * component lifetime. */
  const sentinelArmedRef = useRef(false);
  const suppressPopRef = useRef(false);
  const openRef = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    openRef.current = open;
    onCloseRef.current = onClose;
  });

  /* Idempotent consumption on every non-Back exit path — one guard per open,
   * never more; the synchronous back() is what removes the entry in the real
   * browser. */
  const consumeBoardSentinel = () => {
    if (!sentinelArmedRef.current) return;
    sentinelArmedRef.current = false;
    suppressPopRef.current = true;
    history.back();
  };

  /* F-003 (UXR-03 — أمر W02): استهلاك الحارس بلا back() قبل أي تنقل أو
   * كشف داخل الصفحة. الاجتياح المؤجل في go()/onOpen كان يُنفّذ بعد
   * pushState المتزامن للموجه فيسحب المستخدم من وجهته الجديدة إلى
   * /finance، ويستعيد المتصفح تمرير مدخل الحارس فيلغي كشف الميزانيات
   * (المصدر: F-003 المسح الشامل 2026-11-04 — 15/15 مدخلًا معطلًا).
   * العلاج الموثق: التنقل فوق مدخل الحارس — مدخل الحارس هو /finance
   * نفسه، فرجوع الهاتف من الوجهة يسقط عليه ويحقق سلوك returnTo
   * المرجو، وعقود الإغلاق غير-التنقلي (زر/Escape/رجوع أثناء الفتح)
   * لا تمر من هنا فلا تتأثر. */
  const consumeBoardSentinelWithoutBack = () => {
    sentinelArmedRef.current = false;
  };

  /* Opening owns exactly one same-page history state for this board instance. */
  useEffect(() => {
    if (open && !sentinelArmedRef.current) {
      sentinelArmedRef.current = true;
      history.pushState({ microFinanceBoard: true }, "");
    }
  }, [open]);

  /* A parent-driven close (outside the board) consumes the entry too — no
   * leftover sentinel swallows a later Back. Idempotent with board paths. */
  useEffect(() => {
    if (!open) consumeBoardSentinel();
  }, [open]);

  /* Phone/browser Back while open: the browser already popped the entry and
   * delivered popstate — close only the board; no navigation, no touch to the
   * period or the money. Leaving the screen while open consumes the entry in
   * the cleanup — no stale entry swallows a later Back on another surface.
   * F-003: المغادرة إما عبر مداخل اللوحة نفسها (استهلاك بلا back في go()
   * ومسار onOpen أدناه) أو عبر تنقل خارجي (الشريط السفلي) — في الحالتين لا
   * اجتياح back() مؤجلًا خلف وجهة جديدة؛ مدخل الحارس يبقى /finance نفسه
   * فلا يُبتلع رجوع لاحق ولا يُسحب المستخدم من وجهته. */
  useEffect(() => {
    const onPopState = () => {
      if (suppressPopRef.current) {
        suppressPopRef.current = false;
        return;
      }
      if (openRef.current && sentinelArmedRef.current) {
        sentinelArmedRef.current = false;
        onCloseRef.current();
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      consumeBoardSentinelWithoutBack();
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        consumeBoardSentinel();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const go = (href: string) => {
    /* F-003: الانتقال فوق مدخل الحارس بلا back() مؤجل — التنقل نفسه يعلّم
     * الحارس مستهلكًا، فيصل المستخدم وجهته فعليًا ويسقط رجوع الهاتف على
     * /finance كما يريد عقد ٢٦ (withReturnTo). */
    consumeBoardSentinelWithoutBack();
    onClose();
    navigate(withReturnTo(href, "/finance"));
  };

  /* F-005/F-016 (UXR-03 — أمر W02): فهرس الوظائف الكنوني من عقد 02-FIN —
   * خمس مجموعات وصول (لا كيانات جديدة): التسجيل والسجلات، النقد
   * والمستحقات، التقارير والتخطيط، المنتجات والجهات، المخزون والأصول
   * عند الحاجة. دمج F-016: مدخلا /suppliers المكرران («للموردين ومصاريف
   * مستحقة» و«المشتريات») صارا مدخلًا واحدًا بوصف جامع صادق لسجلات الشراء
   * والدفع، و«مستحقات عليك» مدخل سياقي للسطح الموحد (مصدرَي الالتزام) لا
   * لقائمة مشتريات تستبعد مصروفًا مستحقًا (بوابة ربط مهمة 02-FIN)؛
   * «عدّ الصندوق» انتقل من فقرات جذر المالية إلى الفهرس؛ «لك عند العملاء»
   * يفتح القارئ الموحد بنطاق التحصيل (kind=receivable) والجهات تبقى
   * مجموعتها (UXR-D10: لا حذف مدخل لتطابق URL فقط — النية والنطاق يفصلان). */
  const groups: BoardGroup[] = [
    {
      title: "التسجيل والسجلات",
      icon: ReceiptText,
      entries: [
        { label: "بيع", description: "بيع فوري بلا طلب", href: "/direct-sales/new" },
        {
          label: "مصروف",
          /* F-002: حالة الدفع تُحدد أولًا ثم يفتح محررها القائم — لا كاتب ثالث. */
          description: "تحدد حالة الدفع أولًا ثم يفتح محررها",
          onOpen: onOpenExpenseEntry,
        },
        { label: "شراء", description: "شراء مواد وبنوده ودفعاته", href: "/suppliers/purchase/new" },
        { label: "المشتريات", description: "سجل الشراء والدفع والاستلام", href: "/suppliers" },
        { label: "سجل العمليات", description: "القارئ الكامل لكل النشاط", href: "/finance/activity" },
      ],
    },
    {
      title: "النقد والمستحقات",
      icon: WalletCards,
      entries: [
        { label: "النقد", description: "المحافظ وحركاتها وأماناتها وعدّها", href: "/cash" },
        {
          label: "لك عند العملاء",
          description: "دين مسجل بعد التسليم — تحصيله من المتابعة",
          href: "/finance/upcoming?kind=receivable",
        },
        {
          label: "مستحقات عليك",
          description: "موردين ومصاريف مستحقة بسطريهما ومسارَي تسديدهما",
          onOpen: onOpenObligations,
        },
        {
          label: "مال المالك",
          description: "إضافة وسحب وحقوق بمعانٍ مميزة",
          href: "/finance/owner-entitlement",
        },
      ],
    },
    {
      title: "التقارير والتخطيط",
      icon: Scale,
      entries: [
        { label: "كشف الفترة", description: "بنطاق المالية المطبق نفسه", href: statementHref },
        {
          label: "فرق النقد والنتيجة",
          description: "لماذا يختلف الربح عن النقد",
          onOpen: onOpenBridge,
        },
        { label: "تغطية وتعادل", description: "هامش الأعمال ونقطة التعادل", onOpen: onOpenBreakeven },
        { label: "سياسة التوزيع", description: "سياسات الربح والتوزيع", onOpen: onOpenPolicies },
        { label: "ميزانيات المصروف", description: "خطة شهرية للمقارنة لا حدث مالي", onOpen: onOpenBudgets },
      ],
    },
    {
      title: "المنتجات والجهات",
      icon: Users,
      entries: [
        { label: "المنتجات والخدمات", description: "مرجع ما يعاد استخدامه — اختياري", href: "/catalog" },
        { label: "العملاء والموردون", description: "الهوية وتعاملاتها المرتبطة", href: "/parties" },
      ],
    },
    {
      title: "المخزون والأصول عند الحاجة",
      icon: Wrench,
      entries: [
        { label: "المخزون", description: "مواد تختار تتبعها", href: "/inventory" },
        { label: "المعدات", description: "أصولك وإهلاكها — اختياري", href: "/assets" },
        { label: "عدّ الصندوق", description: "طابق الدرج مع السجل", href: "/cash/count" },
      ],
    },
  ];

  return (
    <div
      className="micro-functions-board"
      role="dialog"
      aria-modal="false"
      aria-label="وظائف المالية"
      ref={boardRef}
    >
      <div className="micro-functions-board-heading">
        <h2>وظائف المالية</h2>
        <button
          className="micro-text-action"
          type="button"
          ref={closeRef}
          onClick={() => {
            consumeBoardSentinel();
            onClose();
          }}
        >
          <X aria-hidden="true" /> إغلاق
        </button>
      </div>
      {groups.map(group => (
        <section className="micro-functions-board-group" key={group.title} aria-label={group.title}>
          <h3>
            <group.icon aria-hidden="true" /> {group.title}
          </h3>
          <ul>
            {group.entries.map(entry => (
              <li key={entry.label}>
                <button
                  className="micro-functions-board-entry"
                  type="button"
                  onClick={() => {
                    if (entry.onOpen) {
                      /* F-003: الكشف السياقي داخل الصفحة — استهلاك بلا back()
                       * ثم كشف القسم بعد استقرار المساحة الفرعية (المالك:
                       * الصفحة عبر onOpen) فلا يستعيد المتصفح تمرير مدخل
                       * الحارس فيلغي الكشف. */
                      consumeBoardSentinelWithoutBack();
                      onClose();
                      entry.onOpen();
                      return;
                    }
                    go(entry.href!);
                  }}
                >
                  <span>
                    <strong>{entry.label}</strong>
                    <small>{entry.description}</small>
                  </span>
                  <ArrowLeft aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
