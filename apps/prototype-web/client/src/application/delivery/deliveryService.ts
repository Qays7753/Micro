/**
 * EX-D18 — خدمات التوصيل للعميل (عقد 21): تجربة صاحب المشروع (الحجز الموجه
 * والتأكيد والكشوف) وبوابة السائق (التقديم والطلبات والتصريحات). تعرض هذه
 * الخدمات ما يعيده الخادم حصرًا ولا تكتب أي تخزين محلي ولا تنشئ حدثًا
 * ماليًا (OD12).
 */

import { apiFetch, newIdempotencyKey } from "@/application/network";

export interface DriverDirectoryEntryDto {
  driverProfileId: string;
  displayName: string;
  governorates: string[];
  acceptingNew: boolean;
  eligibleForNewWork: boolean;
  averageStars: number | null;
  ratingsCount: number;
  /* Wave 3 (Q73/Q93 — القرار النهائي): null = لا مسار مرسل؛ true = يغطي
   * مسارك (يظهر أولًا مع العلامة)؛ false = خارج التغطية — الحجز مسموح
   * والسائق يقرر. */
  coversRoute: boolean | null;
}

/* R1-17 (أمر المالك 2026-11-14): ملخص القرار على بطاقات القوائم —
 * المحافظتان والموعد وحدهما من الملخص الخادمي الآمن؛ التفاصيل خلف
 * الإفصاح في صفحة الحجز. */
export interface BookingSummaryFields {
  route: { pickupGovernorate: string | null; dropoffGovernorate: string | null };
  schedule: { date: string | null; pickupWindow: string | null };
}

export interface OwnerRequestSummary extends BookingSummaryFields {
  id: string;
  status: string;
  pricingMode: string;
  offeredFareMinor: string | null;
  collectionMinor: string | null;
  driverName: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface BookingDetail {
  request: {
    id: string;
    status: string;
    pricingMode: string;
    needType: string;
    /* Wave 3 (Q75/Q100/Q268): خصائص الحمل والنافذة، وعلم وجود حجوزات أخرى
     * متداخلة للسائق (بلا تفاصيل أبدًا)، وحالة موافقة كشف بيانات المستلم. */
    loadClass: string | null;
    weightBand: string | null;
    pieceCount: number | null;
    scheduledStartAt: number | null;
    scheduledEndAt: number | null;
    driverHasOtherBookingsInPeriod: boolean;
    recipientConsentActive: boolean | null;
    offeredFareMinor: string | null;
    collectionMinor: string | null;
    collectionContent: string | null;
    responseDeadlineAt: number | null;
    payload: Record<string, unknown>;
    agreementCopy: Record<string, unknown> | null;
    createdAt: number;
  };
  quote: { id: string; fareMinor: string; scope: string; validUntil: number } | null;
  execution: {
    execution: string;
    confirmation: string;
    contact: string;
    goods: string;
    money: string;
    confirmationRequestedAt: number | null;
  } | null;
  agreementVersion: number;
  consentProposals: {
    id: string;
    kind: "retry" | "holding" | "return";
    terms: Record<string, unknown>;
    status: "pending" | "accepted" | "rejected" | "withdrawn";
    proposedBy: string;
    decidedAt: number | null;
    decisionNote: string | null;
    appliedExecution: string | null;
    createdAt: number;
  }[];
  changeProposals: {
    id: string;
    changes: {
      changes?: Record<string, unknown>;
      note?: string | null;
    } & Record<string, unknown>;
    status: "pending" | "accepted" | "rejected" | "withdrawn";
    proposedBy: string;
    decidedAt: number | null;
    decisionNote: string | null;
    resultingVersion: number | null;
    createdAt: number;
  }[];
  events: { axis: string; type: string; from: string | null; to: string | null; at: number }[];
  requester: { id: string; displayName: string };
  driver: { id: string; profile: Record<string, unknown> };
  viewerRole: "requester" | "driver" | "admin";
}

export interface DriverPortalState {
  driver: {
    status: string;
    reviewReason: string | null;
    profileFields: { displayName?: string; phone?: string; serviceAreas?: string[] } | null;
    eligibleForNewWork: boolean;
    acceptingNew: boolean;
    evidenceValid: boolean;
    vehicleApproved: boolean;
  } | null;
  step: "apply" | "dashboard" | "application";
  evidence: { id: string; category: string; status: string; expiresAt: number | null }[];
  vehicle: { id: string; info: { plate?: string; vehicleType?: string }; status: string } | null;
}

export interface DriverRequestSummary extends BookingSummaryFields {
  id: string;
  status: string;
  pricingMode: string;
  offeredFareMinor: string | null;
  collectionMinor: string | null;
  needType: string;
  updatedAt: number;
}

export async function fetchDriverDirectory(route?: {
  pickupGovernorate: string;
  dropoffGovernorate: string;
}): Promise<{ drivers: DriverDirectoryEntryDto[] }> {
  const query =
    route === undefined
      ? ""
      : `?pickupGovernorate=${encodeURIComponent(route.pickupGovernorate)}&dropoffGovernorate=${encodeURIComponent(route.dropoffGovernorate)}`;
  return apiFetch(`/api/delivery/drivers${query}`);
}

export async function fetchOwnerOverview(): Promise<{
  requests: OwnerRequestSummary[];
  savedDrivers: { driverProfileId: string; profile: Record<string, unknown> }[];
}> {
  return apiFetch("/api/delivery/overview");
}

export async function fetchBookingDetail(id: string): Promise<BookingDetail> {
  return apiFetch(`/api/delivery/requests/${encodeURIComponent(id)}`);
}

export async function createDeliveryRequest(input: {
  driverProfileId: string;
  needType: "deliver_to_customer" | "fetch_ready_goods" | "period_booking";
  pricingMode: "prepriced" | "quote_request";
  offeredFareMinor?: string;
  collectionMinor?: string;
  collectionContent?: "product" | "product_and_fare";
  payload: Record<string, unknown>;
  /** W1 (EX-D24/AUTHZ-05): السياق النشط الصريح — يتحقق منه الخادم. */
  workspaceId: string;
  /* Wave 3 (Q75/Q100/Q268 — القرار النهائي): خصائص الحمل الإلزامية، ونافذة
   * الحجز (إلزامية للحجز بالفترة)، وملاحظات الفترة، وموافقة كشف بيانات
   * المستلم (MD-01 — اختيارية وقابلة للسحب لاحقًا). */
  loadClass?: "small" | "medium" | "large" | "extra_large";
  weightBand?: "under_10kg" | "10_to_50kg" | "over_50kg";
  pieceCount?: number;
  scheduledStartAt?: number;
  scheduledEndAt?: number;
  periodNotes?: string;
  recipientDataConsent?: boolean;
  /** SRV-03 (Post-Group 6 Wave 3): مفتاح ثابت للعملية المنطقية نفسه يُعاد
   * استعماله عند كل إعادة محاولة — لا مفتاح جديد لكل محاولة. */
  idempotencyKey?: string;
}): Promise<{ request: { id: string } }> {
  const { idempotencyKey, ...body } = input;
  return apiFetch(
    "/api/delivery/requests",
    { method: "POST", body: JSON.stringify(body) },
    { idempotencyKey: idempotencyKey ?? newIdempotencyKey() },
  );
}

export async function submitDeliveryRequest(id: string): Promise<void> {
  await apiFetch(
    `/api/delivery/requests/${encodeURIComponent(id)}/submit`,
    { method: "POST", body: "{}" },
    { idempotencyKey: newIdempotencyKey() },
  );
}

export async function decideDeliveryQuote(id: string, accept: boolean): Promise<void> {
  const action = accept ? "accept-quote" : "reject-quote";
  await apiFetch(
    `/api/delivery/requests/${encodeURIComponent(id)}/${action}`,
    { method: "POST", body: "{}" },
    { idempotencyKey: newIdempotencyKey() },
  );
}

export async function confirmDeliveryOutcome(id: string, confirm: boolean): Promise<void> {
  const action = confirm ? "confirm-outcome" : "object-outcome";
  await apiFetch(
    `/api/delivery/requests/${encodeURIComponent(id)}/${action}`,
    { method: "POST", body: "{}" },
    { idempotencyKey: newIdempotencyKey() },
  );
}

export async function cancelDeliveryRequest(id: string): Promise<void> {
  await apiFetch(
    `/api/delivery/requests/${encodeURIComponent(id)}/cancel`,
    { method: "POST", body: "{}" },
    { idempotencyKey: newIdempotencyKey() },
  );
}

export async function rateDeliveryBooking(id: string, stars: number, comment?: string): Promise<void> {
  await apiFetch(
    `/api/delivery/requests/${encodeURIComponent(id)}/rate`,
    { method: "POST", body: JSON.stringify({ stars, comment }) },
    { idempotencyKey: newIdempotencyKey() },
  );
}

/** OD15: the owner's explicit answer to the driver's recorded contact attempt. */
export async function answerContactAttempt(id: string, outcome: "confirmed" | "denied"): Promise<void> {
  await apiFetch(
    `/api/delivery/requests/${encodeURIComponent(id)}/contact`,
    { method: "POST", body: JSON.stringify({ outcome }) },
    { idempotencyKey: `contact-answer:${id}:${outcome}` },
  );
}

export async function toggleSavedDriver(driverProfileId: string): Promise<{ saved: boolean }> {
  return apiFetch(
    `/api/delivery/drivers/${encodeURIComponent(driverProfileId)}/save`,
    { method: "POST", body: "{}" },
    { idempotencyKey: newIdempotencyKey() },
  );
}

export async function fetchOwnerStatements(): Promise<{
  statements: {
    id: string;
    driverName: string;
    date: string;
    totalMinor: string;
    status: string;
    items: { description: string; amountMinor: string }[];
  }[];
}> {
  return apiFetch("/api/delivery/statements");
}

export async function confirmStatement(
  id: string,
  decision: "full" | "difference",
  differenceNote?: string,
): Promise<void> {
  await apiFetch(
    `/api/delivery/statements/${encodeURIComponent(id)}/confirm`,
    { method: "POST", body: JSON.stringify({ decision, differenceNote }) },
    { idempotencyKey: newIdempotencyKey() },
  );
}

/** ---- Driver portal ---- */

export interface DriverStatementSummary {
  id: string;
  date: string;
  items: { requestId: string; description: string; amountMinor: string }[];
  totalMinor: string;
  status: string;
  createdAt: number;
}

export async function fetchDriverStatements(): Promise<{ statements: DriverStatementSummary[] }> {
  return apiFetch("/api/driver/statements");
}

export async function submitDriverStatement(input: {
  requesterIdentityId: string;
  supplementOf?: string;
}): Promise<void> {
  /* MD-04 (Post-Group 6 Wave 3): العناصر والإجمالي يُشتقان خادميًّا من
   * الحجوزات المؤهلة — لا وصف ولا مبلغ من العميل أبدًا. */
  await apiFetch(
    "/api/driver/statements",
    { method: "POST", body: JSON.stringify(input) },
    { idempotencyKey: newIdempotencyKey() },
  );
}

export async function declareCollection(requestId: string, amountMinor: string): Promise<void> {
  await apiFetch(
    `/api/driver/requests/${encodeURIComponent(requestId)}/declare`,
    { method: "POST", body: JSON.stringify({ kind: "collection_declared", amountMinor }) },
    { idempotencyKey: newIdempotencyKey() },
  );
}

/** OD10 (contract 21 §3.2-3): the driver PROPOSES retry/holding/return — the
 * transition only becomes effective when the requester explicitly accepts. */
export async function proposeDeliveryConsent(
  requestId: string,
  kind: "retry" | "holding" | "return",
  terms: Record<string, unknown>,
): Promise<{ proposal: { id: string; kind: string; status: string } }> {
  return apiFetch(`/api/driver/requests/${encodeURIComponent(requestId)}/propose-consent`, {
    method: "POST",
    body: JSON.stringify({ kind, terms }),
  });
}

export async function withdrawDeliveryConsent(requestId: string, proposalId: string): Promise<void> {
  await apiFetch(
    `/api/driver/requests/${encodeURIComponent(requestId)}/propose-consent/withdraw`,
    { method: "POST", body: JSON.stringify({ proposalId }) },
    { idempotencyKey: newIdempotencyKey() },
  );
}

/** The requester's explicit acceptance/rejection of a consent proposal. */
export async function decideDeliveryConsent(
  requestId: string,
  proposalId: string,
  decision: "accept" | "reject",
  note?: string,
): Promise<void> {
  await apiFetch(
    `/api/delivery/requests/${encodeURIComponent(requestId)}/consent/decide`,
    { method: "POST", body: JSON.stringify({ proposalId, decision, note }) },
    { idempotencyKey: newIdempotencyKey() },
  );
}

/** Requester instructions out of `awaiting_instructions` (contract 21 §3.2-3
 * actor: the project owner). */
export async function recordDeliveryInstructions(
  requestId: string,
  instruction: "transit" | "return" | "holding",
  note?: string,
): Promise<void> {
  await apiFetch(
    `/api/delivery/requests/${encodeURIComponent(requestId)}/instructions`,
    { method: "POST", body: JSON.stringify({ instruction, note }) },
    { idempotencyKey: newIdempotencyKey() },
  );
}

/** OD11 (contract 21 §3.2-2): a versioned material-change proposal; the agreed
 * terms stay effective until the other party explicitly accepts. */
export async function proposeDeliveryChange(
  requestId: string,
  changes: Record<string, unknown>,
  note?: string,
): Promise<{ proposal: { id: string; status: string } }> {
  return apiFetch(`/api/delivery/requests/${encodeURIComponent(requestId)}/change`, {
    method: "POST",
    body: JSON.stringify({ changes, note }),
  });
}

export async function decideDeliveryChange(
  requestId: string,
  proposalId: string,
  decision: "accept" | "reject",
  note?: string,
): Promise<void> {
  await apiFetch(
    `/api/delivery/requests/${encodeURIComponent(requestId)}/change/decide`,
    { method: "POST", body: JSON.stringify({ proposalId, decision, note }) },
    { idempotencyKey: newIdempotencyKey() },
  );
}

export async function withdrawDeliveryChange(requestId: string, proposalId: string): Promise<void> {
  await apiFetch(
    `/api/delivery/requests/${encodeURIComponent(requestId)}/change/withdraw`,
    { method: "POST", body: JSON.stringify({ proposalId }) },
    { idempotencyKey: newIdempotencyKey() },
  );
}

export async function driverRequestDetail(id: string): Promise<BookingDetail> {
  return apiFetch(`/api/driver/requests/${encodeURIComponent(id)}`);
}

export async function fetchDriverPortal(): Promise<DriverPortalState> {
  return apiFetch("/api/driver/portal");
}

export async function upsertDriverProfileDraft(input: {
  displayName: string;
  phone: string;
  serviceAreas: string[];
}): Promise<void> {
  await apiFetch(
    "/api/driver/profile",
    { method: "POST", body: JSON.stringify(input) },
    { idempotencyKey: newIdempotencyKey() },
  );
}

export async function upsertDriverVehicleDraft(input: {
  plate: string;
  vehicleType: string;
  ownershipProofMediaId?: string;
}): Promise<void> {
  await apiFetch(
    "/api/driver/vehicle",
    { method: "POST", body: JSON.stringify(input) },
    { idempotencyKey: newIdempotencyKey() },
  );
}

export async function uploadDriverEvidence(file: File): Promise<{ media: { id: string } }> {
  const { apiUpload } = await import("@/application/network");
  return apiUpload("/api/media?purpose=driver_evidence", file, { idempotencyKey: newIdempotencyKey() });
}

export async function uploadVehicleProof(file: File): Promise<{ media: { id: string } }> {
  const { apiUpload } = await import("@/application/network");
  return apiUpload("/api/media?purpose=driver_vehicle_proof", file, { idempotencyKey: newIdempotencyKey() });
}

export async function attachDriverEvidence(input: {
  category: "identity" | "license";
  mediaId: string;
  expiresAt?: number;
}): Promise<void> {
  await apiFetch(
    "/api/driver/evidence",
    { method: "POST", body: JSON.stringify(input) },
    { idempotencyKey: newIdempotencyKey() },
  );
}

export async function submitDriverApplication(): Promise<void> {
  await apiFetch(
    "/api/driver/submit",
    { method: "POST", body: "{}" },
    { idempotencyKey: newIdempotencyKey() },
  );
}

export async function setAcceptingNew(accepting: boolean): Promise<void> {
  await apiFetch(
    "/api/driver/accepting-new",
    { method: "POST", body: JSON.stringify({ accepting }) },
    { idempotencyKey: newIdempotencyKey() },
  );
}

export async function fetchDriverRequests(): Promise<{ requests: DriverRequestSummary[] }> {
  return apiFetch("/api/driver/requests");
}

export async function driverAcceptRequest(id: string): Promise<void> {
  await apiFetch(
    `/api/driver/requests/${encodeURIComponent(id)}/accept`,
    { method: "POST", body: "{}" },
    { idempotencyKey: newIdempotencyKey() },
  );
}

export async function driverDeclineRequest(id: string): Promise<void> {
  await apiFetch(
    `/api/driver/requests/${encodeURIComponent(id)}/decline`,
    { method: "POST", body: "{}" },
    { idempotencyKey: newIdempotencyKey() },
  );
}

export async function driverSubmitQuote(id: string, fareMinor: string, scope: string): Promise<void> {
  await apiFetch(
    `/api/driver/requests/${encodeURIComponent(id)}/quote`,
    { method: "POST", body: JSON.stringify({ fareMinor, scope }) },
    { idempotencyKey: newIdempotencyKey() },
  );
}

export async function driverDeclare(id: string, kind: string, reason?: string): Promise<void> {
  await apiFetch(
    `/api/driver/requests/${encodeURIComponent(id)}/declare`,
    { method: "POST", body: JSON.stringify({ kind, reason }) },
    { idempotencyKey: newIdempotencyKey() },
  );
}

/* ── Post-Group 6 Wave 3 (القرار النهائي د-3/د-4 + MD-01) ── */

/** Q106: إلغاء السائق قبل الاستلام بسبب مكتوب — تنبيه فوري لصاحب الحجز.
 * (مفتاح جديد لكل محاولة: السبب مدخل مستخدم — محاولة مصححة ليست إعادة
 * إرسال للمحاولة نفسها.) */
export async function driverCancelBeforePickup(id: string, reason: string): Promise<void> {
  await apiFetch(
    `/api/driver/requests/${encodeURIComponent(id)}/cancel`,
    { method: "POST", body: JSON.stringify({ reason }) },
    { idempotencyKey: newIdempotencyKey() },
  );
}

/** Q242: «لم يحضر» بعد 30 دقيقة من الموعد بساعة الخادم — ثلاث حالات خلال
 * شهرًا ترفع علم المراجعة اليدوية. */
export async function reportNoShow(id: string): Promise<void> {
  await apiFetch(
    `/api/delivery/requests/${encodeURIComponent(id)}/no-show`,
    { method: "POST", body: "{}" },
    { idempotencyKey: `no-show:${id}` },
  );
}

/** MD-01: سحب موافقة كشف بيانات المستلم — صاحب الحجز وحده، فوري. */
export async function revokeRecipientConsent(id: string): Promise<void> {
  await apiFetch(
    `/api/delivery/requests/${encodeURIComponent(id)}/recipient-consent/revoke`,
    { method: "POST", body: "{}" },
    { idempotencyKey: `recipient-consent-revoke:${id}` },
  );
}
