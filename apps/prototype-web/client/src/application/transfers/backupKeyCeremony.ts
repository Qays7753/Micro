/**
 * MNG-LOCAL-03 (أمر المالك 12AA — 2026-11-24): مراسم مفتاح تشفير النسخ عبر
 * مصادقة الجهاز الأصلية — WebAuthn مع امتداد PRF (HMAC Secret Extension). لا
 * تُطلب من المستخدم أي كلمة مرور/PIN/عبارة مكتوبة لإدارة المفتاح إطلاقًا؛
 * التأكيد الوحيد هو موجه المنصة (بصمة/قفل الجهاز/passkey) الذي يطلبه
 * المصادق نفسه بـuserVerification:"required".
 *
 * دورة المفتاح:
 *  - الإنشاؤ (أول استخدام على الجهاز): create() لاعتماد منصة resident مع
 *    extensions.prf.eval{first:ملح عشوائي 16}؛ خرج PRF (32 بايتًا) يُستورد
 *    مفتاح AES-256-GCM غير قابل للاستخراج (الذاكرة فقط — لا يُخزن في أي مكان
 *    أبدًا)، ويُحفظ في IndexedDB «فتحة» تحمل الملح ومعرّف الاعتماد ومظروف
 *    تحقق مشفّر بعلامة ثابتة (لا مادة مفتاح في السجل إطلاقًا). متصفحات
 *    تعيد النتيجة من create مباشرة وأخرى (نمط Safari المعروف) تردّها فقط من
 *    get() لاحقًا — المرسمتان معًا مُطبقتان (خطوة واحدة أو خطوتان).
 *  - الاستخدام (كل جلسة/ملف): get() مقيد بمعرّف الاعتماد نفسه والملح نفسه
 *    (من الفتحة للتصدير، أو من رأس المظروف نفسه للاستيراد — الملف وصف-ذاتي
 *    فيصمد على أي جهاز يملك الاعتماد نفسه) ثم يُشتق المفتاح ويُفكّ به.
 *  - فقدان اعتماد المنصة = تعذّر فكّ الملفات القديمة بلا أي بديل صامت —
 *    يُعلن صادقًا ولا يُخترع fallback ضعيف (حد الأمر: لا ملف نصي بديلًا).
 *
 * الحدود الموثقة: لا CryptoKey يُخزن في IndexedDB أصلًا (بخلاف النمط الشائع
 * الذي يخزن مفتاحًا غير قابل للاستخراج في نفس الأصل — وهو لا يحمي من ملف
 * شخص مفتوح/مشترك أصلاً)؛ الفتح يتطلب مراسم تحقق مستخدم حية كل مرة. دعم
 * PRF يتفاوت بين المتصفحات — التوافر يُكتشف زمن التشغيل ويفشل مغلقًا
 * برسالة عربية صادقة؛ الدعم الفعلي على الأجهزة الفعلية UNVERIFIED من هذه
 * البيئة (لا أجهزة فعلية هنا) ويُتحقق في قياس المالك الميداني.
 */
import type { PrototypeLocalStore } from "@/storage/local/types";
import {
  keySlotDocument,
  makeVerificationEnvelope,
  randomBytes,
  verifyKeyAgainstSlot,
} from "@/application/transfers/encryptedBackupEnvelope";

export type CeremonyFailureCode =
  | "authenticator-unavailable"
  | "user-cancelled"
  | "key-mismatch"
  | "storage-error"
  | "crypto-error";

export type CeremonyOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; code: CeremonyFailureCode; message: string };

/** جلسة المفتاح المشتق — المفتاح في الذاكرة لعمر الصفحة فقط. */
export type BackupKeySession = {
  key: CryptoKey;
  credentialId: Uint8Array;
  prfSalt: Uint8Array;
};

/* ---- امتداد PRF غير المدروس في lib.dom القديم — أنواع بنية موضعية ---- */

type PrfEvalSaltInputs = { first: BufferSource };
type PrfClientInputs = { prf?: { eval?: PrfEvalSaltInputs } };
type PrfClientOutputs = { prf?: { results?: { first?: ArrayBuffer } } };

/* PrfClientOutputs خارج lib.dom 5.6 — خرج المراسم كما يستهلكه هذا
 * الموديول: بنية موضعية يُقالب عليها الخرج عند حدود المتصفح. */
type CeremonyAssertion = { rawId?: ArrayBuffer; getClientExtensionResults?: () => PrfClientOutputs };

/* الجلسة الأخيرة في الذاكرة — تُعاد الاستفادة منها ما دامت مطابقة
 * (معرّف الاعتماد والملح نفسيهما)، وتُقص مع أول اختلاف أو إعادة تحميل. */
let cachedSession: BackupKeySession | null = null;

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function viewOf(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** @internal إعادة ضبط الجلسة للاختبارات فقط. */
export function __resetBackupKeySessionForTesting(): void {
  cachedSession = null;
}

function webauthnAvailable(): boolean {
  const navigatorLike = globalThis.navigator as { credentials?: unknown } | undefined;
  return (
    typeof navigatorLike?.credentials !== "undefined" &&
    typeof (globalThis as { PublicKeyCredential?: unknown }).PublicKeyCredential !== "undefined"
  );
}

const MESSAGES = {
  unavailable:
    "متصفحك هذا لا يوفر مصادقة الجهاز اللازمة لتشفير مفتاح النسخة — لم يُنشأ أي ملف ولم تُمس بيانات هذا الجهاز.",
  cancelled: "أُلغي تأكيد الجهاز — لم يُنشأ أي ملف ولم تُمس بيانات هذا الجهاز.",
  mismatch:
    "نجح تأكيد الجهاز لكن مفتاح هذه النسخة لا يطابق المفتاح المسجل على هذا الجهاز — يُرجح أن مفتاح المنصة أُعيد إنشاؤه؛ تعذّر الفتح بأمان ولم تُمس بياناتك.",
  storage: "تعذر الوصول إلى فتحة مفتاح النسخ على هذا الجهاز — لم يُنشأ أي ملف ولم تُمس بياناتك.",
  crypto: "تعذر إنشاء المفتاح أو التشفير — لم يُنشأ أي ملف ولم تُمس بيانات هذا الجهاز.",
} as const;

function fail<T>(code: CeremonyFailureCode, message: string): CeremonyOutcome<T> {
  return { ok: false, code, message };
}

/* ---- المراسم الأساسية ---- */

async function importAesKeyFromPrfOutput(first: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", first, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function deriveThroughGetCeremony(
  credentialId: Uint8Array,
  prfSalt: Uint8Array,
): Promise<CeremonyOutcome<BackupKeySession>> {
  try {
    const request = {
      publicKey: {
        challenge: viewOf(randomBytes(32)),
        allowCredentials: [{ id: viewOf(credentialId), type: "public-key" as const }],
        userVerification: "required" as const,
        timeout: 120_000,
        extensions: { prf: { eval: { first: viewOf(prfSalt) } } },
      },
      /* امتداد PRF خارج lib.dom لهذه النسخة — قالب واحد موثق عند حدود
       * المتصفح (الطلب كله يُبنى كاملاً ثم يُعبر؛ لا يخفي أي حقل آخر). */
    } as unknown as CredentialRequestOptions;
    const assertion = (await navigator.credentials.get(request)) as CeremonyAssertion | null;
    if (!assertion) return fail("user-cancelled", MESSAGES.cancelled);
    const first = assertion.getClientExtensionResults?.()?.prf?.results?.first ?? null;
    if (!first) return fail("authenticator-unavailable", MESSAGES.unavailable);
    return { ok: true, value: { key: await importAesKeyFromPrfOutput(first), credentialId, prfSalt } };
  } catch (error) {
    if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
      return fail("user-cancelled", MESSAGES.cancelled);
    }
    return fail("crypto-error", MESSAGES.crypto);
  }
}

async function deriveThroughCreateCeremony(
  prfSalt: Uint8Array,
): Promise<CeremonyOutcome<{ session: BackupKeySession; credentialId: Uint8Array }>> {
  try {
    const request = {
      publicKey: {
        rp: { name: "Micro" },
        user: {
          id: viewOf(randomBytes(16)),
          name: "micro-local-backup-key",
          displayName: "مفتاح حماية نسخ Micro",
        },
        challenge: viewOf(randomBytes(32)),
        pubKeyCredParams: [
          { type: "public-key" as const, alg: -7 },
          { type: "public-key" as const, alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform" as const,
          userVerification: "required" as const,
          residentKey: "preferred" as const,
        },
        timeout: 120_000,
        attestation: "none" as const,
        extensions: { prf: { eval: { first: viewOf(prfSalt) } } },
      },
      /* نفس القالب الموثق عند حدود المتصفح — امتداد PRF خارج lib.dom 5.6. */
    } as unknown as CredentialCreationOptions;
    const credential = (await navigator.credentials.create(request)) as
      | (CeremonyAssertion & { rawId: ArrayBuffer })
      | null;
    if (!credential) return fail("user-cancelled", MESSAGES.cancelled);
    const credentialId = new Uint8Array(credential.rawId);
    const first = credential.getClientExtensionResults?.()?.prf?.results?.first ?? null;
    if (first) {
      return {
        ok: true,
        value: { session: { key: await importAesKeyFromPrfOutput(first), credentialId, prfSalt }, credentialId },
      };
    }
    /* النمط المعروف لبعض المتصفحات: create لا يرد خرج PRF — المرسمة الثانية
     * get() على الاعتماد الجديد نفسه تستخرجه (خطوة وثيقة لا اعتماد جديد). */
    const secondStep = await deriveThroughGetCeremony(credentialId, prfSalt);
    if (!secondStep.ok) return secondStep;
    return { ok: true, value: { session: secondStep.value, credentialId } };
  } catch (error) {
    if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
      return fail("user-cancelled", MESSAGES.cancelled);
    }
    return fail("crypto-error", MESSAGES.crypto);
  }
}

/* ---- الواجهة العامة ---- */

/** مفتاح التصدير: فتحة الجهاز إن وُجدت (مراسم get مع تحقق المطابقة)، وإلا
 * إنشاء أول (مراسم create + حفظ الفتحة). لا يُخزن أي مفتاح أبدًا. */
export async function obtainExportKeySession(
  store: PrototypeLocalStore,
  now: () => string,
): Promise<CeremonyOutcome<BackupKeySession>> {
  const slot = await store.getLocalDataKeySlot();
  if (!slot.ok) return fail("storage-error", MESSAGES.storage);
  if (slot.value === null) {
    if (!webauthnAvailable()) return fail("authenticator-unavailable", MESSAGES.unavailable);
    const prfSalt = randomBytes(16);
    const created = await deriveThroughCreateCeremony(prfSalt);
    if (!created.ok) return created;
    try {
      const verification = await makeVerificationEnvelope(created.value.session.key);
      const document = keySlotDocument(prfSalt, created.value.credentialId, now(), verification);
      const saved = await store.saveLocalDataKeySlot(document);
      if (!saved.ok) return fail("storage-error", MESSAGES.storage);
    } catch {
      return fail("crypto-error", MESSAGES.crypto);
    }
    cachedSession = created.value.session;
    return { ok: true, value: created.value.session };
  }
  const stored = { credentialId: slot.value.credentialId, prfSalt: slot.value.prfSalt };
  const fromSlot = slotToBytes(stored);
  if (
    cachedSession &&
    bytesEqual(cachedSession.credentialId, fromSlot.credentialId) &&
    bytesEqual(cachedSession.prfSalt, fromSlot.prfSalt)
  ) {
    return { ok: true, value: cachedSession };
  }
  const derived = await deriveThroughGetCeremony(fromSlot.credentialId, fromSlot.prfSalt);
  if (!derived.ok) return derived;
  const verified = await verifyKeyAgainstSlot(derived.value.key, slot.value);
  if (!verified) return fail("key-mismatch", MESSAGES.mismatch);
  cachedSession = derived.value;
  return { ok: true, value: derived.value };
}

/** مفتاح استيراد مظروف: مراسم get مقيدة بمعرّف الاعتماد والملح من رأس
 * المظروف نفسه — لا تقرأ ولا تكتب أي فتحة على الجهاز (الملف وصف-ذاتي،
 * ويصمد على أي جهاز يملك الاعتماد المتزامن نفسه). */
export async function obtainEnvelopeKey(
  credentialId: Uint8Array,
  prfSalt: Uint8Array,
): Promise<CeremonyOutcome<{ key: CryptoKey }>> {
  if (cachedSession && bytesEqual(cachedSession.credentialId, credentialId) && bytesEqual(cachedSession.prfSalt, prfSalt)) {
    return { ok: true, value: { key: cachedSession.key } };
  }
  if (!webauthnAvailable()) return fail("authenticator-unavailable", MESSAGES.unavailable);
  const derived = await deriveThroughGetCeremony(credentialId, prfSalt);
  if (!derived.ok) return derived;
  cachedSession = derived.value;
  return { ok: true, value: { key: derived.value.key } };
}

/* ---- الواجهة العامة والحقن للاختبارات ---- */

/** مزوّد مراسم المفتاح — قابل للحقن في خدمتي النقل للاختبارات المركزة
 * (الإنتاج يستخدم المراسم الحقيقية). */
export type BackupKeyProvider = {
  obtainExportKey(
    store: PrototypeLocalStore,
    now: () => string,
  ): Promise<CeremonyOutcome<BackupKeySession>>;
  obtainEnvelopeKey(
    credentialId: Uint8Array,
    prfSalt: Uint8Array,
  ): Promise<CeremonyOutcome<{ key: CryptoKey }>>;
};

export const ceremonyKeyProvider: BackupKeyProvider = {
  obtainExportKey: (store, now) => obtainExportKeySession(store, now),
  obtainEnvelopeKey: (credentialId, prfSalt) => obtainEnvelopeKey(credentialId, prfSalt),
};

/* ---- فك تشفير قيم الفتحة (base64url/hex → bytes) — بلا أي مفتاح ---- */

function slotToBytes(slot: { credentialId: string; prfSalt: string }): { credentialId: Uint8Array; prfSalt: Uint8Array } {
  const normalized = slot.credentialId.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const credentialId = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) credentialId[index] = binary.charCodeAt(index);
  const prfSalt = new Uint8Array(16);
  for (let index = 0; index < 16; index += 1) {
    prfSalt[index] = Number.parseInt(slot.prfSalt.slice(index * 2, index * 2 + 2), 16);
  }
  return { credentialId, prfSalt };
}
