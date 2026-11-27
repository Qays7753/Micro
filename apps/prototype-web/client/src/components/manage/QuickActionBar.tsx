/**
 * M5.2 (UX §2.0 C-07 «الأزرار السريعة»): شريط ثابت أسفل الشاشة فوق الشريط
 * السفلي — 4 أزرار بنفس الترتيب دائمًا: «بيع أو طلب» ← P-60 · «تحصيل أو
 * سداد» ← P-63 · «مصروف أو شراء» ← P-64 · «إيداع أو سحب شخصي» ← P-65.
 * يظهر في P-10 وP-30 فقط (مهمة التنسيق والتوثيق الكامل M5.10).
 *
 * لا معنى ماليًا هنا: تسميات ونقل فقط — النصوص من الكتالوج حصرًا.
 */
import { useLocation } from "wouter";
import { t } from "@/application/manage/strings";

/** أزرار C-07 الأربعة بترتيبها الملزم ووجهاتها (نماذج P-60+). */
const QUICK_ACTIONS: ReadonlyArray<{
  key: "op.sale" | "op.collect_pay" | "op.expense" | "op.owner";
  to: string;
}> = [
  { key: "op.sale", to: "/manage/op/sale" },
  { key: "op.collect_pay", to: "/manage/op/collect" },
  { key: "op.expense", to: "/manage/op/expense" },
  { key: "op.owner", to: "/manage/op/owner" },
];

export function QuickActionBar() {
  const [, navigate] = useLocation();
  return (
    <nav className="micro-manage-quickbar">
      {QUICK_ACTIONS.map(action => (
        <button
          key={action.key}
          type="button"
          className="micro-manage-quickbar__button"
          onClick={() => navigate(action.to)}
        >
          {t(action.key)}
        </button>
      ))}
    </nav>
  );
}
