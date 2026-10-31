import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { MemoryLocalStore } from "./MemoryLocalStore";
import { localProfileId, type ActivityProfile } from "./types";

/* U001-IR-002 (مراجعة مستقلة 2026-10-18): إنشاء ملف الهوية كتابةً أولى فقط
 * ذرّيًا عند حد الكتابة — القراءة والكتابة في معاملة IndexedDB واحدة (نفس
 * عقد commitScheduleCreate): الغائب يُنشأ مرة، والحاضر يُعاد كما هو بلا
 * كتابة فوقه، واستدعاءان متزامنان لا يطمس أحدهما الآخر أبدًا؛ ومطابقة
 * المحوّلين (IndexedDB/الذاكرة) على العقد نفسه بالضبط.
 * S03 (UNIT-039 B2/عقد §17 «نافذتان تعدلان المصدر»): تعديل الاسم حدُّ كتابة
 * محروس ثانٍ على الملف نفسه — قراءة ومقارنة نسخة وكتابة داخل معاملة واحدة:
 * تطابق updatedAt المتوقع يكتب، واختلافه أو غياب الملف تعارض صادق بلا كتابة؛
 * النتيجة مميّزة النوع (renamed ⟹ ملف، conflict ⟹ ملف أو null). */

const databaseName = "micro-prototype-local";
afterEach(() => {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(databaseName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
});

function profileFixture(activityName: string, updatedAt: string): ActivityProfile {
  return {
    id: localProfileId,
    activityName,
    currency: "JOD",
    activityType: "custom_craft",
    createdAt: "2026-10-18T00:00:00.000Z",
    updatedAt,
  };
}

describe("IndexedDbLocalStore.commitProfileCreate — atomic create-if-absent (U001-IR-002)", () => {
  it("creates the profile when absent (reused:false) and getProfile reads it back", async () => {
    const store = new IndexedDbLocalStore();
    const created = await store.commitProfileCreate(
      profileFixture("ورشة الأولى", "2026-10-18T00:00:00.000Z"),
    );
    expect(created).toMatchObject({
      ok: true,
      value: { reused: false, profile: { id: "local-profile", activityName: "ورشة الأولى" } },
    });
    const stored = await store.getProfile();
    expect(stored).toMatchObject({ ok: true, value: { id: "local-profile", activityName: "ورشة الأولى" } });
  });

  it("returns the stored profile untouched when present (reused:true) — no overwrite, no timestamp drift", async () => {
    const store = new IndexedDbLocalStore();
    await store.saveProfile(profileFixture("الهوية القائمة", "2026-10-18T00:00:00.000Z"));
    const attempted = await store.commitProfileCreate(
      profileFixture("هوية مغايرة تمامًا", "2026-10-18T05:00:00.000Z"),
    );
    expect(attempted).toMatchObject({
      ok: true,
      value: {
        reused: true,
        profile: { activityName: "الهوية القائمة", updatedAt: "2026-10-18T00:00:00.000Z" },
      },
    });
    const stored = await store.getProfile();
    expect(stored).toMatchObject({
      ok: true,
      value: { activityName: "الهوية القائمة", updatedAt: "2026-10-18T00:00:00.000Z" },
    });
  });

  it("two concurrent creates interleave safely — exactly one write and the winner is never overwritten", async () => {
    const store = new IndexedDbLocalStore();
    const [first, second] = await Promise.all([
      store.commitProfileCreate(profileFixture("الفائز", "2026-10-18T00:00:00.000Z")),
      store.commitProfileCreate(profileFixture("الخاسر المتزامن", "2026-10-18T00:00:00.000Z")),
    ]);
    const outcomes = [first, second].map(result =>
      result.ok
        ? { reused: result.value.reused, name: result.value.profile.activityName }
        : { reused: null, name: null },
    );
    /* هوية واحدة بالضبط: فائز واحد (reused:false) وخاسر واحد يعيد المخزّن نفسه. */
    expect(outcomes.filter(o => o.reused === false)).toHaveLength(1);
    expect(outcomes.filter(o => o.reused === true)).toHaveLength(1);
    const winner = outcomes.find(o => o.reused === false)!.name;
    const loser = outcomes.find(o => o.reused === true)!;
    expect(loser.name).toBe(winner);
    const stored = await store.getProfile();
    expect(stored).toMatchObject({ ok: true, value: { id: "local-profile", activityName: winner } });
  });

  it("adapter parity with MemoryLocalStore — same create/reuse/concurrency outcomes on both adapters", async () => {
    for (const store of [new IndexedDbLocalStore(), new MemoryLocalStore()]) {
      const absent = await store.commitProfileCreate(profileFixture("إنشاء أول", "2026-10-18T00:00:00.000Z"));
      expect(absent).toMatchObject({ ok: true, value: { reused: false } });
      const present = await store.commitProfileCreate(
        profileFixture("إنشاء ثانٍ مغاير", "2026-10-18T02:00:00.000Z"),
      );
      expect(present).toMatchObject({
        ok: true,
        value: { reused: true, profile: { activityName: "إنشاء أول" } },
      });
      const concurrent = await Promise.all([
        store.commitProfileCreate(profileFixture("واحد", "2026-10-18T03:00:00.000Z")),
        store.commitProfileCreate(profileFixture("اثنان", "2026-10-18T03:00:00.000Z")),
      ]);
      const reuses = concurrent.map(result => (result.ok ? result.value.reused : null));
      expect(reuses.filter(r => r === false)).toHaveLength(0);
      expect(reuses.filter(r => r === true)).toHaveLength(2);
      const stored = await store.getProfile();
      expect(stored).toMatchObject({ ok: true, value: { activityName: "إنشاء أول" } });
    }
  });
});

/* S03 (UNIT-039 B2/عقد §17): تعديل الاسم عند حد الكتابة — فحص النسخة الحية
 * داخل المعاملة نفسها على المحوّلين معًا: النجاح يغيّر الاسم وحده، والتعارض
 * (نافذة أخرى سبقت أو غاب الملف) بلا كتابة، والتزامن يُنتج فائزًا واحدًا
 * فقط — لا lost update ولا إنشاء من مسار التعديل أبدًا. */
describe("commitProfileRename — guarded CAS rename at the write boundary (S03/عقد §17)", () => {
  it("renames when the expected version matches — same id and createdAt, new name and updatedAt", async () => {
    const store = new IndexedDbLocalStore();
    await store.saveProfile(profileFixture("الاسم القائم", "2026-10-28T00:00:00.000Z"));
    const renamed = await store.commitProfileRename(
      profileFixture("الاسم الجديد", "2026-10-28T01:00:00.000Z"),
      "2026-10-28T00:00:00.000Z",
    );
    expect(renamed).toMatchObject({
      ok: true,
      value: { outcome: "renamed", profile: { id: "local-profile", activityName: "الاسم الجديد" } },
    });
    const stored = await store.getProfile();
    expect(stored).toMatchObject({
      ok: true,
      value: {
        activityName: "الاسم الجديد",
        createdAt: "2026-10-18T00:00:00.000Z",
        updatedAt: "2026-10-28T01:00:00.000Z",
      },
    });
  });

  it("a stale expected version conflicts without writing — the newer name survives", async () => {
    const store = new IndexedDbLocalStore();
    await store.saveProfile(profileFixture("الأحدث من نافذة أخرى", "2026-10-28T05:00:00.000Z"));
    const stale = await store.commitProfileRename(
      profileFixture("اسم قديم متقادم", "2026-10-28T06:00:00.000Z"),
      "2026-10-28T00:00:00.000Z",
    );
    expect(stale).toMatchObject({
      ok: true,
      value: {
        outcome: "conflict",
        profile: { activityName: "الأحدث من نافذة أخرى", updatedAt: "2026-10-28T05:00:00.000Z" },
      },
    });
    const stored = await store.getProfile();
    expect(stored).toMatchObject({
      ok: true,
      value: { activityName: "الأحدث من نافذة أخرى", updatedAt: "2026-10-28T05:00:00.000Z" },
    });
  });

  it("an absent profile file conflicts with null — the rename path never creates a file", async () => {
    const store = new IndexedDbLocalStore();
    const result = await store.commitProfileRename(
      profileFixture("أي اسم", "2026-10-28T01:00:00.000Z"),
      "2026-10-28T00:00:00.000Z",
    );
    expect(result).toMatchObject({ ok: true, value: { outcome: "conflict", profile: null } });
    await expect(store.getProfile()).resolves.toMatchObject({ ok: true, value: null });
  });

  it("two concurrent renames from the same base — exactly one wins and the loser conflicts on the winner's version", async () => {
    const store = new IndexedDbLocalStore();
    await store.saveProfile(profileFixture("الأساس", "2026-10-28T00:00:00.000Z"));
    const [first, second] = await Promise.all([
      store.commitProfileRename(
        profileFixture("الفائز", "2026-10-28T01:00:00.000Z"),
        "2026-10-28T00:00:00.000Z",
      ),
      store.commitProfileRename(
        profileFixture("الخاسر", "2026-10-28T02:00:00.000Z"),
        "2026-10-28T00:00:00.000Z",
      ),
    ]);
    const outcomes = [first, second].map(result => (result.ok ? result.value : null));
    expect(outcomes.filter(o => o?.outcome === "renamed")).toHaveLength(1);
    expect(outcomes.filter(o => o?.outcome === "conflict")).toHaveLength(1);
    const winner = outcomes.find(o => o?.outcome === "renamed")!.profile;
    const stored = await store.getProfile();
    expect(stored).toMatchObject({
      ok: true,
      value: { activityName: winner.activityName, updatedAt: winner.updatedAt },
    });
  });

  it("adapter parity with MemoryLocalStore — same rename/conflict/absent/concurrency outcomes on both adapters", async () => {
    for (const store of [new IndexedDbLocalStore(), new MemoryLocalStore()]) {
      await store.saveProfile(profileFixture("الاسم", "2026-10-28T00:00:00.000Z"));
      const renamed = await store.commitProfileRename(
        profileFixture("الاسم بعد التعديل", "2026-10-28T01:00:00.000Z"),
        "2026-10-28T00:00:00.000Z",
      );
      expect(renamed).toMatchObject({
        ok: true,
        value: { outcome: "renamed", profile: { activityName: "الاسم بعد التعديل" } },
      });
      const stale = await store.commitProfileRename(
        profileFixture("تعديل متقادم", "2026-10-28T02:00:00.000Z"),
        "2026-10-28T00:00:00.000Z",
      );
      expect(stale).toMatchObject({
        ok: true,
        value: { outcome: "conflict", profile: { activityName: "الاسم بعد التعديل" } },
      });
      const concurrent = await Promise.all([
        store.commitProfileRename(
          profileFixture("واحد", "2026-10-28T03:00:00.000Z"),
          "2026-10-28T01:00:00.000Z",
        ),
        store.commitProfileRename(
          profileFixture("اثنان", "2026-10-28T04:00:00.000Z"),
          "2026-10-28T01:00:00.000Z",
        ),
      ]);
      const concurrentOutcomes = concurrent.map(result => (result.ok ? result.value.outcome : null));
      expect(concurrentOutcomes.filter(o => o === "renamed")).toHaveLength(1);
      expect(concurrentOutcomes.filter(o => o === "conflict")).toHaveLength(1);
      const stored = await store.getProfile();
      expect(stored).toMatchObject({ ok: true, value: { createdAt: "2026-10-18T00:00:00.000Z" } });
    }
  });
});
