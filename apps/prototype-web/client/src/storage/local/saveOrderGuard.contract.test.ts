/* F-053 (REM-004 — W4-F): الحارس الاستاتيكي لـsaveOrder. الكتابة الخام
 * (آخر كاتب يفوز) للإنشاء والبذور فقط — عقد G-003/أنواع التخزين يوثق ذلك،
 * والدليل الحي: صفر مستدعين إنتاجيين اليوم (كل تحديثات الطلب القائمة تمر
 * على commitOrderUpdate المحروس). هذا الفحص يمنع عودة المستدعين بصمت:
 * أي ملف إنتاج (غير اختبار) خارج طبقة التخزين يستدعي .saveOrder( يفشل
 * البناء بالاسم. ملفات الاختبارات والبذور معفاة عمدًا (البذور والتوثيق
 * الكامل في عقد 40 §حدود الملكية الفنية). */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

function listProductionSources(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      listProductionSources(child, acc);
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.test\.(ts|tsx)$/.test(entry.name) &&
      !/\.dom\.test\.tsx$/.test(entry.name)
    ) {
      acc.push(child);
    }
  }
  return acc;
}

describe("F-053 — حارس saveOrder الاستاتيكي (لا مستدعين إنتاجيين خارج التخزين)", () => {
  it("no production source outside the storage layer calls .saveOrder(", () => {
    const clientSrc = fileURLToPath(new URL("../../", import.meta.url));
    const files = listProductionSources(clientSrc);
    expect(files.length).toBeGreaterThan(
      200,
    ); /* حساسيّة المسح: نطاق client/src كامل (259 ملف إنتاج وقت الكتابة). */
    const offenders: string[] = [];
    for (const file of files) {
      const relPath = relative(clientSrc, file);
      if (relPath.startsWith("storage")) continue; /* المحولات نفسها + عقد الطبقة. */
      const source = readFileSync(file, "utf8");
      if (source.includes(".saveOrder(")) offenders.push(relPath);
    }
    expect(offenders).toEqual([]);
  });
});
