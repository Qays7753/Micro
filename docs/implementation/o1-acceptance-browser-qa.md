# O1 acceptance-correction browser QA

**Date:** 26 August 2026

This note records a Chromium smoke pass using synthetic Arabic data only. The browser started with a clean local state and redirected to `/setup`; a profile named `اختبار تصحيح O1` was created solely for this pass.

The route `/finance/owner-entitlement` rendered successfully in RTL with the balance card, independent policy form, dated successor form, entitlement form, opening-balance form, and owner movement form. The initial state was empty and displayed `0.00 JOD`, a clear next action, and no fake historical records.

The corrected policy selector exposed monthly, weekly, daily, hourly, fixed-period, completed-work, profit-share, completed-sale-percentage, and per-unit choices. `fixed_shift` was intentionally absent because the current model has no shift evidence. The successor section displayed a dated effective-start field, source/reason, note, and a disabled action until a policy is selected.

The movement form in draw mode exposed entitlement settlement, opening-balance settlement, pre-entitlement draw, and independent owner draw. After switching to return mode, it exposed opening-balance settlement, prior-draw settlement, and new-capital return. The form showed an explicit source selector for opening settlement and did not leave a source-less settlement option.

Dark mode was toggled successfully; the RTL page remained readable and the data state did not change. The visible numeric inputs used ASCII/LTR presentation. Keyboard and exact button targeting remained possible through native controls; no external account, payment, or personal data was used.

The browser smoke was a visual/interaction check of the local development route, not physical Android/iOS, offline reload, or production Cloudflare acceptance. Synthetic data must be cleared before delivery.

The policy save path was exercised with a synthetic monthly policy of 1,500 minor JOD and a dated source note. The UI displayed the policy as active and showed a known 1,500.00 JOD proposal for the full August calendar period. A successor was then saved with effective date 26/08/2026, an explicit reason, and a note. The UI displayed version 2 as active, version 1 as ended on 25/08/2026, and showed the predecessor relationship; the old policy remained visible and the August period was correctly rejected for the successor because it began after the period start. This confirms no retroactive policy rewrite in the live path.

A native dropdown interaction returned an encoding error from the automation bridge once; the same selection completed through the page's DOM and did not indicate an application failure. The interaction was recorded as an automation limitation, not a product failure.

Final cleanup was executed from the page context. The synthetic IndexedDB database `micro-prototype-local` was deleted, Cache Storage was cleared, localStorage and sessionStorage returned empty, and service-worker registrations were unregistered. No synthetic profile, policy, successor, opening balance, entitlement, or movement remains in the browser state.
