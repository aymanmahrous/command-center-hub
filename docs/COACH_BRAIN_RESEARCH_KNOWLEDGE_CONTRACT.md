# Coach Brain — Research & Knowledge Contract

## Purpose
Coach Brain supports swimming-coach decisions for generic or anonymized cases. A coach may search a problem without entering a child's name or identifying information.

Example input:

> Child with autism, cries when water reaches the face, goal is to learn blowing bubbles in water. What evidence-informed teaching approaches and drills can I try?

The system must convert the request into a structured research brief, retrieve relevant trusted evidence, and return practical coaching options with safety boundaries.

## Search pipeline

1. **Anonymize first** — names, phone numbers, email addresses, exact addresses and other unnecessary identifiers are not part of the research query.
2. **Structure the case** — age band (optional), skill/goal, observed difficulty, learning considerations, and safety notes.
3. **Generate focused searches** — adaptive swimming, autism/water safety, motor learning, behavioral teaching strategies, breathing instruction, and the specific skill goal as appropriate.
4. **Prioritize evidence** — systematic reviews/meta-analyses, controlled trials, professional guidance, then high-quality primary studies. General web pages are supporting material, not the primary evidence layer.
5. **Extract limitations** — sample size, population, intervention details, retention/generalization, and certainty/quality where reported.
6. **Translate evidence into coaching options** — practical drills, cues, progression criteria and stop/adjust conditions. Never turn evidence into a diagnosis or medical prescription.
7. **Apply safety gate** — TRAIN / ADAPT / REFER / STOP runs before recommendations are shown.
8. **Show provenance** — every evidence-backed recommendation must have source, publication date, evidence type/level, and a concise limitation.
9. **Human review for sensitive knowledge** — research can be collected automatically, but high-impact safety or rehabilitation guidance is not promoted into the trusted knowledge base without human review.

## Example: generic bubble-blowing request

For a case such as “child with autism + crying at face immersion + goal: blowing bubbles”, Coach Brain should investigate combinations of:

- swimming and water-safety instruction for autistic children;
- behavioral skills training components such as instruction, modeling, rehearsal and feedback;
- visual schedules, prompting and predictable routines where supported by evidence;
- gradual skill decomposition and low-pressure water familiarization;
- breathing/bubble skill instruction in swimming;
- generalization and maintenance of learned water skills.

The result should not claim that one drill is universally best. It should present an evidence-informed progression and explain that the coach should observe the swimmer's response and adjust.

## Private vs public data

- **Research queries are generic by default.** A child name is not required.
- **Private case records** remain staff-only and must not be indexed by public search engines.
- **Public SEO content** may explain adaptive swimming, water safety, and educational topics, but must never expose private swimmer notes or case histories.

## Scope boundary

Coach Brain is a coaching-support system, not a medical diagnostic or treatment system. It must not:

- diagnose autism, ADHD, neurological conditions or other disorders;
- infer a diagnosis from behavior;
- prescribe clinical physiotherapy or medical treatment;
- declare a swimmer medically cleared for activity;
- present clinical rehabilitation as ordinary swim coaching.

When a case contains a safety concern or clinical rehabilitation need, the appropriate action is to stop or refer according to the safety gate and documented professional guidance.
