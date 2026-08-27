/** Micro design reminder: four task destinations and one creation affordance, never generic ERP chrome. */
import { Plus } from "lucide-react";
import type { NavigationItem } from "@/app/navigation";

type BottomNavProps = {
  activePath: string;
  items: readonly NavigationItem[];
  onNavigate: (href: string) => void;
  onOpenActions: () => void;
};

export function BottomNav({ activePath, items, onNavigate, onOpenActions }: BottomNavProps) {
  return (
    <nav className="micro-bottom-nav" aria-label="التنقل الرئيسي">
      <div className="micro-bottom-nav-inner">
        {items.slice(0, 2).map(item => (
          <NavigationButton
            key={item.href}
            item={item}
            isActive={isNavigationActive(activePath, item.href)}
            onNavigate={onNavigate}
          />
        ))}
        <button className="micro-fab" type="button" onClick={onOpenActions} aria-label="تسجيل أو إضافة">
          <Plus aria-hidden="true" />
          <span>إضافة</span>
        </button>
        {items.slice(2).map(item => (
          <NavigationButton
            key={item.href}
            item={item}
            isActive={isNavigationActive(activePath, item.href)}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </nav>
  );
}

function isNavigationActive(activePath: string, itemPath: string) {
  return activePath === itemPath || (itemPath !== "/" && activePath.startsWith(itemPath));
}
function NavigationButton({
  item,
  isActive,
  onNavigate,
}: {
  item: NavigationItem;
  isActive: boolean;
  onNavigate: (href: string) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      className="micro-nav-item"
      data-active={isActive}
      type="button"
      onClick={() => onNavigate(item.href)}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon aria-hidden="true" />
      <span>{item.label}</span>
    </button>
  );
}
