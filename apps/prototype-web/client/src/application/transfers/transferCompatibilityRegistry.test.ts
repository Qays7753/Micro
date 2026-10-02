/**
 * Wave 4D (ARCH-002/WS-212 — بطاقة RC-8): اختبار سجل قيم التوافق التاريخي
 * ومصادر القبول الموحدة لمدققات النقل.
 *
 * الطبقات:
 *  1) قابلية تنفيذ السجل: كل صف توافقي مكتمل الحقول (قيم، جهة حالية، سبب،
 *     إصدارات، اختبارات مثبتة) — لا صف ناقص يمر.
 *  2) القيم التاريخية مقبولة فعلًا من مدققتها المقابلة، وطاقم قبول العائلة =
 *     الاتحاد الحالي ∪ السجل حصرًا (لا قيمة زائدة غير موثقة).
 *  3) تفويض القوائم التشغيلية المجالية حقيقي: مدققات المادة/البُعد تقبل قيم
 *     القائمة المجالية نفسها وترفض ما خارجها — المصدر واحد لا نسختين.
 *  4) طبقة الأنواع: tsc على ملف السجل زمن التشغيل — يفرض أن القيم التاريخية
 *     خارج الاتحاد الحالي (Exclude) وأن السجل كله يفحص نوعيًا (نمط مراسي
 *     Wave 3B؛ ملفات الاختبار مستثناة من فحص أنواع الـapp القياسي).
 *
 * لا يغيّر هذا الملف أي سلوك — يثبت أن توحيد المصدر (RC-8) حافظ على طواقم
 * القبول حرفيًا: الذهبيات (3A) وغارد الدريفت (3B) هما الـoracle الدائم.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { materialUnits } from "@micro-domain/inventory-material/index.js";
import { unitDimensions } from "@micro-domain/catalog/index.js";
import { isAgreementSource, isMaterialUnit, isUnitDimension } from "./transferFamilyValidators";
import { LEGACY_AGREEMENT_SOURCES, TRANSFER_HISTORICAL_COMPATIBILITY } from "./transferCompatibilityValues";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../../../");
const REGISTRY_FILE = path.join(HERE, "transferCompatibilityValues.ts");
const APP_TSCONFIG = path.join(REPO_ROOT, "apps", "prototype-web", "tsconfig.json");

/* الاتحاد الحالي لمصدر الاتفاق (storage/local/types.ts — AgreementSource):
 * مرآة اختبارية مثل مراسي الدريفت؛ الاتحاد النوعي هو المصدر، وهذه القائمة
 * تُستخدم هنا لإثبات أن طاقم القبول = الحالي ∪ التاريخي حصرًا. */
const CURRENT_AGREEMENT_SOURCES = ["instagram", "whatsapp", "referral", "walk_in", "other"] as const;

describe("Wave 4D — historical compatibility registry (executable layer)", () => {
  it("every registry row is complete: values, current authority, reason, versions, pinning tests", () => {
    expect(TRANSFER_HISTORICAL_COMPATIBILITY.length).toBeGreaterThan(0);
    for (const row of TRANSFER_HISTORICAL_COMPATIBILITY) {
      expect(row.values.length, `${row.family}: قيم توافقية فارغة؟`).toBeGreaterThan(0);
      expect(row.currentAuthority.length).toBeGreaterThan(0);
      expect(row.reason.length).toBeGreaterThan(0);
      expect(row.supportedVersions.length).toBeGreaterThan(0);
      expect(row.pinnedBy.length).toBeGreaterThan(0);
    }
  });

  it("legacy agreement sources are accepted by isAgreementSource (they must never break old files)", () => {
    for (const value of LEGACY_AGREEMENT_SOURCES) {
      expect(
        isAgreementSource(value),
        `قيمة توافقية تاريخية رُفضت: ${value} — هذا يكسر ملفات التصدير التاريخية`,
      ).toBe(true);
    }
  });

  it("agreement source acceptance = current union ∪ historical registry exactly (no undocumented extras)", () => {
    const accepted = new Set<string>([...CURRENT_AGREEMENT_SOURCES, ...LEGACY_AGREEMENT_SOURCES]);
    for (const value of accepted) expect(isAgreementSource(value)).toBe(true);
    expect(isAgreementSource(null)).toBe(true);
    /* لا قيمة خارج الطاقمين تُقبل — أي إضافة مستقبلية تحتاج صفًا في السجل. */
    for (const bad of [
      "tiktok",
      "Instagram",
      " instagram",
      "instagram ",
      "",
      "مكالمة",
      3,
      {},
      [],
      undefined,
    ]) {
      expect(isAgreementSource(bad), `قيمة غير موثقة قُبلت: ${JSON.stringify(bad)}`).toBe(false);
    }
  });

  it("the registry declares exactly the legacy values the acceptance set carries beyond the current union", () => {
    /* اكتمال الاتجاه الآخر: ما تقبله المدققة فوق الاتحاد الحالي = السجل حصرًا. */
    const registryValues = new Set<string>(LEGACY_AGREEMENT_SOURCES);
    const beyondCurrent = [...CURRENT_AGREEMENT_SOURCES, ...LEGACY_AGREEMENT_SOURCES].filter(
      value => !CURRENT_AGREEMENT_SOURCES.includes(value as (typeof CURRENT_AGREEMENT_SOURCES)[number]),
    );
    expect(beyondCurrent.length).toBe(registryValues.size);
    for (const value of beyondCurrent) expect(registryValues.has(value)).toBe(true);
    /* والسجل نفسه لا يتقاطع مع الاتحاد الحالي (الاتجاه النوعي أدناه). */
    for (const value of LEGACY_AGREEMENT_SOURCES) {
      expect(
        (CURRENT_AGREEMENT_SOURCES as readonly string[]).includes(value),
        `قيمة تاريخية دخلت الاتحاد الحالي؟ حدّث السجل: ${value}`,
      ).toBe(false);
    }
  });
});

describe("Wave 4D — domain runtime-list delegation is real (one source, not two)", () => {
  it("isMaterialUnit accepts exactly the domain materialUnits list", () => {
    for (const value of materialUnits) expect(isMaterialUnit(value)).toBe(true);
    for (const bad of ["gallon", "Piece", "meter ", 1, null, {}, undefined]) {
      expect(isMaterialUnit(bad), `قيمة خارج قائمة المجال قُبلت: ${JSON.stringify(bad)}`).toBe(false);
    }
  });

  it("isUnitDimension accepts exactly the domain unitDimensions list", () => {
    for (const value of unitDimensions) expect(isUnitDimension(value)).toBe(true);
    for (const bad of ["weight", "Count", "volume ", 2, null, {}, undefined]) {
      expect(isUnitDimension(bad), `قيمة خارج قائمة المجال قُبلت: ${JSON.stringify(bad)}`).toBe(false);
    }
  });
});

describe("Wave 4D — historical compatibility registry (type layer)", () => {
  it(
    "registry file typechecks: legacy values stay outside the current union (tsc enforced)",
    { timeout: 120_000 },
    () => {
      /* ملفات الاختبار مستثناة من فحص أنواع الـapp — لذا يُفرض هنا فحص ملف
       * السجل وحده بامتداد tsconfig الـapp نفسه (نمط مراسي Wave 3B). أي
       * تداخل مستقبلي بين القيم التاريخية والاتحاد الحالي، أو أي كسر في
       * أنواع السجل، يفشل هذا الفحص فورًا. */
      const tmp = mkdtempSync(path.join(tmpdir(), "micro-compat-"));
      try {
        const tmpConfig = path.join(tmp, "tsconfig.compat.json");
        writeFileSync(
          tmpConfig,
          JSON.stringify({
            extends: APP_TSCONFIG,
            include: [REGISTRY_FILE],
            exclude: [],
            compilerOptions: { types: [] },
          }),
          "utf8",
        );
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
            `سجل التوافق التاريخي كسر فحص الأنواع — راجع transferCompatibilityValues.ts:\n${
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
