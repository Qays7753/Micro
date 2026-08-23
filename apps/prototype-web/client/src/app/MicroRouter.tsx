/**
 * Micro design reminder: routes render inside one continuous Android-like shell;
 * every destination has a clear next action and no desktop-only navigation split.
 */
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import { MicroAppShell } from "@/components/layout/MicroAppShell";
import { StartupGate } from "@/app/StartupGate";

const Home = lazy(() => import("@/pages/Home"));
const Orders = lazy(() => import("@/pages/Orders"));
const Review = lazy(() => import("@/pages/Review"));
const SettingsPage = lazy(() => import("@/pages/Settings"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Setup = lazy(() => import("@/pages/Setup"));
const DraftEditor = lazy(() => import("@/pages/DraftEditor"));
const NewDraft = lazy(() => import("@/pages/NewDraft"));
const CostEditor = lazy(() => import("@/pages/CostEditor"));
const AgreementEditor = lazy(() => import("@/pages/AgreementEditor"));
const OrderDetail = lazy(() => import("@/pages/OrderDetail"));
const Schedule = lazy(() => import("@/pages/Schedule"));
const ScheduleEditor = lazy(() => import("@/pages/ScheduleEditor"));
const Finance = lazy(() => import("@/pages/Finance"));
const FinancialEventEditor = lazy(() => import("@/pages/FinancialEventEditor"));
const Suppliers = lazy(() => import("@/pages/Suppliers"));
const SupplierPurchaseEditor = lazy(() => import("@/pages/SupplierPurchaseEditor"));

export function MicroRouter() {
  return (
    <MicroAppShell>
      <Suspense fallback={<RouteLoadingState />}>
        <StartupGate><Switch>
          <Route path="/setup" component={Setup} />
          <Route path="/orders/new" component={NewDraft} />
          <Route path="/orders/draft/:id/agreement" component={AgreementEditor} />
          <Route path="/orders/draft/:id/cost" component={CostEditor} />
          <Route path="/orders/draft/:id" component={DraftEditor} />
          <Route path="/orders/:id" component={OrderDetail} />
          <Route path="/schedule/:id" component={ScheduleEditor} />
          <Route path="/schedule" component={Schedule} />
          <Route path="/finance/new/:type" component={FinancialEventEditor} />
          <Route path="/suppliers/purchase/:id/payment" component={SupplierPurchaseEditor} />
          <Route path="/suppliers/purchase/:id" component={SupplierPurchaseEditor} />
          <Route path="/suppliers" component={Suppliers} />
          <Route path="/finance" component={Finance} />
          <Route path="/" component={Home} />
          <Route path="/orders" component={Orders} />
          <Route path="/review" component={Review} />
          <Route path="/settings" component={SettingsPage} />
          <Route component={NotFound} />
        </Switch></StartupGate>
      </Suspense>
    </MicroAppShell>
  );
}

function RouteLoadingState() {
  return <div className="micro-route-loading" role="status" aria-live="polite">جارٍ فتح المسار…</div>;
}
