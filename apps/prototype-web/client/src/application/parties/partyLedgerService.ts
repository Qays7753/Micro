/**
 * S05 (DOC-014 / UNIT-037 P3.1/P3.4 + العقد المشترك §5.1/§11): دليل الأطراف
 * المحفوظة — هوية اختيارية صريحة وحساب قراءة مصدريّ، لا دفتر أرصدة قابل
 * للتحرير ولا تجميع بالاسم أبدًا.
 *
 * ما يملكه هذا البيت (P3.4: صاحب النية هنا؛ لا خدمة موازية لمجرد نقل زر):
 *  - حفظ طرف صريح باختيار المستخدم (تسمية + هاتف/ملاحظة اختياريان)؛
 *  - إعادة التسمية والأرشفة/الإظهار — الهوية ثابتة واللقطات عند مصادرها؛
 *  - قراءة الحساب: «لك عنده» من ديون البيع المباشر المرتبطة بمعرف الطرف
 *    المؤكد، و«عليك له» من ذمم مشتريات الموردين المرتبطة بمعرفه — بمعرفة
 *    صادقة لحدود التغطية (UNIT-037 B2/U037-F10): لا نطرح مجهولًا ولا فشل
 *    قراءة من المجموع، ولا نعد بكل تعاملات الشخص.
 *
 * ما لا يفعله هذا البيت (حدود موثقة — UNIT-037 B-DUP/A4/B2):
 *  - لا تجميع بالاسم: العملية باسم نصي بلا ربط مؤكد ليست حساب شخص محفوظ
 *    (SDF-009)؛ تبقى في مصدرها والمتابعة ولا تُنسخ هنا.
 *  - لا قبض/دفع من هنا: التحصيل من مصدره (026) والسداد من شرائه (027)؛
 *    نتيجة مصدر واحد إلى صفر لا تصفّر حساب الطرف كله (U037-ACD04).
 *  - لا مخزون أرصدة: الرصيد مشتق من المصادر المرتبطة وقت القراءة فقط.
 *  - لا دمج ولا تخمين: طرفان بالتسمية نفسها هويتان مستقلتان؛ لا فهرس
 *    تسمية ولا مطابقة بالهاتف.
 */
import { localDateInAmman } from "@micro-domain/shared/index.js";
import {
  createSavedParty,
  isPartyActive,
  renameSavedParty,
  setSavedPartyArchive,
  type SavedParty,
} from "@micro-domain/party/index.js";
import type { DirectSale } from "@micro-domain/direct-sale/index.js";
import type { SupplierPurchase } from "@micro-domain/supplier-purchase/index.js";
import type { PrototypeLocalStore } from "@/storage/local/types";
import { STORAGE_ERROR, errorMessageOf, storageFailure, validationFailure } from "@/application/resultCodes";
import { systemClock, type Clock } from "@/application/time/clock";

/** R3+S05 (عدسة الخدمة): قراءة الأطراف والمصادرين القابلين للربط حصرًا. */
export type PartyDirectoryServiceStore = Pick<
  PrototypeLocalStore,
  | "listCounterparties"
  | "getCounterparty"
  | "commitCounterpartyWrite"
  | "listDirectSales"
  | "listSupplierPurchases"
>;

export type PartyDirectoryResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      code: "validation_error" | "storage_error" | "storage_stale" | "not_found";
      message: string;
    };

export type PartyMovementKind = "sale_debt" | "purchase_payable";

export type PartyMovement = {
  id: string;
  kind: PartyMovementKind;
  /** لقطة اسم المصدر كما سُجلت وقت الحفظ — لا التسمية الحالية للطرف. */
  label: string;
  occurredOn: string;
  /** موجب = لك عند الطرف (دين بيع)؛ سالب = عليك للطرف (ذمة شراء). */
  amountMinor: number;
  href: string;
};

export type PartyAccountEntry = {
  party: SavedParty;
  /** لك عنده — من ديون البيع المباشر المرتبطة بمعرفه المؤكد فقط. */
  receivableMinor: number;
  /** عليك له — من ذمم مشتريات الموردين المرتبطة بمعرفه المؤكد فقط. */
  payableMinor: number;
  movements: readonly PartyMovement[];
};

export type PartyDirectoryOverview = {
  /** الأطراف النشطة — تقترح للاستعمال الجديد. */
  parties: readonly PartyAccountEntry[];
  /** الأطراف المؤرشفة — تُقرأ ولا تقترح (لا تُحذف ولا تُحجب مصادرها). */
  archivedParties: readonly PartyAccountEntry[];
  /* S05 (F-049، 2026-10-29): إجمالا «لك عند المحفوظين» و«عليك للمحفوظين»
   * يشتقان في الخدمة نفسها التي تحسب الحسابات — لا مرايا حساب في الواجهة
   * (F-049: النمو بصمت ممنوع؛ الاشتقاق الكنوني هنا). */
  totalReceivableMinor: number;
  totalPayableMinor: number;
};

export type SavePartyInput = {
  label: string;
  phone?: string | null;
  note?: string | null;
  /** مفتاح حتمية المستخدم — إعادة الإرسال بعد فشل لا تنشئ طرفًا ثانيًا. */
  operationKey: string;
};

export type RenamePartyInput = {
  partyId: string;
  label: string;
  /** النسخة التي قرأها المستخدم — CAS صادق عند حد الكتابة. */
  expectedUpdatedAt: string;
  operationKey: string;
};

export type SetPartyArchiveInput = {
  partyId: string;
  archived: boolean;
  expectedUpdatedAt: string;
  operationKey: string;
};

const createId = () =>
  globalThis.crypto?.randomUUID?.() ?? `party-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export class PartyDirectoryService {
  constructor(
    private readonly store: PartyDirectoryServiceStore,
    private readonly now: Clock = systemClock,
  ) {}

  /** قراءة الدليل: الأطراف المحفوظة وحساباتها من المصادر المرتبطة بمعرفها
   * المؤكد حصرًا — تعذر قراءة مصدر يُعلن فشلًا صادقًا لا مجموعًا ناقصًا. */
  async read(): Promise<PartyDirectoryResult<PartyDirectoryOverview>> {
    const [partiesResult, salesResult, purchasesResult] = await Promise.all([
      this.store.listCounterparties(),
      this.store.listDirectSales(),
      this.store.listSupplierPurchases(),
    ]);
    if (!partiesResult.ok || !salesResult.ok || !purchasesResult.ok)
      return storageFailure("تعذر قراءة الأطراف المحفوظة المحلية.");

    const active: PartyAccountEntry[] = [];
    const archived: PartyAccountEntry[] = [];
    for (const party of partiesResult.value) {
      const entry = this.accountOf(party, salesResult.value, purchasesResult.value);
      (isPartyActive(party) ? active : archived).push(entry);
    }
    const byRecency = (left: PartyAccountEntry, right: PartyAccountEntry) =>
      right.party.updatedAt.localeCompare(left.party.updatedAt);
    /* S05 (F-049): الإجمالان من الحسابات المشتقة نفسها — لا حساب مرآة في الواجهة. */
    let totalReceivableMinor = 0;
    let totalPayableMinor = 0;
    for (const entry of active) {
      totalReceivableMinor += entry.receivableMinor;
      totalPayableMinor += entry.payableMinor;
    }
    return {
      ok: true,
      value: {
        parties: active.sort(byRecency),
        archivedParties: archived.sort(byRecency),
        totalReceivableMinor,
        totalPayableMinor,
      },
    };
  }

  /** مقترحات التسمية لسياق الطلب/الاتفاق (3D-03): تسميات الأطراف النشطة
   * المحفوظة — لا أسماء تاريخية مجمّعة بالاسم؛ اختيار المحفوظ صريح. */
  async suggestLabels(): Promise<PartyDirectoryResult<readonly string[]>> {
    const suggestions = await this.suggestParties();
    if (!suggestions.ok) return suggestions;
    return { ok: true, value: suggestions.value.map(party => party.label) };
  }

  /** خيارات اختيار الطرف المحفوظ للمحررات (005/027 — A2): الأطراف النشطة
   * بمعرفها وتسميتها الحالية — اختيار أحدها يثبّت لقطة التسمية على المصدر
   * ويربطه بمعرفه؛ لا يورث سعرًا ولا موعدًا ولا مبلغًا من عملية سابقة. */
  async suggestParties(): Promise<PartyDirectoryResult<readonly { id: string; label: string }[]>> {
    const parties = await this.store.listCounterparties();
    if (!parties.ok) return storageFailure("تعذر قراءة الأطراف المحفوظة المحلية.");
    return {
      ok: true,
      value: parties.value.filter(isPartyActive).map(party => ({ id: party.id, label: party.label })),
    };
  }

  /** حفظ طرف صريح — اختيار المستخدم وحده؛ فشله لا يعيد عملية أعمال نجحت
   * (SDF-041: البيع عند صاحبه، والحفظ هنا أمر مستقل بمفتاحه). */
  async save(input: SavePartyInput): Promise<PartyDirectoryResult<{ party: SavedParty; reused: boolean }>> {
    let party: SavedParty;
    try {
      party = createSavedParty({
        id: createId(),
        label: input.label,
        phone: input.phone ?? null,
        note: input.note ?? null,
        operationKey: input.operationKey,
        recordedAt: this.now(),
      });
    } catch (error) {
      return validationFailure(errorMessageOf(error, "بيانات الطرف غير صالحة."));
    }
    const committed = await this.store.commitCounterpartyWrite({
      kind: "create",
      baseUpdatedAt: null,
      next: party,
      operationKey: party.operationKey,
    });
    if (!committed.ok)
      return {
        ok: false,
        code: committed.code === "storage_stale" ? "storage_stale" : STORAGE_ERROR,
        message: committed.message,
      };
    return { ok: true, value: committed.value };
  }

  async rename(
    input: RenamePartyInput,
  ): Promise<PartyDirectoryResult<{ party: SavedParty; reused: boolean }>> {
    const live = await this.store.getCounterparty(input.partyId);
    if (!live.ok) return storageFailure("تعذر قراءة الطرف قبل التعديل.");
    if (!live.value) return validationFailure("هذا الطرف لم يعد موجودًا؛ راجع القائمة ثم أعد المحاولة.");
    let next: SavedParty;
    try {
      next = renameSavedParty(live.value, {
        label: input.label,
        operationKey: input.operationKey,
        recordedAt: this.now(),
      });
    } catch (error) {
      return validationFailure(errorMessageOf(error, "بيانات تعديل الطرف غير صالحة."));
    }
    return this.commitUpdate("rename", input.expectedUpdatedAt, next, input.operationKey);
  }

  async setArchived(
    input: SetPartyArchiveInput,
  ): Promise<PartyDirectoryResult<{ party: SavedParty; reused: boolean }>> {
    const live = await this.store.getCounterparty(input.partyId);
    if (!live.ok) return storageFailure("تعذر قراءة الطرف قبل الأرشفة.");
    if (!live.value) return validationFailure("هذا الطرف لم يعد موجودًا؛ راجع القائمة ثم أعد المحاولة.");
    const next = setSavedPartyArchive(live.value, {
      archived: input.archived,
      operationKey: input.operationKey,
      recordedAt: this.now(),
    });
    return this.commitUpdate("archive", input.expectedUpdatedAt, next, input.operationKey);
  }

  private async commitUpdate(
    kind: "rename" | "archive",
    expectedUpdatedAt: string,
    next: SavedParty,
    operationKey: string,
  ): Promise<PartyDirectoryResult<{ party: SavedParty; reused: boolean }>> {
    /* CAS حي داخل حد الكتابة: نسخة المستخدم لا نسخة القراءة — نافذتان
     * لا تسحق إحداهما الأخرى (U037-AC22). */
    const committed = await this.store.commitCounterpartyWrite({
      kind,
      baseUpdatedAt: expectedUpdatedAt,
      next,
      operationKey,
    });
    if (!committed.ok)
      return {
        ok: false,
        code: committed.code === "storage_stale" ? "storage_stale" : STORAGE_ERROR,
        message: committed.message,
      };
    return { ok: true, value: committed.value };
  }

  /** حساب الطرف من مصادريه المرتبطين بمعرفه — لا مسار آخر: الطلب (007/009
   * لا يحمل ربط طرف بعد — ملك S09/S12) والتزامات المصروف (015) والقروض
   * (035/036 ملغاة/مؤجلة) تبقى عند أصحابها بلا دفتر منافس هنا. */
  private accountOf(
    party: SavedParty,
    sales: readonly DirectSale[],
    purchases: readonly SupplierPurchase[],
  ): PartyAccountEntry {
    const movements: PartyMovement[] = [];
    let receivableMinor = 0;
    let payableMinor = 0;
    /* ديون البيع المباشر المرتبطة صراحة بمعرف الطرف — النشطة فقط؛ الملغى
     * دينه منقوض بالأثر ولا يُعرض حقًا قائمًا. */
    for (const sale of sales) {
      if ((sale.customerPartyId ?? null) !== party.id) continue;
      if ((sale.status ?? "active") !== "active") continue;
      if (sale.collectionStatus !== "partial_debt") continue;
      const outstanding = sale.revenueMinor - sale.collectedMinor;
      if (outstanding <= 0) continue;
      receivableMinor += outstanding;
      movements.push({
        id: `sale-debt:${sale.id}`,
        kind: "sale_debt",
        label: `دين بيع مباشر: ${sale.itemName || "بيع"}`,
        occurredOn: sale.occurredOn,
        amountMinor: outstanding,
        href: `/direct-sales/${sale.id}`,
      });
    }
    /* ذمم مشتريات الموردين المرتبطة بمعرفه — المدفوع الفعلي عند مصدره. */
    for (const purchase of purchases) {
      if ((purchase.supplierPartyId ?? null) !== party.id) continue;
      if (purchase.payableMinor <= 0) continue;
      payableMinor += purchase.payableMinor;
      movements.push({
        id: `purchase-payable:${purchase.id}`,
        kind: "purchase_payable",
        label: `ذمة شراء: ${purchase.note || "مواد"}`,
        occurredOn: purchase.purchasedOn,
        amountMinor: -purchase.payableMinor,
        href: `/suppliers/purchase/${purchase.id}`,
      });
    }
    movements.sort((left, right) => right.occurredOn.localeCompare(left.occurredOn));
    return { party, receivableMinor, payableMinor, movements };
  }
}

/* S05 (DOC-014 / UNIT-037 A3): لقطة اسم العملية للأدلة السياقية — تُقرأ من
 * المصدر كما سُجلت (customerName/supplierName)، لا من دليل الأطراف. يُستخدم
 * داخل صفحات المصدر لعرض «لمن سُجل هذا المبلغ» بصدق تاريخي. */
export const salePartySnapshotOf = (sale: DirectSale): string | null => sale.customerName?.trim() || null;
export const purchasePartySnapshotOf = (purchase: SupplierPurchase): string | null =>
  purchase.supplierName?.trim() || null;

/** S05 (DOC-014 / UNIT-037 AC02): عرض اسم المورد في الأسطح — الشراء المدفوع
 * كاملًا قد يكون بلا مورد؛ الغياب يُعرض بصدق لا باسم «غير مسجل» مفترض.
 * يقبل أي قيمة تحمل لقطة اسم المورد (السجل الكامل أو قارئه المصغّر). */
export const supplierDisplayLabelOf = (purchase: { supplierName?: string | null }): string =>
  purchase.supplierName?.trim() || "بلا مورد مسجل";

/* توحيد عرض التاريخ للقراءة — من النواة المشتركة. */
export { localDateInAmman };
