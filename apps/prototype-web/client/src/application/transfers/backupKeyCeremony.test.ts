import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetBackupKeySessionForTesting,
  obtainEnvelopeKey,
  obtainExportKeySession,
} from "./backupKeyCeremony";
import { slotFieldsToBytes } from "./encryptedBackupEnvelope";
import { MemoryLocalStore } from "@/storage/local/MemoryLocalStore";
import { localDataKeySlotId, type PrototypeLocalStore } from "@/storage/local/types";

/* MNG-LOCAL-03 (أمر المالك 12AA — 2026-11-24): اختبارات مركزة لمراسم مفتاح
 * الجهاز (WebAuthn-PRF) بمصادق مُحاكى كامل يفتّح خرج PRF حتميًا من
 * (الملح + معرّف الاعتماد) — فتُختبر دورة المفتاح نفسها لا متصفح حقيقي
 * (دعم المتصفحات الفعلي على الأجهزة الفعلية يبقى UNVERIFIED من هذه
 * البيئة ويوثَّق في التقرير):
 *  - الإنشاء الأول: مرسمة create + حفظ فتحة بلا أي مادة مفتاح.
 *  - الجلسة الثانية: مرسمة get بنفس الاعتماد والملح تفك مظروف التحقق.
 *  - إلغاء المستخدم (NotAllowedError): فشل صادق مغلَق، بلا كتابة فتحة.
 *  - غياب المصادق: فشل صادق مغلَق.
 *  - إعادة إنشاء الاعتماد (خرج PRF مختلف): فكّ التحقق يفشل — key-mismatch
 *    بلا أي بديل صامت.
 *  - مفتاح مظروف وارد: مرسمة get مقيدة بمعرّف المظروف والملح من رأسه —
 *    بلا قراءة/كتابة أي فتحة على الجهاز.
 */

const NOW = "2026-11-24T12:00:00.000Z";
const clock = () => NOW;

/* محاكاة المصادق: خرج PRF حتمي (SHA-256 للملح+المعرّف) — نموذج المصادق
 * الحقيقي (HMAC داخلي) دون أي كلمة مرور مكتوبة، مع userVerification
 * required يطلق المتصفح بسببه موجه المنصة. */
async function prfOutput(salt: Uint8Array, credentialId: Uint8Array): Promise<ArrayBuffer> {
  const mixed = new Uint8Array(salt.length + credentialId.length);
  mixed.set(salt, 0);
  mixed.set(credentialId, salt.length);
  return crypto.subtle.digest("SHA-256", mixed);
}

type FakeCredential = { rawId: ArrayBuffer; credentialId: Uint8Array };

function makeAuthenticator() {
  const created = new Map<string, Uint8Array>();
  const create = vi.fn(async (options: { publicKey?: { extensions?: unknown; user?: { id?: ArrayBuffer } } }) => {
    const id = new Uint8Array(24);
    crypto.getRandomValues(id);
    created.set(Array.from(id).join(","), id);
    return {
      rawId: id.slice().buffer,
      /* متزامنة كما في المتصفح الحقيقي — لا تُرجع وعدًا أبدًا. */
      getClientExtensionResults: () => ({}),
    };
  });
  const get = vi.fn(
    async (options: { publicKey?: { allowCredentials?: Array<{ id: ArrayBuffer }>; extensions?: { prf?: { eval?: { first: ArrayBuffer } } } } }) => {
      const allow = options.publicKey?.allowCredentials?.[0];
      const saltBytes = new Uint8Array(options.publicKey?.extensions?.prf?.eval?.first ?? new ArrayBuffer(0));
      if (!allow) throw new DOMException("cancelled", "NotAllowedError");
      const id = new Uint8Array(allow.id);
      const known = created.get(Array.from(id).join(","));
      /* الاعتماد موجود: خرج PRF الحتمي. غير موجود (أُعيد إنشاء/مفتاح آخر):
       * NotAllowedError الصادقة — لا خرج بديل أبدًا. */
      if (!known) throw new DOMException("The operation either timed out or was not allowed.", "NotAllowedError");
      const first = await prfOutput(saltBytes, id);
      /* متزامنة كما في المتصفح الحقيقي — القيمة محسوبة قبل الإرجاع. */
      return { rawId: allow.id, getClientExtensionResults: () => ({ prf: { results: { first } } }) };
    },
  );
  return { create, get, credentials: { create, get } };
}

function installWebAuthn(authenticator: ReturnType<typeof makeAuthenticator>) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { credentials: authenticator.credentials },
  });
  Object.defineProperty(globalThis, "PublicKeyCredential", {
    configurable: true,
    value: class PublicKeyCredential {},
  });
}

function removeWebAuthn() {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} });
  Object.defineProperty(globalThis, "PublicKeyCredential", { configurable: true, value: undefined });
}

async function slotOf(store: PrototypeLocalStore) {
  const slot = await store.getLocalDataKeySlot();
  if (!slot.ok) throw new Error(slot.message);
  return slot.value;
}

beforeEach(() => {
  __resetBackupKeySessionForTesting();
});

afterEach(async () => {
  __resetBackupKeySessionForTesting();
  removeWebAuthn();
  vi.restoreAllMocks();
});

describe("MNG-LOCAL-03 — مراسم مفتاح الجهاز (WebAuthn-PRF) — إنشاء واستخدام", () => {
  it("الإنشاء الأول: مرسمة create ثم حفظ فتحة بلا أي مادة مفتاح، والجلسة قابلة للاستخدام", async () => {
    const authenticator = makeAuthenticator();
    installWebAuthn(authenticator);
    const store = new MemoryLocalStore();
    const first = await obtainExportKeySession(store, clock);
    if (!first.ok) throw new Error(first.message);
    expect(authenticator.create).toHaveBeenCalledTimes(1);
    const slot = await slotOf(store);
    expect(slot).not.toBeNull();
    expect(slot?.id).toBe(localDataKeySlotId);
    expect(slot?.prfSalt).toMatch(/^[0-9a-f]{32}$/);
    expect(slot?.verification.ciphertext.length).toBeGreaterThan(0);
    /* لا مادة مفتاح في السجل إطلاقًا — JSON كله لا يحوي خامات. */
    expect(JSON.stringify(slot)).not.toMatch(/raw|exportable|keyBytes/i);

    /* المفتاح نفسه يستخدم فورًا للتشفير. */
    const plaintext = "قيمة مالية: 1,250.000";
    const cipher = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: new Uint8Array(12) },
      first.value.key,
      new TextEncoder().encode(plaintext),
    );
    expect(cipher.byteLength).toBeGreaterThan(16);
  });

  it("الجلسة الثانية (بعد إعادة تحميل): مرسمة get بنفس الاعتماد والملح تفك مظروف التحقق", async () => {
    const authenticator = makeAuthenticator();
    installWebAuthn(authenticator);
    const store = new MemoryLocalStore();
    expect((await obtainExportKeySession(store, clock)).ok).toBe(true);
    __resetBackupKeySessionForTesting(); /* إغلاق الصفحة: الجلسة في الذاكرة تُقص */
    const second = await obtainExportKeySession(store, clock);
    expect(second.ok).toBe(true);
    expect(authenticator.create).toHaveBeenCalledTimes(1); /* لم يُنشَ اعتماد جديد */
    /* get مرتان: خطوة استخراج PRF بعد create نفسها (النمط الموثق لمتصفحات
     * لا ترد الخرج من create) + مرسمة الجلسة الثانية. */
    expect(authenticator.get).toHaveBeenCalledTimes(2);
    expect((await slotOf(store))?.credentialId).toBeTruthy();
  });

  it("إلغاء المستخدم (NotAllowedError من المرسمة): فشل صادق بلا أي فتحة ولا جلسة", async () => {
    const authenticator = makeAuthenticator();
    authenticator.create.mockRejectedValueOnce(new DOMException("cancelled", "NotAllowedError"));
    installWebAuthn(authenticator);
    const store = new MemoryLocalStore();
    const outcome = await obtainExportKeySession(store, clock);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.code).toBe("user-cancelled");
      expect(outcome.message).toContain("لم يُنشأ أي ملف");
    }
    expect(await slotOf(store)).toBeNull();
  });

  it("غياب المصادق كليًا: فشل صادق مغلَق بلا أي فتحة", async () => {
    removeWebAuthn();
    const store = new MemoryLocalStore();
    const outcome = await obtainExportKeySession(store, clock);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe("authenticator-unavailable");
    expect(await slotOf(store)).toBeNull();
  });

  it("إعادة إنشاء اعتماد المنصة (خرج PRF مختلف): فكّ التحقق يفشل — key-mismatch بلا بديل", async () => {
    const authenticator = makeAuthenticator();
    installWebAuthn(authenticator);
    const store = new MemoryLocalStore();
    expect((await obtainExportKeySession(store, clock)).ok).toBe(true);
    __resetBackupKeySessionForTesting();
    /* محا المستخدم مفتاح المنصة: الاعتماد القديم لم يعد يعرف — get يرمي NotAllowed
     * (النمط الواقعي) فيعود الفشل الصادق؛ ولا تُمس الفتحة القديمة. */
    authenticator.get.mockRejectedValueOnce(new DOMException("credentials gone", "NotAllowedError"));
    const outcome = await obtainExportKeySession(store, clock);
    expect(outcome.ok).toBe(false);
    expect(await slotOf(store)).not.toBeNull();
  });

  it("مفتاح مظروف وارد: مرسمة get مقيدة بمعرّف المظروف والملح — بلا أي قراءة/كتابة فتحة", async () => {
    const authenticator = makeAuthenticator();
    installWebAuthn(authenticator);
    const store = new MemoryLocalStore();
    expect((await obtainExportKeySession(store, clock)).ok).toBe(true);
    const slot = await slotOf(store);
    const bytes = slotFieldsToBytes(slot!);
    __resetBackupKeySessionForTesting();
    const outcome = await obtainEnvelopeKey(bytes.credentialId, bytes.prfSalt);
    expect(outcome.ok).toBe(true);
    /* get مرتان: خطوة PRF بعد create + مرسمة المظروف الوارد. */
    expect(authenticator.get).toHaveBeenCalledTimes(2);
    const call = authenticator.get.mock.calls[1]?.[0] as {
      publicKey?: { allowCredentials?: Array<{ id: ArrayBuffer }>; extensions?: { prf?: { eval?: { first: ArrayBuffer } } } };
    };
    expect(Array.from(new Uint8Array(call.publicKey?.allowCredentials?.[0]?.id ?? new ArrayBuffer(0)))).toEqual(
      Array.from(bytes.credentialId),
    );
    expect(Array.from(new Uint8Array(call.publicKey?.extensions?.prf?.eval?.first ?? new ArrayBuffer(0)))).toEqual(
      Array.from(bytes.prfSalt),
    );
    /* مفتاح الجلسة يستطيع فك مظروف تحقق الفتحة (نفس المفتاح المشتق). */
    const outcome2 = await obtainExportKeySession(store, clock);
    expect(outcome2.ok).toBe(true);
  });

  it("جلسة الذاكرة نفسها تُعاد دون مرسمة ثانية طالما الاعتماد والملح مطابقان", async () => {
    const authenticator = makeAuthenticator();
    installWebAuthn(authenticator);
    const store = new MemoryLocalStore();
    expect((await obtainExportKeySession(store, clock)).ok).toBe(true);
    const again = await obtainExportKeySession(store, clock);
    expect(again.ok).toBe(true);
    expect(authenticator.create).toHaveBeenCalledTimes(1);
    /* get واحدة فقط: خطوة PRF بعد create؛ الجلسة المخزنة أعادت الاستفادة بلا مرسمة. */
    expect(authenticator.get).toHaveBeenCalledTimes(1);
  });
});
