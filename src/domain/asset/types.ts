/**
 * المجموعة ٤ (عقد ٢٩ — الأصول والإهلاك): سجل الأصل عقد تشغيلي مستقل، والحقيقة
 * المالية كلها أحداث مالية (شراء/إهلاك/تخلص/شطب) بدلتات معلنة. السجل يخزن
 * العقد (الاسم، القيمة، العمر النافع، بداية الإهلاك) وتاريخه التصحيحي؛ أما
 * الرصيد الدفتري فقراءة مشتقة من الأحداث النشطة — لا تُخزن ولا تُخمَّن.
 */
import type { MoneyMinor } from "../shared/index.js";

/* طريقة الاقتناء: نقد الآن أو التزام على المورد — عقدان مختلفان بأثرين مختلفين. */
export type AssetAcquisitionKind = "cash" | "payable";

/* S08 (UNIT-034 / CONS-DEC03·04·05 المعتمدة — SDF-066): مرجع طرف الاقتناء
 * المحفوظ (نمط S05 للمشتريات) — هوية مستقرة لا تدمج بالاسم، ولقطة الاسم
 * التاريخية تحفظ كما قُرئت لحظة الاقتناء فلا يعاد كتابتها بتعديل الاسم
 * لاحقًا. الغياب/null = اقتناء بلا طرف محفوظ (تعريف حر عند الالتزام فقط). */
export type AssetAcquisitionParty = {
  partyId: string;
  labelSnapshot: string;
};

/* حالة الأصل: نشط، تخلص منه (بيع/إخراج بمقابل)، أو شطب (خسارة غير نقدية). */
export type AssetStatus = "active" | "disposed" | "written_off";

/* تصنيف حر يشرح نوع الأصل — وسم قراءة فقط لا يغيّر أي دلتا. */
export type AssetRecord = {
  id: string;
  name: string;
  categoryLabel: string | null;
  acquisitionAmountMinor: MoneyMinor;
  acquisitionKind: AssetAcquisitionKind;
  /* تاريخ الشراء (يوم محلي YYYY-MM-DD) — للعرض وتاريخ البدايات. */
  purchaseDate: string;
  /* العمر النافع بالأشهر — null يعني «مجهول» صراحةً: لا جدول إهلاك ولا تخمين. */
  lifeMonths: number | null;
  /* بداية الاستخدام التي يبدأ بعدها الإهلاك — null تعني «غير محددة»: لا إهلاك حتى تُكمَّل. */
  depreciationStartOn: string | null;
  /* عقد ٤٣ (WS-179 — Wave 7): القيمة المتبقية المتوقعة نهاية العمر — اختيارية،
   * الغياب/null = ٠ (الأصول القديمة تُقرأ صفرًا بلا ترحيل). الإهلاك يجري على
   * (القيمة − المتبقية) فلا ينزل الدفتري تحت المتبقية أبدًا. */
  residualValueMinor?: MoneyMinor | null;
  /* عقد ٤٣ (WS-179 — Wave 7): مرجع/ملاحظة حرة (فاتورة/وثيقة/سياق) — وسم
   * عرض فقط لا يغيّر أي دلتا؛ الغياب/null = بلا ملاحظة. */
  note?: string | null;
  /* S08 (UNIT-034): طرف الاقتناء المحفوظ — اختياري بهوية مستقرة ولقطة اسم
   * تاريخية؛ الغياب = بلا طرف محفوظ (متوافق رجعيًا بنمط S06/S07). */
  acquisitionParty?: AssetAcquisitionParty | null;
  /* S08 (UNIT-034 / SDF-066 — الدفع الجزئي المعتمد): المدفوع لحظة الإنشاء
   * من قيمة الاقتناء — نمط initialPaidMinor عند مشتريات الموردين. الغياب/null
   * = مسار الدفع الكامل القائم (acquisitionKind يحكي القصة كلها)؛ والحضور
   * يجعل الاقتناء جزئيًا: حدث نقد بالمدفوع + حدث ذمم بالمتبقي، والحق الحي
   * يقرأ من الأحداث لا من هذا الحقل (عقد السجل يحمل نية الإنشاء فقط). */
  paidAtCreationMinor?: MoneyMinor | null;
  status: AssetStatus;
  /* ربط الحدث المالي الذي خلق الأصل (شراء نقدي أو التزام). */
  acquisitionEventId: string;
  /* تفاصيل التخلص مجمّدة لحظة الحدث: المقابل والمبلغ الدفتري آنذاك. */
  disposal: AssetDisposalRecord | null;
  /* تفاصيل الشطب مجمّدة لحظة الحدث: المبلغ الدفتري آنذاك. */
  writeOff: AssetWriteOffRecord | null;
  /* تاريخ عقد الأصل: كل تعديل للعمر/البداية مراجعة موثقة — التاريخ لا يُعاد كتابته. */
  contractRevisions: readonly AssetContractRevision[];
  operationKey: string;
  createdAt: string;
  updatedAt: string;
};

export type AssetDisposalRecord = {
  on: string;
  proceedsMinor: MoneyMinor;
  bookValueMinor: MoneyMinor;
  eventId: string;
  reason: string;
};

export type AssetWriteOffRecord = {
  on: string;
  bookValueMinor: MoneyMinor;
  eventId: string;
  reason: string;
};

export type AssetContractRevision = {
  revision: number;
  lifeMonths: number | null;
  depreciationStartOn: string | null;
  /* عقد ٤٣: لقطة القيمة المتبقية بعد هذه المراجعة — الغياب = مراجعة قديمة
   * قبل الحقل (تُقرأ ٠/كما كانت)؛ التوثيق لا يعيد كتابة التاريخ. */
  residualValueMinor?: MoneyMinor | null;
  note?: string | null;
  reason: string;
  changedAt: string;
};

export type CreateAssetRecordInput = {
  id: string;
  name: string;
  categoryLabel?: string | null;
  acquisitionAmountMinor: MoneyMinor;
  acquisitionKind: AssetAcquisitionKind;
  purchaseDate: string;
  lifeMonths?: number | null;
  depreciationStartOn?: string | null;
  /* عقد ٤٣ (WS-179 — Wave 7): المدخلان الجديدان — اختياريان (متبقية = ٠). */
  residualValueMinor?: MoneyMinor | null;
  note?: string | null;
  /* S08 (UNIT-034): طرف الاقتناء + المدفوع لحظة الإنشاء — اختياريان. */
  acquisitionParty?: AssetAcquisitionParty | null;
  paidAtCreationMinor?: MoneyMinor | null;
  acquisitionEventId: string;
  operationKey: string;
  createdAt: string;
};

export type ReviseAssetContractInput = {
  lifeMonths: number | null;
  depreciationStartOn: string | null;
  /* عقد ٤٣ (WS-179 — Wave 7): undefined = دون تغيير؛ null = إرجاع إلى ٠/بلا ملاحظة. */
  residualValueMinor?: MoneyMinor | null;
  note?: string | null;
  reason: string;
};

/* عرض إهلاك مقترح: رقم معلن لا يُسجَّل إلا بموافقة صريحة. المجهول يبقى مجهولًا. */
export type AssetDepreciationProposal = {
  assetId: string;
  /* حالات معرفة العقد: مجهول العمر، أو بداية غير محددة، أو منتهٍ. */
  readiness: "unknown_life" | "unknown_start" | "fully_depreciated" | "retired" | "ready";
  /* الإهلاك الشهري الأساسي (تقريب أرضي) — null حين العمر مجهول. */
  monthlyMinor: number | null;
  /* الإجمالي المستحق حتى تاريخه = تراكمي الجدول ناقص المسجّل النشط. */
  proposedMinor: number;
  /* الإهلاك المسجّل النشط حتى الآن (قبل الاقتراح). */
  recordedMinor: number;
  /* تراكمي الجدول حتى تاريخه (قبل خصم المسجّل). */
  scheduledMinor: number;
  /* أول شهر يُحمَّل فيه إهلاك (شهر البداية + ١) — null حين البداية مجهولة. */
  firstChargeMonth: string | null;
  /* الأشهر المتبقية من الجدول بعد التاريخ — null حين العمر مجهول. */
  remainingMonths: number | null;
  note: string;
};

export type AssetEventSummary = {
  acquisitionMinor: number;
  depreciationMinor: number;
  disposalBookValueMinor: number;
  writeOffBookValueMinor: number;
  bookValueMinor: number;
};

/* S08 (UNIT-034 / SDF-066): قراءة مشتقة لوضع السداد — المدفوع النقدي
 * الفعلي (حدثا الاقتناء النقدي + تسديدات الذمم النشطة) والمتبقي الحي
 * (حدث الاقتناء الذممي الفعال ناقص التسديدات النشطة عليه). الحقلان
 * قراءة من الأحداث لا مخزنين؛ وغياب الذمم = مدفوع كامل ومتبقٍ صفر. */
export type AssetPaymentStatus = {
  paidCashMinor: number;
  remainingPayableMinor: number;
  hasPayable: boolean;
};
