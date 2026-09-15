# Coach Brain Phase 2

Phase 2 extends the existing safety-first Coach Brain into a research-aware adaptive coaching workspace.

## User flow

- Choose **Generic research** or **Private swimmer case**.
- Generic research requires no name and should be the default.
- Enter the observed issue and desired skill/goal in plain language.
- Coach Brain creates an anonymized research brief.
- Evidence retrieval ranks trusted sources and records provenance.
- Safety gate runs before practical guidance.
- Results show evidence, practical options, limitations and referral/stop conditions.
- Coach may save a private coaching case only when appropriate permissions are present.

## Evidence record

Each imported source should retain:

- title
- publisher/journal/organization
- publication date
- source URL
- evidence type
- population
- intervention/topic
- key finding
- limitations
- retrieval date
- review status

## Knowledge domains

- Adaptive swimming
- Autism and water safety
- Disability swimming instruction
- Motor learning
- Breathing and skill acquisition
- Visual schedules / prompting / modeling
- Water confidence and gradual skill progression
- Aquatic rehabilitation references for professional referral
- General water safety

## Security

Private swimmer data must never be inserted into public SEO pages, public search indexes, or generic research URLs. RLS and existing staff authorization patterns remain the source of truth for private records.

## Cost and reliability

Research retrieval should be on-demand, not polling. Cache reviewed evidence records where appropriate. Do not trigger external publishing, messaging, or automation from a research query.
