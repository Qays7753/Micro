/** S02-A (SH-02/SH-03 — عقد الاستبدال المحروس): البصمة الكنونية للقطة —
 * الأساس الحسابي لسياج الاستبدال ولبصمات المآل في علامة الاستبدال.
 *
 * لماذا كنونيًا: المقارنة داخل معاملة الاستبدال تقرأ المخازن فتُعاد السجلات
 * بترتيب المفتاح الأساسي (getAll) لا بترتيب الملف الوارد، ومفاتيح الكائنات
 * تأتي بترتيب الإدراج — فالبصمة الحرفية غير مستقرة عبر الكتابة/القراءة.
 * البصمة الكنونية تفرز مفاتيح الكائنات وترتب عائلات السجلات بمعرفها، فتتطابق
 * بصمة «ما سيُخزَّن» مع بصمة «ما يُقرأ لاحقًا» مهما اختلف مصدر الترتيب.
 *
 * هذا الملف خارج كومة الإقلاع عمدًا: يحتاجه بروتوكول الاستبدال (شظية النقل
 * الكسولة) والمحوّل الذاكري (اختبارات)؛ ومحوّل IndexedDB يتلقاه عبر سياج
 * الأمر (guard.digestOf) لأن السياج يعمل داخل المعاملة نفسها — لا استيراد
 * ثابت من كومة الإقلاع أبدًا. البصمة تكشف التغير فقط؛ ليست تشفيرًا ولا
 * إثبات مرسل.
 */
import { syncSha256Hex } from "@/lib/syncSha256";
import type { LocalStoreSnapshot } from "./types";
import { normalizeSnapshotForReplacement } from "./snapshotNormalization";

/** كل مفاتيح اللقطة التي قيمتها مصفوفة سجلات — مشتق نوعيًا من شكل اللقطة
 * نفسها فلا تنفصل القائمة عن المخطط أبدًا. */
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
  /* S04 (DOC-013 / UNIT-025): رصد الأرصدة داخل التنسيق الكنوني للبصمة. */
  "balanceObservations",
  "recurringExpenseSeries",
  "recurringExpenseRevisions",
  "recurringExpenseOccurrences",
  "expenseBudgets",
] as const;

/** تسلسل كنوني مستقر: مفاتيح الكائنات مفروزة دائمًا؛ المحتوى المتداخل
 * يحفظ ترتيبه كما خُزِّن — الترتيب الوحيد غير المستقر عبر القراءة هو ترتيب
 * عائلات السجلات نفسها ويعالجه canonicalSnapshot. */
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
