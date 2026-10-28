import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { MemoryLocalStore } from "./MemoryLocalStore";
import { localSchemaVersion, localExportVersion, type PrototypeLocalStore } from "./types";

/* S03 revalidation (00-S03-REVALIDATION-S04-EXECUTION-PROMPT-2026-10-28 §A2/§A3):
 * كتابة التفضيلات عند حد الكتابة المحروس — القراءة الحية والدمج والكتابة
 * داخل معاملة IndexedDB واحدة (أو خطوة متزامنة واحدة في الذاكرة). العيب
 * المُثبت (§A1): البوابة المتقاعدة كانت تقرأ ثم تدمج ثم تكتب السجل كاملًا
 * خارج أي حد، فكاتبان متزامنان على حقول مختلفة تسحق إحدى كتابتيهما الأخرى
 * بصمت. هذه الاختبارات تثبت العقد الجديد على المحوّلين معًا (نفس نمط
 * IndexedDbLocalStore.profileCommit.test.ts):
 *  - رقعة تُطبَّق فوق السجل الحي داخل الحد: لا كتابة تُفقد ولا حقل يُسقط؛
 *  - CAS حي عند تمرير طابع متوقع: الغياب أو الاختلاف تعارض صادق بلا كتابة؛
 *  - نفس الحقل: الالتزامات تتسلسل حتميًا (آخر ملزم يفوز) بلا تعارض زائف؛
 *  - الغياب عند «لا توقع» ينشئ السجل بذرةً صادقة (لا إنشاء من مسار CAS)؛
 *  - لا أثر مالي ولا كتابة على أي متجر آخر ولا تغيير مخطط/تصدير. */

const databaseName = "micro-prototype-local";
afterEach(() => {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
});

const T0 = "2026-10-28T00:00:00.000Z";
const T1 = "2026-10-28T01:00:00.000Z";
const T2 = "2026-10-28T02:00:00.000Z";

const adapters = (): PrototypeLocalStore[] => [new IndexedDbLocalStore(), new MemoryLocalStore()];

describe("commitPreferencesUpdate — guarded atomic preference patch at the write boundary (S03 revalidation §A2)", () => {
  it("creates an honest fresh record when absent and no revision is expected — and backfills optional fields", async () => {
    for (const store of adapters()) {
      const created = await store.commitPreferencesUpdate({ theme: "dark" }, null, T0);
      expect(created).toMatchObject({
        ok: true,
        value: { outcome: "created", preferences: { id: "local-preferences", theme: "dark" } },
      });
      if (!created.ok || created.value.outcome === "conflict") throw new Error("should create");
      /* البذرة الصادقة الكاملة — نفسها التي كانت بوابة الدمج تبنيها. */
      expect(created.value.preferences).toMatchObject({
        dailyScheduleCapacityMinutes: null,
        workMode: null,
        actualTimeTrackingEnabled: false,
        installBannerDismissedAt: null,
        lastVerifiedExportAt: null,
        backupReminderEnabled: true,
        disabledCapabilities: [],
        lowStockThresholdsMilli: null,
        offeringPreference: null,
        updatedAt: T0,
      });
      const read = await store.getPreferences();
      expect(read).toMatchObject({ ok: true, value: { theme: "dark" } });
    }
  });

  it("merges the patch over the live record inside the boundary — unrelated fields are never dropped, old records are backfilled", async () => {
    for (const store of adapters()) {
      await store.commitPreferencesUpdate({ theme: "dark", workMode: "material_focused" }, null, T0);
      /* سجل قديم بلا الحقول الاختيارية الأحدث — يُرسَّخ بأول حفظ يمر من الحد. */
      const read = await store.getPreferences();
      if (!read.ok || !read.value) throw new Error("should read");
      const legacy = { ...read.value };
      delete (legacy as Record<string, unknown>).lastVerifiedExportAt;
      delete (legacy as Record<string, unknown>).backupReminderEnabled;
      delete (legacy as Record<string, unknown>).disabledCapabilities;
      delete (legacy as Record<string, unknown>).lowStockThresholdsMilli;
      delete (legacy as Record<string, unknown>).offeringPreference;
      await store.savePreferences(legacy);
      const updated = await store.commitPreferencesUpdate({ offeringPreference: "services" }, null, T1);
      expect(updated).toMatchObject({
        ok: true,
        value: {
          outcome: "updated",
          preferences: { theme: "dark", workMode: "material_focused", offeringPreference: "services" },
        },
      });
      if (!updated.ok || updated.value.outcome === "conflict") throw new Error("should update");
      expect(updated.value.preferences).toMatchObject({
        lastVerifiedExportAt: null,
        backupReminderEnabled: true,
        disabledCapabilities: [],
        lowStockThresholdsMilli: null,
        updatedAt: T1,
      });
    }
  });

  it("a stale expected revision is rejected truthfully (CAS) — the live record survives untouched", async () => {
    for (const store of adapters()) {
      await store.commitPreferencesUpdate({ theme: "dark" }, null, T0);
      /* نافذة أخرى سبقت: النسخة الحية صارت T1. */
      await store.commitPreferencesUpdate({ backupReminderEnabled: false }, null, T1);
      const stale = await store.commitPreferencesUpdate({ theme: "light" }, T0, T2);
      expect(stale).toMatchObject({
        ok: true,
        value: {
          outcome: "conflict",
          live: { theme: "dark", backupReminderEnabled: false, updatedAt: T1 },
        },
      });
      const read = await store.getPreferences();
      expect(read).toMatchObject({
        ok: true,
        value: { theme: "dark", backupReminderEnabled: false, updatedAt: T1 },
      });
    }
  });

  it("an expected revision against an absent record conflicts with live:null — the guarded path never creates", async () => {
    for (const store of adapters()) {
      const result = await store.commitPreferencesUpdate({ theme: "light" }, T0, T1);
      expect(result).toMatchObject({ ok: true, value: { outcome: "conflict", live: null } });
      await expect(store.getPreferences()).resolves.toMatchObject({ ok: true, value: null });
    }
  });

  it("two concurrent commits on different fields — both updates survive, neither writer is lost", async () => {
    for (const store of adapters()) {
      await store.commitPreferencesUpdate({ theme: "dark" }, null, T0);
      const [first, second] = await Promise.all([
        store.commitPreferencesUpdate({ theme: "light" }, null, T1),
        store.commitPreferencesUpdate({ offeringPreference: "products" }, null, T2),
      ]);
      expect(first).toMatchObject({ ok: true, value: { outcome: "updated" } });
      expect(second).toMatchObject({ ok: true, value: { outcome: "updated" } });
      const read = await store.getPreferences();
      expect(read).toMatchObject({
        ok: true,
        value: { theme: "light", offeringPreference: "products" },
      });
    }
  });

  it("two concurrent commits on the same field serialize deterministically — the later commit wins, both report success truthfully", async () => {
    for (const store of adapters()) {
      await store.commitPreferencesUpdate({ theme: "dark" }, null, T0);
      const [first, second] = await Promise.all([
        store.commitPreferencesUpdate({ theme: "light" }, null, T1),
        store.commitPreferencesUpdate({ theme: "system" }, null, T2),
      ]);
      /* كلتا الكتابتين نجحتا من وجهة نظر كاتبهما — القيمة النهائية آخر
       * ملزم حتميًا (ترتيب الالتزام لا توقيت التشغيل) وهو سلوك حتمي
       * موثق لحقل واحد بلا CAS، مثل جملتي إسناد متتاليتين. */
      expect(first.ok && second.ok).toBe(true);
      const read = await store.getPreferences();
      expect(read).toMatchObject({ ok: true, value: { theme: "system", updatedAt: T2 } });
    }
  });

  it("two concurrent CAS commits from the same base — exactly one wins and the loser conflicts on the winner's live record", async () => {
    for (const store of adapters()) {
      await store.commitPreferencesUpdate({ theme: "dark" }, null, T0);
      const [first, second] = await Promise.all([
        store.commitPreferencesUpdate({ theme: "light" }, T0, T1),
        store.commitPreferencesUpdate({ backupReminderEnabled: false }, T0, T2),
      ]);
      const outcomes = [first, second].map(result => (result.ok ? result.value : null));
      expect(outcomes.filter(o => o?.outcome === "updated")).toHaveLength(1);
      expect(outcomes.filter(o => o?.outcome === "conflict")).toHaveLength(1);
      const winner = outcomes.find(o => o?.outcome === "updated");
      const read = await store.getPreferences();
      if (!read.ok || !read.value) throw new Error("should read");
      expect(read.value.updatedAt).toBe(winner?.preferences.updatedAt);
      /* الخاسر يرى الحالة الحية كاملة فيتعافى بقرار صريح لا بإعادة صامتة. */
      const loser = outcomes.find(o => o?.outcome === "conflict");
      expect(loser && "live" in loser && loser.live?.updatedAt).toBe(winner?.preferences.updatedAt);
    }
  });

  it("repeated identical command after a conflict-free first commit is value-idempotent — no duplicate record, no duplicate identity", async () => {
    for (const store of adapters()) {
      const first = await store.commitPreferencesUpdate({ theme: "dark" }, null, T0);
      expect(first).toMatchObject({ ok: true, value: { outcome: "created" } });
      const repeat = await store.commitPreferencesUpdate({ theme: "dark" }, null, T1);
      expect(repeat).toMatchObject({
        ok: true,
        value: { outcome: "updated", preferences: { theme: "dark" } },
      });
      const read = await store.getPreferences();
      expect(read.ok && read.value?.id).toBe("local-preferences");
      /* هوية واحدة دائمًا: المفتاح الثابت لا يخلق سجلًا ثانيًا. */
      if (read.ok && read.value) expect(read.value.id).toBe("local-preferences");
    }
  });

  it("preference commits write no financial data and no other store record — schema and export versions unchanged", async () => {
    for (const store of adapters()) {
      await store.commitPreferencesUpdate({ theme: "dark" }, null, T0);
      await store.commitPreferencesUpdate({ offeringPreference: "both" }, null, T1);
      await store.commitPreferencesUpdate({ theme: "light" }, T0, T2); /* تعارض — لا يكتب */
      /* لا حدث مالي ولا محفظة ولا حركة مالك من كتابة التفضيلات — القراءات
       * نفسها جزء الإثبات: فشلها يفشل الاختبار لا أن يتخطاه بصمت (S03-reval R4-F01). */
      const events = await store.listFinancialEvents();
      expect(events.ok).toBe(true);
      if (events.ok) expect(events.value).toHaveLength(0);
      const wallets = await store.listCashWallets();
      expect(wallets.ok).toBe(true);
      if (wallets.ok) expect(wallets.value).toHaveLength(0);
      const ownerMovements = await store.listOwnerMovements();
      expect(ownerMovements.ok).toBe(true);
      if (ownerMovements.ok) expect(ownerMovements.value).toHaveLength(0);
      /* المخطط والتصدير: زوج S04 الحي 39/31 (DOC-013 — عائلة رصد الأرصدة)؛
       * كتابة التفضيلات نفسها لم تمس المخطط ولا صيغة الاستيراد قط. */
      expect(localSchemaVersion).toBe(39);
      expect(localExportVersion).toBe(31);
    }
  });
});
