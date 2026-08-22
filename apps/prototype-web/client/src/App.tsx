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
      <ThemeProvider
        defaultTheme="system"
        switchable
      >
        <PrototypeServicesProvider><TooltipProvider>
          <Toaster position="top-center" closeButton dir="rtl" />
          <MicroRouter />
        </TooltipProvider></PrototypeServicesProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
