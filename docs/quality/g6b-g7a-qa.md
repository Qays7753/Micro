# QA evidence: G6-B → G7-A

**Date:** 24 August 2026
**Environment:** local Vite prototype, narrow phone viewport, Arabic RTL, local IndexedDB only
**Branch:** `g6b-g7a/recurrence-and-followup`
**Draft PR:** [#60](https://github.com/Qays7753/Micro/pull/60)

## Scope and evidence

The G6-B surface was verified through the existing `/schedule` route and its Application service tests. Weekly and monthly templates are bounded to 1–12 appearances, idempotent on repeated execution, preserve unknown timing, surface conflicts and capacity as warnings, and cancel future generation with a written reason without deleting prior appearances. No reminder, cron, booking, external calendar, resource allocation, or financial effect was introduced.

The G7-A scenario used a synthetic local project named `G7-A QA` and a synthetic order named `صندوق متابعة G7-A`. The existing client-order, cost, and agreement flow remained available. Agreement creation accepted `WhatsApp` as a bounded optional source. Order detail displayed **ذاكرة الاتفاق** with source, owner-written summary, local follow-up date, required reason, due/upcoming wording, local-only boundary copy, and follow-up history.

Saving `تأكيد اللون مع العميل` with follow-up date `2026-08-25` and reason `تأكيد العينة` displayed success and `متابعة قادمة`. The agreement source remained `WhatsApp`. The financial cards and delivery date remained unchanged. Changing the existing follow-up date to `2026-08-26` without a reason was rejected and the previous date/history remained intact. Repeating the change with reason `العميل طلب تأجيل المتابعة` succeeded and added a `تغيير موعد المتابعة` history row while preserving the source, agreement value, remaining amount, and delivery date.

The Application and transfer tests cover every allowed new source, explicit unspecified source, invalid source rejection, valid and invalid local dates, due/upcoming classification, context round-trip, G6-B recurrence round-trip, legacy migration, IndexedDB schema-20 defaults, and no schedule creation or financial mutation from G7-A context writes.

## Responsive and state checks

The narrow phone view kept the context form, history, warning copy, and fixed BottomNav within the page surface. Dark mode was enabled and retained readable labels, saved context, follow-up history, and local-only boundary text. The existing loading, error, empty, and success conventions remain in use; no silent success or invented zero values were added.

## Cleanup

After verification, the isolated browser IndexedDB database was deleted. Reloading `/schedule` returned the prototype to the initial setup screen, confirming that no synthetic order, agreement context, follow-up date, or history event remained.

## Checks

`pnpm check` passed. The final run completed the workspace typecheck, domain tests, prototype typecheck, all 22 prototype test files with 104 tests passing, and the production Vite/PWA build. The build emitted the repository’s existing analytics placeholder warnings for unset `VITE_ANALYTICS_ENDPOINT` and `VITE_ANALYTICS_WEBSITE_ID`; these did not fail the build.
