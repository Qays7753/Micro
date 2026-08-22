/** Micro design reminder: settings exposes local-prototype truths only; it never implies cloud sync, login, or backup guarantees. */
import { Download, MoonStar, Shield, Upload } from "lucide-react";
import { toast } from "sonner";
import { DecisionPanel } from "@/components/presentation/DecisionPanel";
import { useTheme } from "@/contexts/ThemeContext";

export default function SettingsPage() {
  const { theme, preference, toggleTheme } = useTheme();
  function showStorageNotice() { toast.message("النسخ المحلي سيُضاف في Slice الحماية", { description: "سننفذ تصديرًا واستيرادًا يتحقق من الملف قبل أن يكتب أي بيانات محلية." }); }
  return <section className="micro-page"><div className="micro-page-heading"><span className="micro-overline">التحكم المحلي</span><h1>الإعدادات</h1><p>خيارات الواجهة وحدود البيانات على هذا الجهاز.</p></div><DecisionPanel label="الحالة الآن" truth="المظهر محفوظ على هذا الجهاز." nextAction="اختر المظهر الأنسب للعمل اليوم." tone="support" /><section className="micro-settings-list" aria-label="إعدادات الواجهة والبيانات"><article className="micro-setting-row"><span className="micro-setting-icon"><MoonStar aria-hidden="true" /></span><div><h2>المظهر</h2><p>المعروض الآن: {theme === "dark" ? "داكن" : "فاتح"}، والافتراضي عند البداية: {preference === "system" ? "النظام" : "اختيارك المحلي"}.</p></div><button className="micro-button micro-button-secondary" type="button" onClick={toggleTheme}>تبديل</button></article><article className="micro-setting-row"><span className="micro-setting-icon"><Shield aria-hidden="true" /></span><div><h2>بياناتك على هذا الجهاز</h2><p>لا توجد مزامنة سحابية أو تسجيل دخول هنا.</p></div></article><StorageRow icon={Download} title="تصدير محلي" text="سيُتاح بعد إضافة الحفظ والتحقق والاستعادة الآمنة." label="تصدير محلي غير متاح بعد" onClick={showStorageNotice} /><StorageRow icon={Upload} title="استيراد محلي" text="أي ملف غير صالح سيُرفض قبل تغيير البيانات الحالية." label="استيراد محلي غير متاح بعد" onClick={showStorageNotice} /></section></section>;
}

function StorageRow({ icon: Icon, title, text, label, onClick }: { icon: typeof Download; title: string; text: string; label: string; onClick: () => void }) {
  return <article className="micro-setting-row"><span className="micro-setting-icon"><Icon aria-hidden="true" /></span><div><h2>{title}</h2><p>{text}</p></div><button className="micro-icon-button" type="button" onClick={onClick} aria-label={label}><Icon aria-hidden="true" /></button></article>;
}
