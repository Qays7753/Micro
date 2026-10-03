/**
 * Wave E (STR-620/§23): أنواع القارئ المالي المشتركة — وحدة أنواع ورقية
 * تفك دورة الأنواع projectFinancialService ↔ financialAnalysisService.
 *
 * الدورة كانت: projectFinancialService يستورد قيمتَي تشغيل من
 * financialAnalysisService (expenseInputs/orderInputs — حافة تشغيل باتجاه
 * واحد)، بينما financialAnalysisService يستورد نوع الصنف
 * ProjectFinancialService ليعلن حقن القارئ — فتتكوّن دورة على مستوى
 * الأنواع (SCC) تمر بـCI لأن حارس دورات التشغيل يتجاهل حواف الأنواع.
 *
 * الفك الميكانيكي (نقل الأنواع نصًّا حرفيًا — لا سلوك ولا صيغة تتحرك):
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
 *
 * Wave F (ADR-013 عنقود ٣ — 2026-10-04): أُكمل البيت الورقي بأنواع سطح
 * القارئ المتبقية (نتيجة الفترة والمؤشرات ومدخلات الكتابة) — انتقلت حرفيًا
 * من projectFinancialService.ts عند تقسيم مسؤوليته الداخلي، فصارت هذه
 * الوحدة بيت نموذج القارئ الكامل؛ الخدمة تعيد التصدير كما هي فلا يتغير
 * أي مستورد من المئة والخمسة عشر القائمة.
 */
import type {
  AssetEventContext,
  DepositEventContext,
  FinancialEvent,
  FinancialEventType,
  LoanEventContext,
  OperatingExpenseContext,
} from "@micro-domain/financial-event/index.js";
import type { SOURCE_REF_KINDS } from "@micro-domain/cash-continuity/index.js";
import type { OperatingBreakEvenResult } from "@micro-domain/financial-analysis/index.js";
import type { SharedExpenseRecordInput } from "@/application/financial-records/expenseRecordIntent";

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

export type CogsStatus = "recorded" | "partial" | "not_available";
export type RecordedPeriodResult = {
  from: string;
  to: string;
  /* القرار ١٠: التقارير القديمة تقول صراحةً إن المخزون لم يكن مُدارًا — لا إخفاء ولا صفر.
   * null = لم يُدر المخزون إطلاقًا؛ وتاريخ لاحق لبداية الفترة = جزء الفترة قبل التفعيل بلا إدارة. */
  inventoryManagedFrom: string | null;
  recognizedRevenueMinor: number;
  recognizedDirectCostMinor: number;
  snapshotDirectCostMinor: number;
  recordedCogsMinor: number;
  effectiveDirectCostMinor: number;
  cogsStatus: CogsStatus;
  cogsMissingOrderCount: number;
  unallocatedInventoryCostMinor: number;
  generalInventoryWasteMinor: number;
  cogsReasons: readonly string[];
  recordedOperatingExpenseMinor: number;
  projectOperatingExpenseMinor: number;
  sharedProjectExpenseMinor: number;
  sharedUnallocatedExpenseMinor: number;
  legacyUnclassifiedExpenseMinor: number;
  sharedEstimatedExpenseCount: number;
  sharedMissingBasisCount: number;
  sharedUnallocatedExpenseCount: number;
  legacyUnclassifiedExpenseCount: number;
  /* F-005 (قرار المالك D-01): البيع المباشر يُعترف بإيراده في نتيجة الفترة بتاريخ
   * البيع نفسه (occurredOn) لا بتاريخ القبض — والملغى مستبعد، والتكلفة غير المعروفة
   * تبقى غير معروفة فلا يُعرض ربحٌ يبدو قاطعًا. قراءة مشتقة فقط: لا سجل يُعاد كتابته. */
  directSaleCount: number;
  directSaleCancelledCount: number;
  directSaleRevenueMinor: number;
  directSaleCostKnownMinor: number;
  directSaleCostUnknownCount: number;
  /* المجموعة ٤ (عقد ٢٩): الإهلاك المسجّل — بند مستقل غير نقدي يخفض النتيجة
   * ولا يدخل بند المصروفات التشغيلية أبدًا. */
  assetDepreciationMinor: number;
  /* خسارة شطب أصل — غير نقدية، مبلغ دفتري مفقود صراحةً. */
  assetWriteOffLossMinor: number;
  /* نتيجة التخلص: المقابل ناقص الدفتري — سالبة خسارة وموجبة ربح، معلنة. */
  assetDisposalResultMinor: number;
  /* إيراد عربون محتفظ به مصنَّف صراحةً — يُعترف مرة واحدة بتاريخ التصنيف. */
  retainedDepositRevenueMinor: number;
  /* F-019 (W2-D): الخسارة غير النقدية (loss_non_cash) بند مستقل محايد
   * المعادلة — كانت ملفوفة داخل المصروف التشغيلي باسم لا يليق بها؛ البند نفسه
   * يُخصم من النتيجة فالقيمة لا تتغير، والتمييز هو التصحيح. */
  nonCashLossMinor: number;
  /* F-008 (W2-D — ثم قرار المالك D-03 بتاريخ 2026-09-29): كلفة التوصيل التي
   * دفعها المشروع للطلبات النهائية خارج اللقطة — معلنة حقلًا وسببًا بلا طرح
   * ثانية أبدًا: الحقل تحلل تفسيري، والخصم الموثق الوحيد مسار التسجيل اليدوي
   * للمصروف، منعًا للخصم المزدوج. */
  projectDeliveryCostMinor: number;
  /* F-020 (W3-B): الحقول المشتقة للفرق غير المحصّل — قراءة لحظية بلا أي
   * تغيير معادلة ولا كتابة. المصدر الكنوني نفسه الذي يحفظه المجال:
   * receivableMinor للطلب (أساس قيمة الطلب القابلة للتحصيل — D-15-A)
   * وrevenueMinor−collectedMinor للبيع المباشر (W2-A). سطر عرض «منها X
   * غير محصّل» ينتظر قرار المالك س4/D-05 — الحقل يُشتق الآن من مالك واحد
   * كي لا تُخترع معادلة موازية عند القرار. */
  orderReceivableMinor: number;
  directSaleUncollectedMinor: number;
  resultMinor: number | null;
  finalOrderCount: number;
  excludedOrderCount: number;
  expenseNeedsReviewCount: number;
  status: "recorded_only" | "incomplete" | "invalid";
  reasons: readonly string[];
};
export type FinancialInsightStatus = "recorded_only" | "incomplete" | "not_available";
export type WorkNameProfitability = {
  itemName: string;
  finalOrderCount: number;
  deliveredQuantity: number;
  recognizedRevenueMinor: number;
  recognizedDirectCostMinor: number;
  directMarginMinor: number;
};
export type RecordedCostComposition = {
  materialMinor: number;
  timeMinor: number;
  packagingMinor: number;
  deliveryMinor: number;
  /* F-019 (W2-D): الخسارة غير النقدية مفصولة عن المصروف التشغيلي — اتساقًا
   * عبر الأسطح مع القارئ الكنوني. */
  nonCashLossMinor: number;
  wasteMinor: number;
  operatingExpenseMinor: number;
};
/* REM-007 (تصحيح تكافؤ المستهلكين — 2026-09-30): CoverageIndicator عقد
 * عرض/مهايئ فوق القراءة الكنسية المركّبة نفسها التي يستهلكها G5 — ليس معادلة
 * ثانية: حقول التشغيل ملتقطة (Pick) من النوع الكنوني نفسه كما هي، بلا هدف
 * (لا سطح إدخال هدف في المؤشرات المالية — الهدف قراءة G5 اختيارية فقط). */
export type CoverageIndicator = Pick<
  OperatingBreakEvenResult,
  | "fixedExpenseMinor"
  | "directMarginMinor"
  | "breakEvenUnits"
  | "operatingResultMinor"
  | "breakEvenState"
  | "breakEvenSalesValueMinor"
  | "contributionMarginRatioPermyriad"
  | "remainingToBreakEvenMinor"
  | "amountAboveBreakEvenMinor"
  | "classificationGap"
> & {
  status: FinancialInsightStatus;
  /* F-009 (W2-B): الكمية الموحدة للنموذج الكنوني — null عند عدم قابلية التوحيد
   * (وحدات مختلطة بلا تحويل) بدل جمع وحدات غير متوافقة رقمًا واحدًا. */
  finalDeliveredQuantity: number | null;
  reasons: readonly string[];
};
export type RecordedLiquidity = {
  status: "recorded_only" | "incomplete";
  recordedCashMinor: number;
  customerReceivablesMinor: number;
  supplierPayablesMinor: number;
  cashCoverageAfterLiabilitiesMinor: number;
  /* S2-05 (تدقيق المجموعة ٥): الأمانات المحتجزة كاش موجود لكنه ليس مالكًا —
   * تظهر هنا لتفسر التغطية بصدق بدل تضخيمها بصمت. */
  amanahHeldMinor: number;
  amanahNotice: string | null;
};
export type FinancialInsights = {
  period: RecordedPeriodResult;
  workNames: readonly WorkNameProfitability[];
  costComposition: RecordedCostComposition;
  inventoryMovementCount: number;
  coverage: CoverageIndicator;
  liquidity: RecordedLiquidity;
};
export type FinancialRecordInput = {
  type: FinancialEventType;
  amountMinor?: number;
  occurredOn: string;
  note: string;
  counterparty: string | null;
  relatedEventId: string | null;
  expenseContext?: OperatingExpenseContext | null;
  /* G-006 (تدقيق الإدارة المالية المتدرجة ٢٠٢٦-٠٩-١٩): محفظة مصدر سحب
   * المالك — اختياري توافقي؛ عند تعيينه يُفحص تغطية رصيدها قبل أي كتابة
   * بالحرس الكنوني المشترك نفسه لمسار الدفتر. غيابه = الكاش غير الموزع. */
  sourceWalletId?: string | null;
  /* جولة الاستئناف (F-2): سياقات العائلات المتخصصة تمر عبر التصحيح العام
   * (استرجاع/تعديل) كما تمر عبر التسجيل — الأصل والقرض والعربون أحداث لها
   * سياق إلزامي في عقد المجال، وتغيّره عند الاسترجاع كان يفشل بلا كتابة. */
  assetContext?: AssetEventContext | null;
  loanContext?: LoanEventContext | null;
  depositContext?: DepositEventContext | null;
  idempotencyKey: string;
  sharedExpense?: SharedExpenseRecordInput;
};
export type FinancialReversalInput = {
  sourceEventId: string;
  occurredOn: string;
  reason: string;
  idempotencyKey: string;
};
/* PA-002: توزيع صريح من الكاش غير الموزع إلى محفظة، أو تغطية صرف منها.
 * المجموعة ٢ (§9.1): مصدر التخصيص يُحفظ مع الحركة ليصل دفتر المحفظة للمصدر. */
export type UnallocatedDistributionInput = {
  walletId: string;
  deltaMinor: number;
  note?: string | null;
  operationKey?: string;
  occurredOn?: string;
  sourceRefId?: string | null;
  sourceRefKind?: (typeof SOURCE_REF_KINDS)[number] | null;
  /* المجموعة ٦ (S2-04أ): حدث القبضة المصدر — يربط التخصيص بسطر التحصيل نفسه
   * فيصير التراجع المزدوج قابلًا للتحديد المطابق بلا تخمين. */
  sourceRefLineId?: string | null;
};
/* تعديل/حذف بسيطان (مبدأ المالك ٥.٦): التراجع والبديل في معاملة واحدة ذرّية. */
export type FinancialEditInput = {
  sourceEventId: string;
  amountMinor: number;
  occurredOn: string;
  note: string;
  counterparty: string | null;
  /* Conflict H (WF-04): تصحيح تصنيف المصروف بعد الحفظ — البديل يحمل التصنيف
   * الجديد والأصل يبقى بتصنيفه؛ تمريره اختياري (غير مرّر = التصنيف كما هو). */
  expenseContext?: OperatingExpenseContext | null;
  reason?: string | null;
  idempotencyKey: string;
};
export type SettleablePayable = { event: FinancialEvent; remainingMinor: number };
