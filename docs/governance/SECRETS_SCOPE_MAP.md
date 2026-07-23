# Secrets Scope Map

Document status: CURRENT
Authority: GOVERNANCE
Applies to: command-center-hub
Last reviewed: 2026-07-23 (Asia/Dubai)

No secret values are recorded here. Source review found no committed Production secret value. Browser `VITE_*` variables must be public identifiers only and may never contain service-role, database, provider, webhook or deployment credentials.

| Secret class | Allowed location | Capability | Allowed jobs | Status |
|---|---|---|---|---|
| Public Supabase URL/publishable or anon-role key | Local/Preview configuration only | Browser-safe read/auth client capability | Source/Preview only after approval | BLOCKED pending environment verification |
| Staff session token | Runtime session only; never repository secret | User-scoped authorized API access | None in CI | CURRENT runtime concept; not stored in branch |
| Service-role/database credential | `production-write` only | Database write/admin | No active Workflow | BLOCKED |
| AI/provider key | `production-ai-spend` only | Paid generation/provider write | No active Workflow | BLOCKED |
| Storage write credential | Dedicated protected write environment only | Upload/update/delete | No active Workflow | BLOCKED |
| Publishing/webhook token | Dedicated protected publishing environment only | External publication/message | No active Workflow | BLOCKED |
| GitHub token | Ephemeral runner token with minimum permissions | Repository metadata/artifact status | Normalized CI only | GitHub-managed; no value committed |

Read-only environments may not contain write-capable credentials. Secret names, eligibility and actual Environment bindings were not queried or changed.