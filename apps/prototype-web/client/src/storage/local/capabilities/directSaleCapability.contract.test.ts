/**
 * R3 (بطاقة R3-SC-04): عقد قدرة «البيع المباشر». ثلاث طبقات إثبات، بلا أي تعديل إنتاج:
 * عضوية المحوّلين، السلوك عبر العدسة الضيقة (الذاكرة وIndexedDB/fake-indexeddb)،
 * ومراسي الأنواع زمن التشغيل (نمط Wave 3B/4C).
 */
import "fake-indexeddb/auto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createDirectSale, updateDirectSale } from "@micro-domain/direct-sale/index.js";
import { IndexedDbLocalStore } from "../IndexedDbLocalStore";
import { MemoryLocalStore } from "../MemoryLocalStore";
import { directSaleStoreMethods, type DirectSaleStore } from "./directSaleStore";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../../../../");
const ANCHORS_FILE = path.join(HERE, "directSaleCapabilityAnchors.ts");
const APP_TSCONFIG = path.join(REPO_ROOT, "apps", "prototype-web", "tsconfig.json");

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const TS = "2026-10-08T09:00:00.000Z";

function saleFixture(id: string, key: string) {
  return createDirectSale({
    id,
    itemName: "صينية ضيافة",
    quantity: 2,
    revenueMinor: 9_000,
    collectedMinor: 9_000,
    catalogItemId: null,
    customerName: null,
    costMinor: null,
    occurredOn: "2026-10-07",
    recordedAt: TS,
    note: "بيع نقدي مباشر",
    idempotencyKey: key,
  });
}
/** السيناريو يستقبل النوع الضيق حصرًا — عدسة مستهلك القدرة لا أوسع. */
async function runCapabilityScenario(store: DirectSaleStore) {
  /* ١) الحفظ الحتمي: مفتاح الحتمية يُفحص عند الكتابة فلا يُخزَّن بيعان
   *    بمفتاح واحد — الثاني يعيد الأول كما هو. */
  const sale = saleFixture("sale-cap-1", "op-sale-cap-1");
  const saved = await store.saveDirectSale(sale);
  expect(saved.ok && saved.value.id).toBe("sale-cap-1");
  const duplicateKey = saleFixture("sale-cap-1-dup", "op-sale-cap-1");
  const deduped = await store.saveDirectSale(duplicateKey);
  expect(deduped.ok && deduped.value.id).toBe("sale-cap-1");

  /* ٢) القراءة كما كُتبت. */
  const listed = await store.listDirectSales();
  expect(listed.ok && listed.value.map(s => s.id)).toEqual(["sale-cap-1"]);
  expect(listed.ok && listed.value[0]?.collectionStatus).toBe("collected_in_full");

  /* ٣) عكس التحصيل الموثق (EXE-010): البيع المعدل بدالة النطاق القائمة
   *    (updateDirectSale — مراجعة موثقة بسبب العكس) — المقبوض ينقص فيعود
   *    الدين بحالته الصادقة المشتقة؛ إعادة المفتاح تعيد النتيجة (reused
   *    صادقة) ولا يتكرر الأثر؛ وبلا كتابة نصفية. */
  const reversedSale = updateDirectSale(
    sale,
    {
      itemName: sale.itemName,
      quantity: sale.quantity,
      revenueMinor: sale.revenueMinor,
      collectedMinor: 0,
      collectionStatus: "partial_debt",
      catalogItemId: sale.catalogItemId,
      customerName: sale.customerName ?? undefined,
      costMinor: sale.costMinor,
      occurredOn: sale.occurredOn,
      note: sale.note,
    },
    {
      kind: "edit",
      idempotencyKey: "op-sale-cap-rev-1",
      createdAt: TS,
      reason: "عكس تحصيل: تصحيح قبض خاطئ",
    },
  );
  const reversal = await store.commitDirectSaleCollectionReversal(reversedSale, null, "op-sale-cap-rev-1");
  expect(reversal.ok).toBe(true);
  if (!reversal.ok) throw new Error(reversal.message);
  expect(reversal.value.sale.collectedMinor).toBe(0);
  const reversalReplay = await store.commitDirectSaleCollectionReversal(
    reversedSale,
    null,
    "op-sale-cap-rev-1",
  );
  expect(reversalReplay.ok && reversalReplay.value.reused).toBe(true);
  const afterReversal = await store.listDirectSales();
  expect(afterReversal.ok && afterReversal.value).toHaveLength(1);
  expect(afterReversal.ok && afterReversal.value[0]?.collectedMinor).toBe(0);
}
describe("R3 — قدرة البيع المباشر (بطاقة R3-SC-04): العضوية", () => {
  it("قائمة الطرق هي نطاق المجموعة بالضبط: 3 أسماء فريدة", () => {
    expect(directSaleStoreMethods).toHaveLength(3);
    expect(new Set(directSaleStoreMethods).size).toBe(3);
  });

  describe.each([
    ["MemoryLocalStore", () => new MemoryLocalStore()],
    ["IndexedDbLocalStore", () => new IndexedDbLocalStore()],
  ] as const)("%s يكشف كل طريقة قدرة كدالة", (_label, makeStore) => {
    it("العضوية كاملة", () => {
      const store = makeStore();
      for (const method of directSaleStoreMethods) {
        expect(typeof (store as unknown as DirectSaleStore)[method]).toBe("function");
      }
    });
  });
});

describe("R3 — قدرة البيع المباشر: العقود السلوكية عبر العدسة الضيقة", () => {
  afterEach(async () => {
    await clearDatabase();
  });

  it("الذاكرة: عقد القدرة كاملًا", async () => {
    await runCapabilityScenario(new MemoryLocalStore());
  });

  it("IndexedDB (fake-indexeddb): عقد القدرة نفسه", async () => {
    await clearDatabase();
    try {
      await runCapabilityScenario(new IndexedDbLocalStore());
    } finally {
      await clearDatabase();
    }
  });
});

describe("R3 — قدرة البيع المباشر: طبقة الأنواع", () => {
  it(
    "المحوّلان والواجهة التوافقية ما زالوا يحققون القدرة (tsc على ملف المراسي)",
    { timeout: 120_000 },
    () => {
      const tmp = mkdtempSync(path.join(tmpdir(), "micro-directSale-capability-"));
      try {
        const tmpConfig = path.join(tmp, "tsconfig.capability.json");
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
        const tscEntry = path.join(REPO_ROOT, "node_modules", "typescript", "bin", "tsc");
        execFileSync(process.execPath, [tscEntry, "--noEmit", "--project", tmpConfig], {
          cwd: REPO_ROOT,
          encoding: "utf-8",
          stdio: ["ignore", "pipe", "pipe"],
        });
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
      expect(true).toBe(true);
    },
  );
});
