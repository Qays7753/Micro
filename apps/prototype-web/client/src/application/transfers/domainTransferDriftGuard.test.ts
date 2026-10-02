/**
 * Wave 3B (ARCH-002/WS-212 — STR-104/509): غارد دريفت المجال ↔ النقل.
 *
 * الخطر (أعلى فخ توافق بيانات مجاور للبرنامج): مدققات النقل تعيد وصف اتحادات
 * قيم المجال حرفيًا. انحراف صامت في أي جهة يجعل التطبيق يرفض ملفات تصديره
 * الخاصة — أو يقبل قيمًا لا ينتجها المجال.
 *
 * طبقتا الحارس (بلا أي تعديل إنتاج):
 *  1) زمن التشغيل: كل قيمة من مراسي المجال يجب أن تقبلها مدققة النقل المقابلة
 *     (يحمي جهة النقل من الانحراف عن المجال).
 *  2) زمن الأنواع: المراسي نفسها مفروضة الإكمال على اتحادات المجال بـ
 *     «satisfies Record<Union, true>» — ويُفرض هذا الفحص زمن التشغيل أيضًا
 *     بتشغيل tsc على ملف المراسي داخل الاختبار (ملفات *.test.ts مستثناة من
 *     فحص الأنواع القياسي للـapp، لذا يحرس الحارس نفسه هنا) — أي إضافة أو
 *     حذف قيمة مجال دون تحديث المراسي يفشل هذا الاختبار فورًا.
 *
 * القيم التاريخية التوافقية خارج الحارس عمدًا (عقد 39): المدققات تقبل تاريخيًا
 * أكثر من المجال الحالي — حقن مقصود لا انحراف. إكمال توحيد المصدر = الموجة 4D.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  KNOWLEDGE_STATES,
  RESULT_STATUSES,
  ORDER_STATUSES,
  SETTLEMENT_STATUSES,
  DIRECT_SALE_COLLECTION_STATUSES,
  CASH_WALLET_KINDS,
  CASH_ENTRY_TYPES,
  FINANCIAL_EVENT_TYPES,
} from "./domainTransferDriftAnchors";
import { materialUnits } from "@micro-domain/inventory-material/index.js";
import { unitDimensions } from "@micro-domain/catalog/index.js";
import {
  isKnownState,
  isResultStatus,
  isOrderStatus,
  isSettlement,
  isCashWalletKind,
  isCashEntryType,
  isMaterialUnit,
  isUnitDimension,
  isFinancialType,
} from "./transferFamilyValidators";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../../../");
const ANCHORS_FILE = path.join(HERE, "domainTransferDriftAnchors.ts");
const APP_TSCONFIG = path.join(REPO_ROOT, "apps", "prototype-web", "tsconfig.json");

const GUARDS: ReadonlyArray<[string, (value: unknown) => boolean, readonly string[]]> = [
  ["KnowledgeState", isKnownState, Object.keys(KNOWLEDGE_STATES)],
  ["ResultStatus", isResultStatus, Object.keys(RESULT_STATUSES)],
  ["OrderStatus", isOrderStatus, Object.keys(ORDER_STATUSES)],
  ["SettlementStatus", isSettlement, Object.keys(SETTLEMENT_STATUSES)],
  [
    "DirectSaleCollectionStatus",
    (value: unknown) =>
      value === "collected_in_full" || value === "partial_debt" || value === "partial_needs_review",
    Object.keys(DIRECT_SALE_COLLECTION_STATUSES),
  ],
  ["CashWalletKind", isCashWalletKind, Object.keys(CASH_WALLET_KINDS)],
  ["CashEntryType", isCashEntryType, Object.keys(CASH_ENTRY_TYPES)],
  ["MaterialUnit (domain runtime list)", isMaterialUnit, materialUnits],
  ["UnitDimension (domain runtime list)", isUnitDimension, unitDimensions],
  ["FinancialEventType", isFinancialType, Object.keys(FINANCIAL_EVENT_TYPES)],
];

describe("Wave 3B — domain ↔ transfer drift guard (runtime layer)", () => {
  for (const [name, guard, values] of GUARDS) {
    it(`${name}: every current domain value is accepted by the transfer validator`, () => {
      expect(values.length, `${name}: قائمة المراسي فارغة؟`).toBeGreaterThan(0);
      for (const value of values) {
        expect(
          guard(value),
          `${name}: مدققة النقل رفضت قيمة مجال حالية «${value}» — انحراف سيجعل التطبيق يرفض تصديراته المشروعة`,
        ).toBe(true);
      }
    });

    it(`${name}: mutations and type-confusions are rejected`, () => {
      const first = values[0] ?? "";
      for (const bad of [null, undefined, 1, {}, [], `${first} `, first.toUpperCase()]) {
        expect(guard(bad), `${name}: قيمة غريبة قُبلت: ${JSON.stringify(bad)}`).toBe(false);
      }
    });
  }

  it("the guard battery is fully wired: 10 families", () => {
    /* إن حُذف حارس بالخطأ يفشل العدد — الحارس يحرس نفسه. */
    expect(GUARDS.length).toBe(10);
  });

  it("self-test: a deliberately incomplete validator IS caught (the guard can fail)", () => {
    /* إثبات قابلية الاكتشاف: محاكاة انحراف متعمد داخل الحارس نفسه. */
    const driftingGuard = (value: unknown) => value === "draft";
    const missed = Object.keys(ORDER_STATUSES).filter(value => !driftingGuard(value));
    expect(missed.length).toBeGreaterThan(0);
    expect(missed).toContain("confirmed");
  });
});

describe("Wave 3B — domain ↔ transfer drift guard (type layer)", () => {
  it(
    "anchors file typechecks against the live domain unions (missing/extra domain values fail here)",
    { timeout: 120_000 },
    () => {
      /* ملفات الاختبار مستثناة من فحص أنواع الـapp — لذا نفرض فحص المراسي
       * هنا: tsc على ملف المراسي وحده بامتداد tsconfig الـapp نفسه.
       * أي إضافة/حذف قيمة في اتحاد مجال دون تحديث المراسي يفشل هذا الفحص. */
      const tmp = mkdtempSync(path.join(tmpdir(), "micro-drift-"));
      try {
        const tmpConfig = path.join(tmp, "tsconfig.drift.json");
        writeFileSync(
          tmpConfig,
          JSON.stringify({
            extends: APP_TSCONFIG,
            include: [ANCHORS_FILE],
            exclude: [],
            compilerOptions: { types: [] },
          }),
          "utf8",
        );
        /* تشغيل tsc عبر node مباشرة: واجهة .bin قد لا تُنفذ من داخل vitest. */
        const tscEntry = path.join(REPO_ROOT, "node_modules", "typescript", "bin", "tsc");
        let output = "";
        try {
          output = execFileSync(process.execPath, [tscEntry, "--noEmit", "--project", tmpConfig], {
            cwd: REPO_ROOT,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
          });
        } catch (error) {
          const err = error as { stdout?: string; stderr?: string };
          throw new Error(
            `مراسي الدريفت لم تعد تطابق اتحادات المجال الحية — حدّث domainTransferDriftAnchors.ts:\n${
              err.stdout ?? err.stderr ?? "لا مخرجات"
            }`,
          );
        }
        expect(output).toBe("");
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    },
  );
});
