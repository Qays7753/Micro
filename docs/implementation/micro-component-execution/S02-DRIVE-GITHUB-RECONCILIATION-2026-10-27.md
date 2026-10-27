# Micro — S02 Drive/GitHub reconciliation evidence — 2026-10-27

## Scope

This read-only comparison covered the latest Google Drive source copies of UNIT-042 and UNIT-044 against the GitHub copies on `components/integration-20261027` at `a8b640c1e2de3c3d1962d01d1795947b59c87b77`.

Drive is provenance only. ZAI must read GitHub, not Drive.

## Source files and hashes

| Unit | Drive source | Drive SHA-256 | GitHub path | GitHub SHA-256 |
|---|---|---|---|---|
| UNIT-042 | `UNIT-042-drive-latest.md` from Drive file `12n3rAUVoP5UYuWwLXIzsHB_eKGxKz92j` | `cb77139b8f9d49df67a8f9b0f2bbd368aee283033ef646302270ef4ca4abd332` | `docs/implementation/micro-component-execution/02-SPECIFICATIONS/03-New-Design/UNIT-042-قفل-التطبيق.md` | `93044ddd4e10c4bae1c24d216d8a60e16513ba3d681f2a533792cc1e14368eb1` |
| UNIT-044 | `UNIT-044-drive-latest.md` from Drive file `1_F21UOcLHfhuPavcEIWY-yiyqRU2FJ-X` | `0a33cd075b8f737242cdf8a64c749a3e5f5c2bf6246b646af85aa1ca4e5e959e` | `docs/implementation/micro-component-execution/02-SPECIFICATIONS/03-New-Design/UNIT-044-النسخ-الاحتياطي-والاستعادة.md` | `acafbbf3faadc85b7f961a82d350fc12712ec0be37b563eb69bc6cb1a734af80` |

## Result

After normalizing only Markdown link targets, the Drive and GitHub contents are byte-for-byte equal in semantic text for both units. The differences are provenance/local-link representation only:

- Drive copies contain Drive URLs for related sources.
- GitHub copies contain repository-relative links so ZAI can work without Drive access.
- No UNIT-042 or UNIT-044 requirement, acceptance case, financial rule, storage contract, or dependency changed in this comparison.

## Decision

Keep the GitHub copies as the execution source of truth. Do not replace them with raw Drive copies, because that would reintroduce Drive-only links and create a worse execution source for ZAI. The existing Manifest source rows are retained and already record both source and delivery hashes.

## Operational consequence

S02 may proceed from the GitHub copies after the READY prompt is published. The prompt must cite these GitHub paths and must explicitly prohibit Drive access and use of superseded drafts.