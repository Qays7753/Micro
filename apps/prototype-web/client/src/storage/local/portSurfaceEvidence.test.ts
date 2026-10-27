/**
 * R11 W1b-6 / OD-PRESERVE (P-04 + P-01/P-02 method conformance): أدلة سطح
 * منفذ التخزين المحلي — العدّ والعضوية والثوابت، بلا أي تقسيم أو نقل.
 *
 * ما يثبته هذا الملف (الفجوة المقررة في بطاقة P-04):
 *  1) واجهة `PrototypeLocalStore` في `storage/local/types.ts` تحمل بالضبط
 *     136 توقيع طريقة — العدّ استخراج AST من المصدر نفسه (لا نسخ يدوي)،
 *     والقائمة المثبتة أدناه تطابقها عضويًا في الاتجاهين؛ أي إضافة/حذف
 *     يفشل الاختبار حتى إعادة إرساء موثقة (نمط ratشة، لا تعديل صامت).
 *     U001-IR-002 (2026-10-18، مراجعة مستقلة على رأس 1995c930): إعادة
 *     الإرساء الموثقة نفس-الـPR — إضافة commitProfileCreate (إنشاء الهوية
 *     الذرّي عند حد الكتابة) نقلت العدّ من 130 إلى 131؛ التصعيد مرغوب
 *     وموثق هنا وفي تقرير التنفيذ، لا نمو صامت.
 *     S02-A (SH-02/SH-03، 2026-10-27): إعادة إرساء موثقة نفس-الـPR — خمس
 *     طرق حماية الاستبدال الدائمة (getDataGeneration/readRestoreProtection/
 *     beginReplacementIntent/commitReplacementIntent/abortReplacementIntent)
 *     نقلت العدّ من 131 إلى 136؛ التصعيد مرغوب وموثق هنا وفي تقرير S02.
 *  2) محوّلا التخزين (IndexedDbLocalStore وMemoryLocalStore) يعرضان على
 *     نماذجهما بالضبط الأسماء الـ136 ذاتها — مطابقة السطح التنفيذية
 *     للعقد الكتابي (P-01/P-02 conformance).
 *  3) ثابتا الإصدار كما هما بالقيمة: localSchemaVersion = 38 و
 *     localExportVersion = 30 (محروسان بقرار مالك وdiff مزدوج — AGENTS §10).
 *  4) حدّ الذاكرة الموثق (P-02): كل نسخة MemoryLocalStore حالة مستقلة
 *     بلا أي استمرارية — أدلة اختبارية صريحة لحدود السطح الذاكي.
 *
 * حدود صريحة: لا تقسيم ولا نقل ولا أي تعديل على types.ts أو المحوّلين —
 * هذا الملف قراءة وأدلة فقط. الملكية: مالك Micro؛ التراجع: حذف الملف وحده.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

import { localSchemaVersion, localExportVersion } from "./types";
import { MemoryLocalStore } from "./MemoryLocalStore";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";

const TYPES_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "types.ts");

/** الجرد المثبت للـ136 طريقة (مرتب حرفيًا؛ إعادة الإرساء تتطلب توثيقًا بنفس الـPR).
 * U001-IR-002 (2026-10-18): commitProfileCreate أُضيف بإعادة إرساء موثقة
 * نفس-الـPR (مراجعة مستقلة — إنشاء ملف الهوية ذرّيًا عند حد الكتابة). */
export const PINNED_PORT_METHODS: readonly string[] = [
  "abortReplacementIntent",
  "beginReplacementIntent",
  "clearFormDrafts",
  "commitAllocationPolicySuccessor",
  "commitAssetAcquisitionCorrection",
  "commitAssetRecord",
  "commitCashContinuity",
  "commitCatalogTemplateRevision",
  "commitDepositClassification",
  "commitDepositClassificationCorrection",
  "commitDepositRefundSettlement",
  "commitDirectSaleCollectionReversal",
  "commitFinancialEventCorrection",
  "commitFinancialEventReplacement",
  "commitInventory",
  "commitInventoryWithEvents",
  "commitInventoryWithShortage",
  "commitLoanCorrection",
  "commitLoanRecord",
  "commitOrderCollectionReversal",
  "commitOrderDelivery",
  "commitOrderDeliveryReversal",
  "commitOrderFromDraft",
  "commitOrderUpdate",
  "commitOwnerEntitlementOpeningBalanceReversal",
  "commitOwnerEntitlementPolicySuccessor",
  "commitOwnerEntitlementRecordReversal",
  "commitOwnerMovement",
  "commitProfileCreate",
  "commitReceivedLoanCorrection",
  "commitReceivedLoanRecord",
  "commitRecurrence",
  "commitRecurringExpenseDraft",
  "commitRecurringExpenseOccurrenceDecision",
  "commitRecurringExpenseOccurrenceRecord",
  "commitRecurringExpenseOccurrences",
  "commitRecurringExpenseSeriesChange",
  "commitReplacementIntent",
  "commitScheduleCreate",
  "commitScheduleUpdate",
  "commitShortCashDeclarationReversal",
  "commitSupplierPurchase",
  "commitSupplierPurchaseWithAttribution",
  "deleteCostEstimate",
  "deleteDraft",
  "deleteFormDraft",
  "deleteLocalSecurity",
  "getAllocationPolicy",
  "getAsset",
  "getCatalogItem",
  "getCatalogTemplate",
  "getCostEstimate",
  "getDataGeneration",
  "getDirectConversion",
  "getDraft",
  "getFinancialEvent",
  "getFormDraft",
  "getInventoryActivation",
  "getLoan",
  "getLocalSecurity",
  "getMeasurementUnit",
  "getOrder",
  "getOwnerEntitlementPolicy",
  "getOwnerEntitlementRecord",
  "getOwnerMovement",
  "getOwnerProfile",
  "getPreferences",
  "getProfile",
  "getReceivedLoan",
  "getRecurrence",
  "getRecurringExpenseOccurrence",
  "getRecurringExpenseSeries",
  "getSchedule",
  "getShortCashDeclaration",
  "getSupplierPurchase",
  "listActualTimeRecords",
  "listAllocationPolicies",
  "listAssets",
  "listCashContinuityEntries",
  "listCashWallets",
  "listCatalogItems",
  "listCatalogTemplates",
  "listCostEstimates",
  "listDirectConversions",
  "listDirectSales",
  "listDrafts",
  "listExpenseBudgets",
  "listFinancialEvents",
  "listFormDrafts",
  "listInventoryMovements",
  "listInventoryShortages",
  "listLoans",
  "listMaterials",
  "listMeasurementUnits",
  "listOrders",
  "listOwnerEntitlementOpeningBalances",
  "listOwnerEntitlementPolicies",
  "listOwnerEntitlementRecords",
  "listOwnerMovements",
  "listReceivedLoans",
  "listRecurrences",
  "listRecurringExpenseOccurrences",
  "listRecurringExpenseRevisions",
  "listRecurringExpenseSeries",
  "listSchedules",
  "listShortCashDeclarations",
  "listSupplierPurchases",
  "readRestoreProtection",
  "readSnapshot",
  "replaceSnapshot",
  "saveActualTimeRecord",
  "saveAllocationPolicy",
  "saveCatalogItem",
  "saveCatalogTemplate",
  "saveCostEstimate",
  "saveDirectConversion",
  "saveDirectSale",
  "saveDraft",
  "saveExpenseBudget",
  "saveExpenseBudgetRevisionPair",
  "saveFinancialEvent",
  "saveFormDraft",
  "saveInventoryActivation",
  "saveLocalSecurity",
  "saveMeasurementUnit",
  "saveOrder",
  "saveOwnerEntitlementOpeningBalance",
  "saveOwnerEntitlementPolicy",
  "saveOwnerEntitlementRecord",
  "saveOwnerProfile",
  "savePreferences",
  "saveProfile",
  "saveRecurrence",
  "saveSchedule",
  "saveShortCashDeclaration",
  "saveSupplierPurchase",
];

/** استخراج AST لأسماء طرق الواجهة من المصدر الحي (لا نسخ يدوي). */
interface SourceFileWithParseDiagnostics extends ts.SourceFile {
  /* خاصية داخلية حقيقية وقت التشغيل (يتحقق الماسح من صحة التحليل) لكنها
   * ليست على النوع العام ts.SourceFile — tsconfig التطبيق يرفض الوصول
   * المباشر (TS2339)، فهذه الواجهة الموصّفة موضعيًا هي المسار المكتوب
   * النوع نفسه دون أي إضعاف للفحص المغلق. */
  readonly parseDiagnostics?: readonly { readonly messageText: ts.DiagnosticMessageChain | string }[];
}

function extractInterfaceMethodNames(): string[] {
  const source = fs.readFileSync(TYPES_PATH, "utf8");
  const sourceFile = ts.createSourceFile(TYPES_PATH, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const parseDiagnostics = (sourceFile as SourceFileWithParseDiagnostics).parseDiagnostics ?? [];
  if (parseDiagnostics.length > 0) {
    throw new Error(
      `parse diagnostics in types.ts — fail-closed (first: ${parseDiagnostics[0].messageText})`,
    );
  }
  const names: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === "PrototypeLocalStore") {
      for (const member of node.members) {
        if (ts.isMethodSignature(member) && ts.isIdentifier(member.name)) names.push(member.name.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return names.sort();
}

function publicMethodNames(prototype: object): string[] {
  return Object.getOwnPropertyNames(prototype)
    .filter(
      name =>
        name !== "constructor" && typeof (prototype as never as Record<string, unknown>)[name] === "function",
    )
    .sort();
}

describe("P-04 — أدلة سطح منفذ التخزين المحلي (OD-PRESERVE؛ بلا تقسيم أو نقل)", () => {
  it("واجهة PrototypeLocalStore تحمل بالضبط 136 طريقة — والقائمة المثبتة مطابقة عضويًا في الاتجاهين", () => {
    const live = extractInterfaceMethodNames();
    expect(live).toHaveLength(136);
    expect(live).toEqual([...PINNED_PORT_METHODS]);
  });

  it("P-01: نموذج IndexedDbLocalStore يعرض بالضبط الأسماء الـ136 ذاتها (مطابقة السطح التنفيذية)", () => {
    expect(publicMethodNames(IndexedDbLocalStore.prototype)).toEqual([...PINNED_PORT_METHODS]);
  });

  it("P-02: نموذج MemoryLocalStore يعرض الأسماء الـ136 ذاتها + مساعد TS-private واحد موثق فقط", () => {
    /* حدّ موثق: `private` في TypeScript زمن ترجمة لا زمن تشغيل — المساعد
     * يظهر على النموذج؛ نثبّته بالاسم فأي مساعد جديد (خاص أو عام) يفشل
     * الاختبار حتى توثيقه هنا — لا سطح خفي خلف العقد. */
    const documentedPrivateHelpers = ["checkRecurrenceSchedule"];
    expect(publicMethodNames(MemoryLocalStore.prototype)).toEqual(
      [...PINNED_PORT_METHODS, ...documentedPrivateHelpers].sort(),
    );
  });

  it("ثابتا الإصدار كما هما بالقيمة: localSchemaVersion = 38 وlocalExportVersion = 30", () => {
    expect(localSchemaVersion).toBe(38);
    expect(localExportVersion).toBe(30);
  });

  it("P-02 (حدّ موثق): كل نسخة MemoryLocalStore حالة مستقلة بلا استمرارية — النسخة الجديدة تبدأ فارغة", async () => {
    const first = new MemoryLocalStore();
    const before = await first.readSnapshot();
    if (!before.ok) throw new Error(before.message);
    expect(before.value.orders).toEqual([]);
    /* الكتابة في نسخة لا تظهر في نسخة أخرى: لا حالة مشتركة خلف الظهر. */
    const saved = await first.saveOrder({
      id: "memory-isolation",
      customerName: "ليلى",
      itemName: "رف",
      specifications: "",
      quantity: 1,
      agreedPriceMinor: 1000,
      status: "draft",
      settlementStatus: "none",
      collectedMinor: 0,
      depositCollectedMinor: 0,
      receivableMinor: 1000,
      retainedDepositMinor: 0,
      costSnapshot: {
        currency: "JOD",
        totalMinor: 0,
        materialsMinor: 0,
        timeMinor: 0,
        packagingMinor: 0,
        deliveryMinor: 0,
        wasteMinor: 0,
        safetyBufferMinor: 0,
        quantity: 1,
        confidence: "incomplete",
        createdAt: "2026-10-14T00:00:00Z",
        source: "price_approval",
      },
      events: [],
      nextAction: "سجّل الاتفاق",
      createdAt: "2026-10-14T00:00:00Z",
      updatedAt: "2026-10-14T00:00:00Z",
    } as never);
    if (!saved.ok) throw new Error(saved.message);
    const second = new MemoryLocalStore();
    const secondSnapshot = await second.readSnapshot();
    if (!secondSnapshot.ok) throw new Error(secondSnapshot.message);
    expect(secondSnapshot.value.orders).toEqual([]);
  });
});
