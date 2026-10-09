/* W5-A (REM-005 — F-049 العائلة الجامدة + بند 1 من ميثاق الموجة ٥): حارس
 * اتجاه المال بين الطبقات. الواجهة (pages/components/app) لا تملك حساب المال —
 * المال يُشتق في المجال ويُقرأ من القارئات الكنسية، والواجهة تعرض وتستدعي.
 * الواقع اليوم يحوي سطحًا معروفًا من المرايا الحسابية (عائلة F-049 الموثقة
 * في التدقيق: معاينات ومجاميع عرض داخل TSX — إصلاحها عمل UI مؤجل خارج هذا
 * البرنامج)؛ هذا الحارس **يجمّد** السطح عند حجمه الموثق: أي موقع حساب مالي
 * جديد في الواجهة يفشل بالاسم، فلا تنمو العائلة بصمت بينما ينتظر إصلاحها
 * موجة UI مستقلة. والجزء الثاني يثبت أن كل قارئ كنوني له تعريف إنتاجي واحد —
 * لا نسخة منافسة للمعادلة (بند 2 من الميثاق). */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT_SRC = fileURLToPath(new URL("./", import.meta.url));

/* حساب المال في سطر واحد: معرف Minor مع عملية حسابية مباشرة (تخصيص أو
 * ثنائية)، أو تقريب Math على مال، أو تجميع reduce على مال. */
const BARE_ARITHMETIC = /[a-z]+Minor ?[+*/-]|[+*/-] ?[a-z]+Minor\b/;
const MATH_ROUNDING = /Math\.(round|floor|ceil|trunc)\([^)]*Minor/;
const MONEY_REDUCE = /\.reduce\(.*Minor/;

function listUiProductionFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const child = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      listUiProductionFiles(child, acc);
    } else if (/\.(tsx|ts)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      acc.push(child);
    }
  }
  return acc;
}

function moneyComputeLines(file: string): string[] {
  const source = readFileSync(file, "utf8");
  return source.split("\n").filter(line => {
    if (line.trim().startsWith("import ") || line.trim().startsWith("*")) return false;
    return BARE_ARITHMETIC.test(line) || MATH_ROUNDING.test(line) || MONEY_REDUCE.test(line);
  });
}

/* السطح المجمد عند إغلاق الموجة 5 (2026-09-29): عدد أسطر الحساب المالي لكل
 * ملف واجهة إنتاجي. عائلة F-049 — إصلاحها (إزالة المرايا لصالح اشتقاقات
 * المجال) عمل TSX/UI خلف بوابة موجة عرض مستقلة؛ حتى ذلك الحين لا ينمو
 * السطح ولا يتقلص بصمت (التقلص المتعمد يحدّث هذا الجدول بدليله). */
const FROZEN_SURFACE: Readonly<Record<string, number>> = {
  "pages/OrderDetail.tsx": 13,
  "components/orders/OrderDepositPanels.tsx": 7,
  "pages/SupplierPurchaseEditor.tsx": 5,
  "components/catalog/CatalogReadingsSection.tsx": 3,
  "pages/DirectSaleEditor.tsx": 2,
  "components/finance/QuickSaleForm.tsx": 2,
  "pages/OwnerEntitlement.tsx": 2,
  "pages/Statement.tsx": 1,
  "pages/OwnerWithdrawalEditor.tsx": 1,
  "pages/DeliveryReview.tsx": 1,
  "pages/Collect.tsx": 1,
  "pages/CashDistribution.tsx": 1,
  "pages/CashCount.tsx": 1,
  "pages/CashAdjustmentEditor.tsx": 1,
  "pages/AgreementEditor.tsx": 1,
  "pages/WalletLedger.tsx": 1,
  "components/finance/AllocationReviewCard.tsx": 1,
  "components/finance/CorrectionsLayer.tsx": 1,
};

describe("W5-A — تجميد سطح حساب المال في الواجهة (عائلة F-049 لا تنمو بصمت)", () => {
  it("every UI production money-computation site is accounted for — new sites fail by file", () => {
    const uiFiles = [
      ...listUiProductionFiles(join(CLIENT_SRC, "pages")),
      ...listUiProductionFiles(join(CLIENT_SRC, "components")),
      ...listUiProductionFiles(join(CLIENT_SRC, "app")),
    ];
    expect(uiFiles.length).toBeGreaterThan(120); /* حساسيّة المسح. */
    const observed: Record<string, number> = {};
    for (const file of uiFiles) {
      const relPath = relative(CLIENT_SRC, file).split(sep).join("/");
      const count = moneyComputeLines(file).length;
      if (count > 0) observed[relPath] = count;
    }
    const frozenTotal = Object.values(FROZEN_SURFACE).reduce((a, b) => a + b, 0);
    const observedTotal = Object.values(observed).reduce((a, b) => a + b, 0);
    expect(observedTotal).toBe(frozenTotal);
    expect(observed).toEqual(FROZEN_SURFACE);
  });
});

/* R7 (R6-F17 — تعديل المراجعة العدائية رقم 4، 2026-10-10): وحدات نموذج العرض
 * التطبيقية (view-model/query surfaces المستخرجة من الصفحات في R7) لا تملك
 * حساب المال إطلاقًا — عزل قراءات وتصنيف كتل فقط. هذا القسم يثبّت كل وحدة
 * عند صفر أسطر حساب مالي (بنمط القسم الأول نفسه) فلا تتحول أي منها صامتةً
 * إلى مستنقع مرايا جديد خارج أسرة F-049 المجمدة داخل الصفحات. تطبيق القائمة
 * = تعديل مقصود في نفس الـPR الذي يضيف وحدة عرض جديدة. */
const VIEW_MODEL_MODULES: readonly string[] = ["application/finance/financeState.ts"];

describe("R7 — وحدات نموذج العرض التطبيقية بلا حساب مال (صفر أسطر حساب)", () => {
  it("every registered view-model module has zero money-computation lines", () => {
    for (const rel of VIEW_MODEL_MODULES) {
      const file = join(CLIENT_SRC, rel);
      const lines = moneyComputeLines(file);
      expect(lines, `${rel}: ${lines.join(" | ")}`).toEqual([]);
    }
  });

  it("view-model modules exist on disk (stale pin fails loudly)", () => {
    for (const rel of VIEW_MODEL_MODULES) {
      expect(existsSync(join(CLIENT_SRC, rel)), rel).toBe(true);
    }
  });
});

describe("W5-A — المعادلة الواحدة: تعريف إنتاجي وحيد لكل قارئ كنوني (لا نسخة منافسة)", () => {
  function definitionFiles(dir: string, pattern: RegExp, root: string): string[] {
    const hits: string[] = [];
    for (const file of listUiProductionFiles(dir)) {
      const source = readFileSync(file, "utf8");
      if (pattern.test(source)) hits.push(relative(root, file).split(sep).join("/"));
    }
    return hits;
  }

  it("readRecordedPeriodResult and readPosition are defined exactly once (projectFinancialService)", () => {
    const app = join(CLIENT_SRC, "application");
    expect(definitionFiles(app, /async readRecordedPeriodResult\(/, CLIENT_SRC)).toEqual([
      "application/finance/projectFinancialService.ts",
    ]);
    expect(definitionFiles(app, /async readPosition\(/, CLIENT_SRC)).toEqual([
      "application/finance/projectFinancialService.ts",
    ]);
  });

  it("domain money bases (orderValueMinor, isRegisteredCustomerDebt) are defined exactly once", () => {
    const domain = fileURLToPath(new URL("../../../../src/domain", import.meta.url));
    expect(definitionFiles(domain, /export function orderValueMinor/, domain)).toEqual([
      "craft-order/policies.ts",
    ]);
    expect(definitionFiles(domain, /export function isRegisteredCustomerDebt/, domain)).toEqual([
      "craft-order/policies.ts",
    ]);
    /* والتطبيق لا يعرّف منافسًا لهما — الاستيراد فقط. */
    const app = join(CLIENT_SRC, "application");
    expect(definitionFiles(app, /function orderValueMinor/, CLIENT_SRC)).toEqual([]);
    expect(definitionFiles(app, /function isRegisteredCustomerDebt/, CLIENT_SRC)).toEqual([]);
  });
});
describe("R2 (M-10/D11) — تعداد ملكية نص المال المحفوظ: منسّق كنوني واحد لا ثاني له", () => {
  /* قاعدة التعداد (M-10): كل ملف إنتاجي يضمّن خرج `persistedMoneyTextMinor`
   * معروف بالاسم — كاتب محفوظ جديد بلا تمرير عبر المنسّق الكنوني يفشل هنا
   * بالاسم، فلا تنشأ صيغة محفوظة ثانية بصمت (علة D11 الأصلية). */
  function filesUsing(dir: string, pattern: RegExp, root: string): string[] {
    const hits: string[] = [];
    for (const file of listUiProductionFiles(dir)) {
      const source = readFileSync(file, "utf8");
      if (pattern.test(source)) hits.push(relative(root, file).split(sep).join("/"));
    }
    return hits.sort();
  }

  it("persistedMoneyTextMinor is defined exactly once and consumed only by the four known persisted-money writers", () => {
    const domain = fileURLToPath(new URL("../../../../src/domain", import.meta.url));
    expect(filesUsing(domain, /export function persistedMoneyTextMinor/, domain)).toEqual([
      "shared/currency.ts",
    ]);
    expect(filesUsing(domain, /persistedMoneyTextMinor\(/, domain)).toEqual([
      "craft-order/policies.ts",
      "shared/currency.ts",
    ]);
    const app = join(CLIENT_SRC, "application");
    expect(filesUsing(app, /persistedMoneyTextMinor\(/, CLIENT_SRC)).toEqual([
      "application/cash/cashCountMessages.ts",
      "application/fulfillment/deliveryReviewService.ts",
    ]);
  });

  it("the domain raw minor/100 embeds are frozen at the transient-message set — persisted notes left the raw convention", () => {
    /* بعد M-10: كل التضمينات الخام المتبقية في المجال رسائل رمي لحظية
     * (لا نص محفوظ) — الكاتبان المحفوظان (التصنيف/التصحيح) غادرا المجموعة.
     * الأعداد مطابقة (لا أسطر): سطر الرسالة الواحد قد يضمّن مبلغين.
     * أي نمو أو عودة تضمين خام يعني صيغة محفوظة ثانية — يفشل بالاسم. */
    const domain = fileURLToPath(new URL("../../../../src/domain", import.meta.url));
    const observed: Record<string, number> = {};
    for (const file of listUiProductionFiles(domain)) {
      const source = readFileSync(file, "utf8");
      const count = (source.match(/\/\s*100\s*\}\s*د\.أ/g) ?? []).length;
      if (count > 0) observed[relative(domain, file).split(sep).join("/")] = count;
    }
    /* الأعداد مطابقة (لا أسطر): سطر الرسالة الواحد قد يضمّن مبلغين
     * (المتبقي والمُدخل مثلًا). */
    expect(observed).toEqual({
      "craft-order/deliveryContribution.ts": 4,
      "craft-order/policies.ts": 3,
      "loan/policies.ts": 2,
      "received-loan/policies.ts": 2,
    });
  });

  it("no application-layer note/reason field embeds a raw money template — the raw convention is domain-thrown-only", () => {
    /* تعداد S5 (عدائي، 2026-10-08): القسم الخام كان يمسح المجال فقط — أي كاتب
     * محفوظ جديد في التطبيق بقسمة خام أو toFixed كان يمر. الآن يُمسح التطبيق:
     * صفر تضمين مال خام في حقول note/reason التطبيقية (الصيغة الخام مجالية
     * الرمي فقط). */
    const app = join(CLIENT_SRC, "application");
    const offenders: string[] = [];
    for (const file of listUiProductionFiles(app)) {
      const source = readFileSync(file, "utf8");
      for (const line of source.split("\n")) {
        if (/\b(note|reason)\s*:\s*.*(\/\s*100\s*}|\.toFixed\()/.test(line)) {
          offenders.push(`${relative(CLIENT_SRC, file).split(sep).join("/")}: ${line.trim().slice(0, 80)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the domain toFixed money-text embeds are frozen at the documented W2 reading-note set", () => {
    /* ملاحظات قراءة recurring-margin المجمدة بتوصيف W2 (قيد عدم توحيف مع
     * المنسّقات الكنونية): ثلاثة تضمينات بقالب ‎/100).toFixed‎ في ملف واحد —
     * مالان (295/299) ونسبة (301) — كلها نص قراءة لحظي لا يُحفظ. أي تضمين
     * toFixed مجالي جديد خارج هذه المجموعة يفشل بالاسم (صيغة مال ثالثة
     * غير معهدة). */
    const domain = fileURLToPath(new URL("../../../../src/domain", import.meta.url));
    const observed: Record<string, number> = {};
    for (const file of listUiProductionFiles(domain)) {
      const source = readFileSync(file, "utf8");
      const count = (source.match(/\/\s*100\s*\)\s*\.toFixed/g) ?? []).length;
      if (count > 0) observed[relative(domain, file).split(sep).join("/")] = count;
    }
    expect(observed).toEqual({ "recurring-margin/policies.ts": 3 });
  });

  it("no application persisted note/reason field is built with the display formatter", () => {
    /* منسّق العرض (Intl المجمِّع) عقد واجهات لحظي — لا يُكتب به سجل دائم. */
    const app = join(CLIENT_SRC, "application");
    for (const file of listUiProductionFiles(app)) {
      const source = readFileSync(file, "utf8");
      for (const line of source.split("\n")) {
        expect(line).not.toMatch(/\b(note|reason)\s*:\s*.*formatMoney(Minor|WithUnit)\(/);
      }
    }
  });
});
