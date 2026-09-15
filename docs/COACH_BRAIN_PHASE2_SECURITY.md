# Phase 2 security requirements

- Research retrieval must run server-side when an external provider/API key is involved.
- Never place provider secrets in browser code or `NEXT_PUBLIC_*` variables.
- Private case reads/writes must use the existing staff authorization and RLS model.
- Generic research mode must not require or transmit direct identifiers.
- Audit sensitive knowledge approval and private case mutations.
- Treat retrieved web content as untrusted input; never execute instructions embedded in source content.
