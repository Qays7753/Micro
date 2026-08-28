/*
 * Micro design reminder: every quick action must end in a real path or be
 * clearly marked as unavailable; the sheet never creates a financial effect.
 */
import { ClipboardPlus, HandCoins, PackagePlus, X } from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export type QuickAction = "order" | "estimate" | "collection";
export type QuickActionItem = {
  action: QuickAction;
  label: string;
  description: string;
  icon: typeof ClipboardPlus;
  disabled?: boolean;
};
type QuickActionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (action: QuickAction) => void;
};

export const actionItems: readonly QuickActionItem[] = [
  { action: "order", label: "طلب مخصص", description: "ابدأ مسودة طلب واتفاق أولي.", icon: ClipboardPlus },
  {
    action: "estimate",
    label: "مسودة تصميم",
    description: "ابدأ مسودة تصميم قبل أن تتحول إلى اتفاق.",
    icon: PackagePlus,
  },
  {
    action: "collection",
    label: "عربون أو تحصيل",
    description: "افتح طلبًا موجودًا؛ التحصيل مرتبط بطلب محدد.",
    icon: HandCoins,
  },
];

export function QuickActionSheet({ open, onOpenChange, onAction }: QuickActionSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom">
      <DrawerContent className="micro-bottom-sheet" dir="rtl">
        <DrawerHeader className="micro-sheet-header">
          <div className="micro-sheet-title-row">
            <div>
              <DrawerTitle className="micro-sheet-title">ماذا تريد أن تسجّل؟</DrawerTitle>
              <DrawerDescription className="micro-sheet-description">
                اختر حدثًا واحدًا لنكمل الخطوة المناسبة.
              </DrawerDescription>
            </div>
            <DrawerClose asChild>
              <button className="micro-icon-button" type="button" aria-label="إغلاق">
                <X aria-hidden="true" />
              </button>
            </DrawerClose>
          </div>
        </DrawerHeader>
        <div className="micro-sheet-actions">
          {actionItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.action}
                className="micro-sheet-action"
                type="button"
                disabled={item.disabled}
                aria-disabled={item.disabled || undefined}
                onClick={() => {
                  if (!item.disabled) onAction(item.action);
                }}
              >
                <span className="micro-sheet-action-icon">
                  <Icon aria-hidden="true" />
                </span>
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </button>
            );
          })}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
