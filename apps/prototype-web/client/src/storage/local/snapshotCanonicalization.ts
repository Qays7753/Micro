/** S02-A (SH-02/SH-03 — عقد الاستبدال المحروس): التطبيع الكنوني والبصمة
 * الكنونية للقطة التخزين — الأساس الحسابي الوحيد لسياج الاستبدال داخل حد
 * الكتابة (المقارنة-قبل-الكتابة) ولبصمات المآل في علامة الاستبدال.
 *
 * لماذا هنا ولماذا كنونيًا:
 * - المقارنة داخل معاملة الاستبدال تقرأ المخازن فتُعاد السجلات بترتيب
 *   المفتاح الأساسي (getAll) لا بترتيب الملف الوارد، ومفاتيح الكائنات
 *   تأتي بترتيب الإدراج — فالبصمة الحرفية (JSON.stringify مباشرة) غير
 *   مستقرة عبر الكتابة/القراءة. التطبيع يسوّي العائلات الغائبة إلى قيمها
 *   الآمنة، والبصمة الكنونية تفرز مفاتيح الكائنات وترتب عائلات السجلات
 *   بمعرفها، فتتطابق بصمة «ما سيُخزَّن» مع بصمة «ما يُقرأ لاحقًا» مهما
 *   اختلف مصدر الترتيب.
 * - التطبيع نفسه كان مكررًا حرفيًا في المحوّلين (IndexedDB/Memory)؛
 *   استخراجه هنا ليس إعادة هيكلة بنيوية بل شرط صحة العقد الجديد: بصمة
 *   المآل يجب أن تحسب فوق الشكل المخزَّن نفسه عند المحوّلين معًا.
 * - البصمة تكشف التغير فقط؛ ليست تشفيرًا ولا إثبات مرسل (عقد ٣٩/٠٤٤).
 */
import { syncSha256Hex } from "@/lib/syncSha256";
import type { LocalStoreSnapshot } from "./types";

/** كل مفاتيح اللقطة التي قيمتها مصفوفة سجلات (اختيارية أو إلزامية) — مشتق
 * نوعيًا من شكل اللقطة نفسه فلا تنفصل القائمة عن المخطط أبدًا (نمط سجل
 * عائلات المصفوفات في transfers/transferArrayFamilyRoles.ts). */
type ArrayFamilyKey = {
  [K in keyof LocalStoreSnapshot]-?: LocalStoreSnapshot[K] extends readonly unknown[] | undefined ? K : never;
}[keyof LocalStoreSnapshot];

const ARRAY_FAMILY_KEYS: readonly ArrayFamilyKey[] = [
  "drafts",
  "orders",
  "directSales",
  "schedules",
  "recurrences",
  "financialEvents",
  "supplierPurchases",
  "cashWallets",
  "cashContinuityEntries",
  "materials",
  "inventoryMovements",
  "inventoryShortages",
  "catalogItems",
  "measurementUnits",
  "directConversions",
  "catalogTemplates",
  "actualTimeRecords",
  "shortCashDeclarations",
  "ownerEntitlementPolicies",
  "ownerEntitlementRecords",
  "ownerEntitlementOpeningBalances",
  "ownerMovements",
  "allocationPolicies",
  "costEstimates",
  "assets",
  "loans",
  "receivedLoans",
  "recurringExpenseSeries",
  "recurringExpenseRevisions",
  "recurringExpenseOccurrences",
  "expenseBudgets",
] as const;

/** التطبيع الموحد للقطة قبل الاستبدال — نفس قواعد المحوّلين الحرفية
 * (الغياب الآمن: قائمة فارغة للعائلات، null للسجلات المفردة)؛ مصدر واحد
 * يحسب فوقه المحوّلان وبصمات المآل معًا. */
export function normalizeSnapshotForReplacement(snapshot: LocalStoreSnapshot): LocalStoreSnapshot {
  return {
    ...snapshot,
    ownerProfile: snapshot.ownerProfile ?? null,
    schedules: snapshot.schedules ?? [],
    directSales: snapshot.directSales ?? [],
    recurrences: snapshot.recurrences ?? [],
    financialEvents: snapshot.financialEvents ?? [],
    supplierPurchases: snapshot.supplierPurchases ?? [],
    cashWallets: snapshot.cashWallets ?? [],
    cashContinuityEntries: snapshot.cashContinuityEntries ?? [],
    materials: snapshot.materials ?? [],
    inventoryMovements: snapshot.inventoryMovements ?? [],
    inventoryShortages: snapshot.inventoryShortages ?? [],
    inventoryActivation: snapshot.inventoryActivation ?? null,
    catalogItems: snapshot.catalogItems ?? [],
    measurementUnits: snapshot.measurementUnits ?? [],
    directConversions: snapshot.directConversions ?? [],
    catalogTemplates: snapshot.catalogTemplates ?? [],
    actualTimeRecords: snapshot.actualTimeRecords ?? [],
    shortCashDeclarations: snapshot.shortCashDeclarations ?? [],
    ownerEntitlementPolicies: snapshot.ownerEntitlementPolicies ?? [],
    ownerEntitlementRecords: snapshot.ownerEntitlementRecords ?? [],
    ownerEntitlementOpeningBalances: snapshot.ownerEntitlementOpeningBalances ?? [],
    ownerMovements: snapshot.ownerMovements ?? [],
    allocationPolicies: snapshot.allocationPolicies ?? [],
    costEstimates: snapshot.costEstimates ?? [],
    assets: snapshot.assets ?? [],
    loans: snapshot.loans ?? [],
    receivedLoans: snapshot.receivedLoans ?? [],
    recurringExpenseSeries: snapshot.recurringExpenseSeries ?? [],
    recurringExpenseRevisions: snapshot.recurringExpenseRevisions ?? [],
    recurringExpenseOccurrences: snapshot.recurringExpenseOccurrences ?? [],
    expenseBudgets: snapshot.expenseBudgets ?? [],
  };
}

/** تسلسل كنوني مستقر: مفاتيح الكائنات مفروزة دائمًا؛ المحتوى المتداخل
 * (مصفوفات داخل سجل) يحفظ ترتيبه كما خُزِّن — الترتيب الوحيد غير المستقر
 * عبر القراءة هو ترتيب عائلات السجلات نفسها ويعالجه canonicalSnapshot. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}

function recordIdOf(record: unknown): string {
  if (record !== null && typeof record === "object" && typeof (record as { id?: unknown }).id === "string") {
    return (record as { id: string }).id;
  }
  /* خارج العقد (سجل بلا معرف نصي) — ترتيب ثابت بديل بالتسلسل الكنوني
   * نفسه فلا يعتمد الترتيب المصدر أبدًا. */
  return stableStringify(record);
}

/** الشكل الكنوني للقطة: التطبيع + ترتيب كل عائلة سجلات بمعرفها — بهذا
 * الشكل فقط تتساوى بصمة «قبل التخزين» مع بصمة «بعد القراءة». */
export function canonicalSnapshot(snapshot: LocalStoreSnapshot): LocalStoreSnapshot {
  const normalized = normalizeSnapshotForReplacement(snapshot);
  const canonical = { ...normalized } as Record<string, unknown>;
  for (const key of ARRAY_FAMILY_KEYS) {
    const family = canonical[key];
    if (Array.isArray(family)) {
      canonical[key] = [...family].sort((left, right) => {
        const leftId = recordIdOf(left);
        const rightId = recordIdOf(right);
        return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
      });
    }
  }
  return canonical as unknown as LocalStoreSnapshot;
}

/** بصمة كنونية للقطة (SHA-256 للشكل الكنوني) — تكشف أي تغير في المحتوى
 * المخزَّن مهما اختلف ترتيب المصدر؛ ليست تشفيرًا ولا إثبات أصالة مرسل. */
export function canonicalSnapshotDigest(snapshot: LocalStoreSnapshot): string {
  return syncSha256Hex(stableStringify(canonicalSnapshot(snapshot)));
}
