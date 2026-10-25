# Source and design review

Reviewed repository inventory, public exports and tests across core, policy, scanners and MCP; traced preflight → scanning/rules → analysis → decision; inspected docs, schemas, examples, eval cases, website markup, styling and interactions. This is product/claim validation for a launch film, not a complete security audit.

Verified: local deterministic engine, four decisions, six risk factors, five MCP tools, six skills, explicit file scanning, redacted output. Brand assets: web/assets/logo.png, ABC Diatype, Geist Mono, orange #e53d00, deep red #3a0303, warm white.

Validation this run: 179/179 tests across 16 files; build passes; 15/15 eval cases pass (including MCP handlers and server tests).

Material discrepancy: some website demo copy says “Redacted ... in place”, “stripped untrusted prompt injection” and implies workflow execution. The engine returns findings and recommendations; it does not mutate payloads or enforce OS/tool execution. The film uses the real interactive inspector/API output and avoids those claims. Source files were not changed.

Live captures: home.png, preflight.png, verdict.png, compare.png from http://127.0.0.1:4173. API responses preserved under review/. Product proof uses a preflight check only; no force push or other side effect was performed.

Scope of new work: launch-video/ only (composition hosts, scene HTML, local assets, review notes, delivered MP4). No product API, exports, tests, fixtures or configuration needs changing.

Additional repository checks: `pnpm typecheck` and `pnpm exec eslint packages web evals examples` both completed successfully. This excludes generated video/vendor assets and any unrelated work occurring in other launch folders.
