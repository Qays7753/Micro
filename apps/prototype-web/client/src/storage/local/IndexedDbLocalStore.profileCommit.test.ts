import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { IndexedDbLocalStore } from "./IndexedDbLocalStore";
import { MemoryLocalStore } from "./MemoryLocalStore";
import { localProfileId, type ActivityProfile } from "./types";

/* U001-IR-002 (مراجعة مستقلة 2026-10-18): إنشاء ملف الهوية كتابةً أولى فقط
 * ذرّيًا عند حد الكتابة — القراءة والكتابة في معاملة IndexedDB واحدة (نفس
 * عقد commitScheduleCreate): الغائب يُنشأ مرة، والحاضر يُعاد كما هو بلا
 * كتابة فوقه، واستدعاءان متزامنان لا يطمس أحدهما الآخر أبدًا؛ ومطابقة
 * المحوّلين (IndexedDB/الذاكرة) على العقد نفسه بالضبط. */

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
