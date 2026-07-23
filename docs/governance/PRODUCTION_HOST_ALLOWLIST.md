# Production Host Allowlist

Document status: CURRENT
Authority: GOVERNANCE
Applies to: command-center-hub
Last reviewed: 2026-07-23 (Asia/Dubai)

## Policy

Deny by default. This governance branch approves no Production write host and contains no authorization to contact Production.

## Read-only allowlist

No exact Command Center Production hostname has been verified and approved in GOV-F. Therefore the read-only allowlist is empty.

| Host | Scope | Methods | Credentials | Status |
|---|---|---|---|---|
| None | None | None | None | BLOCKED pending exact host ownership and read-only verification |

Preview URLs, Supabase project hosts, AI providers, Storage, publishing providers, webhook endpoints and arbitrary Vercel deployment URLs are not Production-read allowlist entries.

Any future entry requires exact scheme/host, owner, data classification, allowed methods, read-only credential scope, timeout, audit receipt, kill switch and independent approval. Wildcards are prohibited.