# المعمارية والـStack

## المبدأ

ابدأ من Problem Statement لا من المستودع الموجود. استخدم Modular Monolith وVertical Slice، وافصل:

```text
UI → Use cases → Domain policies → Ports → Adapters
```

الهدف ليس abstraction للزينة؛ الهدف أن يبقى منطق التكلفة والطلب مستقلًا عن React وSupabase وDexie أو PocketBase.

## الكيانات الأولى

Identity، Workspace، ActivityProfile، Customer، CatalogItem، CostStructure، CostSnapshot، Order، OrderEvent، Collection، Expense، InventoryMovement، Reminder، SyncOperation، Entitlement، AuditEvent.

## خيارات الخلفية

| الخيار | مناسب عندما | الحذر |
|---|---|---|
| Supabase | تريد Auth/Postgres/RLS وخدمة مدارة بسرعة | حدود الخطة والاعتماد والنسخ والسياسة |
| PocketBase | Pilot صغير بخادم واحد وSQLite وحزمة خفيفة | before v1، النسخ والتوسع والأمن علينا |
| Appwrite | تحتاج BaaS أوسع أو self-hosting متكامل | تشغيل أكبر وتكلفة تشغيلية أعلى |
| Cloudflare D1/Workers | تريد قرب الحافة وتكلفة أولية منخفضة | Auth/RLS/domain logic والعمليات علينا |
| self-hosted Postgres | لديك خبرة تشغيل ومراقبة ونسخ | لا تسمِّه صفر تكلفة؛ وقت الحوادث والهجرة تكلفة |

لا تحسم المزود قبل prototype يقيس العزل، المزامنة، الاستعادة، الحجم، والتكلفة. يمكن أن يبدأ MVP بخيار مدارة ويظل domain قابلًا للنقل.

## Local-first

حدد كتابة offline، queue، idempotency، conflict، sync state، export، وrestore قبل اختيار Dexie أو RxDB أو SQLite WASM. Cache ليس local-first كاملًا.

## SaaS boundary

ضع entitlement في adapter/use-case منفصل، ولا تضع `paid` داخل user finance. لا تنفذ Billing أو بوابة دفع في MVP، لكن اختبر حالات trial وactive وgrace وread-only وsuspended وdeletion pending.

## مبدأ عدم التوسع

لا microservices، لا event bus موزع، لا WhatsApp automation، لا multi-branch أو roles كاملة قبل أن يثبت الاستخدام الفردي والعودة والقيمة.
