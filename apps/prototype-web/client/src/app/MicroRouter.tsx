/**
 * Micro design reminder: routes render inside one continuous Android-like shell;
 * every destination has a clear next action and no desktop-only navigation split.
 */
import { lazy, Suspense } from "react";
import { Redirect, Route, Switch } from "wouter";
import { MicroAppShell } from "@/components/layout/MicroAppShell";
import { StartupGate } from "@/app/StartupGate";

const Home = lazy(() => import("@/pages/Home"));
const Orders = lazy(() => import("@/pages/Orders"));
const DirectSaleEditor = lazy(() => import("@/pages/DirectSaleEditor"));
const SettingsPage = lazy(() => import("@/pages/Settings"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Setup = lazy(() => import("@/pages/Setup"));
const Foundation = lazy(() => import("@/pages/Foundation"));
const DraftEditor = lazy(() => import("@/pages/DraftEditor"));
const NewDraft = lazy(() => import("@/pages/NewDraft"));
const CostEditor = lazy(() => import("@/pages/CostEditor"));
const AgreementEditor = lazy(() => import("@/pages/AgreementEditor"));
const OrderDetail = lazy(() => import("@/pages/OrderDetail"));
const Schedule = lazy(() => import("@/pages/Schedule"));
const ScheduleEditor = lazy(() => import("@/pages/ScheduleEditor"));
const Finance = lazy(() => import("@/pages/Finance"));
const OwnerEntitlement = lazy(() => import("@/pages/OwnerEntitlement"));
/* X-05 (و٣): المدخل الواحد لسحب المالك — يسأل «سحب من المشروع لنفسك؟» ويكتب إلى المسار الصحيح. */
const OwnerWithdrawalEditor = lazy(() => import("@/pages/OwnerWithdrawalEditor"));
const G5DeclarationEditor = lazy(() => import("@/pages/G5DeclarationEditor"));
const FinancialEventEditor = lazy(() => import("@/pages/FinancialEventEditor"));
const Suppliers = lazy(() => import("@/pages/Suppliers"));
const SupplierPurchaseEditor = lazy(() => import("@/pages/SupplierPurchaseEditor"));
const CashWallets = lazy(() => import("@/pages/CashWallets"));
const CashWalletEditor = lazy(() => import("@/pages/CashWalletEditor"));
/* D-004: إكمال رصيد الافتتاح المجهول لاحقًا — حدث موثق إضافي لا إعادة كتابة. */
const CashOpeningLaterEditor = lazy(() => import("@/pages/CashOpeningLaterEditor"));
const CashTransferEditor = lazy(() => import("@/pages/CashTransferEditor"));
const CashAdjustmentEditor = lazy(() => import("@/pages/CashAdjustmentEditor"));
const CashReversalEditor = lazy(() => import("@/pages/CashReversalEditor"));
const InventoryMaterials = lazy(() => import("@/pages/InventoryMaterials"));
const MaterialEditor = lazy(() => import("@/pages/MaterialEditor"));
const InventoryMovementEditor = lazy(() => import("@/pages/InventoryMovementEditor"));
const InventoryReversalEditor = lazy(() => import("@/pages/InventoryReversalEditor"));
const Catalog = lazy(() => import("@/pages/Catalog"));
/* «أدواتي» (مبدأ المالك ٥.٤): وجهة مستقلة للحاسبة والتقديرات وحالة الوحدات. */
const Tools = lazy(() => import("@/pages/Tools"));
const Parties = lazy(() => import("@/pages/Parties"));
const CashDistribution = lazy(() => import("@/pages/CashDistribution"));
const CashCount = lazy(() => import("@/pages/CashCount"));

export function MicroRouter() {
  return (
    <MicroAppShell>
      <Suspense fallback={<RouteLoadingState />}>
        <StartupGate>
          <Switch>
            <Route path="/setup" component={Setup} />
            {/* §2.5: صفحة الأساس — باب أمامي دائم الوصول لا يُغلق بعد اليوم الأول (القرار ٧). */}
            <Route path="/foundation" component={Foundation} />
            <Route path="/orders/new" component={NewDraft} />
            {/* و٥ (§٥-١): محرر النية الفارغ — المسودة تُنشأ عند أول إدخال حقيقي لا عند النقر. */}
            <Route path="/orders/draft/new" component={DraftEditor} />
            <Route path="/direct-sales/new" component={DirectSaleEditor} />
            <Route path="/direct-sales/:id" component={DirectSaleEditor} />
            <Route path="/orders/draft/:id/agreement" component={AgreementEditor} />
            <Route path="/orders/draft/:id/cost" component={CostEditor} />
            <Route path="/orders/draft/:id" component={DraftEditor} />
            <Route path="/orders/:id" component={OrderDetail} />
            <Route path="/schedule/:id" component={ScheduleEditor} />
            <Route path="/schedule" component={Schedule} />
            <Route path="/finance/new/:type" component={FinancialEventEditor} />
            <Route path="/finance/withdraw" component={OwnerWithdrawalEditor} />
            <Route path="/finance/owner-entitlement" component={OwnerEntitlement} />
            <Route path="/finance/g5/declaration" component={G5DeclarationEditor} />
            <Route path="/suppliers/purchase/:id/payment" component={SupplierPurchaseEditor} />
            <Route path="/suppliers/purchase/:id" component={SupplierPurchaseEditor} />
            <Route path="/suppliers" component={Suppliers} />
            <Route path="/cash/wallet/new" component={CashWalletEditor} />
            <Route path="/cash/wallet/:id/opening-later" component={CashOpeningLaterEditor} />
            <Route path="/cash/transfer" component={CashTransferEditor} />
            <Route path="/cash/distribute" component={CashDistribution} />
            <Route path="/cash/count" component={CashCount} />
            <Route path="/cash/wallet/:id/adjust" component={CashAdjustmentEditor} />
            <Route path="/cash/entry/:id/reverse" component={CashReversalEditor} />
            <Route path="/cash" component={CashWallets} />
            <Route path="/inventory/material/new" component={MaterialEditor} />
            <Route path="/inventory/movement/:id/reverse" component={InventoryReversalEditor} />
            <Route path="/inventory/movement/:type" component={InventoryMovementEditor} />
            <Route path="/inventory" component={InventoryMaterials} />
            <Route path="/catalog" component={Catalog} />
            <Route path="/tools" component={Tools} />
            <Route path="/parties" component={Parties} />
            <Route path="/finance" component={Finance} />
            <Route path="/orders" component={Orders} />
            {/* §2.2: المراجعة اندمجت نبضة داخل مالي؛ المسار القديم يقود إليها لا إلى 404. */}
            <Route path="/review">
              <Redirect to="/finance" />
            </Route>
            <Route path="/settings" component={SettingsPage} />
            <Route path="/" component={Home} />
            <Route component={NotFound} />
          </Switch>
        </StartupGate>
      </Suspense>
    </MicroAppShell>
  );
}

function RouteLoadingState() {
  return (
    <div className="micro-route-loading" role="status" aria-live="polite">
      جارٍ فتح المسار…
    </div>
  );
}
