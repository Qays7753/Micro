/**
 * Wave E (STR-620/§23): أنواع القارئ المالي المشتركة — وحدة أنواع ورقية
 * تفك دورة الأنواع projectFinancialService ↔ financialAnalysisService.
 *
 * الدورة كانت: projectFinancialService يستورد قيمتَي تشغيل من
 * financialAnalysisService (expenseInputs/orderInputs — حافة تشغيل باتجاه
 * واحد)، بينما financialAnalysisService يستورد نوع الصنف
 * ProjectFinancialService ليعلن حقن القارئ — فتتكوّن دورة على مستوى
 * الأنواع (SCC) تمر بCI لأن حارس دورات التشغيل يتجاهل حواف الأنواع.
 *
 * الفك الميكانيكي (نقل الأنواع نصًّا حرفيًّا — لا سلوك ولا صيغة تتحرك):
 * أنواع القراءة المشتركة (ProjectFinancialPosition وسلسلة أدلتها
 * وFinanceResult) انتقلت إلى هنا؛ projectFinancialService يعيد تصديرها
 * كما هي فلا تتغير واجهته العامة لأي مستورد قائم؛ وfinancialAnalysisService
 * يعلن حقنه بالنوع البنيوي `ProjectFinancialReader` — الحد الذي يحتاجه
 * فعلًا (قياس حي: readPosition وحدها) — من هذه الوحدة الورقية التي لا
 * تستورد شيئًا من الخدمتين.
 *
 * النتيجة: projectFinancialService → financialAnalysisService (تشغيل،
 * باتجاه واحد)؛ والطرفان → هذه الوحدة (أنواع فقط) — صفر دورات على أي
 * مستوى. أي مستورد يمرر الصنف الكامل يظل متوافقًا بنيويًا بلا أي تعديل
 * (الحقن التركيبي كما هو).
 */

/** مركز المشروع المالي المسجل — قراءة القارئ الكنوني (عقد ٤٠). */
export type ProjectFinancialPosition = {
  recordedCashMinor: number;
  customerReceivablesMinor: number;
  supplierPayablesMinor: number;
  ownerCapitalRecordedMinor: number;
  operatingExpensesRecordedMinor: number;
  orderCollectionsMinor: number;
  projectEventCount: number;
  supplierPurchaseCount: number;
  supplierMaterialPayablesMinor: number;
  /* Wave 4.4 — P-4.4-1: تقسيم «شو عليّ؟» بمصدرَيه يعيش في قراءة المركز —
   * المصاريف المستحقة = مشروع الذمم العامة (project.payableMinor)، وهي
   * بالضبط القيمة التي كان العرض يطرحها (supplierPayablesMinor −
   * supplierMaterialPayablesMinor)؛ لا معادلة جديدة ولا مصدر ثانٍ. */
  operatingPayablesMinor: number;
  walletCashMinor: number;
  unallocatedCashMinor: number;
  cashWalletCount: number;
  /* المبدأ ١٣: أمانات بحوزتك — كاش حقيقي في الدرج وليس إيرادًا ولا مالك لك. */
  amanahHeldMinor: number;
  /* ما انتقل من غير الموزع إلى المحافظ بتخصيص صريح (PA-002). */
  allocatedToWalletsMinor: number;
  /* المجموعة ٤ (عقد ٢٩): طبقات مستقلة في المركز — الدفتري للأصول النشطة،
   * والقروض القائمة (ذمم لصالح المشروع)، وعربونات محتفظة بانتظار القرار. */
  assetBookValueMinor: number;
  loansOutstandingMinor: number;
  /* FIN-001 (WS-178 — Wave 6): القروض المستلمة القائمة — التزام اقتراض مستقل
   * عن الذمم التشغيلية وعن القروض الصادرة؛ من مجموع أحداث المجال (loanPayable)
   * لا من رصيد مخزن. */
  borrowedLoansOutstandingMinor: number;
  pendingRetainedDepositsMinor: number;
  /* FIN-001 (قرار المالك المعتمد ٢٠٢٦-٠٩-١٦): حالة الدليل لكل مقياس —
   * «غير مسجل» لا يُعرض رقمًا مؤكدًا؛ القيم العددية أعلاه تبقى كما هي
   * (حسابًا) والعرض يتبع الحالة. صفر موثق ≠ غياب تسجيل. */
  evidence: ProjectFinancialEvidence;
};

/* FIN-001: القيمة العددية تبقى عددًا (لا nullable واسع يكسر الحسابات) —
 * الحالة تُقرأ منفصلة عن القيمة كما في الرئيسية تمامًا. */
export type FinancialMetricEvidence = "recorded" | "not_recorded";
export type ProjectFinancialEvidence = {
  cash: FinancialMetricEvidence;
  customerReceivables: FinancialMetricEvidence;
  supplierPayables: FinancialMetricEvidence;
  ownerCapital: FinancialMetricEvidence;
  walletCash: FinancialMetricEvidence;
  unallocatedCash: FinancialMetricEvidence;
  operatingExpenses: FinancialMetricEvidence;
  /* FIN-001 (WS-178 — Wave 6): دليل طبقة الاقتراض — أي حدث قرض مستلم يجعل
   * القيمة صفرًا موثقًا لا «غير مسجل» (نفس منطق إخوته). */
  borrowedLoans: FinancialMetricEvidence;
};

/** نتيجة قراءة مالية موحدة للقارئ الكنوني (عقد ٤٠). */
export type FinanceResult<T> =
  | { ok: true; value: T; reused?: boolean }
  | { ok: false; code: "validation_error" | "storage_error"; message: string };

/**
 * الحد الذي يحتاجه مستهلك قراءة المركز من القارئ الكنوني: قراءة المركز
 * وحدها — لا أكثر ولا أقل (STR-620: قياس حي لاستعمال financialAnalysisService).
 * الصنف ProjectFinancialService يحققه بنيويًا تلقائيًا.
 */
export type ProjectFinancialReader = {
  readPosition(): Promise<FinanceResult<ProjectFinancialPosition>>;
};
