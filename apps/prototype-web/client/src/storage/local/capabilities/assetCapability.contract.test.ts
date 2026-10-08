/**
 * R3 (بطاقة R3-SC-05): عقد قدرة «الأصول». ثلاث طبقات إثبات، بلا أي تعديل إنتاج:
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
import { createFinancialEvent, createFinancialReversal } from "@micro-domain/financial-event/index.js";
import type { AssetRecord } from "@micro-domain/asset/index.js";
import { IndexedDbLocalStore } from "../IndexedDbLocalStore";
import { MemoryLocalStore } from "../MemoryLocalStore";
import { assetStoreMethods, type AssetStore } from "./assetStore";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../../../../");
const ANCHORS_FILE = path.join(HERE, "assetCapabilityAnchors.ts");
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

function assetFixture(id: string, operationKey: string): AssetRecord {
  return Object.freeze({
    id,
    name: "خلاط صناعي",
    categoryLabel: "معدات",
    acquisitionAmountMinor: 450_000,
    acquisitionKind: "cash",
    purchaseDate: "2026-10-01",
    lifeMonths: 60,
    depreciationStartOn: "2026-10-01",
    residualValueMinor: null,
    note: null,
    status: "active",
    acquisitionEventId: `fin-asset-${id}`,
    disposal: null,
    writeOff: null,
    contractRevisions: [],
    operationKey,
    createdAt: TS,
    updatedAt: TS,
  });
}

function purchaseEvent(id: string, key: string) {
  return createFinancialEvent({
    id,
    type: "asset_purchase_cash",
    amountMinor: 450_000,
    occurredOn: "2026-10-01",
    recordedAt: TS,
    idempotencyKey: key,
    note: "شراء خلاط نقديًا",
    counterparty: null,
    assetContext: { assetId: id.replace("fin-", ""), name: "خلاط صناعي" },
  });
}
/** السيناريو يستقبل النوع الضيق حصرًا — عدسة مستهلك القدرة لا أوسع. */
async function runCapabilityScenario(store: AssetStore) {
  /* ١) الالتزام الحتمي: السجل والحدث معًا؛ إعادة المفتاح إعادة استخدام
   *    صادقة (reused) لا تكرار للأثر. */
  const event = purchaseEvent("fin-asset-cap-1", "op-asset-cap-1");
  const committed = await store.commitAssetRecord(assetFixture("asset-cap-1", "op-asset-cap-1"), event);
  expect(committed.ok).toBe(true);
  if (!committed.ok) throw new Error(committed.message);
  expect(committed.value.reused).toBe(false);
  const replayed = await store.commitAssetRecord(assetFixture("asset-cap-1", "op-asset-cap-1"), event);
  expect(replayed.ok && replayed.value.reused).toBe(true);

  /* ٢) القراءة كما كُتبت: القائمة والمفردة، والمفقود null. */
  const listed = await store.listAssets();
  expect(listed.ok && listed.value.map(asset => asset.id)).toEqual(["asset-cap-1"]);
  const single = await store.getAsset("asset-cap-1");
  expect(single.ok && single.value?.acquisitionAmountMinor).toBe(450_000);
  const missing = await store.getAsset("asset-cap-none");
  expect(missing.ok && missing.value).toBeNull();

  /* ٣) تصحيح الاقتناء الذرّي: التراجع والبديل والسجل المحدّث معًا — وإعادة
   *    الإرسال إعادة استخدام صادقة. */
  const sourceEvent = purchaseEvent("fin-asset-cap-1", "op-asset-cap-1");
  const reversal = createFinancialReversal({
    id: "fin-asset-cap-1-rev",
    idempotencyKey: "op-asset-cap-rev",
    reason: "خطأ في مبلغ الاقتناء",
    occurredOn: "2026-10-08",
    recordedAt: TS,
    sourceEvent,
  });
  const replacement = purchaseEvent("fin-asset-cap-1-new", "op-asset-cap-1-new");
  const correctedRecord = {
    ...assetFixture("asset-cap-1", "op-asset-cap-corr"),
    acquisitionAmountMinor: 400_000,
    acquisitionEventId: "fin-asset-cap-1-new",
  };
  const corrected = await store.commitAssetAcquisitionCorrection(correctedRecord, reversal, replacement);
  expect(corrected.ok).toBe(true);
  if (!corrected.ok) throw new Error(corrected.message);
  expect(corrected.value.reused).toBe(false);
  const afterCorrection = await store.getAsset("asset-cap-1");
  expect(afterCorrection.ok && afterCorrection.value?.acquisitionAmountMinor).toBe(400_000);
}
describe("R3 — قدرة الأصول (بطاقة R3-SC-05): العضوية", () => {
  it("قائمة الطرق هي نطاق المجموعة بالضبط: 4 أسماء فريدة", () => {
    expect(assetStoreMethods).toHaveLength(4);
    expect(new Set(assetStoreMethods).size).toBe(4);
  });

  describe.each([
    ["MemoryLocalStore", () => new MemoryLocalStore()],
    ["IndexedDbLocalStore", () => new IndexedDbLocalStore()],
  ] as const)("%s يكشف كل طريقة قدرة كدالة", (_label, makeStore) => {
    it("العضوية كاملة", () => {
      const store = makeStore();
      for (const method of assetStoreMethods) {
        expect(typeof (store as unknown as AssetStore)[method]).toBe("function");
      }
    });
  });
});

describe("R3 — قدرة الأصول: العقود السلوكية عبر العدسة الضيقة", () => {
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

describe("R3 — قدرة الأصول: طبقة الأنواع", () => {
  it(
    "المحوّلان والواجهة التوافقية ما زالوا يحققون القدرة (tsc على ملف المراسي)",
    { timeout: 120_000 },
    () => {
      const tmp = mkdtempSync(path.join(tmpdir(), "micro-asset-capability-"));
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
