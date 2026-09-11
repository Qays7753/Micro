/**
 * المجموعة ٦ (برنامج التحصين الكامل): اختبارات حدود الطبقات عبر محرك ESLint
 * نفسه (lintText فوق eslint.config.js الحقيقي بلا نسخ مزيفة) — حتمية بلا
 * شبكة ولا نوم ولا ملفات مؤقتة (المصادر المختبرة نصوص حرفية).
 *
 * تغطي: نقاء المجال (استيراد نسبي مسموح؛ React/حزمة خارجية/استيراد ديناميكي
 * ممنوع)، حدود المتصفح داخل المجال، بقاء حظر Math (D-02) وإعفاء shared
 * الموجود (إثبات أن تغييرات المجموعة ٦ لم تُضعف القاعدة القديمة)، استثناء
 * أداة اختبار المجال (vitest)، منع تخزين المتصفح من الصفحات/المكونات مع
 * الاستثناء الموثق لملفات اختبار الصفحات، وبقاء القواعد الموجودة قبل
 * المجموعة ٦ فعالة (React داخل application/storage، ومنع استيراد التخزين
 * من الصفحات مع سماح استيراد الأنواع).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { ESLint } from "eslint";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PAGE = "apps/prototype-web/client/src/pages/Fixture.tsx";
const PAGE_TEST = "apps/prototype-web/client/src/pages/Fixture.dom.test.tsx";
const COMPONENT = "apps/prototype-web/client/src/components/Fixture.tsx";
const APPLICATION = "apps/prototype-web/client/src/application/FixtureService.ts";

/** مسارات مطلقة تحت جذر المستودع كي يطابقها محرك التهيئة المسطحة كما في lint الحقيقي. */
function absolute(relative) {
  return path.join(ROOT, relative);
}

let eslint;
beforeAll(async () => {
  eslint = new ESLint({ cwd: ROOT });
});

/** يمرر النص على المحرك ويعيد رسائل القواعد (severity 2) مع ruleId فقط. */
async function ruleIdsFor(relativePath, code) {
  const [result] = await eslint.lintText(code, { filePath: absolute(relativePath) });
  return (result?.messages ?? []).filter((m) => m.severity === 2).map((m) => m.ruleId);
}

describe("layer boundary fixtures — domain purity (Group 6)", () => {
  it("allows relative domain imports and blocks react, external packages, and dynamic imports", async () => {
    const clean = await ruleIdsFor(
      "src/domain/fixture/policies.ts",
      'import type { Money } from "../shared/index.js";\nexport const x = 1;\n',
    );
    expect(clean).toEqual([]);
    const react = await ruleIdsFor(
      "src/domain/fixture/policies.ts",
      'import { useMemo } from "react";\nexport const x = useMemo;\n',
    );
    expect(react).toContain("no-restricted-syntax");
    const external = await ruleIdsFor(
      "src/domain/fixture/policies.ts",
      'import lodash from "lodash-es";\nexport const x = lodash;\n',
    );
    expect(external).toContain("no-restricted-syntax");
    const dynamic = await ruleIdsFor(
      "src/domain/fixture/policies.ts",
      'export async function load() {\n  return import("lodash-es");\n}\n',
    );
    expect(dynamic).toContain("no-restricted-syntax");
  });

  it("blocks browser globals inside domain source", async () => {
    const windowHit = await ruleIdsFor(
      "src/domain/fixture/policies.ts",
      'export const w = window.innerWidth;\n',
    );
    expect(windowHit).toContain("no-restricted-globals");
    const storageHit = await ruleIdsFor(
      "src/domain/fixture/policies.ts",
      'export const v = localStorage.getItem("k");\n',
    );
    expect(storageHit).toContain("no-restricted-globals");
  });

  it("keeps the D-02 Math ban active while preserving the shared exemption (no weakening by Group 6)", async () => {
    const domain = await ruleIdsFor(
      "src/domain/fixture/policies.ts",
      "export const r = Math.round(1.5);\n",
    );
    expect(domain).toContain("no-restricted-syntax");
    const shared = await ruleIdsFor(
      "src/domain/shared/fixtureHelpers.ts",
      "export const r = Math.round(1.5);\n",
    );
    expect(shared).toEqual([]);
  });

  it("allows the vitest harness import in domain tests (documented test-only exception)", async () => {
    const ids = await ruleIdsFor(
      "src/domain/fixture/policies.test.ts",
      'import { describe, expect, it } from "vitest";\ndescribe("x", () => {\n  it("y", () => expect(1).toBe(1));\n});\n',
    );
    expect(ids).toEqual([]);
  });
});

describe("layer boundary fixtures — pages/components storage boundary (Group 6)", () => {
  it("blocks window.localStorage, globalThis.localStorage, and the bare global in production pages", async () => {
    const viaWindow = await ruleIdsFor(
      PAGE,
      'export function read() {\n  return window.localStorage.getItem("k");\n}\n',
    );
    expect(viaWindow).toContain("no-restricted-syntax");
    const viaGlobalThis = await ruleIdsFor(
      COMPONENT,
      'export function read() {\n  return globalThis.localStorage.getItem("k");\n}\n',
    );
    expect(viaGlobalThis).toContain("no-restricted-syntax");
    const bare = await ruleIdsFor(PAGE, 'export function read() {\n  return localStorage.getItem("k");\n}\n');
    expect(bare).toContain("no-restricted-globals");
  });

  it("keeps the documented exception for page/component test harnesses (production boundary untouched)", async () => {
    const ids = await ruleIdsFor(
      PAGE_TEST,
      'import { it } from "vitest";\nit("seeds storage", () => {\n  window.localStorage.setItem("k", "v");\n});\n',
    );
    expect(ids).toEqual([]);
  });
});

describe("layer boundary fixtures — pre-existing rules stay active (Group 6 must not weaken them)", () => {
  it("still bans React imports in application and storage layers", async () => {
    const appHit = await ruleIdsFor(
      APPLICATION,
      'import { useMemo } from "react";\nexport const x = useMemo;\n',
    );
    expect(appHit).toContain("no-restricted-imports");
    const storageHit = await ruleIdsFor(
      "apps/prototype-web/client/src/storage/local/FixtureStore.ts",
      'import { useMemo } from "react";\nexport const x = useMemo;\n',
    );
    expect(storageHit).toContain("no-restricted-imports");
  });

  it("still bans value imports of the storage layer from pages while allowing type imports", async () => {
    const valueHit = await ruleIdsFor(
      PAGE,
      'import { localSchemaVersion } from "@/storage/local/types";\nexport const v = localSchemaVersion;\n',
    );
    expect(valueHit).toContain("no-restricted-imports");
    const typeOnly = await ruleIdsFor(
      PAGE,
      'import type { StorageResult } from "@/storage/local/types";\nexport type R = StorageResult<number>;\n',
    );
    expect(typeOnly).toEqual([]);
  });
});

/* المجموعة ٨ (المعالجة الرباعية — STR-005): طبقة التطبيق لا تعتمد على
 * الواجهة إطلاقًا — لا قيمًا ولا أنواعًا من @/components أو @/pages؛
 * النوع الذي يحتاجه التطبيق يملكه التطبيق (نقل MaterialSuggestion). */
describe("layer boundary fixtures — application must not depend on UI (Group 8, STR-005)", () => {
  it("blocks component/page imports from application files - value AND type-only", async () => {
    const valueHit = await ruleIdsFor(
      APPLICATION,
      'import { MaterialSheet } from "@/components/cost/MaterialSheet";\nexport const x = MaterialSheet;\n',
    );
    expect(valueHit).toContain("no-restricted-imports");
    const typeHit = await ruleIdsFor(
      APPLICATION,
      'import type { MaterialSuggestion } from "@/components/cost/MaterialSheet";\nexport type S = MaterialSuggestion;\n',
    );
    expect(typeHit).toContain("no-restricted-imports");
    const pageHit = await ruleIdsFor(
      APPLICATION,
      'import type { CostCalculatorHandle } from "@/pages/CostCalculator";\nexport type H = CostCalculatorHandle;\n',
    );
    expect(pageHit).toContain("no-restricted-imports");
    const storageTypeHit = await ruleIdsFor(
      "apps/prototype-web/client/src/storage/local/FixtureStore.ts",
      'import type { MaterialSuggestion } from "@/pages/CostCalculator";\nexport type S = MaterialSuggestion;\n',
    );
    expect(storageTypeHit).toContain("no-restricted-imports");
  });

  it("keeps legitimate application imports passing (application/domain/presentation) and the moved type clean", async () => {
    const legitimate = await ruleIdsFor(
      APPLICATION,
      'import type { InventoryOverview } from "@/application/inventory/inventoryMaterialService";\nimport type { InventoryMovement } from "@micro-domain/inventory-material/index.js";\nexport type O = InventoryOverview & { m: InventoryMovement };\n',
    );
    expect(legitimate).toEqual([]);
    /* الملف الحقيقي بعد نقل النوع يجب أن يمر نظيفًا على المحرك نفسه — البرهان
     * أن الحارس لا يمنع المسار القانوني الذي أنشئ له. */
    const realSource = await eslint.lintText(
      (await import("node:fs")).readFileSync(
        path.join(ROOT, "apps/prototype-web/client/src/application/inventory/materialSuggestions.ts"),
        "utf8",
      ),
      { filePath: path.join(ROOT, "apps/prototype-web/client/src/application/inventory/materialSuggestions.ts") },
    );
    expect((realSource[0]?.messages ?? []).filter((m) => m.severity === 2)).toEqual([]);
  });
});
