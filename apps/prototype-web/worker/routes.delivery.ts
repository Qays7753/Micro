/**
 * Delivery + driver portal route registration (EX-D18 — contract 21/OD01).
 */
import { driverDirectory, driverPublicProfile, ownerOverview, requestDetail } from "./api/delivery.ts";
import {
  answerContactAttempt,
  cancelRequest,
  createRequestDraft,
  decideOutcome,
  decideQuote,
  rateRequest,
  submitRequest,
  toggleSavedDriver,
  withdrawRequest,
} from "./api/deliveryRequest.ts";
import {
  driverAcceptRequest,
  driverDeclineRequest,
  driverDeclare,
  driverRequests,
  driverSubmitQuote,
  submitDailyStatement,
} from "./api/deliveryExecution.ts";
import { decideConsent, proposeConsent, withdrawConsent, recordInstructions } from "./api/deliveryConsent.ts";
import { decideChange, proposeChange, withdrawChange } from "./api/deliveryChange.ts";
import {
  cancelDriverInvitation,
  consumeDriverInvitation,
  createDriverInvitation,
} from "./api/driverInvitations.ts";
import {
  driverPortal,
  saveDriverEvidence,
  saveDriverProfile,
  saveDriverVehicle,
  setAcceptingNew,
  submitDriverApplication,
} from "./api/deliveryDriver.ts";
import {
  confirmStatement,
  deliveryReviewQueue,
  driverStatements,
  ownerStatements,
  reviewDriver,
  reviewEvidence,
  reviewRating,
  reviewVehicle,
} from "./api/deliveryReview.ts";
import { driverStatus } from "./authorization.ts";
import { nowMs } from "./clock.ts";
import { command } from "./commands.ts";
import { errorResponse } from "./http.ts";
import type { ApiRouter } from "./router.ts";
import { authedRoute, moduleGated } from "./routes.ts";

export function registerDeliveryRoutes(router: ApiRouter): void {
  // Owner experience (contract 21).
  router.get("api/delivery/drivers", ctx => driverDirectory(ctx));
  router.get("api/delivery/drivers/:id", ctx => driverPublicProfile(ctx));
  router.get(
    "api/delivery/overview",
    authedRoute((ctx, auth) => ownerOverview(ctx, auth)),
  );
  router.get(
    "api/delivery/requests/:id",
    authedRoute((ctx, auth) => requestDetail(ctx, auth)),
  );
  router.post(
    "api/delivery/requests",
    command(
      "delivery-request-create",
      moduleGated("delivery", (ctx, auth) => createRequestDraft(ctx, auth)),
    ),
  );
  router.post(
    "api/delivery/requests/:id/submit",
    command(
      "delivery-request-submit",
      moduleGated("delivery", (ctx, auth) => submitRequest(ctx, auth)),
    ),
  );
  router.post(
    "api/delivery/requests/:id/withdraw",
    command(
      "delivery-request-withdraw",
      moduleGated("delivery", (ctx, auth) => withdrawRequest(ctx, auth)),
    ),
  );
  router.post(
    "api/delivery/requests/:id/accept-quote",
    command(
      "delivery-quote-accept",
      moduleGated("delivery", (ctx, auth) => decideQuote(ctx, auth, true)),
    ),
  );
  router.post(
    "api/delivery/requests/:id/reject-quote",
    command(
      "delivery-quote-reject",
      moduleGated("delivery", (ctx, auth) => decideQuote(ctx, auth, false)),
    ),
  );
  router.post(
    "api/delivery/requests/:id/cancel",
    command(
      "delivery-request-cancel",
      moduleGated("delivery", (ctx, auth) => cancelRequest(ctx, auth)),
    ),
  );
  router.post(
    "api/delivery/requests/:id/confirm-outcome",
    command(
      "delivery-outcome-confirm",
      moduleGated("delivery", (ctx, auth) => decideOutcome(ctx, auth, true)),
    ),
  );
  router.post(
    "api/delivery/requests/:id/object-outcome",
    command(
      "delivery-outcome-object",
      moduleGated("delivery", (ctx, auth) => decideOutcome(ctx, auth, false)),
    ),
  );
  router.post(
    "api/delivery/requests/:id/contact",
    command(
      "delivery-contact-answer",
      moduleGated("delivery", (ctx, auth) => answerContactAttempt(ctx, auth)),
    ),
  );
  router.post(
    "api/delivery/requests/:id/rate",
    command(
      "delivery-rate",
      moduleGated("delivery", (ctx, auth) => rateRequest(ctx, auth)),
    ),
  );
  router.post(
    "api/delivery/drivers/:id/save",
    command(
      "delivery-driver-save",
      authedRoute((ctx, auth) => toggleSavedDriver(ctx, auth)),
    ),
  );
  router.get(
    "api/delivery/statements",
    authedRoute((ctx, auth) => ownerStatements(ctx, auth)),
  );
  router.post(
    "api/delivery/statements/:id/confirm",
    command(
      "delivery-statement-confirm",
      moduleGated("delivery", (ctx, auth) => confirmStatement(ctx, auth)),
    ),
  );
  // Driver portal (OD01: separately gated context, same Micro identity).
  router.get(
    "api/driver/portal",
    authedRoute((ctx, auth) => driverPortal(ctx, auth)),
  );
  router.post(
    "api/driver/profile",
    command(
      "driver-profile-save",
      moduleGated("delivery", (ctx, auth) => saveDriverProfile(ctx, auth)),
    ),
  );
  router.post(
    "api/driver/vehicle",
    command(
      "driver-vehicle-save",
      moduleGated("delivery", (ctx, auth) => saveDriverVehicle(ctx, auth)),
    ),
  );
  router.post(
    "api/driver/evidence",
    command(
      "driver-evidence-save",
      moduleGated("delivery", (ctx, auth) => saveDriverEvidence(ctx, auth)),
    ),
  );
  router.post(
    "api/driver/submit",
    command(
      "driver-application-submit",
      moduleGated("delivery", (ctx, auth) => submitDriverApplication(ctx, auth)),
    ),
  );
  router.post(
    "api/driver/accepting-new",
    command(
      "driver-accepting-new",
      moduleGated("delivery", (ctx, auth) => setAcceptingNew(ctx, auth)),
    ),
  );
  router.get(
    "api/driver/requests",
    authedRoute((ctx, auth) => driverRequests(ctx, auth)),
  );
  router.post(
    "api/driver/requests/:id/accept",
    command(
      "driver-request-accept",
      moduleGated("delivery", (ctx, auth) => driverAcceptRequest(ctx, auth)),
    ),
  );
  router.post(
    "api/driver/requests/:id/decline",
    command(
      "driver-request-decline",
      moduleGated("delivery", (ctx, auth) => driverDeclineRequest(ctx, auth)),
    ),
  );
  router.post(
    "api/driver/requests/:id/quote",
    command(
      "driver-quote-submit",
      moduleGated("delivery", (ctx, auth) => driverSubmitQuote(ctx, auth)),
    ),
  );
  router.post(
    "api/driver/requests/:id/declare",
    command(
      "driver-declare",
      moduleGated("delivery", (ctx, auth) => driverDeclare(ctx, auth)),
    ),
  );
  // Mutual consent for retry/holding/return (OD10, contract 21 §3.2-3):
  // the driver proposes; the requester explicitly accepts/rejects. Never
  // effective on a single party's declaration; silence changes nothing.
  router.post(
    "api/driver/requests/:id/propose-consent",
    command(
      "driver-propose-consent",
      moduleGated("delivery", (ctx, auth) => proposeConsent(ctx, auth)),
    ),
  );
  router.post(
    "api/driver/requests/:id/propose-consent/withdraw",
    command(
      "driver-withdraw-consent",
      moduleGated("delivery", (ctx, auth) => withdrawConsent(ctx, auth)),
    ),
  );
  router.post(
    "api/delivery/requests/:id/consent/decide",
    command(
      "requester-decide-consent",
      moduleGated("delivery", (ctx, auth) => decideConsent(ctx, auth)),
    ),
  );
  // Requester instructions out of `awaiting_instructions` (contract 21
  // §3.2-3 actor: the project owner — previously driver-declared).
  router.post(
    "api/delivery/requests/:id/instructions",
    command(
      "requester-instructions",
      moduleGated("delivery", (ctx, auth) => recordInstructions(ctx, auth)),
    ),
  );
  // Material change to a confirmed booking (OD11, contract 21 §3.2-2):
  // versioned proposal/acceptance — the agreed terms stay effective until
  // the other party explicitly accepts.
  router.post(
    "api/delivery/requests/:id/change",
    command(
      "party-propose-change",
      moduleGated("delivery", (ctx, auth) => proposeChange(ctx, auth)),
    ),
  );
  router.post(
    "api/delivery/requests/:id/change/decide",
    command(
      "party-decide-change",
      moduleGated("delivery", (ctx, auth) => decideChange(ctx, auth)),
    ),
  );
  router.post(
    "api/delivery/requests/:id/change/withdraw",
    command(
      "party-withdraw-change",
      moduleGated("delivery", (ctx, auth) => withdrawChange(ctx, auth)),
    ),
  );
  router.post(
    "api/driver/statements",
    command(
      "driver-statement-submit",
      moduleGated("delivery", (ctx, auth) => submitDailyStatement(ctx, auth)),
    ),
  );
  router.get(
    "api/driver/statements",
    authedRoute(async (ctx, auth) => {
      const status = await driverStatus(ctx.env.DB, auth.identityId, nowMs());
      if (!status) return errorResponse("not_found", 404);
      return driverStatements(ctx, auth, status.driverProfileId);
    }),
  );
  // Driver application invitations (F-13 — OD22: self-application AND
  // invitation both available; an invitation grants CONTEXT ONLY — it never
  // activates, never skips review, never creates a second account).
  router.post(
    "api/admin/driver-invitations",
    command(
      "driver-invitation-create",
      authedRoute((ctx, auth) => createDriverInvitation(ctx, auth)),
    ),
  );
  router.delete(
    "api/admin/driver-invitations/:code",
    command(
      "driver-invitation-cancel",
      authedRoute((ctx, auth) => cancelDriverInvitation(ctx, auth)),
    ),
  );
  router.post(
    "api/driver/invitation/:code",
    command(
      "driver-invitation-consume",
      authedRoute((ctx, auth) => consumeDriverInvitation(ctx, auth)),
    ),
  );
  // Delivery review (admin).
  router.get(
    "api/delivery/review/queue",
    authedRoute((ctx, auth) => deliveryReviewQueue(ctx, auth)),
  );
  router.post(
    "api/delivery/review/driver/:id",
    command(
      "review-driver",
      authedRoute((ctx, auth) => reviewDriver(ctx, auth)),
    ),
  );
  router.post(
    "api/delivery/review/evidence/:id",
    command(
      "review-evidence",
      authedRoute((ctx, auth) => reviewEvidence(ctx, auth)),
    ),
  );
  router.post(
    "api/delivery/review/vehicle/:id",
    command(
      "review-vehicle",
      authedRoute((ctx, auth) => reviewVehicle(ctx, auth)),
    ),
  );
  router.post(
    "api/delivery/review/rating/:id",
    command(
      "review-rating",
      authedRoute((ctx, auth) => reviewRating(ctx, auth)),
    ),
  );
}
