/** Micro design reminder: App composes providers and routes only; money and LocalStore remain outside React. */
import { Toaster } from "@/components/ui/sonner";
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
            <Toaster
              position="top-center"
              dir="rtl"
              offset="calc(56px + env(safe-area-inset-top) + 8px)"
              style={{ zIndex: 70, width: "min(100% - 32px, 420px)" }}
              toastOptions={{ duration: 4000 }}
            />
            <MicroRouter />
          </TooltipProvider>
        </ThemeProvider>
      </PrototypeServicesProvider>
    </ErrorBoundary>
  );
}

export default App;
