/** Micro design reminder: catalog is an optional reference layer; it never defines price, stock, cost, or a retail checkout. */
import { useEffect, useState } from "react";
import { ArrowRight, ArchiveX, Plus } from "lucide-react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import type { CatalogItem, CatalogItemKind } from "@micro-domain/catalog/index.js";
import type { CatalogRecordedMargin } from "@/application/catalog/catalogService";

const jod = (minor: number) => `${(minor / 100).toFixed(2)} د.أ`;

export default function Catalog() {
  const [, navigate] = useLocation();
  const { catalog, dataVersion, notifyDataChanged } = usePrototypeServices();
  const [kind, setKind] = useState<CatalogItemKind>("product");
  const [name, setName] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [items, setItems] = useState<readonly CatalogItem[]>([]);
  const [margins, setMargins] = useState<readonly CatalogRecordedMargin[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function load() { const [itemResult, marginResult] = await Promise.all([catalog.list({ includeInactive: true }), catalog.readRecordedMargins()]); if (itemResult.ok) setItems(itemResult.items); else setMessage(itemResult.message); if (marginResult.ok) setMargins(marginResult.items); else setMessage(marginResult.message); }
  useEffect(() => { void load(); }, [catalog, dataVersion]);
  async function create() {
    setSaving(true); setMessage(null);
    const result = await catalog.create({ kind, name, unitLabel: unitLabel.trim() || null, operationKey: `catalog:${crypto.randomUUID()}` });
    setSaving(false);
    if (!result.ok) { setMessage(result.message); return; }
    setName(""); setUnitLabel(""); notifyDataChanged(); await load(); setMessage("تم حفظ مرجع العمل محليًا.");
  }
  async function deactivate(id: string) { const result = await catalog.deactivate(id); if (!result.ok) { setMessage(result.message); return; } notifyDataChanged(); await load(); setMessage("تم إيقاف المرجع للطلبات الجديدة مع بقاء تاريخه محفوظًا."); }
  return <section className="micro-page"><button className="micro-back-button" type="button" onClick={() => navigate("/orders")}><ArrowRight aria-hidden="true" /> العودة للطلبات</button><div className="micro-page-heading"><span className="micro-overline">مرجع اختياري</span><h1>منتجاتي وخدماتي المتكررة</h1><p>نظّم ما تكرره. لا يحدد هذا المرجع سعرًا أو مخزونًا أو ربحًا نهائيًا.</p></div><section className="micro-form-card"><label className="micro-field"><span>نوع المرجع</span><select value={kind} onChange={event => setKind(event.target.value as CatalogItemKind)}><option value="product">منتج</option><option value="service">خدمة</option></select></label><label className="micro-field"><span>اسم المرجع</span><input value={name} onChange={event => setName(event.target.value)} placeholder={kind === "product" ? "مثال: صندوق هدايا" : "مثال: تغليف هدايا"} /></label><label className="micro-field"><span>وحدة عرض <small>اختيارية</small></span><input value={unitLabel} onChange={event => setUnitLabel(event.target.value)} placeholder={kind === "product" ? "مثال: قطعة" : "مثال: جلسة"} /></label><button className="micro-button micro-button-primary" type="button" disabled={saving || !name.trim()} onClick={create}><Plus aria-hidden="true" /> {saving ? "جارٍ الحفظ…" : "أضف مرجعًا"}</button>{message ? <p className="micro-save-note" role="status">{message}</p> : null}</section><section className="micro-form-card"><div className="micro-page-heading"><span className="micro-overline">المراجع المسجلة</span><h2>أعمال متكررة</h2></div>{items.length ? <div className="micro-list">{items.map(item => { const margin = margins.find(entry => entry.catalogItemId === item.id); return <article key={item.id} className="micro-list-item"><div><strong>{item.name}</strong><p>{item.kind === "product" ? "منتج" : "خدمة"}{item.unitLabel ? ` · ${item.unitLabel}` : ""}{item.active ? "" : " · موقوف للطلبات الجديدة"}</p>{margin ? <p><strong>هامش مباشر مسجل: {jod(margin.directMarginMinor)}</strong> · {margin.finalOrderCount} طلب نهائي</p> : <p>لا توجد طلبات نهائية مرتبطة بهذا المرجع بعد.</p>}<small>لا يشمل هذا الهامش تكلفة فعلية كاملة أو كهرباء أو تسويقًا أو وقتًا غير مسجل.</small></div>{item.active ? <button className="micro-button micro-button-secondary" type="button" onClick={() => deactivate(item.id)}><ArchiveX aria-hidden="true" /> إيقاف</button> : null}</article>; })}</div> : <p className="micro-empty-copy">لا يوجد مرجع بعد. أضف فقط العمل الذي يتكرر كي يصبح تحليله منظمًا لاحقًا.</p>}</section></section>;
}
