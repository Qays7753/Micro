/**
 * ملف المالك (المجموعة ١ — Scope G): هوية مالك محلية مستقلة عن سجل المشروع.
 *
 * حدود صريحة:
 * - لا اتصال بأي مزود خارجي ولا OAuth ولا مزامنة — الكتابة محلية فقط.
 * - الحقول المستقبلية (provider / externalAccountId) تبقى null ولا تُفعّل هنا.
 * - المعرف المحلي الثابت يولَّد مرة واحدة ويبقى مستقرًا عبر التعديلات والتصدير.
 */
import {
  localOwnerProfileId,
  type OwnerProfile,
  type PrototypeLocalStore,
  type StorageFailureCode,
} from "@/storage/local/types";

export type OwnerProfileReadResult =
  { ok: true; value: OwnerProfile | null } | { ok: false; code: StorageFailureCode; message: string };

export type OwnerProfileSaveResult =
  | { ok: true; value: OwnerProfile }
  | { ok: false; code: "validation_error" | "storage_error"; message: string };

export type OwnerProfileSaveInput = {
  displayName: string | null;
  email: string | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISPLAY_NAME_MAX = 80;
const EMAIL_MAX = 120;

export function normalizeDisplayName(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, DISPLAY_NAME_MAX);
}

/** البريد اختياري تمامًا؛ إن وُجد فيجب أن يكون بصيغة سليمة. */
export function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= EMAIL_MAX && EMAIL_PATTERN.test(trimmed);
}

function generateOwnerId(): string {
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `owner-${uuid}`;
}

export class OwnerProfileService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async read(): Promise<OwnerProfileReadResult> {
    return this.store.getOwnerProfile();
  }

  /**
   * يضمن وجود هوية مالك محلية ثابتة — إنشاء مرة واحدة فقط ثم قراءة دائمة.
   * يستدعى من بوابة الإقلاع بعد وجود سجل المشروع؛ لا أثر مالي ولا علاقات.
   */
  async ensureLocal(): Promise<OwnerProfileReadResult> {
    const existing = await this.store.getOwnerProfile();
    if (!existing.ok) return existing;
    if (existing.value) return existing;
    const timestamp = this.now();
    const created: OwnerProfile = {
      id: localOwnerProfileId,
      ownerId: generateOwnerId(),
      displayName: null,
      email: null,
      provider: null,
      externalAccountId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const saved = await this.store.saveOwnerProfile(created);
    return saved.ok ? { ok: true, value: saved.value } : saved;
  }

  async save(input: OwnerProfileSaveInput): Promise<OwnerProfileSaveResult> {
    const displayName = normalizeDisplayName(input.displayName);
    const email = (input.email ?? "").trim();
    if (email.length > 0 && !isValidEmail(email))
      return {
        ok: false,
        code: "validation_error",
        message: "البريد الإلكتروني اختياري؛ إن أدخلته فليكن بصيغة سليمة مثل name@mail.com.",
      };
    const current = await this.store.getOwnerProfile();
    if (!current.ok)
      return { ok: false, code: "storage_error", message: "تعذر قراءة ملف المالك. حاول مرة أخرى." };
    const base: OwnerProfile = current.value ?? {
      id: localOwnerProfileId,
      ownerId: generateOwnerId(),
      displayName: null,
      email: null,
      provider: null,
      externalAccountId: null,
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    const next: OwnerProfile = {
      ...base,
      displayName,
      email: email.length === 0 ? null : email,
      /* المعرف المحلي الثابت لا يتغير بالتعديل — هوية لا سجل تعديل. */
      ownerId: base.ownerId,
      updatedAt: this.now(),
    };
    const saved = await this.store.saveOwnerProfile(next);
    return saved.ok
      ? { ok: true, value: saved.value }
      : {
          ok: false,
          code: "storage_error",
          message: "لم يُحفظ ملف المالك على هذا الجهاز. تحقق من مساحة التخزين ثم أعد المحاولة.",
        };
  }
}
