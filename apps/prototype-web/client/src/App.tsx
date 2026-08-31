/** Micro design reminder: App composes providers and routes only; money and LocalStore remain outside React. */
/* Q-003: أُزيل Toaster غير المستخدم — لا استدعاء toast() في الإنتاج؛ التغذية الراجعة
 * الفورية تبقى داخل النماذج برسائل inline كما في نظام التصميم. */
import { TooltipProvider } from "@/components/ui/tooltip";
import { MicroRouter } from "@/app/MicroRouter";
import { PrototypeServicesProvider } from "@/app/PrototypeServicesContext";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function App() {
  return (
    <ErrorBoundary>
      <PrototypeServicesProvider>
        <ThemeProvider defaultTheme="system" switchable>
          <TooltipProvider>
            <MicroRouter />
          </TooltipProvider>
        </ThemeProvider>
      </PrototypeServicesProvider>
    </ErrorBoundary>
  );
}

export default App;
