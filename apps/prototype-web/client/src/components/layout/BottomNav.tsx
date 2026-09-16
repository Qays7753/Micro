/** Micro design reminder: phone-first task destinations, never generic ERP chrome. */
/* NAV-001 (قرار المالك ٢٠٢٦-٠٩-١٦): خمسة مقاعد متساوية — مشروعي الآن | العمل |
 * المالية | أدواتي | السوق. زر «سجّل» المركزي أُزيل نهائيًا بعد نقل أفعاله
 * إلى أزرار التسجيل السريع في «مشروعي الآن»؛ لا نموذج تنقل مزدوج مخفي. */
import type { NavigationItem } from "@/app/navigation";

type BottomNavProps = {
  activePath: string;
  items: readonly NavigationItem[];
  onNavigate: (href: string) => void;
};

export function BottomNav({ activePath, items, onNavigate }: BottomNavProps) {
  return (
    <nav className="micro-bottom-nav" aria-label="التنقل الرئيسي">
      <div className="micro-bottom-nav-inner">
        {items.map(item => (
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
