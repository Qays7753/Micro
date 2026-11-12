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
  declareCollection,
  decideDeliveryQuote,
  driverAcceptRequest,
  driverDeclare,
  driverDeclineRequest,
  driverRequestDetail,
  driverSubmitQuote,
  fetchBookingDetail,
  fetchDriverDirectory,
  fetchDriverPortal,
  fetchDriverRequests,
  fetchDriverStatements,
  fetchOwnerOverview,
  fetchOwnerStatements,
  rateDeliveryBooking,
  submitDriverStatement,
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
  DriverStatementSummary,
  OwnerRequestSummary,
} from "./deliveryService";
