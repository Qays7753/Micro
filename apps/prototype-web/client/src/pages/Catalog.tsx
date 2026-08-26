import { useEffect, useMemo, useState } from "react";
import { ArchiveX, ArrowRight, Check, GitCompareArrows, Plus, RotateCcw, Settings2, SlidersHorizontal, X } from "lucide-react";
import { useLocation } from "wouter";
import { usePrototypeServices } from "@/app/PrototypeServicesContext";
import { useUnsavedChangesGuard } from "@/components/forms/UnsavedChangesGuard";
import type { CatalogItem, CatalogItemKind, CatalogTemplate, DirectConversion, MeasurementUnit, UnitDimension } from "@micro-domain/catalog/index.js";
import type { CatalogRecordedMargin } from "@/application/catalog/catalogService";

const jod = (minor: number) => `${(minor / 100).toFixed(2)} د.أ`;
const dimensions: readonly { value: UnitDimension; label: string }[] = [
  { value: "count", label: "عدد" },
  { value: "mass", label: "وزن" },
  { value: "volume", label: "حجم" },
  { value: "time", label: "وقت" },
  { value: "distance", label: "مسافة" },
  { value: "area", label: "مساحة" },
];
const dimensionLabel = (dimension: UnitDimension) => dimensions.find(entry => entry.value === dimension)?.label ?? dimension;
const quantityLabel = (quantityMilli: number) => (quantityMilli / 1000).toFixed(3);
const parseQuantityMilli = (value: string) => {
  if (!/^\d+(?:\.\d{1,3})?$/.test(value.trim())) return null;
  const result = Math.round(Number(value) * 1000);
  return Number.isSafeInteger(result) && result > 0 ? result : null;
};
export const catalogDimensionOptions = dimensions;
export const parseCatalogQuantityMilli = parseQuantityMilli;
export const catalogYieldReadinessLabel = (value: CatalogTemplate["yieldReadiness"]) => value === "ready" ? "مهيأ" : value === "needs_conversion" ? "يحتاج تحويلًا صريحًا" : "غير مهيأ اختياريًا";
const operationKey = (prefix: string) => `${prefix}:${crypto.randomUUID()}`;

export default function Catalog() {
  const [, navigate] = useLocation();
  const { catalog, dataVersion, notifyDataChanged } = usePrototypeServices();
  const [kind, setKind] = useState<CatalogItemKind>("product");
  const [name, setName] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [unitId, setUnitId] = useState("");
  const [items, setItems] = useState<readonly CatalogItem[]>([]);
  const [margins, setMargins] = useState<readonly CatalogRecordedMargin[]>([]);
  const [units, setUnits] = useState<readonly MeasurementUnit[]>([]);
  const [conversions, setConversions] = useState<readonly DirectConversion[]>([]);
  const [templates, setTemplates] = useState<readonly CatalogTemplate[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showMeasurements, setShowMeasurements] = useState(false);

  const [unitName, setUnitName] = useState("");
  const [unitDimension, setUnitDimension] = useState<UnitDimension>("count");
  const [conversionFrom, setConversionFrom] = useState("");
  const [conversionTo, setConversionTo] = useState("");
  const [conversionNumerator, setConversionNumerator] = useState("");
  const [conversionDenominator, setConversionDenominator] = useState("");
  const [conversionNote, setConversionNote] = useState("");

  const [selectedItemId, setSelectedItemId] = useState("");
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateNote, setTemplateNote] = useState("");
  const [templateComponents, setTemplateComponents] = useState<CatalogTemplate["components"]>([]);
  const [componentName, setComponentName] = useState("");
  const [componentQuantity, setComponentQuantity] = useState("");
  const [componentUnitId, setComponentUnitId] = useState("");
  const [yieldEnabled, setYieldEnabled] = useState(false);
  const [yieldQuantity, setYieldQuantity] = useState("");
  const [yieldUnitId, setYieldUnitId] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  const activeUnits = useMemo(() => units.filter(unit => unit.active), [units]);
  const selectedItem = items.find(item => item.id === selectedItemId) ?? null;
  const selectedItemUnit = selectedItem?.unitId ? units.find(unit => unit.id === selectedItem.unitId) ?? null : null;
  const selectedTemplates = templates.filter(template => template.catalogItemId === selectedItemId);

  async function load() {
    const [itemResult, marginResult, unitResult, conversionResult, templateResult] = await Promise.all([
      catalog.list({ includeInactive: true }),
      catalog.readRecordedMargins(),
      catalog.listUnits({ includeInactive: true }),
      catalog.listConversions({ includeInactive: true }),
      catalog.listTemplates(undefined, { includeInactive: true }),
    ]);
    if (itemResult.ok) setItems(itemResult.items); else setMessage(itemResult.message);
    if (marginResult.ok) setMargins(marginResult.items); else setMessage(marginResult.message);
    if (unitResult.ok) setUnits(unitResult.units); else setMessage(unitResult.message);
    if (conversionResult.ok) setConversions(conversionResult.conversions); else setMessage(conversionResult.message);
    if (templateResult.ok) setTemplates(templateResult.templates); else setMessage(templateResult.message);
  }

  useEffect(() => { void load(); }, [catalog, dataVersion]);
  useEffect(() => {
    if (!selectedItemId && items.some(item => item.active)) setSelectedItemId(items.find(item => item.active)?.id ?? "");
    if (!componentUnitId && activeUnits[0]) setComponentUnitId(activeUnits[0].id);
    if (!yieldUnitId && activeUnits[0]) setYieldUnitId(activeUnits[0].id);
  }, [items, activeUnits, selectedItemId, componentUnitId, yieldUnitId]);

  async function create() {
    setSaving(true); setMessage(null);
    const result = await catalog.create({ kind, name, unitLabel: unitLabel.trim() || null, unitId: unitId || null, operationKey: operationKey("catalog") });
    setSaving(false);
    if (!result.ok) { setMessage(result.message); return; }
    setName(""); setUnitLabel(""); setUnitId(""); setSelectedItemId(result.item.id); notifyDataChanged(); await load(); setMessage("تم حفظ مرجع العمل محليًا. يمكنك إضافة القياس أو القالب لاحقًا، وليس ذلك مطلوبًا للحفظ.");
  }

  async function deactivate(id: string) { const result = await catalog.deactivate(id); if (!result.ok) { setMessage(result.message); return; } notifyDataChanged(); await load(); setMessage("تم إيقاف المرجع للطلبات الجديدة مع بقاء تاريخه محفوظًا."); }

  async function createUnit() {
    setMessage(null);
    const result = await catalog.createUnit({ nameAr: unitName, dimension: unitDimension, operationKey: operationKey("unit") });
    if (!result.ok) { setMessage(result.message); return; }
    setUnitName(""); setUnitId(result.unit.id); notifyDataChanged(); await load(); setMessage("تمت إضافة الوحدة. لم تُنشأ كمية أو حركة مخزون.");
  }

  async function deactivateUnit(id: string) { const result = await catalog.deactivateUnit(id); if (!result.ok) { setMessage(result.message); return; } notifyDataChanged(); await load(); setMessage("تم إيقاف الوحدة للاختيار الجديد مع إبقاء المراجع القديمة قابلة للقراءة."); }

  async function createConversion(): Promise<boolean> {
    setMessage(null);
    const numerator = Number.parseInt(conversionNumerator, 10);
    const denominator = Number.parseInt(conversionDenominator, 10);
    const result = await catalog.createConversion({ fromUnitId: conversionFrom, toUnitId: conversionTo, numerator, denominator, note: conversionNote, operationKey: operationKey("conversion") });
    if (!result.ok) { setMessage(result.message); return false; }
    setConversionFrom(""); setConversionTo(""); setConversionNumerator(""); setConversionDenominator(""); setConversionNote(""); notifyDataChanged(); await load(); setMessage("تم حفظ التحويل المباشر الصريح. لن نمر عبر وحدات أخرى تلقائيًا.");
    return true;
  }

  async function deactivateConversion(id: string) { const result = await catalog.deactivateConversion(id); if (!result.ok) { setMessage(result.message); return; } notifyDataChanged(); await load(); setMessage("تم إيقاف التحويل القديم مع إبقاء سجله قابلًا للقراءة."); }

  function addComponent() {
    const quantityMilli = parseQuantityMilli(componentQuantity);
    if (!componentName.trim() || !quantityMilli || !componentUnitId) { setMessage("أدخل اسم المكوّن وكمية موجبة حتى ثلاثة منازل ووحدة نشطة."); return; }
    setTemplateComponents(current => [...current, { id: crypto.randomUUID(), name: componentName.trim(), quantityMilli, unitId: componentUnitId, note: null }]);
    setComponentName(""); setComponentQuantity("");
  }

  function resetTemplateForm() {
    setEditingTemplateId(null); setTemplateTitle(""); setTemplateNote(""); setTemplateComponents([]); setYieldEnabled(false); setYieldQuantity("");
  }

  function startRevision(template: CatalogTemplate) {
    setEditingTemplateId(template.id); setSelectedItemId(template.catalogItemId); setTemplateTitle(template.title ?? ""); setTemplateNote(template.note ?? ""); setTemplateComponents(template.components); setYieldEnabled(template.yield !== null); setYieldQuantity(template.yield ? quantityLabel(template.yield.quantityMilli) : ""); setYieldUnitId(template.yield?.unitId ?? activeUnits[0]?.id ?? ""); setMessage(`تعديل مراجعة القالب ${template.revision}. سيبقى القالب السابق محفوظًا للقراءة.`);
  }

  async function saveTemplate(): Promise<boolean> {
    if (!selectedItemId) { setMessage("اختر مرجع عمل قبل إضافة قالب."); return false; }
    const parsedYield = yieldEnabled ? parseQuantityMilli(yieldQuantity) : null;
    if (yieldEnabled && (!parsedYield || !yieldUnitId)) { setMessage("أدخل كمية ناتج موجبة حتى ثلاثة منازل ووحدة ناتج."); return false; }
    setSaving(true); setMessage(null);
    const input = { catalogItemId: selectedItemId, title: templateTitle.trim() || null, note: templateNote.trim() || null, components: templateComponents, yield: yieldEnabled ? { quantityMilli: parsedYield as number, unitId: yieldUnitId } : null, operationKey: operationKey("template") };
    const result = editingTemplateId ? await catalog.reviseTemplate(editingTemplateId, input) : await catalog.createTemplate(input);
    setSaving(false);
    if (!result.ok) { setMessage(result.message); return false; }
    resetTemplateForm(); notifyDataChanged(); await load(); setMessage(result.template.yieldReadiness === "needs_conversion" ? "تم حفظ القالب، لكن الناتج غير مهيأ بعد: أضف تحويلًا صريحًا داخل البعد نفسه." : "تم حفظ القالب كمرجع تخطيطي فقط؛ لم يتغير المخزون أو السعر أو أي Snapshot.");
    return true;
  }

  async function deactivateTemplate(id: string) { const result = await catalog.deactivateTemplate(id); if (!result.ok) { setMessage(result.message); return; } notifyDataChanged(); await load(); setMessage("تم إيقاف القالب، وبقيت مراجعته السابقة محفوظة."); }

  const templateDirty = Boolean(templateTitle.trim() || templateNote.trim() || templateComponents.length || yieldEnabled || yieldQuantity.trim() || editingTemplateId);
  const conversionDirty = Boolean(conversionFrom || conversionTo || conversionNumerator || conversionDenominator || conversionNote.trim());
  const requestSafeNavigation = useUnsavedChangesGuard({ isDirty: templateDirty || conversionDirty, onSave: async () => templateDirty ? saveTemplate() : conversionDirty ? createConversion() : true });

  return <section className="micro-page">
    <button className="micro-back-button" type="button" onClick={() => requestSafeNavigation("/orders")}><ArrowRight aria-hidden="true" /> العودة للطلبات</button>
    <div className="micro-page-heading"><span className="micro-overline">مرجع اختياري</span><h1>منتجاتي وخدماتي المتكررة</h1><p>نظّم ما تكرره. لا يحدد هذا المرجع سعرًا أو مخزونًا أو ربحًا نهائيًا.</p></div>

    <section className="micro-form-card">
      <div className="micro-page-heading"><span className="micro-overline">1 · مرجع العمل</span><h2>ابدأ بالاسم فقط</h2><p>الوحدة المنظمة اختيارية؛ تبقى تسمية العرض القديمة كما أدخلتها.</p></div>
      <div className="micro-form-grid">
        <label className="micro-field"><span>نوع المرجع</span><select value={kind} onChange={event => setKind(event.target.value as CatalogItemKind)}><option value="product">منتج</option><option value="service">خدمة</option></select></label>
        <label className="micro-field"><span>اسم المرجع</span><input value={name} onChange={event => setName(event.target.value)} placeholder={kind === "product" ? "مثال: صندوق هدايا" : "مثال: تغليف هدايا"} /></label>
        <label className="micro-field"><span>وحدة عرض <small>اختيارية</small></span><input value={unitLabel} onChange={event => setUnitLabel(event.target.value)} placeholder={kind === "product" ? "مثال: قطعة" : "مثال: جلسة"} /></label>
        <label className="micro-field"><span>وحدة منظمة <small>اختيارية</small></span><select value={unitId} onChange={event => setUnitId(event.target.value)}><option value="">لا أضيف وحدة الآن</option>{activeUnits.map(unit => <option key={unit.id} value={unit.id}>{unit.nameAr} · {dimensionLabel(unit.dimension)}</option>)}</select></label>
      </div>
      <button className="micro-button micro-button-primary" type="button" disabled={saving || !name.trim()} onClick={create}><Plus aria-hidden="true" /> {saving ? "جارٍ الحفظ…" : "أضف مرجعًا"}</button>
    </section>

    <section className="micro-form-card">
      <button className="micro-section-toggle" type="button" aria-expanded={showMeasurements} onClick={() => setShowMeasurements(value => !value)}><span><SlidersHorizontal aria-hidden="true" /> 2 · القياس والتحويلات <small>اختيارية</small></span>{showMeasurements ? <X aria-hidden="true" /> : <Settings2 aria-hidden="true" />}</button>
      <p className="micro-muted-copy">أضف ما يساعدك على تذكر الكمية. لن ننشئ مخزونًا، ولن نحول الوزن إلى حجم تلقائيًا.</p>
      {showMeasurements ? <div className="micro-subsection-stack">
        <div className="micro-subsection"><div className="micro-subsection-heading"><div><span className="micro-overline">الوحدات</span><h3>وحدات ذات بُعد واضح</h3></div><p>الوحدة مجرد معنى للكمية؛ لا يلزم ربطها بأي مرجع.</p></div><div className="micro-form-grid"><label className="micro-field"><span>اسم عملي</span><input value={unitName} onChange={event => setUnitName(event.target.value)} placeholder="مثال: كيلوغرام" /></label><label className="micro-field"><span>البعد</span><select value={unitDimension} onChange={event => setUnitDimension(event.target.value as UnitDimension)}>{dimensions.map(dimension => <option key={dimension.value} value={dimension.value}>{dimension.label}</option>)}</select></label></div><button className="micro-button micro-button-secondary" type="button" disabled={!unitName.trim()} onClick={createUnit}><Plus aria-hidden="true" /> أضف وحدة</button><div className="micro-chip-list">{units.length ? units.map(unit => <span className={`micro-chip ${unit.active ? "" : "micro-chip-muted"}`} key={unit.id}>{unit.nameAr} · {dimensionLabel(unit.dimension)}{unit.active ? <button type="button" aria-label={`إيقاف ${unit.nameAr}`} onClick={() => deactivateUnit(unit.id)}><ArchiveX aria-hidden="true" /></button> : <small>موقوفة</small>}</span>) : <p className="micro-empty-copy">لا توجد وحدات منظمة بعد. هذا طبيعي ويمكنك تركها فارغة.</p>}</div></div>
        <div className="micro-subsection"><div className="micro-subsection-heading"><div><span className="micro-overline">تحويل مباشر</span><h3>أضف تحويلًا واضحًا</h3></div><p>العامل هو <bdi dir="ltr">الناتج = الكمية × البسط ÷ المقام</bdi>، ولا نقرب إذا تعذر تمثيله.</p></div><div className="micro-form-grid"><label className="micro-field"><span>من</span><select value={conversionFrom} onChange={event => setConversionFrom(event.target.value)}><option value="">اختر وحدة المصدر</option>{activeUnits.map(unit => <option key={unit.id} value={unit.id}>{unit.nameAr} · {dimensionLabel(unit.dimension)}</option>)}</select></label><label className="micro-field"><span>إلى</span><select value={conversionTo} onChange={event => setConversionTo(event.target.value)}><option value="">اختر وحدة الوجهة</option>{activeUnits.map(unit => <option key={unit.id} value={unit.id}>{unit.nameAr} · {dimensionLabel(unit.dimension)}</option>)}</select></label><label className="micro-field"><span>البسط <small dir="rtl">موجب</small></span><input dir="ltr" inputMode="numeric" value={conversionNumerator} onChange={event => setConversionNumerator(event.target.value)} placeholder="1000" /></label><label className="micro-field"><span>المقام <small dir="rtl">موجب</small></span><input dir="ltr" inputMode="numeric" value={conversionDenominator} onChange={event => setConversionDenominator(event.target.value)} placeholder="1" /></label><label className="micro-field micro-field-wide"><span>لماذا هذا التحويل؟</span><input value={conversionNote} onChange={event => setConversionNote(event.target.value)} placeholder="مثال: 1 كيلوغرام = 1000 غرام" /></label></div><button className="micro-button micro-button-secondary" type="button" disabled={!conversionFrom || !conversionTo || !conversionNumerator || !conversionDenominator || !conversionNote.trim()} onClick={createConversion}><GitCompareArrows aria-hidden="true" /> أضف تحويلًا صريحًا</button><div className="micro-list micro-list-compact">{conversions.length ? conversions.map(conversion => { const from = units.find(unit => unit.id === conversion.fromUnitId); const to = units.find(unit => unit.id === conversion.toUnitId); return <div className="micro-list-item" key={conversion.id}><div><strong>{from?.nameAr ?? "وحدة قديمة"} ← {to?.nameAr ?? "وحدة قديمة"}</strong><p dir="ltr">× {conversion.numerator} ÷ {conversion.denominator} · {conversion.note}{conversion.active ? "" : " · موقوف"}</p></div>{conversion.active ? <button className="micro-button micro-button-secondary" type="button" onClick={() => deactivateConversion(conversion.id)}><ArchiveX aria-hidden="true" /> إيقاف</button> : null}</div>; }) : <p className="micro-empty-copy">لا توجد تحويلات. لن نحتاج إليها ما دامت الوحدات متطابقة.</p>}</div></div>
      </div> : null}
    </section>

    <section className="micro-form-card">
      <div className="micro-page-heading"><span className="micro-overline">3 · قالب اختياري</span><h2>ماذا أجهز عادةً؟</h2><p>القالب للتذكر والتخطيط فقط. لا يسحب مخزونًا ولا يغيّر تكلفة قديمة.</p></div>
      <label className="micro-field"><span>مرجع القالب</span><select value={selectedItemId} onChange={event => { setSelectedItemId(event.target.value); resetTemplateForm(); }}><option value="">اختر مرجعًا</option>{items.filter(item => item.active).map(item => <option key={item.id} value={item.id}>{item.name} · {item.kind === "product" ? "منتج" : "خدمة"}</option>)}</select></label>
      {selectedItem ? <div className="micro-subsection-stack"><div className="micro-subsection"><div className="micro-subsection-heading"><div><h3>{editingTemplateId ? "مراجعة القالب" : "قالب جديد"}</h3><p>{selectedItemUnit ? `مخرج المرجع: ${selectedItemUnit.nameAr} · ${dimensionLabel(selectedItemUnit.dimension)}` : "لا توجد وحدة مخرج منظمة؛ يمكن حفظ القالب دون yield."}</p></div></div><div className="micro-form-grid"><label className="micro-field"><span>عنوان أو مصدر <small>اختياري</small></span><input value={templateTitle} onChange={event => setTemplateTitle(event.target.value)} placeholder="مثال: تجهيز الطلب المعتاد" /></label><label className="micro-field micro-field-wide"><span>ملاحظة <small>اختيارية</small></span><input value={templateNote} onChange={event => setTemplateNote(event.target.value)} placeholder="ملاحظة تساعدني في التكرار" /></label></div><div className="micro-inline-heading"><h4>المكونات</h4><span>{templateComponents.length} مكوّن</span></div><div className="micro-form-grid"><label className="micro-field"><span>اسم المكوّن</span><input value={componentName} onChange={event => setComponentName(event.target.value)} placeholder="مثال: شمع" /></label><label className="micro-field"><span>الكمية <small>حتى 3 منازل</small></span><input dir="ltr" inputMode="decimal" value={componentQuantity} onChange={event => setComponentQuantity(event.target.value)} placeholder="1.250" /></label><label className="micro-field"><span>الوحدة</span><select value={componentUnitId} onChange={event => setComponentUnitId(event.target.value)}><option value="">اختر وحدة</option>{activeUnits.map(unit => <option key={unit.id} value={unit.id}>{unit.nameAr} · {dimensionLabel(unit.dimension)}</option>)}</select></label></div><button className="micro-button micro-button-secondary" type="button" onClick={addComponent}><Plus aria-hidden="true" /> أضف مكوّنًا للقالب</button>{templateComponents.length ? <div className="micro-list micro-list-compact">{templateComponents.map(component => <div className="micro-list-item" key={component.id}><div><strong>{component.name}</strong><p dir="ltr">{quantityLabel(component.quantityMilli)} · {units.find(unit => unit.id === component.unitId)?.nameAr ?? "وحدة محفوظة"}</p></div><button className="micro-icon-button" type="button" aria-label={`إزالة ${component.name}`} onClick={() => setTemplateComponents(current => current.filter(entry => entry.id !== component.id))}><X aria-hidden="true" /></button></div>)}</div> : <p className="micro-empty-copy">لم تضف مكونات بعد. يمكنك حفظ قالب فارغ كملاحظة تخطيطية، أو إضافة ما تكرره عادةً.</p>}<label className="micro-checkbox"><input type="checkbox" checked={yieldEnabled} onChange={event => setYieldEnabled(event.target.checked)} /><span>أضيف ناتجًا متوقعًا لهذا القالب</span></label>{yieldEnabled ? <div className="micro-form-grid"><label className="micro-field"><span>كمية الناتج</span><input dir="ltr" inputMode="decimal" value={yieldQuantity} onChange={event => setYieldQuantity(event.target.value)} placeholder="12.000" /></label><label className="micro-field"><span>وحدة الناتج</span><select value={yieldUnitId} onChange={event => setYieldUnitId(event.target.value)}><option value="">اختر وحدة الناتج</option>{activeUnits.map(unit => <option key={unit.id} value={unit.id}>{unit.nameAr} · {dimensionLabel(unit.dimension)}</option>)}</select></label></div> : null}<div className="micro-action-row"><button className="micro-button micro-button-primary" type="button" disabled={saving || !selectedItemId} onClick={saveTemplate}>{editingTemplateId ? <RotateCcw aria-hidden="true" /> : <Check aria-hidden="true" />} {saving ? "جارٍ الحفظ…" : editingTemplateId ? "احفظ المراجعة" : "احفظ القالب"}</button>{editingTemplateId ? <button className="micro-button micro-button-secondary" type="button" onClick={resetTemplateForm}>إلغاء المراجعة</button> : null}</div></div><div className="micro-subsection"><div className="micro-subsection-heading"><div><span className="micro-overline">المراجعات المحفوظة</span><h3>قالب هذا المرجع</h3></div><p>التعديل ينشئ مراجعة جديدة؛ لا يعيد حساب طلب سابق.</p></div>{selectedTemplates.length ? <div className="micro-list">{selectedTemplates.map(template => <article className="micro-list-item" key={template.id}><div><strong>{template.title || "قالب بلا عنوان"} · مراجعة {template.revision}</strong><p>{template.components.length} مكوّن{template.yield ? ` · الناتج ${quantityLabel(template.yield.quantityMilli)}` : " · بلا yield"}{template.active ? "" : " · موقوف"}</p>{template.yieldReadiness === "needs_conversion" ? <p className="micro-warning-copy">الناتج غير مهيأ: أضف تحويلًا صريحًا داخل البعد نفسه، ولن نخمّن أو نقرب.</p> : template.yieldReadiness === "ready" ? <p className="micro-success-copy">الناتج متوافق مع وحدة المرجع.</p> : null}<details className="micro-inline-disclosure"><summary>حدود القالب</summary><p>هذا تذكّر تخطيطي فقط؛ لا Purchase ولا Inventory ولا Consumption ولا COGS ولا إيراد ولا هامش ينشأ منه.</p></details></div><div className="micro-action-column">{template.active ? <><button className="micro-button micro-button-secondary" type="button" onClick={() => startRevision(template)}><RotateCcw aria-hidden="true" /> مراجعة</button><button className="micro-button micro-button-secondary" type="button" onClick={() => deactivateTemplate(template.id)}><ArchiveX aria-hidden="true" /> إيقاف</button></> : null}</div></article>)}</div> : <p className="micro-empty-copy">لا يوجد قالب لهذا المرجع. وهذا مسار صحيح للخدمة أو العمل المخصص.</p>}</div></div> : <p className="micro-empty-copy">اختر مرجعًا إن أردت إضافة مكونات أو ناتجًا متكررًا. لا يلزم إعداد أي قالب للحفظ.</p>}
    </section>

    <section className="micro-form-card"><div className="micro-page-heading"><span className="micro-overline">المراجع المسجلة</span><h2>أعمال متكررة</h2></div>{items.length ? <div className="micro-list">{items.map(item => { const margin = margins.find(entry => entry.catalogItemId === item.id); const variance = margin?.materialVariance; const organizedUnit = item.unitId ? units.find(unit => unit.id === item.unitId) : null; return <article key={item.id} className="micro-list-item"><div><strong>{item.name}</strong><p>{item.kind === "product" ? "منتج" : "خدمة"}{item.unitLabel ? ` · ${item.unitLabel}` : ""}{organizedUnit ? ` · ${organizedUnit.nameAr}` : ""}{item.active ? "" : " · موقوف للطلبات الجديدة"}</p>{margin ? <><p><strong>هامش مباشر مسجل: {jod(margin.directMarginMinor)}</strong> · {margin.finalOrderCount} طلب نهائي</p>{variance?.recordedOrderCount ? <p>فرق مادة مسجل: {jod(variance.varianceMinor ?? 0)} مقارنة بالمخطط · {variance.recordedOrderCount} طلب</p> : null}{variance?.notRecordedOrderCount ? <p>لا توجد مادة منفذة مسجلة لـ {variance.notRecordedOrderCount} طلب؛ لا يعني ذلك صفر مادة.</p> : null}</> : <p>لا توجد طلبات نهائية مرتبطة بهذا المرجع بعد.</p>}<details className="micro-inline-disclosure"><summary>لماذا؟</summary><p>الهامش وفرق المادة قراءتان تفسيريتان؛ لا يشملان تكلفة فعلية كاملة أو كهرباء أو تسويقًا أو وقتًا غير مسجل.</p></details></div>{item.active ? <button className="micro-button micro-button-secondary" type="button" onClick={() => deactivate(item.id)}><ArchiveX aria-hidden="true" /> إيقاف</button> : null}</article>; })}</div> : <p className="micro-empty-copy">لا يوجد مرجع بعد. أضف فقط العمل الذي يتكرر كي يصبح تحليله منظمًا لاحقًا.</p>}</section>
    {message ? <p className="micro-save-note" role="status">{message}</p> : null}
  </section>;
}
