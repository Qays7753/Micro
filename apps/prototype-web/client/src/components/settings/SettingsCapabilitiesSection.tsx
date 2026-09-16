/**
 * SET-003 (قرار المالك ٢٠٢٦-٠٩-١٦): قسم «قدرات مشروعك» — منتج واحد بمحرك
 * حقيقة واحد وقدرات اختيارية. الإيقاف يخفي مداخل الإدخال اليومية فقط ويخفض
 * أولويتها البصرية؛ السجلات والديون والالتزامات القائمة تبقى ظاهرة قابلة
 * للتدقيق في دفاترها دائمًا، ولا يُحذف شيء أبدًا. الأساس (بيع/مصروف/كاش/
 * تحصيل) غير قابل للإيقاف.
 */
import { useEffect, useState } from "react";
import type { PreferenceService } from "@/application/preferences/preferenceService";
import type { AgreementService } from "@/application/agreements/agreementService";
import type { InventoryMaterialService } from "@/application/inventory/inventoryMaterialService";
import type { SupplierPurchaseService } from "@/application/suppliers/supplierPurchaseService";
import type { CatalogService } from "@/application/catalog/catalogService";

type CapabilityMeta = {
  id: CapabilityId;
  label: string;
  why: string;
  affects: string;
  financialEffect: string;
  appearsIn: string;
};

/* المعرّفات المستقرة للقدرات — لا تُترجم ولا تُخزن بغيرها (قيم مخزنة). */
export type CapabilityId = "orders" | "inventory" | "suppliers" | "catalog";

type SectionProps = {
  preferences: PreferenceService;
  agreements: AgreementService;
  inventory: InventoryMaterialService;
  supplierPurchases: SupplierPurchaseService;
  catalog: CatalogService;
  dataVersion: number;
  notifyDataChanged: () => void;
};

type RecordsCount = { orders: number; materials: number; purchases: number; catalogItems: number };

export function SettingsCapabilitiesSection({
  preferences,
  agreements,
  inventory,
  supplierPurchases,
  catalog,
  dataVersion,
  notifyDataChanged,
}: SectionProps) {
  const [disabled, setDisabled] = useState<readonly CapabilityId[]>([]);
  const [counts, setCounts] = useState<RecordsCount | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const preference = await preferences.readDisabledCapabilities();
      if (active && preference.ok) setDisabled(preference.disabled as CapabilityId[]);
      /* أعداد السجلات القائمة — أساس تحذير الأثر الصادق عند الإيقاف. */
      const [ordersResult, materialsResult, purchasesResult, catalogResult] = await Promise.all([
        agreements.list(),
        inventory.overview(),
        supplierPurchases.readSummary(),
        catalog.list(),
      ]);
      if (!active) return;
      setCounts({
        orders: ordersResult.ok ? ordersResult.orders.length : 0,
        materials: materialsResult.ok ? materialsResult.value.materials.length : 0,
        purchases: purchasesResult.ok ? (purchasesResult.value.purchaseCount ?? 0) : 0,
        catalogItems: catalogResult.ok ? catalogResult.items.length : 0,
      });
    })();
    return () => {
      active = false;
    };
  }, [preferences, agreements, inventory, supplierPurchases, catalog, dataVersion]);

  const countFor = (id: CapabilityId): number =>
    counts === null
      ? 0
      : id === "orders"
        ? counts.orders
        : id === "inventory"
          ? counts.materials
          : id === "suppliers"
            ? counts.purchases
            : counts.catalogItems;

  async function toggle(id: CapabilityId, nextDisabled: boolean) {
    setSaving(true);
    setMessage(null);
    const next = nextDisabled
      ? [...new Set([...disabled, id])]
      : disabled.filter(candidate => candidate !== id);
    const result = await preferences.saveDisabledCapabilities(next);
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setDisabled(result.disabled as CapabilityId[]);
    notifyDataChanged();
  }

  return (
    <details className="micro-settings-section" data-testid="capabilities-section">
      <summary>
        <span>قدرات مشروعك</span>
        <small>شغّل ما تستخدمه وأوقف ما لا يلزمك — السجلات القائمة لا تُمس.</small>
      </summary>
      <p className="micro-field-hint">
        الأساس دائمًا مفعّل: البيع والمصروف والكاش والتحصيل ونتيجتك المتاحة. ما يلي اختياري، وإيقافه يخفي
        مداخل الإدخال اليومية فقط — الديون والالتزامات والسجلات القائمة تبقى ظاهرة في دفاترها للتدقيق،
        والتفعيل لاحقًا يعيد كل شيء كما كان.
      </p>
      {(() => {
        /* بيانات القدرات داخل جسم الملف المطوي — تُعرض عند الفتح فقط. */
        const CAPABILITIES: readonly CapabilityMeta[] = [
          {
            id: "orders",
            label: "الطلبات والتنفيذ",
            why: "للعمل الذي يُنفَّذ على مراحل: مسودة، اتفاق، تنفيذ، جاهزية، تسليم، ثم تحصيل أو دين.",
            affects: "أزرار «طلب من عميل» و«مسودة تصميم» في مشروعي الآن، وأزرار الإنشاء في العمل.",
            financialEffect: "الإيقاف يمنع إنشاء طلبات جديدة فقط؛ الطلبات والديون القائمة تبقى ظاهرة.",
            appearsIn: "قائمة الطلبات ومواعيد التسليم في «العمل»، وديون العملاء في «المالية».",
          },
          {
            id: "inventory",
            label: "المواد والمخزون",
            why: "لمتابعة كميات المواد وتكلفتها وحركاتها — استلامًا واستهلاكًا وهدرًا.",
            affects: "مداخل تسجيل المواد وحركاتها من «العمل» وصفحات الشراء.",
            financialEffect: "الإيقاف يمنع حركات مخزون جديدة؛ الأرصدة والحركات المسجلة تبقى ظاهرة.",
            appearsIn: "«المواد والمخزون» من «العمل»، ومقترحات التكلفة المرتبطة بالمواد.",
          },
          {
            id: "suppliers",
            label: "الموردون والمشتريات",
            why: "لتسجيل شراء المواد بالأجل والدفعات عليه ومتابعة الذمة.",
            affects: "زر تسجيل الشراء من «المالية ← الموردون والمشتريات».",
            financialEffect: "الإيقاف يمنع شراءً جديدًا؛ الذمم والدفعات القائمة تبقى ظاهرة.",
            appearsIn: "«عليّ للموردين» في المالية، ودفتر الموردين وتفاصيله.",
          },
          {
            id: "catalog",
            label: "منتجاتي وخدماتي",
            why: "مرجع سريع لأعمالك المتكررة بأسعارها وقوالب تكلفتها.",
            affects: "مدخل «منتجاتي وخدماتي» من الرئيسية والعمل.",
            financialEffect: "لا أثر مالي أبدًا — مرجع قراءة؛ الإيقاف يخفي مدخله فقط.",
            appearsIn: "وحدة «منتجاتي وخدماتي» في مشروعي الآن، ومسار الكتالوج.",
          },
        ];
        return (
          <div className="micro-capability-list">
            {CAPABILITIES.map(capability => {
              const isDisabled = disabled.includes(capability.id);
              const existing = countFor(capability.id);
              return (
                <section key={capability.id} className="micro-capability-row" data-disabled={isDisabled}>
                  <div>
                    <strong>{capability.label}</strong>
                    <p>{capability.why}</p>
                    <dl>
                      <div>
                        <dt>ما الذي يتأثر؟</dt>
                        <dd>{capability.affects}</dd>
                      </div>
                      <div>
                        <dt>الأثر المالي للإيقاف</dt>
                        <dd>{capability.financialEffect}</dd>
                      </div>
                      <div>
                        <dt>أين تظهر النتائج؟</dt>
                        <dd>{capability.appearsIn}</dd>
                      </div>
                    </dl>
                    {isDisabled && existing > 0 ? (
                      <p className="micro-warning-copy" role="status">
                        {`عندك ${existing} سجلًا قائمًا في هذه القدرة — الإيقاف يخفي مداخل الإدخال فقط، وسجلاتك تبقى ظاهرة قابلة للتدقيق في دفاترها.`}
                      </p>
                    ) : null}
                  </div>
                  <button
                    className="micro-text-action"
                    type="button"
                    disabled={saving}
                    aria-pressed={isDisabled}
                    onClick={() => {
                      void toggle(capability.id, !isDisabled);
                    }}
                  >
                    {isDisabled ? "تفعيل" : "إيقاف الإدخال"}
                  </button>
                </section>
              );
            })}
          </div>
        );
      })()}
      {message ? (
        <p className="micro-field-error" role="alert">
          {message}
        </p>
      ) : null}
    </details>
  );
}
