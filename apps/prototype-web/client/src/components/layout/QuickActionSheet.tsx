/**
 * Micro design reminder: secondary actions use an accessible short sheet; Slice 0
 * describes their future scope instead of creating financial effects.
 */
import { ClipboardPlus, HandCoins, PackagePlus, X } from "lucide-react";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

export type QuickAction = "order" | "estimate" | "collection";
type QuickActionSheetProps = { open: boolean; onOpenChange: (open: boolean) => void; onAction: (action: QuickAction) => void };

const actionItems = [
  { action: "order" as const, label: "طلب مخصص", description: "ابدأ مسودة طلب واتفاق أولي.", icon: ClipboardPlus },
  { action: "estimate" as const, label: "تقدير تصميم", description: "احسب فكرة قبل وجود بيع فعلي.", icon: PackagePlus },
  { action: "collection" as const, label: "عربون أو تحصيل", description: "سجّل حركة مرتبطة بطلب موجود.", icon: HandCoins },
];

export function QuickActionSheet({ open, onOpenChange, onAction }: QuickActionSheetProps) {
  return <Drawer open={open} onOpenChange={onOpenChange} direction="bottom"><DrawerContent className="micro-bottom-sheet" dir="rtl">
    <DrawerHeader className="micro-sheet-header"><div className="micro-sheet-title-row"><div><DrawerTitle className="micro-sheet-title">ماذا تريد أن تسجّل؟</DrawerTitle><DrawerDescription className="micro-sheet-description">اختر حدثًا واحدًا لنكمل الخطوة المناسبة.</DrawerDescription></div><DrawerClose asChild><button className="micro-icon-button" type="button" aria-label="إغلاق"><X aria-hidden="true" /></button></DrawerClose></div></DrawerHeader>
    <div className="micro-sheet-actions">{actionItems.map(item => { const Icon = item.icon; return <button key={item.action} className="micro-sheet-action" type="button" onClick={() => onAction(item.action)}><span className="micro-sheet-action-icon"><Icon aria-hidden="true" /></span><span><strong>{item.label}</strong><small>{item.description}</small></span></button>; })}</div>
  </DrawerContent></Drawer>;
}
