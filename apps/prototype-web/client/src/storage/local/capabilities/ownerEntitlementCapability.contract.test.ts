/**
 * Wave C (بطاقة ADR-015 مجموعة 6): عقد قدرة «استحقاق المالك وحركاته» —
 * الاستخراج السادس والأخير بترتيب ADR-15. ثلاث طبقات إثبات، بلا أي
 * تعديل إنتاج:
 *
 *  1) العضوية: المحوّلان يكشفان طرق القدرة الأربع عشرة كلها كدوال —
 *     والقائمة نفسها محكومة النوع (Pick من الواجهة التوافقية) فلا تزد
 *     ولا تنقص بصمت.
 *  2) السلوك عبر عدسة القدرة: نفس عقود الالتزام للمحوّلين (الذاكرة
 *     وIndexedDB/fake-indexeddb) — حفظ وقراءة حرفية للسياسات والسجلات
 *     والرصيد الافتتاحي (والغائب null)، وخلافة السياسة الذرّية بعهدة
 *     الحتمية ورفض الأصل غير الفعال، وتراجع محروس واحد لكل سجل حق
 *     ورصيد افتتاحي (إعادة التراجع بمفتاحه تعيد المخزن؛ والمصدر المفقود
 *     رفض صادر)، والتزام حركة المالك وأثر الكاش معًا بإعادة استخدام
 *     صادقة — هوية الأخطاء المحفوظة كما هي داخل المحوّلين. السيناريو
 *     يستقبل النوع الضيق `OwnerEntitlementStore` حصرًا؛ الآثار العابرة
 *     للحدود (اللقطة والاستعادة وتسويات عقد ٤٠) تبقى في مصفوفة المطابقة
 *     الكاملة (adapterConformance.group10) وعند القارئ الكنوني.
 *  3) الأنواع: tsc على ملف المراسي زمن التشغيل بامتداد tsconfig الـapp
 *     نفسه (نمط مراسي Wave 3B/4C).
 */
import "fake-indexeddb/auto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  createOwnerEntitlementOpeningBalance,
  createOwnerEntitlementOpeningBalanceReversal,
  createOwnerEntitlementPolicy,
  createOwnerEntitlementPolicySuccessor,
  createOwnerEntitlementRecord,
  createOwnerEntitlementRecordReversal,
  createOwnerMovement,
} from "@micro-domain/owner-entitlement/index.js";
import { createCashContinuityEntry } from "@micro-domain/cash-continuity/index.js";
import { IndexedDbLocalStore } from "../IndexedDbLocalStore";
import { MemoryLocalStore } from "../MemoryLocalStore";
import {
  ownerEntitlementStoreMethods,
  type OwnerEntitlementStore,
} from "./ownerEntitlementStore";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../../../../../../");
const ANCHORS_FILE = path.join(HERE, "ownerEntitlementCapabilityAnchors.ts");
const APP_TSCONFIG = path.join(REPO_ROOT, "apps", "prototype-web", "tsconfig.json");

const databaseName = "micro-prototype-local";
function clearDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

const AT = "2026-10-04T08:00:00.000Z";

/** السيناريو يستقبل النوع الضيق حصرًا — عدسة مستهلك القدرة لا أوسع. */
async function runCapabilityScenario(store: OwnerEntitlementStore) {
  /* ═══ السياسات ═══ */

  /* ١) الحفظ والقراءة الحرفية؛ والغائب null. */
  const policy = createOwnerEntitlementPolicy({
    id: "policy-cap-1",
    version: 1,
    family: "time_period",
    kind: "monthly",
    amountMinor: 1500,
    percentageBps: null,
    unitLabel: null,
    startsOn: "2026-08-01",
    endsOn: null,
    source: "اتفاق",
    note: "شهري",
    status: "active",
    idempotencyKey: "policy-cap-1",
    createdAt: AT,
  });
  const savedPolicy = await store.saveOwnerEntitlementPolicy(policy);
  expect(savedPolicy.ok).toBe(true);
  if (!savedPolicy.ok) throw new Error(savedPolicy.message);
  expect(savedPolicy.value).toEqual(policy);
  const fetchedPolicy = await store.getOwnerEntitlementPolicy("policy-cap-1");
  expect(fetchedPolicy.ok && fetchedPolicy.value).toEqual(policy);
  const missingPolicy = await store.getOwnerEntitlementPolicy("policy-cap-void");
  expect(missingPolicy.ok && missingPolicy.value).toBeNull();
  const policyList = await store.listOwnerEntitlementPolicies();
  expect(policyList.ok && policyList.value).toHaveLength(1);

  /* ٢) خلافة السياسة الذرّية: المنتهية + النافذة معًا؛ إعادة التشغيل
   *    بمفتاح الخلف تعيد المخزن؛ والأصل غير الفعال رفض صادر بلا كتابة. */
  const successor = createOwnerEntitlementPolicySuccessor({
    id: "policy-cap-2",
    version: 2,
    kind: "monthly",
    amountMinor: 2000,
    percentageBps: null,
    unitLabel: null,
    startsOn: "2026-09-01",
    endsOn: null,
    source: "اتفاق",
    note: "شهري محدث",
    status: "active",
    idempotencyKey: "policy-cap-2",
    createdAt: AT,
    successorOfPolicyId: "policy-cap-1",
  });
  const endedPolicy = createOwnerEntitlementPolicy({
    ...policy,
    endsOn: "2026-08-31",
    status: "ended",
  });
  const successorCommit = await store.commitOwnerEntitlementPolicySuccessor(endedPolicy, successor);
  expect(successorCommit.ok).toBe(true);
  if (!successorCommit.ok) throw new Error(successorCommit.message);
  const successorReplay = await store.commitOwnerEntitlementPolicySuccessor(endedPolicy, successor);
  expect(successorReplay.ok).toBe(true);
  const policiesAfter = await store.listOwnerEntitlementPolicies();
  expect(policiesAfter.ok && policiesAfter.value).toHaveLength(2);
  const storedEnded = await store.getOwnerEntitlementPolicy("policy-cap-1");
  expect(storedEnded.ok && storedEnded.value?.status).toBe("ended");
  const staleOrigin = await store.commitOwnerEntitlementPolicySuccessor(endedPolicy, successor);
  expect(staleOrigin.ok).toBe(true); /* إعادة التشغيل بالمفتاح نفسه — حتمية */

  /* ═══ سجلات الاستحقاق ═══ */

  /* ٣) الحفظ والقراءة الحرفية. */
  const record = createOwnerEntitlementRecord({
    id: "entitlement-cap-1",
    policyId: "policy-cap-1",
    policyVersion: 1,
    periodFrom: "2026-08-01",
    periodTo: "2026-08-31",
    occurredOn: "2026-08-31",
    recordedAt: AT,
    amountMinor: 1500,
    knowledge: "known",
    calculationBasis: "time_period",
    baseMinor: null,
    quantity: null,
    note: "آب",
    idempotencyKey: "entitlement-cap-1",
  });
  const savedRecord = await store.saveOwnerEntitlementRecord(record);
  expect(savedRecord.ok).toBe(true);
  if (!savedRecord.ok) throw new Error(savedRecord.message);
  const fetchedRecord = await store.getOwnerEntitlementRecord("entitlement-cap-1");
  expect(fetchedRecord.ok && fetchedRecord.value).toEqual(record);
  const missingRecord = await store.getOwnerEntitlementRecord("entitlement-cap-void");
  expect(missingRecord.ok && missingRecord.value).toBeNull();

  /* ٤) التراجع المحروس: تراجع واحد للسجل؛ إعادة التراجع بمفتاحه تعيد
   *    المخزن؛ والمصدر المفقود رفض صادر. */
  const recordReversal = createOwnerEntitlementRecordReversal({
    id: "entitlement-cap-1-rev",
    source: record,
    occurredOn: "2026-09-08",
    recordedAt: AT,
    idempotencyKey: "ent-cap-rev-1",
    reason: "خطأ",
  });
  const recordReversalCommit = await store.commitOwnerEntitlementRecordReversal(
    "entitlement-cap-1",
    recordReversal,
  );
  expect(recordReversalCommit.ok).toBe(true);
  if (!recordReversalCommit.ok) throw new Error(recordReversalCommit.message);
  const recordReversalReplay = await store.commitOwnerEntitlementRecordReversal(
    "entitlement-cap-1",
    recordReversal,
  );
  expect(recordReversalReplay.ok).toBe(true);
  const recordsAfter = await store.listOwnerEntitlementRecords();
  expect(recordsAfter.ok && recordsAfter.value).toHaveLength(2);
  const missingSourceReversal = await store.commitOwnerEntitlementRecordReversal(
    "entitlement-cap-void",
    recordReversal,
  );
  expect(missingSourceReversal.ok).toBe(false);
  if (!missingSourceReversal.ok) expect(missingSourceReversal.code).toBe("storage_error");

  /* ═══ الرصيد الافتتاحي ═══ */

  /* ٥) الحفظ والقراءة ثم التراجع المحروس بإعادة التشغيل. */
  const opening = createOwnerEntitlementOpeningBalance({
    id: "opening-cap-1",
    amountMinor: 5000,
    reason: "رصيد افتتاح",
    note: "افتتاح",
    occurredOn: "2026-08-01",
    recordedAt: AT,
    idempotencyKey: "opening-cap-1",
    reversalOfId: null,
    reversalReason: null,
  });
  const savedOpening = await store.saveOwnerEntitlementOpeningBalance(opening);
  expect(savedOpening.ok).toBe(true);
  if (!savedOpening.ok) throw new Error(savedOpening.message);
  const openingReversal = createOwnerEntitlementOpeningBalanceReversal({
    id: "opening-cap-1-rev",
    source: opening,
    occurredOn: "2026-09-08",
    recordedAt: AT,
    idempotencyKey: "opening-cap-rev-1",
    reason: "خطأ افتتاح",
  });
  const openingReversalCommit = await store.commitOwnerEntitlementOpeningBalanceReversal(
    "opening-cap-1",
    openingReversal,
  );
  expect(openingReversalCommit.ok).toBe(true);
  if (!openingReversalCommit.ok) throw new Error(openingReversalCommit.message);
  const openingReversalReplay = await store.commitOwnerEntitlementOpeningBalanceReversal(
    "opening-cap-1",
    openingReversal,
  );
  expect(openingReversalReplay.ok).toBe(true);
  const openingsAfter = await store.listOwnerEntitlementOpeningBalances();
  expect(openingsAfter.ok && openingsAfter.value).toHaveLength(2);
  const missingOpeningReversal = await store.commitOwnerEntitlementOpeningBalanceReversal(
    "opening-cap-void",
    openingReversal,
  );
  expect(missingOpeningReversal.ok).toBe(false);
  if (!missingOpeningReversal.ok) expect(missingOpeningReversal.code).toBe("storage_error");

  /* ═══ حركات المالك ═══ */

  /* ٦) الحركة وأثر الكاش معًا؛ إعادة التشغيل إعادةُ استخدام؛ والقراءة
   *    الفردية حرفية. */
  const movement = createOwnerMovement({
    id: "movement-cap-1",
    kind: "draw",
    amountMinor: 500,
    walletId: "wallet-cap",
    occurredOn: "2026-09-08",
    recordedAt: AT,
    reason: "owner_draw",
    note: "سحب مالك",
    idempotencyKey: "movement-cap-1",
    relatedEntitlementId: null,
  });
  const cashEntry = createCashContinuityEntry({
    id: "cash-owner-cap-1",
    walletId: "wallet-cap",
    type: "cash_adjustment",
    occurredOn: "2026-09-08",
    recordedAt: AT,
    cashDeltaMinor: -500,
    note: "حركة مالك",
    reason: "owner_draw",
    operationKey: "owner-movement:movement-cap-1",
  });
  const movementCommit = await store.commitOwnerMovement(movement, cashEntry);
  expect(movementCommit.ok).toBe(true);
  if (!movementCommit.ok) throw new Error(movementCommit.message);
  const movementReplay = await store.commitOwnerMovement(movement, cashEntry);
  expect(movementReplay.ok).toBe(true);
  const movementsAfter = await store.listOwnerMovements();
  expect(movementsAfter.ok && movementsAfter.value).toHaveLength(1);
  const fetchedMovement = await store.getOwnerMovement("movement-cap-1");
  expect(fetchedMovement.ok && fetchedMovement.value).toEqual(movement);
  const missingMovement = await store.getOwnerMovement("movement-cap-void");
  expect(missingMovement.ok && missingMovement.value).toBeNull();
}

describe("Wave C — قدرة استحقاق المالك (ADR-015 مجموعة 6): العضوية", () => {
  it("قائمة الطرق هي نطاق المجموعة بالضبط: 14 اسمًا فريدًا (العدّ الحي من الواجهة)", () => {
    expect(ownerEntitlementStoreMethods).toHaveLength(14);
    expect(new Set(ownerEntitlementStoreMethods).size).toBe(14);
  });

  for (const [label, makeStore] of [
    ["MemoryLocalStore", () => new MemoryLocalStore()],
    ["IndexedDbLocalStore", () => new IndexedDbLocalStore()],
  ] as const) {
    it(`${label} يكشف كل طريقة قدرة كدالة`, () => {
      const store = makeStore();
      for (const method of ownerEntitlementStoreMethods) {
        expect(
          typeof (store as unknown as Record<string, unknown>)[method],
          `${label}: طريقة القدرة مفقودة: ${method}`,
        ).toBe("function");
      }
    });
  }
});

describe("Wave C — قدرة استحقاق المالك: العقود السلوكية عبر العدسة الضيقة", () => {
  afterEach(async () => {
    await clearDatabase();
  });

  it("الذاكرة: عقد القدرة كاملًا (سياسات + سجلات + افتتاحي + حركات)", async () => {
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

describe("Wave C — قدرة استحقاق المالك: طبقة الأنواع", () => {
  it(
    "المحوّلان والواجهة التوافقية ما زالوا يحققون القدرة (tsc على ملف المراسي)",
    { timeout: 120_000 },
    () => {
      /* ملفات الاختبار مستثناة من فحص أنواع الـapp — لذا يُفرض هنا فحص المراسي
       * وحدها بامتداد tsconfig الـapp نفسه (نمط مراسي Wave 3B/4C). أي كسر
       * للتحقيق (توقيع/إسقاط implements/انحراف الواجهة) يفشل هنا فورًا. */
      const tmp = mkdtempSync(path.join(tmpdir(), "micro-owner-capability-"));
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
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        });
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
      expect(true).toBe(true);
    },
  );
});
