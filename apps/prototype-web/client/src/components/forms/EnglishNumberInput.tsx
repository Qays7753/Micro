/** RTL-safe presentation control: keeps editable ASCII numeric text stable and delegates parsing to Application. */
import { type ComponentProps, useEffect, useRef, useState } from "react";
import { allowsEnglishNumericText, formatEnglishNumericValue, parseEnglishNumericText, type EnglishNumericKind } from "@/application/input/englishNumeric";
import { cn } from "@/lib/utils";

type EnglishNumberInputProps = Omit<ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange" | "inputMode" | "dir" | "lang"> & {
  value: number | null;
  kind: EnglishNumericKind;
  onNumericChange: (value: number) => void;
  onTextValidityChange?: (isValid: boolean) => void;
};

export function EnglishNumberInput({ value, kind, onNumericChange, onTextValidityChange, className, onBlur, ...props }: EnglishNumberInputProps) {
  const latestCommitted = useRef<number | null>(value);
  const [text, setText] = useState(() => formatEnglishNumericValue(value, kind));

  useEffect(() => {
    if (value !== latestCommitted.current) {
      latestCommitted.current = value;
      setText(formatEnglishNumericValue(value, kind));
    }
  }, [kind, value]);

  return <input {...props} className={cn("micro-english-number-input", className)} type="text" inputMode={kind === "integer" ? "numeric" : "decimal"} pattern={kind === "integer" ? "[0-9]*" : "[0-9]*[.]?[0-9]*"} lang="en" dir="ltr" value={text} onChange={event => {
    const next = event.target.value;
    if (!allowsEnglishNumericText(next, kind)) {
      event.currentTarget.value = text;
      return;
    }
    setText(next);
    const parsed = parseEnglishNumericText(next, kind);
    onTextValidityChange?.(parsed !== null);
    if (parsed !== null) {
      latestCommitted.current = parsed;
      onNumericChange(parsed);
    }
  }} onBlur={event => {
    const parsed = parseEnglishNumericText(text, kind);
    if (parsed !== null) setText(formatEnglishNumericValue(parsed, kind));
    else {
      setText(formatEnglishNumericValue(latestCommitted.current, kind));
      onTextValidityChange?.(true);
    }
    onBlur?.(event);
  }} />;
}
