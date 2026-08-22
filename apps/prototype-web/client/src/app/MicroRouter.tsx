/**
 * Micro design reminder: routes render inside one continuous Android-like shell;
 * every destination has a clear next action and no desktop-only navigation split.
 */
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import { MicroAppShell } from "@/components/layout/MicroAppShell";

const Home = lazy(() => import("@/pages/Home"));
const Orders = lazy(() => import("@/pages/Orders"));
const Review = lazy(() => import("@/pages/Review"));
const SettingsPage = lazy(() => import("@/pages/Settings"));
const NotFound = lazy(() => import("@/pages/NotFound"));

export function MicroRouter() {
  return (
    <MicroAppShell>
      <Suspense fallback={<RouteLoadingState />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/orders" component={Orders} />
          <Route path="/review" component={Review} />
          <Route path="/settings" component={SettingsPage} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </MicroAppShell>
  );
}

function RouteLoadingState() {
  return <div className="micro-route-loading" role="status" aria-live="polite">جارٍ فتح المسار…</div>;
}
