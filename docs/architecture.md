# Architecture

Kapibara is a pnpm workspace with four packages and a deliberately acyclic
dependency graph.

```text
packages/
├── policy/     rules, topics, profiles, precedence
├── scanners/   secret patterns, redaction, file scans, prompt injection
├── core/       classification, risk, decisions, config, audit, formatting
└── mcp/        MCP server, tool handlers, stdio CLI
```

## Dependencies

```text
@kapibara/mcp
  ├── @kapibara/core
  ├── @kapibara/policy
  └── @kapibara/scanners

@kapibara/core
  ├── @kapibara/policy
  └── @kapibara/scanners

@kapibara/policy   (no internal dependencies)
@kapibara/scanners (no internal dependencies)
```

`core` orchestrates; `policy` and `scanners` stay independent so they can be
tested and reused on their own.

## Request flow

### MCP call

```text
client
  │  tools/call
  ▼
McpServer (server.ts)
  │  Zod input validation
  ▼
handler (handlers.ts)
  │  load config + rules (context.ts)
  ▼
core preflight / analyze / compare
  │
  ├─ policy.evaluateRules
  ├─ scanners.scanSensitiveText / scanSensitiveFile
  └─ core.decide
  ▼
ToolResponse { summary, data }
  │
  ▼
CallToolResult { content, structuredContent }
```

Handlers catch expected failures and convert them to `ToolResponse` objects.
The server converts a response to `CallToolResult`; failures set `isError` and
omit structured content.

### Preflight

```text
preflight(input, options)
  ├─ validate input
  ├─ classifyAction
  ├─ scan metadata.content
  ├─ scan explicit files
  ├─ scan outbound target (optional)
  ├─ evaluateRules
  ├─ analyze
  │    ├─ baseIssues + targetIssues + ruleIssues
  │    ├─ computeFactors
  │    ├─ scoreFactors
  │    ├─ applyScoreFloors
  │    ├─ decide
  │    └─ buildRecommendation
  └─ PreflightResult
```

`preflight` is pure with respect to the workspace: it reads only the files named
in `options.scanFiles`, the outbound `target` when enabled, and the rules/config
loaded by the caller. It never writes.

## Package responsibilities

### `@kapibara/policy`

- parse markdown rule files
- infer topics from rule text and input
- load project, global, and profile rules
- merge definitions and detect conflicts
- evaluate matches, precedence, overridable blocks, and conflicts

Key files:

- `parser.ts`: markdown → normalized rules
- `topics.ts`: topic inference and keyword fallback
- `profiles.ts`: canonical profile markdown
- `loader.ts`: file loading and merge
- `evaluator.ts`: matching and effective effects

### `@kapibara/scanners`

- detect secrets with a fixed pattern catalog
- suppress placeholders and references
- redact values before they leave the scanner
- scan one file with size limits and path confinement
- detect instruction-like text for prompt-injection reporting

Key files:

- `patterns.ts`: patterns and placeholder rules
- `redact.ts`: redaction functions
- `scan.ts`: text and file scanning, `ScanError`
- `prompt.ts`: prompt-injection patterns

`scanSensitiveFile` resolves the real path, checks it is inside the real
workspace root, rejects directories, reads at most `maxBytes`, and skips binary
content with a reason.

### `@kapibara/core`

- classify actions and provide factor baselines
- detect target signals
- generate issues
- compute factors, score, floors, and decisions
- compare sources for conflicting facts
- load config and write sanitized audit records
- format human-readable summaries
- orchestrate preflight

Key files:

- `action.ts`: 21 action profiles
- `target.ts`: target signals
- `issues.ts`: issue construction
- `risk.ts`: factors, scoring, floors
- `decision.ts`: decision precedence and recommendation
- `preflight.ts`: orchestration and scan boundaries
- `analyze.ts`: compose issues, factors, rules, decision
- `consistency.ts`: source comparison
- `audit.ts`: sanitized JSONL audit
- `fail.ts`: failure results and fail modes

### `@kapibara/mcp`

- register exactly five tools
- validate inputs and outputs
- load runtime context per call
- convert handler responses to MCP results
- provide the stdio CLI

Key files:

- `server.ts`: tool registration and instructions
- `handlers.ts`: tool implementations
- `context.ts`: config and rules loading
- `tool-schemas.ts`: MCP input schemas
- `cli.ts`: argument parsing and stdio transport

## Invariants

These are enforced by tests and should remain true:

1. The MCP server exposes exactly five tools.
2. Decisions are exactly the four strings.
3. A raw secret never appears in serialized output.
4. File scans stay inside the workspace unless `allowOutsideCwd` is explicitly
   set by library code; the MCP surface never sets it.
5. Directories are never crawled.
6. A broken rules file produces an explicit failure, not a silent pass.
7. Package dependencies stay acyclic.
8. The engine is deterministic and makes no network calls.
9. Audit records contain no raw content, evidence, or secrets.
10. Profile markdown mirrors stay in sync with the canonical strings.

## Testing

- `packages/policy/tests`: parser, loader, evaluator, profile mirrors
- `packages/scanners/tests`: text scanning, file boundaries, redaction
- `packages/core/tests`: classification, targets, risk, decisions, comparison,
  config, audit, formatting, preflight
- `packages/mcp/tests`: handlers and an in-memory MCP client/server integration
- `evals/`: 15 end-to-end decision cases

## Extension points

- Add a secret pattern in `scanners/patterns.ts`.
- Add an action profile in `core/action.ts`.
- Add a target signal in `core/target.ts`.
- Add a rule profile in `policy/profiles.ts` and mirror it in `rules/`.
- The public MCP surface is fixed at five tools. Adding another requires a major
  version and a design review.

Avoid adding a network client, a remote policy lookup, or a model call to the
decision path. That would break the local-first, deterministic contract.
