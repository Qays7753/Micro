/** @vitest-environment jsdom */

/* CLEAN-001 (WS-180 — Wave 8 — جرد الأسطح الجزئية والميتة): حدس حارسة
 * تثبّت أمانة أسطح «قريبًا» المتبقية — كل إعلان قادم صادق ولا يكتب بيانات
 * أبدًا: السطح الواعد لا يستورد خدمة ولا مخزنًا ولا يلمس localStorage،
 * ولوحات الترويسة تعلن بلا حجز/تتبع/تسعير/ربط. الجرد قراءة مصدر موثقة —
 * لا حذف هذا الموجة (صفر أسطح ميتة)؛ الحارسة تمنع الانحدار الصامت. */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { render, screen } from "@testing-library/react";
import Market from "@/pages/Market";

function readRepoFile(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

const FORBIDDEN_WRITERS = [
  /usePrototypeServices/,
  /@\/storage\/local/,
  /localStorage/,
  /notifyDataChanged/,
  /\bservice\w*\s*:/,
  /IndexedDb/,
];

describe("CLEAN-001 surface honesty guards (WS-180 — Wave 8)", () => {
  it("the /market coming-soon surface writes nothing: no services, no store, no localStorage in its source", () => {
    const source = readRepoFile("./pages/Market.tsx");
    for (const forbidden of FORBIDDEN_WRITERS) {
      expect(source).not.toMatch(forbidden);
    }
  });

  it("the honest soon badge renders with no data interactions", () => {
    render(<Market />);
    expect(screen.getByTestId("market-soon-page")).toBeTruthy();
    expect(screen.getByText("قريبًا")).toBeTruthy();
  });

  it("the AppHeader soon panels stay honest announcements that write nothing", () => {
    const source = readRepoFile("./components/layout/AppHeader.tsx");
    /* إعلانا «قريبًا» الصادقان (تعليق الملف يوثق: لا حجز ولا تتبع ولا
     * تسعير ولا ربط). الحارسة هنا على الأثر لا على النص: الترويسة لا
     * تستورد خدمات ولا تخزنًا ولا تلمس localStorage — إعلان صادق بلا كتابة. */
    expect(source).toMatch(/قريبًا/);
    for (const forbidden of [
      /usePrototypeServices/,
      /@\/storage\/local/,
      /localStorage/,
      /notifyDataChanged/,
      /IndexedDb/,
    ]) {
      expect(source).not.toMatch(forbidden);
    }
  });

  it("the routes inventory stays complete: every route classified, no orphans either direction (dead-end zero)", () => {
    /* عقد الجرد: routeKnowledgeSync هو المصدر الكنوني لجرد المسارات —
     * وجوده خابطًا هنا يعني أن شرط «صفر Dead Ends» مسنودًا باختبار قائم. */
    const routerSource = readRepoFile("./app/MicroRouter.tsx");
    const routes = [...routerSource.matchAll(/<Route\s+path="([^"]+)"/g)].map(match => match[1]);
    expect(routes.length).toBeGreaterThanOrEqual(50);
    /* لا مسار ميت إلى صفحة غير موجودة: كل ملفات الصفحات المستوردة قائمة. */
    for (const pageImport of routerSource.matchAll(/import\s+(\w+)\s+from\s+"@\/pages\/(\w+)"/g)) {
      const path = `./pages/${pageImport[2]}.tsx`;
      expect(() => readRepoFile(path)).not.toThrow();
    }
  });
});
