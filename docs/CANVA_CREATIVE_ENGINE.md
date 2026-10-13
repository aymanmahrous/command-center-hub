# Canva Creative Engine — Setup and Strategy

## Verified account state (2026-10-13)
- Canva Brand Kit: **coach ayman**.
- Four available Brand Templates were inspected. Each exposed only `hook: text` and `caption: text`; none exposed an image field. Their titles were copies of the same bulk template, so they are not four verified visual variants.
- The saved OAuth token included `design:content:write` but did not include `asset:write`. The current OAuth code requests `asset:write`; reconnecting Canva is required for an existing token to gain the new scope.
- Vercel production for commit `3a2721b01c69862021afc4379cdc2c2cc4d83404` was READY; Supabase Edge Functions are deployed separately.

## One-time setup required
1. Publish distinct Canva Brand Templates for the academy with editable text fields (e.g. `hook`, `caption`) **and at least one image autofill field**.
2. Start with six visually different layouts: premium photographic hero, technique tip, educational carousel, parent FAQ/confidence, free-assessment offer, and vertical Reel/Story cover.
3. Keep the brand palette (navy, turquoise, white, restrained accent), logo and verified contact details consistent, while varying layout, focal point, crop, dominant color and hierarchy.
4. Set `CANVA_BRAND_TEMPLATE_IDS` to a comma-separated list of actual published template IDs in Supabase Edge Function secrets. Do not count duplicate copies as different layouts.
5. Reconnect Canva once from Media Library to refresh OAuth scopes, including `asset:write`.
6. Confirm the app's Canva status check reports the required scopes and an image field before calling the setup complete.

## Creative routing rules
- Canva remains the default when the integration and selected template are truly ready.
- Choose a template by content intent: technique/science → technique layout; parents/fear/progress → FAQ or reassurance; offers → offer layout; Reel/Story → vertical layout; progress stories → testimonial layout only with appropriate consent.
- Reuse approved library media first. Avoid using Coach Ayman's portrait in every post; reserve it for occasional authority content (about once every two weeks).
- Vary photography, water-detail closeups, overhead pool geometry, split compositions, editorial illustration and typographic slides.
- Human approval remains mandatory before publishing. Design creation is not proof of publication.

## Canva API updates reviewed (October 2026)
- **Autofill APIs** are the dependable baseline for Brand Templates with tagged text and image fields.
- **Image generation API (preview, Oct 1)** creates an image asset from a prompt and consumes the user's Canva AI credit allowance. Never call it invisibly or during status checks.
- **Design generation API (preview, Sep 29)** supports Canva Docs and presentations, not social-post presets; it is not a drop-in social poster generator.
- **Image-to-design import (preview, Sep 21)** can convert an image already in Canva into editable layers; capability-check and test before making it a default.
- Video autofill became generally available in September 2026; consider it only after video-field templates exist.
- Resize adapts a finished design to another format but does not create visual diversity by itself.
- Design Editing API and Data Connectors are promising for future layout refinement and connected data, but do not replace the missing image-field setup.

## Official references
- https://www.canva.dev/docs/apps/rest-apis/changelog/
- https://www.canva.dev/docs/apps/rest-apis/autofill-guide/
- https://www.canva.dev/docs/apps/rest-apis/reference/generations/create-image-generation-job/
- https://www.canva.dev/docs/apps/rest-apis/reference/generations/create-design-generation-job/
- https://www.canva.com/newsroom/news/new-apis-data-connectors/

## Verification boundary
Status checks are read-only. They do not generate images, consume Canva AI credits, export a design, or publish to social platforms. Visual variety is only verified after a real design replaces its main image through a template with an image autofill field.
