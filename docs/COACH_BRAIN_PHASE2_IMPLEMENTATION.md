# Phase 2 implementation sequence

1. Keep the existing Coach Brain safety UI as the front door.
2. Add a Generic Research mode so no child identity is needed.
3. Generate anonymized research briefs with the deterministic builder.
4. Connect a server-side evidence provider adapter.
5. Normalize results into evidence records with provenance and limitations.
6. Run safety classification before showing practical guidance.
7. Add staff-only save-to-case using existing authorization/RLS patterns.
8. Add reviewed knowledge storage only after human approval.
9. Keep public SEO content isolated from private records.
10. Verify typecheck, tests, production build and performance budget before merge.
