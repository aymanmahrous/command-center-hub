# Coach Brain research provider adapter

The product should keep the research provider behind an adapter so the UI does not depend on one vendor.

### Input

- anonymized research terms from `buildCoachResearchBrief`
- optional evidence-domain filters
- optional date window

### Output

Every returned evidence item should include:

- title
- URL
- publisher/journal
- publication date
- evidence type
- population/topic
- concise finding
- limitations
- retrieval timestamp

### Guardrails

- Never send direct child identifiers for generic research.
- Do not auto-save retrieved text as trusted knowledge.
- Do not auto-publish research results.
- High-risk and rehabilitation guidance must retain the safety/referral gate.
- Log provider failures without exposing secrets to the client.
