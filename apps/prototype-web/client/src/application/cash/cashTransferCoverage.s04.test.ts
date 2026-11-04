import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { CashContinuityService } from "./cashContinuityService";
import { createCashContinuityEntry, type CashContinuityEntry } from "@micro-domain/cash-continuity/index.js";
import { IndexedDbLocalStore } from "@/storage/local/IndexedDbLocalStore";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import type { PrototypeLocalStore } from "@/storage/local/types";

/* S04 (DOC-013 / UNIT-023 D01 + UNIT-024 + UNIT-020 — SDF-021/022 + المصفوفة):
 * التحويل محروس التغطية داخل حد الكتابة، والتخصيص لا يقبض ثانية، وسحب
 * المالك ليس مصروفًا — عند حد الخدمة/التخزين على المهايئين معًا:
 *  - SDF-021: فشل كتابة الجهة الثانية من تحويل 10 يلغي الجهتين معًا (صفر
 *    أثر جزئي)؛ والنجاح يكتب الجهتين بعلاقة تحويل واحدة مشتركة؛ وإعادة
 *    المحاولة بالمفتاح نفسه لا تكرر الأثر المالي.
 *  - تحويلان متزامنان من مصدر معروف لا يغطيهما الرصيد: واحد على الأكثر
 *    ينجح (الرصيد يُفحص داخل المعاملة لا قبلها فقط).
 *  - التخصيص (تحديد مكان دفعة قائمة): قيد واحد بمرجع مصدره — لا حدث مالي
 *    جديد ولا إيصال ثانٍ؛ وإجمالي النقد المسجل لا يتغير.
 *  - سحب المالك ليس مصروفًا: حركته النقدية ضبط موثق مرتبط بالمالك، لا
 *    حدث مصروف ولا إيراد ولا بيع. */

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

function adapters(): { store: PrototypeLocalStore }[] {
  return [{ store: new IndexedDbLocalStore() }, { store: new MemoryLocalStore() }];
}

async function openTwoWallets(
  service: CashContinuityService,
  sourceMinor: number,
  destinationMinor: number,
): Promise<{ sourceId: string; destinationId: string }> {
  const source = await service.openWallet({
    name: "درج",
    kind: "cash_drawer",
    openingMinor: sourceMinor,
    occurredOn: "2026-10-01",
    note: "رصيد بداية",
    operationKey: "s04-t-open-source",
  });
  if (!source.ok) throw new Error(source.message);
  const destination = await service.openWallet({
    name: "بنك",
    kind: "bank_account",
    openingMinor: destinationMinor,
    occurredOn: "2026-10-01",
    note: "رصيد بداية",
    operationKey: "s04-t-open-destination",
  });
  if (!destination.ok) throw new Error(destination.message);
  return { sourceId: source.value.wallet.id, destinationId: destination.value.wallet.id };
}

describe("S04 transfer coverage + assignment + owner money — service/storage boundary (both adapters)", () => {
  it("SDF-021 success leg: a transfer writes both legs with ONE shared relationship, total cash unchanged, and retry with the same key duplicates nothing", async () => {
    for (const { store } of adapters()) {
      const cash = new CashContinuityService(store, now);
      const { sourceId, destinationId } = await openTwoWallets(cash, 10000, 2000);
      const result = await cash.transfer({
        fromWalletId: sourceId,
        toWalletId: destinationId,
        amountMinor: 1000,
        occurredOn: "2026-10-28",
        note: "تحويل 10 دنانير",
        operationKey: "s04-sdf021-transfer",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.value).toHaveLength(2);
      /* علاقة تحويل واحدة مشتركة بين الجهتين المتعاكستين. */
      const transferIds = new Set(result.value.map(entry => entry.transferId));
      expect(transferIds.size).toBe(1);
      expect(result.value[0]?.cashDeltaMinor).toBe(-1000);
      expect(result.value[1]?.cashDeltaMinor).toBe(1000);
      /* إجمالي النقد المسجل لا يتغير: 12000 كما كان. */
      const overview = await cash.overview();
      expect(overview.ok && overview.value.totalWalletCashMinor).toBe(12000);
      /* إعادة الإرسال بالمفتاح نفسه: إعادة استخدام صادقة بلا تكرار أثر. */
      const retry = await cash.transfer({
        fromWalletId: sourceId,
        toWalletId: destinationId,
        amountMinor: 1000,
        occurredOn: "2026-10-28",
        note: "تحويل 10 دنانير",
        operationKey: "s04-sdf021-transfer",
      });
      expect(retry.ok && retry.reused).toBe(true);
      const entries = await store.listCashContinuityEntries();
      if (entries.ok)
        expect(
          entries.value.filter(entry => entry.type === "transfer_out" || entry.type === "transfer_in"),
        ).toHaveLength(2);
      const overviewAfterRetry = await cash.overview();
      expect(overviewAfterRetry.ok && overviewAfterRetry.value.totalWalletCashMinor).toBe(12000);
    }
  });

  it("SDF-021 failure leg: a write that fails at the second entry leaves ZERO partial financial effect — both legs roll back together", async () => {
    for (const { store } of adapters()) {
      const cash = new CashContinuityService(store, now);
      const { sourceId, destinationId } = await openTwoWallets(cash, 10000, 2000);
      /* حقن فشل كتابة الجهة الثانية داخل الدفعة: قيد سليم أولًا ثم قيد
       * غير قابل للاستنساخ (قيمة دالة في حقل نصي) — البنية تُنشئ كائنًا
       * يفشل structuredClone عند وضعه، فيُحبط الحد كاملًا (IndexedDB) أو
       * يفشل الاستنساخ قبل أول كتابة (الذاكرة المؤاتية) — لا جهة يتيمة. */
      const goodLeg = createCashContinuityEntry({
        id: "s04-poisoned-out",
        walletId: sourceId,
        type: "transfer_out",
        occurredOn: "2026-10-28",
        recordedAt: NOW,
        cashDeltaMinor: -1000,
        note: "تحويل سيفشل",
        operationKey: "s04-poisoned-transfer",
        transferId: "s04-poisoned-transfer-id",
      });
      const poisonedLeg = {
        ...createCashContinuityEntry({
          id: "s04-poisoned-in",
          walletId: destinationId,
          type: "transfer_in",
          occurredOn: "2026-10-28",
          recordedAt: NOW,
          cashDeltaMinor: 1000,
          note: "تحويل سيفشل",
          operationKey: "s04-poisoned-transfer",
          transferId: "s04-poisoned-transfer-id",
        }),
        note: (() => {}) as unknown as string,
      } as CashContinuityEntry;
      /* قناتا الفشل كلتاهما صادقتان: نتيجة فشل من الحد (IndexedDB — إحباط
       * المعاملة) أو رفض كامل بلا نتيجة (الذاكرة — الاستنساخ قبل أول كتابة).
       * المهم: لا أثر جزئي البتة. */
      let failed = false;
      try {
        const committed = await store.commitCashContinuity(null, [goodLeg, poisonedLeg]);
        failed = !committed.ok;
      } catch {
        failed = true;
      }
      expect(failed).toBe(true);
      /* صفر أثر جزئي: لا سجل لأي جهة من الجهتين، والرصيدان كما كانا. */
      const entries = await store.listCashContinuityEntries();
      if (entries.ok) {
        expect(entries.value.filter(entry => entry.transferId === "s04-poisoned-transfer-id")).toHaveLength(
          0,
        );
        expect(entries.value).toHaveLength(2); /* افتتاحا المحفظتين فقط */
      }
      const overview = await cash.overview();
      expect(overview.ok && overview.value.totalWalletCashMinor).toBe(12000);
    }
  });

  it("concurrent transfers from a known source with insufficient coverage: at most one succeeds — the in-transaction guard rejects the second with no write", async () => {
    for (const { store } of adapters()) {
      const cash = new CashContinuityService(store, now);
      const { sourceId, destinationId } = await openTwoWallets(cash, 10000, 0);
      /* تحويلان متزامنان بمبلغ 70 من رصيد 100: النافذتان تقرآن 100 قبل
       * التزام أي منهما، والحارس داخل حد الكتابة يجعل واحدًا فقط ينجح. */
      const [first, second] = await Promise.all([
        cash.transfer({
          fromWalletId: sourceId,
          toWalletId: destinationId,
          amountMinor: 7000,
          occurredOn: "2026-10-28",
          note: "تحويل متزامن أول",
          operationKey: "s04-concurrent-a",
        }),
        cash.transfer({
          fromWalletId: sourceId,
          toWalletId: destinationId,
          amountMinor: 7000,
          occurredOn: "2026-10-28",
          note: "تحويل متزامن ثانٍ",
          operationKey: "s04-concurrent-b",
        }),
      ]);
      const successes = [first, second].filter(result => result.ok);
      expect(successes).toHaveLength(1);
      const failed = [first, second].find(result => !result.ok);
      /* تعارض التغطية يصل رسالة الحارس الصادقة نفسها (لا يغطي) — سباق
       * النافذتين يُرى رفض تغطية صريحًا لا عطل تخزين غامضًا. */
      expect(failed?.code).toBe("validation_error");
      expect(failed?.message).toContain("لا يغطي");
      /* الرصيد النهائي 30 (100−70) لا −40: زوج واحد فقط مكتوب. */
      const overview = await cash.overview();
      if (!overview.ok) throw new Error(overview.message);
      expect(overview.value.totalWalletCashMinor).toBe(10000);
      const source = overview.value.wallets.find(wallet => wallet.name === "درج");
      expect(source?.balanceMinor).toBe(3000);
      const entries = await store.listCashContinuityEntries();
      if (entries.ok) expect(entries.value.filter(entry => entry.type === "transfer_out")).toHaveLength(1);
    }
  });

  it("a known source below the amount is rejected before the boundary with zero entries; an unknown-opening source is allowed as a confirmed actual transfer", async () => {
    for (const { store } of adapters()) {
      const cash = new CashContinuityService(store, now);
      const { sourceId, destinationId } = await openTwoWallets(cash, 5000, 0);
      const rejected = await cash.transfer({
        fromWalletId: sourceId,
        toWalletId: destinationId,
        amountMinor: 6000,
        occurredOn: "2026-10-28",
        note: "أكثر من الرصيد",
        operationKey: "s04-insufficient",
      });
      expect(rejected).toMatchObject({ ok: false, code: "validation_error" });
      expect(rejected.ok === false && rejected.message).toContain("لا يغطي");
      const entriesAfterRejection = await store.listCashContinuityEntries();
      if (entriesAfterRejection.ok)
        expect(entriesAfterRejection.value.filter(entry => entry.type === "transfer_out")).toHaveLength(0);
      /* المصدر مجهول الافتتاح: التحويل المؤكد الفعلي جائز — المجهول ليس
       * صفرًا ولا سقفًا وهميًا ولا سببًا للرفض. */
      const unknownWallet = await cash.openWallet({
        name: "محفظة مجهولة",
        kind: "cash_drawer",
        openingMinor: 0,
        occurredOn: "2026-10-01",
        note: "بلا رصيد معلن",
        operationKey: "s04-open-unknown",
        openingStatus: "unknown",
      });
      if (!unknownWallet.ok) throw new Error(unknownWallet.message);
      const allowed = await cash.transfer({
        fromWalletId: unknownWallet.value.wallet.id,
        toWalletId: destinationId,
        amountMinor: 2000,
        occurredOn: "2026-10-28",
        note: "تحويل مؤكد فعليًا من مجهولة الافتتاح",
        operationKey: "s04-unknown-source-transfer",
      });
      expect(allowed.ok).toBe(true);
    }
  });

  it("assignment of an existing payment writes exactly ONE allocation entry with its source reference — no new financial event, no second receipt, and the recorded total stays constant", async () => {
    for (const { store } of adapters()) {
      const cash = new CashContinuityService(store, now);
      const { sourceId } = await openTwoWallets(cash, 10000, 0);
      const beforeEvents = await store.listFinancialEvents();
      expect(beforeEvents.ok && beforeEvents.value).toHaveLength(0);
      /* تخصيص دفعة قائمة (بيع 5 دنانير غير موزع) إلى مكانها: قيد واحد. */
      const allocation = createCashContinuityEntry({
        id: "s04-allocation-1",
        walletId: sourceId,
        type: "allocation",
        occurredOn: "2026-10-28",
        recordedAt: NOW,
        cashDeltaMinor: 500,
        note: "تحديد مكان مبلغ مستلم",
        operationKey: "s04-assign-500",
        sourceRefId: "sale-1",
        sourceRefKind: "sale",
      });
      const committed = await store.commitCashContinuity(null, [allocation]);
      expect(committed.ok).toBe(true);
      /* لا إيصال ثانٍ ولا حدث مالي جديد: القيود زادت قيد التخصيص وحده
       * (الافتتاح + التخصيص)، والأحداث المالية بقيت فارغة. */
      const entries = await store.listCashContinuityEntries();
      if (entries.ok) {
        expect(entries.value).toHaveLength(2); /* افتتاح + تخصيص واحد */
        expect(entries.value.filter(entry => entry.type === "allocation")).toHaveLength(1);
      }
      const afterEvents = await store.listFinancialEvents();
      expect(afterEvents.ok && afterEvents.value).toHaveLength(0);
      /* إعادة الإرسال نفسها: إعادة استخدام بلا تكرار (لا قيد تخصيص ثانٍ). */
      const replay = await store.commitCashContinuity(null, [allocation]);
      expect(replay.ok).toBe(true);
      const entriesAfterReplay = await store.listCashContinuityEntries();
      if (entriesAfterReplay.ok)
        expect(entriesAfterReplay.value.filter(entry => entry.type === "allocation")).toHaveLength(1);
    }
  });

  it("an owner withdrawal is a documented adjustment linked to the owner — never an expense, sale, or revenue event", async () => {
    for (const { store } of adapters()) {
      const cash = new CashContinuityService(store, now);
      const { sourceId } = await openTwoWallets(cash, 10000, 0);
      const beforeEvents = await store.listFinancialEvents();
      expect(beforeEvents.ok && beforeEvents.value).toHaveLength(0);
      /* سحب شخصي 7 دنانير من الصندوق: ضبط موثق بسبب مالك — ليس مصروفًا. */
      const withdrawal = createCashContinuityEntry({
        id: "s04-owner-withdrawal",
        walletId: sourceId,
        type: "cash_adjustment",
        occurredOn: "2026-10-28",
        recordedAt: NOW,
        cashDeltaMinor: -700,
        note: "سحب شخصي",
        reason: "سحب شخصي من المالك",
        operationKey: "s04-owner-draw-700",
      });
      const committed = await store.commitCashContinuity(null, [withdrawal]);
      expect(committed.ok).toBe(true);
      /* لا حدث مالي من السحب: الأحداث المالية فارغة، والرصيد 93.00 د.أ. */
      const afterEvents = await store.listFinancialEvents();
      expect(afterEvents.ok && afterEvents.value).toHaveLength(0);
      const overview = await cash.overview();
      expect(overview.ok && overview.value.wallets.find(w => w.name === "درج")?.balanceMinor).toBe(9300);
    }
  });
});
