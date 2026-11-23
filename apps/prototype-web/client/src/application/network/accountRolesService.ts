/**
 * Post-Group 6 continuous completion (WS-251/DOC-041 — owner order 7593b9c4
 * §4 G01): دورة الأدوار من «حسابي» — إلغاء المسودة الفوري وإزالة الدور
 * المفعّل بطلبه، كما نصت القرارات النهائية 2026-11-21 (ب — دورة الدور
 * Q5). قراءة الحالة من الجلسة نفسها (محسوبة خادميًا)؛ الأفعال أوامر
 * خادمية موثقة فقط — لا كتابة محلية إطلاقًا.
 */

import { apiFetch } from "./apiClient";

/** نتيجة إلغاء المسودة — صفوف مسودة فقط، لم تكن عامة يومًا. */
export interface RoleDraftCancelled {
  ok: boolean;
  cancelled: "supplier_draft" | "driver_draft";
}

/** نتيجة إزالة الدور — السجلات كلها محفوظة؛ الإعلانات مؤرشفة للورد. */
export interface RoleRemoved {
  ok: boolean;
  removed: "supplier" | "driver";
}

export async function cancelSupplierDraft(): Promise<RoleDraftCancelled> {
  return apiFetch<RoleDraftCancelled>("/api/account/roles/supplier/cancel-draft", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function cancelDriverDraft(): Promise<RoleDraftCancelled> {
  return apiFetch<RoleDraftCancelled>("/api/account/roles/driver/cancel-draft", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function removeSupplierRole(): Promise<RoleRemoved> {
  return apiFetch<RoleRemoved>("/api/account/roles/supplier/remove", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function removeDriverRole(): Promise<RoleRemoved> {
  return apiFetch<RoleRemoved>("/api/account/roles/driver/remove", {
    method: "POST",
    body: JSON.stringify({}),
  });
}
