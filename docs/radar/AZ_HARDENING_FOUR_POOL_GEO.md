# Opportunity RADAR A–Z Hardening — Four-Pool Geo Focus

Status: PRE-PRODUCTION / DRAFT

Owner-approved target:
- Focus operational RADAR priority on the four approved Relax Fix locations only:
  - ICS Al Najda
  - ICS Al Falah
  - ICS Khalifa
  - ICS Al Mushrif
- Desired proximity tiers once exact pool coordinates are independently verified:
  - VERY_CLOSE: <= 500 m
  - NEAR: <= 2 km
  - LOCAL: <= 5 km
  - EXTENDED: <= 8 km
- Outside the four approved local catchments: LOW by default.
- Never fabricate meter distance from text-only area mentions or private/customer GPS data.

## Current hardening decision

The first implementation draft included hard-coded pool coordinates. During verification, at least one public-map source materially disagreed with the provisional Al Falah coordinate and another source materially disagreed with the provisional Mushrif coordinate. Therefore exact-meter geo is deliberately FAIL-CLOSED in the migration chain before Production.

Until all four pool coordinates are independently verified against the owner-approved map locations, the safe production behavior is:
- approved four-pool area text match => AREA_ONLY;
- no approved area match => no pool proximity credit and LOW priority;
- distance_m remains NULL;
- synthetic/test rows remain LOW and are excluded from live feed/reporting.

This preserves the owner’s four-location focus without publishing false precision. The <=500m/2km/5km/8km tiers remain the approved target and can be activated later by a small follow-up migration once the coordinate registry is verified.

## Additional A–Z hardening in this branch

- Permanent fingerprint dedupe invariant aligned with the existing unique fingerprint index.
- Synthetic/test evidence preserved but flagged `is_test` and excluded from live staff feed and source performance.
- Test rows fail closed to LOW priority.
- Redundant `radar_hot_opportunity` job creation removed from new ingestion; Attention Center / Push already read HOT rows directly.
- Status audit records both `oldStatus` and `newStatus`.
- Pool performance RPC added for total / HOT / qualified / booking requests / booked / paid customers / conversion by approved pool.
- No automatic outreach.
- No paid service.
- No n8n workflow change.
- No Production migration executed from this branch yet.
