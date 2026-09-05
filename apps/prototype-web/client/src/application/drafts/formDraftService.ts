/**
 * المجموعة ٥ (عقد ٣٦ — المسودة النصية): حفظ واستعادة مدخلات النماذج الطويلة
 * عبر الإغلاق والتحديث والانقطاع — دون أن تصبح المسودة حدثًا ماليًا أبدًا.
 *
 * عقد المسودة:
 * - مخزن مستقل (form-drafts) خارج اللقطة: دخول عابر لا حقيقة مالية؛ لا يُصدَّر
 *   ولا يُستعاد مع النسخة الاحتياطية، ولا يمس أي رصيد.
 * - لا تُنشأ إلا حين يُدخل المستخدم شيئًا حقيقيًا (نمط و٥) — لا مسودة فارغة
 *   من مجرد فتح الشاشة.
 * - الكتابة بحارس تزامن (expectedUpdatedAt): نافذة قديمة لا تطمس أحدث.
 * - الاستعادة عرضٌ صريح يقبله المستخدم؛ التعارض مع سجل نهائي موجود يمنع
 *   الاستعادة ويُعرض سببها.
 * - الإنهاء: حذف صريح بعد نجاح الحفظ النهائي أو بعد اختيار التجاهل.
 */
import type { FormDraftEnvelope, FormDraftKind, PrototypeLocalStore } from "@/storage/local/types";

export type FormDraftValues = Record<string, unknown>;

export type FormDraftSaveResult =
  | { ok: true; value: FormDraftEnvelope }
  | { ok: false; code: "conflict"; message: string }
  | { ok: false; code: "storage_error"; message: string };

export type FormDraftReadResult =
  { ok: true; value: FormDraftEnvelope | null } | { ok: false; code: "storage_error"; message: string };

export type FormDraftDeleteResult =
  { ok: true; value: null } | { ok: false; code: "storage_error"; message: string };

/** إصدار شكل القيم لكل نوع — تغيّره يعني تجاهل القديم بلا انفجار. */
const FORM_VALUES_VERSION = 1;

export function formDraftId(formKind: FormDraftKind, scopeId: string | null): string {
  return `${formKind}:${scopeId ?? "new"}`;
}

export class FormDraftService {
  constructor(
    private readonly store: PrototypeLocalStore,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async read(formKind: FormDraftKind, scopeId: string | null): Promise<FormDraftReadResult> {
    const result = await this.store.getFormDraft(formDraftId(formKind, scopeId));
    if (!result.ok) return { ok: false, code: "storage_error", message: result.message };
    const envelope = result.value;
    if (envelope === null) return { ok: true, value: null };
    /* إصدار شكل مختلف = مسودة من جيل آخر: تُعرض كغير موجودة (تُتجاهل بلا انفجار). */
    if (envelope.valuesVersion !== FORM_VALUES_VERSION) return { ok: true, value: null };
    return { ok: true, value: envelope };
  }

  async save(
    formKind: FormDraftKind,
    scopeId: string | null,
    values: FormDraftValues,
    expectedUpdatedAt?: string | null,
  ): Promise<FormDraftSaveResult> {
    const id = formDraftId(formKind, scopeId);
    const existing = await this.store.getFormDraft(id);
    if (!existing.ok) return { ok: false, code: "storage_error", message: existing.message };
    const current = existing.value;
    if (
      current !== null &&
      expectedUpdatedAt !== undefined &&
      expectedUpdatedAt !== null &&
      current.updatedAt !== expectedUpdatedAt
    ) {
      return {
        ok: false,
        code: "conflict",
        message: "هذه المسودة حُفظت من نافذة أخرى أحدث — احتفظ بقيمك وراجعها قبل الكتابة فوقها.",
      };
    }
    const timestamp = this.now();
    const envelope: FormDraftEnvelope = {
      id,
      formKind,
      scopeId,
      valuesVersion: FORM_VALUES_VERSION,
      values,
      createdAt: current?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    const saved = await this.store.saveFormDraft(envelope);
    if (!saved.ok) return { ok: false, code: "storage_error", message: saved.message };
    return { ok: true, value: saved.value };
  }

  async discard(formKind: FormDraftKind, scopeId: string | null): Promise<FormDraftDeleteResult> {
    const removed = await this.store.deleteFormDraft(formDraftId(formKind, scopeId));
    if (!removed.ok) return { ok: false, code: "storage_error", message: removed.message };
    return { ok: true, value: null };
  }
}
