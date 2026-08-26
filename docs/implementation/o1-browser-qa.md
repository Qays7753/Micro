# O1 browser smoke QA

Date: 2026-08-26.

The local Prototype started on Vite port 3000 and rendered the Arabic RTL application. The fresh-profile flow opened the local setup route, accepted a sample project name, and reached the orders route. The direct `/finance/owner-entitlement` route then rendered successfully with the Finance back link, the owner balance card, dated policy form, entitlement calculation form, opening-balance form, wallet movement form, and empty immutable ledger state. The viewport reported 3,043 pixels below the fold, confirming the mobile-first surface is scrollable rather than clipped.

The empty state correctly displayed `0.00 JOD`, stated that entitlement does not equal cash or operating profit, and presented no wallet option before a wallet exists. No runtime error or blank component appeared during this smoke test. The initial `/finance` navigation on port 5173 was unavailable because Vite selected port 3000; the correct port was then exposed and passed the smoke test.

A sample zero-balance wallet was created through the existing cash route. The cash list then showed one wallet named `صندوق الاختبار` with zero balance and zero saved effects. The existing floating add action sheet can overlay the lower edge on that route; it was closed during the test and did not prevent navigation or saving.

On the live O1 route, a monthly policy was entered with `1500.00` JOD minor, source, and note. The save action persisted it, updated the policy count to 1, displayed the dated policy card, and made the entitlement preview available at `1,500.00 JOD` for 2026-08-01 through 2026-08-31. The page still showed no cash movement, and the saved wallet appeared in the wallet selector.

The live entitlement record was then saved from the preview. The page displayed `تم تسجيل الاستحقاق. لم يتغير كاش المشروع.`, changed the owner balance to `1,500.00 JOD`, and displayed the entitlement in the ledger while the wallet selector remained at zero balance. This confirms the UI preserves the core separation between an accrued right and an actual wallet movement.

The live movement form then selected that entitlement and `صندوق الاختبار`, entered a 500-minor draw, and saved it. The page confirmed `تم تسجيل الحركة وأثرها على محفظة الكاش.`, reduced the owner balance to `1,000.00 JOD`, showed the wallet at `-500.00 JOD`, and displayed the draw in the ledger with its `عكس كامل` action. This is expected for a zero-balance sample wallet and confirms the wallet effect is explicit rather than hidden.

Cleanup verification: IndexedDB databases, Cache Storage, localStorage, sessionStorage, and service-worker registrations were all empty/zero after the QA data was cleared. No synthetic browser test data remains in the session.
