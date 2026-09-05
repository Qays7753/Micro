/**
 * المجموعة ٥ (عقد ٣٦ — المسودة النصية): خطاف التوصيل الموحّد للنماذج الطويلة.
 *
 * سلوك الخطاف:
 * - يكتب عند أول تعديل حقيقي (فارق عن القيم الأولية) لا عند الفتح.
 * - يعرض وقت آخر حفظ وعمر المسودة حين تُستعاد.
 * - الاستعادة صريحة (شريط استرجع/تجاهل) — لا تطبيق صامت فوق سجل محفوظ.
 * - عند نجاح الحفظ النهائي تستدعي الصفحة clearFormDraft() فيُحذف السجل.
 * - أثناء المسودة لا يُنشأ أي حدث مالي (الكتابة في مخزن مستقل خارج اللقطة).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormDraftKind } from "@/storage/local/types";
import type { FormDraftService, FormDraftValues } from "@/application/drafts/formDraftService";

export type FormDraftState<Values extends FormDraftValues> =
  | { phase: "clean"; values: Values }
  | { phase: "drafting"; values: Values; lastSavedAt: string | null; saving: boolean }
  | { phase: "restore-offer"; savedValues: Values; savedAt: string; currentValues: Values };

export type FormDraftController<Values extends FormDraftValues> = {
  state: FormDraftState<Values>;
  /** استدعِ عند كل تغيّر حقيقي في المدخلات (فارق عن القيم الأولية). */
  onValuesChanged: (values: Values) => void;
  /** استدعِ بعد نجاح الحفظ النهائي — يحذف المسودة نهائيًا. */
  clearFormDraft: () => Promise<void>;
  restoreDraft: () => void;
  discardDraft: () => Promise<void>;
};

export function useFormDraft<Values extends FormDraftValues>(
  formDrafts: FormDraftService,
  formKind: FormDraftKind,
  scopeId: string | null,
  initialValues: Values,
): FormDraftController<Values> {
  const service = useRef(formDrafts);
  const [state, setState] = useState<FormDraftState<Values>>({ phase: "clean", values: initialValues });
  const latestValues = useRef<Values>(initialValues);
  const savedAtRef = useRef<string | null>(null);
  const suppressWrite = useRef(false);
  const skipInitialRead = useRef(false);

  /* القراءة الأولى: عرض استعادة إن وُجدت مسودة محفوظة (قيم أولية لم تُلمس بعد). */
  useEffect(() => {
    if (skipInitialRead.current) return;
    skipInitialRead.current = true;
    let active = true;
    void service.current.read(formKind, scopeId).then(result => {
      if (!active || !result.ok || result.value === null) return;
      const savedValues = result.value.values as Values;
      const hasRealInput = Object.values(savedValues).some(
        value =>
          value !== null &&
          value !== undefined &&
          value !== "" &&
          !(Array.isArray(value) && value.length === 0),
      );
      if (!hasRealInput) return;
      setState({
        phase: "restore-offer",
        savedValues,
        savedAt: result.value.updatedAt,
        currentValues: latestValues.current,
      });
    });
    return () => {
      active = false;
    };
  }, [formKind, scopeId]);

  const onValuesChanged = useCallback(
    (values: Values) => {
      latestValues.current = values;
      if (suppressWrite.current) return;
      setState(current =>
        current.phase === "restore-offer"
          ? { ...current, currentValues: values }
          : {
              phase: "drafting",
              values,
              lastSavedAt: savedAtRef.current,
              saving: current.phase === "drafting" ? current.saving : false,
            },
      );
      void service.current.save(formKind, scopeId, values, savedAtRef.current).then(result => {
        if (result.ok) savedAtRef.current = result.value.updatedAt;
        setState(current => {
          if (current.phase !== "drafting") return current;
          return { ...current, lastSavedAt: savedAtRef.current, saving: false, values: latestValues.current };
        });
      });
    },
    [formKind, scopeId],
  );

  const clearFormDraft = useCallback(async () => {
    savedAtRef.current = null;
    await service.current.discard(formKind, scopeId);
  }, [formKind, scopeId]);

  const restoreDraft = useCallback(() => {
    if (state.phase !== "restore-offer") return;
    const values = state.savedValues;
    latestValues.current = values;
    savedAtRef.current = state.savedAt;
    suppressWrite.current = true;
    setState({ phase: "drafting", values, lastSavedAt: state.savedAt, saving: false });
    /* إعادة التطبيق لا تعيد الكتابة — القيم نفسها محفوظة سلفًا. */
    globalThis.setTimeout(() => {
      suppressWrite.current = false;
    }, 0);
  }, [state]);

  const discardDraft = useCallback(async () => {
    if (state.phase !== "restore-offer") return;
    await service.current.discard(formKind, scopeId);
    savedAtRef.current = null;
    setState({ phase: "clean", values: latestValues.current });
  }, [formKind, scopeId, state]);

  return { state, onValuesChanged, clearFormDraft, restoreDraft, discardDraft };
}
