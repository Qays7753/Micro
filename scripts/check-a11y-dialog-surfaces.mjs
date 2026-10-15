#!/usr/bin/env node
/**
 * R11 W4-0 (موجة المتابعة 2026-10-15 — OD-A11Y الخيار B): حارس نماذج
 * التفاعل — يفرض تصنيف كل سطح حواري في كود العميل قبل تغييره وبعده.
 *
 * يمسح AST لكل ملفات إنتاج العميل بحثًا عن أسطح الحوار المعلنة:
 * role="dialog" / role="alertdialog" / aria-modal — وكل سطح يجب أن يكون في
 * السجل المصنف CLASSIFIED_DIALOG_SURFACES (الملف + الدور + aria-modal +
 * نموذج التفاعل + صنف عقد التركيز). أي سطح حواري جديد غير مصنف يُرفض
 * حتى يصنف في نفس الـPR؛ وأي صف مسجل يغادر الشجرة أو تغير تصريحه
 * (الدور أو aria-modal) يُرفض (تغيير التصريح تعديل مقصود يحدّث السجل
 * بنفس الـPR بتوثيق).
 *
 * التصنيف المعتمد (W4-0 — قبل أي تغيير D-14/D-13):
 *  - TRUE_MODAL: القفل والبوابات الأمنية وحوار عدم الحفظ — عقد التركيز
 *    الكامل ساري (غطاء + احتواء + استعادة)؛ فخ التركيز قانوني هنا فقط.
 *  - NON_MODAL: أوراق/ألواح معلنة aria-modal="false" أو بلا تصريح —
 *    لا فخ تركيز إطلاقًا (قرار OD-A11Y الصريح).
 *  - NESTED_CONFIRM: تأكيد داخل سطح قائم — غير تطبيقي-المودال.
 *
 * الاستخدام: node scripts/check-a11y-dialog-surfaces.mjs [repoRoot].
 * الخروج: 0 = نظيف؛ 1 = أي خرق؛ 2 = خطأ استخدام.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { ROOT } from "./check-runtime-cycles.mjs";

const CLIENT_SRC = path.join("apps", "prototype-web", "client", "src");
const TEST_PAT = /\.(test|spec|dom\.test|ui\.test|contract\.test|characterization\.test|mutation\.test)\.[cm]?[jt]sx?$/;
const SOURCE_EXT = new Set([".ts", ".tsx"]);

/** السجل المصنف — كل سطح حواري معلن في كود الإنتاج يجب أن يكون هنا. */
export const CLASSIFIED_DIALOG_SURFACES = [
  {
    file: "components/security/AppLockGate.tsx",
    role: "dialog",
    ariaModal: true,
    model: "TRUE_MODAL",
    focusContract: "oracle — veil + inert content + autoFocus (AppLockGate نفسه؛ لا يعدل في W4 بقرار العقد)",
  },
  {
    file: "components/security/DataActionPinGate.tsx",
    role: "alertdialog",
    ariaModal: true,
    model: "TRUE_MODAL",
    focusContract: "D-14 FIX_NOW — autoFocus فقط اليوم؛ الهدف: veil + احتواء + Escape + استعادة (نمط AppLockGate/UnsavedChangesGuard)",
  },
  {
    file: "pages/Settings.tsx",
    role: "alertdialog",
    ariaModal: true,
    model: "TRUE_MODAL",
    focusContract: "D-14 FIX_NOW — لا عقد تركيز إطلاقًا اليوم (protectionBlocked)؛ الهدف: veil + focus-in + احتواء + Escape + استعادة",
  },
  {
    file: "components/forms/UnsavedChangesGuard.tsx",
    role: "dialog",
    ariaModal: true,
    model: "TRUE_MODAL",
    focusContract: "conformant pre-existing — focus-in + Tab-cycle trap + Escape + restore",
  },
  {
    file: "components/layout/AppHeader.tsx",
    role: "dialog",
    ariaModal: false,
    model: "NON_MODAL",
    focusContract: "none by design — لا فخ تركيز للألواح غير المودالة (OD-A11Y)",
  },
  {
    file: "components/layout/QuickActionSheet.tsx",
    role: "alertdialog",
    ariaModal: null,
    model: "NESTED_CONFIRM",
    focusContract: "none by design — تأكيد مهمل-الإدخال داخل ورقة قائمة؛ غير تطبيقي-المودال فلا aria-modal",
  },
  {
    file: "pages/RecurringExpenseDetail.tsx",
    role: "region",
    ariaModal: null,
    model: "INLINE_REGION",
    focusContract: "D-13 منفذ — أقسام داخلية موسعة مصرحة region (كانت dialog خطأً)؛ لا فخ ولا إزاحة تركيز (قرار OD-A11Y: لا فخ لغير المودال)",
  },
];

function listClientProductionFiles(repoRoot) {
  const out = [];
  const dir = path.join(repoRoot, CLIENT_SRC);
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else if (SOURCE_EXT.has(path.extname(e.name)) && !TEST_PAT.test(e.name)) out.push(full);
    }
  };
  walk(dir);
  return out;
}

/** كل أسطح الحوار المعلنة في ملف واحد: مواضع role/aria-modal مع قيمها. */
export function declaredDialogSurfaces(fileName, content) {
  const sf = ts.createSourceFile(fileName, content, ts.ScriptTarget.Latest, true);
  const surfaces = [];
  const valueOf = attr => (ts.isStringLiteral(attr.initializer) ? attr.initializer.text : `<expr:${attr.initializer.getText(sf)}>`);
  const visit = node => {
    if (ts.isJsxAttribute(node)) {
      const name = node.name.text;
      if (name === "role" && node.initializer && (ts.isStringLiteral(node.initializer) || ts.isJsxExpression(node.initializer))) {
        const value = ts.isStringLiteral(node.initializer)
          ? node.initializer.text
          : `<expr:${node.initializer.getText(sf)}>`;
        if (value === "dialog" || value === "alertdialog") {
          surfaces.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, kind: "role", value });
        }
      } else if (name === "aria-modal" && node.initializer) {
        surfaces.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, kind: "aria-modal", value: valueOf(node) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return surfaces;
}

/** الفحص الكامل: يعيد الخروق والإحصاءات. */
export function checkA11yDialogSurfaces(repoRoot) {
  const violations = [];
  const registry = new Map(CLASSIFIED_DIALOG_SURFACES.map(s => [s.file, s]));
  const liveDialogFiles = new Set();
  let scanned = 0;
  for (const full of listClientProductionFiles(repoRoot)) {
    const rel = path.relative(path.join(repoRoot, CLIENT_SRC), full).split(path.sep).join("/");
    scanned += 1;
    const content = fs.readFileSync(full, "utf8");
    const surfaces = declaredDialogSurfaces(full, content);
    const dialogRoles = surfaces.filter(s => s.kind === "role");
    const ariaModals = surfaces.filter(s => s.kind === "aria-modal");
    if (dialogRoles.length > 0 || ariaModals.length > 0) {
      liveDialogFiles.add(rel);
      const classified = registry.get(rel);
      if (!classified) {
        violations.push({
          rule: "unclassified-dialog-surface",
          key: `${rel} — ${dialogRoles.map(s => `${s.kind}="${s.value}"@${s.line}`).join(", ") || "aria-modal only"}`,
        });
        continue;
      }
      for (const role of dialogRoles) {
        if (role.value !== classified.role) {
          violations.push({
            rule: "dialog-role-drift",
            key: `${rel}:${role.line} — role="${role.value}" لكن السجل يقول "${classified.role}" (تحديث مقصود؟ حدّث السجل بنفس الـPR بتوثيق)`,
          });
        }
      }
      const modalValues = ariaModals.map(s => s.value);
      const expectedModal = classified.ariaModal === null ? null : String(classified.ariaModal);
      for (const value of modalValues) {
        if (expectedModal === null) {
          violations.push({
            rule: "unexpected-aria-modal",
            key: `${rel} — aria-modal="${value}" لكن السجل لا يصرح بمودال (تحديث مقصود؟)`,
          });
        } else if (value !== expectedModal) {
          violations.push({
            rule: "aria-modal-drift",
            key: `${rel} — aria-modal="${value}" لكن السجل يقول "${expectedModal}"`,
          });
        }
      }
      if (classified.ariaModal !== null && modalValues.length === 0 && classified.role !== "region") {
        violations.push({
          rule: "missing-declared-aria-modal",
          key: `${rel} — السجل يصرح بـaria-modal=${expectedModal} ولا وجود للتصريح في الشجرة`,
        });
      }
    }
  }
  for (const classified of CLASSIFIED_DIALOG_SURFACES) {
    if (!fs.existsSync(path.join(repoRoot, CLIENT_SRC, classified.file))) {
      violations.push({ rule: "classified-file-stale", key: classified.file });
      continue;
    }
    if (!liveDialogFiles.has(classified.file) && classified.role !== "region") {
      /* ملف مسجل بلا أي دور حواري حي — تقادم تسجيل (استثناء region: الدور
       * الإقليمي لا يمر بفلتر الحوار أعلاه عمدًا؛ وجوده يثبته فحص الدور
       * المباشر أدناه). */
      violations.push({ rule: "classified-surface-stale", key: classified.file });
    }
  }
  /* D-13 (بعد التنفيذ): الأقسام الإقليمية داخل RecurringExpenseDetail يجب
   * أن تبقى regions لا dialogs — يفحص فقط بعد أن ينفذ D-13 (انقراض
   * INLINE_MISDECLARED من السجل). */
  const recurring = path.join(repoRoot, CLIENT_SRC, "pages/RecurringExpenseDetail.tsx");
  const stillMisdeclared = CLASSIFIED_DIALOG_SURFACES.some(s => s.file === "pages/RecurringExpenseDetail.tsx" && s.model === "INLINE_MISDECLARED");
  if (!stillMisdeclared && fs.existsSync(recurring)) {
    const content = fs.readFileSync(recurring, "utf8");
    const regionCount = (content.match(/role="region"/g) ?? []).length;
    if (regionCount < 3) {
      violations.push({
        rule: "inline-region-regression",
        key: `pages/RecurringExpenseDetail.tsx — ${regionCount}/3 role="region" (ارتداد D-13؟)`,
      });
    }
    if (content.includes('role="dialog"')) {
      violations.push({
        rule: "inline-region-regression",
        key: 'pages/RecurringExpenseDetail.tsx — role="dialog" عاد بعد تصحيح D-13',
      });
    }
  }
  return {
    ok: violations.length === 0,
    violations,
    stats: { scanned, classified: CLASSIFIED_DIALOG_SURFACES.length, liveDialogFiles: liveDialogFiles.size },
  };
}

function main() {
  const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : ROOT;
  if (!fs.existsSync(path.join(repoRoot, "package.json"))) {
    console.error("a11y-dialog-surfaces: USAGE: node scripts/check-a11y-dialog-surfaces.mjs [repoRoot]");
    process.exit(2);
  }
  const { ok, violations, stats } = checkA11yDialogSurfaces(repoRoot);
  if (!ok) {
    console.error(`a11y-dialog-surfaces: FAIL — ${violations.length} خرقًا:`);
    for (const v of violations) console.error(`  [${v.rule}] ${v.key}`);
    process.exit(1);
  }
  console.log(
    `a11y-dialog-surfaces: PASS — ${stats.scanned} ملف إنتاج زُرع؛ ${stats.classified} سطحًا حواريًا مصنفًا (${stats.liveDialogFiles} ملفًا يحمل تصريح حوار حيًا)؛ أي سطح حوار جديد يُرفض حتى يصنف في نفس الـPR (W4-0/OD-A11Y)؛ فخ التركيز قانوني للـTRUE_MODAL وحده`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
