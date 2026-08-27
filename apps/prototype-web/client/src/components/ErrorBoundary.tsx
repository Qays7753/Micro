/** Micro design reminder: recovery states are calm, Arabic, and explicit about the next action. */
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): State {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <main className="micro-error-boundary" dir="rtl">
          <span className="micro-empty-symbol">
            <AlertTriangle aria-hidden="true" />
          </span>
          <span className="micro-overline">تعذر فتح هذا السطح</span>
          <h1>لم يتم تغيير بياناتك</h1>
          <p>أعد فتح التطبيق. إذا تكرر الأمر لاحقًا، ستتمكن من تصدير بياناتك المحلية قبل أي إعادة ضبط.</p>
          <button
            type="button"
            className="micro-button micro-button-primary"
            onClick={() => window.location.reload()}
          >
            <RotateCcw aria-hidden="true" /> إعادة الفتح
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
