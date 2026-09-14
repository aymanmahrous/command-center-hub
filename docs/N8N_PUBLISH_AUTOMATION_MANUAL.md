# n8n Publish Workflow — Manual Step (Required)

Workflow ID: `xNwYPSXQiUyzDSyZ`  
Do **not** create a new workflow.

## One manual change in n8n UI

1. Open workflow `xNwYPSXQiUyzDSyZ`.
2. Add **Schedule Trigger** at the start: every **10 minutes**.
3. Keep the existing **Manual Trigger** connected (do not remove it).
4. Connect Schedule Trigger into the **same first processing node** the manual path uses today.
5. Ensure the workflow still calls these Supabase RPCs (service role) in order for due items:
   - `discover_due_authorized_facebook_publish_candidate` / `discover_due_authorized_instagram_publish_candidate`
   - `authorize_next_due_scheduled_facebook_publish` / `authorize_next_due_scheduled_instagram_publish` (when auth missing at due time)
   - `claim_authorized_publish_job` / `claim_authorized_instagram_publish_job`
   - `reserve_authorized_*_publication_receipt`
   - Meta publish nodes (Facebook / Instagram only)
   - `mark_authorized_publication_published` / `mark_authorized_instagram_publication_published`
6. Save workflow **Active**.

## Safety checks after enabling

- Run once manually with **no due items** → should exit without publishing.
- Approve All one FB/IG item in Hub → wait until `scheduled_for` → confirm one receipt only.
- Re-run schedule while receipt is `published` → must **not** duplicate post (`ALREADY_PUBLISHED` / `PUBLISH_RECEIPT_EXISTS`).

## What Hub already does (no n8n change needed)

Approve All sets `scheduled_for = planned_for` and creates one `publish_content` job per FB/IG item (`source: batch_approve_scheduled`).

## What stays manual outside Cursor

Only the Schedule Trigger addition above. No new workflow, no new Supabase cron.
