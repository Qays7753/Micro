/**
 * S-2 (R11 W1b / D-10 — R10B-NF-012): عقد مصدر `PreparedImport` — اختبارات الإثبات.
 *
 * القرار المعتمد (OPAQUE_PREPARED_IMPORT): النوع الشفاف يُسكّ حصريًا داخل
 * `prepareImport` ولا يقبل `confirmImport` سواه. هذا الملف يثبت:
 *
 *  1) سلبيًا على مستوى النوع: كائن `TransferPreview` عادي غير مُتحقق منه
 *     لا يُمرر إلى `confirmImport` (فشل ترجمة — @ts-expect-error محروس
 *     بـTS2578 ضد التوجيه غير المستخدم)؛
 *  2) إيجابيًا: `PreparedImport` يظل قابلًا للإسناد إلى `TransferPreview`
 *     (عرض الملخص في الواجهة كما هو)؛
 *  3) بمسح المصدر: لا يوجد أي موقع سكّ (cast/satisfies) في ملفات الإنتاج
 *     خارج النقطة الموثقة الوحيدة داخل `prepareImport` — والبصمة الرمزية
 *     نفسها غير مصدّرة فلا تُكتب في كائن حرفي خارج الوحدة أصلًا؛
 *  4) أداة سكّ اختبارية وحيدة معلنة (test-only forge helper) للاختبارات
 *     المستقبلية — ويُحرم هروبها إلى الإنتاج بمسح المصدر نفسه.
 *
 * حدود صريحة: لا تغيير سلوك زمن تشغيل — الكائن يبقى { file, summary }؛
 * التحقق الأحادي والنسخة الاحتياطية قبل الكتابة كما هما (تغطيها أطقم
 * dataRoundTrip/goldens/releasedPairs القائمة بلا تعديل).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { LocalTransferService, PreparedImport, TransferPreview } from "./localTransferService";

/* ── 1) السلبي على مستوى النوع (compile-only؛ declare + دالة لا تُستدعى أبدًا = صفر زمن تشغيل) ── */

declare const service: LocalTransferService;
declare const unvalidatedPreview: TransferPreview;

/** لا تُستدعى أبدًا — جسمها يُدقق في زمن الترجمة فقط (مرجعها الوحيد typeof أدناه). */
function rejectedBypass(): void {
  // @ts-expect-error — S-2: كائن TransferPreview عادي غير مُتحقق منه لا يُمرر إلى confirmImport
  service.confirmImport(unvalidatedPreview);
}

/* ── 2) الاتجاه الإيجابي: التوسيع وقراءة الملخص يظلان ممكنين (type-position) ── */

const wideningHolds: PreparedImport extends TransferPreview ? true : false = true;
const exportedAtIsString: PreparedImport["summary"]["exportedAt"] = "2026-10-14";

/* ── 3) أداة السكّ الاختبارية (test-only — يكشفها مسح المصدر لو هربت للإنتاج) ── */

/** سكّ اختباري معلن: للاختبارات فقط؛ ممنوع استيراده أو تقليده في الإنتاج. */
export function forgePreparedImportForTests(preview: TransferPreview): PreparedImport {
  return preview as PreparedImport;
}

/* ── مسح المصدر: موقع السكّ الإنتاجي الوحيد ── */

const CLIENT_SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../");
const DOMAIN_SRC_ROOT = path.resolve(CLIENT_SRC_ROOT, "../../../../src");
const MINT_FILE = path.join(CLIENT_SRC_ROOT, "application/transfers/localTransferService.ts");

function listProductionFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listProductionFiles(full, acc);
    else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.test\.[a-z]+$/.test(entry.name) &&
      !/\.d\.ts$/.test(entry.name)
    )
      acc.push(full);
  }
  return acc;
}

const FORGE_PATTERNS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /\bas\s+PreparedImport\b/g, label: "as PreparedImport" },
  { pattern: /\bsatisfies\s+PreparedImport\b/g, label: "satisfies PreparedImport" },
  /* cast الزاوية القديم في موضع تعبير فقط — الإزاحة السالبة تمنع مواضع
   * الوسائط العامة مثل TransferResult<PreparedImport>. */
  { pattern: /(?<![A-Za-z0-9_>$])<PreparedImport>\s*[({[]/g, label: "<PreparedImport> cast" },
];

describe("S-2 PreparedImport — عقد المصدر الشفاف (type-level + source scan)", () => {
  it("سلبي type-level: الكائن العادي يُرفض بفشل الترجمة (القفل أعلاه compile-pinned عبر TS2578)", () => {
    /* الشاهد التشغيلي الوحيد الممكن: الدالة موجودة ولا تُستدعى أبدًا —
     * ولو زال الخطأ النوعي من جسمها لفشل TS2578 في pnpm check قبل الوصول هنا. */
    expect(typeof rejectedBypass).toBe("function");
  });

  it("إيجابي: PreparedImport يُسند إلى TransferPreview ويُقرأ ملخصه (العرض كما هو)", () => {
    expect(wideningHolds).toBe(true);
    expect(exportedAtIsString).toBe("2026-10-14");
  });

  it("أداة السكّ الاختبارية مرجعية (identity) — والكائن المسكوك نفسه لا يتغير", () => {
    const preview = { file: null, summary: null } as unknown as TransferPreview;
    expect(forgePreparedImportForTests(preview)).toBe(preview);
  });

  it("مسح المصدر: نقطة السكّ الوحيدة في الإنتاج هي الموثقة داخل prepareImport، ولا شيء غيرها", () => {
    const mintSource = readFileSync(MINT_FILE, "utf8");
    const mintCount = FORGE_PATTERNS.reduce(
      (sum, { pattern }) => sum + (mintSource.match(pattern)?.length ?? 0),
      0,
    );
    expect(mintCount, "السكّ الموثق موجود مرة واحدة بالضبط داخل localTransferService.ts").toBe(1);

    const productionFiles = [
      ...new Set([...listProductionFiles(CLIENT_SRC_ROOT), ...listProductionFiles(DOMAIN_SRC_ROOT)]),
    ];
    expect(productionFiles.length).toBeGreaterThan(400);
    const offenders: string[] = [];
    for (const file of productionFiles) {
      if (file === MINT_FILE) continue;
      const source = readFileSync(file, "utf8");
      for (const { pattern, label } of FORGE_PATTERNS) {
        const hits = source.match(pattern);
        if (hits) offenders.push(`${path.relative(CLIENT_SRC_ROOT, file)} [${label} x${hits.length}]`);
      }
      if (source.includes("forgePreparedImportForTests"))
        offenders.push(`${path.relative(CLIENT_SRC_ROOT, file)} [forge-helper escaped to production]`);
    }
    expect(offenders, `مواقع سكّ غير مصرح بها في الإنتاج: ${offenders.join("; ")}`).toEqual([]);
  });
});
