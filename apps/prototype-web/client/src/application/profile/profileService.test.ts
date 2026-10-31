import { describe, expect, it } from "vitest";
import { ProfileService } from "./profileService";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";

/* S03 (UNIT-039 A1/B2 — عقد §17 «نافذتان تعدلان المصدر»): rename هو حد
 * كتابة الاسم الوحيد بعد تقاعد save غير المحروس — نجاح مثبت، أو تعارض
 * نسخة صادق يعيد الحالة الحالية بلا كتابة، أو فشل تخزين بلا أثر. */
describe("ProfileService.rename — guarded identity rename (S03/عقد §17)", () => {
  it("rejects an empty name before any read or write (validation honest, no storage touch)", async () => {
    const store = new MemoryLocalStore();
    const service = new ProfileService(store, () => "2026-10-28T00:00:00.000Z");
    await expect(service.rename("   ", "2026-10-28T00:00:00.000Z")).resolves.toMatchObject({
      ok: false,
      code: "validation_error",
      message: "اسم المشروع: اكتب اسم مشروعك، أو ألغِ التعديل.",
    });
    await expect(store.getProfile()).resolves.toMatchObject({ ok: true, value: null });
  });

  it("renames the existing identity with the trimmed name — same id and createdAt, new updatedAt", async () => {
    const store = new MemoryLocalStore();
    let timestamp = "2026-10-27T00:00:00.000Z";
    const service = new ProfileService(store, () => timestamp);
    const created = await service.create("مشغل ليان");
    if (!created.ok) throw new Error(created.message);
    timestamp = "2026-10-28T01:00:00.000Z";
    const renamed = await service.rename("  مشغل ليان للحرف  ", created.profile.updatedAt);
    expect(renamed).toMatchObject({
      ok: true,
      outcome: "renamed",
      profile: {
        id: "local-profile",
        activityName: "مشغل ليان للحرف",
        createdAt: created.profile.createdAt,
        updatedAt: "2026-10-28T01:00:00.000Z",
      },
    });
    const stored = await store.getProfile();
    expect(stored).toMatchObject({
      ok: true,
      value: { activityName: "مشغل ليان للحرف", createdAt: created.profile.createdAt },
    });
  });

  it("a stale expected version is an honest conflict — the newer saved name survives untouched", async () => {
    const store = new MemoryLocalStore();
    let timestamp = "2026-10-28T00:00:00.000Z";
    const service = new ProfileService(store, () => timestamp);
    const created = await service.create("الاسم الأصلي");
    if (!created.ok) throw new Error(created.message);
    /* نافذة أخرى تعدّل الاسم أولًا (بعد فتح محررنا) — محررنا يحمل النسخة القديمة. */
    const staleExpected = created.profile.updatedAt;
    timestamp = "2026-10-28T02:00:00.000Z";
    const otherWindow = await service.rename("اسم أحدث من نافذة أخرى", staleExpected);
    if (!otherWindow.ok || otherWindow.outcome !== "renamed") throw new Error("setup rename failed");
    timestamp = "2026-10-28T03:00:00.000Z";
    const stale = await service.rename("اسم محررنا القديم", staleExpected);
    expect(stale).toMatchObject({
      ok: true,
      outcome: "conflict",
      profile: { activityName: "اسم أحدث من نافذة أخرى" },
    });
    const stored = await store.getProfile();
    expect(stored).toMatchObject({
      ok: true,
      value: { activityName: "اسم أحدث من نافذة أخرى", updatedAt: "2026-10-28T02:00:00.000Z" },
    });
  });

  it("a missing profile file is an honest conflict with null — never a creation from the rename path", async () => {
    const store = new MemoryLocalStore();
    const service = new ProfileService(store, () => "2026-10-28T00:00:00.000Z");
    const result = await service.rename("أي اسم", "2026-10-28T00:00:00.000Z");
    expect(result).toMatchObject({
      ok: true,
      outcome: "conflict",
      profile: null,
    });
    await expect(store.getProfile()).resolves.toMatchObject({ ok: true, value: null });
  });

  it("a storage write failure is reported honestly — no partial rename and retry keeps the same expected version", async () => {
    const store = new MemoryLocalStore();
    const service = new ProfileService(store, () => "2026-10-28T00:00:00.000Z");
    const created = await service.create("الاسم القائم");
    if (!created.ok) throw new Error(created.message);
    const original = store.commitProfileRename.bind(store);
    store.commitProfileRename = (async () => ({
      ok: false,
      code: "storage_error",
      message: "write failed",
    })) as never;
    await expect(service.rename("اسم جديد", created.profile.updatedAt)).resolves.toMatchObject({
      ok: false,
      code: "storage_error",
      message: "لم يتم حفظ اسم المشروع على هذا الجهاز. تحقق من مساحة التخزين ثم أعد المحاولة.",
    });
    store.commitProfileRename = original;
    /* الفشل بلا كتابة: النسخة المتوقعة نفسها تبقى صالحة لإعادة المحاولة. */
    const retry = await service.rename("اسم جديد", created.profile.updatedAt);
    expect(retry).toMatchObject({ ok: true, outcome: "renamed", profile: { activityName: "اسم جديد" } });
  });

  it("a profile read failure is an honest storage error — never treated as a rename or a conflict", async () => {
    const store = new MemoryLocalStore();
    const service = new ProfileService(store, () => "2026-10-28T00:00:00.000Z");
    const original = store.getProfile.bind(store);
    store.getProfile = (async () => ({
      ok: false,
      code: "storage_error",
      message: "read failed",
    })) as never;
    await expect(service.rename("اسم", "2026-10-28T00:00:00.000Z")).resolves.toMatchObject({
      ok: false,
      code: "storage_error",
      message: "تعذر قراءة التأسيس المحلي. حاول مرة أخرى.",
    });
    store.getProfile = original;
  });
});

/* UNIT-001 V2 (DUP-002/R02/R07): الإنشاء وحده — create() مسار idempotent
 * لا يعدّل هوية قائمة أبدًا؛ التعديل ملك 039 عبر rename المحروس (S03). */
describe("ProfileService.create — UNIT-001 single-identity create path", () => {
  it("creates once when absent and reports created=true with the trimmed name", async () => {
    const store = new MemoryLocalStore();
    const service = new ProfileService(store, () => "2026-10-18T00:00:00.000Z");
    const result = await service.create("  حلويات ليان  ");
    expect(result).toMatchObject({
      ok: true,
      created: true,
      profile: {
        id: "local-profile",
        activityName: "حلويات ليان",
        currency: "JOD",
        activityType: "custom_craft",
        createdAt: "2026-10-18T00:00:00.000Z",
        updatedAt: "2026-10-18T00:00:00.000Z",
      },
    });
  });

  it("an existing identity is returned untouched — never edited, never duplicated (DUP-002)", async () => {
    const store = new MemoryLocalStore();
    let timestamp = "2026-10-18T00:00:00.000Z";
    const service = new ProfileService(store, () => timestamp);
    await service.create("حلويات ليان");
    timestamp = "2026-10-18T02:00:00.000Z";
    const second = await service.create("اسم آخر تمامًا");
    expect(second).toMatchObject({
      ok: true,
      created: false,
      profile: { activityName: "حلويات ليان", updatedAt: "2026-10-18T00:00:00.000Z" },
    });
    const stored = await store.getProfile();
    expect(stored).toMatchObject({
      ok: true,
      value: { activityName: "حلويات ليان", updatedAt: "2026-10-18T00:00:00.000Z" },
    });
  });

  it("rejects an empty name before any write and a failed atomic commit never becomes a write", async () => {
    const store = new MemoryLocalStore();
    const service = new ProfileService(store, () => "2026-10-18T00:00:00.000Z");
    await expect(service.create("   ")).resolves.toMatchObject({
      ok: false,
      code: "validation_error",
    });
    await expect(store.getProfile()).resolves.toMatchObject({ ok: true, value: null });
    /* U001-IR-002: فشل الحد الذرّي (قراءة داخل الكتابة أو كتابة) فشل صريح —
     * لا كتابة بديلة ولا هوية نصفية بعده. */
    const originalCommit = store.commitProfileCreate.bind(store);
    store.commitProfileCreate = (async () => ({
      ok: false,
      code: "storage_error",
      message: "commit read failed",
    })) as never;
    await expect(service.create("مشروع")).resolves.toMatchObject({
      ok: false,
      code: "storage_error",
    });
    store.commitProfileCreate = originalCommit;
    await expect(store.getProfile()).resolves.toMatchObject({ ok: true, value: null });
  });

  it("a failed write is reported honestly — no partial identity and no success claim", async () => {
    const store = new MemoryLocalStore();
    const service = new ProfileService(store, () => "2026-10-18T00:00:00.000Z");
    store.commitProfileCreate = (async () => ({
      ok: false,
      code: "storage_error",
      message: "write failed",
    })) as never;
    await expect(service.create("مشروع")).resolves.toMatchObject({
      ok: false,
      code: "storage_error",
      message: "لم يتم حفظ التأسيس على هذا الجهاز. تحقق من مساحة التخزين ثم أعد المحاولة.",
    });
    expect((await store.getProfile()).ok).toBe(true);
  });
});

/* U001-IR-002 (مراجعة مستقلة 2026-10-18): الإنشاء ذرّي عبر حد الكتابة —
 * استدعاءان متزامنان باسمين مختلفين: هوية واحدة بالضبط تبقى والفائز لا
 * يُطمس أبدًا، والخاسر يستعيد الهوية القائمة بـcreated:false صادق لا كتابة
 * فوقها (عقد ٣٦ نفسه عند حد الهوية — نفس عقد commitScheduleCreate). */
describe("ProfileService.create — atomic across concurrent callers (U001-IR-002)", () => {
  it("two concurrent creates keep exactly one identity — the winner is never silently overwritten", async () => {
    const store = new MemoryLocalStore();
    const service = new ProfileService(store, () => "2026-10-18T00:00:00.000Z");
    const [first, second] = await Promise.all([
      service.create("ورشة الأولى"),
      service.create("متجر مختلف تمامًا"),
    ]);
    expect(first).toMatchObject({ ok: true, created: true, profile: { activityName: "ورشة الأولى" } });
    expect(second).toMatchObject({
      ok: true,
      created: false,
      profile: { activityName: "ورشة الأولى" },
    });
    /* هوية واحدة بالضبط بمفتاح ثابت واحد — الفائز باقٍ حرفيًا. */
    const stored = await store.getProfile();
    expect(stored).toMatchObject({
      ok: true,
      value: { id: "local-profile", activityName: "ورشة الأولى", createdAt: "2026-10-18T00:00:00.000Z" },
    });
  });

  it("the losing caller is told the truth — the existing profile is returned untouched, never a second identity", async () => {
    const store = new MemoryLocalStore();
    let timestamp = "2026-10-18T00:00:00.000Z";
    const service = new ProfileService(store, () => timestamp);
    await service.create("الهوية الأصلية");
    timestamp = "2026-10-18T03:00:00.000Z";
    const concurrent = await Promise.all([
      service.create("محاولة طمس متزامنة"),
      service.create("محاولة طمس متزامنة ثانية"),
    ]);
    expect(concurrent).toHaveLength(2);
    for (const attempt of concurrent) {
      expect(attempt).toMatchObject({
        ok: true,
        created: false,
        profile: { activityName: "الهوية الأصلية", updatedAt: "2026-10-18T00:00:00.000Z" },
      });
    }
    const stored = await store.getProfile();
    expect(stored).toMatchObject({
      ok: true,
      value: { activityName: "الهوية الأصلية", updatedAt: "2026-10-18T00:00:00.000Z" },
    });
  });

  it("a failed atomic commit is reported honestly and never becomes an identity", async () => {
    const store = new MemoryLocalStore();
    const service = new ProfileService(store, () => "2026-10-18T00:00:00.000Z");
    store.commitProfileCreate = (async () => ({
      ok: false,
      code: "storage_error",
      message: "commit failed",
    })) as never;
    const [first, second] = await Promise.all([service.create("أول"), service.create("ثانٍ")]);
    expect(first).toMatchObject({ ok: false, code: "storage_error" });
    expect(second).toMatchObject({ ok: false, code: "storage_error" });
    expect(await store.getProfile()).toMatchObject({ ok: true, value: null });
  });
});
