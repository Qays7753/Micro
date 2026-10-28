import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { CashContinuityService } from "./cashContinuityService";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { localExportVersion, localSchemaVersion, type PrototypeLocalStore } from "@/storage/local/types";

/* S04 (DOC-013 / UNIT-025 + العقد المشترك §6 — SDF-001/015/016/020):
 * العدّ والمطابقة بوصفه قياسًا لا حركة — الحالات المركزية للمرحلة عند حد
 * الخدمة/التخزين على المهايئين معًا:
 *  - SDF-001: 100 دينار = 10000 minor — التحويل مرة واحدة عند حد الإدخال
 *    والعرض بمنزلتين؛ لا إعادة تفسير قيمة قائمة.
 *  - SDF-015: رصيد دفتر مجهول مع رصد 90 — يُحفظ القياس وحده؛ لا فرق مقابل
 *    صفر ولا تمويل مالك ولا تسوية.
 *  - SDF-016: دفتر 100 معروض وعدّ 90 مع مطابقة صريحة — قياس 90 وتسوية نقص
 *    10 بمعنيين مرتبطين؛ لا نقص 20 ولا تمويل سالب؛ الرصد لا يُحسب حركة
 *    ثانية فلا يهبط الرصيد إلى 80.
 *  - SDF-020: رصد مشروع 200 ورصد محفظة 80 متداخلان — لا يجمعان إلى 280؛
 *    النطاقان يحفظان منفصلين بلا توزيع مخترع.
 *  - القياس لا يُنشئ نقدًا ولا يمحو حركة: كشف القيود قبل الرصد وبعده
 *    متطابق إلا للتسوية المصرح بها وحدها.
 *  - مطابقة المهايئين + حفظ التصدير/الاستيراد للعائلة الجديدة والمخطط 39/
 *    التصدير 31. */

const databaseName = "micro-prototype-local";
afterEach(() => {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
});

const NOW = "2026-10-28T09:00:00.000Z";
const now = () => NOW;

function adapters(): { label: string; store: PrototypeLocalStore }[] {
  return [
    { label: "indexeddb", store: new IndexedDbLocalStore() },
    { label: "memory", store: new MemoryLocalStore() },
  ];
}

async function openWalletWith(
  service: CashContinuityService,
  minor: number | null,
  name = "درج",
): Promise<string> {
  const result = await service.openWallet({
    name,
    kind: "cash_drawer",
    openingMinor: minor ?? 0,
    occurredOn: "2026-10-01",
    note: "رصيد بداية",
    operationKey: `s04-open-${name}`,
    ...(minor === null ? { openingStatus: "unknown" as const } : {}),
  });
  if (!result.ok) throw new Error(result.message);
  return result.value.wallet.id;
}

describe("S04 cash count — SDF-001/015/016/020 at the service/storage boundary (both adapters)", () => {
  it("SDF-016: known ledger 100, counted 90 with explicit reconciliation → measurement 90 + linked settlement −10, never −20, and the observation is not a second movement", async () => {
    for (const { store } of adapters()) {
      const cash = new CashContinuityService(store, now);
      const walletId = await openWalletWith(cash, 10000);
      const result = await cash.recordCashCount({
        walletId,
        countedMinor: 9000,
        knowledge: "known",
        settle: true,
        reason: "لم أعرف سبب الفرق",
        operationKey: "s04-sdf016-count",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.value.outcome).toBe("settled");
      if (result.value.outcome !== "settled") continue;
      /* التسوية نقص 10 بالضبط — لا نقص 20 (خطأ الاحتساب المزدوج). */
      expect(result.value.settlement.cashDeltaMinor).toBe(-1000);
      /* القياس 90 محفوظ بمعناه المستقل. */
      const observations = await store.listBalanceObservations();
      expect(observations.ok).toBe(true);
      if (observations.ok) {
        expect(observations.value).toHaveLength(1);
        expect(observations.value[0]?.countedMinor).toBe(9000);
        expect(observations.value[0]?.scopeKind).toBe("wallet");
      }
      /* الرصيد النهائي 90 — الرصد لم يُحسب حركة ثانية فلم يهبط إلى 80. */
      const overview = await cash.overview();
      expect(overview.ok && overview.value.wallets[0]?.balanceMinor).toBe(9000);
      /* كشف القيود: الافتتاح + التسوية فقط — القياس ليس قيدًا. */
      const entries = await store.listCashContinuityEntries();
      if (entries.ok) expect(entries.value).toHaveLength(2);
    }
  });

  it("SDF-015: unknown book balance with observation 90 → the measurement is saved alone; no difference against zero, no owner financing, no settlement, and a settle attempt is rejected honestly", async () => {
    for (const { store } of adapters()) {
      const cash = new CashContinuityService(store, now);
      const walletId = await openWalletWith(cash, null);
      /* محاولة التسوية على مرجع مجهول تُرفض بصدق بلا أي كتابة. */
      const rejected = await cash.recordCashCount({
        walletId,
        countedMinor: 9000,
        knowledge: "known",
        settle: true,
        reason: "لم أعرف سبب الفرق",
        operationKey: "s04-sdf015-settle-attempt",
      });
      expect(rejected).toMatchObject({ ok: false, code: "validation_error" });
      const nothingWritten = await store.listBalanceObservations();
      expect(nothingWritten.ok && nothingWritten.value).toHaveLength(0);
      /* القياس وحده: يُحفظ بلا فرق مقابل صفر وبلا تمويل مالك. */
      const result = await cash.recordCashCount({
        walletId,
        countedMinor: 9000,
        knowledge: "known",
        settle: false,
        operationKey: "s04-sdf015-observe",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.value.outcome).toBe("observed");
      const observations = await store.listBalanceObservations();
      if (observations.ok) {
        expect(observations.value).toHaveLength(1);
        expect(observations.value[0]?.countedMinor).toBe(9000);
      }
      /* لا حركة نقدية إطلاقًا: القيود فارغة والرصيد لم يتغير. */
      const entries = await store.listCashContinuityEntries();
      if (entries.ok) expect(entries.value).toHaveLength(0);
      const overview = await cash.overview();
      expect(overview.ok && overview.value.wallets[0]?.balanceMinor).toBe(0);
    }
  });

  it("a matching count writes nothing at all — no zero adjustment, no observation", async () => {
    for (const { store } of adapters()) {
      const cash = new CashContinuityService(store, now);
      const walletId = await openWalletWith(cash, 10000);
      const result = await cash.recordCashCount({
        walletId,
        countedMinor: 10000,
        knowledge: "known",
        settle: false,
        operationKey: "s04-match-count",
      });
      expect(result.ok && result.value.outcome).toBe("match");
      const observations = await store.listBalanceObservations();
      expect(observations.ok && observations.value).toHaveLength(0);
      const entries = await store.listCashContinuityEntries();
      if (entries.ok) expect(entries.value.filter(entry => entry.type === "cash_adjustment")).toHaveLength(0);
    }
  });

  it("SDF-020: overlapping project-total 200 and wallet 80 observations never sum to 280 — scopes stay separate with no invented distribution", async () => {
    for (const { store } of adapters()) {
      const cash = new CashContinuityService(store, now);
      /* محفظة مجهولة الافتتاح: رصد 80 يُحفظ قياسًا وحده (لا فرق مقابل صفر). */
      const walletId = await openWalletWith(cash, null);
      const walletObserved = await cash.recordCashCount({
        walletId,
        countedMinor: 8000,
        knowledge: "known",
        settle: false,
        operationKey: "s04-sdf020-wallet",
      });
      expect(walletObserved.ok && walletObserved.value.outcome).toBe("observed");
      /* رصد نطاق المشروع يُنشأ عند حد التخزين مباشرة (منطقه القانوني، وليس
       * من مسار عدّ المحفظة) — القيمة 200.00 د.أ إجماليًا. */
      const projectObservation = await store.commitCashObservation(
        {
          id: "s04-project-observation",
          scopeKind: "project_total",
          walletId: null,
          countedMinor: 20000,
          knowledge: "known",
          cutoff: NOW,
          observedOn: "2026-10-28",
          recordedAt: NOW,
          operationKey: "s04-sdf020-project",
          note: "رصد إجمالي المشروع",
        },
        null,
        null,
      );
      expect(projectObservation).toMatchObject({ ok: true, value: { reused: false } });
      const observations = await store.listBalanceObservations();
      if (!observations.ok) throw new Error(observations.message);
      /* النطاقان محفوظان منفصلين — لا قارئ يجمعهما إلى 280. */
      expect(observations.value).toHaveLength(2);
      const walletObservation = observations.value.find(o => o.scopeKind === "wallet");
      const projectTotal = observations.value.find(o => o.scopeKind === "project_total");
      expect(walletObservation?.countedMinor).toBe(8000);
      expect(projectTotal?.countedMinor).toBe(20000);
      expect(walletObservation?.walletId).toBe(walletId);
      expect(projectTotal?.walletId).toBeNull();
    }
  });

  it("the measurement creates no cash and erases no movement — entries identical before and after an unknown-reference observation", async () => {
    for (const { store } of adapters()) {
      const cash = new CashContinuityService(store, now);
      const walletId = await openWalletWith(cash, null);
      const beforeEntries = await store.listCashContinuityEntries();
      await cash.recordCashCount({
        walletId,
        countedMinor: 5000,
        knowledge: "known",
        settle: false,
        operationKey: "s04-measure-only",
      });
      const afterEntries = await store.listCashContinuityEntries();
      if (!beforeEntries.ok || !afterEntries.ok) throw new Error("entries should read");
      expect(afterEntries.value).toEqual(beforeEntries.value);
      /* رصد المحفظة بلا رصيد دفتر معروف لا يرفع ختم المجهول. */
      const wallets = await store.listCashWallets();
      if (wallets.ok) expect(wallets.value[0]?.openingStatus).toBe("unknown");
    }
  });

  it("repeated identical command recovers the same observation once — no duplicate measurement or settlement", async () => {
    for (const { store } of adapters()) {
      const cash = new CashContinuityService(store, now);
      const walletId = await openWalletWith(cash, 10000);
      const first = await cash.recordCashCount({
        walletId,
        countedMinor: 9000,
        knowledge: "known",
        settle: true,
        reason: "لم أعرف سبب الفرق",
        operationKey: "s04-idempotent-count",
      });
      expect(first.ok && first.value.outcome).toBe("settled");
      const repeat = await cash.recordCashCount({
        walletId,
        countedMinor: 9000,
        knowledge: "known",
        settle: true,
        reason: "لم أعرف سبب الفرق",
        operationKey: "s04-idempotent-count",
      });
      expect(repeat.ok && repeat.value.outcome).toBe("settled");
      const observations = await store.listBalanceObservations();
      expect(observations.ok && observations.value).toHaveLength(1);
      const entries = await store.listCashContinuityEntries();
      if (entries.ok) expect(entries.value.filter(entry => entry.type === "cash_adjustment")).toHaveLength(1);
      const overview = await cash.overview();
      expect(overview.ok && overview.value.wallets[0]?.balanceMinor).toBe(9000);
    }
  });

  it("SDF-001 (storage leg): JOD minor units are exact — 100.00 JOD opening is stored 10000 minor and settles with exact minor arithmetic", async () => {
    for (const { store } of adapters()) {
      const cash = new CashContinuityService(store, now);
      const walletId = await openWalletWith(cash, 10000);
      const overview = await cash.overview();
      expect(overview.ok && overview.value.wallets[0]?.balanceMinor).toBe(10000);
      /* ميزان دقيق: تسوية 2.40 على 150.00 تنتج 15240 بالضبط (240 صحيحة). */
      await cash.adjust({
        walletId,
        deltaMinor: 240,
        occurredOn: "2026-10-28",
        note: "تسوية موثقة",
        reason: "فرق عدّ موثق",
        operationKey: "s04-sdf001-adjust",
      });
      const after = await cash.overview();
      expect(after.ok && after.value.wallets[0]?.balanceMinor).toBe(10240);
    }
  });

  it("schema and export versions: 39/31 with the observation family exported and restored — and a legacy snapshot without it restores to an empty family", async () => {
    expect(localSchemaVersion).toBe(39);
    expect(localExportVersion).toBe(31);
    for (const { store } of adapters()) {
      const cash = new CashContinuityService(store, now);
      const walletId = await openWalletWith(cash, null);
      await cash.recordCashCount({
        walletId,
        countedMinor: 7000,
        knowledge: "known",
        settle: false,
        operationKey: "s04-roundtrip-observe",
      });
      const snapshot = await store.readSnapshot();
      if (!snapshot.ok) throw new Error(snapshot.message);
      expect(snapshot.value.balanceObservations ?? []).toHaveLength(1);
      expect(snapshot.value.balanceObservations?.[0]?.countedMinor).toBe(7000);
      /* الاستعادة تحفظ القياس كما هو — لا إعادة تسوية ولا إسقاط. */
      const replaced = await store.replaceSnapshot(snapshot.value);
      expect(replaced.ok).toBe(true);
      const observationsAfterRestore = await store.listBalanceObservations();
      if (observationsAfterRestore.ok) {
        expect(observationsAfterRestore.value).toHaveLength(1);
        expect(observationsAfterRestore.value[0]?.countedMinor).toBe(7000);
      }
      /* ملف قديم بلا العائلة (30/38 وأقدم): الغياب = قائمة فارغة بلا اختراع. */
      const legacy = { ...snapshot.value, balanceObservations: undefined };
      const legacyReplaced = await store.replaceSnapshot(legacy);
      expect(legacyReplaced.ok).toBe(true);
      const observationsAfterLegacy = await store.listBalanceObservations();
      expect(observationsAfterLegacy.ok && observationsAfterLegacy.value).toHaveLength(0);
    }
  });

  it("unknown-outcome honesty: a settlement whose live reference changed is rejected with no write — recovery is a fresh count", async () => {
    for (const { store } of adapters()) {
      const cash = new CashContinuityService(store, now);
      const walletId = await openWalletWith(cash, 10000);
      /* كاتب آخر يغيّر رصيد المحفظة بين قراءة الخدمة (المرجع 10000) وحدّ
       * الالتزام — الحقن حتمي: القراءة تعيد اللقطة القديمة ويُلتزم التحويل
       * قبل التزام العدّ فيرى الحد رصيدًا حيًا مختلفًا ويحبط بلا كتابة. */
      const staleEntries = await store.listCashContinuityEntries();
      const interleaved = {
        listCashWallets: store.listCashWallets.bind(store),
        listCashContinuityEntries: async () => {
          const other = new CashContinuityService(store, now);
          const second = await openWalletWith(other, 5000, "بنك");
          await other.transfer({
            fromWalletId: walletId,
            toWalletId: second,
            amountMinor: 3000,
            occurredOn: "2026-10-28",
            note: "كاتب متزامن",
            operationKey: "s04-interleave-transfer",
          });
          /* القراءة القديمة (قبل التحويل) — كما لو قرأت الخدمة ثم سبقها الكاتب. */
          return staleEntries;
        },
        commitCashContinuity: store.commitCashContinuity.bind(store),
        listBalanceObservations: store.listBalanceObservations.bind(store),
        commitCashObservation: store.commitCashObservation.bind(store),
      } as unknown as PrototypeLocalStore;
      const racing = new CashContinuityService(interleaved, now);
      const conflicted = await racing.recordCashCount({
        walletId,
        countedMinor: 9000,
        knowledge: "known",
        settle: true,
        reason: "لم أعرف سبب الفرق",
        operationKey: "s04-stale-settlement",
      });
      expect(conflicted).toMatchObject({ ok: false });
      /* لا كتابة نصفية: لا رصد بلا تسويته ولا تسوية فوق واقع متغير. */
      const observations = await store.listBalanceObservations();
      expect(observations.ok && observations.value).toHaveLength(0);
      const entries = await store.listCashContinuityEntries();
      if (entries.ok) expect(entries.value.filter(entry => entry.type === "cash_adjustment")).toHaveLength(0);
    }
  });
});
