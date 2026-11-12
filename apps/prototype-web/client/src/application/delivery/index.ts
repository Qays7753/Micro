/**
 * باب التوصيل (EX-D18 — 2026-11-12): تجربة صاحب المشروع وبوابة السائق —
 * الحجز الموجه والتصريحات والكشوف. توسيع سطحه تعديل مقصود بنفس الـPR
 * (PC-3). لا كتابة تخزين محلي ولا أي أثر مالي من هذا البيت (OD12).
 */

export {
  attachDriverEvidence,
  cancelDeliveryRequest,
  confirmDeliveryOutcome,
  confirmStatement,
  createDeliveryRequest,
  decideDeliveryQuote,
  driverAcceptRequest,
  driverDeclare,
  driverDeclineRequest,
  driverSubmitQuote,
  fetchBookingDetail,
  fetchDriverDirectory,
  fetchDriverPortal,
  fetchDriverRequests,
  fetchOwnerOverview,
  fetchOwnerStatements,
  rateDeliveryBooking,
  upsertDriverProfileDraft,
  upsertDriverVehicleDraft,
  setAcceptingNew,
  submitDeliveryRequest,
  submitDriverApplication,
  toggleSavedDriver,
  uploadDriverEvidence,
  uploadVehicleProof,
} from "./deliveryService";
export type {
  BookingDetail,
  DriverDirectoryEntryDto,
  DriverPortalState,
  DriverRequestSummary,
  OwnerRequestSummary,
} from "./deliveryService";
