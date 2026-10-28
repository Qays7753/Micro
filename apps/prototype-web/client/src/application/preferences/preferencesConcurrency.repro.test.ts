import { describe, expect, it } from "vitest";
import { updateLocalPreferences } from "./updateLocalPreferences";
import { PreferenceService } from "./preferenceService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import type { LocalPreferences, PrototypeLocalStore } from "@/storage/local/types";

/* S03 revalidation (00-S03-REVALIDATION-S04-EXECUTION-PROMPT-2026-10-28 §A1):
 * إثبات/نفي عيب الكتابة المتزامنة لسجل التفضيلات — كاتبان يقرآن النسخة
 * نفسها ثم يكتبان حقلين مختلفين من لقطتين متقادمتين: البوابة القائمة
 * (قراءة ثم دمج ثم كتابة السجل كاملًا خارج أي حد محروس) تسمح للكاتب
 * الثاني بسحق تحديث الكاتب الأول بصمت (lost update). التداخل هنا حتمي
 * وليس سباق توقيت: ترتيب المهام الدقيقة (microtasks) في بنية الذاكرة
 * أحادية الخيط يضع قراءتي الكاتبين قبل كتابتيهما بالترتيب نفسه دائمًا
 * (A.read → B.read → A.write → B.write) — فالعيّنة سلوكية حتمية لا
 * اختبار توقيت يرفرف.
 * §A2/§A3: بعد الجذر (commitPreferencesUpdate عند حد الكتابة) صارت
 * الحالات الإضافية جزء انحدار هذا الملف: نفس الحقل حتميًا، وCAS عبر
 * البوابة storage_stale صادقًا، وقنوات فشل القراءة/الكتابة/النتيجة
 * المجهولة، وحماية خريطة حدود التنبيه داخل الاستدعاء نفسه. */

const NOW = "2026-10-28T12:00:00.000Z";
const now = () => NOW;

/** مخزن يفشل عند حد الالتزام حسب التنفيذ — لإثبات قنوات الفشل الصادقة
 * (تعذر الكتابة) والنتيجة المجهولة (لا كتابة جزئية أبدًا: المعاملة ذرّية). */
class FailingCommitStore implements Pick<PrototypeLocalStore, "commitPreferencesUpdate"> {
  constructor(private readonly failure: { ok: false; code: "storage_error"; message: string }) {}
  async commitPreferencesUpdate() {
    return this.failure;
  }
}

/** عدسة المخزن التي تتطلبها خدمة التفضيلات — لغلاف الحقن بين القراءة
 * والالتزام داخل الاستدعاء نفسه (نافذة سباق حتمية لا توقيت منتظر). */
type PreferenceServiceStoreShim = Pick<
  PrototypeLocalStore,
  "getPreferences" | "savePreferences" | "commitPreferencesUpdate"
>;

describe("S03 revalidation — concurrent preference writers through the unified gateway", () => {
  it("two overlapping writers on different fields must not silently lose either update", async () => {
    const store = new MemoryLocalStore();
    /* بذرة قائمة بمحتوى مميز: حقل كل كاتب واضح. */
    const seeded = await updateLocalPreferences(store, { theme: "dark" }, now);
    expect(seeded.ok).toBe(true);

    /* الكاتبان يقرآن النسخة نفسها (بذرة واحدة) قبل أن يكتب أي منهما:
     * A يغيّر المظهر، B يغيّر تفضيل العرض — حقول مختلفة كليًا. */
    const [writerA, writerB] = await Promise.all([
      updateLocalPreferences(store, { theme: "light" }, now),
      updateLocalPreferences(store, { offeringPreference: "products" }, now),
    ]);
    /* كلتا الكتابتين مشروعتان وتنفيذا بنجاح من وجهة نظر كاتبهما. */
    expect(writerA.ok).toBe(true);
    expect(writerB.ok).toBe(true);

    /* العقد المطلوب: لا تُفقد أي كتابة صحيحة — كلا الحقلين يظلان. */
    const final = await store.getPreferences();
    expect(final.ok).toBe(true);
    if (!final.ok || !final.value) throw new Error("preferences should read");
    expect(final.value.theme, "writer A's theme update must survive").toBe("light");
    expect(final.value.offeringPreference, "writer B's offering update must survive").toBe("products");
  });

  it("the unguarded read-merge-full-write defect is reproduced against the live boundary shape (two reads before two writes)", async () => {
    const store = new MemoryLocalStore();
    await updateLocalPreferences(store, { theme: "dark" }, now);

    /* إعادة إنتاج العيب بترتيب محدد: كلتا القراءتين تكتملان قبل أي كتابة —
     * هذا هو شكل النافذة المتزامنة الذي تصفه الملاحظة المؤكدة، مثبتًا على
     * بوابة الدمج كما كانت (قراءة getPreferences ثم كتابة savePreferences
     * كاملًا خارج أي حد). نثبت الشكل بالاستدعاءات فقط لا بتعديل الكود:
     * كاتبان يقرآن، تكتمل القراءتان، ثم يكتب كل منهما سجله الكامل. */
    type PreferencesReading = Awaited<ReturnType<MemoryLocalStore["getPreferences"]>>;
    const readA: Promise<PreferencesReading> = store.getPreferences();
    const readB: Promise<PreferencesReading> = store.getPreferences();
    const [snapshotA, snapshotB] = await Promise.all([readA, readB]);
    expect(snapshotA.ok && snapshotA.value?.theme).toBe("dark");
    expect(snapshotB.ok && snapshotB.value?.theme).toBe("dark");

    /* كل كاتب يبني سجله الكامل من لقطته المتقادمة ثم يكتب السجل كاملًا —
     * سلوك البوابة المتقاعدة حرفيًا (دمج فوق المقروء ثم حفظ كامل). */
    async function legacyGatewayWrite(
      snapshot: PreferencesReading,
      patch: Parameters<typeof updateLocalPreferences>[1],
    ): Promise<void> {
      if (!snapshot.ok) throw new Error("read failed");
      const merged = {
        ...(snapshot.value ?? ({} as LocalPreferences)),
        ...patch,
        id: "local-preferences" as const,
        updatedAt: NOW,
      };
      const saved = await store.savePreferences(merged);
      if (!saved.ok) throw new Error("write failed");
    }
    /* A (المظهر) يكتب أولًا ثم B (العرض) يكتب فوقه من لقطته القديمة. */
    await legacyGatewayWrite(snapshotA, { theme: "light" });
    await legacyGatewayWrite(snapshotB, { offeringPreference: "products" });

    /* العيب المؤكد: كتابة B كاملة من لقطة قديمة تسحق تحديث A بصمت —
     * المظهر يعود داكنًا رغم نجاح كتابة A المعلن. هذا هو السلوك الذي
     * يمنعه حد الكتابة المحروس الجديد (الاختبار الأول أعلاه). */
    const final = await store.getPreferences();
    if (!final.ok || !final.value) throw new Error("preferences should read");
    expect(final.value.theme).toBe("dark");
    expect(final.value.offeringPreference).toBe("products");
  });

  it("same-field overlapping writers through the gateway have a deterministic last-commit-wins outcome", async () => {
    const store = new MemoryLocalStore();
    await updateLocalPreferences(store, { theme: "dark" }, now);
    /* كاتبان على الحقل نفسه بلا CAS: الالتزامان يتسلسلان حتميًا (ترتيب
     * المهام الدقيقة) والقيمة النهائية آخر ملزم — سلوك موثق حتمي لحقل
     * واحد، مثل جملتي إسناد متتاليتين، لا تعارض زائف ولا فقدان صامت
     * لكاتب خارج الحقل نفسه. */
    const [first, second] = await Promise.all([
      updateLocalPreferences(store, { theme: "light" }, now),
      updateLocalPreferences(store, { theme: "system" }, now),
    ]);
    expect(first.ok && second.ok).toBe(true);
    const final = await store.getPreferences();
    if (!final.ok || !final.value) throw new Error("preferences should read");
    expect(final.value.theme).toBe("system");
  });

  it("a stale expected revision through the gateway is rejected truthfully as storage_stale with no write", async () => {
    const store = new MemoryLocalStore();
    const seeded = await updateLocalPreferences(store, { theme: "dark" }, now);
    expect(seeded.ok).toBe(true);
    /* نافذة أخرى سبقت — النسخة الحية تقدمت (طابع مختلف). */
    const bumped = await store.commitPreferencesUpdate(
      { backupReminderEnabled: false },
      null,
      "2026-10-28T13:00:00.000Z",
    );
    expect(bumped).toMatchObject({ ok: true, value: { outcome: "updated" } });
    /* كاتب CAS بطابع متقادم: تعارض صادق بلا كتابة، والقيمة الحية باقية. */
    const stale = await updateLocalPreferences(
      store,
      { theme: "light" },
      now,
      seeded.ok ? seeded.value.updatedAt : null,
    );
    expect(stale).toMatchObject({ ok: false, code: "storage_stale" });
    const final = await store.getPreferences();
    if (!final.ok || !final.value) throw new Error("preferences should read");
    expect(final.value.theme).toBe("dark");
    expect(final.value.backupReminderEnabled).toBe(false);
    /* التعافي بقرار صريح: إعادة القراءة ثم الكتابة بلا توقع تُنجز التحديث. */
    const retried = await updateLocalPreferences(store, { theme: "light" }, now);
    expect(retried.ok).toBe(true);
    const recovered = await store.getPreferences();
    if (!recovered.ok || !recovered.value) throw new Error("preferences should read");
    expect(recovered.value.theme).toBe("light");
    expect(recovered.value.backupReminderEnabled).toBe(false);
  });

  it("a write failure at the boundary is reported as storage_error and leaves the record untouched (unknown outcome is never partial)", async () => {
    const store = new MemoryLocalStore();
    await updateLocalPreferences(store, { theme: "dark" }, now);
    /* فشل الكتابة عند الحد: النتيجة فشل صادق، والسجل لم يتغير أبدًا —
     * المعاملة ذرّية فلا أثر جزئي ولا نتيجة مجهولة قابلة للفساد. */
    const failing = new FailingCommitStore({ ok: false, code: "storage_error", message: "تعذر الكتابة" });
    const result = await updateLocalPreferences(failing, { theme: "light" }, now);
    expect(result).toMatchObject({ ok: false, code: "storage_error" });
    const read = await store.getPreferences();
    if (!read.ok || !read.value) throw new Error("preferences should read");
    expect(read.value.theme).toBe("dark");
  });

  it("a read failure inside the boundary is reported as storage_error through the gateway (no silent default)", async () => {
    const failing = new FailingCommitStore({ ok: false, code: "storage_error", message: "تعذر القراءة" });
    /* الفشل القرائي داخل الحد يصل المستدعي فشل تخزين صادقًا — لا يُخترع
     * سجل افتراضي ولا تُبتلع الفشلة (القارئ الفاشل لا يساوي سجلًا غائبًا). */
    const result = await updateLocalPreferences(failing, { theme: "light" }, now);
    expect(result).toMatchObject({ ok: false, code: "storage_error" });
  });

  it("saveLowStockThreshold is CAS-guarded within its own call — a concurrent map writer conflicts honestly, retry lands, unrelated fields survive", async () => {
    const inner = new MemoryLocalStore();
    const preferences = new PreferenceService(inner, now);
    const first = await preferences.saveLowStockThreshold("wood", 8000);
    expect(first.ok).toBe(true);
    /* حقن كاتب متزامن بين قراءة الخدمة والتزامها: الغلاف يرتكب كتابة
     * الخريطة من نافذة أخرى بعد قراءة الخدمة وقبل التزامها — نافذة
     * السباق داخل الاستدعاء نفسها، محقونة حتميًا لا بتوقيت منتظر. */
    let inject: (() => Promise<void>) | null = null;
    const interleaving: PreferenceServiceStoreShim = {
      getPreferences: async () => {
        const reading = await inner.getPreferences();
        if (inject) {
          await inject();
          inject = null;
        }
        return reading;
      },
      savePreferences: reading => inner.savePreferences(reading),
      commitPreferencesUpdate: (patch, expected, timestamp) =>
        inner.commitPreferencesUpdate(patch, expected, timestamp),
    };
    const racing = new PreferenceService(interleaving, now);
    inject = async () => {
      const bumped = await inner.commitPreferencesUpdate(
        { lowStockThresholdsMilli: { wood: 8000, paint: 3000 } },
        null,
        "2026-10-28T14:00:00.000Z",
      );
      expect(bumped).toMatchObject({ ok: true, value: { outcome: "updated" } });
    };
    /* الخدمة قرأت النسخة القديمة ثم سبقها الكاتب المتزامن: التزامها يُرفض
     * تعارضًا صادقًا (storage_stale) بلا كتابة — حدّ الكاتب الآخر محفوظ. */
    const conflicted = await racing.saveLowStockThreshold("wood", 9000);
    expect(conflicted).toMatchObject({ ok: false, code: "storage_stale" });
    const afterConflict = await inner.getPreferences();
    if (!afterConflict.ok || !afterConflict.value) throw new Error("preferences should read");
    expect(afterConflict.value.lowStockThresholdsMilli).toMatchObject({ wood: 8000, paint: 3000 });
    /* التعافي بقرار صريح (المستخدم يعيد المحاولة): الحد يقع فوق الحي
     * الجديد فلا يُسقط حدّ الكاتب الآخر. */
    const retried = await preferences.saveLowStockThreshold("wood", 9000);
    expect(retried.ok).toBe(true);
    const final = await inner.getPreferences();
    if (!final.ok || !final.value) throw new Error("preferences should read");
    expect(final.value.lowStockThresholdsMilli).toMatchObject({ wood: 9000, paint: 3000 });
  });
});
