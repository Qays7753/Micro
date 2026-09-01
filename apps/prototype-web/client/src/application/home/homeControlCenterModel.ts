export type HomeValueState = "known" | "incomplete" | "not_initialized";
export type HomeAction = { id: string; label: string; href: string; reason: string };
export type HomeFinancialFact = {
  id: "cash" | "receivables" | "payables" | "owner_capital";
  label: string;
  state: HomeValueState;
  valueMinor: number | null;
  currency: "JOD";
  /* §10: التفصيل خلف العلامة لا على الوجه — الحقول قابلة للغياب. */
  source: string | null;
  period: string | null;
  helper: string | null;
  /* §2.7: الحقيقة غير المسجلة تُعرض كطريق — «غير مسجل — سجّله (نقرة)» — لا كـ«غير مهيأ» عاجزة. */
  road: HomeAction | null;
};
/* قرار المالك على بند ١٠ (جلسة الإغلاق): «اليوم» و«ما يحتاج فعلًا الآن» يُدمجان في «اليوم» —
 * يُستوعب المحتوى ولا يُلغى، ولا بند يظهر مرتين. أنواع المسودة والتكلفة والنتيجة والسعة
 * انتقلت من قسم الانتباه القديم إلى أنواع بند «اليوم» بعناوينها وأفعالها نفسها. */
export type HomeTodayItem = {
  id: string;
  kind:
    | "follow_up_due"
    | "appointment_today"
    | "due_amount"
    | "follow_up_upcoming"
    | "draft"
    | "cost_incomplete"
    | "open_order"
    | "result_review"
    | "capacity_warning";
  title: string;
  detail: string | null;
  dateLocal: string | null;
  timeLocal: string | null;
  href: string;
  actionLabel: string;
  priority: number;
};
export type HomeTodaySection = {
  items: readonly HomeTodayItem[];
  upcomingCount: number;
  nextUpcomingDate: string | null;
  nextUpcomingHref: string | null;
  truth: string | null;
};
/* القرار ١٢: المالية وحدة جديدة دائمة في Home — بلا شرط بيانات، ولا تحل محل وحدة قائمة.
 * period_result يحتفظ بشرطه على وحدته وحده ولا ترث وحدته رؤيته (القرار ١٤). */
export type HomeFinanceUnit = {
  action: HomeAction;
  truth: string | null;
};
/* قرار المالك على بند ١١ (جلسة الإغلاق): «منتجاتي وخدماتي» كتلة دائمة مستقلة مثل «مالي» —
 * سؤالها (§2.3): ما أكرره وبكم؟ وهل هو رابح؟ */
export type HomeCatalogUnit = {
  action: HomeAction;
  truth: string | null;
};
export type HomeOptionalModule = {
  id: "schedule" | "period_result";
  label: string;
  state: "available" | "needs_setup" | "empty";
  action: HomeAction | null;
};
export type HomeRecentChange = {
  id: string;
  occurredOn: string;
  title: string;
  detail: string | null;
  href: string;
};
/* «أثناء غيابك» (التدفق ٢٣): بطاقة عودة بعد انقطاع — آخر تسجيل، وملخص آخر يوم
 * تسجيل فعليّ (بيع/مصروف/طلبات/متابعات)، وديون متأخرة، وعمر النسخة. U-002 (دورة
 * التدقيق النهائي): الملخص يصف آخر جلسة تسجيل — لا يمكن أن يتحرك شيء «خلال»
 * الغياب نفسه في تطبيق محلي أحادي المستخدم، فأي رقم آخر غير صادق. */
export type HomeAwayDigest = {
  /* آخر يوم سجّل فيه المالك شيئًا فعلًا (تاريخ التسجيل لا تاريخ الأثر). */
  lastRecordedOn: string;
  salesCount: number;
  salesRevenueMinor: number;
  expenseCount: number;
  expenseMinor: number;
  newOrderCount: number;
  upcomingFollowUpCount: number;
};
export type HomeAwaySection = {
  daysSinceLastActivity: number;
  overdueDebtCount: number;
  daysSinceLastExport: number | null;
  /* U-002: ملخص قصير قابل للفعل لا لوحة طويلة. */
  digest: HomeAwayDigest;
};
export type HomeControlCenterInput = {
  activityName: string;
  todayLocal: string;
  truthLine: string | null;
  financeUnit: HomeFinanceUnit;
  catalogUnit: HomeCatalogUnit;
  todaySection: HomeTodaySection;
  facts: readonly HomeFinancialFact[];
  optionalModules: readonly HomeOptionalModule[];
  recentChanges: readonly HomeRecentChange[];
  awaySection: HomeAwaySection | null;
};
export type HomeControlCenterViewModel = {
  heading: { activityName: string; todayLocal: string };
  truthLine: string | null;
  financeUnit: HomeFinanceUnit;
  catalogUnit: HomeCatalogUnit;
  todaySection: HomeTodaySection;
  facts: readonly HomeFinancialFact[];
  optionalModules: readonly HomeOptionalModule[];
  recentChanges: readonly HomeRecentChange[];
  awaySection: HomeAwaySection | null;
};

const compareToday = (left: HomeTodayItem, right: HomeTodayItem) =>
  left.priority - right.priority || left.id.localeCompare(right.id, "ar");

export function buildHomeControlCenterViewModel(input: HomeControlCenterInput): HomeControlCenterViewModel {
  /* دمج بند ١٠: لا بند يظهر مرتين — أول ظهور يحسم، والقائمة مرتبة بالأولوية. */
  const seenToday = new Set<string>();
  const todayItems = input.todaySection.items
    .filter(item => {
      if (seenToday.has(item.id)) return false;
      seenToday.add(item.id);
      return true;
    })
    .sort(compareToday);
  const facts = input.facts.map(fact =>
    fact.state === "known" && fact.valueMinor !== null ? fact : { ...fact, valueMinor: null },
  );
  const optionalModules = input.optionalModules.filter(module => module.state !== "empty");
  const recentChanges = input.recentChanges.slice(0, 5);
  return {
    heading: { activityName: input.activityName, todayLocal: input.todayLocal },
    truthLine: input.truthLine,
    financeUnit: input.financeUnit,
    catalogUnit: input.catalogUnit,
    todaySection: { ...input.todaySection, items: todayItems },
    facts,
    optionalModules,
    recentChanges,
    awaySection: input.awaySection,
  };
}
