/**
 * S10 (UNIT-030 — أمر b56967d8): «أدوات المشروع» — وجهة أدوات التخطيط
 * الخمس فقط: التكلفة والتسعير (T01)، قيمة ساعة العمل (T02)، كمية البيع
 * المطلوبة (T03)، نصيب المشروع من فاتورة مشتركة (T04)، وفحص الفكرة
 * الأولي (T05). لا أداة سادسة ولا جسر إلى معاملة (الجسور القديمة أزيلت
 * مداخلها من التجربة الجديدة وسجلاتها محفوظة عند صاحبها — U030-ACD06)؛
 * ومحفوظات T01 داخل الحاسبة لا في مقعد مستقل (UNIT-032). الهجرة النهائية
 * للتنقل ملك S16 — هذا السطح يبقى في مقعده الحالي بلا إعادة تصميم.
 */
import { ArrowLeft, Calculator, Clock, Lightbulb, Receipt, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { withReturnTo } from "@/app/navigationContract";

const TOOLS = [
  {
    id: "t01",
    title: "احسب التكلفة وحدد السعر",
    description: "تكلفة منتج افتراضي ثم جرب سعر بيع واربح متوقعًا وهامشه.",
    href: "/tools/calculator",
    icon: Calculator,
  },
  {
    id: "t02",
    title: "احسب قيمة ساعة عملك",
    description: "قيمة ساعة تقديرية من مقابل عملك ووقتك المنتج.",
    href: "/tools/hour-value",
    icon: Clock,
  },
  {
    id: "t03",
    title: "كم أحتاج أن أبيع؟",
    description: "كم وحدة تغطي مصاريف فترتك أو تحقق هدفًا.",
    href: "/tools/sales-quantity",
    icon: TrendingUp,
  },
  {
    id: "t04",
    title: "احسب نصيب المشروع من فاتورة مشتركة",
    description: "نصيب تقديري بأساس واضح — بلا تسجيل مصروف.",
    href: "/tools/invoice-share",
    icon: Receipt,
  },
  {
    id: "t05",
    title: "راجع فكرتك قبل البدء",
    description: "ملخص إجاباتك وما ينقصك وخطوة التحقق التالية.",
    href: "/tools/idea-review",
    icon: Lightbulb,
  },
] as const;

export default function Tools() {
  const [, navigate] = useLocation();
  return (
    <section className="micro-page micro-tools-page">
      <div className="micro-page-heading">
        <span className="micro-overline">أدوات المشروع</span>
        <h1>احسب قبل أن تلتزم</h1>
        <p>أدوات تخطيط مستقلة — لا تغيّر سجلات مشروعك، والنتائج تقديرية دومًا.</p>
      </div>

      <section className="micro-decision-card" aria-label="قاعدة الأدوات">
        <span>قاعدة هذه الأدوات</span>
        <strong>كل نتائجها تقديرية. ما يُسجَّل منها أي حركة مالية ولا مخزون ولا طلب.</strong>
        <p>قرار التسجيل يبقى فعلًا منفصلًا ومقصودًا عند صاحب كل سجل.</p>
      </section>

      <section
        className="micro-settings-list"
        aria-label="أدوات المشروع الخمس"
        data-testid="project-tools-list"
      >
        {TOOLS.map(tool => (
          <article className="micro-setting-row" key={tool.id} data-testid={`tool-entry-${tool.id}`}>
            <span className="micro-setting-icon">
              <tool.icon aria-hidden="true" />
            </span>
            <div>
              <strong>{tool.title}</strong>
              <p className="micro-home-quiet">{tool.description}</p>
              <div className="micro-form-actions">
                <button
                  className="micro-text-action"
                  type="button"
                  onClick={() => navigate(withReturnTo(tool.href, "/tools"))}
                >
                  افتح الأداة <ArrowLeft aria-hidden="true" />
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>
      <p className="micro-local-truth">
        أدوات التخطيط لا تقرأ أرصدة مشروعك ولا تكتب أي سجل — حساباتك تبقى على هذا الجهاز.
      </p>
    </section>
  );
}
