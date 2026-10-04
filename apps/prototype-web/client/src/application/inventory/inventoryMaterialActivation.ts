/* Wave F شريحة ٣ (ADR-014 — تقسيم مسؤولية داخلي، 2026-10-04): عائلة تفعيل
 * المخزون (القرار ٩) — قراءة التفعيل (المعلن صراحة أولًا ثم أقدم دليل
 * للموجود القائم) والتفعيل الصريح المؤرّخ — انتقلت حرفيًا إلى هذا البيت
 * الشقيق؛ الخدمة تفوّض هنا. لحظة معلنة تُعرض، والرصيد يومها يكفي. */
import { localDateInAmman } from "@micro-domain/shared/index.js";
import {
  localInventoryActivationId,
  type InventoryActivation,
  type PrototypeLocalStore,
} from "@/storage/local/types";
import { storageFailure } from "@/application/resultCodes";

/* تكثيف STR-608: الرسالة تتكرر في المسارين — تعريف واحد لا اثنان. */
const ACTIVATION_READ_FAILED_MESSAGE = "تعذر قراءة حالة تفعيل المخزون.";
import type { Clock } from "@/application/time/clock";
import {
  ammanLocalDate,
  writeStorageFailure,
  type InventoryActivationInput,
  type InventoryActivationState,
  type InventoryResult,
} from "./inventoryMaterialModel";

/* القرار ٩: قراءة تفعيل المخزون — المعلن صراحة أولًا، ثم أقدم دليل للموجود القائم. */
export async function readActivation(
  store: PrototypeLocalStore,
): Promise<InventoryResult<InventoryActivationState>> {
  const [activation, materials, movements] = await Promise.all([
    store.getInventoryActivation(),
    store.listMaterials(),
    store.listInventoryMovements(),
  ]);
  if (!activation.ok || !materials.ok || !movements.ok) return storageFailure(ACTIVATION_READ_FAILED_MESSAGE);
  if (activation.value)
    return {
      ok: true,
      value: {
        activatedOn: activation.value.activatedOn,
        source: "declared",
      },
    };
  const evidenceDates = [
    ...movements.value.map(movement => movement.occurredOn),
    ...materials.value.map(material => localDateInAmman(material.createdAt)),
  ].filter(date => date);
  if (evidenceDates.length === 0)
    return {
      ok: true,
      value: {
        activatedOn: null,
        source: null,
      },
    };
  const earliest = evidenceDates.sort()[0]!;
  return {
    ok: true,
    value: {
      activatedOn: earliest,
      source: "derived",
    },
  };
}

/** القرار ٩: تفعيل صريح بتاريخ اليوم — لحظة معلنة تُعرض، والرصيد يومها يكفي. */
export async function activateInventory(
  store: PrototypeLocalStore,
  now: Clock,
  input: InventoryActivationInput,
): Promise<InventoryResult<InventoryActivation>> {
  const current = await store.getInventoryActivation();
  if (!current.ok) return storageFailure(ACTIVATION_READ_FAILED_MESSAGE);
  if (current.value) return { ok: true, value: current.value, reused: true };
  const activation: InventoryActivation = {
    id: localInventoryActivationId,
    activatedOn: ammanLocalDate(now()),
    recordedAt: now(),
    operationKey: input.operationKey,
  };
  const saved = await store.saveInventoryActivation(activation);
  return saved.ok ? { ok: true, value: saved.value } : writeStorageFailure();
}
