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
import { ArrowLeft, Landmark, ReceiptText, Users, WalletCards, Wrench, X } from "lucide-react";

export type FinanceFunctionsBoardProps = {
  open: boolean;
  onClose: () => void;
  /** نطاق 013 المطبق (أشهر) — كشف الفترة يفتح عليه نفسه لا على الافتراضي. */
  statementHref: string;
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
   * the cleanup — no stale entry swallows a later Back on another surface. */
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
      if (sentinelArmedRef.current) {
        sentinelArmedRef.current = false;
        suppressPopRef.current = true;
        history.back();
      }
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
    consumeBoardSentinel();
    onClose();
    navigate(withReturnTo(href, "/finance"));
  };

  const groups: BoardGroup[] = [
    {
      title: "تسجيل عملية",
      icon: ReceiptText,
      entries: [
        { label: "تسجيل بيع", description: "بيع فوري بلا طلب", href: "/direct-sales/new" },
        {
          label: "تسجيل مصروف",
          description: "مصروف ومدفوعاته من أصل واحد",
          href: "/finance/new/operating_expense",
        },
        { label: "تسجيل شراء", description: "شراء مواد وبنوده ودفعاته", href: "/suppliers/purchase/new" },
      ],
    },
    {
      title: "النقد والمستحقات",
      icon: WalletCards,
      entries: [
        { label: "النقد", description: "المحافظ وحركاتها وعدّها ومطابقتها", href: "/cash" },
        { label: "ديون العملاء", description: "ما لك عند غيرك ومواعيده", href: "/finance/upcoming" },
        { label: "للموردين ومصاريف مستحقة", description: "ما عليك لمورّديك والتزاماتك", href: "/suppliers" },
      ],
    },
    {
      title: "الكشوف والسجلات",
      icon: ReceiptText,
      entries: [
        { label: "كشف الفترة", description: "بنطاق المالية المطبق نفسه", href: statementHref },
        { label: "سجل العمليات", description: "القارئ الكامل لكل النشاط", href: "/finance/activity" },
        { label: "المشتريات", description: "سجل الشراء والدفع والاستلام", href: "/suppliers" },
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
      title: "مال المالك",
      icon: Landmark,
      entries: [
        {
          label: "مال المالك",
          description: "إضافة وسحب وحقوق بمعانٍ مميزة",
          href: "/finance/owner-entitlement",
        },
      ],
    },
    {
      title: "عند الحاجة",
      icon: Wrench,
      entries: [
        { label: "المخزون", description: "مواد تختار تتبعها", href: "/inventory" },
        { label: "المعدات", description: "أصولك وإهلاكها — اختياري", href: "/assets" },
        { label: "ميزانيات المصروف", description: "خطة شهرية للمقارنة لا حدث مالي", onOpen: onOpenBudgets },
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
                      consumeBoardSentinel();
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
