#!/usr/bin/env node
/**
 * MNG-LOCAL-06 (أمر المالك 12AA — MNG-LOCAL-03-06-PASSWORDLESS-REMEDIATION،
 * 2026-11-24): مولّد قياسات الاستيراد الاصطناعية لقياس الأداء على أضعف جهاز
 * فعلي مدعوم — ملفات اصطناعية من الصيغة الحية (micro-prototype-local-export،
 * الإصدار 34 والمخطط 43) تمر بوابات prepareImport الحقيقية كلها (الحجم
 * والعمق والعد والبنية والبصمة والعدادات) قبل أي كتابة:
 *
 *   node scripts/generate-mng-local-06-fixtures.mjs [--out DIR]
 *
 * القياسات الثلاثة المطلوبة (بحدود المورد القائمة نفسها بلا رفع/تليين):
 *   - عائلة واحدة عند 20,000 سجل (سقف العائلة عند الحافة بالضبط).
 *   - الإجمالي عند 50,000 سجل (سقف الإجمالي عند الحافة بالضبط؛ المصفوفات
 *     49,998 + سجلان غير مصفوفة: profile/preferences بقيمة null).
 *   - عمق تعشيش 64 (سقف العمق عند الحافة بالضبط؛ سلسلة عمق اصطناعية داخل
 *     حقل إضافي في سجل طرف — البيانات الاصطناعية للاختبار والقياس فقط).
 *
 * الملفات تُولَّد خارج المستودع افتراضيًا (لا تُلتزم القياسات الضخمة في
 * git — الأمر: «لا تُرفع ملفات قياس ضخمة»)؛ صحتها تثبتها بوابة الاختبار
 * المركز mngLocal06Fixtures.generation.test.ts التي تمرر كل ملف عبر
 * prepareImport الحقيقي نفسه. الاصطناعية للاختبار والقياس فقط — لا بيانات
 * حقيقية أبدًا.
 *
 * سجلات العائلات الثلاث المستعملة كلها حقول صادقة الحد الأدنى تمر مدققات
 * النقل الحقيقية (validSavedParty/validCommandReceipt/validBalanceObservation)
 * — لا «بيانات» فعلية، فقط شكل صالح قابل للتحقق والقياس.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const OUT_DIR = process.argv.includes("--out")
  ? resolve(process.argv[process.argv.indexOf("--out") + 1] ?? ".mng-local-06-fixtures")
  : resolve(".mng-local-06-fixtures");

const EXPORTED_AT = "2026-11-24T10:00:00.000Z";
const CREATED_AT = "2026-11-24T10:00:00.000Z";

/** عائلات المصفوفات كلها كما يفرضها الملف الحالي (نقل كل العائلات فارغة). */
const ARRAY_FAMILIES = [
  "drafts", "orders", "directSales", "schedules", "recurrences", "financialEvents",
  "supplierPurchases", "cashWallets", "cashContinuityEntries", "materials",
  "inventoryMovements", "inventoryShortages", "catalogItems", "measurementUnits",
  "directConversions", "catalogTemplates", "actualTimeRecords",
  "shortCashDeclarations", "allocationPolicies", "costEstimates", "assets", "loans",
  "recurringExpenseSeries", "recurringExpenseRevisions", "recurringExpenseOccurrences",
  "expenseBudgets", "receivedLoans", "balanceObservations", "counterparties",
  "periodSummaries", "commandReceipts", "ownerEntitlementPolicies",
  "ownerEntitlementRecords", "ownerEntitlementOpeningBalances", "ownerMovements",
];

/** العائلات المعدودة في عدادات المظروف (نقل السجل الكنوني نفسه). */
const COUNTED_FAMILIES = [
  "drafts", "orders", "directSales", "schedules", "financialEvents", "supplierPurchases",
  "cashWallets", "cashContinuityEntries", "materials", "inventoryMovements",
  "inventoryShortages", "assets", "loans", "recurringExpenseSeries",
  "recurringExpenseRevisions", "recurringExpenseOccurrences", "expenseBudgets",
  "receivedLoans", "balanceObservations", "counterparties", "periodSummaries",
  "commandReceipts", "ownerEntitlementPolicies", "ownerEntitlementRecords",
  "ownerEntitlementOpeningBalances", "ownerMovements",
];

function savedParty(index) {
  return {
    id: `mngl06-party-${index}`,
    label: `طرف قياس ${index}`,
    phone: null,
    note: null,
    archivedAt: null,
    operationKey: `mngl06-party-key-${index}`,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
}

function commandReceipt(index) {
  return {
    id: `mngl06-receipt-${index}`,
    commandId: `mngl06-receipt-${index}`,
    commandType: "fixture-measurement",
    generation: "1",
    payloadVersion: 1,
    payloadDigest: `fixture-${index}`,
    outcome: "confirmed",
    failureCode: null,
    failureMessage: null,
    resultRefs: [],
    recordedAt: CREATED_AT,
  };
}

function balanceObservation(index) {
  return {
    id: `mngl06-observation-${index}`,
    scopeKind: "project_total",
    walletId: null,
    countedMinor: 0,
    knowledge: "estimated",
    cutoff: CREATED_AT,
    observedOn: "2026-11-24",
    recordedAt: CREATED_AT,
    operationKey: `mngl06-observation-key-${index}`,
    note: "",
  };
}

/** سلسلة عمق اصطناعية: عدد المستويات المطلوب تحت سجل الطرف نفسه. */
function depthChain(levels) {
  let node = { marker: "depth-leaf" };
  for (let level = 0; level < levels; level += 1) node = { nested: node };
  return node;
}

function buildFile(familyInflations, depthLevelsInsideRecord = 0) {
  const data = {
    profile: null,
    preferences: null,
    ...Object.fromEntries(ARRAY_FAMILIES.map(family => [family, []])),
    ...familyInflations,
  };
  if (depthLevelsInsideRecord > 0) {
    const [family, records] = Object.entries(familyInflations)[0];
    data[family] = records.map((record, index) =>
      index === 0 ? { ...record, depthProbe: depthChain(depthLevelsInsideRecord) } : record,
    );
  }
  const compact = JSON.stringify(data);
  const counts = Object.fromEntries(
    COUNTED_FAMILIES.map(family => [family, Array.isArray(data[family]) ? data[family].length : 0]),
  );
  /* تسلسل مضغوط لا مسيّى جميلًا: القياسات الضخمة تبقى داخل سقف الحجم
   * القائم (٢^٢٤ وحدة) — البصمة تُحسب على النص المضغوط نفسه كما يفعل
   * الخدمة، والبيانات هي هي. */
  return JSON.stringify(
    {
      format: "micro-prototype-local-export",
      version: 34,
      schemaVersion: 43,
      exportedAt: EXPORTED_AT,
      data,
      integrity: { algorithm: "sha256", digest: createHash("sha256").update(compact, "utf8").digest("hex") },
      counts,
    },
  );
}

function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  /* ١ — عائلة واحدة عند الحافة بالضبط: 20,000 طرف. */
  const familyTwentyThousand = buildFile({
    counterparties: Array.from({ length: 20_000 }, (_, index) => savedParty(index)),
  });
  writeFileSync(resolve(OUT_DIR, "mng-local-06-family-20000.json"), familyTwentyThousand, "utf8");

  /* ٢ — الإجمالي عند الحافة بالضبط: 49,998 مصفوفة + سجلان غير مصفوفة = 50,000. */
  const totalFiftyThousand = buildFile({
    counterparties: Array.from({ length: 20_000 }, (_, index) => savedParty(index)),
    commandReceipts: Array.from({ length: 20_000 }, (_, index) => commandReceipt(index)),
    balanceObservations: Array.from({ length: 9_998 }, (_, index) => balanceObservation(index)),
  });
  writeFileSync(resolve(OUT_DIR, "mng-local-06-total-50000.json"), totalFiftyThousand, "utf8");

  /* ٣ — عمق 64 عند الحافة بالضبط: الملف(1)+data(2)+العائلة(3)+السجل(4)+
   * depthProbe(5) ثم 59 مستوى متداخلًا = 64 بالضبط. */
  const depthSixtyFour = buildFile(
    { counterparties: Array.from({ length: 8 }, (_, index) => savedParty(index)) },
    59,
  );
  writeFileSync(resolve(OUT_DIR, "mng-local-06-depth-64.json"), depthSixtyFour, "utf8");

  console.log(`MNG-LOCAL-06 fixtures written to ${OUT_DIR}`);
  console.log("  mng-local-06-family-20000.json  (عائلة واحدة عند 20,000)");
  console.log("  mng-local-06-total-50000.json  (الإجمالي عند 50,000)");
  console.log("  mng-local-06-depth-64.json      (عمق التعشيش 64)");
  console.log("استخدمها لقياس الأداء على أضعف جهاز فعلي مدعوم وفق إجراء المالك الموثق في EXECUTION-REPORT-AR.md.");
}

main();
