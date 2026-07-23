# Dependency Review — GOV-F

Document status: CURRENT
Authority: GOVERNANCE
Applies to: command-center-hub
Reviewed: 2026-07-23 (Asia/Dubai)

## Decision

The `dependencies` and `devDependencies` in `package.json` were reviewed statically. No package is declared safely removable without executing the normalized unused-package check and observing a successful build/test result, which GOV-F is not authorized to run.

| Package group | Decision | Reason |
|---|---|---|
| `react`, `react-dom` | Retain | Runtime application foundation. |
| `lucide-react` | Retain | UI icon dependency recorded by current application source. |
| `zod` | Retain | Runtime validation dependency recorded by current architecture. |
| TypeScript/Vite/React type and plugin packages | Retain | Build and typecheck toolchain. |

No dependency or lockfile was modified. The `supply-chain` job's pinned unused-package check remains the future evidence source. A package may be removed only in a separate PR after the check, source search, build and relevant tests all agree.