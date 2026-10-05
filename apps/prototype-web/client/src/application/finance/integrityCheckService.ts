/**
 * المجموعة ١ (فحص سلامة مالي — الأساس): خدمة قراءة فقط تفحص اتساق الأرقام
 * المالية المحلية وتعرض النتيجة بلا أي كتابة ولا إصلاح تلقائي أبدًا.
 * «يقرأ أرقامك ولا يغيّر شيئًا» — الوعد ملزم معماريًا: كل استدعاء هنا يستعمل
 * مسارات قراءة فقط (list و read فقط).
 *
 * معرّفات الفحوص ثابتة (MIC-*) وسجلها محجوز للمجموعات اللاحقة التي ستوسّع
 * المجموعة نفسها. الفحص لا يخترع قواعد جديدة: كل قاعدة مشتقة من عقد مجال
 * مُختبر (قاعدة الدلتا الخماسية، إعادة اشتقاق النسبة، قواعد المصدر والتوزيع).
 *
 * Wave F (ADR-013 — عنقود ١، تقسيم مسؤولية داخلي 2026-10-04): هذه الخدمة
 * صارت المُنسِّق وحده — الحقن والترتيب المتسلسل والتقرير وعدّ الفحوص — بينما
 * انتقلت عائلات الفحوص حرفيًا إلى ملفات أشقاء في البيت المالي نفسه:
 * integrityCheckModel (النموذج المشترك: الأنواع والسجل وبُناة النتائج)،
 * integrityCheckCoreFinance (MIC-1/2/4/7/9)، integrityCheckInventory (MIC-8)،
 * integrityCheckAssetsLoans (MIC-10..13)، integrityCheckContinuity (MIC-14..16)،
 * integrityCheckSupplierWallet (MIC-17)، integrityCheckSettlementBasis (MIC-18)،
 * وintegrityCheckOffenderSummaries (إثراء العرض). الإقامة في application/finance/
 * لم تتغير (عقد ٤٠ §2) ولا أي دلالة — تقسيم بنيوي صرف؛ الواجهة العامة
 * تُعاد من بيتها الجديد كما هي.
 */
import { localDateInAmman as ammanDate } from "@micro-domain/shared/index.js";
import type { ProjectFinancialService } from "@/application/finance/projectFinancialService";
import type { StatementService } from "@/application/finance/statementService";
import type { CashContinuityService } from "@/application/cash/cashContinuityService";
import { localExportVersion, localSchemaVersion } from "@/storage/local/types";
import type { PrototypeLocalStore } from "@/storage/local/types";
import { systemClock, type Clock } from "@/application/time/clock";
import {
  INTEGRITY_TITLES,
  unavailable,
  type IntegrityCheckContext,
  type IntegrityCheckId,
  type IntegrityCheckReport,
  type IntegrityCheckResult,
  type IntegrityCheckStatus,
} from "./integrityCheckModel";
import {
  checkAmanahReadBack,
  checkCashStructure,
  checkEventAndAllocationIntegrity,
  checkKnowledgeHonesty,
  checkPeriodResultConsistency,
} from "./integrityCheckCoreFinance";
import { checkInventoryStructure } from "./integrityCheckInventory";
import {
  checkAssetIntegrity,
  checkDeliveryConsumptionIntegrity,
  checkLoanIntegrity,
  checkRetainedDepositIntegrity,
} from "./integrityCheckAssetsLoans";
import {
  checkEventKeyUniqueness,
  checkOwnerMoneySeparation,
  checkUnallocatedCashTruth,
} from "./integrityCheckContinuity";
import { checkSupplierWalletAttribution } from "./integrityCheckSupplierWallet";
import { checkSettlementBasisInvariant } from "./integrityCheckSettlementBasis";
import { attachOffenderSummaries } from "./integrityCheckOffenderSummaries";

/* الواجهة العامة محفوظة حرفيًا — الأنواع والمفردات يعاد تصديرها من بيتها
 * الجديد (نمط projectFinancialTypes المجرب في Wave E) فلا يتغير أي مستورد. */
export type {
  IntegrityCheckId,
  IntegrityCheckReport,
  IntegrityCheckResult,
  IntegrityCheckStatus,
  IntegrityOffenderSummary,
} from "./integrityCheckModel";
export { INTEGRITY_TITLES, integrityStatusWord } from "./integrityCheckModel";

export class IntegrityCheckService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly projectFinance: ProjectFinancialService,
    private readonly statementService: StatementService,
    private readonly cashContinuity: CashContinuityService,
    private readonly now: Clock = systemClock,
  ) {}

  /** TOOL-001: عدد الفحوص المسجلة يُشتق من السجل نفسه — إضافة فحص أو إزالته
   * تحدّث العدّ الظاهر في الواجهة بلا تعديل نص يدوي. */
  registeredCheckCount(): number {
    return Object.keys(INTEGRITY_TITLES).length;
  }

  /** الفحص كله قراءة — لا يكتب ولا يصلح؛ إعادة التشغيل قراءة جديدة كل مرة. */
  async run(): Promise<IntegrityCheckReport> {
    const to = ammanDate(this.now());
    const from = `${to.slice(0, 7)}-01`;
    const eventsResult = await this.store.listFinancialEvents();
    if (!eventsResult.ok)
      /* TOOL-001: تعذّر القراءة لا يقلّص القائمة — كل الفحوص المسجلة تظهر
       * «غير متاح» كي يوافق الطول العدّ المسجل، ولا يبدو أي فحص ناجحًا. */
      return this.report(
        from,
        to,
        (Object.keys(INTEGRITY_TITLES) as IntegrityCheckId[]).map(id =>
          unavailable(
            id,
            id === "MIC-4"
              ? "تعذر قراءة سجل الأحداث المالية — أعد المحاولة."
              : "تعذّرت قراءة مصدر هذا الفحص — أعد المحاولة.",
          ),
        ),
      );
    const events = eventsResult.value;
    /* سياق القراءة المشترك — نفس التبعيات المحقونة سابقًا في كل فحص. */
    const ctx: IntegrityCheckContext = {
      store: this.store,
      projectFinance: this.projectFinance,
      statementService: this.statementService,
      cashContinuity: this.cashContinuity,
    };

    /* MIC-1 أولًا (يستعمل القارئ الكنوني) ثم بقية الفحوص — قراءات متسلسلة كي لا
     * يتغير شيء تحت أيدينا أثناء الفحص (SA-3: تسلسل لا توازٍ). */
    const mic1 = await checkPeriodResultConsistency(ctx, from, to);
    const mic2 = await checkCashStructure(ctx);
    const mic4 = checkEventAndAllocationIntegrity(events);
    const mic7 = await checkAmanahReadBack(ctx, events);
    const mic8 = await checkInventoryStructure(ctx);
    const mic9 = checkKnowledgeHonesty(
      mic1.readerResultMinor,
      mic1.readerStatus,
      mic1.readerReasons,
      mic1.readerUnknownCostCount,
      events,
      from,
      to,
    );
    /* المجموعة ٤ (عقد ٢٩): فحوص القراءة المتسلسلة نفسها — الأصول ثم القروض ثم
     * تصنيف العربون ثم ربط استهلاك التسليم بمصدره. */
    const mic10 = await checkAssetIntegrity(ctx, events);
    const mic11 = await checkLoanIntegrity(ctx, events);
    const mic12 = await checkRetainedDepositIntegrity(ctx, events);
    const mic13 = await checkDeliveryConsumptionIntegrity(ctx);
    /* المجموعة ٥ (عقد ٣٥): فحوص الاستمرارية الثلاثة — قراءة متسلسلة كإخوتها. */
    const mic14 = await checkUnallocatedCashTruth(ctx);
    const mic15 = checkEventKeyUniqueness(events);
    const mic16 = checkOwnerMoneySeparation(events);
    const mic17 = await checkSupplierWalletAttribution(ctx);
    const mic18 = await checkSettlementBasisInvariant(ctx);
    const checks = [
      mic1.result,
      mic2,
      mic4,
      mic7,
      mic8,
      mic9,
      mic10,
      mic11,
      mic12,
      mic13,
      mic14,
      mic15,
      mic16,
      mic17,
      mic18,
    ];
    /* Wave 4.3 — P-4.3-3 (D9): إثراء قراءة فقط — يحوّل معرّفات السجلات
     * المتأثرة إلى ملخصات مقروءة (اسم/تاريخ/مبلغ/رابط) من المخزن نفسه؛
     * لا فحص يتغير ولا عدد ولا منطق — فقط أصدق عرض للنتيجة نفسها. */
    await attachOffenderSummaries(checks, this.store);
    return this.report(from, to, checks);
  }

  private report(from: string, to: string, checks: readonly IntegrityCheckResult[]): IntegrityCheckReport {
    const overall: IntegrityCheckStatus = checks.some(check => check.status === "FAIL")
      ? "FAIL"
      : checks.some(check => check.status === "WARN")
        ? "WARN"
        : checks.some(check => check.status === "UNAVAILABLE")
          ? "UNAVAILABLE"
          : "PASS";
    return {
      runAt: this.now(),
      from,
      to,
      overall,
      checks,
      schemaVersion: localSchemaVersion,
      exportVersion: localExportVersion,
    };
  }
}
