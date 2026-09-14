/*
 * W2 — برميل المكوّنات الأولية (primitives barrel).
 * هذه الطبقة أوراق فقط: لا تستورد صفحات ولا app ولا application ولا storage.
 * الملكية: مكوّنات أولية مشتركة (Agent 3) — انظر COMPONENT_CATALOG.md.
 */
export { StateMarker } from "./markers";
export type { MicroActivityStatus } from "@/presentation/stateAdapter";
export { StatusChip, chipPresentation, type ChipState, type StatusChipProps } from "./StatusChip";
export { Button, type ButtonAction, type ButtonProps } from "./Button";
export { ChoiceRow, ChoiceButton, type ChoiceRowProps, type ChoiceButtonProps } from "./ChoiceRow";
export {
  Notice,
  QuietCompletion,
  InlineError,
  FeedbackNote,
  type NoticeProps,
  type QuietCompletionProps,
  type FeedbackNoteProps,
} from "./Notice";
export { Row, RowList, type RowProps, type RowStripeTone } from "./Row";
export { Field, type FieldProps } from "./Field";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
