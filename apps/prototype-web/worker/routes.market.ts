/**
 * Market route registration (EX-D18 — contract 20).
 */
import {
  browseListings,
  checkQuantity,
  listingDetail,
  marketMeta,
  saveVendorProfile,
  submitVendorProfile,
  vendorOverview,
} from "./api/market.ts";
import {
  attachListingMedia,
  confirmAvailability,
  createListingDraft,
  directUpdateListing,
  getVendorListingDraft,
  reportListing,
  submitListing,
  toggleSavedListing,
  updateListingDraft,
  vendorListingLifecycle,
} from "./api/marketListings.ts";
import { resolveReport, reviewListing, reviewMedia, reviewProfile, reviewQueue } from "./api/marketReview.ts";
import { runDueRemindersNow } from "./api/reminders.ts";
import { command } from "./commands.ts";
import { authedRoute } from "./routes.ts";
import type { ApiRouter } from "./router.ts";

export function registerMarketRoutes(router: ApiRouter): void {
  router.get("api/market/listings", ctx => browseListings(ctx));
  router.get("api/market/listings/:id", ctx => listingDetail(ctx));
  router.get("api/market/meta", ctx => marketMeta(ctx));
  router.post(
    "api/market/quantity-check",
    command("market-quantity-check", ctx => checkQuantity(ctx)),
  );
  router.get(
    "api/market/vendor/overview",
    authedRoute((ctx, auth) => vendorOverview(ctx, auth)),
  );
  router.post(
    "api/market/vendor/profile",
    command(
      "vendor-profile-save",
      authedRoute((ctx, auth) => saveVendorProfile(ctx, auth)),
    ),
  );
  router.post(
    "api/market/vendor/profile/submit",
    command(
      "vendor-profile-submit",
      authedRoute((ctx, auth) => submitVendorProfile(ctx, auth)),
    ),
  );
  router.post(
    "api/market/vendor/listings",
    command(
      "listing-create",
      authedRoute((ctx, auth) => createListingDraft(ctx, auth)),
    ),
  );
  router.get(
    "api/market/vendor/listings/:id",
    authedRoute((ctx, auth) => getVendorListingDraft(ctx, auth)),
  );
  router.post(
    "api/market/vendor/listings/:id",
    command(
      "listing-update",
      authedRoute((ctx, auth) => updateListingDraft(ctx, auth)),
    ),
  );
  router.post(
    "api/market/vendor/listings/:id/submit",
    command(
      "listing-submit",
      authedRoute((ctx, auth) => submitListing(ctx, auth)),
    ),
  );
  router.post(
    "api/market/vendor/listings/:id/confirm-availability",
    command(
      "listing-confirm-availability",
      authedRoute((ctx, auth) => confirmAvailability(ctx, auth)),
    ),
  );
  router.post(
    "api/market/vendor/listings/:id/direct-update",
    command(
      "listing-direct-update",
      authedRoute((ctx, auth) => directUpdateListing(ctx, auth)),
    ),
  );
  router.post(
    "api/market/vendor/listings/:id/pause",
    command(
      "listing-pause",
      authedRoute((ctx, auth) => vendorListingLifecycle(ctx, auth, "pause")),
    ),
  );
  router.post(
    "api/market/vendor/listings/:id/resume",
    command(
      "listing-resume",
      authedRoute((ctx, auth) => vendorListingLifecycle(ctx, auth, "resume")),
    ),
  );
  router.post(
    "api/market/vendor/listings/:id/archive",
    command(
      "listing-archive",
      authedRoute((ctx, auth) => vendorListingLifecycle(ctx, auth, "archive")),
    ),
  );
  router.post(
    "api/market/vendor/listings/:id/media",
    command(
      "listing-attach-media",
      authedRoute((ctx, auth) => attachListingMedia(ctx, auth)),
    ),
  );
  router.post(
    "api/market/saved/:listingId",
    command(
      "market-save-toggle",
      authedRoute((ctx, auth) => toggleSavedListing(ctx, auth)),
    ),
  );
  router.post(
    "api/market/report",
    command(
      "market-report",
      authedRoute((ctx, auth) => reportListing(ctx, auth)),
    ),
  );
  router.get(
    "api/market/review/queue",
    authedRoute((ctx, auth) => reviewQueue(ctx, auth)),
  );
  router.post(
    "api/market/review/profile/:id",
    command(
      "review-profile",
      authedRoute((ctx, auth) => reviewProfile(ctx, auth)),
    ),
  );
  router.post(
    "api/market/review/listing/:id",
    command(
      "review-listing",
      authedRoute((ctx, auth) => reviewListing(ctx, auth)),
    ),
  );
  router.post(
    "api/market/review/media/:mediaId",
    command(
      "review-media",
      authedRoute((ctx, auth) => reviewMedia(ctx, auth)),
    ),
  );
  // Report follow-up decisions (F-12 — contract 22 §2 closed set);
  // recorded administrative decisions, never an auto-mutation of the object.
  router.post(
    "api/market/review/report/:id",
    command(
      "review-report",
      authedRoute((ctx, auth) => resolveReport(ctx, auth)),
    ),
  );
  // In-app reminders due-processing (contract 19 §9): admin-only manual run —
  // the same idempotent processor as the worker `scheduled` export.
  router.post(
    "api/admin/reminders/due",
    command(
      "admin-reminders-due",
      authedRoute((ctx, auth) => runDueRemindersNow(ctx, auth)),
    ),
  );
}
