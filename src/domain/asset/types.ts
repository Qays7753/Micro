/**
 * المجموعة ٤ (عقد ٢٩ — الأصول والإهلاك): سجل الأصل عقد تشغيلي مستقل، والحقيقة
 * المالية كلها أحداث مالية (شراء/إهلاك/تخلص/شطب) بدلتات معلنة. السجل يخزن
 * العقد (الاسم، القيمة، العمر النافع، بداية الإهلاك) وتاريخه التصحيحي؛ أما
 * الرصيد الدفتري فقراءة مشتقة من الأحداث النشطة — لا تُخزن ولا تُخمَّن.
 */
import type { MoneyMinor } from "../shared/index.js";

/* طريقة الاقتناء: نقد الآن أو التزام على المورد — عقدان مختلفان بأثرين مختلفين. */
export type AssetAcquisitionKind = "cash" | "payable";

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
  acquisitionEventId: string;
  operationKey: string;
  createdAt: string;
};

export type ReviseAssetContractInput = {
  lifeMonths: number | null;
  depreciationStartOn: string | null;
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
