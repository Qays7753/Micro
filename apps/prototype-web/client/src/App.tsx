/** Micro design reminder: App composes providers and routes only; money and LocalStore remain outside React. */
/* Q-003: أُزيل Toaster غير المستخدم — لا استدعاء toast() في الإنتاج؛ التغذية الراجعة
 * الفورية تبقى داخل النماذج برسائل inline كما في نظام التصميم. */
import { MicroRouter } from "@/app/MicroRouter";
import { PrototypeServicesProvider } from "@/app/PrototypeServicesContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function App() {
  return (
    <ErrorBoundary>
      <PrototypeServicesProvider>
        {/* W5 (D1): الفاتح هو الوضع الافتراضي؛ الداكن اختيار صريح محفوظ
            للمالك — لا يتبع النظام تلقائيًا أبدًا. */}
        <ThemeProvider defaultTheme="light" switchable>
          {/* W6 (GAP-21): أُزيل مزوّد التلميح الميت — لم يُعرض قطّ، وحزمة
              radix كانت تُشحن بلا مستهلك. */}
          <MicroRouter />
        </ThemeProvider>
      </PrototypeServicesProvider>
    </ErrorBoundary>
  );
}

export default App;
