/** Micro design reminder: recovery states are calm, Arabic, and explicit about the next action. */
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, type ReactNode } from "react";
import { localDiagnostics, routeTemplateFor } from "@/application/diagnostics";

import { Button } from "@/components/primitives";
interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  /* المجموعة ٥ (التحصين الكامل): معرف الحادثة المحلي إن نجح تسجيلها — يظهر
   * للمالك فقط عند وجوده؛ فشل التسجيل لا يُسقط الركن ولا يظهر شيئًا كاذبًا. */
  incidentId: string | null;
}
class ErrorBoundary extends Component<Props, State> {
  /* التحصين الكامل (المجموعة ٣): السقوط يُعلن صوتيًا ويستقبل التركيز —
   * لا Stack Trace ولا تفاصيل داخلية تظهر للمستخدم (خصوصية كاملة).
   * R10-B4/RC-3 (F-016): استقبال التركيز عبر مرجع-ردّ ثابت على العنوان
   * القابل للتوجيه — يشتعل عند تركيب البديل نفسه فيغطي مسارَي السقوط
   * معًا (وقت التركيب وبعده) بلا دورتَي حياة؛ وثبات هوية الردّ يمنع
   * إعادة الاشتعال عند وصول معرّف الحادثة (لا سرقة تركيز — تحليل RV3
   * للخيارات الثلاثة)، وفشل المسجّل لا يمنعه ولا يمسّه. */
  private readonly focusHeading = (heading: HTMLHeadingElement | null): void => {
    heading?.focus();
  };
  /* المجموعة ٥: حارس التكرار — حادثة واحدة لكل سقوط مهما أُعيد النداء. */
  private recordedIncident = false;
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, incidentId: null };
  }
  static getDerivedStateFromError(): State {
    return { hasError: true, incidentId: null };
  }
  componentDidCatch(error: Error): void {
    if (this.recordedIncident) return;
    this.recordedIncident = true;
    /* كائن الاستثناء لا يدخل السجل أبدًا: يسجل رمز مطبوع وقالب مسار مخفي
     * فقط. التسجيل نفسه لا يرمي (null عند فشل التخزين) — وفشله لا يمس
     * الركن ولا يستدعي setState ثانية، فلا حلقة سقوط ممكنة أبدًا. */
    void error;
    let errorId: string | null = null;
    try {
      errorId = localDiagnostics.recordIncident({
        operation: "errorBoundary",
        errorCode: "render_crash",
        routeTemplate: routeTemplateFor(globalThis.location?.pathname ?? "/"),
      });
    } catch {
      /* حزام ثانٍ فوق عقد المسجّل (الذي لا يرمي أصلًا): فشل التسجيل لا
       * يُسقط الركن ولا يرمي داخل دورة الحياة فيكسر React نفسه. */
      errorId = null;
    }
    if (errorId !== null) this.setState({ incidentId: errorId });
  }
  render() {
    if (this.state.hasError) {
      return (
        <main className="micro-error-boundary" dir="rtl" role="alert">
          <span className="micro-empty-symbol">
            <AlertTriangle aria-hidden="true" />
          </span>
          <span className="micro-overline">تعذر فتح هذا السطح</span>
          <h1 tabIndex={-1} ref={this.focusHeading}>
            لم يتم تغيير بياناتك
          </h1>
          <p>أعد فتح التطبيق. إذا تكرر الأمر لاحقًا، ستتمكن من تصدير بياناتك المحلية قبل أي إعادة ضبط.</p>
          {this.state.incidentId ? (
            <p className="micro-incident-reference">
              معرّف الحادثة المحلي — آمن للنسخ إن احتجت مراجعته لاحقًا:{" "}
              <bdi dir="ltr">{this.state.incidentId}</bdi>
            </p>
          ) : null}
          <Button action="save" onClick={() => window.location.reload()}>
            <RotateCcw aria-hidden="true" /> إعادة الفتح
          </Button>
        </main>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
