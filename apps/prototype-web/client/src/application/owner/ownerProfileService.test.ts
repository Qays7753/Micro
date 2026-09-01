import { describe, expect, it } from "vitest";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { OwnerProfileService, isValidEmail, normalizeDisplayName } from "./ownerProfileService";

describe("OwnerProfileService", () => {
  it("ensureLocal ينشئ هوية محلية ثابتة مرة واحدة فقط", async () => {
    const store = new MemoryLocalStore();
    const service = new OwnerProfileService(store, () => "2026-09-02T00:00:00.000Z");
    const first = await service.ensureLocal();
    expect(first.ok).toBe(true);
    const ownerId = first.ok ? first.value?.ownerId : undefined;
    expect(ownerId).toMatch(/^owner-.+/);
    const second = await service.ensureLocal();
    expect(second.ok).toBe(true);
    // المعرف ثابت — الإنشاء لا يتكرر ولا يولّد هوية جديدة.
    expect(second.ok && second.value?.ownerId).toBe(ownerId);
    // الحقول المستقبلية فارغة دائمًا في هذه المرحلة.
    expect(first.ok && first.value?.provider).toBeNull();
    expect(first.ok && first.value?.externalAccountId).toBeNull();
  });

  it("save يحفظ الاسم والبريد الاختياريين ويرفض البريد المعطوب", async () => {
    const store = new MemoryLocalStore();
    const service = new OwnerProfileService(store, () => "2026-09-02T00:00:00.000Z");
    await service.ensureLocal();
    const saved = await service.save({ displayName: "  ليان  ", email: "layan@example.com" });
    expect(saved.ok).toBe(true);
    expect(saved.ok && saved.value.displayName).toBe("ليان");
    expect(saved.ok && saved.value.email).toBe("layan@example.com");
    const bad = await service.save({ displayName: "ليان", email: "ليس-بريدًا" });
    expect(bad.ok).toBe(false);
    const bad2 = await service.save({ displayName: "x", email: "no-at-sign" });
    expect(bad2.ok).toBe(false);
  });

  it("save يحفظ القيم الفارغة كـ null لا كنص فارغ", async () => {
    const store = new MemoryLocalStore();
    const service = new OwnerProfileService(store);
    const saved = await service.save({ displayName: "   ", email: "" });
    expect(saved.ok).toBe(true);
    expect(saved.ok && saved.value.displayName).toBeNull();
    expect(saved.ok && saved.value.email).toBeNull();
  });

  it("save لا يغيّر المعرف المحلي الثابت بعد الإنشاء", async () => {
    const store = new MemoryLocalStore();
    const service = new OwnerProfileService(store);
    const ensured = await service.ensureLocal();
    const original = ensured.ok ? ensured.value?.ownerId : null;
    await service.save({ displayName: "اسم", email: null });
    const reread = await service.read();
    expect(reread.ok && reread.value?.ownerId).toBe(original);
  });

  it("ملف المالك يدخل التصدير ويبقى بعد الاستيراد (دورة كاملة)", async () => {
    const store = new MemoryLocalStore();
    const service = new OwnerProfileService(store);
    await service.save({ displayName: "أم عبد", email: null });
    const snapshot = await store.readSnapshot();
    expect(snapshot.ok && snapshot.value.ownerProfile?.displayName).toBe("أم عبد");
    const restored = new MemoryLocalStore();
    await restored.replaceSnapshot(snapshot.ok ? snapshot.value : { profile: null, preferences: null, drafts: [], orders: [], schedules: [], financialEvents: [] });
    const reread = await restored.getOwnerProfile();
    expect(reread.ok && reread.value?.displayName).toBe("أم عبد");
  });

  it("normalizeDisplayName و isValidEmail سلوكهما صريح", () => {
    expect(normalizeDisplayName("  ")).toBeNull();
    expect(normalizeDisplayName("اسم")).toBe("اسم");
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@c.com")).toBe(false);
  });
});
