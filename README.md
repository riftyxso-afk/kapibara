# Kapibara

**Your AI can act. Kapibara checks before it does.**

Kapibara is a local-first preflight safety layer for AI agents. It answers one
question before an agent changes files, sends data, deploys code, spends money,
or rewrites history:

> Should this action proceed?

It returns exactly one of four decisions: **ALLOW**, **WARN**,
**REQUIRE_APPROVAL**, or **BLOCK**.

Kapibara is deterministic, inspectable, and runs entirely on your machine. There
is no account, no cloud dependency, and no telemetry.

```text
🦫 Kapibara preflight
Action: force push → origin/main
Decision: BLOCK
Risk: CRITICAL (85/100)

Findings:
  !!! protected_branch_force_push: Force pushing a protected branch may rewrite shared repository history.
      target: origin/main
  !!! rule_violation: Rule matched: Never force push to main.
      rule: never-force-push-to-main
      source: default:balanced

Recommendation: Do not rewrite protected branch history. Use a normal push or open a pull request.

Human approval is required before this action proceeds.
```

## Why

Agents are useful because they can act. The same capability makes a wrong action
expensive. Prompt instructions alone are not a control surface: they can be
forgotten, diluted, or overridden by content the agent reads.

Kapibara gives the agent a small, explicit checkpoint with a decision it must
respect, plus evidence a human can review. It is not a sandbox and does not
replace operating-system permissions. It is the step between "the model decided
to do something" and "the tool call happened."

## Quick start

Requires Node.js 20 or newer and pnpm.

```bash
pnpm install
pnpm build
pnpm test
```

Run the MCP server directly:

```bash
pnpm --filter @kapibara/mcp dev
```

The server speaks MCP over stdio and is normally launched by an MCP client.

### Claude Desktop

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "kapibara": {
      "command": "npx",
      "args": ["-y", "@kapibara/mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add kapibara -- npx -y @kapibara/mcp
```

To install the bundled skills and MCP server as a plugin from a local checkout:

```bash
claude plugin marketplace add /path/to/kapibara
claude plugin install kapibara@kapibara
```

### OpenCode

`opencode.json`:

```json
{
  "mcp": {
    "kapibara": {
      "type": "local",
      "command": ["npx", "-y", "@kapibara/mcp"],
      "enabled": true
    }
  }
}
```

### From a local checkout

Point the client at the built binary and pin the workspace:

```json
{
  "mcpServers": {
    "kapibara": {
      "command": "node",
      "args": [
        "/absolute/path/to/kapibara/packages/mcp/dist/cli.js",
        "--cwd",
        "/absolute/path/to/project"
      ]
    }
  }
}
```

## Decisions

| Decision           | Meaning                                 | Agent behavior                        |
| ------------------ | --------------------------------------- | ------------------------------------- |
| `ALLOW`            | No meaningful issue found.              | Proceed.                              |
| `WARN`             | Risk exists but is bounded.             | Proceed carefully and tell the user.  |
| `REQUIRE_APPROVAL` | A human must confirm this exact action. | Stop and ask. Wait for a real answer. |
| `BLOCK`            | The action is not permitted.            | Do not proceed. Report the evidence.  |

`REQUIRE_APPROVAL` is a gate, not a notification. If the user changes the
target, scope, or command, run preflight again.

## MCP tools

The server exposes exactly five read-only tools.

| Tool                      | Purpose                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `kapibara_preflight`      | Full check: classify, score, apply rules, scan explicit content/files, return a binding decision.                   |
| `kapibara_action_risk`    | Explain classification, risk factors, issues, and score without project rules or file access.                       |
| `kapibara_compare`        | Find conflicting amounts, dates, versions, URLs, emails, filenames, IDs, percentages, or quantities across sources. |
| `kapibara_scan_sensitive` | Scan explicit text or one explicit file for secrets. Values are redacted.                                           |
| `kapibara_rules_check`    | Evaluate project, global, and default rules without scanning files.                                                 |

Every successful tool call returns a human-readable `summary` and structured
`data` in both `content` and `structuredContent`. Tool failures set
`isError: true`.

### `kapibara_preflight`

```json
{
  "action": "upload file",
  "target": "report.txt",
  "intent": "Send the quarterly report to the external auditor.",
  "context": {
    "environment": "production",
    "external": true,
    "metadata": {
      "content": "Quarterly totals are attached."
    }
  },
  "files": ["reports/q3.txt"],
  "scanTarget": true
}
```

- `action` and `target` are the important fields. Be specific.
- `context.metadata.command` is scanned for dangerous shell patterns.
- `context.metadata.content` is scanned for secrets and prompt injection.
- `context.metadata.branch` helps detect protected-branch operations.
- `files` is an explicit list. Directories are never crawled.
- `scanTarget` defaults to `true` and scans the single named target only for
  outbound actions. The target must stay inside the workspace.

### `kapibara_scan_sensitive`

Provide exactly one of `text` or `path`:

```json
{ "path": "config/production.env" }
```

Paths are confined to the workspace. Directories are rejected. The tool never
returns a raw secret value.

### `kapibara_compare`

```json
{
  "sources": [
    { "name": "invoice", "content": "Total: $1,200 due 2026-11-01" },
    { "name": "email", "content": "Total: $1,500 due 2026-11-01" }
  ]
}
```

### `kapibara_rules_check`

```json
{
  "action": "git push",
  "target": "origin/feature",
  "profile": "strict"
}
```

## Skills

The repository ships six agent skills. Each one is a `SKILL.md` with frontmatter
and a focused workflow.

| Skill                  | Use it when                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| `preflight-check`      | Before any side-effecting action. The default safety gate.        |
| `action-risk`          | You need to explain or compare risk without project rules.        |
| `sensitive-data-check` | Content may contain secrets and is about to leave the workspace.  |
| `consistency-check`    | The same fact appears in multiple sources and a mismatch matters. |
| `second-opinion`       | Another agent's plan needs an adversarial review.                 |
| `setup`                | Installing, configuring, or troubleshooting Kapibara.             |

Skills live in [`skills/`](./skills). They are discovered by Claude Code and
OpenCode when this repository is used as a plugin or skill source.

## Rules

Kapibara combines three layers, in order of precedence:

1. Project rules: `.kapibara/rules.md`
2. Global rules: `~/.kapibara/rules.md`
3. Profile defaults: `balanced`, `developer`, or `strict`

A project rule overrides a global rule with the same ID. A global rule overrides
a default. If two layers define the same rule with different effects, Kapibara
requires approval, unless one definition is a non-overridable secret rule, in
which case it blocks.

### Rule format

```markdown
# BLOCK

- Never force push to main.
- Never expose secrets.

# APPROVAL

- Ask before deploying on Fridays.
- Ask before deleting customer records.

# WARN

- Warn before editing generated files.

# ALLOW

- Allow reading documentation.
```

Rules can also use an inline effect:

```markdown
- [block] Never publish the internal roadmap.
- [approval] Ask before changing the billing plan.
```

A rule ID is derived from its text. A `# BLOCK` rule is overridable by an
explicit user request, except for rules about secrets, `.env` files, or secret
exposure. Those remain blocking.

### Profiles

| Profile     | Behavior                                                                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `balanced`  | Default. Blocks secret exposure and force pushes to main; approval for production, destructive database work, backups, and email.                          |
| `developer` | Balanced plus protected-branch pushes, destructive shell commands, package publishing, and production config changes.                                      |
| `strict`    | Developer plus approval for any file deletion, any push, any upload or publish, external communication, purchases, permission changes, and shell commands. |
| `custom`    | No profile defaults; use project and global rules only.                                                                                                    |

Canonical profile text lives in
[`packages/policy/src/profiles.ts`](./packages/policy/src/profiles.ts). The
markdown mirrors in [`rules/`](./rules) are checked by tests.

## Configuration

Project config: `.kapibara/config.json`
Global config: `~/.kapibara/config.json`

```json
{
  "profile": "balanced",
  "auditLog": false,
  "failMode": "risk_based",
  "auditRetentionDays": 7
}
```

| Key                  | Default      | Meaning                                                                  |
| -------------------- | ------------ | ------------------------------------------------------------------------ |
| `profile`            | `balanced`   | Rule profile.                                                            |
| `auditLog`           | `false`      | Write sanitized JSONL audit records.                                     |
| `failMode`           | `risk_based` | Behavior when rules cannot be loaded: `risk_based`, `closed`, or `open`. |
| `auditRetentionDays` | `7`          | Delete audit files older than this.                                      |

Project config overrides global config, which overrides defaults.

### Fail modes

- `risk_based`: keep the risk-based decision and report the rule failure.
- `closed`: block when rules cannot be loaded.
- `open`: continue without project rules.

`risk_based` is the default because a broken rules file should be visible, not
silent, while still preserving the action-risk decision.

### Audit log

When enabled, preflight appends one JSONL record per call to
`.kapibara/logs/audit-YYYY-MM-DD.jsonl`. Records contain the action, target, decision,
score, issue types, matched rule IDs, and scan counts. They do not contain raw
content or secret values. Files older than the retention window are removed.

## CLI

```bash
kapibara-mcp --help
kapibara-mcp --version
kapibara-mcp --cwd /path/to/project
kapibara-mcp --quiet
```

The CLI is a stdio MCP server. It has no interactive mode.

## How it works

```text
action + target + context
        │
        ├─ classify action ──────────────► action profile
        ├─ detect target signals ────────► backup, .env, production, ...
        ├─ scan explicit content/files ──► redacted findings
        ├─ evaluate rules ───────────────► matched rules, precedence, conflicts
        │
        ├─ compute six risk factors ─────► score 0–100
        ├─ apply issue and rule floors ──► final score
        └─ decide ───────────────────────► ALLOW | WARN | REQUIRE_APPROVAL | BLOCK
```

### Risk factors

| Factor                  | Max | Examples                                           |
| ----------------------- | --- | -------------------------------------------------- |
| `destructive_impact`    | 25  | recursive delete, drop database, broad scope       |
| `reversibility`         | 20  | force push, overwrite, non-reversible context      |
| `sensitive_data`        | 20  | detected secrets, credential files, financial data |
| `external_side_effects` | 15  | upload, publish, email, deploy, external context   |
| `production_impact`     | 10  | production target or environment                   |
| `uncertainty`           | 10  | unknown action, environment mismatch, failed scan  |

Scores are deterministic. Issue severity applies a floor: medium 25, high 50,
critical 75. A blocking issue or a blocking rule applies a floor of 85.

The final decision is:

- `BLOCK` if any issue is blocking or a rule says block.
- `REQUIRE_APPROVAL` if a rule says approval, any issue is critical or high, or
  the score is at least 50.
- `WARN` if a rule says warn, any issue is medium, or the score is at least 25.
- `ALLOW` otherwise.

## Packages

| Package              | Responsibility                                                                          |
| -------------------- | --------------------------------------------------------------------------------------- |
| `@kapibara/core`     | Classification, risk scoring, decisions, consistency checks, config, audit, formatting. |
| `@kapibara/policy`   | Rule parsing, topics, profiles, precedence, conflicts, evaluation.                      |
| `@kapibara/scanners` | Secret patterns, redaction, file scanning, path confinement, prompt-injection scanning. |
| `@kapibara/mcp`      | MCP server, five tool handlers, stdio CLI.                                              |

Dependency direction is acyclic:

```text
@kapibara/mcp ──► @kapibara/core ──► @kapibara/policy
       │                  └────────► @kapibara/scanners
       ├──────────────────────────► @kapibara/policy
       └──────────────────────────► @kapibara/scanners
```

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm typecheck
pnpm eval
pnpm demo
pnpm --filter @kapibara/mcp dev
```

- `pnpm test` runs the Vitest suite across all packages.
- `pnpm eval` builds and runs 15 end-to-end decision evals.
- `pnpm demo` builds and runs the example script.
- `pnpm format` and `pnpm format:check` use Prettier.

### Repository layout

```text
kapibara/
├── packages/
│   ├── core/          # risk engine and orchestration
│   ├── policy/        # rules and profiles
│   ├── scanners/      # secrets and prompt injection
│   └── mcp/           # MCP server and CLI
├── skills/            # six agent skills
├── rules/             # profile markdown mirrors
├── evals/             # 15 decision evals and runner
├── examples/          # runnable demo and sample config
├── schemas/           # JSON Schemas for inputs and config
├── docs/              # deeper documentation
├── .claude-plugin/    # Claude Code plugin manifest
├── .mcp.json          # project-scoped MCP configuration
└── .github/workflows/ # CI
```

## Security and privacy

- No network calls at runtime. No account. No telemetry.
- Secrets are matched locally and returned only as redacted values.
- File scans are confined to the workspace and require an explicit file path.
- Directories are never crawled automatically.
- Inputs and files have size limits and findings have a cap.
- Scanned content is treated as untrusted data. Instruction-like text is
  reported as prompt injection and never executed.
- Audit records are sanitized and off by default.

Kapibara is a heuristic safety layer, not a guarantee. Regex scanners can miss
secrets and can flag placeholders. Classification is pattern-based. A determined
adversary with local code execution can bypass any in-process check. Use
Kapibara with real sandboxing, least-privilege credentials, and human review for
irreversible work.

See [SECURITY.md](./SECURITY.md) and [docs/security.md](./docs/security.md).

## Limitations

- Classification and rule matching are deterministic heuristics, not semantic
  understanding. Unusual phrasing may be classified as `unknown`.
- Secret detection is regex-based. It favors a low false-positive rate and will
  miss unusual or encoded credentials.
- Prompt-injection detection flags instruction-like text; it does not prove
  content is malicious.
- File scanning reads one explicit file at a time (up to the configured limit).
  It does not inspect archives, binaries, or the whole repository.
- The MCP server is read-only with respect to the workspace, except for the
  optional audit log.
- There is no remote policy service, shared team dashboard, or approval UI. The
  human approval loop happens in the agent client.
- The npm package names are prepared for publishing but this repository does not
  publish them automatically.

## Documentation

- [Quick start](./docs/quickstart.md)
- [Decision model](./docs/decisions.md)
- [Rules and profiles](./docs/rules.md)
- [Configuration](./docs/configuration.md)
- [MCP tools](./docs/mcp-tools.md)
- [Skills](./docs/skills.md)
- [Architecture](./docs/architecture.md)
- [Security](./docs/security.md)
- [Evals](./docs/evals.md)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Security reports should follow
[SECURITY.md](./SECURITY.md).

## License

MIT. See [LICENSE](./LICENSE).
