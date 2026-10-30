/**
 * R11 W1b-6 / OD-PRESERVE (P-04 + P-01/P-02 method conformance): أدلة سطح
 * منفذ التخزين المحلي — العدّ والعضوية والثوابت، بلا أي تقسيم أو نقل.
 *
 * ما يثبته هذا الملف (الفجوة المقررة في بطاقة P-04):
 *  1) واجهة `PrototypeLocalStore` في `storage/local/types.ts` تحمل بالضبط
 *     146 توقيع طريقة — العدّ استخراج AST من المصدر نفسه (لا نسخ يدوي)،
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
 *     S03 (UNIT-039 B2/عقد §17، 2026-10-28): إعادة إرساء موثقة نفس-الـPR —
 *     إضافة commitProfileRename وحدها (تعديل اسم الهوية القائمة بحد كتابة
 *     محروس واحد: قراءة ومقارنة نسخة وكتابة داخل المعاملة نفسها — CAS على
 *     updatedAt المتوقع، فلا lost update ولا سحق لاسم أحدث، بالمطابقة في
 *     المحوّلين) نقلت العدّ من 136 إلى 137؛ القياس قبل/بعد على المرشّح
 *     الدقيق: AST المصدر نفسه أعطى 136 عند f193ccd1 و137 على مرشّح S03
 *     بفارق commitProfileRename فقط بلا أي حذف؛ التصعيد مرغوب وموثق هنا
 *     وفي سجل نتيجة S03، لا نمو صامت، وبلا أي رفع سقف أو توسيع تسامح.
 *     S03 revalidation (00-S03-REVALIDATION-S04-EXECUTION-PROMPT-2026-10-28
 *     §A2، 2026-10-28): إعادة إرساء موثقة نفس-الـPR — إضافة
 *     commitPreferencesUpdate وحدها (كتابة التفضيلات عند حد الكتابة:
 *     القراءة الحية والدمج والكتابة داخل معاملة واحدة/خطوة متزامنة مع
 *     فحص CAS اختياري — جذر علاج العيب المُثبت في تزامن كتابة التفضيلات،
 *     بالمطابقة في المحوّلين) نقلت العدّ من 137 إلى 138؛ القياس قبل/بعد
 *     على المصدر نفسه: AST أعطى 137 عند رأس النشر 3e7e4dfc و138 على
 *     شجرة العمل بفارق commitPreferencesUpdate فقط بلا أي حذف؛ التصعيد
 *     مرغوب وموثق هنا وفي سجل نتيجة S03-revalidation، لا نمو صامت، وبلا
 *     أي رفع سقف أو توسيع تسامح.
 *     S04 (DOC-013 / UNIT-025 + العقد المشترك §6.1/§8/§14، 2026-10-28):
 *     إعادة إرساء موثقة نفس-الـPR — إضافة listBalanceObservations
 *     وcommitCashObservation وحدهما (رصد أرصدة النقد: القياس الدائم
 *     للموجود بنطاقه وقطعه ومعرفته، وتسويته المرتبطة إن وجدت في معاملة
 *     واحدة مع مطابقة مرجع حي داخل الحد — قياس لا حركة نقدية) نقلت العدّ
 *     من 138 إلى 140؛ القياس قبل/بعد على المصدر نفسه: AST أعطى 138 عند
 *     رأس علاج S03 26fa9437 و140 على مرشح S04 بالفارقين المصرح بهما فقط
 *     بلا أي حذف؛ التصعيد مرغوب وموثق في سجل نتيجة S04، لا نمو صامت،
 *     وبلا أي رفع سقف أو توسيع تسامح.
 *     S05 (DOC-014 / UNIT-037 + العقد المشترك §5.1/§14، 2026-10-29):
 *     إعادة إرساء موثقة نفس-الـPR — إضافة listCounterparties
 *     وgetCounterparty وcommitCounterpartyWrite وحدها (الأطراف المحفوظة:
 *     هوية تعريفية اختيارية بلا رصيد ولا حدث مالي، بكتابة محروسة عند حد
 *     التخزين: عهدة بالمفتاح وتعارض إنشاء وCAS تعديل) نقلت العدّ من 140
 *     إلى 143؛ القياس قبل/بعد على المصدر نفسه: AST أعطى 140 عند رأس S04
 *     النهائي eab7b6a9 و143 على شجرة عمل S05 بالفوارق الثلاثة المصرح بها ثم 144 في S06 بفارق واحد مصرح به (commitRecurringExpenseOccurrenceLink — حصرية ربط الحدث بالفترة داخل حد الكتابة، R2-F01)
 *     فقط بلا أي حذف؛ التصعيد مرغوب وموثق في سجل نتيجة S05، لا نمو صامت،
 *     وبلا أي رفع سقف أو توسيع تسامح.
 *     S08 (DOC-017 / UNIT-034 + أمر S08 المنشور في 73c1a344، 2026-10-30):
 *     إعادة إرساء موثقة نفس-الـPR — إضافة commitAssetAcquisition
 *     وcommitAssetPayableSettlement وحدهما (اقتناء الأصل عند حد الكتابة:
 *     حدث المصدر مع الدفعة الجزئية في معاملة واحدة، وسداد المتبقي بقراءة
 *     حية ومقارنة داخل الحد نفسه) نقلت العدّ من 144 إلى 146؛ القياس
 *     قبل/بعد على المصدر نفسه؛ التصعيد مرغوب وموثق في سجل نتيجة S08،
 *     لا نمو صامت، وبلا أي رفع سقف أو توسيع تسامح.
 *  2) محوّلا التخزين (IndexedDbLocalStore وMemoryLocalStore) يعرضان على
 *     نماذجهما بالضبط الأسماء الـ146 ذاتها — مطابقة السطح التنفيذية
 *     للعقد الكتابي (P-01/P-02 conformance).
 *  3) ثابتا الإصدار كما هما بالقيمة: localSchemaVersion = 40 و
 *     localExportVersion = 32 (محروسان بقرار مالك وdiff مزدوج — AGENTS §10).
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

/** الجرد المثبت للـ146 طريقة (مرتب حرفيًا؛ إعادة الإرساء تتطلب توثيقًا بنفس الـPR).
 * U001-IR-002 (2026-10-18): commitProfileCreate أُضيف بإعادة إرساء موثقة
 * نفس-الـPR (مراجعة مستقلة — إنشاء ملف الهوية ذرّيًا عند حد الكتابة).
 * S03 (UNIT-039 B2/عقد §17، 2026-10-28): commitProfileRename أُضيف بإعادة
 * إرساء موثقة نفس-الـPR (تعديل الاسم بفحص حي للنسخة داخل معاملة واحدة).
 * S03 revalidation (§A2، 2026-10-28): commitPreferencesUpdate أُضيف بإعادة
 * إرساء موثقة نفس-الـPR (كتابة التفضيلات: دمج الرقعة فوق الحي داخل الحد
 * مع فحص CAS اختياري — علاج جذر عيب التزامن المُثبت §A1).
 * S08 (DOC-017، 2026-10-30): commitAssetAcquisition وcommitAssetPayableSettlement
 * أُضيفا بإعادة إرساء موثقة نفس-الـPR (منافذ أحداث الأصول عند حد الكتابة). */
export const PINNED_PORT_METHODS: readonly string[] = [
  "abortReplacementIntent",
  "beginReplacementIntent",
  "clearFormDrafts",
  "commitAllocationPolicySuccessor",
  "commitAssetAcquisition",
  "commitAssetAcquisitionCorrection",
  "commitAssetPayableSettlement",
  "commitAssetRecord",
  "commitCashContinuity",
  "commitCashObservation",
  "commitCatalogTemplateRevision",
  "commitCounterpartyWrite",
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
  "commitPreferencesUpdate",
  "commitProfileCreate",
  "commitProfileRename",
  "commitReceivedLoanCorrection",
  "commitReceivedLoanRecord",
  "commitRecurrence",
  "commitRecurringExpenseDraft",
  "commitRecurringExpenseOccurrenceDecision",
  "commitRecurringExpenseOccurrenceLink",
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
  "getCounterparty",
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
  "listBalanceObservations",
  "listCashContinuityEntries",
  "listCashWallets",
  "listCatalogItems",
  "listCatalogTemplates",
  "listCostEstimates",
  "listCounterparties",
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
  it("واجهة PrototypeLocalStore تحمل بالضبط 146 طريقة — والقائمة المثبتة مطابقة عضويًا في الاتجاهين", () => {
    const live = extractInterfaceMethodNames();
    expect(live).toHaveLength(146);
    expect(live).toEqual([...PINNED_PORT_METHODS]);
  });

  it("P-01: نموذج IndexedDbLocalStore يعرض بالضبط الأسماء الـ146 ذاتها (مطابقة السطح التنفيذية)", () => {
    expect(publicMethodNames(IndexedDbLocalStore.prototype)).toEqual([...PINNED_PORT_METHODS]);
  });

  it("P-02: نموذج MemoryLocalStore يعرض الأسماء الـ146 ذاتها + مساعد TS-private واحد موثق فقط", () => {
    /* حدّ موثق: `private` في TypeScript زمن ترجمة لا زمن تشغيل — المساعد
     * يظهر على النموذج؛ نثبّته بالاسم فأي مساعد جديد (خاص أو عام) يفشل
     * الاختبار حتى توثيقه هنا — لا سطح خفي خلف العقد. */
    const documentedPrivateHelpers = ["checkRecurrenceSchedule"];
    expect(publicMethodNames(MemoryLocalStore.prototype)).toEqual(
      [...PINNED_PORT_METHODS, ...documentedPrivateHelpers].sort(),
    );
  });

  it("ثابتا الإصدار كما هما بالقيمة: localSchemaVersion = 40 وlocalExportVersion = 32", () => {
    /* S05 (DOC-014 / UNIT-037 — عائلة الأطراف المحفوظة): الزوج الحي 40/32. */
    expect(localSchemaVersion).toBe(40);
    expect(localExportVersion).toBe(32);
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
