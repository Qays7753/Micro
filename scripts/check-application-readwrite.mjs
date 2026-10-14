#!/usr/bin/env node
/**
 * R5/S3 (WS-216/ARCH-007 — 2026-10-09): حارس قراءة/كتابة التطبيق — يثبت أن
 * ملفات القراءة المسجلة في عائلات R5 المالية لا تستدعي أي فعل كتابة على
 * منفذ التخزين (قبول الموجة: «القارئ لا يكتب» — F-08 حتمية لا عرضية).
 *
 *  - الطاقم المسجل `READER_FILES` (18 ملفًا عند التأسيس) + **آلية توسيع
 *    ذاتية**: أي ملف غير اختباري في العائلات الخمس يحمل وسم `PC-4 read-model:`
 *    في ترويسته (ترويسات S4) يُدرج تلقائيًا في المنع.
 *  - المنع: أي استدعاء (AST) لاسم يبدأ بـ save/commit/delete/replace/clear
 *    بحرف كبير — بصيغتي الوصول الخاص (`store.saveX()`) والمعرّف المجرد
 *    (`const {saveX} = store; saveX()`).
 *  - صف مسجل غادر الشجرة = فشل (نظافة الأساس نفس-الـPR).
 *
 * R11 W1A-1 / D-04 (R10A-F-019، قرار OD-GUARD الخيار A، 2026-10-14):
 *  - **جسم القراءة الكامل (read-like corpus) خارج العائلات الخمس** صار
 *    محروسًا some-membership + property في آن واحد، بأساس 63 ملفًا مقيسًا
 *    حيًّا عند 5ef4ce08 (تطابق سلسلة W0: 62 عند قاعدة R10-B ثم 63 بعد
 *    شريحة R10-B3 التي أضافت inventory/materialUnitLabels.ts).
 *  - **المُسند المسجل حرفيًا (لا اجتهاد في العدّ):** ملف `.ts` غير اختباري
 *    تحت `apps/prototype-web/client/src/application/`، بيته (أول مقطع من
 *    مساره النسبي) ليس من العائلات الخمس {finance, owner-money,
 *    financial-records, budgets, transfers}، ونصّ الملف خالٍ من أي مطابقة
 *    للنمط النصي `/(save|commit|delete|replace|clear)[A-Z][A-Za-z0-9_]*\s*\(/`.
 *    هذا المُسند النصي هو المنهج نفسه الذي أنتج الرقم المعتمد 63: الملفان
 *    الحديّان preferenceService.ts وlegacyFormDraftMigration.ts يُصنّفان
 *    «كاتبين» نصيًا لأنهما **يعرّفان** توابع تبدأ بـ save أو clear (لا يستدعيانها) —
 *    قصدية موثقة لا تساهلًا: تعريف فعل كتابة في ملف يجعله كاتبًا محتملًا
 *    فيصح إخراجه من جسم القراءة.
 *  - **حدود موثقة (RV2):** الجسم «قراءته منفذ-المخزن» — عضو الجسم
 *    diagnostics/localDiagnosticsService.ts يكتب سجل تشخيص محلي عبر
 *    localStorage.setItem مباشرة (R11-W1A-NF-001، مسجل في التقرير)؛
 *    مفردة المنع النصية تغطي 100% من أفعال الكتابة على منفذ المخزن (89
 *    اسمًا) بينما localStorage خارج منفذ المخزن وحارسه — القيد مسجل لا
 *    مسكوت عنه.
 *  - **فشول ثلاثة مميزة:** ملف قراءة جديد خارج الجسم المحروس (growth)،
 *    ومفتاح أساس غادر الشجرة (stale)، وخرق الخاصية داخل الجسم (ملف
 *    مسجل صار نصّه يحمل فعل كتابة) — كلٌّ برسالته وسببه.
 *
 * لا يثبت (حدود موثقة بمالك ومحفز):
 *  1) مفردات المنع تغطي أفعال كتابة منفذ التخزين (save وcommit وdelete و
 *     replace وclearFormDrafts) — ليست مفردات خدمات الكاتب
 *     (createBudget/recordFinancialEvent/…)؛ قارئ يستدعي خدمة كاتب يهرّب —
 *     الطبقة مسجلة في السجل الحدي §5 (الكتاب عبر مالكها الكنوني).
 *  2) التسجيل لقطة + المُسند: ملف قارئ جديد لا يطابق المُسند (مثل ملف
 *     داخل العائلات الخمس) تبقى تغطيته لآلية PC-4؛ والملف المطابق بلا
 *     تسجيل يُرفض حتى يُصنف في نفس الـPR.
 *  3) الكتّاب السبعة خارج الطاقم عمدًا: قراءاتهم شروط كتابة موثقة.
 *
 * الاستخدام: node scripts/check-application-readwrite.mjs [repoRoot].
 * الخروج: 0 = نظيف؛ 1 = أي خرق؛ 2 = خطأ استخدام.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { ROOT } from "./check-runtime-cycles.mjs";

const CLIENT_APPLICATION = path.join("apps", "prototype-web", "client", "src", "application");
const TEST_PAT = /\.(test|spec|dom\.test|ui\.test|contract\.test|characterization\.test)\.[cm]?[jt]sx?$/;
const PC4_MARKER = "PC-4 read-model";
const WRITE_CALL = /^(save|commit|delete|replace|clear)[A-Z]/;

/** D-04 (R11 W1A-1): المُسند النصي المسجل حرفيًا — نفس المنهج الذي أنتج
 * الأساس المعتمد 63 (تعريفات save وclear تُحتسب كتابة نصية كما الاستدعاء). */
export const WRITE_VOCABULARY_TEXT_PATTERN = /(save|commit|delete|replace|clear)[A-Z][A-Za-z0-9_]*\s*\(/;

/** العائلات الخمس التي تحرسها آلية PC-4 (حدود التسجيل الأصلية). */
export const PC4_FAMILIES = ["finance", "owner-money", "financial-records", "budgets", "transfers"];

/** طاقم القراءة المسجل (R5/S3 — تعداد حصري من الشجرة عند التأسيس). */
export const READER_FILES = [
  "finance/projectFinancialReads.ts",
  "finance/projectFinancialPeriodReads.ts",
  "finance/projectFinancialInsights.ts",
  "finance/statementService.ts",
  "finance/periodComparisonService.ts",
  "finance/profitToCashBridgeService.ts",
  "finance/integrityCheckService.ts",
  "finance/integrityCheckModel.ts",
  "finance/integrityCheckCoreFinance.ts",
  "finance/integrityCheckInventory.ts",
  "finance/integrityCheckAssetsLoans.ts",
  "finance/integrityCheckContinuity.ts",
  "finance/integrityCheckSupplierWallet.ts",
  "finance/integrityCheckSettlementBasis.ts",
  "finance/integrityCheckOffenderSummaries.ts",
  "finance/dueDatesService.ts",
  "finance/upcomingService.ts",
  "financial-records/correctionHistoryService.ts",
];

/** D-04 (R11 W1A-1، 2026-10-14): جسم القراءة الكامل خارج العائلات الخمس —
 * 63 ملفًا مقيسة حية عند 5ef4ce08 (98 ملفًا خارج العائلات − 35 كاتبًا
 * نصيًا). الالتحاق بالمُسند النصي أعلاه؛ أي ملف مطابق خارج هذا الأساس
 * يُرفض حتى يُصنف في نفس الـPR، وأي مفتاح يغادر الشجرة أو يخرق خاصية
 * القراءة يُرفض. الملف الـ63 (inventory/materialUnitLabels.ts — شريحة
 * R10-B3) مدقق أدناه: مفردات تسميات صرفة بلا أي فعل كتابة. */
export const READ_LIKE_CORPUS_BASELINE = [
  "activity/activityLabels.ts",
  "activity/activityService.ts",
  "activity/index.ts",
  "agreements/agreementPresentation.ts",
  "agreements/agreementPrice.ts",
  "agreements/followUpDate.ts",
  "agreements/index.ts",
  "agreements/orderDetailViewModel.ts",
  "assets/index.ts",
  "cash/cashCountMessages.ts",
  "cash/index.ts",
  "cash/walletLedgerService.ts",
  "catalog/index.ts",
  "catalog/templatePlannedCostService.ts",
  "collections/collectionService.ts",
  "collections/index.ts",
  "cost/index.ts",
  "diagnostics/index.ts",
  "diagnostics/localDiagnosticsService.ts",
  "diagnostics/routeTemplate.ts",
  "direct-sales/directSaleEditorModel.ts",
  "drafts/formDraftTestHarness.ts",
  "drafts/index.ts",
  "estimates/index.ts",
  "financial-pulse/financialPulseService.ts",
  "financial-pulse/index.ts",
  "follow-up/dailyFollowUpService.ts",
  "follow-up/index.ts",
  "formatting/formatters.ts",
  "fulfillment/deliveryAttribution.ts",
  "fulfillment/deliveryContribution.ts",
  "fulfillment/index.ts",
  "home/homeControlCenterModel.ts",
  "home/homeControlCenterService.ts",
  "home/index.ts",
  "identity/buildIdentity.ts",
  "input/englishNumeric.ts",
  "input/index.ts",
  "inventory/index.ts",
  "inventory/inventoryMaterialModel.ts",
  "inventory/inventoryMaterialReads.ts",
  "inventory/inventoryMaterialService.ts",
  "inventory/inventoryMaterialsViewModel.ts",
  "inventory/inventoryMovementEditorModel.ts",
  "inventory/inventoryMovementRoute.ts",
  "inventory/materialSuggestions.ts",
  "inventory/materialUnitLabels.ts",
  "loans/index.ts",
  "parties/index.ts",
  "parties/partyLedgerService.ts",
  "preferences/index.ts",
  "resultCodes.ts",
  "scheduling/capacityDecisionService.ts",
  "scheduling/capacityDecisionViewModel.ts",
  "scheduling/index.ts",
  "scheduling/scheduleViewModel.ts",
  "security/index.ts",
  "share/index.ts",
  "share/shareMessageService.ts",
  "suppliers/index.ts",
  "suppliers/supplierPurchaseEditorModel.ts",
  "time/clock.ts",
  "time/index.ts",
];

/** D-04: هل الملف (مساره النسبي من application/) داخل نطاق المُسند؟
 * البيت = أول مقطع من المسار؛ ملفات جذر application بلا بيت تظل داخل
 * النطاق (بيتها ليس من العائلات الخمس بطبيعته). */
export function readLikeCorpusInScope(relativeToApplication) {
  if (!relativeToApplication.endsWith(".ts")) return false;
  if (TEST_PAT.test(path.basename(relativeToApplication))) return false;
  const house = relativeToApplication.includes("/") ? relativeToApplication.split("/")[0] : null;
  if (house !== null && PC4_FAMILIES.includes(house)) return false;
  return true;
}

/** D-04: هل يحقق الملف خاصية القراءة النصية؟ (خلوّ النص من فعل الكتابة). */
export function satisfiesReadLikeProperty(content) {
  return !WRITE_VOCABULARY_TEXT_PATTERN.test(content);
}

function listApplicationFiles(repoRoot) {
  const out = [];
  const dir = path.join(repoRoot, CLIENT_APPLICATION);
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else out.push(full);
    }
  };
  walk(dir);
  return out.filter(f => f.endsWith(".ts") && !TEST_PAT.test(path.basename(f)));
}

/** رصد أي استدعاء كتابة في ملف قارئ (وصول خاص أو معرّف مجرد). */
export function writeCallsIn(sourceFile) {
  const calls = [];
  const visit = node => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isPropertyAccessExpression(callee)
        ? callee.name.text
        : ts.isIdentifier(callee)
          ? callee.text
          : null;
      if (name && WRITE_CALL.test(name)) calls.push(name);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return calls;
}

/** الملفات المحروسة: الطاقم المسجل + كل ملف موسوم PC-4 في العائلات الخمس. */
export function enrolledReaderFiles(repoRoot) {
  const auto = [];
  for (const family of PC4_FAMILIES) {
    const dir = path.join(repoRoot, CLIENT_APPLICATION, family);
    if (!fs.existsSync(dir)) continue;
    const walk = d => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) walk(full);
        else if (e.name.endsWith(".ts") && !TEST_PAT.test(e.name)) auto.push(full);
      }
    };
    walk(dir);
  }
  const tagged = [];
  for (const full of auto) {
    if (fs.readFileSync(full, "utf8").includes(PC4_MARKER)) tagged.push(full);
  }
  return { registered: READER_FILES.map(rel => path.join(repoRoot, CLIENT_APPLICATION, rel)), auto: tagged };
}

/** D-04: فحص جسم القراءة — العضوية والخاصية معًا. */
export function checkReadLikeCorpus(repoRoot) {
  const violations = [];
  const base = path.join(repoRoot, CLIENT_APPLICATION);
  const baselineSet = new Set(READ_LIKE_CORPUS_BASELINE);
  const liveReadLike = [];
  for (const full of listApplicationFiles(repoRoot)) {
    const rel = path.relative(base, full).split(path.sep).join("/");
    if (!readLikeCorpusInScope(rel)) continue;
    const content = fs.readFileSync(full, "utf8");
    if (!satisfiesReadLikeProperty(content)) continue; /* كاتب نصي — خارج الجسم */
    liveReadLike.push(rel);
    if (!baselineSet.has(rel)) {
      violations.push({
        rule: "read-like-corpus-growth",
        key: rel,
        hint: "ملف قراءة جديد خارج العائلات الخمس خارج الجسم المحروس (D-04/R10A-F-019): أضفه إلى READ_LIKE_CORPUS_BASELINE بتصنيف موثق في نفس الـPR، أو أخرجه من خاصية القراءة بتسمية صريحة",
      });
    }
  }
  for (const rel of READ_LIKE_CORPUS_BASELINE) {
    const full = path.join(base, rel);
    if (!fs.existsSync(full)) {
      violations.push({
        rule: "read-like-corpus-stale",
        key: rel,
        hint: "مفتاح أساس جسم القراءة غادر الشجرة (هاجر أو حُذف) — أزل السطر من READ_LIKE_CORPUS_BASELINE في نفس الـPR",
      });
      continue;
    }
    const content = fs.readFileSync(full, "utf8");
    if (!satisfiesReadLikeProperty(content)) {
      violations.push({
        rule: "read-like-corpus-property",
        key: rel,
        hint: "خرق خاصية القراءة داخل الجسم (D-04): الملف المسجل كقارئ صار نصّه يحمل نمط فعل كتابة (save/commit/delete/replace/clear بحرف كبير) — إما كتابة عرضية يجب إزالتها أو إعادة تصنيف موثقة في نفس الـPR",
      });
    }
  }
  return { violations, stats: { baseline: READ_LIKE_CORPUS_BASELINE.length, liveReadLike: liveReadLike.length } };
}

/** الفحص الكامل: يعيد الخروق والإحصاءات. */
export function checkApplicationReadWrite(repoRoot) {
  const { registered, auto } = enrolledReaderFiles(repoRoot);
  const violations = [];
  for (const full of registered) {
    const rel = path.relative(repoRoot, full).split(path.sep).join("/");
    if (!fs.existsSync(full)) {
      violations.push({ rule: "reader-file-stale", key: rel });
      continue;
    }
    const sf = ts.createSourceFile(full, fs.readFileSync(full, "utf8"), ts.ScriptTarget.Latest, true);
    for (const name of writeCallsIn(sf)) violations.push({ rule: "reader-writes", key: `${rel}: ${name}()` });
  }
  for (const full of auto) {
    const rel = path.relative(repoRoot, full).split(path.sep).join("/");
    const sf = ts.createSourceFile(full, fs.readFileSync(full, "utf8"), ts.ScriptTarget.Latest, true);
    for (const name of writeCallsIn(sf)) violations.push({ rule: "reader-writes", key: `${rel}: ${name}()` });
  }
  const corpus = checkReadLikeCorpus(repoRoot);
  violations.push(...corpus.violations);
  return {
    ok: violations.length === 0,
    violations,
    stats: {
      registered: registered.length,
      autoEnrolled: auto.length,
      writeCalls: violations.filter(v => v.rule === "reader-writes").length,
      readLikeCorpus: corpus.stats.liveReadLike,
      readLikeBaseline: corpus.stats.baseline,
    },
  };
}

function main() {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;
  if (!fs.existsSync(path.join(repoRoot, "package.json"))) {
    console.error("application-readwrite: USAGE: node scripts/check-application-readwrite.mjs [repoRoot]");
    process.exit(2);
  }
  const { ok, violations, stats } = checkApplicationReadWrite(repoRoot);
  if (!ok) {
    console.error(`application-readwrite: FAIL — ${violations.length} خرقًا:`);
    for (const v of violations) console.error(`  [${v.rule}] ${v.key}`);
    process.exit(1);
  }
  console.log(
    `application-readwrite: PASS — ${stats.registered} ملف قارئ مسجلًا + ${stats.autoEnrolled} موسوم PC-4؛ صفر استدعاءات كتابة (save/commit/delete/replace/clear بأول حرف كبير)؛ القارئ لا يكتب حتميًا في حدود المفردات الموثقة (R5/S3 — F-08)؛ جسم القراءة خارج العائلات الخمس ${stats.readLikeCorpus}/${stats.readLikeBaseline} ملفًا (راتشة عضوية+خاصية D-04 — R10A-F-019/OD-GUARD)`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
