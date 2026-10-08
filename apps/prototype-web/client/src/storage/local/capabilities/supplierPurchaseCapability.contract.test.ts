/**
 * R3 (بطاقة R3-SC-03): عقد قدرة «مشتريات المورّد». ثلاث طبقات إثبات، بلا أي تعديل إنتاج:
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
import {
  createSupplierPurchase,
  recordSupplierPurchasePayment,
} from "@micro-domain/supplier-purchase/index.js";
import type { SupplierPurchaseCommit } from "../supplierScheduleCommitGuard";
import { IndexedDbLocalStore } from "../IndexedDbLocalStore";
import { MemoryLocalStore } from "../MemoryLocalStore";
import { supplierPurchaseStoreMethods, type SupplierPurchaseStore } from "./supplierPurchaseStore";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../../../../");
const ANCHORS_FILE = path.join(HERE, "supplierPurchaseCapabilityAnchors.ts");
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

function purchaseFixture(id: string, key: string) {
  return createSupplierPurchase({
    id,
    supplierName: "مؤسسة النسيج",
    note: "شراء قماش",
    purchasedOn: "2026-10-07",
    dueOn: null,
    totalMinor: 10_000,
    initialPaidMinor: 2_000,
    recordedAt: TS,
    idempotencyKey: key,
    materialId: null,
    expectedQuantityMilli: null,
  });
}
/** السيناريو يستقبل النوع الضيق حصرًا — عدسة مستهلك القدرة لا أوسع. */
async function runCapabilityScenario(store: SupplierPurchaseStore) {
  /* ١) الالتزام المحرس (HIGH-001): الإنشاء كتابة أولى، وإعادته بالمفتاح
   *    نفسه إعادة استخدام صادقة لا كتابة ثانية. */
  const created = await store.commitSupplierPurchase({
    kind: "create",
    purchase: purchaseFixture("sup-cap-1", "op-sup-cap-create-1"),
    idempotencyKey: "op-sup-cap-create-1",
  });
  expect(created.ok).toBe(true);
  if (!created.ok) throw new Error(created.message);
  expect(created.value.reused).toBe(false);
  const replayed = await store.commitSupplierPurchase({
    kind: "create",
    purchase: purchaseFixture("sup-cap-1", "op-sup-cap-create-1"),
    idempotencyKey: "op-sup-cap-create-1",
  });
  expect(replayed.ok && replayed.value.reused).toBe(true);

  /* ٢) القراءة كما كُتبت: القائمة والمفردة، والمفقود null. */
  const listed = await store.listSupplierPurchases();
  expect(listed.ok && listed.value.map(purchase => purchase.id)).toEqual(["sup-cap-1"]);
  const single = await store.getSupplierPurchase("sup-cap-1");
  expect(single.ok && single.value?.totalMinor).toBe(10_000);
  const missing = await store.getSupplierPurchase("sup-cap-none");
  expect(missing.ok && missing.value).toBeNull();

  /* ٣) دفعة عبر الالتزام المحرس: العلاقة «عملية مجال واحدة بالضبط». */
  const withPayment = recordSupplierPurchasePayment(purchaseFixture("sup-cap-1", "op-sup-cap-create-1"), {
    id: "payment-sup-cap-2",
    amountMinor: 1_500,
    occurredOn: "2026-10-08",
    recordedAt: TS,
    idempotencyKey: "op-sup-cap-pay-2",
    note: "دفعة نقدية",
  });
  const payment: SupplierPurchaseCommit = {
    kind: "payment",
    purchase: withPayment,
    idempotencyKey: "op-sup-cap-pay-2",
  };
  const paid = await store.commitSupplierPurchase(payment);
  expect(paid.ok).toBe(true);
  if (!paid.ok) throw new Error(paid.message);
  const paidReplay = await store.commitSupplierPurchase(payment);
  expect(paidReplay.ok && paidReplay.value.reused).toBe(true);
  /* الدفعة الافتتاحية (initialPaidMinor 2000) سجلٌّ في payments من الإنشاء —
   * فدفعتنا الثانية ترتفع به إلى اثنين لا واحد. */
  const afterPayment = await store.getSupplierPurchase("sup-cap-1");
  expect(afterPayment.ok && afterPayment.value?.payments).toHaveLength(2);

  /* ٤) الارتباط مع شفاء الإسناد (G-002): الدفعة وقيد التخصيص معًا أو لا
   *    شيء — هنا بلا محفظة (attribution null) فيبقى العقد هيوية النتيجة. */
  const attributed = await store.commitSupplierPurchaseWithAttribution(payment, null);
  expect(attributed.ok).toBe(true);
  if (!attributed.ok) throw new Error(attributed.message);
  expect(attributed.value.attributionEntry).toBeNull();
  expect(attributed.value.purchase.payments).toHaveLength(2);

  /* ٥) الحفظ المباشر (سطح الدعم): نفس عقد الحتمية بالمفتاح. */
  const direct = await store.saveSupplierPurchase(purchaseFixture("sup-cap-direct", "op-sup-cap-direct"));
  expect(direct.ok && direct.value.id).toBe("sup-cap-direct");
}
describe("R3 — قدرة مشتريات المورّد (بطاقة R3-SC-03): العضوية", () => {
  it("قائمة الطرق هي نطاق المجموعة بالضبط: 5 أسماء فريدة", () => {
    expect(supplierPurchaseStoreMethods).toHaveLength(5);
    expect(new Set(supplierPurchaseStoreMethods).size).toBe(5);
  });

  describe.each([
    ["MemoryLocalStore", () => new MemoryLocalStore()],
    ["IndexedDbLocalStore", () => new IndexedDbLocalStore()],
  ] as const)("%s يكشف كل طريقة قدرة كدالة", (_label, makeStore) => {
    it("العضوية كاملة", () => {
      const store = makeStore();
      for (const method of supplierPurchaseStoreMethods) {
        expect(typeof (store as unknown as SupplierPurchaseStore)[method]).toBe("function");
      }
    });
  });
});

describe("R3 — قدرة مشتريات المورّد: العقود السلوكية عبر العدسة الضيقة", () => {
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

describe("R3 — قدرة مشتريات المورّد: طبقة الأنواع", () => {
  it(
    "المحوّلان والواجهة التوافقية ما زالوا يحققون القدرة (tsc على ملف المراسي)",
    { timeout: 120_000 },
    () => {
      const tmp = mkdtempSync(path.join(tmpdir(), "micro-supplierPurchase-capability-"));
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
