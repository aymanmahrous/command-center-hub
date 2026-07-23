# Post-Governance Roadmap

Document status: CURRENT
Authority: GOVERNANCE ROADMAP
Applies to: command-center-hub
Last verified: 2026-07-23 (Asia/Dubai)

## After governance

1. Keep `PHASE-3-SAFE-EXECUTION` blocked until a separate explicit order names one exact operation and target SHA.
2. Verify named owners, independent approvers and repository access.
3. Observe successful stable CI contexts on the exact SHA under a separately authorized run.
4. Verify the intended read-only Environment contains no write-capable secret.
5. Complete `PHASE_3_ACTIVATION_GATE.md` and issue a time-bounded GO or NO-GO receipt.
6. Start only the approved operation; stop at expiry or any gate violation.
7. Record the audit receipt and return to fail-closed state.

## First possible operation

The first candidate should be source-only verification. A manual `preview-readonly` response check may follow only when its exact URL and SHA are approved. Neither starts automatically.

## Remains frozen

- PR #8 and CRM mutation implementation;
- database migrations and Production writes;
- AI/provider calls and spend;
- Storage writes;
- publishing, scheduling, messaging and webhooks;
- repository settings, secret changes and PR lifecycle actions without separate authority.

## Separate decisions required

- authorization to run any CI, test, build or Preview check;
- activation of Rulesets, required checks, CODEOWNERS or Environments;
- a new isolated CRM Feature PR from then-current `main`;
- any database-only Migration PR and disposable test;
- any AI model/token/cost approval;
- any Production-readonly verification;
- all Production-write, Storage, publishing or messaging work.

No roadmap entry is executable merely because it is documented.