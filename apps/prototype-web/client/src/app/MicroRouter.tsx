/**
 * Micro design reminder: routes render inside one continuous Android-like shell;
 * every destination has a clear next action and no desktop-only navigation split.
 */
import { lazy, Suspense } from "react";
import { Redirect, Route, Switch } from "wouter";
import { MicroAppShell } from "@/components/layout/MicroAppShell";
import { StartupGate } from "@/app/StartupGate";
/* المجموعة ٥ (عقد ٣٧): بوابة القفل المحلي — غطاء فوق المحتوى بعد الإقلاع. */
import { AppLockGate } from "@/components/security/AppLockGate";

const Home = lazy(() => import("@/pages/Home"));
const Orders = lazy(() => import("@/pages/Orders"));
const DirectSaleEditor = lazy(() => import("@/pages/DirectSaleEditor"));
const SettingsPage = lazy(() => import("@/pages/Settings"));
/* المجموعة ١ (ملف المالك): /profile — سطح بلا مقعد سادس؛ الدخول من الترويسة/الإعدادات. */
const Profile = lazy(() => import("@/pages/Profile"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Setup = lazy(() => import("@/pages/Setup"));
const Foundation = lazy(() => import("@/pages/Foundation"));
const DraftEditor = lazy(() => import("@/pages/DraftEditor"));
const NewDraft = lazy(() => import("@/pages/NewDraft"));
const CostEditor = lazy(() => import("@/pages/CostEditor"));
const AgreementEditor = lazy(() => import("@/pages/AgreementEditor"));
const OrderDetail = lazy(() => import("@/pages/OrderDetail"));
/* المجموعة ٣ (عقد D5): مراجعة التسليم — سطح كامل قبل الالتزام. */
const DeliveryReview = lazy(() => import("@/pages/DeliveryReview"));
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
/* المجموعة ٣ (Scope A): الحاسبة مسار عميق كامل — أداة تفكير بلا أثر مالي. */
const CostCalculator = lazy(() => import("@/pages/CostCalculator"));
/* المجموعة ٣ (Scope B): صفحة التقدير المحفوظ — قراءة وأفعال لا محرر ثانٍ. */
const EstimateDetail = lazy(() => import("@/pages/EstimateDetail"));
/* المجموعة ١ (فحص سلامة مالي): قارئ سطح تحت أدواتي — يبقى شريط التنقل. */
const ToolsIntegrity = lazy(() => import("@/pages/ToolsIntegrity"));
const Parties = lazy(() => import("@/pages/Parties"));
const CashDistribution = lazy(() => import("@/pages/CashDistribution"));
const CashCount = lazy(() => import("@/pages/CashCount"));
/* المجموعة ٤ (عقد ٢٩): الأصول والقروض وتصنيف العربون — أسطح قراءة ومحررات عميقة. */
const Assets = lazy(() => import("@/pages/Assets"));
const AssetEditor = lazy(() => import("@/pages/AssetEditor"));
const AssetDetail = lazy(() => import("@/pages/AssetDetail"));
const Loans = lazy(() => import("@/pages/Loans"));
const LoanEditor = lazy(() => import("@/pages/LoanEditor"));
const LoanDetail = lazy(() => import("@/pages/LoanDetail"));
/* المجموعة ٢ (Scope B): ورقة التحصيل — سطح تحصيل مخصص واعٍ بالسياق والمصدر. */
const Collect = lazy(() => import("@/pages/Collect"));
/* المجموعة ٢ (§9.1): دفتر المحفظة — قراءة سطحية فوق سياق المحافظ. */
const WalletLedger = lazy(() => import("@/pages/WalletLedger"));
/* المجموعة ٢ (§9.2): كشف الفترة — قراءة سطحية من مالي. */
const Statement = lazy(() => import("@/pages/Statement"));
/* المجموعة ٥ (عقد ٣٠): القارئ الكامل للنشاط — سطح قراءة في بيت مالي. */
const FinanceActivity = lazy(() => import("@/pages/FinanceActivity"));
/* المجموعة ٥ (عقد ٣٣): معاينة المشاركة اليدوية — محرر نص عميق يحرس المدخلات. */
const SharePreview = lazy(() => import("@/pages/SharePreview"));

export function MicroRouter() {
  return (
    <MicroAppShell>
      <Suspense fallback={<RouteLoadingState />}>
        <StartupGate>
          <AppLockGate>
            <Switch>
              <Route path="/setup" component={Setup} />
              {/* §2.5: صفحة الأساس — باب أمامي دائم الوصول لا يُغلق بعد اليوم الأول (القرار ٧). */}
              <Route path="/foundation" component={Foundation} />
              <Route path="/orders/new" component={NewDraft} />
              {/* و٥ (§٥-١): محرر النية الفارغ — المسودة تُنشأ عند أول إدخال حقيقي لا عند النقر.
               * (المجموعة ٣): المسار الحرفي `/orders/draft/new` حُذف — كان يطابق أولًا في
               * Switch بلا معاملات فيصل params.id غير معرّف للمحرر؛ النمط `:id` يغطيه
               * بـ id="new" كما تختبره U-004/G3. */}
              <Route path="/direct-sales/new" component={DirectSaleEditor} />
              <Route path="/direct-sales/:id" component={DirectSaleEditor} />
              <Route path="/orders/draft/:id/agreement" component={AgreementEditor} />
              <Route path="/orders/draft/:id/cost" component={CostEditor} />
              <Route path="/orders/draft/:id" component={DraftEditor} />
              {/* المجموعة ٣ (عقد D5): مراجعة التسليم قبل المسار الأكثر تحديدًا */}
              <Route path="/orders/:id/deliver" component={DeliveryReview} />
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
              {/* المجموعة ٢ (§9.1): دفتر المحفظة — قارئ، يبقى التنقل السفلي، ويعود لمحافظه. */}
              <Route path="/cash/wallet/:id" component={WalletLedger} />
              <Route path="/cash/wallet/:id/opening-later" component={CashOpeningLaterEditor} />
              <Route path="/cash/transfer" component={CashTransferEditor} />
              <Route path="/cash/distribute" component={CashDistribution} />
              <Route path="/cash/count" component={CashCount} />
              <Route path="/cash/wallet/:id/adjust" component={CashAdjustmentEditor} />
              <Route path="/cash/entry/:id/reverse" component={CashReversalEditor} />
              <Route path="/cash" component={CashWallets} />
              {/* المجموعة ٢ (Scope B): ورقة التحصيل — تحصيل الذمم من كل المداخل المعتمدة. */}
              <Route path="/collect" component={Collect} />
              <Route path="/inventory/material/new" component={MaterialEditor} />
              {/* المجموعة ٢ (عقد ٢٨): تأكيد رصيد مادة قائمة — نفس مكوّن الرحلة بوضع التأكيد. */}
              <Route path="/inventory/material/:id/confirm" component={MaterialEditor} />
              <Route path="/inventory/movement/:id/reverse" component={InventoryReversalEditor} />
              <Route path="/inventory/movement/:type" component={InventoryMovementEditor} />
              <Route path="/inventory" component={InventoryMaterials} />
              <Route path="/catalog" component={Catalog} />
              <Route path="/tools" component={Tools} />
              {/* المجموعة ٣ (Scope A/B): حاسبة عميقة + تفصيل تقدير — يخفيان التنقل كإخوتهما المحررات. */}
              <Route path="/tools/calculator" component={CostCalculator} />
              <Route path="/tools/estimate/:id" component={EstimateDetail} />
              {/* المجموعة ١ (فحص سلامة مالي): مسار سطح — قارئ يبقي التنقل السفلي. */}
              <Route path="/tools/integrity" component={ToolsIntegrity} />
              {/* المجموعة ٤ (عقد ٢٩): محررا الأصل والقرض قبل المسارات الأكثر تحديدًا */}
              <Route path="/assets/new" component={AssetEditor} />
              <Route path="/assets/:id" component={AssetDetail} />
              <Route path="/assets" component={Assets} />
              <Route path="/loans/new" component={LoanEditor} />
              <Route path="/loans/:id" component={LoanDetail} />
              <Route path="/loans" component={Loans} />
              <Route path="/parties" component={Parties} />
              <Route path="/finance" component={Finance} />
              {/* المجموعة ٢ (§9.2): كشف الفترة — قراءة بسيطة تربط كل سطر بمصدره. */}
              <Route path="/finance/statement" component={Statement} />
              <Route path="/finance/activity" component={FinanceActivity} />
              <Route path="/share/preview" component={SharePreview} />
              <Route path="/orders" component={Orders} />
              {/* §2.2: المراجعة اندمجت نبضة داخل مالي؛ المسار القديم يقود إليها لا إلى 404. */}
              <Route path="/review">
                <Redirect to="/finance" />
              </Route>
              <Route path="/settings" component={SettingsPage} />
              <Route path="/profile" component={Profile} />
              <Route path="/" component={Home} />
              <Route component={NotFound} />
            </Switch>
          </AppLockGate>
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
