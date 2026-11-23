# SUPERSEDED — D1 migration history (EX-D20, 2026-11-14)

These five D1 migrations are **labelled history only** — they are no longer
applied by any test or build path. The active ordered schema is the
PostgreSQL target: `../migrations-pg/0001_init.sql` (one PostgreSQL target via
Cloudflare Hyperdrive; owner decision EX-D20, 2026-11-13). The PG file's
header documents the table-by-table lineage from these files.

Do not delete or edit these files (repository history is preserved); do not
apply them to any live resource. No live D1 database is read or mutated by
this repository — any later inspection of an existing D1 resource is an
explicit owner/Manus read-only step.
