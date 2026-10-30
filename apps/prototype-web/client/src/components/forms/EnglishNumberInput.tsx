/** RTL-safe presentation control: keeps editable ASCII numeric text stable and delegates parsing to Application. */
import { type ComponentProps, useEffect, useRef, useState } from "react";
import type { EnglishNumericKind } from "@/application/input";
import {
  allowsEnglishNumericText,
  blurEnglishNumericText,
  focusEnglishNumericText,
  formatEnglishNumericValue,
  parseEnglishNumericText,
  normalizeAsciiDigits,
} from "@/application/input";
import { cn } from "@/lib/utils";

type EnglishNumberInputProps = Omit<
  ComponentProps<"input">,
  "type" | "value" | "defaultValue" | "onChange" | "inputMode" | "dir" | "lang"
> & {
  value: number | null;
  kind: EnglishNumericKind;
  onNumericChange: (value: number) => void;
  onTextValidityChange?: (isValid: boolean) => void;
  allowEmpty?: boolean;
  onEmptyChange?: () => void;
  clearDefaultZeroOnFocus?: boolean;
  /* S09 (UNIT-007 — أمر ad133bae القسم ٢): التقاط النص الخام نفسه عند كل
   * تغيير (بما فيه غير الصالح) لمسودة النموذج — استعادة النص غير الصالح
   * بعد التحديث دون إخفاء الكمية القديمة (U007-AC03). اختياري إضافي؛ لا
   * يغيّر سلوك أي مستهلك قائم. */
  onTextChange?: (text: string, isValid: boolean) => void;
  /* S09: نص خام يُحقن مرة عند التركيب فقط (نمط إعادة التركيب بمفتاح) —
   * لاستعادة نص الكمية/السعر كما كتبه المستخدم ولو كان غير صالح. */
  initialRawText?: string | null;
};

export function EnglishNumberInput({
  value,
  kind,
  onNumericChange,
  onTextValidityChange,
  allowEmpty = false,
  onEmptyChange,
  clearDefaultZeroOnFocus = true,
  onTextChange,
  initialRawText = null,
  className,
  onFocus,
  onBlur,
  ...props
}: EnglishNumberInputProps) {
  const latestCommitted = useRef<number | null>(value);
  const hasUserEdited = useRef(false);
  /* S09: نص خام مُستعاد يبدأ حياة المكوّن كما لو كتبه المستخدم — قيمته
   * المحلولة إن صحّت تلتزم كما تلتزم كتابة المستخدم، ونصه يظل كما هو. */
  const [text, setText] = useState(() => {
    if (initialRawText !== null && initialRawText !== undefined) {
      const parsed = parseEnglishNumericText(initialRawText, kind);
      if (parsed !== null) latestCommitted.current = parsed;
      hasUserEdited.current = true;
      return initialRawText;
    }
    return formatEnglishNumericValue(value, kind);
  });
  const inputMode = kind === "integer" || kind === "signedInteger" ? "numeric" : "decimal";
  const pattern = kind === "signedInteger" ? "-?[0-9]*" : kind === "integer" ? "[0-9]*" : "[0-9]*[.]?[0-9]*";

  useEffect(() => {
    if (value !== latestCommitted.current) {
      latestCommitted.current = value;
      hasUserEdited.current = false;
      setText(formatEnglishNumericValue(value, kind));
    }
  }, [kind, value]);

  return (
    <input
      {...props}
      className={cn("micro-english-number-input", className)}
      type="text"
      inputMode={inputMode}
      pattern={pattern}
      lang="en"
      dir="ltr"
      value={text}
      onFocus={event => {
        const next = focusEnglishNumericText(
          value,
          text,
          kind,
          hasUserEdited.current,
          clearDefaultZeroOnFocus,
        );
        if (next !== text) setText(next);
        onFocus?.(event);
      }}
      onChange={event => {
        /* المجموعة ٦ (البند ٥): تطبيع حدود الإدخال — الأرقام الهندية/الفارسية
         * تصير إنجليزية قبل فحص النمط؛ المعنى الرقمي لا يتغير أبدًا. */
        const next = normalizeAsciiDigits(event.target.value);
        if (allowEmpty && next === "") {
          hasUserEdited.current = true;
          setText("");
          latestCommitted.current = null;
          onTextValidityChange?.(true);
          onTextChange?.("", true);
          onEmptyChange?.();
          return;
        }
        if (!allowsEnglishNumericText(next, kind)) {
          hasUserEdited.current = true;
          setText(next);
          onTextValidityChange?.(false);
          onTextChange?.(next, false);
          return;
        }
        hasUserEdited.current = true;
        setText(next);
        const parsed = parseEnglishNumericText(next, kind);
        onTextValidityChange?.(parsed !== null);
        onTextChange?.(next, parsed !== null);
        if (parsed !== null) {
          latestCommitted.current = parsed;
          onNumericChange(parsed);
        }
      }}
      onBlur={event => {
        const result = blurEnglishNumericText(text, latestCommitted.current, kind, allowEmpty);
        latestCommitted.current = result.committed;
        setText(result.text);
        onTextValidityChange?.(result.valid);
        onBlur?.(event);
      }}
    />
  );
}
