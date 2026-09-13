/** Transfer snapshot migrations: the null-coalescing upgrade of imported
 * data to the current LocalStoreSnapshot shape, extracted verbatim from
 * localTransferService.prepareImport (Group 10, Phase 10-D). Field-by-field
 * normalizations and ordering unchanged; released pairs keep their gates in
 * the envelope module.
 */
import { type LocalStoreSnapshot } from "@/storage/local/types";
import { isRecord, normalizeImportedCategoryLabel } from "./transferFamilyValidators";

export function migrateTransferSnapshot(
  raw: Record<string, unknown>,
  isCurrent: boolean,
): LocalStoreSnapshot {
  const migrated: LocalStoreSnapshot = {
    ...raw,
    ownerProfile: raw.ownerProfile ?? null,
    drafts: Array.isArray(raw.drafts)
      ? raw.drafts.map(draft =>
          isRecord(draft) ? { ...draft, catalogItemId: draft.catalogItemId ?? null } : draft,
        )
      : [],
    orders: Array.isArray(raw.orders)
      ? raw.orders.map(order =>
          isRecord(order)
            ? {
                ...order,
                catalogItemId: order.catalogItemId ?? null,
                followUpSummary: order.followUpSummary ?? null,
                followUpDate: order.followUpDate ?? null,
                followUpReason: order.followUpReason ?? null,
                followUpEvents: Array.isArray(order.followUpEvents) ? order.followUpEvents : [],
              }
            : order,
        )
      : [],
    directSales: Array.isArray(raw.directSales)
      ? raw.directSales.map(sale =>
          isRecord(sale)
            ? {
                ...sale,
                status: sale.status ?? "active",
                cancelledAt: sale.cancelledAt ?? null,
                cancellationReason: sale.cancellationReason ?? null,
                revisions: Array.isArray(sale.revisions) ? sale.revisions : [],
              }
            : sale,
        )
      : [],
    schedules: Array.isArray(raw.schedules)
      ? raw.schedules.map(schedule =>
          isRecord(schedule)
            ? {
                ...schedule,
                recurrenceId: schedule.recurrenceId ?? null,
                recurrenceIndex: schedule.recurrenceIndex ?? null,
              }
            : schedule,
        )
      : [],
    recurrences: Array.isArray(raw.recurrences) ? raw.recurrences : [],
    financialEvents: Array.isArray(raw.financialEvents)
      ? raw.financialEvents.map(event =>
          isRecord(event)
            ? {
                ...event,
                amanahDeltaMinor: event.amanahDeltaMinor ?? 0,
                /* المجموعة ٤ (عقد ٢٩): أعمدة الطبقات الجديدة — القديم يقرأ صفرًا
                 * كسابقة الأمانات؛ لا اختراع أصول ولا قروض ولا إيراد عربون. */
                assetDeltaMinor: event.assetDeltaMinor ?? 0,
                loanDeltaMinor: event.loanDeltaMinor ?? 0,
                revenueDeltaMinor: event.revenueDeltaMinor ?? 0,
                /* المجموعة ١ (تصنيفي للمصاريف): تطبيع الوسم داخل سياق المصروف عند
                 * الاستيراد — القصّ والدمج والفارغ→null، كسابقة amanahDeltaMinor ?? 0؛
                 * لا اختراع تصنيف للتاريخ ولا وسم على أحداث بلا سياق. */
                expenseContext: isRecord(event.expenseContext)
                  ? {
                      ...event.expenseContext,
                      categoryLabel: normalizeImportedCategoryLabel(
                        (event.expenseContext as Record<string, unknown>).categoryLabel,
                      ),
                    }
                  : event.expenseContext,
              }
            : event,
        )
      : [],
    preferences: isRecord(raw.preferences)
      ? { ...raw.preferences, lastVerifiedExportAt: raw.preferences.lastVerifiedExportAt ?? null }
      : raw.preferences,
    supplierPurchases: Array.isArray(raw.supplierPurchases)
      ? raw.supplierPurchases.map(purchase =>
          isRecord(purchase)
            ? {
                ...purchase,
                /* المجموعة ٢ (عقد ٢٨): ربط المادة والكمية المتوقعة — غياب = null (لا صفر). */
                materialId: purchase.materialId ?? null,
                expectedQuantityMilli: purchase.expectedQuantityMilli ?? null,
                revisions: Array.isArray(purchase.revisions)
                  ? purchase.revisions.map(revision =>
                      isRecord(revision)
                        ? {
                            ...revision,
                            beforeMaterialId: revision.beforeMaterialId ?? null,
                            beforeExpectedQuantityMilli: revision.beforeExpectedQuantityMilli ?? null,
                          }
                        : revision,
                    )
                  : purchase.revisions,
              }
            : purchase,
        )
      : [],
    cashWallets: Array.isArray(raw.cashWallets) ? raw.cashWallets : [],
    cashContinuityEntries: Array.isArray(raw.cashContinuityEntries) ? raw.cashContinuityEntries : [],
    /* المجموعة ٢ (عقد ٢٨): قرار المتابعة ومعرفة البداية — غياب = null (إرث متوافق). */
    materials: Array.isArray(raw.materials)
      ? raw.materials.map(material =>
          isRecord(material)
            ? { ...material, tracking: material.tracking ?? null, opening: material.opening ?? null }
            : material,
        )
      : [],
    inventoryActivation: isRecord(raw.inventoryActivation) ? raw.inventoryActivation : null,
    inventoryMovements: Array.isArray(raw.inventoryMovements)
      ? raw.inventoryMovements.map(movement =>
          isRecord(movement)
            ? {
                ...movement,
                wasteContext:
                  movement.type === "waste" ? (movement.wasteContext ?? { kind: "general_project" }) : null,
                /* المجموعة ٢ (عقد ٢٨): معرفة التكلفة — غياب = known (إرث متوافق). */
                costKnowledge: movement.costKnowledge ?? "known",
                /* المجموعة ٣ (عقد D6): ربط البيع المباشر — غياب = null (لا مرجع مفترض). */
                saleId: movement.saleId ?? null,
              }
            : movement,
        )
      : [],
    /* المجموعة ٢ (عقد ٢٨ / D-027): سجلات النقص — غياب = [] (لا نقص مفترض). */
    inventoryShortages: Array.isArray(raw.inventoryShortages) ? raw.inventoryShortages : [],
    catalogItems: Array.isArray(raw.catalogItems)
      ? raw.catalogItems.map(item => (isRecord(item) ? { ...item, unitId: item.unitId ?? null } : item))
      : [],
    measurementUnits: Array.isArray(raw.measurementUnits) ? raw.measurementUnits : [],
    directConversions: Array.isArray(raw.directConversions) ? raw.directConversions : [],
    catalogTemplates: Array.isArray(raw.catalogTemplates)
      ? raw.catalogTemplates.map(template =>
          isRecord(template)
            ? {
                ...template,
                /* المجموعة ٣ (عقد D5): ربط هوية المادة بالمكوّن وبنود القالب الاختيارية —
                 * غياب = null بلا اختراع رابط ولا بنود. */
                components: Array.isArray(template.components)
                  ? template.components.map(component =>
                      isRecord(component)
                        ? { ...component, materialId: component.materialId ?? null }
                        : component,
                    )
                  : template.components,
                extras: template.extras ?? null,
                /* المجموعة ٤ (عقد ٢٩): علم الخصم التلقائي — غياب = غير معلن. */
                autoConsumeOnDelivery: template.autoConsumeOnDelivery === true ? true : null,
              }
            : template,
        )
      : [],
    actualTimeRecords: Array.isArray(raw.actualTimeRecords)
      ? raw.actualTimeRecords
      : isCurrent
        ? undefined
        : [],
    shortCashDeclarations: Array.isArray(raw.shortCashDeclarations) ? raw.shortCashDeclarations : [],
    ownerEntitlementPolicies: Array.isArray(raw.ownerEntitlementPolicies)
      ? raw.ownerEntitlementPolicies.map(policy =>
          isRecord(policy)
            ? {
                ...policy,
                seriesId: policy.seriesId ?? policy.id,
                successorOfPolicyId: policy.successorOfPolicyId ?? null,
              }
            : policy,
        )
      : [],
    ownerEntitlementRecords: Array.isArray(raw.ownerEntitlementRecords)
      ? raw.ownerEntitlementRecords.map(record =>
          isRecord(record)
            ? {
                ...record,
                sourceKeys:
                  Array.isArray(record.sourceKeys) && record.sourceKeys.length > 0
                    ? record.sourceKeys
                    : [`legacy:record:${record.id}`],
                reversalOfId: record.reversalOfId ?? null,
                reversalReason: record.reversalReason ?? null,
              }
            : record,
        )
      : [],
    ownerEntitlementOpeningBalances: Array.isArray(raw.ownerEntitlementOpeningBalances)
      ? raw.ownerEntitlementOpeningBalances.map(balance =>
          isRecord(balance)
            ? {
                ...balance,
                reversalOfId: balance.reversalOfId ?? null,
                reversalReason: balance.reversalReason ?? null,
              }
            : balance,
        )
      : [],
    ownerMovements: Array.isArray(raw.ownerMovements)
      ? raw.ownerMovements.map(movement =>
          isRecord(movement)
            ? {
                ...movement,
                relatedOpeningBalanceId: movement.relatedOpeningBalanceId ?? null,
                openingBalanceDeltaMinor: movement.openingBalanceDeltaMinor ?? 0,
                reversalOfId: movement.reversalOfId ?? null,
                reversalReason: movement.reversalReason ?? null,
              }
            : movement,
        )
      : [],
    allocationPolicies: Array.isArray(raw.allocationPolicies)
      ? raw.allocationPolicies.map(policy =>
          isRecord(policy)
            ? {
                ...policy,
                rateMinorPerWholeUnit:
                  policy.kind === "per_output_unit"
                    ? (policy.rateMinorPerWholeUnit ?? policy.rateMinor ?? null)
                    : null,
                rateMinor: policy.kind === "per_output_unit" ? null : (policy.rateMinor ?? null),
              }
            : policy,
        )
      : [],
    costEstimates: Array.isArray(raw.costEstimates) ? raw.costEstimates : [],
    /* المجموعة ٤ (عقد ٢٩): سجلات الأصول والقروض — غياب = [] بلا اختراع؛
     * حقولها الاختيارية تُطبع بقيم فارغة آمنة (مراجعات/دفعات/تصحيحات). */
    assets: Array.isArray(raw.assets)
      ? raw.assets.map(asset =>
          isRecord(asset)
            ? {
                ...asset,
                categoryLabel: asset.categoryLabel ?? null,
                lifeMonths: asset.lifeMonths ?? null,
                depreciationStartOn: asset.depreciationStartOn ?? null,
                disposal: asset.disposal ?? null,
                writeOff: asset.writeOff ?? null,
                contractRevisions: Array.isArray(asset.contractRevisions) ? asset.contractRevisions : [],
              }
            : asset,
        )
      : [],
    loans: Array.isArray(raw.loans)
      ? raw.loans.map(loan =>
          isRecord(loan)
            ? {
                ...loan,
                purposeNote: loan.purposeNote ?? null,
                sourceWalletId: loan.sourceWalletId ?? null,
                repayments: Array.isArray(loan.repayments)
                  ? loan.repayments.map((repayment: Record<string, unknown>) =>
                      isRecord(repayment)
                        ? { ...repayment, reversal: repayment.reversal ?? null }
                        : repayment,
                    )
                  : [],
                corrections: Array.isArray(loan.corrections) ? loan.corrections : [],
              }
            : loan,
        )
      : [],
  } as unknown as LocalStoreSnapshot;
  return migrated;
}
